import L from 'leaflet'
import * as React from 'react'
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { config } from '@/lib/config'

export interface MapPin {
  id: string
  lat: number
  lng: number
  label: string
  color: string
  /** Visited places render filled; want-to-visit render as a ring; stops render as numbered squares. */
  style?: 'filled' | 'ring' | 'stop' | 'search'
  number?: number
}

const iconCache = new Map<string, L.DivIcon>()
function icon(pin: MapPin, selected: boolean): L.DivIcon {
  const key = `${pin.color}-${pin.style}-${pin.number ?? ''}-${selected}`
  let i = iconCache.get(key)
  if (!i) {
    const size = selected ? 24 : 18
    const body =
      pin.style === 'stop'
        ? `<div style="width:${size + 4}px;height:${size + 4}px;border-radius:7px;background:${pin.color};color:#fff;font:600 11px/1 var(--font-sans);display:grid;place-items:center;border:2px solid var(--surface);box-shadow:0 2px 8px rgb(0 0 0/.35)">${pin.number ?? ''}</div>`
        : pin.style === 'ring'
          ? `<div class="orbit-pin" style="width:${size}px;height:${size}px;background:var(--surface);border:4px solid ${pin.color}"></div>`
          : pin.style === 'search'
            ? `<div class="orbit-pin" style="width:${size}px;height:${size}px;background:#fff;border:4px solid #0b0d12"></div>`
            : `<div class="orbit-pin" style="width:${size}px;height:${size}px;background:${pin.color}"></div>`
    const total = pin.style === 'stop' ? size + 4 : size
    i = L.divIcon({ html: body, className: '', iconSize: [total, total], iconAnchor: [total / 2, total / 2] })
    iconCache.set(key, i)
  }
  return i
}

function FitBounds({ pins, focus }: { pins: MapPin[]; focus?: { lat: number; lng: number } | null }) {
  const map = useMap()
  const key = pins.map((p) => p.id).join(',')
  React.useEffect(() => {
    if (focus) {
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 13), { duration: 0.6 })
      return
    }
    if (pins.length === 0) return
    if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 12)
    else map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 13 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, focus?.lat, focus?.lng])
  return null
}

function ClickCapture({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick?.(e.latlng.lat, e.latlng.lng) })
  return null
}

/** Leaflet map with OpenStreetMap tiles (or the configured provider). Never asks for location by itself. */
export function OrbitMap({
  pins,
  selectedId,
  onSelect,
  onMapClick,
  focus,
  className,
  crosshair,
}: {
  pins: MapPin[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  onMapClick?: (lat: number, lng: number) => void
  focus?: { lat: number; lng: number } | null
  className?: string
  crosshair?: boolean
}) {
  return (
    <MapContainer
      center={[30, 5]}
      zoom={2}
      minZoom={2}
      worldCopyJump
      className={className}
      style={{ cursor: crosshair ? 'crosshair' : undefined }}
      attributionControl
    >
      <TileLayer url={config.mapTileUrl} attribution={config.mapAttribution} maxZoom={19} />
      <FitBounds pins={pins} focus={focus} />
      <ClickCapture onClick={onMapClick} />
      {pins.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={icon(p, p.id === selectedId)}
          zIndexOffset={p.id === selectedId ? 1000 : p.style === 'search' ? 500 : 0}
          eventHandlers={{ click: () => onSelect?.(p.id) }}
          keyboard
          title={p.label}
          alt={p.label}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            {p.label}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  )
}
