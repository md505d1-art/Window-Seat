import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useBackend, useSession } from '@/features/auth/auth'
import type { Backend, ListOptions } from './backend/types'
import { RELATIONS } from './backend/schema'
import type { ModuleId, NewRow, Profile, Row, TableName } from './types'
import { errorMessage } from './utils'

function scope(backend: Backend) {
  return [backend.kind, backend.userId] as const
}

export function useRows<T extends TableName>(table: T, opts?: ListOptions<Row<T>>, enabled = true) {
  const backend = useBackend()
  return useQuery({
    queryKey: [...scope(backend), table, opts ?? {}],
    queryFn: () => backend.list(table, opts),
    enabled,
  })
}

export function useRow<T extends TableName>(table: T, id: string | undefined) {
  const backend = useBackend()
  return useQuery({
    queryKey: [...scope(backend), table, 'one', id],
    queryFn: () => backend.get(table, id as string),
    enabled: Boolean(id),
  })
}

/** Tables that may change when a row in `table` is deleted (cascade / set null). */
function affected(table: TableName): TableName[] {
  const out = new Set<TableName>([table])
  const walk = (t: TableName) => {
    for (const r of RELATIONS) if (r.parent === t && !out.has(r.table)) {
      out.add(r.table)
      walk(r.table)
    }
  }
  walk(table)
  return [...out]
}

export function invalidate(qc: QueryClient, backend: Backend, tables: TableName[]) {
  for (const t of tables) qc.invalidateQueries({ queryKey: [...scope(backend), t] })
}

/** create / update / remove for one table, with cache refresh and error toasts. */
export function useTable<T extends TableName>(table: T) {
  const backend = useBackend()
  const qc = useQueryClient()
  const onError = (e: unknown) => toast.error(errorMessage(e))

  const create = useMutation({
    mutationFn: (row: NewRow<T>) => backend.insert(table, row),
    onSuccess: () => invalidate(qc, backend, [table]),
    onError,
  })
  const createMany = useMutation({
    mutationFn: (rows: NewRow<T>[]) => backend.insertMany(table, rows),
    onSuccess: () => invalidate(qc, backend, [table]),
    onError,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Row<T>> }) => backend.update(table, id, patch),
    // Optimistic update keeps drag-and-drop and toggles snappy.
    onMutate: async ({ id, patch }) => {
      const key = [...scope(backend), table]
      await qc.cancelQueries({ queryKey: key })
      const snapshots = qc.getQueriesData<unknown>({ queryKey: key })
      for (const [k, data] of snapshots) {
        if (Array.isArray(data)) qc.setQueryData(k, data.map((r: Row<T>) => (r.id === id ? { ...r, ...patch } : r)))
        else if (data && typeof data === 'object' && (data as Row<T>).id === id) qc.setQueryData(k, { ...(data as object), ...patch })
      }
      return { snapshots }
    },
    onError: (e, _v, ctx) => {
      for (const [k, data] of ctx?.snapshots ?? []) qc.setQueryData(k, data)
      onError(e)
    },
    onSettled: () => invalidate(qc, backend, [table]),
  })
  const remove = useMutation({
    mutationFn: (id: string) => backend.remove(table, id),
    onSuccess: () => invalidate(qc, backend, affected(table)),
    onError,
  })
  return { create, createMany, update, remove }
}

export function useProfile() {
  const backend = useBackend()
  return useQuery({ queryKey: [...scope(backend), 'profile'], queryFn: () => backend.getProfile() })
}

export function useUpdateProfile() {
  const backend = useBackend()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Profile>) => backend.updateProfile(patch),
    onMutate: async (patch) => {
      const key = [...scope(backend), 'profile']
      const prev = qc.getQueryData<Profile>(key)
      if (prev) qc.setQueryData(key, { ...prev, ...patch })
      return { prev }
    },
    onError: (e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData([...scope(backend), 'profile'], ctx.prev)
      toast.error(errorMessage(e))
    },
    onSuccess: (p) => qc.setQueryData([...scope(backend), 'profile'], p),
  })
}

/** Resolves storage paths to displayable URLs (signed URLs on Supabase, blob URLs in demo mode). */
export function useFileUrls(paths: string[]) {
  const backend = useBackend()
  const key = [...paths].sort().join('|')
  return useQuery({
    queryKey: [...scope(backend), 'file-urls', key],
    queryFn: () => backend.fileUrls(paths),
    enabled: paths.length > 0,
    staleTime: 30 * 60 * 1000,
  })
}

export interface ActivityInput {
  module: ModuleId
  action: string
  entity_type: string
  entity_id?: string | null
  title: string
  link?: string | null
}

/** Records an entry in the cross-module activity feed. Never blocks or fails the user's action. */
export function useLogActivity() {
  const backend = useBackend()
  const qc = useQueryClient()
  return (a: ActivityInput) => {
    backend
      .insert('activity', { ...a, entity_id: a.entity_id ?? null, link: a.link ?? null })
      .then(() => invalidate(qc, backend, ['activity']))
      .catch(() => undefined)
  }
}

export interface NotifyInput {
  module: ModuleId
  title: string
  body?: string
  link?: string | null
  dedupe_key?: string | null
}

/** Creates a notification; with a dedupe_key it is created at most once. */
export function useNotify() {
  const backend = useBackend()
  const qc = useQueryClient()
  return (n: NotifyInput) =>
    backend
      .insertIgnore('notifications', { ...n, body: n.body ?? '', link: n.link ?? null, dedupe_key: n.dedupe_key ?? null })
      .then((row) => {
        if (row) invalidate(qc, backend, ['notifications'])
        return row
      })
      .catch(() => null)
}

export function useIsDemoMode() {
  return useSession().mode === 'local'
}
