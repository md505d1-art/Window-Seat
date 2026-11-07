import { openDB, type IDBPDatabase } from 'idb'
import type { ModuleId, NewRow, Profile, Row, TableName } from '../types'
import { DEFAULTS, RELATIONS, TABLES, UNIQUE, defaultProfile } from './schema'
import { BackendError, type Backend, type Filter, type ListOptions } from './types'

/**
 * Demo mode store. Everything lives in IndexedDB on this device only, under one local user.
 * It mirrors the SQL defaults, unique keys and cascades so the app behaves the same as with
 * Supabase, but it is not a production database and the UI says so wherever it matters.
 */
export const LOCAL_USER_ID = '00000000-0000-4000-8000-000000000001'
const DB_NAME = 'orbit-demo-v1'

type Store = TableName | 'profile' | 'blobs'

function uuid(): string {
  return crypto.randomUUID()
}

function matches<T>(row: T, eq?: Filter<T>): boolean {
  if (!eq) return true
  for (const key of Object.keys(eq) as (keyof T)[]) {
    const want = eq[key]
    const have = row[key] ?? null
    if ((want ?? null) !== have) return false
  }
  return true
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1 // nulls last, like Postgres asc
  if (b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

export class LocalBackend implements Backend {
  readonly kind = 'local' as const
  readonly userId = LOCAL_USER_ID
  private dbPromise: Promise<IDBPDatabase>

  constructor(dbName = DB_NAME) {
    this.dbPromise = openDB(dbName, 1, {
      upgrade(db) {
        for (const t of TABLES) db.createObjectStore(t, { keyPath: 'id' })
        db.createObjectStore('profile', { keyPath: 'id' })
        db.createObjectStore('blobs')
      },
    })
  }

  private async all<T extends TableName>(table: T): Promise<Row<T>[]> {
    const db = await this.dbPromise
    return (await db.getAll(table)) as Row<T>[]
  }

  async list<T extends TableName>(table: T, opts: ListOptions<Row<T>> = {}): Promise<Row<T>[]> {
    let rows = (await this.all(table)).filter((r) => matches(r, opts.eq))
    const order = opts.order ?? [{ column: 'created_at' as keyof Row<T> & string, ascending: false }]
    rows = rows.sort((a, b) => {
      for (const o of order) {
        const c = compare(a[o.column as keyof Row<T>], b[o.column as keyof Row<T>])
        if (c !== 0) return o.ascending === false ? -c : c
      }
      return 0
    })
    return opts.limit ? rows.slice(0, opts.limit) : rows
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    const db = await this.dbPromise
    return ((await db.get(table, id)) as Row<T> | undefined) ?? null
  }

  private async assertUnique<T extends TableName>(table: T, row: Row<T>) {
    const keys = UNIQUE[table]
    if (!keys) return
    const rows = await this.all(table)
    for (const cols of keys) {
      const values = cols.map((c) => (row as unknown as Record<string, unknown>)[c])
      if (values.some((v) => v === null || v === undefined)) continue
      const clash = rows.find(
        (r) => r.id !== row.id && cols.every((c, i) => (r as unknown as Record<string, unknown>)[c] === values[i]),
      )
      if (clash) throw new BackendError(`A ${table.replace(/_/g, ' ')} row with that ${cols.join(' and ')} already exists.`, 'conflict')
    }
  }

  private build<T extends TableName>(table: T, row: NewRow<T>, stamp: number): Row<T> {
    const at = new Date(stamp).toISOString()
    return {
      ...(DEFAULTS[table]() as object),
      is_demo: false,
      ...row,
      id: row.id ?? uuid(),
      user_id: LOCAL_USER_ID,
      created_at: at,
      updated_at: at,
    } as Row<T>
  }

  async insert<T extends TableName>(table: T, row: NewRow<T>): Promise<Row<T>> {
    const full = this.build(table, row, Date.now())
    await this.assertUnique(table, full)
    const db = await this.dbPromise
    await db.put(table, full)
    return full
  }

  async insertMany<T extends TableName>(table: T, rows: NewRow<T>[]): Promise<Row<T>[]> {
    const out: Row<T>[] = []
    // Stagger timestamps by 1ms so "newest first" ordering stays stable.
    const base = Date.now() - rows.length
    for (let i = 0; i < rows.length; i++) {
      const full = this.build(table, rows[i], base + i)
      await this.assertUnique(table, full)
      out.push(full)
    }
    const db = await this.dbPromise
    const tx = db.transaction(table, 'readwrite')
    await Promise.all([...out.map((r) => tx.store.put(r)), tx.done])
    return out
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
    const db = await this.dbPromise
    const current = (await db.get(table, id)) as Row<T> | undefined
    if (!current) throw new BackendError('That item no longer exists.', 'not_found')
    const { id: _i, user_id: _u, created_at: _c, ...rest } = patch as Record<string, unknown>
    void _i
    void _u
    void _c
    const next = { ...current, ...rest, updated_at: new Date().toISOString() } as Row<T>
    await this.assertUnique(table, next)
    await db.put(table, next)
    return next
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    const db = await this.dbPromise
    await db.delete(table, id)
    // Mirror ON DELETE CASCADE / SET NULL.
    for (const rel of RELATIONS.filter((r) => r.parent === table)) {
      const children = (await this.all(rel.table)).filter(
        (c) => (c as unknown as Record<string, unknown>)[rel.column] === id,
      )
      for (const child of children) {
        if (rel.onDelete === 'cascade') await this.remove(rel.table, child.id)
        else await db.put(rel.table, { ...child, [rel.column]: null, updated_at: new Date().toISOString() })
      }
    }
  }

  async removeWhere<T extends TableName>(table: T, eq: Filter<Row<T>>): Promise<void> {
    const rows = await this.list(table, { eq })
    for (const r of rows) await this.remove(table, r.id)
  }

  async getProfile(): Promise<Profile> {
    const db = await this.dbPromise
    const p = (await db.get('profile', LOCAL_USER_ID)) as Profile | undefined
    if (p) return p
    const fresh = defaultProfile(LOCAL_USER_ID)
    await db.put('profile', fresh)
    return fresh
  }

  async updateProfile(patch: Partial<Profile>): Promise<Profile> {
    const db = await this.dbPromise
    const next = { ...(await this.getProfile()), ...patch, id: LOCAL_USER_ID, updated_at: new Date().toISOString() }
    await db.put('profile', next)
    return next
  }

  async upload(module: ModuleId, file: Blob, name: string): Promise<string> {
    const db = await this.dbPromise
    const safe = name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').slice(-60)
    const path = `${LOCAL_USER_ID}/${module}/${uuid()}-${safe}`
    await db.put('blobs', file, path)
    return path
  }

  private urlCache = new Map<string, string>()

  async fileUrls(paths: string[]): Promise<Record<string, string>> {
    const db = await this.dbPromise
    const out: Record<string, string> = {}
    for (const p of paths) {
      const cached = this.urlCache.get(p)
      if (cached) {
        out[p] = cached
        continue
      }
      const blob = (await db.get('blobs', p)) as Blob | undefined
      if (blob && typeof URL.createObjectURL === 'function') {
        const url = URL.createObjectURL(blob)
        this.urlCache.set(p, url)
        out[p] = url
      }
    }
    return out
  }

  async removeFiles(paths: string[]): Promise<void> {
    const db = await this.dbPromise
    for (const p of paths) {
      await db.delete('blobs', p)
      const url = this.urlCache.get(p)
      if (url) URL.revokeObjectURL(url)
      this.urlCache.delete(p)
    }
  }

  async wipe(): Promise<void> {
    const db = await this.dbPromise
    for (const s of [...TABLES, 'profile', 'blobs'] as Store[]) await db.clear(s)
  }
}
