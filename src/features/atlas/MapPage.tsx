import { LocateFixed, MapPinPlus, X } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/inputs'
import { Card } from '@/components/ui/misc'
import { useLogActivity, useRows, useTable } from '@/lib/data'
import type { GeoResult } from '@/lib/geocode'
import { todayISO } from '@/lib/format'
import { PLACE_CATEGORIES, type PlaceCategory } from '@/lib/types'
import { cn } from '@/lib/utils'
import { CATEGORY_META } from './meta'
import { OrbitMap, type MapPin } from './OrbitMap'
import { PlacePanel } from './PlacePanel'
import { PlaceSearch, useSavePlace } from './Places'

type Layer = 'visited' | 'want' | 'stops'

export function MapPage() {
  const places = useRows('atlas_places')
  const trips = useRows('atlas_trips')
  const stops = useRows('atlas_stops')
  const { create } = useTable('atlas_places')
  const log = useLogActivity()
  const saver = useSavePlace()
  const [params, setParams] = useSearchParams()
  const [layers, setLayers] = React.useState<Set<Layer>>(new Set(['visited', 'want', 'stops']))
  const [categories, setCategories] = React.useState<Set<PlaceCategory>>(new Set(PLACE_CATEGORIES))
  const [results, setResults] = React.useState<GeoResult[]>([])
  const [focus, setFocus] = React.useState<{ lat: number; lng: number } | null>(null)
  const [dropMode, setDropMode] = React.useState(false)
  const [newPin, setNewPin] = React.useState<{ lat: number; lng: number } | null>(null)
  const [pinName, setPinName] = React.useState('')
  const [pinCategory, setPinCategory] = React.useState<PlaceCategory>('other')
  const [picked, setPicked] = React.useState<GeoResult | null>(null)

  const selectedId = params.get('place')
  const selected = (places.data ?? []).find((p) => p.id === selectedId) ?? null

  React.useEffect(() => {
    if (selected?.lat != null && selected.lng != null) setFocus({ lat: selected.lat, lng: selected.lng })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const today = todayISO()
  const upcomingTripIds = new Set((trips.data ?? []).filter((t) => (t.end_date ?? t.start_date ?? '0000') >= today).map((t) => t.id))
  const placeById = new Map((places.data ?? []).map((p) => [p.id, p]))

  const pins: MapPin[] = [
    ...(places.data ?? [])
      .filter((p) => p.lat !== null && p.lng !== null && layers.has(p.status) && categories.has(p.category))
      .map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, label: p.name, color: CATEGORY_META[p.category].color, style: p.status === 'visited' ? ('filled' as const) : ('ring' as const) })),
    ...(layers.has('stops')
      ? (stops.data ?? [])
          .filter((s) => upcomingTripIds.has(s.trip_id) && s.place_id && placeById.get(s.place_id)?.lat != null)
          .sort((a, b) => (a.day ?? '').localeCompare(b.day ?? '') || a.position - b.position)
          .map((s, i) => {
            const p = placeById.get(s.place_id!)!
            return { id: `stop:${s.id}`, lat: p.lat! + 0.0004, lng: p.lng! + 0.0004, label: `${s.title} (${trips.data?.find((t) => t.id === s.trip_id)?.title ?? 'trip'})`, color: 'var(--spark-fill)', style: 'stop' as const, number: i + 1 }
          })
      : []),
    ...results.filter((r) => !saver.existing(r)).map((r) => ({ id: `search:${r.ref}`, lat: r.lat, lng: r.lng, label: `${r.name} (search result)`, color: '#fff', style: 'search' as const })),
  ]

  const onSelect = (id: string) => {
    if (id.startsWith('search:')) {
      const r = results.find((x) => `search:${x.ref}` === id)
      if (r) setPicked(r)
    } else if (id.startsWith('stop:')) {
      const s = stops.data?.find((x) => `stop:${x.id}` === id)
      if (s?.place_id) setParams({ place: s.place_id })
    } else setParams({ place: id })
  }

  const toggle = <T,>(set: Set<T>, v: T) => {
    const n = new Set(set)
    if (n.has(v)) n.delete(v)
    else n.add(v)
    return n
  }

  const locate = () => {
    if (!('geolocation' in navigator)) {
      toast.error('Your browser doesn’t support location.')
      return
    }
    // One-off position request, only when asked. Orbit never tracks location continuously.
    navigator.geolocation.getCurrentPosition(
      (pos) => setFocus({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.error('Location wasn’t shared. You can still search or browse the map.'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    )
  }

  return (
    <div className="-mx-[max(16px,env(safe-area-inset-left))] -mt-5 grid h-[calc(100dvh-3.5rem)] grid-rows-[auto_minmax(0,1fr)] sm:-mt-7 lg:-mx-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-1">
      <aside className="max-h-[45dvh] overflow-y-auto border-b border-border bg-surface p-4 scrollbar-thin lg:max-h-none lg:border-r lg:border-b-0">
        <h1 className="text-lg font-semibold">Map</h1>
        <p className="mb-3 text-xs text-muted-foreground">Your saved places, plus stops from upcoming trips.</p>
        <PlaceSearch
          compact
          onResults={(r) => {
            setResults(r)
            if (r[0]) setFocus({ lat: r[0].lat, lng: r[0].lng })
          }}
          onPick={(r) => setFocus({ lat: r.lat, lng: r.lng })}
        />
        <div className="mt-4 grid gap-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Show</p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['visited', 'Visited', 'filled'],
                  ['want', 'Want to visit', 'ring'],
                  ['stops', 'Trip stops', 'stop'],
                ] as const
              ).map(([id, label, style]) => (
                <button
                  key={id}
                  aria-pressed={layers.has(id)}
                  onClick={() => setLayers(toggle(layers, id))}
                  className={cn('inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs', layers.has(id) ? 'bg-surface-2 text-foreground' : 'text-muted-foreground opacity-60')}
                >
                  <span className={cn('size-2.5', style === 'stop' ? 'rounded-sm bg-spark' : style === 'ring' ? 'rounded-full border-2 border-atlas' : 'rounded-full bg-atlas')} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Categories</p>
            <div className="flex flex-wrap gap-1.5">
              {PLACE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  aria-pressed={categories.has(c)}
                  onClick={() => setCategories(toggle(categories, c))}
                  className={cn('inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs', categories.has(c) ? 'bg-surface-2 text-foreground' : 'text-muted-foreground opacity-60')}
                >
                  <span className="size-2.5 rounded-full" style={{ background: CATEGORY_META[c].color }} />
                  {CATEGORY_META[c].label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={dropMode ? 'accent' : 'outline'} size="sm" onClick={() => setDropMode(!dropMode)} aria-pressed={dropMode}>
              {dropMode ? <X /> : <MapPinPlus />} {dropMode ? 'Cancel pin' : 'Drop a custom pin'}
            </Button>
            <Button variant="outline" size="sm" onClick={locate}>
              <LocateFixed /> Find me
            </Button>
          </div>
          {dropMode && <p className="text-xs text-accent-text">Click anywhere on the map to place a pin.</p>}
          <p className="text-[11px] text-muted-foreground">“Find me” asks for your location once and only when you tap it.</p>
        </div>
      </aside>
      <div className="relative min-h-0">
        <OrbitMap
          pins={pins}
          selectedId={selectedId}
          onSelect={onSelect}
          focus={focus}
          crosshair={dropMode}
          onMapClick={(lat, lng) => {
            if (!dropMode) return
            setNewPin({ lat, lng })
            setPinName('')
            setDropMode(false)
          }}
          className="size-full"
        />
        {picked && (
          <Card className="absolute right-3 bottom-[max(12px,env(safe-area-inset-bottom))] left-3 z-[500] p-3 sm:left-auto sm:w-80">
            <p className="text-sm font-medium">{picked.name}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{picked.address}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="accent" onClick={async () => { await saver.save(picked, 'want'); setPicked(null) }}>
                Want to visit
              </Button>
              <Button size="sm" variant="outline" onClick={async () => { await saver.save(picked, 'visited'); setPicked(null) }}>
                Visited
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => setPicked(null)} aria-label="Close">
                <X />
              </Button>
            </div>
          </Card>
        )}
      </div>
      <PlacePanel place={selected} onClose={() => setParams({})} />
      <Dialog open={Boolean(newPin)} onOpenChange={(o) => !o && setNewPin(null)}>
        <DialogContent title="Add a custom pin" size="sm" className="module-atlas" description={newPin ? `${newPin.lat.toFixed(5)}, ${newPin.lng.toFixed(5)}` : undefined}>
          <form
            className="grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!newPin || !pinName.trim()) return
              const p = await create.mutateAsync({ name: pinName.trim(), lat: newPin.lat, lng: newPin.lng, category: pinCategory, status: 'want', source: 'custom' })
              log({ module: 'atlas', action: 'pinned', entity_type: 'place', entity_id: p.id, title: p.name, link: `/atlas/map?place=${p.id}` })
              setNewPin(null)
              setParams({ place: p.id })
            }}
          >
            <Field label="Name" htmlFor="pin-name">
              <Input id="pin-name" value={pinName} onChange={(e) => setPinName(e.target.value)} autoFocus required maxLength={300} placeholder="e.g. Secret beach" />
            </Field>
            <Field label="Category" htmlFor="pin-cat">
              <Select id="pin-cat" value={pinCategory} onChange={(e) => setPinCategory(e.target.value as PlaceCategory)}>
                {PLACE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_META[c].label}
                  </option>
                ))}
              </Select>
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewPin(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={!pinName.trim()}>
                Save pin
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
