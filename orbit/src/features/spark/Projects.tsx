import { CalendarDays, Compass, Plus, Rocket, Tag } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router'
import { useUI } from '@/app/ui-context'
import { Button } from '@/components/ui/button'
import { Badge, DemoBadge, EmptyState, ErrorState, ListSkeleton, PageHeader, Progress, Segmented } from '@/components/ui/misc'
import { FavouriteButton } from '@/features/shared/bits'
import { useRows, useTable } from '@/lib/data'
import { daysUntil, shortDate } from '@/lib/format'
import type { SparkProject } from '@/lib/types'
import { PROJECT_COLORS, PROJECT_STATUS_META } from './meta'

type Filter = 'current' | 'completed' | 'archived' | 'all'

export function ProjectsPage() {
  const projects = useRows('spark_projects')
  const tasks = useRows('spark_tasks')
  const milestones = useRows('spark_milestones')
  const trips = useRows('atlas_trips')
  const { update } = useTable('spark_projects')
  const { open } = useUI()
  const [filter, setFilter] = React.useState<Filter>('current')

  const list = (projects.data ?? [])
    .filter((p) => (filter === 'all' ? true : filter === 'current' ? ['planning', 'active', 'paused'].includes(p.status) : p.status === filter))
    .sort((a, b) => Number(b.favourite) - Number(a.favourite) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))

  const stats = (p: SparkProject) => {
    const t = (tasks.data ?? []).filter((x) => x.project_id === p.id)
    const done = t.filter((x) => x.status === 'completed').length
    const m = (milestones.data ?? []).filter((x) => x.project_id === p.id)
    const next = m.filter((x) => !x.done).sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))[0]
    return { total: t.length, done, pct: t.length ? (done / t.length) * 100 : 0, next }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Spark"
        title="Projects"
        description="Each project has its own task board, milestones, calendar, notes, files and roadmap."
        actions={
          <Button variant="accent" size="sm" onClick={() => open('new-project')}>
            <Plus /> New project
          </Button>
        }
      />
      <div className="mb-4">
        <Segmented
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'current', label: 'Current' },
            { value: 'completed', label: 'Completed' },
            { value: 'archived', label: 'Archived' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>
      {projects.isLoading ? (
        <ListSkeleton rows={4} />
      ) : projects.error ? (
        <ErrorState error={projects.error} onRetry={() => projects.refetch()} />
      ) : (projects.data ?? []).length === 0 ? (
        <EmptyState icon={Rocket} title="No projects yet" description="Start one from scratch, or open an idea and choose “Turn into project”." action={<Button variant="accent" onClick={() => open('new-project')}><Plus /> New project</Button>} />
      ) : list.length === 0 ? (
        <EmptyState icon={Rocket} title="Nothing in this view" description="Try another filter." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => {
            const s = stats(p)
            const d = daysUntil(p.due_date)
            const trip = trips.data?.find((t) => t.id === p.linked_trip_id)
            return (
              <div key={p.id} className="relative">
              <div className="absolute top-3 right-3 z-10">
                <FavouriteButton on={p.favourite} onToggle={() => update.mutate({ id: p.id, patch: { favourite: !p.favourite } })} label={p.name} />
              </div>
              <Link to={`/spark/projects/${p.id}`} className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-input">
                <div className="flex items-start gap-3 pr-8">
                  <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: PROJECT_COLORS[p.color] ?? PROJECT_COLORS.violet }} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium group-hover:underline">{p.name}</h3>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{p.description || 'No description yet.'}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Progress value={s.pct} />
                  <span className="shrink-0 text-xs text-muted-foreground tabular">
                    {s.done}/{s.total}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge tone={PROJECT_STATUS_META[p.status].tone}>{PROJECT_STATUS_META[p.status].label}</Badge>
                  {p.linked_flip && (
                    <Badge tone="flip">
                      <Tag /> Flip
                    </Badge>
                  )}
                  {trip && (
                    <Badge tone="atlas">
                      <Compass /> {trip.title}
                    </Badge>
                  )}
                  <DemoBadge show={p.is_demo} />
                  {p.due_date && (
                    <span className={`ml-auto inline-flex items-center gap-1 tabular ${d !== null && d < 0 && p.status !== 'completed' ? 'text-destructive' : ''}`}>
                      <CalendarDays className="size-3" /> {shortDate(p.due_date)}
                    </span>
                  )}
                </div>
                {s.next && <p className="mt-2 truncate text-xs text-muted-foreground">Next milestone: {s.next.title}</p>}
              </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
