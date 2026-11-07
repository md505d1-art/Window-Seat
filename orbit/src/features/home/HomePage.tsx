import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChartColumn,
  Clock,
  Lightbulb,
  ListChecks,
  MapPin,
  Package,
  Plane,
  Rocket,
  SlidersHorizontal,
  Star,
  WandSparkles,
  Zap,
} from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import { Bar, BarChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis } from 'recharts'
import { useUI } from '@/app/ui-context'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/inputs'
import { Card, CardHeader, DemoBadge, Progress, Skeleton } from '@/components/ui/misc'
import { ModuleDot } from '@/features/shared/bits'
import { useWorkspaces } from '@/features/shared/workspaces'
import { useLogActivity, useProfile, useRows, useTable } from '@/lib/data'
import { monthly, summarise } from '@/lib/finance'
import { dateRange, dayLabel, daysUntil, money, relativeTime, todayISO } from '@/lib/format'
import type { ModuleId, SparkTask } from '@/lib/types'
import { cn } from '@/lib/utils'
import { resolveWidgets, WIDGET_INFO } from './CustomiseDashboard'
import { format, startOfMonth } from 'date-fns'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function WidgetShell({ module, children, className }: { module?: ModuleId; children: React.ReactNode; className?: string }) {
  return <Card className={cn(module && `module-${module}`, 'flex min-w-0 flex-col', className)}>{children}</Card>
}

function SeeAll({ to, label = 'View all' }: { to: string; label?: string }) {
  return (
    <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
      {label} <ArrowRight className="size-3" />
    </Link>
  )
}

function QuickActions() {
  const navigate = useNavigate()
  const { open } = useUI()
  const ws = useWorkspaces()
  const actions = [
    ws.flip && { label: 'Add item', icon: Package, color: 'var(--flip)', run: () => navigate('/flip/items/new') },
    ws.flip && { label: 'Write a listing', icon: WandSparkles, color: 'var(--flip)', run: () => navigate('/flip/listing') },
    ws.spark && { label: 'Capture idea', icon: Lightbulb, color: 'var(--spark)', run: () => open('capture-idea') },
    ws.spark && { label: 'New project', icon: Rocket, color: 'var(--spark)', run: () => open('new-project') },
    { label: 'New task', icon: ListChecks, color: 'var(--primary)', run: () => open('new-task') },
    ws.atlas && { label: 'Plan a trip', icon: Plane, color: 'var(--atlas)', run: () => open('new-trip') },
    ws.atlas && { label: 'Journal entry', icon: BookOpen, color: 'var(--atlas)', run: () => navigate('/atlas/journal?new=1') },
  ].filter(Boolean) as { label: string; icon: typeof Package; color: string; run: () => void }[]
  return (
    <WidgetShell className="lg:col-span-2">
      <CardHeader title="Quick actions" icon={Zap} />
      <div className="grid grid-cols-2 gap-2 p-4 pt-1 sm:grid-cols-4">
        {actions.map((a) => (
          <button
            key={a.label}
            onClick={a.run}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-background/40 p-2.5 text-left text-[13px] font-medium transition-colors hover:border-input hover:bg-surface-2"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${a.color} 15%, transparent)`, color: a.color }}>
              <a.icon className="size-3.5" />
            </span>
            <span className="truncate">{a.label}</span>
          </button>
        ))}
      </div>
    </WidgetShell>
  )
}

function UpcomingTasks() {
  const tasks = useRows('spark_tasks')
  const projects = useRows('spark_projects')
  const items = useRows('flip_items')
  const ws = useWorkspaces()
  const { update } = useTable('spark_tasks')
  const log = useLogActivity()
  const open = (tasks.data ?? [])
    .filter((t) => t.status !== 'completed')
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || b.position - a.position)
    .slice(0, 6)
  const ready = (items.data ?? []).filter((i) => i.status === 'ready').length
  const projectName = (id: string | null) => projects.data?.find((p) => p.id === id)?.name
  const complete = (t: SparkTask) => {
    update.mutate({ id: t.id, patch: { status: 'completed', completed_at: new Date().toISOString() } })
    log({ module: t.module === 'general' ? 'orbit' : t.module, action: 'completed', entity_type: 'task', entity_id: t.id, title: t.title, link: t.project_id ? `/spark/projects/${t.project_id}?tab=tasks` : '/tasks' })
  }
  return (
    <WidgetShell>
      <CardHeader title="Upcoming tasks" icon={ListChecks} action={<SeeAll to="/tasks" />} />
      <div className="grid gap-1 px-2 pb-3">
        {tasks.isLoading ? (
          <div className="grid gap-2 px-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : open.length === 0 && !ready ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">Nothing due. Add a task with the New button.</p>
        ) : (
          <>
            {ws.flip && ready > 0 && (
              <Link to="/flip?status=ready" className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                <ModuleDot module="flip" />
                <span className="flex-1">
                  List {ready} item{ready === 1 ? '' : 's'} marked ready to list
                </span>
              </Link>
            )}
            {open.map((t) => {
              const d = daysUntil(t.due_date)
              return (
                <div key={t.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                  <Checkbox checked={false} onCheckedChange={() => complete(t)} aria-label={`Complete ${t.title}`} />
                  <Link to={t.project_id ? `/spark/projects/${t.project_id}?tab=tasks` : '/tasks'} className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{t.title}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{projectName(t.project_id) ?? (t.module === 'general' ? 'General' : t.module)}</span>
                  </Link>
                  {t.due_date && (
                    <span className={cn('shrink-0 text-xs tabular', d !== null && d < 0 ? 'text-destructive' : d === 0 ? 'text-warning' : 'text-muted-foreground')}>
                      {d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d !== null && d < 0 ? `${-d}d late` : dayLabel(t.due_date)}
                    </span>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </WidgetShell>
  )
}

function FlipPerformance() {
  const items = useRows('flip_items')
  const { data: profile } = useProfile()
  const cur = profile?.currency ?? 'GBP'
  const from = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const month = summarise(items.data ?? [], { from, to: todayISO() })
  const all = summarise(items.data ?? [])
  const series = monthly(items.data ?? [], 6)
  return (
    <WidgetShell module="flip">
      <CardHeader title="Reselling performance" description={format(new Date(), 'MMMM yyyy')} icon={ChartColumn} action={<SeeAll to="/flip/sales" label="Report" />} />
      {items.isLoading ? (
        <Skeleton className="m-4 h-32" />
      ) : (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-lg font-semibold tabular">{money(month.grossRevenue, cur)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net profit</p>
              <p className={cn('text-lg font-semibold tabular', month.netProfit < 0 && 'text-destructive')}>{money(month.netProfit, cur)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sales</p>
              <p className="text-lg font-semibold tabular">{month.salesCount}</p>
            </div>
          </div>
          <div className="mt-3 h-24" aria-label="Net profit, last six months" role="img">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                <ChartTooltip
                  cursor={{ fill: 'var(--surface-2)' }}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                  formatter={(v) => [money(Number(v), cur), 'Net profit']}
                />
                <Bar dataKey="profit" fill="var(--flip)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {all.activeListings} live listing{all.activeListings === 1 ? '' : 's'} · {all.unsoldCount} unsold item{all.unsoldCount === 1 ? '' : 's'} worth {money(all.inventoryValue, cur)}
          </p>
        </div>
      )}
    </WidgetShell>
  )
}

function ActiveProjects() {
  const projects = useRows('spark_projects')
  const tasks = useRows('spark_tasks')
  const list = (projects.data ?? []).filter((p) => p.status === 'active' || p.status === 'planning').slice(0, 4)
  return (
    <WidgetShell module="spark">
      <CardHeader title="Active projects" icon={Rocket} action={<SeeAll to="/spark/projects" />} />
      <div className="grid gap-3 px-4 pb-4">
        {projects.isLoading ? (
          <Skeleton className="h-16" />
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active projects. Turn an idea into one from Spark.</p>
        ) : (
          list.map((p) => {
            const pt = (tasks.data ?? []).filter((t) => t.project_id === p.id)
            const done = pt.filter((t) => t.status === 'completed').length
            const pct = pt.length ? (done / pt.length) * 100 : 0
            return (
              <Link key={p.id} to={`/spark/projects/${p.id}`} className="group grid gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 truncate text-sm font-medium group-hover:underline">
                    {p.name} <DemoBadge show={p.is_demo} />
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular">
                    {done}/{pt.length}
                  </span>
                </div>
                <Progress value={pct} />
              </Link>
            )
          })
        )}
      </div>
    </WidgetShell>
  )
}

function UpcomingTrips() {
  const trips = useRows('atlas_trips', { order: [{ column: 'start_date', ascending: true }] })
  const checklist = useRows('atlas_checklist')
  const stops = useRows('atlas_stops')
  const today = todayISO()
  const list = (trips.data ?? []).filter((t) => (t.end_date ?? t.start_date ?? '9999') >= today).slice(0, 3)
  return (
    <WidgetShell module="atlas">
      <CardHeader title="Upcoming trips" icon={Plane} action={<SeeAll to="/atlas/trips" />} />
      <div className="grid gap-3 px-4 pb-4">
        {trips.isLoading ? (
          <Skeleton className="h-16" />
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trips planned yet.</p>
        ) : (
          list.map((t) => {
            const d = daysUntil(t.start_date)
            const items = (checklist.data ?? []).filter((c) => c.trip_id === t.id)
            const done = items.filter((c) => c.done).length
            const next = (stops.data ?? [])
              .filter((s) => s.trip_id === t.id && (s.day ?? '') >= today)
              .sort((a, b) => (a.day ?? '').localeCompare(b.day ?? '') || a.position - b.position)[0]
            return (
              <Link key={t.id} to={`/atlas/trips/${t.id}`} className="group rounded-xl border border-border p-3 transition-colors hover:border-input">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {t.title} <DemoBadge show={t.is_demo} />
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{dateRange(t.start_date, t.end_date)}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-[color-mix(in_oklab,var(--atlas)_14%,transparent)] px-2 py-1 text-xs font-semibold text-atlas-text tabular">
                    {d === null ? 'No date' : d <= 0 ? 'Now' : `${d}d`}
                  </span>
                </div>
                {items.length > 0 && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <Progress value={(done / items.length) * 100} />
                    <span className="shrink-0 text-[11px] text-muted-foreground tabular">
                      {done}/{items.length} packed
                    </span>
                  </div>
                )}
                {next && (
                  <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <CalendarDays className="size-3" /> Next: {next.title} · {dayLabel(next.day)}
                  </p>
                )}
              </Link>
            )
          })
        )}
      </div>
    </WidgetShell>
  )
}

function SavedDestinations() {
  const places = useRows('atlas_places')
  const want = (places.data ?? []).filter((p) => p.status === 'want').sort((a, b) => Number(b.favourite) - Number(a.favourite))
  const visited = (places.data ?? []).filter((p) => p.status === 'visited').length
  return (
    <WidgetShell module="atlas">
      <CardHeader title="Saved destinations" description={`${want.length} to visit · ${visited} visited`} icon={MapPin} action={<SeeAll to="/atlas/map" label="Map" />} />
      <ul className="grid grid-cols-1 gap-0.5 px-2 pb-3">
        {places.isLoading ? (
          <li><Skeleton className="mx-2 h-16" /></li>
        ) : want.length === 0 ? (
          <li className="px-2 text-sm text-muted-foreground">Search for places in Atlas to save them here.</li>
        ) : (
          want.slice(0, 5).map((p) => (
            <li key={p.id}>
              <Link to={`/atlas?place=${p.id}`} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                <MapPin className="size-3.5 text-atlas-text" />
                <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                <span className="truncate text-xs text-muted-foreground">{[p.city, p.country].filter(Boolean).join(', ')}</span>
                {p.favourite && <Star className="size-3 text-amber-400" fill="currentColor" aria-label="Favourite" />}
              </Link>
            </li>
          ))
        )}
      </ul>
    </WidgetShell>
  )
}

function RecentActivity() {
  const activity = useRows('activity', { limit: 8 })
  return (
    <WidgetShell>
      <CardHeader title="Recent activity" icon={Clock} />
      <ul className="grid grid-cols-1 gap-0.5 px-2 pb-3">
        {activity.isLoading ? (
          <li><Skeleton className="mx-2 h-16" /></li>
        ) : (activity.data ?? []).length === 0 ? (
          <li className="px-2 text-sm text-muted-foreground">Your recent changes will appear here.</li>
        ) : (
          (activity.data ?? []).map((a) => {
            const body = (
              <>
                <ModuleDot module={a.module} />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="text-muted-foreground">{a.action[0].toUpperCase() + a.action.slice(1)} </span>
                  {a.title}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(a.created_at)}</span>
              </>
            )
            return (
              <li key={a.id}>
                {a.link ? (
                  <Link to={a.link} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2.5 px-2 py-1.5">{body}</div>
                )}
              </li>
            )
          })
        )}
      </ul>
    </WidgetShell>
  )
}

function Favourites() {
  const ws = useWorkspaces()
  const items = useRows('flip_items', { eq: { favourite: true } }, ws.flip)
  const ideas = useRows('spark_ideas', { eq: { favourite: true } }, ws.spark)
  const projects = useRows('spark_projects', { eq: { favourite: true } }, ws.spark)
  const places = useRows('atlas_places', { eq: { favourite: true } }, ws.atlas)
  const trips = useRows('atlas_trips', { eq: { favourite: true } }, ws.atlas)
  const journal = useRows('atlas_journal', { eq: { favourite: true } }, ws.atlas)
  const list = [
    ...(ws.flip ? (items.data ?? []).map((i) => ({ id: i.id, module: 'flip' as const, title: i.title || i.sku, kind: 'Item', to: `/flip/items/${i.id}` })) : []),
    ...(ws.spark ? (projects.data ?? []).map((p) => ({ id: p.id, module: 'spark' as const, title: p.name, kind: 'Project', to: `/spark/projects/${p.id}` })) : []),
    ...(ws.spark ? (ideas.data ?? []).filter((i) => !i.archived).map((i) => ({ id: i.id, module: 'spark' as const, title: i.title, kind: 'Idea', to: `/spark/ideas/${i.id}` })) : []),
    ...(ws.atlas ? (trips.data ?? []).map((t) => ({ id: t.id, module: 'atlas' as const, title: t.title, kind: 'Trip', to: `/atlas/trips/${t.id}` })) : []),
    ...(ws.atlas ? (places.data ?? []).map((p) => ({ id: p.id, module: 'atlas' as const, title: p.name, kind: 'Place', to: `/atlas?place=${p.id}` })) : []),
    ...(ws.atlas ? (journal.data ?? []).map((j) => ({ id: j.id, module: 'atlas' as const, title: j.title, kind: 'Memory', to: `/atlas/journal?entry=${j.id}` })) : []),
  ]
  return (
    <WidgetShell>
      <CardHeader title="Favourites" icon={Star} />
      <ul className="grid grid-cols-1 gap-0.5 px-2 pb-3">
        {list.length === 0 ? (
          <li className="px-2 text-sm text-muted-foreground">Star anything — items, ideas, trips, places — to pin it here.</li>
        ) : (
          list.slice(0, 8).map((f) => (
            <li key={f.module + f.id}>
              <Link to={f.to} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2">
                <ModuleDot module={f.module} />
                <span className="min-w-0 flex-1 truncate text-sm">{f.title}</span>
                <span className="text-[11px] text-muted-foreground">{f.kind}</span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </WidgetShell>
  )
}

const RENDER: Record<string, () => React.ReactElement> = {
  'quick-actions': QuickActions,
  'upcoming-tasks': UpcomingTasks,
  'flip-performance': FlipPerformance,
  'active-projects': ActiveProjects,
  'upcoming-trips': UpcomingTrips,
  'saved-destinations': SavedDestinations,
  'recent-activity': RecentActivity,
  favourites: Favourites,
}

export function HomePage() {
  const { data: profile } = useProfile()
  const { open } = useUI()
  const ws = useWorkspaces()
  const widgets = resolveWidgets(profile?.dashboard_widgets).filter((w) => {
    const m = WIDGET_INFO[w.id].module
    return w.visible && (!m || ws[m])
  })
  const name = profile?.display_name?.split(' ')[0]
  return (
    <div className="module-orbit">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{format(new Date(), 'EEEE d MMMM')}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-[28px]">
            {greeting()}
            {name ? `, ${name}` : ''}
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => open('customise-dashboard')}>
          <SlidersHorizontal /> Customise
        </Button>
      </div>
      {widgets.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          All widgets are hidden.{' '}
          <button className="font-medium text-foreground underline" onClick={() => open('customise-dashboard')}>
            Choose some to show
          </button>
          .
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {widgets.map((w) => {
            const C = RENDER[w.id]
            return <C key={w.id} />
          })}
        </div>
      )}
    </div>
  )
}
