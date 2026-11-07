import { BookOpen, Building, CalendarCheck, Flag, MapPin, Plane, Star } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardHeader, ListSkeleton, PageHeader, Progress, StatTile } from '@/components/ui/misc'
import { useRows } from '@/lib/data'
import { todayISO } from '@/lib/format'
import { PLACE_CATEGORIES } from '@/lib/types'
import { CATEGORY_META, flag } from './meta'

export function StatsPage() {
  const places = useRows('atlas_places')
  const trips = useRows('atlas_trips')
  const journal = useRows('atlas_journal')
  if (places.isLoading || trips.isLoading) return <ListSkeleton rows={4} />

  const p = places.data ?? []
  const t = trips.data ?? []
  const today = todayISO()
  const visited = p.filter((x) => x.status === 'visited')
  const cities = new Set(visited.filter((x) => x.city).map((x) => `${x.city.toLowerCase()}|${x.country.toLowerCase()}`))
  const countries = new Map<string, { name: string; code: string; n: number }>()
  for (const v of visited) {
    if (!v.country) continue
    const k = v.country.toLowerCase()
    const c = countries.get(k) ?? { name: v.country, code: v.country_code, n: 0 }
    c.n++
    countries.set(k, c)
  }
  const upcoming = t.filter((x) => (x.start_date ?? '') > today).length
  const completed = t.filter((x) => x.end_date && x.end_date < today).length
  const saved = p.filter((x) => x.status === 'want').length
  const byYear = new Map<string, number>()
  for (const v of visited) if (v.visited_on) byYear.set(v.visited_on.slice(0, 4), (byYear.get(v.visited_on.slice(0, 4)) ?? 0) + 1)
  const years = [...byYear.entries()].sort().map(([year, n]) => ({ year, n }))
  const countryList = [...countries.values()].sort((a, b) => b.n - a.n)

  return (
    <div>
      <PageHeader eyebrow="Atlas" title="Travel statistics" description="Counted from the places you’ve marked visited and the trips you’ve planned." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Places visited" value={visited.length} icon={MapPin} />
        <StatTile label="Cities explored" value={cities.size} icon={Building} />
        <StatTile label="Countries visited" value={countries.size} icon={Flag} />
        <StatTile label="Upcoming trips" value={upcoming} icon={Plane} />
        <StatTile label="Completed trips" value={completed} icon={CalendarCheck} />
        <StatTile label="Saved destinations" value={saved} icon={Star} hint="Want to visit" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="module-atlas">
          <CardHeader title="Countries" description={`${countries.size} visited`} icon={Flag} />
          <ul className="grid gap-2 px-4 pb-4">
            {countryList.length === 0 && <li className="text-sm text-muted-foreground">Mark places as visited to see your countries.</li>}
            {countryList.map((c) => (
              <li key={c.name} className="flex items-center gap-3 text-sm">
                <span className="w-6 text-lg" aria-hidden>
                  {flag(c.code)}
                </span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="text-xs text-muted-foreground tabular">
                  {c.n} place{c.n === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="module-atlas">
          <CardHeader title="Places visited by year" description="Uses the “visited on” date" />
          <div className="h-56 px-2 pb-3">
            {years.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">Add visit dates to places to see this chart.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={years} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => [v, 'Places']} />
                  <Bar dataKey="n" fill="var(--atlas)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Saved places by category" />
          <ul className="grid gap-2.5 px-4 pb-4">
            {PLACE_CATEGORIES.map((c) => {
              const n = p.filter((x) => x.category === c).length
              if (!n) return null
              return (
                <li key={c} className="grid gap-1">
                  <div className="flex justify-between text-sm">
                    <span>{CATEGORY_META[c].label}</span>
                    <span className="text-xs text-muted-foreground tabular">{n}</span>
                  </div>
                  <Progress value={(n / p.length) * 100} />
                </li>
              )
            })}
            {p.length === 0 && <li className="text-sm text-muted-foreground">No saved places yet.</li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Journal" icon={BookOpen} />
          <div className="grid grid-cols-3 gap-3 px-4 pb-4">
            <div>
              <p className="text-xs text-muted-foreground">Entries</p>
              <p className="text-xl font-semibold tabular">{(journal.data ?? []).length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Photos</p>
              <p className="text-xl font-semibold tabular">{(journal.data ?? []).reduce((n, j) => n + j.photos.length, 0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Favourites</p>
              <p className="text-xl font-semibold tabular">{(journal.data ?? []).filter((j) => j.favourite).length}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
