import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import type { ModuleId, NewRow, Profile, Row, TableName } from '../types'
import { DEFAULT_WIDGETS, TABLES, defaultProfile } from './schema'
import { BackendError, type Backend, type Filter, type ListOptions } from './types'

export const BUCKET = 'orbit-files'

function fail(error: PostgrestError | { message: string; code?: string } | null): never {
  const code = error && 'code' in error ? error.code : undefined
  if (code === '23505') throw new BackendError('That already exists. Try a different value.', 'conflict')
  if (code === '23503') throw new BackendError('That link points to something that no longer exists.', 'validation')
  if (code === '23514') throw new BackendError('One of the values is out of range. Check the form and try again.', 'validation')
  if (code === '42501') throw new BackendError('You do not have permission to change that.', 'auth')
  if (code === 'PGRST116') throw new BackendError('That item no longer exists.', 'not_found')
  throw new BackendError(error?.message || 'Something went wrong talking to the server.', 'unknown')
}

/** Production backend: Postgres tables protected by RLS, plus a private storage bucket. */
export class SupabaseBackend implements Backend {
  readonly kind = 'supabase' as const

  constructor(
    private sb: SupabaseClient,
    readonly userId: string,
  ) {}

  async list<T extends TableName>(table: T, opts: ListOptions<Row<T>> = {}): Promise<Row<T>[]> {
    let q = this.sb.from(table).select('*')
    for (const [k, v] of Object.entries(opts.eq ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v as string)
    const order = opts.order ?? [{ column: 'created_at', ascending: false }]
    for (const o of order) q = q.order(o.column, { ascending: o.ascending ?? true, nullsFirst: false })
    if (opts.limit) q = q.limit(opts.limit)
    const { data, error } = await q
    if (error) fail(error)
    return data as Row<T>[]
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    const { data, error } = await this.sb.from(table).select('*').eq('id', id).maybeSingle()
    if (error) fail(error)
    return data as Row<T> | null
  }

  async insert<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T>> {
    const { data, error } = await this.sb.from(table).insert(row).select().single()
    if (error) fail(error)
    return data as Row<T>
  }

  async insertMany<T extends TableName>(table: T, rows: NewRow<T>[]): Promise<Row<T>[]> {
    if (rows.length === 0) return []
    const { data, error } = await this.sb.from(table).insert(rows).select()
    if (error) fail(error)
    return data as Row<T>[]
  }

  async insertIgnore<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T> | null> {
    try {
      return await this.insert(table, row)
    } catch (e) {
      if (e instanceof BackendError && e.code === 'conflict') return null
      throw e
    }
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    const { id: _i, user_id: _u, created_at: _c, updated_at: _up, ...rest } = patch as Record<string, unknown>
    void _i
    void _u
    void _c
    void _up
    const { data, error } = await this.sb.from(table).update(rest).eq('id', id).select().single()
    if (error) fail(error)
    return data as Row<T>
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    const { error } = await this.sb.from(table).delete().eq('id', id)
    if (error) fail(error)
  }

  async removeWhere<T extends TableName>(table: T, eq: Filter<Row<T>>): Promise<void> {
    let q = this.sb.from(table).delete()
    for (const [k, v] of Object.entries(eq)) q = v === null ? q.is(k, null) : q.eq(k, v as string)
    const { error } = await q
    if (error) fail(error)
  }

  async getProfile(): Promise<Profile> {
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', this.userId).maybeSingle()
    if (error) fail(error)
    if (data) {
      const p = data as Profile
      if (!Array.isArray(p.dashboard_widgets) || p.dashboard_widgets.length === 0) p.dashboard_widgets = DEFAULT_WIDGETS
      return p
    }
    // The signup trigger normally creates this row; create it if a project skipped the trigger.
    const fresh = defaultProfile(this.userId)
    const { data: created, error: insertError } = await this.sb
      .from('profiles')
      .insert({ id: this.userId, display_name: '' })
      .select()
      .single()
    if (insertError) fail(insertError)
    return { ...fresh, ...(created as Profile) }
  }

  async updateProfile(patch: Partial<Profile>): Promise<Profile> {
    const { id: _i, created_at: _c, updated_at: _u, ...rest } = patch
    void _i
    void _c
    void _u
    const { data, error } = await this.sb.from('profiles').update(rest).eq('id', this.userId).select().single()
    if (error) fail(error)
    return data as Profile
  }

  async upload(module: ModuleId, file: Blob, name: string): Promise<string> {
    const safe = name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(-60)
    const path = `${this.userId}/${module}/${crypto.randomUUID()}-${safe}`
    const { error } = await this.sb.storage.from(BUCKET).upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
    if (error) throw new BackendError(`Upload failed: ${error.message}`, 'network')
    return path
  }

  async fileUrls(paths: string[]): Promise<Record<string, string>> {
    if (paths.length === 0) return {}
    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrls(paths, 60 * 60)
    if (error) throw new BackendError(`Could not load files: ${error.message}`, 'network')
    const out: Record<string, string> = {}
    for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl
    return out
  }

  async removeFiles(paths: string[]): Promise<void> {
    if (paths.length === 0) return
    const { error } = await this.sb.storage.from(BUCKET).remove(paths)
    if (error) throw new BackendError(`Could not delete files: ${error.message}`, 'network')
  }

  async wipe(): Promise<void> {
    // Storage first (rows don't cascade into storage), then every table.
    for (const folder of ['flip', 'spark', 'atlas', 'orbit']) {
      const { data } = await this.sb.storage.from(BUCKET).list(`${this.userId}/${folder}`, { limit: 1000 })
      const paths = (data ?? []).map((f) => `${this.userId}/${folder}/${f.name}`)
      if (paths.length) await this.removeFiles(paths)
    }
    for (const t of [...TABLES].reverse()) {
      const { error } = await this.sb.from(t).delete().eq('user_id', this.userId)
      if (error) fail(error)
    }
  }

  async deleteAccount(): Promise<void> {
    await this.wipe()
    const { error } = await this.sb.rpc('delete_my_account')
    if (error) fail(error)
  }
}
