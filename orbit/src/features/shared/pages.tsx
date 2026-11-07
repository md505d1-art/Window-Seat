import { Bell, CheckCheck, ListChecks, Plane, Plus, Search, Tag, Trash } from 'lucide-react'
import * as React from 'react'
import { Link, useSearchParams } from 'react-router'
import { useUI } from '@/app/ui-context'
import { Button } from '@/components/ui/button'
import { Checkbox, Input, Select } from '@/components/ui/inputs'
import { Badge, Card, EmptyState, ListSkeleton, PageHeader, Segmented } from '@/components/ui/misc'
import { NotificationList, useMarkAllRead } from '@/components/layout/NotificationsMenu'
import { PRIORITY_META } from '@/features/spark/meta'
import { TaskDialog, useTaskActions } from '@/features/spark/TaskDialog'
import { useBackend } from '@/features/auth/auth'
import { invalidate, useRows } from '@/lib/data'
import { dayLabel, daysUntil, todayISO } from '@/lib/format'
import type { ModuleId, SparkTask } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'
import { MODULE_META, ModuleDot } from './bits'
import { searchDocs, useSearchIndex } from './search'
import { useWorkspaces } from './workspaces'

// ─── Tasks ───────────────────────────────────────────────────────────────────
type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'none' | 'done'
const BUCKETS: { id: Bucket; label: string }[] = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Next 7 days' },
  { id: 'later', label: 'Later' },
  { id: 'none', label: 'No due date' },
  { id: 'done', label: 'Completed' },
]

function bucketOf(t: SparkTask): Bucket {
  if (t.status === 'completed') return 'done'
  const d = daysUntil(t.due_date)
  if (d === null) return 'none'
  if (d < 0) return 'overdue'
  if (d === 0) return 'today'
  if (d <= 7) return 'week'
  return 'later'
}

export function TasksPage() {
  const tasks = useRows('spark_tasks')
  const projects = useRows('spark_projects')
  const ws = useWorkspaces()
  const items = useRows('flip_items', { eq: { status: 'ready' } }, ws.flip)
  const trips = useRows('atlas_trips', undefined, ws.atlas)
  const checklist = useRows('atlas_checklist', { eq: { done: false } }, ws.atlas)
  const actions = useTaskActions()
  const { open } = useUI()
  const [area, setArea] = React.useState<'all' | SparkTask['module']>('all')
  const [project, setProject] = React.useState('')
  const [showDone, setShowDone] = React.useState(false)
  const [editing, setEditing] = React.useState<SparkTask | null>(null)

  const list = (tasks.data ?? []).filter((t) => {
    if (area !== 'all' && t.module !== area) return false
    if (project && t.project_id !== project) return false
    if (!showDone && t.status === 'completed') return false
    return true
  })
  const projectName = (id: string | null) => projects.data?.find((p) => p.id === id)?.name
  const soonTrips = (trips.data ?? []).filter((t) => {
    const d = daysUntil(t.start_date)
    return d !== null && d >= 0 && d <= 14
  })
  const packing = (checklist.data ?? []).filter((c) => soonTrips.some((t) => t.id === c.trip_id))

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Every task across Flip, Spark and Atlas in one list."
        actions={
          <Button size="sm" onClick={() => open('new-task')}>
            <Plus /> New task
          </Button>
        }
      />
      {((ws.flip && (items.data ?? []).length > 0) || packing.length > 0) && (
        <Card className="mb-4 p-4">
          <h2 className="mb-2 text-sm font-semibold">From your workspaces</h2>
          <ul className="grid grid-cols-1 gap-1.5 text-sm">
            {ws.flip && (items.data ?? []).length > 0 && (
              <li className="flex items-center gap-2">
                <Tag className="size-4 text-flip-text" />
                <Link to="/flip?status=ready" className="hover:underline">
                  {(items.data ?? []).length} item{(items.data ?? []).length === 1 ? ' is' : 's are'} ready to list
                </Link>
              </li>
            )}
            {soonTrips.map((t) => {
              const left = packing.filter((c) => c.trip_id === t.id).length
              if (!left) return null
              return (
                <li key={t.id} className="flex items-center gap-2">
                  <Plane className="size-4 text-atlas-text" />
                  <Link to={`/atlas/trips/${t.id}?tab=checklist`} className="hover:underline">
                    {left} checklist item{left === 1 ? '' : 's'} left for {t.title} ({dayLabel(t.start_date)})
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          label="Area"
          value={area}
          onChange={setArea}
          options={[
            { value: 'all', label: 'All' },
            { value: 'spark', label: 'Spark' },
            { value: 'flip', label: 'Flip' },
            { value: 'atlas', label: 'Atlas' },
            { value: 'general', label: 'General' },
          ]}
        />
        <Select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Filter by project" className="w-48">
          <option value="">All projects</option>
          {(projects.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={showDone} onCheckedChange={(v) => setShowDone(v === true)} /> Show completed
        </label>
      </div>
      {tasks.isLoading ? (
        <ListSkeleton rows={5} />
      ) : list.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tasks here" description="Add a task with the New button, or from inside a project." />
      ) : (
        <div className="grid gap-5">
          {BUCKETS.map((b) => {
            const ts = list.filter((t) => bucketOf(t) === b.id).sort((x, y) => (x.due_date ?? '').localeCompare(y.due_date ?? '') || x.position - y.position)
            if (!ts.length) return null
            return (
              <section key={b.id}>
                <h2 className={cn('mb-2 text-sm font-semibold', b.id === 'overdue' ? 'text-destructive' : 'text-muted-foreground')}>
                  {b.label} <span className="font-normal tabular">({ts.length})</span>
                </h2>
                <ul className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                  {ts.map((t) => {
                    const mod: ModuleId = t.module === 'general' ? 'orbit' : t.module
                    return (
                      <li key={t.id} className="flex min-w-0 items-center gap-3 px-3 py-2.5">
                        <Checkbox checked={t.status === 'completed'} onCheckedChange={() => actions.toggle(t)} aria-label={`Mark ${t.title} ${t.status === 'completed' ? 'not done' : 'done'}`} />
                        <button onClick={() => setEditing(t)} className="min-w-0 flex-1 text-left">
                          <span className={cn('block truncate text-sm', t.status === 'completed' && 'text-muted-foreground line-through')}>{t.title}</span>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <ModuleDot module={mod} /> {projectName(t.project_id) ?? (t.module === 'general' ? 'General' : MODULE_META[mod].label)}
                          </span>
                        </button>
                        {t.priority !== 'medium' && <Badge tone={PRIORITY_META[t.priority].tone}>{PRIORITY_META[t.priority].label}</Badge>}
                        {t.due_date && <span className="shrink-0 text-xs text-muted-foreground tabular">{dayLabel(t.due_date)}</span>}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
      <TaskDialog task={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

// ─── Search ─────────────────────────────────────────────────────────────────
export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [text, setText] = React.useState(q)
  const { docs, loading } = useSearchIndex()
  const hits = React.useMemo(() => searchDocs(docs, q, 200), [docs, q])
  const groups = (['flip', 'spark', 'atlas'] as const).map((m) => ({ m, hits: hits.filter((h) => h.module === m) })).filter((g) => g.hits.length)
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Search" description="Search inventory, ideas, projects, tasks, places, trips and journal entries." />
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          setParams(text.trim() ? { q: text.trim() } : {})
        }}
        className="mb-5 flex gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={text} onChange={(e) => setText(e.target.value)} className="h-10 pl-9" placeholder="Search everything" aria-label="Search everything" autoFocus />
        </div>
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>
      {!q ? (
        <p className="text-sm text-muted-foreground">
          Tip: press <kbd className="rounded border border-border px-1 font-mono text-xs">⌘K</kbd> anywhere to search and jump straight to a result.
        </p>
      ) : loading ? (
        <ListSkeleton rows={4} />
      ) : hits.length === 0 ? (
        <EmptyState icon={Search} title={`No results for “${q}”`} description="Try fewer or different words. Every word must appear somewhere in the item." />
      ) : (
        <div className="grid gap-5">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {hits.length} result{hits.length === 1 ? '' : 's'} for “{q}”
          </p>
          {groups.map((g) => (
            <section key={g.m} className={`module-${g.m}`}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <ModuleDot module={g.m} /> {MODULE_META[g.m].label}
              </h2>
              <ul className="grid grid-cols-1 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {g.hits.map((h) => (
                  <li key={h.id}>
                    <Link to={h.to} className="flex min-w-0 items-center gap-3 px-3 py-2.5 hover:bg-surface-2/60">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{h.title}</span>
                        {h.subtitle && <span className="block truncate text-xs text-muted-foreground">{h.subtitle}</span>}
                      </span>
                      <Badge tone="outline">{h.kind}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Notifications ──────────────────────────────────────────────────────────
export function NotificationsPage() {
  const notifications = useRows('notifications', { limit: 300 })
  const markAll = useMarkAllRead()
  const backend = useBackend()
  const qc = useQueryClient()
  const [filter, setFilter] = React.useState<'all' | 'unread'>('all')
  const all = notifications.data ?? []
  const list = filter === 'unread' ? all.filter((n) => !n.read_at) : all
  const clearRead = async () => {
    for (const n of all.filter((x) => x.read_at)) await backend.remove('notifications', n.id)
    invalidate(qc, backend, ['notifications'])
  }
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Notifications"
        description="Sales, upcoming trips, due tasks and other updates from your workspaces."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => markAll(all)} disabled={!all.some((n) => !n.read_at)}>
              <CheckCheck /> Mark all read
            </Button>
            <Button variant="ghost" size="sm" onClick={clearRead} disabled={!all.some((n) => n.read_at)}>
              <Trash /> Clear read
            </Button>
          </>
        }
      />
      <div className="mb-3">
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All (${all.length})` },
            { value: 'unread', label: `Unread (${all.filter((n) => !n.read_at).length})` },
          ]}
        />
      </div>
      {notifications.isLoading ? (
        <ListSkeleton rows={4} />
      ) : list.length === 0 ? (
        <EmptyState icon={Bell} title="You’re all caught up" description={`Notifications appear when you sell an item, a trip is coming up or a task is due. Today is ${dayLabel(todayISO())}.`} />
      ) : (
        <Card className="p-1.5">
          <NotificationList rows={list} />
        </Card>
      )}
    </div>
  )
}
