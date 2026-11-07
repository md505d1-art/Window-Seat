import { config } from './config'
import type { PlaceCategory } from './types'

/** A place returned by the geocoder. Only fields the provider actually returned — nothing invented. */
export interface GeoResult {
  ref: string // e.g. "node/123"
  name: string
  address: string
  city: string
  country: string
  country_code: string
  lat: number
  lng: number
  category: PlaceCategory
  kind: string // provider's own type, e.g. "museum"
}

interface NominatimRow {
  osm_type?: string
  osm_id?: number
  lat: string
  lon: string
  name?: string
  display_name: string
  category?: string
  class?: string
  type?: string
  addresstype?: string
  address?: Record<string, string>
}

const CATEGORY_MAP: [RegExp, PlaceCategory][] = [
  [/^(city|town|village|hamlet|suburb|municipality|county|state|country|administrative|neighbourhood|quarter)$/, 'city'],
  [/^(restaurant|cafe|bar|pub|fast_food|food_court|ice_cream|bakery|biergarten)$/, 'food'],
  [/^(hotel|hostel|guest_house|motel|apartment|camp_site|chalet|alpine_hut)$/, 'stay'],
  [/^(museum|gallery|theatre|arts_centre|library|place_of_worship|monastery|cinema)$/, 'culture'],
  [/^(peak|beach|park|nature_reserve|waterfall|forest|wood|lake|bay|cliff|volcano|glacier|garden|island|valley)$/, 'nature'],
  [/^(mall|marketplace|market|department_store|shop|supermarket|clothes|books)$/, 'shop'],
  [/^(attraction|viewpoint|monument|memorial|castle|ruins|tower|artwork|zoo|theme_park|archaeological_site|fort)$/, 'sight'],
]

export function categorise(kind: string, cls = ''): PlaceCategory {
  for (const [re, cat] of CATEGORY_MAP) if (re.test(kind)) return cat
  if (cls === 'shop') return 'shop'
  if (cls === 'natural' || cls === 'leisure') return 'nature'
  if (cls === 'tourism' || cls === 'historic') return 'sight'
  if (cls === 'place' || cls === 'boundary') return 'city'
  return 'other'
}

export function parseNominatim(rows: NominatimRow[]): GeoResult[] {
  return rows
    .filter((r) => r.lat && r.lon && !Number.isNaN(Number(r.lat)) && !Number.isNaN(Number(r.lon)))
    .map((r) => {
      const a = r.address ?? {}
      const kind = r.type ?? r.addresstype ?? ''
      const name = r.name || r.display_name.split(',')[0].trim()
      return {
        ref: r.osm_type && r.osm_id ? `${r.osm_type}/${r.osm_id}` : `${r.lat},${r.lon}`,
        name,
        address: r.display_name,
        city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? (kind === 'city' ? name : ''),
        country: a.country ?? '',
        country_code: (a.country_code ?? '').toLowerCase(),
        lat: Number(r.lat),
        lng: Number(r.lon),
        category: categorise(kind, r.category ?? r.class ?? ''),
        kind,
      }
    })
}

let lastCall = 0

/**
 * Searches the configured Nominatim-compatible service. Called only when someone submits a
 * search (no autocomplete) and at most once a second, per the OpenStreetMap usage policy.
 */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = query.trim()
  if (!q) return []
  const wait = 1000 - (Date.now() - lastCall)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()
  const url = `${config.geocoderUrl}/search?format=jsonv2&addressdetails=1&limit=8&accept-language=en&q=${encodeURIComponent(q)}`
  let res: Response
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new Error('Place search is unreachable. Check your connection and try again.')
  }
  if (res.status === 429) throw new Error('Place search is busy. Wait a few seconds and try again.')
  if (!res.ok) throw new Error(`Place search failed (${res.status}). Try again shortly.`)
  return parseNominatim((await res.json()) as NominatimRow[])
}

export function osmUrl(ref: string | null, lat: number | null, lng: number | null): string | null {
  if (ref && /^(node|way|relation)\/\d+$/.test(ref)) return `https://www.openstreetmap.org/${ref}`
  if (lat !== null && lng !== null) return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`
  return null
}
