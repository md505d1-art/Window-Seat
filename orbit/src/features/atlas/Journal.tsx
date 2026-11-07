import { format } from 'date-fns'
import { BookOpen, Download, GalleryHorizontalEnd, Images, ListTree, MapPin, Plane, Plus, Search, Trash } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Select, TagInput, Textarea } from '@/components/ui/inputs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menu'
import { Badge, Card, DemoBadge, EmptyState, ErrorState, ListSkeleton, PageHeader, Segmented } from '@/components/ui/misc'
import { useBackend } from '@/features/auth/auth'
import { FavouriteButton } from '@/features/shared/bits'
import { PhotoUploader, Thumb } from '@/features/shared/PhotoUploader'
import { useLogActivity, useRows, useTable } from '@/lib/data'
import { shortDate, toDate, todayISO } from '@/lib/format'
import type { AtlasJournalEntry } from '@/lib/types'
import { downloadFile } from '@/lib/utils'

type View = 'timeline' | 'gallery' | 'trips'

function EntryDialog({ entry, open, onOpenChange }: { entry: AtlasJournalEntry | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { create, update, remove } = useTable('atlas_journal')
  const trips = useRows('atlas_trips')
  const places = useRows('atlas_places')
  const backend = useBackend()
  const log = useLogActivity()
  const blank = { title: '', body: '', entry_date: todayISO(), trip_id: '', place_id: '', tags: [] as string[], photos: [] as string[], favourite: false }
  const [f, setF] = React.useState(blank)
  const [confirm, setConfirm] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => {
    if (open)
      setF(entry ? { title: entry.title, body: entry.body, entry_date: entry.entry_date, trip_id: entry.trip_id ?? '', place_id: entry.place_id ?? '', tags: entry.tags, photos: entry.photos, favourite: entry.favourite } : blank)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.title.trim()) return
    setBusy(true)
    try {
      const patch = { ...f, title: f.title.trim(), trip_id: f.trip_id || null, place_id: f.place_id || null }
      if (entry) await update.mutateAsync({ id: entry.id, patch })
      else {
        const created = await create.mutateAsync(patch)
        log({ module: 'atlas', action: 'wrote', entity_type: 'journal', entity_id: created.id, title: created.title, link: `/atlas/journal?entry=${created.id}` })
      }
      toast.success(entry ? 'Entry saved' : 'Memory added to your journal')
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title={entry ? 'Journal entry' : 'New journal entry'} size="lg" className="module-atlas">
          <form onSubmit={save} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_170px]">
              <Field label="Title" htmlFor="j-title">
                <Input id="j-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus required maxLength={300} />
              </Field>
              <Field label="Date" htmlFor="j-date">
                <Input id="j-date" type="date" value={f.entry_date} onChange={(e) => setF({ ...f, entry_date: e.target.value || todayISO() })} required />
              </Field>
            </div>
            <Field label="What happened?" htmlFor="j-body">
              <Textarea id="j-body" rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
            </Field>
            <div>
              <p className="mb-2 text-[13px] font-medium">Photos</p>
              <PhotoUploader module="atlas" value={f.photos} onChange={(p) => setF({ ...f, photos: p })} max={20} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Trip" htmlFor="j-trip">
                <Select id="j-trip" value={f.trip_id} onChange={(e) => setF({ ...f, trip_id: e.target.value })}>
                  <option value="">No trip</option>
                  {(trips.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Place" htmlFor="j-place">
                <Select id="j-place" value={f.place_id} onChange={(e) => setF({ ...f, place_id: e.target.value })}>
                  <option value="">No place</option>
                  {(places.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tags" htmlFor="j-tags" className="sm:col-span-2">
                <TagInput id="j-tags" value={f.tags} onChange={(t) => setF({ ...f, tags: t })} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.favourite} onChange={(e) => setF({ ...f, favourite: e.target.checked })} /> Mark as a favourite memory
            </label>
            <DialogFooter className={entry ? 'justify-between' : undefined}>
              {entry && (
                <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}>
                  <Trash /> Delete
                </Button>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="accent" loading={busy} disabled={!f.title.trim()}>
                  {entry ? 'Save' : 'Add to journal'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {entry && (
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="Delete this entry?"
          description="The entry and its photos are removed permanently."
          onConfirm={async () => {
            await remove.mutateAsync(entry.id)
            if (entry.photos.length) backend.removeFiles(entry.photos).catch(() => undefined)
            onOpenChange(false)
          }}
        />
      )}
    </>
  )
}

function toMarkdown(entries: AtlasJournalEntry[], tripName: (id: string | null) => string | undefined, placeName: (id: string | null) => string | undefined) {
  return entries
    .map((e) => {
      const meta = [shortDate(e.entry_date), tripName(e.trip_id), placeName(e.place_id), e.tags.length ? e.tags.map((t) => `#${t}`).join(' ') : ''].filter(Boolean).join(' · ')
      return `## ${e.title}${e.favourite ? ' ★' : ''}\n\n_${meta}_\n\n${e.body}${e.photos.length ? `\n\n(${e.photos.length} photo${e.photos.length === 1 ? '' : 's'} in Orbit)` : ''}\n`
    })
    .join('\n---\n\n')
}

export function JournalPage() {
  const entries = useRows('atlas_journal', { order: [{ column: 'entry_date', ascending: false }] })
  const trips = useRows('atlas_trips')
  const places = useRows('atlas_places')
  const { update } = useTable('atlas_journal')
  const [params, setParams] = useSearchParams()
  const [view, setView] = React.useState<View>('timeline')
  const [trip, setTrip] = React.useState('')
  const [tag, setTag] = React.useState('')
  const [favOnly, setFavOnly] = React.useState(false)
  const [q, setQ] = React.useState('')

  const all = entries.data ?? []
  const openId = params.get('entry')
  const openEntry = all.find((e) => e.id === openId) ?? null
  const creating = params.get('new') === '1'
  const tripName = (id: string | null) => trips.data?.find((t) => t.id === id)?.title
  const placeName = (id: string | null) => places.data?.find((p) => p.id === id)?.name
  const tags = [...new Set(all.flatMap((e) => e.tags))].sort()
  const list = all.filter((e) => {
    if (trip && e.trip_id !== trip) return false
    if (tag && !e.tags.includes(tag)) return false
    if (favOnly && !e.favourite) return false
    const s = q.trim().toLowerCase()
    if (s && !`${e.title} ${e.body} ${e.tags.join(' ')}`.toLowerCase().includes(s)) return false
    return true
  })
  const byMonth = React.useMemo(() => {
    const m = new Map<string, AtlasJournalEntry[]>()
    for (const e of list) {
      const k = format(toDate(e.entry_date) ?? new Date(), 'MMMM yyyy')
      m.set(k, [...(m.get(k) ?? []), e])
    }
    return [...m.entries()]
  }, [list])
  const photos = list.flatMap((e) => e.photos.map((p) => ({ path: p, entry: e })))

  const exportMd = () => downloadFile(`orbit-journal-${todayISO()}.md`, `# Travel journal\n\n${toMarkdown(list, tripName, placeName)}`, 'text/markdown;charset=utf-8')
  const exportJson = () =>
    downloadFile(
      `orbit-journal-${todayISO()}.json`,
      JSON.stringify(list.map((e) => ({ title: e.title, date: e.entry_date, body: e.body, trip: tripName(e.trip_id) ?? null, place: placeName(e.place_id) ?? null, tags: e.tags, favourite: e.favourite, photo_count: e.photos.length })), null, 2),
      'application/json',
    )

  const close = () => {
    const next = new URLSearchParams(params)
    next.delete('entry')
    next.delete('new')
    setParams(next)
  }

  const card = (e: AtlasJournalEntry) => (
    <article key={e.id} className="flex min-w-0 gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card">
      {e.photos[0] && (
        <button onClick={() => setParams({ entry: e.id })} className="shrink-0" aria-label={`Open ${e.title}`}>
          <Thumb path={e.photos[0]} className="size-20 rounded-xl sm:size-24" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <button onClick={() => setParams({ entry: e.id })} className="min-w-0 text-left">
            <h3 className="truncate font-medium hover:underline">{e.title}</h3>
            <p className="text-xs text-muted-foreground">{shortDate(e.entry_date)}</p>
          </button>
          <FavouriteButton on={e.favourite} onToggle={() => update.mutate({ id: e.id, patch: { favourite: !e.favourite } })} label={e.title} />
        </div>
        {e.body && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.body}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {tripName(e.trip_id) && (
            <Badge tone="atlas">
              <Plane /> {tripName(e.trip_id)}
            </Badge>
          )}
          {placeName(e.place_id) && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {placeName(e.place_id)}
            </span>
          )}
          {e.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
          <DemoBadge show={e.is_demo} />
        </div>
      </div>
    </article>
  )

  return (
    <div>
      <PageHeader
        eyebrow="Atlas"
        title="Journal"
        description="Your travel memories, with photos, places and the trips they belong to."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!list.length}>
                  <Download /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={exportMd}>Markdown (.md)</DropdownMenuItem>
                <DropdownMenuItem onSelect={exportJson}>JSON (.json)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="accent" size="sm" onClick={() => setParams({ new: '1' })}>
              <Plus /> New entry
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-48">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search memories" className="pl-9" aria-label="Search journal" />
        </div>
        <Select value={trip} onChange={(e) => setTrip(e.target.value)} aria-label="Filter by trip" className="w-44">
          <option value="">All trips</option>
          {(trips.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </Select>
        <Select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by tag" className="w-36">
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </Select>
        <Button variant={favOnly ? 'secondary' : 'outline'} size="sm" aria-pressed={favOnly} onClick={() => setFavOnly(!favOnly)}>
          Favourites
        </Button>
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: 'timeline', label: 'Timeline', icon: ListTree },
            { value: 'gallery', label: 'Gallery', icon: Images },
            { value: 'trips', label: 'By trip', icon: GalleryHorizontalEnd },
          ]}
        />
      </div>

      {entries.isLoading ? (
        <ListSkeleton rows={4} />
      ) : entries.error ? (
        <ErrorState error={entries.error} onRetry={() => entries.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState icon={BookOpen} title="Your journal is empty" description="Write about a day out, a trip or a favourite place. Add photos to build a gallery over time." action={<Button variant="accent" onClick={() => setParams({ new: '1' })}><Plus /> Write the first entry</Button>} />
      ) : list.length === 0 ? (
        <EmptyState icon={Search} title="No entries match" description="Try clearing a filter." />
      ) : view === 'timeline' ? (
        <div className="grid gap-6">
          {byMonth.map(([month, es]) => (
            <section key={month}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{month}</h2>
              <div className="relative grid gap-3 border-l border-border pl-4">{es.map(card)}</div>
            </section>
          ))}
        </div>
      ) : view === 'gallery' ? (
        photos.length === 0 ? (
          <EmptyState icon={Images} title="No photos yet" description="Photos you add to journal entries appear here." />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {photos.map(({ path, entry }) => (
              <button key={path} onClick={() => setParams({ entry: entry.id })} className="group relative overflow-hidden rounded-xl">
                <Thumb path={path} alt={entry.title} className="aspect-square w-full transition-transform group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 px-2 pt-6 pb-1.5 text-left text-xs text-white">{entry.title}</span>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="grid gap-6">
          {[...(trips.data ?? []).map((t) => ({ id: t.id, title: t.title })), { id: '', title: 'Not part of a trip' }].map((t) => {
            const es = list.filter((e) => (e.trip_id ?? '') === t.id)
            if (!es.length) return null
            return (
              <Card key={t.id || 'none'} className="p-4">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Plane className="size-4 text-atlas" /> {t.title}
                  <span className="text-xs font-normal text-muted-foreground">
                    {es.length} entr{es.length === 1 ? 'y' : 'ies'}
                  </span>
                </h2>
                <div className="grid gap-3">{es.map(card)}</div>
              </Card>
            )
          })}
        </div>
      )}
      <EntryDialog entry={openEntry} open={Boolean(openEntry) || creating} onOpenChange={(o) => !o && close()} />
    </div>
  )
}
