import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { eachDayOfInterval } from 'date-fns'
import { ArrowDown, ArrowLeft, ArrowUp, CalendarDays, GripVertical, ListChecks, MapPin, Pencil, Plane, Plus, Rocket, Route, Settings2, Trash, Wallet } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useCrumbTitle, useUI } from '@/app/ui-context'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Checkbox, Field, Input, MoneyInput, Select, Textarea } from '@/components/ui/inputs'
import { Badge, Card, CardHeader, DemoBadge, EmptyState, ErrorState, ListSkeleton, PageHeader, Progress, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc'
import { FavouriteButton } from '@/features/shared/bits'
import { SaveState, useAutosave } from '@/features/spark/meta'
import { useLogActivity, useProfile, useRow, useRows, useTable } from '@/lib/data'
import { currencySymbol, dateRange, dayLabel, daysUntil, isoDate, money, todayISO, toDate } from '@/lib/format'
import { STOP_KINDS, type AtlasStop, type AtlasTrip } from '@/lib/types'
import { cn, positionBetween } from '@/lib/utils'
import { CATEGORY_META, STOP_META } from './meta'
import { OrbitMap } from './OrbitMap'

function tripPhase(t: AtlasTrip): 'upcoming' | 'current' | 'past' | 'unscheduled' {
  const today = todayISO()
  if (!t.start_date && !t.end_date) return 'unscheduled'
  if ((t.end_date ?? t.start_date)! < today) return 'past'
  if ((t.start_date ?? today) <= today) return 'current'
  return 'upcoming'
}

export function TripsPage() {
  const trips = useRows('atlas_trips', { order: [{ column: 'start_date', ascending: true }] })
  const checklist = useRows('atlas_checklist')
  const stops = useRows('atlas_stops')
  const { update } = useTable('atlas_trips')
  const { open } = useUI()
  const all = trips.data ?? []
  const groups: { id: ReturnType<typeof tripPhase>; label: string }[] = [
    { id: 'current', label: 'Happening now' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'unscheduled', label: 'No dates yet' },
    { id: 'past', label: 'Past trips' },
  ]
  return (
    <div>
      <PageHeader
        eyebrow="Atlas"
        title="Trips"
        description="Plan each day, keep a checklist and collect the places you want to see."
        actions={
          <Button variant="accent" size="sm" onClick={() => open('new-trip')}>
            <Plus /> Plan a trip
          </Button>
        }
      />
      {trips.isLoading ? (
        <ListSkeleton rows={3} />
      ) : trips.error ? (
        <ErrorState error={trips.error} onRetry={() => trips.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState icon={Plane} title="No trips yet" description="Plan your first trip with dates, a budget and a day-by-day itinerary." action={<Button variant="accent" onClick={() => open('new-trip')}><Plus /> Plan a trip</Button>} />
      ) : (
        <div className="grid gap-6">
          {groups.map((g) => {
            const list = all.filter((t) => tripPhase(t) === g.id)
            if (g.id === 'past') list.reverse()
            if (!list.length) return null
            return (
              <section key={g.id}>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{g.label}</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((t) => {
                    const items = (checklist.data ?? []).filter((c) => c.trip_id === t.id)
                    const done = items.filter((c) => c.done).length
                    const nStops = (stops.data ?? []).filter((s) => s.trip_id === t.id).length
                    const d = daysUntil(t.start_date)
                    return (
                      <div key={t.id} className="relative">
                      <div className="absolute top-3 right-3 z-10">
                        <FavouriteButton on={t.favourite} onToggle={() => update.mutate({ id: t.id, patch: { favourite: !t.favourite } })} label={t.title} />
                      </div>
                      <Link to={`/atlas/trips/${t.id}`} className="group block h-full rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-input">
                        <div className="min-w-0 pr-8">
                          <h3 className="flex items-center gap-2 truncate font-medium group-hover:underline">
                            {t.title} <DemoBadge show={t.is_demo} />
                          </h3>
                          <p className="truncate text-sm text-muted-foreground">{t.destination || 'Destination not set'}</p>
                        </div>
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="size-3.5" /> {dateRange(t.start_date, t.end_date)}
                          {g.id === 'upcoming' && d !== null && <Badge tone="atlas" className="ml-auto">in {d} day{d === 1 ? '' : 's'}</Badge>}
                          {g.id === 'current' && <Badge tone="success" className="ml-auto">Now</Badge>}
                        </p>
                        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{nStops} stop{nStops === 1 ? '' : 's'}</span>
                          {t.budget !== null && <span>Budget {money(t.budget, t.currency)}</span>}
                          {items.length > 0 && (
                            <span className="ml-auto flex min-w-24 items-center gap-1.5">
                              <Progress value={(done / items.length) * 100} />
                              <span className="tabular">
                                {done}/{items.length}
                              </span>
                            </span>
                          )}
                        </div>
                      </Link>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function TripPage() {
  const { id } = useParams()
  const trip = useRow('atlas_trips', id)
  if (trip.isLoading) return <ListSkeleton rows={5} />
  if (trip.error) return <ErrorState error={trip.error} onRetry={() => trip.refetch()} />
  if (!trip.data)
    return (
      <div className="py-16 text-center">
        <p className="font-medium">This trip no longer exists.</p>
        <Button asChild variant="outline" className="mt-3">
          <Link to="/atlas/trips">All trips</Link>
        </Button>
      </div>
    )
  return <TripWorkspace key={trip.data.id} trip={trip.data} />
}

function TripWorkspace({ trip }: { trip: AtlasTrip }) {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'itinerary'
  const { update, remove } = useTable('atlas_trips')
  const stops = useRows('atlas_stops', { eq: { trip_id: trip.id }, order: [{ column: 'position', ascending: true }] })
  const checklist = useRows('atlas_checklist', { eq: { trip_id: trip.id }, order: [{ column: 'position', ascending: true }] })
  const log = useLogActivity()
  const navigate = useNavigate()
  const [confirm, setConfirm] = React.useState(false)
  useCrumbTitle(trip.title)
  const d = daysUntil(trip.start_date)
  const items = checklist.data ?? []
  const phase = tripPhase(trip)

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Button variant="ghost" size="icon-sm" asChild className="mt-0.5">
            <Link to="/atlas/trips" aria-label="All trips">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
              <span className="truncate">{trip.title}</span> <DemoBadge show={trip.is_demo} />
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {trip.destination && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" /> {trip.destination}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" /> {dateRange(trip.start_date, trip.end_date)}
              </span>
              {phase === 'upcoming' && d !== null && <Badge tone="atlas">in {d} day{d === 1 ? '' : 's'}</Badge>}
              {phase === 'current' && <Badge tone="success">Happening now</Badge>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <ListChecks className="size-4" /> {items.filter((i) => i.done).length}/{items.length} ready
            </span>
          )}
          <FavouriteButton on={trip.favourite} onToggle={() => update.mutate({ id: trip.id, patch: { favourite: !trip.favourite } })} label={trip.title} />
          <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="Delete trip" onClick={() => setConfirm(true)}>
            <Trash />
          </Button>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'itinerary' ? {} : { tab: v }, { replace: true })}>
        <TabsList className="mb-5">
          <TabsTrigger value="itinerary">
            <Route /> Itinerary
          </TabsTrigger>
          <TabsTrigger value="places">
            <MapPin /> Places & map
          </TabsTrigger>
          <TabsTrigger value="checklist">
            <ListChecks /> Checklist
          </TabsTrigger>
          <TabsTrigger value="details">
            <Settings2 /> Details & budget
          </TabsTrigger>
        </TabsList>
        <TabsContent value="itinerary">
          <Itinerary trip={trip} stops={stops.data ?? []} loading={stops.isLoading} />
        </TabsContent>
        <TabsContent value="places">
          <TripPlaces trip={trip} stops={stops.data ?? []} />
        </TabsContent>
        <TabsContent value="checklist">
          <Checklist trip={trip} />
        </TabsContent>
        <TabsContent value="details">
          <Details trip={trip} />
        </TabsContent>
      </Tabs>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${trip.title}?`}
        description="Its itinerary and checklist are deleted. Saved places and journal entries are kept."
        onConfirm={async () => {
          await remove.mutateAsync(trip.id)
          log({ module: 'atlas', action: 'deleted', entity_type: 'trip', title: trip.title })
          toast.success('Trip deleted')
          navigate('/atlas/trips')
        }}
      />
    </div>
  )
}

// ─── Itinerary ──────────────────────────────────────────────────────────────
function tripDays(trip: AtlasTrip): string[] {
  const s = toDate(trip.start_date)
  const e = toDate(trip.end_date) ?? s
  if (!s || !e || e < s) return []
  const days = eachDayOfInterval({ start: s, end: e })
  return days.slice(0, 60).map(isoDate)
}

function StopRow({ stop, index, count, onEdit, onMove }: { stop: AtlasStop; index: number; count: number; onEdit: () => void; onMove: (dir: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id })
  const places = useRows('atlas_places')
  const place = places.data?.find((p) => p.id === stop.place_id)
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn('flex min-w-0 items-center gap-2 rounded-xl border border-border bg-surface p-2', isDragging && 'z-10 opacity-60 shadow-card')}>
      <button className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-surface-2 active:cursor-grabbing" aria-label={`Reorder ${stop.title}`} {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <span className="w-11 shrink-0 text-xs font-medium text-muted-foreground tabular">{stop.time ?? '—'}</span>
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium">{stop.title}</span>
        <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          {STOP_META[stop.kind].label}
          {place && (
            <>
              · <MapPin className="size-3" style={{ color: CATEGORY_META[place.category].color }} /> {place.name}
            </>
          )}
          {stop.notes && ` · ${stop.notes}`}
        </span>
      </button>
      <div className="flex shrink-0">
        <Button variant="ghost" size="icon-sm" className="size-7" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move ${stop.title} earlier`}>
          <ArrowUp className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" className="size-7" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move ${stop.title} later`}>
          <ArrowDown className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" className="size-7" onClick={onEdit} aria-label={`Edit ${stop.title}`}>
          <Pencil className="size-3.5" />
        </Button>
      </div>
    </li>
  )
}

function StopDialog({ trip, stop, day, open, onOpenChange }: { trip: AtlasTrip; stop: AtlasStop | null; day: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { create, update, remove } = useTable('atlas_stops')
  const places = useRows('atlas_places')
  const tripPlaces = useRows('atlas_trip_places', { eq: { trip_id: trip.id } })
  const log = useLogActivity()
  const days = tripDays(trip)
  const [f, setF] = React.useState({ title: '', time: '', kind: 'activity' as AtlasStop['kind'], place_id: '', notes: '', day: '' })
  React.useEffect(() => {
    if (open) setF(stop ? { title: stop.title, time: stop.time ?? '', kind: stop.kind, place_id: stop.place_id ?? '', notes: stop.notes, day: stop.day ?? '' } : { title: '', time: '', kind: 'activity', place_id: '', notes: '', day: day ?? '' })
  }, [open, stop, day])
  const linked = new Set((tripPlaces.data ?? []).map((l) => l.place_id))
  const sortedPlaces = [...(places.data ?? [])].sort((a, b) => Number(linked.has(b.id)) - Number(linked.has(a.id)) || a.name.localeCompare(b.name))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.title.trim()) return
    const patch = { title: f.title.trim(), time: f.time || null, kind: f.kind, place_id: f.place_id || null, notes: f.notes, day: f.day || null }
    if (stop) await update.mutateAsync({ id: stop.id, patch })
    else {
      const s = await create.mutateAsync({ ...patch, trip_id: trip.id, position: Date.now() })
      log({ module: 'atlas', action: 'added to itinerary', entity_type: 'stop', entity_id: s.id, title: `${s.title} · ${trip.title}`, link: `/atlas/trips/${trip.id}` })
    }
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={stop ? 'Edit stop' : 'Add a stop'} className="module-atlas">
        <form onSubmit={submit} className="grid gap-4">
          <Field label="What" htmlFor="st-title">
            <Input id="st-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus required maxLength={300} placeholder="e.g. Lunch at the market" />
          </Field>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Day" htmlFor="st-day" className="col-span-2 sm:col-span-1">
              <Select id="st-day" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })}>
                <option value="">Unscheduled</option>
                {days.map((d, i) => (
                  <option key={d} value={d}>
                    Day {i + 1} · {dayLabel(d)}
                  </option>
                ))}
                {f.day && !days.includes(f.day) && <option value={f.day}>{dayLabel(f.day)} (outside trip dates)</option>}
              </Select>
            </Field>
            <Field label="Time" htmlFor="st-time">
              <Input id="st-time" type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
            </Field>
            <Field label="Type" htmlFor="st-kind">
              <Select id="st-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as AtlasStop['kind'] })}>
                {STOP_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {STOP_META[k].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Place" htmlFor="st-place" hint="Pick from your saved places to show it on the map.">
            <Select id="st-place" value={f.place_id} onChange={(e) => setF({ ...f, place_id: e.target.value })}>
              <option value="">No place</option>
              {sortedPlaces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.city ? ` (${p.city})` : ''}
                  {linked.has(p.id) ? ' — on this trip' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" htmlFor="st-notes">
            <Textarea id="st-notes" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </Field>
          <DialogFooter className={stop ? 'justify-between' : undefined}>
            {stop && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={async () => {
                  await remove.mutateAsync(stop.id)
                  onOpenChange(false)
                }}
              >
                <Trash /> Remove
              </Button>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="accent" disabled={!f.title.trim()}>
                {stop ? 'Save' : 'Add stop'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DayList({ label, sub, stops, onAdd, onEdit }: { label: string; sub?: string; stops: AtlasStop[]; onAdd: () => void; onEdit: (s: AtlasStop) => void }) {
  const { update } = useTable('atlas_stops')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const place = (id: string, toIndex: number) => {
    const rest = sorted.filter((s) => s.id !== id)
    const pos = positionBetween(rest[toIndex - 1]?.position, rest[toIndex]?.position)
    update.mutate({ id, patch: { position: pos } })
  }
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    const to = sorted.findIndex((s) => s.id === e.over!.id)
    place(String(e.active.id), to)
  }
  return (
    <Card className="p-3 sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{label}</h3>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={onAdd}>
          <Plus /> Add stop
        </Button>
      </div>
      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">Nothing planned yet.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sorted.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ol className="grid grid-cols-1 gap-1.5">
              {sorted.map((s, i) => (
                <StopRow key={s.id} stop={s} index={i} count={sorted.length} onEdit={() => onEdit(s)} onMove={(dir) => place(s.id, dir === -1 ? i - 1 : i + 1)} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </Card>
  )
}

function Itinerary({ trip, stops, loading }: { trip: AtlasTrip; stops: AtlasStop[]; loading: boolean }) {
  const [dialog, setDialog] = React.useState<{ open: boolean; stop: AtlasStop | null; day: string | null }>({ open: false, stop: null, day: null })
  const days = tripDays(trip)
  if (loading) return <ListSkeleton rows={3} />
  const other = stops.filter((s) => !s.day || !days.includes(s.day))
  return (
    <div className="grid gap-3">
      {days.length === 0 && (
        <p className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
          Add start and end dates on the Details tab to plan day by day. Until then, stops are kept in one list.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {days.map((d, i) => (
          <DayList
            key={d}
            label={`Day ${i + 1}`}
            sub={dayLabel(d)}
            stops={stops.filter((s) => s.day === d)}
            onAdd={() => setDialog({ open: true, stop: null, day: d })}
            onEdit={(s) => setDialog({ open: true, stop: s, day: s.day })}
          />
        ))}
      </div>
      {(other.length > 0 || days.length === 0) && (
        <DayList label={days.length ? 'Unscheduled' : 'Itinerary'} sub={days.length ? 'Stops without a day, or outside the trip dates' : undefined} stops={other} onAdd={() => setDialog({ open: true, stop: null, day: null })} onEdit={(s) => setDialog({ open: true, stop: s, day: s.day })} />
      )}
      <StopDialog trip={trip} stop={dialog.stop} day={dialog.day} open={dialog.open} onOpenChange={(o) => setDialog({ ...dialog, open: o })} />
    </div>
  )
}

// ─── Places & map ───────────────────────────────────────────────────────────
function TripPlaces({ trip, stops }: { trip: AtlasTrip; stops: AtlasStop[] }) {
  const links = useRows('atlas_trip_places', { eq: { trip_id: trip.id } })
  const places = useRows('atlas_places')
  const { create, remove } = useTable('atlas_trip_places')
  const [adding, setAdding] = React.useState('')
  const linkedIds = new Set((links.data ?? []).map((l) => l.place_id))
  const stopPlaceIds = new Set(stops.map((s) => s.place_id).filter(Boolean) as string[])
  const shown = (places.data ?? []).filter((p) => linkedIds.has(p.id) || stopPlaceIds.has(p.id))
  const pins = shown.filter((p) => p.lat !== null && p.lng !== null).map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, label: p.name, color: CATEGORY_META[p.category].color, style: p.status === 'visited' ? ('filled' as const) : ('ring' as const) }))
  const available = (places.data ?? []).filter((p) => !linkedIds.has(p.id))
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <Card className="p-4">
        <form
          className="mb-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!adding) return
            await create.mutateAsync({ trip_id: trip.id, place_id: adding })
            setAdding('')
          }}
        >
          <Select aria-label="Add a saved place" value={adding} onChange={(e) => setAdding(e.target.value)} className="min-w-0 flex-1">
            <option value="">Add a saved place…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.city ? ` (${p.city})` : ''}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="accent" disabled={!adding}>
            Add
          </Button>
        </form>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No places yet. Save places in{' '}
            <Link className="text-accent-text underline" to="/atlas">
              Places
            </Link>{' '}
            and add them here.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5">
            {shown.map((p) => {
              const link = (links.data ?? []).find((l) => l.place_id === p.id)
              return (
                <li key={p.id} className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_META[p.category].color }} />
                  <Link to={`/atlas?place=${p.id}`} className="min-w-0 flex-1 truncate text-sm">
                    {p.name}
                  </Link>
                  {stopPlaceIds.has(p.id) && <Badge tone="spark">In itinerary</Badge>}
                  {link && (
                    <Button variant="ghost" size="icon-sm" className="size-7" onClick={() => remove.mutate(link.id)} aria-label={`Remove ${p.name} from this trip`}>
                      <Trash className="size-3.5" />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <Card className="h-80 overflow-hidden lg:h-[480px]">
        {pins.length ? <OrbitMap pins={pins} className="size-full" /> : <div className="grid size-full place-items-center p-6 text-center text-sm text-muted-foreground">Places with a location appear on this map.</div>}
      </Card>
    </div>
  )
}

// ─── Checklist ──────────────────────────────────────────────────────────────
const CHECKLIST_TEMPLATE = ['Passport or ID', 'Tickets and bookings', 'Travel insurance', 'Phone charger', 'Plug adapter', 'Medication', 'Toiletries', 'Cards and some cash', 'Download offline maps']

function Checklist({ trip }: { trip: AtlasTrip }) {
  const items = useRows('atlas_checklist', { eq: { trip_id: trip.id }, order: [{ column: 'position', ascending: true }] })
  const { create, createMany, update, remove } = useTable('atlas_checklist')
  const [label, setLabel] = React.useState('')
  const list = items.data ?? []
  const done = list.filter((i) => i.done).length
  const last = list[list.length - 1]?.position ?? 0
  const missing = CHECKLIST_TEMPLATE.filter((t) => !list.some((i) => i.label.toLowerCase() === t.toLowerCase()))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const beyond = list[j + dir]
    update.mutate({ id: list[i].id, patch: { position: positionBetween(dir === -1 ? beyond?.position : list[j].position, dir === -1 ? list[j].position : beyond?.position) } })
  }
  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <Progress value={list.length ? (done / list.length) * 100 : 0} />
          <span className="shrink-0 text-sm tabular">
            {done}/{list.length}
          </span>
        </div>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!label.trim()) return
            await create.mutateAsync({ trip_id: trip.id, label: label.trim(), position: last + 1000 })
            setLabel('')
          }}
        >
          <Input aria-label="New checklist item" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add something to pack or do" maxLength={300} />
          <Button type="submit" variant="accent" disabled={!label.trim()}>
            <Plus /> Add
          </Button>
        </form>
        {missing.length > 0 && (
          <Button
            variant="link"
            size="sm"
            className="mt-2"
            onClick={() => createMany.mutate(missing.map((l, i) => ({ trip_id: trip.id, label: l, position: last + (i + 1) * 1000 })))}
          >
            Add {missing.length} common travel items
          </Button>
        )}
      </Card>
      {list.length > 0 && (
        <ul className="grid grid-cols-1 gap-1.5">
          {list.map((it, i) => (
            <li key={it.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2">
              <Checkbox id={`cl-${it.id}`} checked={it.done} onCheckedChange={(v) => update.mutate({ id: it.id, patch: { done: v === true } })} />
              <label htmlFor={`cl-${it.id}`} className={cn('min-w-0 flex-1 text-sm', it.done && 'text-muted-foreground line-through')}>
                {it.label}
              </label>
              <DemoBadge show={it.is_demo} />
              <Button variant="ghost" size="icon-sm" className="size-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${it.label} up`}>
                <ArrowUp className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon-sm" className="size-7" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${it.label} down`}>
                <ArrowDown className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon-sm" className="size-7" onClick={() => remove.mutate(it.id)} aria-label={`Remove ${it.label}`}>
                <Trash className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Details ────────────────────────────────────────────────────────────────
function Details({ trip }: { trip: AtlasTrip }) {
  const { update } = useTable('atlas_trips')
  const projects = useRows('spark_projects', { eq: { linked_trip_id: trip.id } })
  const { data: profile } = useProfile()
  const { open } = useUI()
  const [d, setD] = React.useState({
    title: trip.title, destination: trip.destination, start_date: trip.start_date, end_date: trip.end_date, description: trip.description,
    budget: trip.budget, currency: trip.currency || profile?.currency || 'GBP', accommodation_notes: trip.accommodation_notes, transport_notes: trip.transport_notes,
  })
  const invalid = Boolean(d.start_date && d.end_date && d.end_date < d.start_date)
  const state = useAutosave(d, async (v) => {
    if (invalid || !v.title.trim()) return
    await update.mutateAsync({ id: trip.id, patch: { ...v, title: v.title.trim() } })
  })
  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD((x) => ({ ...x, [k]: v }))
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="grid gap-4 p-4">
        <div className="flex justify-end">
          <SaveState state={state} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Trip name" htmlFor="tr-title">
            <Input id="tr-title" value={d.title} onChange={(e) => set('title', e.target.value)} maxLength={200} />
          </Field>
          <Field label="Destination" htmlFor="tr-dest">
            <Input id="tr-dest" value={d.destination} onChange={(e) => set('destination', e.target.value)} />
          </Field>
          <Field label="Start date" htmlFor="tr-start">
            <Input id="tr-start" type="date" value={d.start_date ?? ''} onChange={(e) => set('start_date', e.target.value || null)} />
          </Field>
          <Field label="End date" htmlFor="tr-end" error={invalid ? 'The end date is before the start date. Not saved.' : undefined}>
            <Input id="tr-end" type="date" value={d.end_date ?? ''} min={d.start_date ?? undefined} onChange={(e) => set('end_date', e.target.value || null)} aria-invalid={invalid} />
          </Field>
        </div>
        <Field label="Description" htmlFor="tr-desc">
          <Textarea id="tr-desc" rows={3} value={d.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Accommodation" htmlFor="tr-acc">
          <Textarea id="tr-acc" rows={3} value={d.accommodation_notes} onChange={(e) => set('accommodation_notes', e.target.value)} placeholder="Where you’re staying, check-in times, booking references" />
        </Field>
        <Field label="Getting there and around" htmlFor="tr-transport">
          <Textarea id="tr-transport" rows={3} value={d.transport_notes} onChange={(e) => set('transport_notes', e.target.value)} placeholder="Flights, trains, transfers, passes" />
        </Field>
      </Card>
      <div className="grid content-start gap-4">
        <Card className="grid gap-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Wallet className="size-4 text-atlas-text" /> Budget
          </h2>
          <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
            <Field label="Amount" htmlFor="tr-budget">
              <MoneyInput id="tr-budget" symbol={currencySymbol(d.currency)} value={d.budget} onChange={(v) => set('budget', v)} />
            </Field>
            <Field label="Currency" htmlFor="tr-cur">
              <Select id="tr-cur" value={d.currency} onChange={(e) => set('currency', e.target.value)}>
                {['GBP', 'EUR', 'USD', 'JPY', 'AUD', 'CAD', 'CHF', 'ISK'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
          {d.budget !== null && d.start_date && d.end_date && !invalid && (
            <p className="text-xs text-muted-foreground">
              About {money(d.budget / Math.max(1, tripDays({ ...trip, ...d }).length), d.currency)} per day over {tripDays({ ...trip, ...d }).length} days.
            </p>
          )}
        </Card>
        <Card className="module-spark">
          <CardHeader title="Linked Spark projects" icon={Rocket} />
          <ul className="grid grid-cols-1 gap-1 px-2 pb-2">
            {(projects.data ?? []).map((p) => (
              <li key={p.id}>
                <Link to={`/spark/projects/${p.id}`} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                  {p.name}
                </Link>
              </li>
            ))}
            {(projects.data ?? []).length === 0 && <li className="px-2 text-sm text-muted-foreground">No linked projects.</li>}
          </ul>
          <div className="px-4 pb-4">
            <Button variant="outline" size="sm" onClick={() => open('new-project', { tripId: trip.id, title: `${trip.title} project` })}>
              <Plus /> Start a travel project
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
