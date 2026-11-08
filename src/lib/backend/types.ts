import type { ModuleId, NewRow, Profile, Row, TableName } from '../types'

export type Filter<T> = { [K in keyof T]?: T[K] | null }

export interface ListOptions<T> {
  eq?: Filter<T>
  order?: { column: keyof T & string; ascending?: boolean }[]
  limit?: number
}

export class BackendError extends Error {
  constructor(
    message: string,
    public code: 'not_found' | 'conflict' | 'validation' | 'auth' | 'network' | 'unknown' = 'unknown',
  ) {
    super(message)
    this.name = 'BackendError'
  }
}

/**
 * The single data API the app talks to. Two implementations:
 *  - SupabaseBackend: production. Postgres + RLS + private storage bucket.
 *  - LocalBackend: demo mode only, clearly labelled in the UI. IndexedDB on this device.
 */
export interface Backend {
  readonly kind: 'supabase' | 'local'
  readonly userId: string

  list<T extends TableName>(table: T, opts?: ListOptions<Row<T>>): Promise<Row<T>[]>
  get<T extends TableName>(table: T, id: string): Promise<Row<T> | null>
  insert<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T>>
  insertMany<T extends TableName>(table: T, rows: NewRow<T>[]): Promise<Row<T>[]>
  /** Insert unless a row with the same unique key exists. Returns null when skipped. */
  insertIgnore<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T> | null>
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>
  remove<T extends TableName>(table: T, id: string): Promise<void>
  removeWhere<T extends TableName>(table: T, eq: Filter<Row<T>>): Promise<void>

  getProfile(): Promise<Profile>
  updateProfile(patch: Partial<Profile>): Promise<Profile>

  /** Uploads to the user's private folder and returns the storage path. */
  upload(module: ModuleId, file: Blob, name: string): Promise<string>
  /** Resolves storage paths to short-lived URLs the browser can display. */
  fileUrls(paths: string[]): Promise<Record<string, string>>
  removeFiles(paths: string[]): Promise<void>

  /** Removes every row and file the user owns. */
  wipe(): Promise<void>
}

export interface AuthUser {
  id: string
  email: string | null
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'USER_UPDATED' | 'INITIAL'
