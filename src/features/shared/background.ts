import { useEffect, useRef } from 'react'
import { useNotify, useRows } from '@/lib/data'
import { daysUntil, todayISO } from '@/lib/format'
import { useWorkspaces } from './workspaces'

/**
 * Creates time-based notifications when the app opens: trips starting within a week,
 * and tasks due today or overdue. Each is deduplicated so it appears once.
 */
export function useBackgroundNotifications() {
  const ws = useWorkspaces()
  const trips = useRows('atlas_trips', undefined, ws.atlas)
  const tasks = useRows('spark_tasks')
  const notify = useNotify()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current || !trips.isSuccess || !tasks.isSuccess) return
    ran.current = true
    const today = todayISO()
    for (const t of trips.data ?? []) {
      const d = daysUntil(t.start_date)
      if (d !== null && d >= 0 && d <= 7)
        notify({
          module: 'atlas',
          title: d === 0 ? `${t.title} starts today` : `${t.title} starts in ${d} day${d === 1 ? '' : 's'}`,
          body: 'Check your itinerary and travel checklist.',
          link: `/atlas/trips/${t.id}`,
          dedupe_key: `trip-soon:${t.id}:${t.start_date}`,
        })
    }
    for (const t of tasks.data ?? []) {
      if (t.status === 'completed' || !t.due_date) continue
      const d = daysUntil(t.due_date)
      if (d !== null && d <= 0)
        notify({
          module: t.module === 'flip' || t.module === 'atlas' ? t.module : 'spark',
          title: d === 0 ? `Due today: ${t.title}` : `Overdue: ${t.title}`,
          link: t.project_id ? `/spark/projects/${t.project_id}?tab=tasks` : '/tasks',
          dedupe_key: `task-due:${t.id}:${today}`,
        })
    }
  }, [trips.isSuccess, tasks.isSuccess, trips.data, tasks.data, notify])
}
