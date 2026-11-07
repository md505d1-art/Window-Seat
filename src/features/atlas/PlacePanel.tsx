import { Dialog as DialogPrimitive } from 'radix-ui'
import { ExternalLink, Map as MapIcon, Plane, Trash, X } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, SheetContent } from '@/components/ui/dialog'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/inputs'
import { DemoBadge } from '@/components/ui/misc'
import { useBackend } from '@/features/auth/auth'
import { FavouriteButton } from '@/features/shared/bits'
import { PhotoUploader } from '@/features/shared/PhotoUploader'
import { SaveState, useAutosave } from '@/features/spark/meta'
import { useLogActivity, useRows, useTable } from '@/lib/data'
import { osmUrl } from '@/lib/geocode'
import { PLACE_CATEGORIES, type AtlasPlace } from '@/lib/types'
import { CATEGORY_META, flag, STATUS_LABEL } from './meta'

/** Side panel to view and edit one saved place. */
export function PlacePanel({ place, onClose }: { place: AtlasPlace | null; onClose: () => void }) {
  return (
    <DialogPrimitive.Root open={Boolean(place)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent title={place?.name ?? 'Place'} className="module-atlas">
        {place && <PlaceEditor key={place.id} place={place} onClose={onClose} />}
      </SheetContent>
    </DialogPrimitive.Root>
  )
}

function PlaceEditor({ place, onClose }: { place: AtlasPlace; onClose: () => void }) {
  const { update, remove } = useTable('atlas_places')
  const collections = useRows('atlas_collections')
  const links = useRows('atlas_place_collections', { eq: { place_id: place.id } })
  const trips = useRows('atlas_trips')
  const tripLinks = useRows('atlas_trip_places', { eq: { place_id: place.id } })
  const linkTable = useTable('atlas_place_collections')
  const tripTable = useTable('atlas_trip_places')
  const backend = useBackend()
  const log = useLogActivity()
  const [confirm, setConfirm] = React.useState(false)
  const [draft, setDraft] = React.useState({
    name: place.name, notes: place.notes, status: place.status, category: place.category, visited_on: place.visited_on, photos: place.photos, city: place.city, country: place.country,
  })
  const state = useAutosave(draft, (d) => update.mutateAsync({ id: place.id, patch: { ...d, name: d.name.trim() || place.name } }))
  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const inCollection = (cid: string) => (links.data ?? []).find((l) => l.collection_id === cid)
  const inTrip = (tid: string) => (tripLinks.data ?? []).find((l) => l.trip_id === tid)
  const osm = osmUrl(place.osm_ref, place.lat, place.lng)
  const Icon = CATEGORY_META[draft.category].icon

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-border p-4 pt-[max(16px,env(safe-area-inset-top))]">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${CATEGORY_META[draft.category].color} 18%, transparent)`, color: CATEGORY_META[draft.category].color }}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <input aria-label="Place name" value={draft.name} onChange={(e) => set('name', e.target.value)} className="w-full bg-transparent text-base font-semibold outline-none" maxLength={300} />
          <p className="truncate text-xs text-muted-foreground">
            {flag(place.country_code)} {[draft.city, draft.country].filter(Boolean).join(', ') || 'Location details not set'}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <SaveState state={state} />
            <DemoBadge show={place.is_demo} />
          </div>
        </div>
        <FavouriteButton on={place.favourite} onToggle={() => update.mutate({ id: place.id, patch: { favourite: !place.favourite } })} label={place.name} />
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </div>
      <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4 scrollbar-thin">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status" htmlFor="pl-status">
            <Select
              id="pl-status"
              value={draft.status}
              onChange={(e) => {
                const status = e.target.value as AtlasPlace['status']
                setDraft((d) => ({ ...d, status, visited_on: status === 'visited' ? d.visited_on : null }))
                if (status === 'visited' && place.status !== 'visited') log({ module: 'atlas', action: 'visited', entity_type: 'place', entity_id: place.id, title: place.name, link: `/atlas?place=${place.id}` })
              }}
            >
              <option value="want">{STATUS_LABEL.want}</option>
              <option value="visited">{STATUS_LABEL.visited}</option>
            </Select>
          </Field>
          <Field label="Category" htmlFor="pl-cat">
            <Select id="pl-cat" value={draft.category} onChange={(e) => set('category', e.target.value as AtlasPlace['category'])}>
              {PLACE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_META[c].label}
                </option>
              ))}
            </Select>
          </Field>
          {draft.status === 'visited' && (
            <Field label="Visited on" htmlFor="pl-date" className="col-span-2">
              <Input id="pl-date" type="date" value={draft.visited_on ?? ''} onChange={(e) => set('visited_on', e.target.value || null)} />
            </Field>
          )}
          <Field label="City" htmlFor="pl-city">
            <Input id="pl-city" value={draft.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label="Country" htmlFor="pl-country">
            <Input id="pl-country" value={draft.country} onChange={(e) => set('country', e.target.value)} />
          </Field>
        </div>
        <Field label="Notes" htmlFor="pl-notes">
          <Textarea id="pl-notes" rows={4} value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Why you want to go, tips, what you loved…" />
        </Field>
        <div>
          <p className="mb-2 text-[13px] font-medium">Photos</p>
          <PhotoUploader module="atlas" value={draft.photos} onChange={(p) => set('photos', p)} max={12} />
        </div>
        <fieldset>
          <legend className="text-[13px] font-medium">Collections</legend>
          {(collections.data ?? []).length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">Create collections on the Places page.</p>
          ) : (
            <div className="mt-2 grid gap-1.5">
              {(collections.data ?? []).map((c) => {
                const link = inCollection(c.id)
                return (
                  <label key={c.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={Boolean(link)}
                      onCheckedChange={(v) => (v ? linkTable.create.mutate({ place_id: place.id, collection_id: c.id }) : link && linkTable.remove.mutate(link.id))}
                    />
                    {c.name}
                  </label>
                )
              })}
            </div>
          )}
        </fieldset>
        <fieldset>
          <legend className="text-[13px] font-medium">Trips</legend>
          {(trips.data ?? []).length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">No trips yet.</p>
          ) : (
            <div className="mt-2 grid gap-1.5">
              {(trips.data ?? []).map((t) => {
                const link = inTrip(t.id)
                return (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={Boolean(link)} onCheckedChange={(v) => (v ? tripTable.create.mutate({ trip_id: t.id, place_id: place.id }) : link && tripTable.remove.mutate(link.id))} />
                    <Plane className="size-3.5 text-muted-foreground" /> {t.title}
                  </label>
                )
              })}
            </div>
          )}
        </fieldset>
        {place.address && <p className="text-xs text-muted-foreground">{place.address}</p>}
        <div className="flex flex-wrap gap-2">
          {place.lat !== null && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/atlas/map?place=${place.id}`} onClick={onClose}>
                <MapIcon /> Show on map
              </Link>
            </Button>
          )}
          {osm && (
            <Button variant="outline" size="sm" asChild>
              <a href={osm} target="_blank" rel="noreferrer">
                <ExternalLink /> OpenStreetMap
              </a>
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Orbit only shows details you saved or the map provider returned. Check opening hours and prices with the place directly.</p>
      </div>
      <div className="border-t border-border p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <Button variant="ghost" className="text-destructive" onClick={() => setConfirm(true)}>
          <Trash /> Delete place
        </Button>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${place.name}?`}
        description="It’s removed from your map, collections and trips. Itinerary stops and journal entries that mention it are kept."
        onConfirm={async () => {
          await remove.mutateAsync(place.id)
          if (place.photos.length) backend.removeFiles(place.photos).catch(() => undefined)
          log({ module: 'atlas', action: 'deleted', entity_type: 'place', title: place.name })
          toast.success('Place deleted')
          onClose()
        }}
      />
    </div>
  )
}
