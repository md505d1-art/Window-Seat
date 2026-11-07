import { Check, CircleCheck, ClipboardCopy, Info, Save, Sparkles, TriangleExclamationPoint, Wand } from 'lucide-react'
import * as React from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Input, MoneyInput, Select, TagInput, Textarea } from '@/components/ui/inputs'
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/misc'
import { useBackend } from '@/features/auth/auth'
import { imageToBase64, PhotoUploader } from '@/features/shared/PhotoUploader'
import { describeAiStatus, generateListing, useAiStatus } from '@/lib/ai'
import { useLogActivity, useProfile, useRows, useTable } from '@/lib/data'
import { isSold, priceRangeFromHistory } from '@/lib/finance'
import { currencySymbol, money } from '@/lib/format'
import { applyCasing, describeFromTitle, fullListingText, missingFacts, normaliseHashtags, normaliseTitle, templateListing, toHashtag } from '@/lib/listing'
import type { FlipItem, ListingDraft } from '@/lib/types'
import { cn, copyText, errorMessage } from '@/lib/utils'
import { itemTitle } from './meta'
import { Package } from 'lucide-react'

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={!text.trim()}
      onClick={async () => {
        const ok = await copyText(text)
        if (ok) {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } else toast.error('Your browser blocked copying. Select the text and copy it manually.')
      }}
    >
      {done ? <Check /> : <ClipboardCopy />} {done ? 'Copied' : label}
    </Button>
  )
}

/** Live checks against the Flip listing rules. */
function RuleChecks({ draft, item, properNouns }: { draft: ListingDraft; item: FlipItem; properNouns: string[] }) {
  const expected = normaliseTitle(draft.title, item.brand, item.sku, properNouns)
  const checks = [
    { ok: draft.title === expected, label: 'Lowercase except brand and proper nouns', fix: expected },
    { ok: draft.title.trim().endsWith(item.sku), label: 'SKU at the end of the title' },
    { ok: draft.hashtags.length === 5, label: `Exactly five hashtags (${draft.hashtags.length} now)` },
    { ok: draft.description.split('\n').filter(Boolean).length <= 8, label: 'Short description (8 lines or fewer)' },
    { ok: draft.price_low === null || draft.price_high === null || draft.price_low <= draft.price_high, label: 'Price range low ≤ high' },
  ]
  return (
    <ul className="grid grid-cols-1 gap-1 text-xs">
      {checks.map((c) => (
        <li key={c.label} className={cn('flex items-center gap-1.5', c.ok ? 'text-success' : 'text-warning')}>
          {c.ok ? <CircleCheck className="size-3.5" /> : <TriangleExclamationPoint className="size-3.5" />}
          {c.label}
        </li>
      ))}
    </ul>
  )
}

export function ListingAssistantPage() {
  const [params, setParams] = useSearchParams()
  const items = useRows('flip_items')
  const itemId = params.get('item') ?? ''
  const item = (items.data ?? []).find((i) => i.id === itemId)
  const candidates = (items.data ?? []).filter((i) => i.status !== 'sold' && i.status !== 'archived')

  return (
    <div>
      <PageHeader
        eyebrow="Flip"
        title="Listing assistant"
        description="Turn an item’s details and photos into a marketplace-ready listing. Everything stays editable, and nothing is posted for you."
      />
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <Field label="Item" htmlFor="la-item" className="min-w-0 flex-1 basis-64">
          <Select id="la-item" value={itemId} onChange={(e) => setParams(e.target.value ? { item: e.target.value } : {})}>
            <option value="">Choose an item…</option>
            {candidates.map((i) => (
              <option key={i.id} value={i.id}>
                {i.sku} — {itemTitle(i)}
              </option>
            ))}
            {item && !candidates.includes(item) && <option value={item.id}>{item.sku} — {itemTitle(item)}</option>}
          </Select>
        </Field>
        <Button variant="outline" asChild>
          <Link to="/flip/items/new">Add a new item first</Link>
        </Button>
      </Card>
      {!item ? (
        <EmptyState icon={Package} title="Pick an item to write a listing" description="Choose from your inventory above. New items get a SKU automatically, which goes at the end of the title." />
      ) : (
        <Composer key={item.id} item={item} allItems={items.data ?? []} />
      )}
    </div>
  )
}

function Composer({ item, allItems }: { item: FlipItem; allItems: FlipItem[] }) {
  const { data: profile } = useProfile()
  const cur = profile?.currency ?? 'GBP'
  const ai = useAiStatus()
  const backend = useBackend()
  const { update } = useTable('flip_items')
  const log = useLogActivity()

  const [facts, setFacts] = React.useState({
    brand: item.brand, category: item.category, size: item.size, colour: item.colour, condition: item.condition,
    measurements: item.measurements, notes: item.notes,
  })
  const [whatItIs, setWhatItIs] = React.useState(() => describeFromTitle(item))
  const [properNouns, setProperNouns] = React.useState<string[]>([])
  const [photos, setPhotos] = React.useState<string[]>(item.photos)
  const [draft, setDraft] = React.useState<ListingDraft | null>(item.listing)
  const [verified, setVerified] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState<'ai' | 'save' | null>(null)
  const working = { ...item, ...facts, photos }

  const range = priceRangeFromHistory(allItems, working)

  const buildTemplate = () => {
    setDraft(templateListing(working, whatItIs, range, properNouns))
    setVerified(new Set())
  }

  const buildAi = async () => {
    setBusy('ai')
    try {
      const urls = await backend.fileUrls(photos.slice(0, 4))
      const images = await Promise.all(
        photos.slice(0, 4).filter((p) => urls[p]).map(async (p) => imageToBase64(await (await fetch(urls[p])).blob())),
      )
      const norm = (s: string) => s.trim().toLowerCase()
      const comparable = allItems
        .filter((i) => isSold(i) && i.sale_price !== null && i.id !== item.id && (norm(i.brand) === norm(facts.brand) || norm(i.category) === norm(facts.category)))
        .slice(0, 25)
        .map((i) => ({ brand: i.brand, category: i.category, sale_price: i.sale_price as number, sold_date: i.sold_date }))
      const out = await generateListing({
        facts: { sku: item.sku, ...facts, what_it_is: whatItIs, proper_nouns: properNouns, currency: cur },
        images,
        comparable_sales: comparable,
      })
      // The formatting rules are enforced here as well, whatever the model returned.
      setDraft({
        title: normaliseTitle(out.title, facts.brand, item.sku, properNouns),
        description: out.bullets.map((b) => `• ${applyCasing(b.replace(/^[•\-*]\s*/, ''), [facts.brand, ...properNouns])}`).join('\n'),
        hashtags: normaliseHashtags(out.hashtags, { ...working, title: whatItIs }),
        category: out.category || facts.category,
        price_low: out.price_low,
        price_high: out.price_high,
        price_basis: out.price_rationale ? `${out.price_rationale} This is an estimate, not a guaranteed price.` : 'AI estimate, not a guaranteed price.',
        source: 'ai',
        verify: Array.from(new Set([...out.verify, ...missingFacts(working)])),
        generated_at: new Date().toISOString(),
      })
      setVerified(new Set())
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const saveToItem = async (applyTitle: boolean) => {
    if (!draft) return
    setBusy('save')
    try {
      await update.mutateAsync({
        id: item.id,
        patch: {
          ...facts,
          photos,
          listing: draft,
          ...(applyTitle ? { title: draft.title } : {}),
          ...(item.status === 'draft' ? { status: 'ready' as const } : {}),
        },
      })
      log({ module: 'flip', action: 'wrote listing for', entity_type: 'item', entity_id: item.id, title: itemTitle(item), link: `/flip/items/${item.id}` })
      toast.success(item.status === 'draft' ? 'Listing saved. Item marked ready to list.' : 'Listing saved to the item')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const setD = <K extends keyof ListingDraft>(k: K, v: ListingDraft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  const aiReady = ai.data?.state === 'ready'
  const sym = currencySymbol(cur)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card className="p-4 sm:p-5">
        <h2 className="text-sm font-semibold">1. Check the facts</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">The listing only uses what’s here. Fix anything that’s wrong before generating.</p>
        <div className="mt-4 grid gap-3">
          <PhotoUploader module="flip" value={photos} onChange={setPhotos} max={12} />
          <Field label="What is it?" htmlFor="la-what" hint="A few words for the title, e.g. “double knee work trousers”.">
            <Input id="la-what" value={whatItIs} onChange={(e) => setWhatItIs(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['brand', 'Brand'],
                ['category', 'Category'],
                ['size', 'Size'],
                ['colour', 'Colour'],
              ] as const
            ).map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`la-${k}`}>
                <Input id={`la-${k}`} value={facts[k]} onChange={(e) => setFacts({ ...facts, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
          <Field label="Condition" htmlFor="la-condition" hint="Describe it yourself, including any flaws.">
            <Input id="la-condition" value={facts.condition} onChange={(e) => setFacts({ ...facts, condition: e.target.value })} />
          </Field>
          <Field label="Measurements" htmlFor="la-measure">
            <Input id="la-measure" value={facts.measurements} onChange={(e) => setFacts({ ...facts, measurements: e.target.value })} />
          </Field>
          <Field label="Proper nouns to keep capitalised" htmlFor="la-proper" hint="Model or collection names, e.g. Air Max, Bedale.">
            <TagInput id="la-proper" value={properNouns} onChange={setProperNouns} placeholder="Type and press Enter" />
          </Field>
        </div>
        <div className="mt-5 grid gap-2">
          <Button variant="accent" onClick={buildTemplate}>
            <Wand /> Build from my details
          </Button>
          <Button variant="outline" onClick={buildAi} disabled={!aiReady} loading={busy === 'ai'}>
            <Sparkles /> Generate with AI{photos.length ? ` (uses ${Math.min(photos.length, 4)} photo${photos.length === 1 ? '' : 's'})` : ''}
          </Button>
          {!ai.isLoading && !aiReady && ai.data && (
            <p className="flex gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" /> {describeAiStatus(ai.data)} “Build from my details” works without AI.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">2. Edit and copy</h2>
          {draft && <Badge tone={draft.source === 'ai' ? 'accent' : 'neutral'}>{draft.source === 'ai' ? 'AI draft' : 'Built from your details'}</Badge>}
        </div>
        {!draft ? (
          <p className="mt-6 text-sm text-muted-foreground">Your listing appears here. Build it from your details, or use AI if it’s connected.</p>
        ) : (
          <div className="mt-4 grid gap-4">
            <Field label="Title" htmlFor="la-out-title">
              <div className="flex gap-2">
                <Input id="la-out-title" value={draft.title} onChange={(e) => setD('title', e.target.value)} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setD('title', normaliseTitle(draft.title, facts.brand, item.sku, properNouns))} title="Apply casing and SKU rules">
                  Fix format
                </Button>
              </div>
            </Field>
            <Field label="Description" htmlFor="la-out-desc">
              <Textarea id="la-out-desc" rows={7} value={draft.description} onChange={(e) => setD('description', e.target.value)} />
            </Field>
            <Field label="Hashtags" htmlFor="la-out-tags" hint="Exactly five. Press Enter to add.">
              <TagInput
                id="la-out-tags"
                value={draft.hashtags.map((t) => t.replace(/^#/, ''))}
                onChange={(tags) => setD('hashtags', tags.map((t) => `#${toHashtag(t)}`).filter((t) => t.length > 1))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Category" htmlFor="la-out-cat" className="col-span-2 sm:col-span-1">
                <Input id="la-out-cat" value={draft.category} onChange={(e) => setD('category', e.target.value)} />
              </Field>
              <Field label="Price from" htmlFor="la-low">
                <MoneyInput id="la-low" symbol={sym} value={draft.price_low} onChange={(v) => setD('price_low', v)} />
              </Field>
              <Field label="Price to" htmlFor="la-high">
                <MoneyInput id="la-high" symbol={sym} value={draft.price_high} onChange={(v) => setD('price_high', v)} />
              </Field>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              {draft.price_low !== null && draft.price_high !== null ? `Suggested range ${money(draft.price_low, cur)}–${money(draft.price_high, cur)}. ` : ''}
              {draft.price_basis}
            </p>

            <RuleChecks draft={draft} item={item} properNouns={properNouns} />

            {draft.verify.length > 0 && (
              <div className="rounded-xl border border-[color-mix(in_oklab,var(--warning)_40%,transparent)] bg-[color-mix(in_oklab,var(--warning)_7%,transparent)] p-3">
                <p className="text-xs font-semibold text-warning">Please check before posting</p>
                <ul className="mt-1.5 grid gap-1">
                  {draft.verify.map((v) => (
                    <li key={v}>
                      <label className="flex items-start gap-2 text-xs">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={verified.has(v)}
                          onChange={(e) => {
                            const s = new Set(verified)
                            if (e.target.checked) s.add(v)
                            else s.delete(v)
                            setVerified(s)
                          }}
                        />
                        <span className={verified.has(v) ? 'text-muted-foreground line-through' : ''}>{v}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <CopyButton label="Copy title" text={draft.title} />
              <CopyButton label="Copy description" text={draft.description} />
              <CopyButton label="Copy hashtags" text={draft.hashtags.join(' ')} />
              <CopyButton label="Copy full listing" text={fullListingText(draft)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="accent" onClick={() => saveToItem(true)} loading={busy === 'save'}>
                <Save /> Save and use this title
              </Button>
              <Button variant="ghost" onClick={() => saveToItem(false)} disabled={busy === 'save'}>
                Save draft only
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Orbit doesn’t post to Vinted, eBay or Depop. Paste the copied text into the marketplace’s own listing form.</p>
          </div>
        )}
      </Card>
    </div>
  )
}
