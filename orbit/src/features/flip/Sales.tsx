import { differenceInCalendarMonths, format, startOfMonth, startOfYear, subDays } from 'date-fns'
import { Banknote, Boxes, ChartColumn, Download, PiggyBank, Receipt, Rocket, ShoppingBag, TrendingUp, Wallet } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/inputs'
import { Card, CardHeader, EmptyState, ErrorState, ListSkeleton, PageHeader, Progress, StatTile } from '@/components/ui/misc'
import { useProfile, useRows } from '@/lib/data'
import { isSold, monthly, netProfit, summarise, type DateRange } from '@/lib/finance'
import { money, shortDate, todayISO, toDate } from '@/lib/format'
import { salesReportCsv } from '@/lib/csv'
import { cn, downloadFile } from '@/lib/utils'
import { itemTitle } from './meta'

type Preset = 'month' | '30d' | '90d' | 'year' | 'all' | 'custom'

function rangeFor(p: Preset, custom: DateRange): DateRange {
  const today = new Date()
  const iso = (d: Date) => format(d, 'yyyy-MM-dd')
  switch (p) {
    case 'month':
      return { from: iso(startOfMonth(today)), to: iso(today) }
    case '30d':
      return { from: iso(subDays(today, 29)), to: iso(today) }
    case '90d':
      return { from: iso(subDays(today, 89)), to: iso(today) }
    case 'year':
      return { from: iso(startOfYear(today)), to: iso(today) }
    case 'all':
      return { from: null, to: null }
    case 'custom':
      return custom
  }
}

const PRESET_LABEL: Record<Preset, string> = {
  month: 'This month',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  year: 'This year',
  all: 'All time',
  custom: 'Custom range',
}

export function SalesPage() {
  const items = useRows('flip_items')
  const projects = useRows('spark_projects', { eq: { linked_flip: true } })
  const { data: profile } = useProfile()
  const cur = profile?.currency ?? 'GBP'
  const [preset, setPreset] = React.useState<Preset>('year')
  const [custom, setCustom] = React.useState<DateRange>({ from: format(subDays(new Date(), 60), 'yyyy-MM-dd'), to: todayISO() })
  const range = rangeFor(preset, custom)
  const all = items.data ?? []
  const s = summarise(all, range)

  const sales = all
    .filter((i) => isSold(i) && i.sale_price !== null && (!range.from || (i.sold_date ?? '') >= range.from) && (!range.to || (i.sold_date ?? '') <= range.to))
    .sort((a, b) => (b.sold_date ?? '').localeCompare(a.sold_date ?? ''))

  const months = React.useMemo(() => {
    const end = range.to ? toDate(range.to)! : new Date()
    const start = range.from ? toDate(range.from)! : null
    const n = start ? Math.min(36, Math.max(1, differenceInCalendarMonths(end, start) + 1)) : 12
    return monthly(all, n, end)
  }, [all, range.from, range.to])

  const byPlatform = React.useMemo(() => {
    const m = new Map<string, { sales: number; revenue: number; profit: number }>()
    for (const i of sales) {
      const key = i.platform || 'Not recorded'
      const row = m.get(key) ?? { sales: 0, revenue: 0, profit: 0 }
      row.sales++
      row.revenue = Math.round((row.revenue + (i.sale_price ?? 0)) * 100) / 100
      row.profit = Math.round((row.profit + (netProfit(i) ?? 0)) * 100) / 100
      m.set(key, row)
    }
    return [...m.entries()].sort((a, b) => b[1].revenue - a[1].revenue)
  }, [sales])

  const exportReport = () => {
    const label = preset === 'custom' ? `${range.from ?? 'start'} to ${range.to ?? 'today'}` : PRESET_LABEL[preset]
    const csv = salesReportCsv(sales, {
      Period: label,
      Currency: cur,
      'Completed sales': s.salesCount,
      'Gross revenue': s.grossRevenue,
      'Seller fees': s.fees,
      'Shipping costs': s.shipping,
      'Other expenses': s.otherExpenses,
      'Net profit': s.netProfit,
      'Average sale price': s.averageSalePrice ?? '',
      'Average profit per sale': s.averageProfit ?? '',
      'Amount invested (bought in period)': s.invested,
      'Unsold items': s.unsoldCount,
      'Unsold inventory value (listing prices)': s.inventoryValue,
      'Generated': new Date().toISOString(),
    })
    downloadFile(`orbit-sales-report-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8')
  }

  const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--foreground)' }

  return (
    <div>
      <PageHeader
        eyebrow="Flip"
        title="Sales & profit"
        description="Net profit = sale price − purchase cost − seller fees − shipping − other expenses."
        actions={
          <Button variant="outline" size="sm" onClick={exportReport} disabled={!all.length}>
            <Download /> Download report
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} aria-label="Date range" className="w-44">
          {(Object.keys(PRESET_LABEL) as Preset[]).map((p) => (
            <option key={p} value={p}>
              {PRESET_LABEL[p]}
            </option>
          ))}
        </Select>
        {preset === 'custom' && (
          <>
            <Input type="date" aria-label="From" value={custom.from ?? ''} onChange={(e) => setCustom({ ...custom, from: e.target.value || null })} className="w-40" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" aria-label="To" value={custom.to ?? ''} min={custom.from ?? undefined} onChange={(e) => setCustom({ ...custom, to: e.target.value || null })} className="w-40" />
          </>
        )}
        <span className="text-xs text-muted-foreground">Sales are counted by sold date.</span>
      </div>

      {items.isLoading ? (
        <ListSkeleton rows={4} />
      ) : items.error ? (
        <ErrorState error={items.error} onRetry={() => items.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState icon={ChartColumn} title="No sales data yet" description="Add items to your inventory and mark them sold to see revenue and profit here." action={<Button variant="accent" asChild><Link to="/flip/items/new">Add an item</Link></Button>} />
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Gross revenue" value={money(s.grossRevenue, cur)} icon={Banknote} hint={`${s.salesCount} completed sale${s.salesCount === 1 ? '' : 's'}`} />
            <StatTile label="Net profit" value={<span className={s.netProfit < 0 ? 'text-destructive' : 'text-success'}>{money(s.netProfit, cur)}</span>} icon={TrendingUp} hint={s.margin !== null ? `${Math.round(s.margin * 100)}% margin` : 'No sales in range'} />
            <StatTile label="Average sale price" value={money(s.averageSalePrice, cur)} icon={Receipt} />
            <StatTile label="Average profit per sale" value={money(s.averageProfit, cur)} icon={PiggyBank} />
            <StatTile label="Amount invested" value={money(s.invested, cur)} icon={Wallet} hint={preset === 'all' ? 'Every item bought' : 'Items bought in this period'} />
            <StatTile label="Inventory value" value={money(s.inventoryValue, cur)} icon={Boxes} hint="Unsold stock at listing price" />
            <StatTile label="Unsold inventory" value={s.unsoldCount} icon={ShoppingBag} hint={`${money(s.unsoldCost, cur)} at cost · ${s.activeListings} live`} />
            <StatTile label="Fees and shipping" value={money(s.fees + s.shipping + s.otherExpenses, cur)} icon={Receipt} hint={`${money(s.fees, cur)} fees · ${money(s.shipping, cur)} postage`} />
          </div>

          <Card className="module-flip">
            <CardHeader title="Monthly revenue and profit" icon={ChartColumn} />
            <div className="h-72 px-2 pb-3" role="img" aria-label="Bar chart of monthly revenue with a line for net profit">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={months} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickFormatter={(v) => money(Number(v), cur, { compact: true })} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} formatter={(v, n) => [money(Number(v), cur), n === 'revenue' ? 'Revenue' : 'Net profit']} />
                  <Legend formatter={(v) => (v === 'revenue' ? 'Revenue' : 'Net profit')} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" fill="color-mix(in oklab, var(--flip) 45%, transparent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Line dataKey="profit" stroke="var(--flip)" strokeWidth={2} dot={{ r: 3, fill: 'var(--flip)' }} type="linear" isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card className="min-w-0">
              <CardHeader title="Sales in this period" description={`${sales.length} sold`} />
              {sales.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">No sales in this period.</p>
              ) : (
                <div className="overflow-x-auto px-1 pb-2">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Sold</th>
                        <th className="px-3 py-2 font-medium">Item</th>
                        <th className="px-3 py-2 text-right font-medium">Sale</th>
                        <th className="px-3 py-2 text-right font-medium">Costs</th>
                        <th className="px-3 py-2 text-right font-medium">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((i) => {
                        const p = netProfit(i) ?? 0
                        const costs = (i.purchase_price ?? 0) + i.seller_fees + i.shipping_cost + i.other_expenses
                        return (
                          <tr key={i.id} className="border-t border-border">
                            <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{shortDate(i.sold_date)}</td>
                            <td className="px-3 py-2">
                              <Link to={`/flip/items/${i.id}`} className="hover:underline">
                                {itemTitle(i)}
                              </Link>
                              <span className="block text-xs text-muted-foreground">
                                {i.sku}
                                {i.platform && ` · ${i.platform}`}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right tabular">{money(i.sale_price, cur)}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground tabular">{money(costs, cur)}</td>
                            <td className={cn('px-3 py-2 text-right font-medium tabular', p >= 0 ? 'text-success' : 'text-destructive')}>{money(p, cur)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <div className="grid content-start gap-4">
              <Card>
                <CardHeader title="By platform" />
                <ul className="grid grid-cols-1 gap-3 px-4 pb-4">
                  {byPlatform.length === 0 && <li className="text-sm text-muted-foreground">No sales in this period.</li>}
                  {byPlatform.map(([name, r]) => (
                    <li key={name} className="grid gap-1">
                      <div className="flex justify-between text-sm">
                        <span>{name}</span>
                        <span className="tabular">{money(r.revenue, cur)}</span>
                      </div>
                      <Progress value={s.grossRevenue ? (r.revenue / s.grossRevenue) * 100 : 0} />
                      <p className="text-xs text-muted-foreground tabular">
                        {r.sales} sale{r.sales === 1 ? '' : 's'} · {money(r.profit, cur)} profit
                      </p>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="module-spark">
                <CardHeader title="Linked business plans" icon={Rocket} description="Spark projects connected to Flip" />
                <ul className="grid grid-cols-1 gap-1 px-2 pb-3">
                  {(projects.data ?? []).length === 0 ? (
                    <li className="px-2 text-sm text-muted-foreground">Create a “reselling business plan” project in Spark to link it here.</li>
                  ) : (
                    (projects.data ?? []).map((p) => (
                      <li key={p.id}>
                        <Link to={`/spark/projects/${p.id}`} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                          {p.name}
                          <span className="block text-xs text-muted-foreground">{p.status}</span>
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
