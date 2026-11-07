import { Building, Camera, Landmark, MapPin, Mountain, ShoppingBag, Utensils, BedDouble, type LucideIcon } from 'lucide-react'
import type { PlaceCategory, StopKind } from '@/lib/types'

export const CATEGORY_META: Record<PlaceCategory, { label: string; icon: LucideIcon; color: string }> = {
  city: { label: 'City', icon: Building, color: '#38bdf8' },
  sight: { label: 'Sight', icon: Camera, color: '#a78bfa' },
  nature: { label: 'Nature', icon: Mountain, color: '#34d399' },
  food: { label: 'Food & drink', icon: Utensils, color: '#fb923c' },
  stay: { label: 'Stay', icon: BedDouble, color: '#f472b6' },
  shop: { label: 'Shopping', icon: ShoppingBag, color: '#facc15' },
  culture: { label: 'Culture', icon: Landmark, color: '#60a5fa' },
  other: { label: 'Other', icon: MapPin, color: '#94a3b8' },
}

export const STOP_META: Record<StopKind, { label: string }> = {
  activity: { label: 'Activity' },
  food: { label: 'Food' },
  transport: { label: 'Transport' },
  stay: { label: 'Stay' },
  other: { label: 'Other' },
}

export const STATUS_LABEL = { want: 'Want to visit', visited: 'Visited' } as const

export function flag(code: string): string {
  if (!/^[a-z]{2}$/i.test(code)) return ''
  return String.fromCodePoint(...code.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}
