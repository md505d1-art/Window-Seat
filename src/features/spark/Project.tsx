import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns3,
  Compass,
  Download,
  FileText,
  Flag,
  LayoutDashboard,
  List,
  Milestone as MilestoneIcon,
  NotebookPen,
  Paperclip,
  Plus,
  Route,
  Tag,
  Trash,
  Upload,
} from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useCrumbTitle, useUI } from '@/app/ui-context'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/inputs'
import { Badge, Card, CardHeader, DemoBadge, EmptyState, ErrorState, ListSkeleton, Progress, Segmented, StatTile, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc'
import { useBackend } from '@/features/auth/auth'
import { FavouriteButton, ModuleDot } from '@/features/shared/bits'
import { useUploader } from '@/features/shared/PhotoUploader'
import { useFileUrls, useLogActivity, useProfile, useRow, useRows, useTable } from '@/lib/data'
import { summarise } from '@/lib/finance'
import { dateRange, dayLabel, daysUntil, isoDate, money, relativeTime, shortDate, toDate } from '@/lib/format'
import { PROJECT_STATUSES, TASK_STATUSES, type SparkMilestone, type SparkProject, type SparkTask } from '@/lib/types'
import { cn, positionBetween } from '@/lib/utils'
import { Board } from './Board'
import { PROJECT_COLORS, PROJECT_STATUS_META, PRIORITY_META, SaveState, TASK_STATUS_META, useAutosave } from './meta'
import { TaskCard, TaskDialog, useTaskActions } from './TaskDialog'

type Tab = 'overview' | 'tasks' | 'milestones' | 'calendar' | 'notes' | 'files' | 'roadmap' | 'activity'

export function ProjectPage() {
  const { id } = useParams()
  const project = useRow('spark_projects', id)
  if (project.isLoading) return <ListSkeleton rows={5} />
  if (project.error) return <ErrorState error={project.error} onRetry={() => project.refetch()} />
  if (!project.data)
    return (
      <div className="py-16 text-center">
        <p className="font-medium">This project no longer exists.</p>
        <Button asChild variant="outline" className="mt-3">
          <Link to="/spark/projects">All projects</Link>
        </Button>
      </div>
    )
  return <ProjectWorkspace key={project.data.id} project={project.data} />
}

function ProjectWorkspace({ project }: { project: SparkProject }) {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'overview'
  const tasks = useRows('spark_tasks', { eq: { project_id: project.id }, order: [{ column: 'position', ascending: true }] })
  const milestones = useRows('spark_milestones', { eq: { project_id: project.id }, order: [{ column: 'position', ascending: true }] })
  const { update, remove } = useTable('spark_projects')
  const log = useLogActivity()
  const navigate = useNavigate()
  const [confirm, setConfirm] = React.useState(false)
  const [editing, setEditing] = React.useState<SparkTask | null>(null)
  useCrumbTitle(project.name)

  const t = tasks.data ?? []
  const m = milestones.data ?? []
  const done = t.filter((x) => x.status === 'completed').length
  const pct = t.length ? (done / t.length) * 100 : 0

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Button variant="ghost" size="icon-sm" asChild className="mt-0.5">
            <Link to="/spark/projects" aria-label="All projects">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
              <span className="size-3 shrink-0 rounded-full" style={{ background: PROJECT_COLORS[project.color] ?? PROJECT_COLORS.violet }} />
              <span className="truncate">{project.name}</span>
              <DemoBadge show={project.is_demo} />
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge tone={PROJECT_STATUS_META[project.status].tone}>{PROJECT_STATUS_META[project.status].label}</Badge>
              <span>{dateRange(project.start_date, project.due_date)}</span>
              <span className="tabular">
                {done}/{t.length} tasks done
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <FavouriteButton on={project.favourite} onToggle={() => update.mutate({ id: project.id, patch: { favourite: !project.favourite } })} label={project.name} />
          <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="Delete project" onClick={() => setConfirm(true)}>
            <Trash />
          </Button>
        </div>
      </div>
      <Progress value={pct} className="mb-4" />

      <Tabs value={tab} onValueChange={(v) => setParams(v === 'overview' ? {} : { tab: v }, { replace: true })}>
        <TabsList className="mb-5">
          <TabsTrigger value="overview">
            <LayoutDashboard /> Overview
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <Columns3 /> Tasks
          </TabsTrigger>
          <TabsTrigger value="milestones">
            <Flag /> Milestones
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays /> Calendar
          </TabsTrigger>
          <TabsTrigger value="roadmap">
            <Route /> Roadmap
          </TabsTrigger>
          <TabsTrigger value="notes">
            <NotebookPen /> Notes
          </TabsTrigger>
          <TabsTrigger value="files">
            <Paperclip /> Files
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Clock /> Activity
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Overview project={project} tasks={t} milestones={m} />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksTab project={project} tasks={t} loading={tasks.isLoading} onOpen={setEditing} />
        </TabsContent>
        <TabsContent value="milestones">
          <MilestonesTab project={project} milestones={m} tasks={t} />
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarTab project={project} tasks={t} milestones={m} onOpen={setEditing} />
        </TabsContent>
        <TabsContent value="roadmap">
          <RoadmapTab project={project} milestones={m} tasks={t} />
        </TabsContent>
        <TabsContent value="notes">
          <NotesTab project={project} />
        </TabsContent>
        <TabsContent value="files">
          <FilesTab project={project} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab project={project} />
        </TabsContent>
      </Tabs>

      <TaskDialog task={editing} onClose={() => setEditing(null)} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete “${project.name}”?`}
        description="Its tasks, milestones and canvases are deleted too. Ideas that became this project are kept. Set the status to Archived instead to keep everything."
        requireText={project.name.length <= 40 ? project.name : undefined}
        onConfirm={async () => {
          await remove.mutateAsync(project.id)
          log({ module: 'spark', action: 'deleted', entity_type: 'project', title: project.name })
          toast.success('Project deleted')
          navigate('/spark/projects')
        }}
      />
    </div>
  )
}

// ─── Overview ────────────────────────────────────────────────────────────────
function Overview({ project, tasks, milestones }: { project: SparkProject; tasks: SparkTask[]; milestones: SparkMilestone[] }) {
  const { update } = useTable('spark_projects')
  const trips = useRows('atlas_trips')
  const items = useRows('flip_items', undefined, project.linked_flip)
  const { data: profile } = useProfile()
  const activity = useRows('activity', { limit: 60 })
  const [draft, setDraft] = React.useState({
    name: project.name, description: project.description, status: project.status, kind: project.kind, color: project.color,
    start_date: project.start_date, due_date: project.due_date, linked_trip_id: project.linked_trip_id, linked_flip: project.linked_flip,
  })
  const state = useAutosave(draft, (d) => update.mutateAsync({ id: project.id, patch: { ...d, name: d.name.trim() || project.name } }))
  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const trip = trips.data?.find((t) => t.id === draft.linked_trip_id)
  const cur = profile?.currency ?? 'GBP'
  const flip = draft.linked_flip ? summarise(items.data ?? []) : null
  const open = tasks.filter((t) => t.status !== 'completed')
  const overdue = open.filter((t) => (daysUntil(t.due_date) ?? 1) < 0).length
  const nextMilestones = milestones.filter((m) => !m.done).slice(0, 3)
  const recent = (activity.data ?? []).filter((a) => a.link?.startsWith(`/spark/projects/${project.id}`) || a.entity_id === project.id).slice(0, 5)
  const datesInvalid = Boolean(draft.start_date && draft.due_date && draft.due_date < draft.start_date)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid min-w-0 content-start gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Open tasks" value={open.length} />
          <StatTile label="Overdue" value={<span className={overdue ? 'text-destructive' : ''}>{overdue}</span>} />
          <StatTile label="Milestones" value={`${milestones.filter((m) => m.done).length}/${milestones.length}`} />
          <StatTile label="Target" value={project.due_date ? shortDate(project.due_date) : '—'} hint={project.due_date ? `${daysUntil(project.due_date)} days` : undefined} />
        </div>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">About this project</h2>
            <SaveState state={state} />
          </div>
          <div className="mt-3 grid gap-3">
            <Field label="Name" htmlFor="p-name">
              <Input id="p-name" value={draft.name} onChange={(e) => set('name', e.target.value)} maxLength={200} />
            </Field>
            <Field label="Description" htmlFor="p-desc">
              <Textarea id="p-desc" rows={5} value={draft.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
          </div>
        </Card>
        {draft.linked_flip && flip && (
          <Card className="module-flip">
            <CardHeader title="Linked to Flip" description="Live figures from your reselling workspace" icon={Tag} action={<Link to="/flip/sales" className="text-xs font-medium text-muted-foreground hover:text-foreground">Open Flip</Link>} />
            <div className="grid grid-cols-2 gap-3 px-4 pb-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Net profit (all time)</p>
                <p className="font-semibold tabular">{money(flip.netProfit, cur)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sales</p>
                <p className="font-semibold tabular">{flip.salesCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Live listings</p>
                <p className="font-semibold tabular">{flip.activeListings}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stock value</p>
                <p className="font-semibold tabular">{money(flip.inventoryValue, cur)}</p>
              </div>
            </div>
          </Card>
        )}
        {trip && (
          <Card className="module-atlas">
            <CardHeader title={`Linked trip: ${trip.title}`} description={dateRange(trip.start_date, trip.end_date)} icon={Compass} action={<Link to={`/atlas/trips/${trip.id}`} className="text-xs font-medium text-muted-foreground hover:text-foreground">Open trip</Link>} />
            <p className="px-4 pb-4 text-sm text-muted-foreground">{trip.destination || 'No destination set'}</p>
          </Card>
        )}
        <Card>
          <CardHeader title="Next milestones" icon={MilestoneIcon} />
          <ul className="grid grid-cols-1 gap-1 px-4 pb-4 text-sm">
            {nextMilestones.length === 0 && <li className="text-muted-foreground">No open milestones.</li>}
            {nextMilestones.map((m) => (
              <li key={m.id} className="flex justify-between gap-2">
                <span className="truncate">{m.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{m.due_date ? dayLabel(m.due_date) : 'No date'}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="grid content-start gap-4">
        <Card className="grid gap-3 p-4">
          <Field label="Status" htmlFor="p-status">
            <Select id="p-status" value={draft.status} onChange={(e) => set('status', e.target.value as SparkProject['status'])}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_META[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" htmlFor="p-start">
              <Input id="p-start" type="date" value={draft.start_date ?? ''} onChange={(e) => set('start_date', e.target.value || null)} />
            </Field>
            <Field label="Target" htmlFor="p-due" error={datesInvalid ? 'Before the start date' : undefined}>
              <Input id="p-due" type="date" value={draft.due_date ?? ''} onChange={(e) => set('due_date', e.target.value || null)} />
            </Field>
          </div>
          <Field label="Colour" htmlFor="p-color">
            <div className="flex gap-2" id="p-color" role="radiogroup" aria-label="Project colour">
              {Object.entries(PROJECT_COLORS).map(([k, c]) => (
                <button
                  key={k}
                  role="radio"
                  aria-checked={draft.color === k}
                  aria-label={k}
                  onClick={() => set('color', k)}
                  className={cn('size-6 rounded-full ring-offset-2 ring-offset-surface', draft.color === k && 'ring-2 ring-foreground')}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
            <div>
              <p className="text-sm font-medium">Link to Flip</p>
              <p className="text-xs text-muted-foreground">Show reselling figures here and list this plan in Flip.</p>
            </div>
            <Checkbox checked={draft.linked_flip} onCheckedChange={(v) => setDraft((d) => ({ ...d, linked_flip: v === true, kind: v === true ? 'reselling' : d.kind === 'reselling' ? 'general' : d.kind }))} aria-label="Link to Flip" />
          </div>
          <Field label="Linked trip" htmlFor="p-trip">
            <Select id="p-trip" value={draft.linked_trip_id ?? ''} onChange={(e) => setDraft((d) => ({ ...d, linked_trip_id: e.target.value || null, kind: e.target.value ? 'travel' : d.kind === 'travel' ? 'general' : d.kind }))}>
              <option value="">No trip</option>
              {(trips.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>
        </Card>
        <Card>
          <CardHeader title="Recent activity" icon={Clock} />
          <ul className="grid grid-cols-1 gap-1 px-4 pb-4 text-sm">
            {recent.length === 0 && <li className="text-muted-foreground">No activity yet.</li>}
            {recent.map((a) => (
              <li key={a.id} className="truncate">
                <span className="text-muted-foreground">{a.action} </span>
                {a.title}
                <span className="ml-1 text-xs text-muted-foreground">· {relativeTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

// ─── Tasks ───────────────────────────────────────────────────────────────────
function QuickAdd({ project, status, onDone }: { project: SparkProject; status: SparkTask['status']; onDone?: () => void }) {
  const { create } = useTable('spark_tasks')
  const log = useLogActivity()
  const [title, setTitle] = React.useState('')
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (!title.trim()) return
        const t = await create.mutateAsync({ project_id: project.id, title: title.trim(), status, position: Date.now(), module: 'spark' })
        log({ module: 'spark', action: 'added task', entity_type: 'task', entity_id: t.id, title: t.title, link: `/spark/projects/${project.id}?tab=tasks` })
        setTitle('')
        onDone?.()
      }}
    >
      <label className="sr-only" htmlFor={`qa-${status}`}>
        Add a task to {TASK_STATUS_META[status].label}
      </label>
      <Input id={`qa-${status}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="+ Add task" className="h-8 border-dashed bg-transparent text-[13px]" maxLength={300} />
    </form>
  )
}

function TasksTab({ project, tasks, loading, onOpen }: { project: SparkProject; tasks: SparkTask[]; loading: boolean; onOpen: (t: SparkTask) => void }) {
  const actions = useTaskActions()
  const [view, setView] = React.useState<'board' | 'list'>('board')
  if (loading) return <ListSkeleton rows={4} />
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Drag cards between columns. With a keyboard, focus a card and press Space, move it with the arrow keys, then press Space again. Enter opens it.</p>
        <Segmented
          label="Task view"
          value={view}
          onChange={setView}
          options={[
            { value: 'board', label: 'Board', icon: Columns3 },
            { value: 'list', label: 'List', icon: List },
          ]}
        />
      </div>
      {view === 'board' ? (
        <Board
          label="Task board"
          columns={TASK_STATUSES.map((s) => ({ id: s, label: TASK_STATUS_META[s].label, tone: TASK_STATUS_META[s].tone }))}
          items={tasks}
          columnOf={(t) => t.status}
          positionOf={(t) => t.position}
          onMove={(t, status, position) => actions.move(t, status, position)}
          renderCard={(t) => <TaskCard task={t} onOpen={() => onOpen(t)} />}
          labelOf={(t) => t.title}
          footer={(status) => <QuickAdd project={project} status={status} />}
        />
      ) : tasks.length === 0 ? (
        <EmptyState icon={List} title="No tasks yet" description="Add the first one below." action={<div className="w-72"><QuickAdd project={project} status="todo" /></div>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="w-10 px-3 py-2" />
                <th className="px-2 py-2 font-medium">Task</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Priority</th>
                <th className="px-2 py-2 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {[...tasks]
                .sort((a, b) => TASK_STATUSES.indexOf(a.status) - TASK_STATUSES.indexOf(b.status) || a.position - b.position)
                .map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <Checkbox checked={t.status === 'completed'} onCheckedChange={() => actions.toggle(t)} aria-label={`Mark ${t.title} ${t.status === 'completed' ? 'not done' : 'done'}`} />
                    </td>
                    <td className="px-2 py-2">
                      <button className={cn('text-left hover:underline', t.status === 'completed' && 'text-muted-foreground line-through')} onClick={() => onOpen(t)}>
                        {t.title}
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      <Badge tone={TASK_STATUS_META[t.status].tone}>{TASK_STATUS_META[t.status].label}</Badge>
                    </td>
                    <td className="px-2 py-2">
                      <Badge tone={PRIORITY_META[t.priority].tone}>{PRIORITY_META[t.priority].label}</Badge>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground tabular">{t.due_date ? dayLabel(t.due_date) : '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div className="border-t border-border p-2">
            <QuickAdd project={project} status="todo" />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Milestones ──────────────────────────────────────────────────────────────
function MilestonesTab({ project, milestones, tasks }: { project: SparkProject; milestones: SparkMilestone[]; tasks: SparkTask[] }) {
  const { create, update, remove } = useTable('spark_milestones')
  const log = useLogActivity()
  const [title, setTitle] = React.useState('')
  const [due, setDue] = React.useState('')
  const [toDelete, setToDelete] = React.useState<SparkMilestone | null>(null)
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= milestones.length) return
    const target = milestones[j]
    const beyond = milestones[j + dir]
    const pos = positionBetween(dir === -1 ? beyond?.position : target.position, dir === -1 ? target.position : beyond?.position)
    update.mutate({ id: milestones[i].id, patch: { position: pos } })
  }
  return (
    <div className="grid gap-4">
      <form
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-surface p-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!title.trim()) return
          const last = milestones[milestones.length - 1]
          const m = await create.mutateAsync({ project_id: project.id, title: title.trim(), due_date: due || null, position: (last?.position ?? 0) + 1000 })
          log({ module: 'spark', action: 'added milestone', entity_type: 'milestone', entity_id: m.id, title: m.title, link: `/spark/projects/${project.id}?tab=milestones` })
          setTitle('')
          setDue('')
        }}
      >
        <Field label="New milestone" htmlFor="ms-title" className="min-w-0 flex-1 basis-56">
          <Input id="ms-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. First version live" maxLength={300} />
        </Field>
        <Field label="Due" htmlFor="ms-due">
          <Input id="ms-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Button type="submit" variant="accent" disabled={!title.trim()}>
          <Plus /> Add
        </Button>
      </form>
      {milestones.length === 0 ? (
        <EmptyState icon={Flag} title="No milestones yet" description="Break the project into a few checkpoints. Tasks can be attached to each one." />
      ) : (
        <ol className="grid grid-cols-1 gap-2">
          {milestones.map((m, i) => {
            const mt = tasks.filter((t) => t.milestone_id === m.id)
            const md = mt.filter((t) => t.status === 'completed').length
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <Checkbox checked={m.done} onCheckedChange={(v) => update.mutate({ id: m.id, patch: { done: v === true } })} aria-label={`Mark ${m.title} ${m.done ? 'not reached' : 'reached'}`} />
                <div className="min-w-0 flex-1 basis-48">
                  <input
                    aria-label="Milestone title"
                    defaultValue={m.title}
                    onBlur={(e) => e.target.value.trim() && e.target.value !== m.title && update.mutate({ id: m.id, patch: { title: e.target.value.trim() } })}
                    className={cn('w-full bg-transparent text-sm font-medium outline-none', m.done && 'text-muted-foreground line-through')}
                  />
                  <div className="mt-1 flex items-center gap-2">
                    <Progress value={mt.length ? (md / mt.length) * 100 : 0} className="max-w-48" />
                    <span className="text-xs text-muted-foreground tabular">
                      {md}/{mt.length} tasks
                    </span>
                  </div>
                </div>
                <Input
                  type="date"
                  aria-label={`Due date for ${m.title}`}
                  value={m.due_date ?? ''}
                  onChange={(e) => update.mutate({ id: m.id, patch: { due_date: e.target.value || null } })}
                  className="w-40"
                />
                <div className="flex">
                  <Button variant="ghost" size="icon-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => move(i, 1)} disabled={i === milestones.length - 1} aria-label="Move down">
                    <ArrowDown />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setToDelete(m)} aria-label={`Delete ${m.title}`}>
                    <Trash />
                  </Button>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete this milestone?"
        description="Tasks attached to it are kept and simply lose the milestone."
        onConfirm={async () => {
          if (toDelete) await remove.mutateAsync(toDelete.id)
        }}
      />
    </div>
  )
}

// ─── Calendar ────────────────────────────────────────────────────────────────
function CalendarTab({ project, tasks, milestones, onOpen }: { project: SparkProject; tasks: SparkTask[]; milestones: SparkMilestone[]; onOpen: (t: SparkTask) => void }) {
  const { open } = useUI()
  const [month, setMonth] = React.useState(() => startOfMonth(toDate(tasks.find((t) => t.due_date)?.due_date) ?? new Date()))
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
  const undated = tasks.filter((t) => !t.due_date && t.status !== 'completed').length
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{format(month, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => setMonth(subMonths(month, 1))} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface scrollbar-thin">
        <div className="grid min-w-[700px] grid-cols-7">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div key={d} className="border-b border-border px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const iso = isoDate(day)
            const dayTasks = tasks.filter((t) => t.due_date === iso)
            const dayMs = milestones.filter((m) => m.due_date === iso)
            return (
              <div key={iso} className={cn('group min-h-24 border-r border-b border-border p-1.5 [&:nth-child(7n)]:border-r-0', !isSameMonth(day, month) && 'bg-background/40')}>
                <div className="flex items-center justify-between">
                  <span className={cn('grid size-6 place-items-center rounded-full text-xs tabular', isToday(day) && 'bg-accent-fill font-semibold text-white', !isSameMonth(day, month) && 'text-muted-foreground')}>
                    {format(day, 'd')}
                  </span>
                  <button
                    className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus:opacity-100"
                    aria-label={`Add task on ${format(day, 'd MMMM')}`}
                    onClick={() => open('new-task', { projectId: project.id, dueDate: iso })}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <div className="mt-1 grid gap-1">
                  {dayMs.map((m) => (
                    <div key={m.id} className="flex items-center gap-1 truncate rounded bg-[color-mix(in_oklab,var(--spark)_16%,transparent)] px-1.5 py-0.5 text-[11px] font-medium text-spark-text" title={`Milestone: ${m.title}`}>
                      <Flag className="size-3 shrink-0" /> {m.title}
                    </div>
                  ))}
                  {dayTasks.map((t) => (
                    <button key={t.id} onClick={() => onOpen(t)} className={cn('truncate rounded bg-surface-2 px-1.5 py-0.5 text-left text-[11px] hover:bg-input', t.status === 'completed' && 'text-muted-foreground line-through')} title={t.title}>
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {undated > 0 && <p className="mt-2 text-xs text-muted-foreground">{undated} open task{undated === 1 ? ' has' : 's have'} no due date and {undated === 1 ? 'isn’t' : 'aren’t'} shown.</p>}
    </div>
  )
}

// ─── Roadmap ─────────────────────────────────────────────────────────────────
function RoadmapTab({ project, milestones, tasks }: { project: SparkProject; milestones: SparkMilestone[]; tasks: SparkTask[] }) {
  const dated = milestones.filter((m) => m.due_date)
  const startD = toDate(project.start_date) ?? toDate([...dated].sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0]?.due_date) ?? new Date()
  const lastMs = toDate([...dated].sort((a, b) => b.due_date!.localeCompare(a.due_date!))[0]?.due_date)
  let endD = toDate(project.due_date) ?? lastMs ?? addMonths(startD, 1)
  if (lastMs && lastMs > endD) endD = lastMs
  if (endD <= startD) endD = addMonths(startD, 1)
  const span = endD.getTime() - startD.getTime()
  const at = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - startD.getTime()) / span) * 100))
  const months = eachDayOfInterval({ start: startD, end: endD }).filter((d) => d.getDate() === 1)
  const today = new Date()

  if (milestones.length === 0)
    return <EmptyState icon={Route} title="No roadmap yet" description="Add milestones with due dates on the Milestones tab and they’ll appear here on a timeline." />

  return (
    <div className="grid gap-4">
      <Card className="overflow-x-auto p-4 scrollbar-thin">
        <div className="relative mx-14 min-w-[560px] pt-6 pb-20">
          <div className="absolute inset-x-0 top-10 h-1.5 rounded-full bg-surface-2" />
          {today >= startD && today <= endD && (
            <div className="absolute top-6 bottom-12 w-px bg-accent" style={{ left: `${at(today)}%` }}>
              <span className="absolute -top-5 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap text-accent-text">Today</span>
            </div>
          )}
          {months.map((d) => (
            <span key={d.toISOString()} className="absolute top-14 -translate-x-1/2 text-[10px] text-muted-foreground" style={{ left: `${at(d)}%` }}>
              {format(d, 'MMM')}
            </span>
          ))}
          <span className="absolute top-0 left-0 -translate-x-1/2 text-[10px] whitespace-nowrap text-muted-foreground">{format(startD, 'd MMM yyyy')}</span>
          <span className="absolute top-0 right-0 translate-x-1/2 text-[10px] whitespace-nowrap text-muted-foreground">{format(endD, 'd MMM yyyy')}</span>
          {dated.map((m, i) => (
            <div key={m.id} className="absolute top-8 -translate-x-1/2" style={{ left: `${at(toDate(m.due_date)!)}%` }}>
              <span className={cn('block size-4 rounded-full border-2 border-surface', m.done ? 'bg-success' : 'bg-spark')} title={m.title} />
              <span className={cn('absolute left-1/2 w-28 -translate-x-1/2 text-center text-[11px] leading-tight', i % 2 ? 'top-14' : 'top-9')}>
                <span className="block truncate font-medium">{m.title}</span>
                <span className="text-muted-foreground">{format(toDate(m.due_date)!, 'd MMM')}</span>
              </span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title="Phases" description="Milestones in order, with the tasks attached to each" />
        <ol className="grid grid-cols-1 gap-3 px-4 pb-4">
          {milestones.map((m, i) => {
            const mt = tasks.filter((t) => t.milestone_id === m.id)
            const md = mt.filter((t) => t.status === 'completed').length
            return (
              <li key={m.id} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[10px] tabular">{i + 1}</span>
                    <span className={cn('truncate', m.done && 'text-muted-foreground line-through')}>{m.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{m.due_date ? shortDate(m.due_date) : 'No date'}</span>
                </div>
                <Progress value={m.done ? 100 : mt.length ? (md / mt.length) * 100 : 0} />
              </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}

// ─── Notes, files, activity ─────────────────────────────────────────────────
function NotesTab({ project }: { project: SparkProject }) {
  const { update } = useTable('spark_projects')
  const [notes, setNotes] = React.useState(project.notes)
  const state = useAutosave(notes, (n) => update.mutateAsync({ id: project.id, patch: { notes: n } }))
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Project notes</h2>
        <SaveState state={state} />
      </div>
      <Textarea aria-label="Project notes" rows={18} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Meeting notes, research, decisions… saved as you type." className="font-mono text-[13px]" />
    </Card>
  )
}

function FilesTab({ project }: { project: SparkProject }) {
  const files = useRows('files', { eq: { entity_type: 'project', entity_id: project.id } })
  const { create, remove } = useTable('files')
  const { upload, busy } = useUploader('spark')
  const backend = useBackend()
  const log = useLogActivity()
  const urls = useFileUrls((files.data ?? []).map((f) => f.path))
  const input = React.useRef<HTMLInputElement>(null)
  const [toDelete, setToDelete] = React.useState<(typeof files.data & object)[number] | null>(null)
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="accent" size="sm" loading={busy} onClick={() => input.current?.click()}>
          <Upload /> Upload files
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          className="sr-only"
          aria-label="Upload project files"
          onChange={async (e) => {
            const list = Array.from(e.target.files ?? [])
            e.target.value = ''
            const paths = await upload(list)
            for (let i = 0; i < paths.length; i++) {
              await create.mutateAsync({ module: 'spark', entity_type: 'project', entity_id: project.id, path: paths[i], name: list[i].name, mime: list[i].type || 'application/octet-stream', size: list[i].size })
            }
            if (paths.length) {
              log({ module: 'spark', action: 'uploaded', entity_type: 'file', title: `${paths.length} file${paths.length === 1 ? '' : 's'} to ${project.name}`, link: `/spark/projects/${project.id}?tab=files` })
              toast.success(`Uploaded ${paths.length} file${paths.length === 1 ? '' : 's'}`)
            }
          }}
        />
      </div>
      {files.isLoading ? (
        <ListSkeleton rows={3} />
      ) : (files.data ?? []).length === 0 ? (
        <EmptyState icon={Paperclip} title="No files yet" description="Upload briefs, images, spreadsheets — anything this project needs. Files are private to your account." />
      ) : (
        <ul className="grid grid-cols-1 divide-y divide-border rounded-2xl border border-border bg-surface">
          {(files.data ?? []).map((f) => (
            <li key={f.id} className="flex min-w-0 items-center gap-3 px-3 py-2.5">
              {f.mime.startsWith('image/') && urls.data?.[f.path] ? <img src={urls.data[f.path]} alt="" className="size-9 rounded-lg object-cover" /> : <FileText className="size-5 shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{f.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {Math.max(1, Math.round(f.size / 1024))} KB · {relativeTime(f.created_at)}
                </span>
              </span>
              {urls.data?.[f.path] && (
                <Button variant="ghost" size="icon-sm" asChild>
                  <a href={urls.data[f.path]} target="_blank" rel="noreferrer" download={f.name} aria-label={`Download ${f.name}`}>
                    <Download />
                  </a>
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setToDelete(f)} aria-label={`Delete ${f.name}`}>
                <Trash />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        description="The file is removed from your storage permanently."
        onConfirm={async () => {
          if (!toDelete) return
          await remove.mutateAsync(toDelete.id)
          backend.removeFiles([toDelete.path]).catch(() => undefined)
        }}
      />
    </div>
  )
}

function ActivityTab({ project }: { project: SparkProject }) {
  const activity = useRows('activity', { limit: 300 })
  const list = (activity.data ?? []).filter((a) => a.link?.startsWith(`/spark/projects/${project.id}`) || a.entity_id === project.id)
  if (activity.isLoading) return <ListSkeleton rows={4} />
  if (!list.length) return <EmptyState icon={Clock} title="No activity yet" description="Changes to tasks, milestones and files will be listed here." />
  return (
    <ol className="relative grid gap-4 border-l border-border pl-5">
      {list.map((a) => (
        <li key={a.id} className="relative">
          <ModuleDot module={a.module} className="absolute top-1.5 -left-[24px] size-2.5 ring-4 ring-background" />
          <p className="text-sm">
            <span className="text-muted-foreground">{a.action[0].toUpperCase() + a.action.slice(1)} </span>
            {a.title}
          </p>
          <p className="text-xs text-muted-foreground">{format(new Date(a.created_at), 'd MMM yyyy, HH:mm')}</p>
        </li>
      ))}
    </ol>
  )
}
