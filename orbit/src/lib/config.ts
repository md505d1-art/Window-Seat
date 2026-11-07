const env = import.meta.env

function clean(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export const config = {
  supabaseUrl: clean(env.VITE_SUPABASE_URL),
  supabaseAnonKey: clean(env.VITE_SUPABASE_ANON_KEY),
  /** Map tiles. OpenStreetMap's own servers are for light use; set a provider for production traffic. */
  mapTileUrl: clean(env.VITE_MAP_TILE_URL) || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapAttribution:
    clean(env.VITE_MAP_ATTRIBUTION) ||
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  /** Nominatim-compatible geocoder. Searched on submit only (no autocomplete), per the OSM usage policy. */
  geocoderUrl: (clean(env.VITE_GEOCODER_URL) || 'https://nominatim.openstreetmap.org').replace(/\/$/, ''),
}

export const supabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey)
