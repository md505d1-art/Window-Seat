import { Archive, ArchiveRestore, ArrowLeft, Copy, Trash, WandSparkles } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useCrumbTitle } from '@/app/ui-context'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/inputs'
import { Badge, Card, DemoBadge, ErrorState, ListSkeleton } from '@/components/ui/misc'
import { FavouriteButton } from '@/features/shared/bits'
import { PhotoUploader } from '@/features/shared/PhotoUploader'
import { useLogActivity, useProfile, useRow, useRows, useTable } from '@/lib/data'
import { netProfit, projectedProfit } from '@/lib/finance'
import { currencySymbol, money, todayISO } from '@/lib/format'
import { nextSku } from '@/lib/listing'
import { FLIP_STATUSES, type FlipItem } from '@/lib/types'
import { cn, errorMessage } from '@/lib/utils'
import { CATEGORIES, CONDITIONS, itemTitle, PLATFORMS, STATUS_META, useFlipActions } from './meta'

type Draft = Omit<FlipItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>

function emptyDraft(sku: string): Draft {
  return {
    sku, title: '', brand: '', category: '', size: '', colour: '', condition: '', status: 'draft', archived_from: null, platform: '',
    purchase_price: null, listing_price: null, sale_price: null, seller_fees: 0, shipping_cost: 0, other_expenses: 0,
    purchase_date: todayISO(), listed_date: null, sold_date: null, measurements: '', notes: '', photos: [], listing: null,
    favourite: false, is_demo: false,
  }
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  )
}

export function ItemEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const existing = useRow('flip_items', id)
  const all = useRows('flip_items')
  const { data: profile } = useProfile()
  const cur = profile?.currency ?? 'GBP'
  const sym = currencySymbol(cur)
  const { create, update } = useTable('flip_items')
  const actions = useFlipActions()
  const log = useLogActivity()
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [dirty, setDirty] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  useCrumbTitle(isNew ? 'New item' : existing.data ? itemTitle(existing.data) : undefined)

  React.useEffect(() => {
    if (isNew && all.data && !draft) setDraft(emptyDraft(nextSku(all.data.map((i) => i.sku))))
  }, [isNew, all.data, draft])

  const dirtyRef = React.useRef(dirty)
  dirtyRef.current = dirty
  React.useEffect(() => {
    if (isNew || !existing.data) return
    const server = existing.data
    if (dirtyRef.current) {
      // Keep unsaved edits; only take changes made by the header actions (favourite, archive).
      setDraft((d) => (d ? { ...d, favourite: server.favourite, status: server.status, archived_from: server.archived_from } : { ...server }))
    } else {
      setDraft({ ...server })
    }
  }, [isNew, existing.data])

  React.useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (!isNew && existing.isLoading) return <ListSkeleton rows={6} />
  if (!isNew && existing.error) return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />
  if (!isNew && !existing.data)
    return (
      <div className="py-16 text-center">
        <p className="font-medium">This item no longer exists.</p>
        <Button asChild variant="outline" className="mt-3">
          <Link to="/flip">Back to inventory</Link>
        </Button>
      </div>
    )
  if (!draft) return <ListSkeleton rows={6} />

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => (d ? { ...d, [k]: v } : d))
    setDirty(true)
  }
  const setStatus = (status: Draft['status']) => {
    if (!draft) return
    const patch = actions.statusPatch({ ...draft, id: id ?? '' } as FlipItem, status)
    setDraft({ ...draft, ...patch } as Draft)
    setDirty(true)
  }

  const profit = netProfit(draft)
  const projected = projectedProfit(draft)
  const skuTaken = (all.data ?? []).some((i) => i.sku.toUpperCase() === draft.sku.trim().toUpperCase() && i.id !== id)
  const soldWithoutPrice = draft.status === 'sold' && draft.sale_price === null
  const invalid = !draft.sku.trim() || skuTaken || soldWithoutPrice

  const save = async () => {
    if (invalid) return
    setSaving(true)
    try {
      const payload = { ...draft, sku: draft.sku.trim(), title: draft.title.trim() }
      if (isNew) {
        const created = await create.mutateAsync(payload)
        log({ module: 'flip', action: 'added', entity_type: 'item', entity_id: created.id, title: itemTitle(created), link: `/flip/items/${created.id}` })
        if (created.status === 'sold') actions.afterSold(created)
        setDirty(false)
        toast.success(`${created.sku} added to inventory`)
        navigate(`/flip/items/${created.id}`, { replace: true })
      } else {
        const before = existing.data!
        const saved = await update.mutateAsync({ id: id!, patch: payload })
        if (saved.status === 'sold' && before.status !== 'sold') actions.afterSold(saved)
        else log({ module: 'flip', action: 'updated', entity_type: 'item', entity_id: saved.id, title: itemTitle(saved), link: `/flip/items/${saved.id}` })
        setDirty(false)
        toast.success('Saved')
      }
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="pb-20 lg:pb-0"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link to="/flip" aria-label="Back to inventory">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 truncate text-xl font-semibold tracking-tight">
              {isNew ? 'New item' : itemTitle(draft)}
              {!isNew && <DemoBadge show={draft.is_demo} />}
            </h1>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{draft.sku}</span>
              <Badge tone={STATUS_META[draft.status].tone}>{STATUS_META[draft.status].label}</Badge>
              {dirty && <span className="text-warning">Unsaved changes</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isNew && existing.data && (
            <>
              <FavouriteButton on={draft.favourite} onToggle={() => actions.toggleFavourite(existing.data!)} label={itemTitle(draft)} />
              <Button type="button" variant="outline" size="sm" onClick={() => navigate(`/flip/listing?item=${id}`)}>
                <WandSparkles /> Write listing
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const copy = await actions.duplicate(existing.data!)
                  toast.success(`Duplicated as ${copy.sku}`)
                  navigate(`/flip/items/${copy.id}`)
                }}
              >
                <Copy /> Duplicate
              </Button>
              {draft.status === 'archived' ? (
                <Button type="button" variant="outline" size="sm" onClick={() => actions.unarchive(existing.data!)}>
                  <ArchiveRestore /> Restore
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => actions.archive(existing.data!)}>
                  <Archive /> Archive
                </Button>
              )}
              <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setConfirmDelete(true)} aria-label="Delete item">
                <Trash />
              </Button>
            </>
          )}
          <Button type="submit" variant="accent" loading={saving} disabled={invalid || (!dirty && !isNew)} className="hidden lg:inline-flex">
            {isNew ? 'Add to inventory' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-4">
          <Section title="Photos" description="Clear, well-lit photos sell faster. The first one is the cover.">
            <PhotoUploader module="flip" value={draft.photos} onChange={(p) => set('photos', p)} />
          </Section>

          <Section title="Details" description="Only record what you can see on the item. You can check anything unclear later.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="f-title" className="sm:col-span-2" hint="Use the listing assistant to format it for marketplaces.">
                <Input id="f-title" value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Carhartt double knee work trousers brown" />
              </Field>
              <Field label="Brand" htmlFor="f-brand" hint="As written on the label. Leave blank if unbranded.">
                <Input id="f-brand" value={draft.brand} onChange={(e) => set('brand', e.target.value)} />
              </Field>
              <Field label="Category" htmlFor="f-category">
                <Input id="f-category" list="flip-categories" value={draft.category} onChange={(e) => set('category', e.target.value)} />
                <datalist id="flip-categories">
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Size" htmlFor="f-size">
                <Input id="f-size" value={draft.size} onChange={(e) => set('size', e.target.value)} placeholder="e.g. M, UK 10, W32 L30" />
              </Field>
              <Field label="Colour" htmlFor="f-colour">
                <Input id="f-colour" value={draft.colour} onChange={(e) => set('colour', e.target.value)} />
              </Field>
              <Field label="Condition" htmlFor="f-condition" className="sm:col-span-2" hint="Mention any marks, wear or repairs honestly.">
                <Input id="f-condition" list="flip-conditions" value={draft.condition} onChange={(e) => set('condition', e.target.value)} />
                <datalist id="flip-conditions">
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Measurements" htmlFor="f-measure" className="sm:col-span-2">
                <Textarea id="f-measure" rows={2} value={draft.measurements} onChange={(e) => set('measurements', e.target.value)} placeholder="e.g. pit to pit 56cm, length 70cm" />
              </Field>
              <Field label="Notes" htmlFor="f-notes" className="sm:col-span-2">
                <Textarea id="f-notes" rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
              </Field>
            </div>
          </Section>
        </div>

        <div className="grid content-start gap-4">
          <Section title="Status">
            <div className="grid gap-4">
              <Field label="Status" htmlFor="f-status">
                <Select id="f-status" value={draft.status} onChange={(e) => setStatus(e.target.value as Draft['status'])}>
                  {FLIP_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="SKU" htmlFor="f-sku" error={skuTaken ? 'Another item already uses this SKU.' : !draft.sku.trim() ? 'Every item needs a SKU.' : undefined} hint="Assigned automatically. You can change it.">
                <Input id="f-sku" className="font-mono" value={draft.sku} onChange={(e) => set('sku', e.target.value.toUpperCase())} aria-invalid={skuTaken || !draft.sku.trim()} />
              </Field>
              <Field label="Platform" htmlFor="f-platform">
                <Input id="f-platform" list="flip-platforms" value={draft.platform} onChange={(e) => set('platform', e.target.value)} />
                <datalist id="flip-platforms">
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </Field>
            </div>
          </Section>

          <Section title="Money" description={`All amounts in ${cur}.`}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Purchase price" htmlFor="f-cost">
                <MoneyInput id="f-cost" symbol={sym} value={draft.purchase_price} onChange={(v) => set('purchase_price', v)} />
              </Field>
              <Field label="Bought on" htmlFor="f-bought">
                <Input id="f-bought" type="date" value={draft.purchase_date ?? ''} onChange={(e) => set('purchase_date', e.target.value || null)} />
              </Field>
              <Field label="Listing price" htmlFor="f-list">
                <MoneyInput id="f-list" symbol={sym} value={draft.listing_price} onChange={(v) => set('listing_price', v)} />
              </Field>
              <Field label="Listed on" htmlFor="f-listed">
                <Input id="f-listed" type="date" value={draft.listed_date ?? ''} onChange={(e) => set('listed_date', e.target.value || null)} />
              </Field>
              <Field label="Sale price" htmlFor="f-sale" error={soldWithoutPrice ? 'Add the sale price.' : undefined}>
                <MoneyInput id="f-sale" symbol={sym} value={draft.sale_price} onChange={(v) => set('sale_price', v)} aria-invalid={soldWithoutPrice} />
              </Field>
              <Field label="Sold on" htmlFor="f-sold">
                <Input id="f-sold" type="date" value={draft.sold_date ?? ''} onChange={(e) => set('sold_date', e.target.value || null)} />
              </Field>
              <Field label="Seller fees" htmlFor="f-fees">
                <MoneyInput id="f-fees" symbol={sym} value={draft.seller_fees} onChange={(v) => set('seller_fees', v ?? 0)} />
              </Field>
              <Field label="Shipping" htmlFor="f-ship">
                <MoneyInput id="f-ship" symbol={sym} value={draft.shipping_cost} onChange={(v) => set('shipping_cost', v ?? 0)} />
              </Field>
              <Field label="Other expenses" htmlFor="f-other" className="col-span-2" hint="Cleaning, repairs, packaging.">
                <MoneyInput id="f-other" symbol={sym} value={draft.other_expenses} onChange={(v) => set('other_expenses', v ?? 0)} />
              </Field>
            </div>
            <div className="mt-4 rounded-xl bg-surface-2 p-3" aria-live="polite">
              {profit !== null ? (
                <>
                  <p className="text-xs text-muted-foreground">Net profit</p>
                  <p className={cn('text-2xl font-semibold tabular', profit >= 0 ? 'text-success' : 'text-destructive')}>{money(profit, cur)}</p>
                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground tabular">
                    {money(draft.sale_price, cur)} sale − {money(draft.purchase_price ?? 0, cur)} cost − {money(draft.seller_fees, cur)} fees − {money(draft.shipping_cost, cur)} shipping − {money(draft.other_expenses, cur)} other
                  </p>
                </>
              ) : projected !== null ? (
                <>
                  <p className="text-xs text-muted-foreground">Profit if it sells at the listing price</p>
                  <p className="text-2xl font-semibold tabular">{money(projected, cur)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Before any fees or postage you haven’t entered yet.</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Add a listing or sale price to see profit.</p>
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* Sticky save bar on phones and tablets */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-[max(16px,env(safe-area-inset-left))] pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <Button type="submit" variant="accent" className="w-full" loading={saving} disabled={invalid || (!dirty && !isNew)}>
          {isNew ? 'Add to inventory' : dirty ? 'Save changes' : 'Saved'}
        </Button>
      </div>

      {!isNew && existing.data && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete ${itemTitle(draft)}?`}
          description="This permanently removes the item, its photos and its sales record. Archive it instead to keep your profit history."
          onConfirm={async () => {
            await actions.destroy(existing.data!)
            setDirty(false)
            toast.success('Item deleted')
            navigate('/flip')
          }}
        />
      )}
    </form>
  )
}
