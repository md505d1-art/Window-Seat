import type { Profile, Row, TableName, WidgetPref } from '../types'

export const TABLES: TableName[] = [
  'flip_items',
  'spark_folders',
  'spark_ideas',
  'spark_projects',
  'spark_milestones',
  'spark_tasks',
  'spark_canvases',
  'atlas_trips',
  'atlas_collections',
  'atlas_places',
  'atlas_place_collections',
  'atlas_trip_places',
  'atlas_stops',
  'atlas_checklist',
  'atlas_journal',
  'files',
  'activity',
  'notifications',
]

/** Foreign keys, mirrored from the SQL migration so the on-device demo store behaves the same way. */
export const RELATIONS: { table: TableName; column: string; parent: TableName; onDelete: 'cascade' | 'set null' }[] = [
  { table: 'atlas_place_collections', column: 'place_id', parent: 'atlas_places', onDelete: 'cascade' },
  { table: 'atlas_place_collections', column: 'collection_id', parent: 'atlas_collections', onDelete: 'cascade' },
  { table: 'atlas_trip_places', column: 'trip_id', parent: 'atlas_trips', onDelete: 'cascade' },
  { table: 'atlas_trip_places', column: 'place_id', parent: 'atlas_places', onDelete: 'cascade' },
  { table: 'atlas_stops', column: 'trip_id', parent: 'atlas_trips', onDelete: 'cascade' },
  { table: 'atlas_stops', column: 'place_id', parent: 'atlas_places', onDelete: 'set null' },
  { table: 'atlas_checklist', column: 'trip_id', parent: 'atlas_trips', onDelete: 'cascade' },
  { table: 'atlas_journal', column: 'trip_id', parent: 'atlas_trips', onDelete: 'set null' },
  { table: 'atlas_journal', column: 'place_id', parent: 'atlas_places', onDelete: 'set null' },
  { table: 'spark_projects', column: 'linked_trip_id', parent: 'atlas_trips', onDelete: 'set null' },
  { table: 'spark_ideas', column: 'folder_id', parent: 'spark_folders', onDelete: 'set null' },
  { table: 'spark_ideas', column: 'project_id', parent: 'spark_projects', onDelete: 'set null' },
  { table: 'spark_milestones', column: 'project_id', parent: 'spark_projects', onDelete: 'cascade' },
  { table: 'spark_tasks', column: 'project_id', parent: 'spark_projects', onDelete: 'cascade' },
  { table: 'spark_tasks', column: 'milestone_id', parent: 'spark_milestones', onDelete: 'set null' },
  { table: 'spark_canvases', column: 'project_id', parent: 'spark_projects', onDelete: 'cascade' },
]

const today = () => new Date().toISOString().slice(0, 10)

/** Column defaults, mirrored from the SQL migration (used by the on-device store). */
export const DEFAULTS: { [T in TableName]: () => Partial<Row<T>> } = {
  flip_items: () => ({
    title: '', brand: '', category: '', size: '', colour: '', condition: '', status: 'draft', archived_from: null,
    platform: '', purchase_price: null, listing_price: null, sale_price: null, seller_fees: 0, shipping_cost: 0,
    other_expenses: 0, purchase_date: null, listed_date: null, sold_date: null, measurements: '', notes: '',
    photos: [], listing: null, favourite: false,
  }),
  spark_folders: () => ({ position: 0 }),
  spark_ideas: () => ({
    folder_id: null, project_id: null, description: '', category: '', tags: [], links: [], attachments: [],
    stage: 'inbox', favourite: false, archived: false,
  }),
  spark_projects: () => ({
    description: '', status: 'planning', kind: 'general', color: 'violet', start_date: null, due_date: null,
    notes: '', favourite: false, linked_flip: false, linked_trip_id: null,
  }),
  spark_milestones: () => ({ description: '', due_date: null, done: false, position: 0 }),
  spark_tasks: () => ({
    project_id: null, milestone_id: null, description: '', status: 'todo', priority: 'medium', module: 'spark',
    due_date: null, position: 0, completed_at: null,
  }),
  spark_canvases: () => ({ project_id: null, data: { nodes: [], edges: [], viewport: null } }),
  atlas_trips: () => ({
    destination: '', start_date: null, end_date: null, description: '', budget: null, currency: 'GBP',
    accommodation_notes: '', transport_notes: '', favourite: false,
  }),
  atlas_collections: () => ({}),
  atlas_places: () => ({
    address: '', city: '', country: '', country_code: '', lat: null, lng: null, category: 'sight', status: 'want',
    favourite: false, notes: '', visited_on: null, photos: [], source: 'custom', osm_ref: null,
  }),
  atlas_place_collections: () => ({}),
  atlas_trip_places: () => ({}),
  atlas_stops: () => ({ day: null, position: 0, time: null, kind: 'activity', place_id: null, notes: '' }),
  atlas_checklist: () => ({ done: false, position: 0 }),
  atlas_journal: () => ({
    trip_id: null, place_id: null, body: '', entry_date: today(), tags: [], favourite: false, photos: [],
  }),
  files: () => ({ mime: 'application/octet-stream', size: 0 }),
  activity: () => ({ entity_id: null, title: '', link: null }),
  notifications: () => ({ body: '', link: null, read_at: null, dedupe_key: null }),
}

/** Unique constraints the on-device store enforces, mirrored from SQL. */
export const UNIQUE: Partial<Record<TableName, string[][]>> = {
  flip_items: [['sku']],
  atlas_place_collections: [['place_id', 'collection_id']],
  atlas_trip_places: [['trip_id', 'place_id']],
  notifications: [['dedupe_key']],
}

export const DEFAULT_WIDGETS: WidgetPref[] = [
  { id: 'quick-actions', visible: true },
  { id: 'upcoming-tasks', visible: true },
  { id: 'flip-performance', visible: true },
  { id: 'active-projects', visible: true },
  { id: 'upcoming-trips', visible: true },
  { id: 'saved-destinations', visible: true },
  { id: 'recent-activity', visible: true },
  { id: 'favourites', visible: true },
]

export function defaultProfile(id: string, displayName = ''): Profile {
  const now = new Date().toISOString()
  return {
    id,
    display_name: displayName,
    avatar_path: null,
    currency: 'GBP',
    theme: 'dark',
    workspaces: { flip: true, spark: true, atlas: true },
    dashboard_widgets: DEFAULT_WIDGETS,
    onboarded: false,
    walkthrough_done: false,
    created_at: now,
    updated_at: now,
  }
}
