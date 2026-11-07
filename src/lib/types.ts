// Domain types. These mirror supabase/migrations/*_orbit_init.sql column for column.

export type ModuleId = 'flip' | 'spark' | 'atlas' | 'orbit'

export interface BaseRow {
  id: string
  user_id: string
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface WidgetPref {
  id: WidgetId
  visible: boolean
}

export type WidgetId =
  | 'quick-actions'
  | 'upcoming-tasks'
  | 'flip-performance'
  | 'active-projects'
  | 'upcoming-trips'
  | 'saved-destinations'
  | 'recent-activity'
  | 'favourites'

export interface Profile {
  id: string
  display_name: string
  avatar_path: string | null
  currency: string
  theme: 'dark' | 'light' | 'system'
  workspaces: { flip: boolean; spark: boolean; atlas: boolean }
  dashboard_widgets: WidgetPref[]
  onboarded: boolean
  walkthrough_done: boolean
  created_at: string
  updated_at: string
}

// ─── Flip ────────────────────────────────────────────────────────────────────
export const FLIP_STATUSES = ['draft', 'ready', 'listed', 'reserved', 'sold', 'archived'] as const
export type FlipStatus = (typeof FLIP_STATUSES)[number]

export interface ListingDraft {
  title: string
  description: string
  hashtags: string[]
  category: string
  price_low: number | null
  price_high: number | null
  price_basis: string
  source: 'template' | 'ai'
  verify: string[]
  generated_at: string
}

export interface FlipItem extends BaseRow {
  sku: string
  title: string
  brand: string
  category: string
  size: string
  colour: string
  condition: string
  status: FlipStatus
  archived_from: Exclude<FlipStatus, 'archived'> | null
  platform: string
  purchase_price: number | null
  listing_price: number | null
  sale_price: number | null
  seller_fees: number
  shipping_cost: number
  other_expenses: number
  purchase_date: string | null
  listed_date: string | null
  sold_date: string | null
  measurements: string
  notes: string
  photos: string[]
  listing: ListingDraft | null
  favourite: boolean
}

// ─── Spark ───────────────────────────────────────────────────────────────────
export const IDEA_STAGES = ['inbox', 'exploring', 'promising', 'converted'] as const
export type IdeaStage = (typeof IDEA_STAGES)[number]

export interface IdeaLink {
  url: string
  label: string
}
export interface Attachment {
  path: string
  name: string
  mime: string
  size: number
}

export interface SparkFolder extends BaseRow {
  name: string
  position: number
}

export interface SparkIdea extends BaseRow {
  folder_id: string | null
  project_id: string | null
  title: string
  description: string
  category: string
  tags: string[]
  links: IdeaLink[]
  attachments: Attachment[]
  stage: IdeaStage
  favourite: boolean
  archived: boolean
}

export const PROJECT_STATUSES = ['planning', 'active', 'paused', 'completed', 'archived'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export interface SparkProject extends BaseRow {
  name: string
  description: string
  status: ProjectStatus
  kind: 'general' | 'reselling' | 'travel'
  color: string
  start_date: string | null
  due_date: string | null
  notes: string
  favourite: boolean
  linked_flip: boolean
  linked_trip_id: string | null
}

export interface SparkMilestone extends BaseRow {
  project_id: string
  title: string
  description: string
  due_date: string | null
  done: boolean
  position: number
}

export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'completed'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export interface SparkTask extends BaseRow {
  project_id: string | null
  milestone_id: string | null
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  module: 'spark' | 'flip' | 'atlas' | 'general'
  due_date: string | null
  position: number
  completed_at: string | null
}

export interface CanvasData {
  nodes: unknown[]
  edges: unknown[]
  viewport: { x: number; y: number; zoom: number } | null
}

export interface SparkCanvas extends BaseRow {
  project_id: string | null
  name: string
  data: CanvasData
}

// ─── Atlas ───────────────────────────────────────────────────────────────────
export const PLACE_CATEGORIES = ['city', 'sight', 'nature', 'food', 'stay', 'shop', 'culture', 'other'] as const
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number]

export interface AtlasPlace extends BaseRow {
  name: string
  address: string
  city: string
  country: string
  country_code: string
  lat: number | null
  lng: number | null
  category: PlaceCategory
  status: 'want' | 'visited'
  favourite: boolean
  notes: string
  visited_on: string | null
  photos: string[]
  source: 'search' | 'custom'
  osm_ref: string | null
}

export interface AtlasCollection extends BaseRow {
  name: string
}
export interface AtlasPlaceCollection extends BaseRow {
  place_id: string
  collection_id: string
}
export interface AtlasTripPlace extends BaseRow {
  trip_id: string
  place_id: string
}

export interface AtlasTrip extends BaseRow {
  title: string
  destination: string
  start_date: string | null
  end_date: string | null
  description: string
  budget: number | null
  currency: string
  accommodation_notes: string
  transport_notes: string
  favourite: boolean
}

export const STOP_KINDS = ['activity', 'food', 'transport', 'stay', 'other'] as const
export type StopKind = (typeof STOP_KINDS)[number]

export interface AtlasStop extends BaseRow {
  trip_id: string
  day: string | null
  position: number
  title: string
  time: string | null
  kind: StopKind
  place_id: string | null
  notes: string
}

export interface AtlasChecklistItem extends BaseRow {
  trip_id: string
  label: string
  done: boolean
  position: number
}

export interface AtlasJournalEntry extends BaseRow {
  trip_id: string | null
  place_id: string | null
  title: string
  body: string
  entry_date: string
  tags: string[]
  favourite: boolean
  photos: string[]
}

// ─── shared ──────────────────────────────────────────────────────────────────
export interface OrbitFile extends BaseRow {
  module: ModuleId
  entity_type: string
  entity_id: string
  path: string
  name: string
  mime: string
  size: number
}

export interface ActivityRow extends BaseRow {
  module: ModuleId
  action: string
  entity_type: string
  entity_id: string | null
  title: string
  link: string | null
}

export interface NotificationRow extends BaseRow {
  module: ModuleId
  title: string
  body: string
  link: string | null
  read_at: string | null
  dedupe_key: string | null
}

export interface Tables {
  flip_items: FlipItem
  spark_folders: SparkFolder
  spark_ideas: SparkIdea
  spark_projects: SparkProject
  spark_milestones: SparkMilestone
  spark_tasks: SparkTask
  spark_canvases: SparkCanvas
  atlas_trips: AtlasTrip
  atlas_collections: AtlasCollection
  atlas_places: AtlasPlace
  atlas_place_collections: AtlasPlaceCollection
  atlas_trip_places: AtlasTripPlace
  atlas_stops: AtlasStop
  atlas_checklist: AtlasChecklistItem
  atlas_journal: AtlasJournalEntry
  files: OrbitFile
  activity: ActivityRow
  notifications: NotificationRow
}
export type TableName = keyof Tables
export type Row<T extends TableName> = Tables[T]
export type NewRow<T extends TableName> = Partial<Omit<Tables[T], 'id' | 'user_id' | 'created_at' | 'updated_at'>> & {
  id?: string
}
