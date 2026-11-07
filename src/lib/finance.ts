import type { FlipItem } from './types'

/** Work in whole pence so sums never drift (0.1 + 0.2 problems). */
const p = (v: number | null | undefined) => Math.round((v ?? 0) * 100)
const pounds = (pence: number) => pence / 100

/**
 * Net Profit = Sale Price − Purchase Cost − Seller Fees − Shipping Costs − Other Expenses
 * Returns null when the item has no sale price yet.
 */
export function netProfit(item: Pick<FlipItem, 'sale_price' | 'purchase_price' | 'seller_fees' | 'shipping_cost' | 'other_expenses'>): number | null {
  if (item.sale_price === null || item.sale_price === undefined) return null
  return pounds(p(item.sale_price) - p(item.purchase_price) - p(item.seller_fees) - p(item.shipping_cost) - p(item.other_expenses))
}

/** Profit if the item sold at its listing price, before fees and shipping you haven't recorded yet. */
export function projectedProfit(item: Pick<FlipItem, 'listing_price' | 'purchase_price' | 'seller_fees' | 'shipping_cost' | 'other_expenses'>): number | null {
  if (item.listing_price === null || item.listing_price === undefined) return null
  return pounds(p(item.listing_price) - p(item.purchase_price) - p(item.seller_fees) - p(item.shipping_cost) - p(item.other_expenses))
}

export interface DateRange {
  from: string | null // inclusive yyyy-mm-dd
  to: string | null // inclusive yyyy-mm-dd
}

function inRange(date: string | null, r: DateRange): boolean {
  if (!r.from && !r.to) return true
  if (!date) return false
  const d = date.slice(0, 10)
  if (r.from && d < r.from) return false
  if (r.to && d > r.to) return false
  return true
}

export interface FlipSummary {
  /** Unsold, non-archived items valued at their listing price (falls back to cost when unpriced). */
  inventoryValue: number
  /** Cost of unsold, non-archived items. */
  unsoldCost: number
  unsoldCount: number
  /** Purchase cost of every item bought in the period (by purchase date; undated items count for all time only). */
  invested: number
  grossRevenue: number
  netProfit: number
  salesCount: number
  averageSalePrice: number | null
  averageProfit: number | null
  fees: number
  shipping: number
  otherExpenses: number
  /** Net profit as a share of revenue, 0–1. */
  margin: number | null
  activeListings: number
}

export function isSold(i: FlipItem): boolean {
  return i.status === 'sold' || (i.status === 'archived' && i.archived_from === 'sold')
}

export function summarise(items: FlipItem[], range: DateRange = { from: null, to: null }): FlipSummary {
  let invValue = 0
  let unsoldCost = 0
  let unsoldCount = 0
  let invested = 0
  let revenue = 0
  let profit = 0
  let sales = 0
  let fees = 0
  let shipping = 0
  let other = 0
  let active = 0
  const allTime = !range.from && !range.to

  for (const i of items) {
    const sold = isSold(i)
    if (allTime || inRange(i.purchase_date, range)) invested += p(i.purchase_price)
    if (!sold && i.status !== 'archived') {
      unsoldCount++
      unsoldCost += p(i.purchase_price)
      invValue += p(i.listing_price ?? i.purchase_price)
      if (i.status === 'listed' || i.status === 'reserved') active++
    }
    if (sold && i.sale_price !== null && inRange(i.sold_date, range)) {
      sales++
      revenue += p(i.sale_price)
      fees += p(i.seller_fees)
      shipping += p(i.shipping_cost)
      other += p(i.other_expenses)
      profit += p(i.sale_price) - p(i.purchase_price) - p(i.seller_fees) - p(i.shipping_cost) - p(i.other_expenses)
    }
  }
  return {
    inventoryValue: pounds(invValue),
    unsoldCost: pounds(unsoldCost),
    unsoldCount,
    invested: pounds(invested),
    grossRevenue: pounds(revenue),
    netProfit: pounds(profit),
    salesCount: sales,
    averageSalePrice: sales ? pounds(Math.round(revenue / sales)) : null,
    averageProfit: sales ? pounds(Math.round(profit / sales)) : null,
    fees: pounds(fees),
    shipping: pounds(shipping),
    otherExpenses: pounds(other),
    margin: revenue ? profit / revenue : null,
    activeListings: active,
  }
}

export interface MonthPoint {
  month: string // yyyy-mm
  label: string // e.g. "Mar 26"
  revenue: number
  profit: number
  sales: number
}

/** Revenue and profit per calendar month, by sold date, including empty months in the span. */
export function monthly(items: FlipItem[], months = 12, endDate = new Date()): MonthPoint[] {
  const out: MonthPoint[] = []
  const byKey = new Map<string, MonthPoint>()
  for (let k = months - 1; k >= 0; k--) {
    const d = new Date(endDate.getFullYear(), endDate.getMonth() - k, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
    const pt = { month: key, label, revenue: 0, profit: 0, sales: 0 }
    out.push(pt)
    byKey.set(key, pt)
  }
  for (const i of items) {
    if (!isSold(i) || i.sale_price === null || !i.sold_date) continue
    const pt = byKey.get(i.sold_date.slice(0, 7))
    if (!pt) continue
    pt.sales++
    pt.revenue = pounds(p(pt.revenue) + p(i.sale_price))
    pt.profit = pounds(p(pt.profit) + p(netProfit(i)))
  }
  return out
}

/** Interquartile price range from the person's own past sales of similar items. */
export function priceRangeFromHistory(
  items: FlipItem[],
  target: Pick<FlipItem, 'brand' | 'category' | 'id'>,
): { low: number; high: number; basis: string } | null {
  const norm = (s: string) => s.trim().toLowerCase()
  const sold = items.filter((i) => i.id !== target.id && isSold(i) && i.sale_price !== null)
  const pick = (pred: (i: FlipItem) => boolean, label: string) => {
    const prices = sold.filter(pred).map((i) => i.sale_price as number).sort((a, b) => a - b)
    if (prices.length < 3) return null
    const q = (f: number) => {
      const pos = (prices.length - 1) * f
      const lo = Math.floor(pos)
      const hi = Math.ceil(pos)
      return prices[lo] + (prices[hi] - prices[lo]) * (pos - lo)
    }
    const round = (v: number) => Math.max(0, Math.round(v))
    return { low: round(q(0.25)), high: round(q(0.75)), basis: `${prices.length} of your past ${label} sales` }
  }
  const brand = norm(target.brand)
  const category = norm(target.category)
  return (
    (brand && category ? pick((i) => norm(i.brand) === brand && norm(i.category) === category, `${target.brand} ${target.category}`) : null) ??
    (brand ? pick((i) => norm(i.brand) === brand, target.brand) : null) ??
    (category ? pick((i) => norm(i.category) === category, target.category) : null)
  )
}
