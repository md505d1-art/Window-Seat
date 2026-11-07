import { useMemo } from 'react'
import { useRows } from '@/lib/data'
import { type SearchDoc } from '@/lib/search-core'
import { useWorkspaces } from './workspaces'

export { searchDocs, type SearchDoc, type SearchHit } from '@/lib/search-core'

/** Builds the unified search index from every active workspace's data. */
export function useSearchIndex(): { docs: SearchDoc[]; loading: boolean } {
  const ws = useWorkspaces()
  const items = useRows('flip_items', undefined, ws.flip)
  const ideas = useRows('spark_ideas', undefined, ws.spark)
  const projects = useRows('spark_projects', undefined, ws.spark)
  const tasks = useRows('spark_tasks')
  const places = useRows('atlas_places', undefined, ws.atlas)
  const trips = useRows('atlas_trips', undefined, ws.atlas)
  const journal = useRows('atlas_journal', undefined, ws.atlas)

  const docs = useMemo<SearchDoc[]>(() => {
    const out: SearchDoc[] = []
    for (const i of items.data ?? [])
      out.push({
        id: i.id, module: 'flip', kind: 'Item', title: i.title || `${i.brand} ${i.category}`.trim() || i.sku,
        subtitle: [i.sku, i.brand, i.size, i.status].filter(Boolean).join(' · '), to: `/flip/items/${i.id}`,
        text: `${i.category} ${i.colour} ${i.notes} ${i.platform}`,
      })
    for (const i of ideas.data ?? [])
      out.push({
        id: i.id, module: 'spark', kind: 'Idea', title: i.title, subtitle: [i.category, ...i.tags].filter(Boolean).join(' · '),
        to: `/spark/ideas/${i.id}`, text: i.description,
      })
    for (const p of projects.data ?? [])
      out.push({ id: p.id, module: 'spark', kind: 'Project', title: p.name, subtitle: p.status, to: `/spark/projects/${p.id}`, text: `${p.description} ${p.notes}` })
    for (const t of tasks.data ?? [])
      out.push({
        id: t.id, module: t.module === 'flip' || t.module === 'atlas' ? t.module : 'spark', kind: 'Task', title: t.title,
        subtitle: t.status.replace('_', ' '), to: t.project_id ? `/spark/projects/${t.project_id}?tab=tasks` : '/tasks', text: t.description,
      })
    for (const p of places.data ?? [])
      out.push({
        id: p.id, module: 'atlas', kind: 'Place', title: p.name, subtitle: [p.city, p.country].filter(Boolean).join(', '),
        to: `/atlas?place=${p.id}`, text: `${p.notes} ${p.category} ${p.address}`,
      })
    for (const t of trips.data ?? [])
      out.push({ id: t.id, module: 'atlas', kind: 'Trip', title: t.title, subtitle: t.destination, to: `/atlas/trips/${t.id}`, text: t.description })
    for (const j of journal.data ?? [])
      out.push({ id: j.id, module: 'atlas', kind: 'Journal', title: j.title, subtitle: j.entry_date, to: `/atlas/journal?entry=${j.id}`, text: `${j.body} ${j.tags.join(' ')}` })
    return out
  }, [items.data, ideas.data, projects.data, tasks.data, places.data, trips.data, journal.data])

  const loading = [items, ideas, projects, tasks, places, trips, journal].some((q) => q.isLoading)
  return { docs, loading }
}
