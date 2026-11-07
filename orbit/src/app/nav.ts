import {
  BookOpen,
  ChartColumn,
  Compass,
  House,
  Lightbulb,
  ListChecks,
  Map,
  MapPin,
  Network,
  Package,
  Plane,
  Rocket,
  Sparkles,
  Tag,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import type { ModuleId } from '@/lib/types'

export interface NavLeaf {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
}

export interface ModuleNav {
  id: Exclude<ModuleId, 'orbit'>
  label: string
  tagline: string
  to: string
  icon: LucideIcon
  items: NavLeaf[]
}

export const MODULES: ModuleNav[] = [
  {
    id: 'flip',
    label: 'Flip',
    tagline: 'Reselling and inventory',
    to: '/flip',
    icon: Tag,
    items: [
      { label: 'Inventory', to: '/flip', icon: Package, end: true },
      { label: 'Listing assistant', to: '/flip/listing', icon: WandSparkles },
      { label: 'Sales & profit', to: '/flip/sales', icon: ChartColumn },
    ],
  },
  {
    id: 'spark',
    label: 'Spark',
    tagline: 'Ideas and projects',
    to: '/spark',
    icon: Sparkles,
    items: [
      { label: 'Ideas', to: '/spark', icon: Lightbulb, end: true },
      { label: 'Projects', to: '/spark/projects', icon: Rocket },
      { label: 'Canvas', to: '/spark/canvas', icon: Network },
      { label: 'Assistant', to: '/spark/assistant', icon: WandSparkles },
    ],
  },
  {
    id: 'atlas',
    label: 'Atlas',
    tagline: 'Travel and exploration',
    to: '/atlas',
    icon: Compass,
    items: [
      { label: 'Places', to: '/atlas', icon: MapPin, end: true },
      { label: 'Map', to: '/atlas/map', icon: Map },
      { label: 'Trips', to: '/atlas/trips', icon: Plane },
      { label: 'Journal', to: '/atlas/journal', icon: BookOpen },
      { label: 'Statistics', to: '/atlas/stats', icon: ChartColumn },
    ],
  },
]

export const HOME_NAV: NavLeaf = { label: 'Home', to: '/', icon: House, end: true }
export const TASKS_NAV: NavLeaf = { label: 'Tasks', to: '/tasks', icon: ListChecks }

const LABELS: Record<string, string> = {
  flip: 'Flip',
  spark: 'Spark',
  atlas: 'Atlas',
  listing: 'Listing assistant',
  sales: 'Sales & profit',
  items: 'Inventory',
  new: 'New',
  projects: 'Projects',
  ideas: 'Ideas',
  canvas: 'Canvas',
  assistant: 'Assistant',
  map: 'Map',
  trips: 'Trips',
  journal: 'Journal',
  stats: 'Statistics',
  tasks: 'Tasks',
  search: 'Search',
  notifications: 'Notifications',
  settings: 'Settings',
  profile: 'Profile',
}

/** Breadcrumbs from the path; ids are replaced by the page's own title when it provides one. */
export function crumbsFor(pathname: string, leafTitle?: string): { label: string; to: string }[] {
  const parts = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; to: string }[] = [{ label: 'Orbit', to: '/' }]
  let acc = ''
  parts.forEach((p, i) => {
    acc += `/${p}`
    const isLast = i === parts.length - 1
    const known = LABELS[p]
    if (known) {
      // /flip/items/:id → skip the "Inventory" duplicate when it just points at /flip/items
      if (p === 'items') crumbs.push({ label: known, to: '/flip' })
      else if (p === 'ideas') crumbs.push({ label: known, to: '/spark' })
      else crumbs.push({ label: known, to: acc })
    } else if (isLast) {
      crumbs.push({ label: leafTitle || 'Details', to: acc })
    }
  })
  return crumbs
}

export function moduleForPath(pathname: string): ModuleId {
  if (pathname.startsWith('/flip')) return 'flip'
  if (pathname.startsWith('/spark')) return 'spark'
  if (pathname.startsWith('/atlas')) return 'atlas'
  return 'orbit'
}
