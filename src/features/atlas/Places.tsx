import { Check, FolderPlus, MapPin, Pencil, Plus, Search, Trash } from 'lucide-react'
import * as React from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/inputs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/menu'
import { Badge, Card, DemoBadge, EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui/misc'
import { FavouriteButton } from '@/features/shared/bits'
import { Thumb } from '@/features/shared/PhotoUploader'
import { useLogActivity, useRows, useTable } from '@/lib/data'
import { searchPlaces, type GeoResult } from '@/lib/geocode'
import { PLACE_CATEGORIES, type AtlasCollection, type AtlasPlace, type PlaceCategory } from '@/lib/types'
import { cn, errorMessage } from '@/lib/utils'
import { CATEGORY_META, flag, STATUS_LABEL } from './meta'
import { PlacePanel } from './PlacePanel'

export function useSavePlace() {
  const { create } = useTable('atlas_places')
  const places = useRows('atlas_places')
  const log = useLogActivity()
  return {
    existing: (r: GeoResult) => (places.data ?? []).find((p) => p.osm_ref === r.ref),
    async save(r: GeoResult, status: AtlasPlace['status']) {
      const p = await create.mutateAsync({
        name: r.name, address: r.address, city: r.city, country: r.country, country_code: r.country_code, lat: r.lat, lng: r.lng,
        category: r.category, status, source: 'search', osm_ref: r.ref, visited_on: null,
      })
      log({ module: 'atlas', action: status === 'visited' ? 'marked visited' : 'saved', entity_type: 'place', entity_id: p.id, title: p.name, link: `/atlas?place=${p.id}` })
      toast.success(`${p.name} saved`)
      return p
    },
  }
}

/** Search box + results. Searches only on submit, never as you type. */
export function PlaceSearch({ onResults, onPick, compact }: { onResults?: (r: GeoResult[]) => void; onPick?: (r: GeoResult) => void; compact?: boolean }) {
  const [q, setQ] = React.useState('')
  const [results, setResults] = React.useState<GeoResult[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const saver = useSavePlace()
  const abort = React.useRef<AbortController | null>(null)

  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    abort.current?.abort()
    abort.current = new AbortController()
    setBusy(true)
    setError('')
    try {
      const r = await searchPlaces(q, abort.current.signal)
      setResults(r)
      onResults?.(r)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-3">
      <form onSubmit={run} className="flex gap-2" role="search">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a city, landmark, café…" className="pl-9" aria-label="Search for a place" />
        </div>
        <Button type="submit" variant="accent" loading={busy} disabled={!q.trim()}>
          Search
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {results && (
        <div aria-live="polite">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">No places found for “{q}”. Try a broader name or add the country.</p>
          ) : (
            <ul className={cn('grid grid-cols-1 gap-1.5', compact && 'max-h-72 overflow-y-auto scrollbar-thin')}>
              {results.map((r) => {
                const saved = saver.existing(r)
                const Icon = CATEGORY_META[r.category].icon
                return (
                  <li key={r.ref} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-surface px-2.5 py-2">
                    <button className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => onPick?.(r)}>
                      <Icon className="size-4 shrink-0" style={{ color: CATEGORY_META[r.category].color }} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{r.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{r.address}</span>
                      </span>
                    </button>
                    {saved ? (
                      <Badge tone="atlas">
                        <Check /> {STATUS_LABEL[saved.status]}
                      </Badge>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" aria-label={`Save ${r.name}`}>
                            <Plus /> Save
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => saver.save(r, 'want')}>Want to visit</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => saver.save(r, 'visited')}>Already visited</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Search by OpenStreetMap Nominatim. Data ©{' '}
            <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap contributors
            </a>
            .
          </p>
        </div>
      )}
    </div>
  )
}

function CollectionDialog({ open, onOpenChange, collection }: { open: boolean; onOpenChange: (o: boolean) => void; collection: AtlasCollection | null }) {
  const { create, update } = useTable('atlas_collections')
  const [name, setName] = React.useState('')
  React.useEffect(() => setName(collection?.name ?? ''), [collection, open])
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={collection ? 'Rename collection' : 'New collection'} size="sm" className="module-atlas">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!name.trim()) return
            if (collection) await update.mutateAsync({ id: collection.id, patch: { name: name.trim() } })
            else await create.mutateAsync({ name: name.trim() })
            onOpenChange(false)
          }}
        >
          <Field label="Name" htmlFor="col-name">
            <Input id="col-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={120} placeholder="e.g. Coffee spots, Bucket list" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PlacesPage() {
  const places = useRows('atlas_places')
  const collections = useRows('atlas_collections')
  const links = useRows('atlas_place_collections')
  const { update } = useTable('atlas_places')
  const colTable = useTable('atlas_collections')
  const [params, setParams] = useSearchParams()
  const selected = (places.data ?? []).find((p) => p.id === params.get('place')) ?? null
  const [status, setStatus] = React.useState<'' | AtlasPlace['status']>('')
  const [category, setCategory] = React.useState<'' | PlaceCategory>('')
  const [collection, setCollection] = React.useState('')
  const [favOnly, setFavOnly] = React.useState(false)
  const [filter, setFilter] = React.useState('')
  const [colDialog, setColDialog] = React.useState<{ open: boolean; c: AtlasCollection | null }>({ open: false, c: null })
  const [deleteCol, setDeleteCol] = React.useState<AtlasCollection | null>(null)

  const list = (places.data ?? []).filter((p) => {
    if (status && p.status !== status) return false
    if (category && p.category !== category) return false
    if (favOnly && !p.favourite) return false
    if (collection && !(links.data ?? []).some((l) => l.place_id === p.id && l.collection_id === collection)) return false
    const q = filter.trim().toLowerCase()
    if (q && !`${p.name} ${p.city} ${p.country} ${p.notes}`.toLowerCase().includes(q)) return false
    return true
  })

  // Group: country → city → places
  const groups = React.useMemo(() => {
    const m = new Map<string, { code: string; cities: Map<string, AtlasPlace[]> }>()
    for (const p of list) {
      const country = p.country || 'Somewhere'
      const g = m.get(country) ?? { code: p.country_code, cities: new Map() }
      const city = p.city || 'Other places'
      g.cities.set(city, [...(g.cities.get(city) ?? []), p])
      m.set(country, g)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [list])

  const open = (p: AtlasPlace) => setParams({ place: p.id })

  return (
    <div>
      <PageHeader
        eyebrow="Atlas"
        title="Places"
        description="Find places, save them, and keep notes and photos for each one."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/atlas/map">
              <MapPin /> Open map
            </Link>
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="grid content-start gap-4">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Find a place</h2>
            <PlaceSearch />
          </Card>
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Collections</h2>
              <Button variant="ghost" size="sm" onClick={() => setColDialog({ open: true, c: null })}>
                <FolderPlus /> New
              </Button>
            </div>
            {(collections.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Group places into lists like “Food spots” or “Bucket list”.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-0.5">
                {(collections.data ?? []).map((c) => {
                  const n = (links.data ?? []).filter((l) => l.collection_id === c.id).length
                  return (
                    <li key={c.id} className="group flex items-center">
                      <button
                        onClick={() => setCollection(collection === c.id ? '' : c.id)}
                        aria-pressed={collection === c.id}
                        className={cn('flex min-w-0 flex-1 items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-surface-2', collection === c.id && 'bg-surface-2 font-medium')}
                      >
                        <span className="flex items-center gap-2 truncate">
                          {c.name} <DemoBadge show={c.is_demo} />
                        </span>
                        <span className="text-xs text-muted-foreground tabular">{n}</span>
                      </button>
                      <Button variant="ghost" size="icon-sm" className="size-7 opacity-60 group-hover:opacity-100" onClick={() => setColDialog({ open: true, c })} aria-label={`Rename ${c.name}`}>
                        <Pencil className="size-3" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" className="size-7 text-destructive opacity-60 group-hover:opacity-100" onClick={() => setDeleteCol(c)} aria-label={`Delete ${c.name}`}>
                        <Trash className="size-3" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter saved places" aria-label="Filter saved places" className="min-w-0 flex-1 basis-40" />
            <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter by status" className="w-36">
              <option value="">All places</option>
              <option value="want">Want to visit</option>
              <option value="visited">Visited</option>
            </Select>
            <Select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} aria-label="Filter by category" className="w-36">
              <option value="">All categories</option>
              {PLACE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].label}
                </option>
              ))}
            </Select>
            <Button variant={favOnly ? 'secondary' : 'outline'} size="sm" aria-pressed={favOnly} onClick={() => setFavOnly(!favOnly)}>
              Favourites
            </Button>
          </div>
          {places.isLoading ? (
            <ListSkeleton rows={5} />
          ) : places.error ? (
            <ErrorState error={places.error} onRetry={() => places.refetch()} />
          ) : (places.data ?? []).length === 0 ? (
            <EmptyState icon={MapPin} title="No saved places yet" description="Search for somewhere on the left and save it as a place you want to visit or have visited." />
          ) : list.length === 0 ? (
            <EmptyState icon={Search} title="No places match" description="Try clearing a filter." />
          ) : (
            <div className="grid gap-5">
              {groups.map(([country, g]) => (
                <section key={country} aria-labelledby={`c-${country}`}>
                  <h3 id={`c-${country}`} className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <span aria-hidden>{flag(g.code)}</span> {country}
                  </h3>
                  {[...g.cities.entries()].map(([city, ps]) => (
                    <div key={city} className="mb-3">
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{city}</p>
                      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {ps.map((p) => {
                          const Icon = CATEGORY_META[p.category].icon
                          return (
                            <li key={p.id} className="flex min-w-0 items-center gap-1 rounded-xl border border-border bg-surface pr-1.5 transition-colors hover:border-input">
                              <button onClick={() => open(p)} className="flex min-w-0 flex-1 items-center gap-3 p-2.5 text-left">
                                {p.photos[0] ? (
                                  <Thumb path={p.photos[0]} className="size-11 shrink-0 rounded-lg" />
                                ) : (
                                  <span className="grid size-11 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${CATEGORY_META[p.category].color} 15%, transparent)`, color: CATEGORY_META[p.category].color }}>
                                    <Icon className="size-4" />
                                  </span>
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1.5">
                                    <span className="truncate text-sm font-medium">{p.name}</span>
                                    <DemoBadge show={p.is_demo} />
                                  </span>
                                  <span className="mt-0.5 flex items-center gap-1.5">
                                    <Badge tone={p.status === 'visited' ? 'success' : 'atlas'}>{STATUS_LABEL[p.status]}</Badge>
                                    <span className="truncate text-[11px] text-muted-foreground">{CATEGORY_META[p.category].label}</span>
                                  </span>
                                </span>
                              </button>
                              <FavouriteButton on={p.favourite} onToggle={() => update.mutate({ id: p.id, patch: { favourite: !p.favourite } })} label={p.name} />
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
      <PlacePanel place={selected} onClose={() => setParams({})} />
      <CollectionDialog open={colDialog.open} collection={colDialog.c} onOpenChange={(o) => setColDialog({ ...colDialog, open: o })} />
      <ConfirmDialog
        open={Boolean(deleteCol)}
        onOpenChange={(o) => !o && setDeleteCol(null)}
        title={`Delete the “${deleteCol?.name}” collection?`}
        description="The places in it are kept."
        onConfirm={async () => {
          if (!deleteCol) return
          await colTable.remove.mutateAsync(deleteCol.id)
          if (collection === deleteCol.id) setCollection('')
        }}
      />
    </div>
  )
}
