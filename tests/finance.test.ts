import { describe, expect, it } from 'vitest'
import { monthly, netProfit, priceRangeFromHistory, summarise } from '../src/lib/finance'
import type { FlipItem } from '../src/lib/types'

let n = 0
function item(p: Partial<FlipItem>): FlipItem {
  n++
  return {
    id: `i${n}`, user_id: 'u', is_demo: false, created_at: '', updated_at: '', sku: `FL-${n}`, title: '', brand: '', category: '',
    size: '', colour: '', condition: '', status: 'draft', archived_from: null, platform: '', purchase_price: null,
    listing_price: null, sale_price: null, seller_fees: 0, shipping_cost: 0, other_expenses: 0, purchase_date: null,
    listed_date: null, sold_date: null, measurements: '', notes: '', photos: [], listing: null, favourite: false, ...p,
  }
}

describe('netProfit', () => {
  it('subtracts cost, fees, shipping and other expenses from the sale price', () => {
    expect(netProfit(item({ sale_price: 30, purchase_price: 8, seller_fees: 1.5, shipping_cost: 3.2, other_expenses: 0.5 }))).toBe(16.8)
  })
  it('has no float drift', () => {
    expect(netProfit(item({ sale_price: 0.3, purchase_price: 0.1, seller_fees: 0.1 }))).toBe(0.1)
  })
  it('is null until the item has a sale price', () => {
    expect(netProfit(item({ purchase_price: 5 }))).toBeNull()
  })
  it('treats a missing purchase price as zero cost', () => {
    expect(netProfit(item({ sale_price: 12 }))).toBe(12)
  })
})

describe('summarise', () => {
  const items = [
    item({ status: 'sold', purchase_price: 10, sale_price: 40, seller_fees: 2, shipping_cost: 3, sold_date: '2026-03-04', purchase_date: '2026-02-01' }),
    item({ status: 'sold', purchase_price: 5, sale_price: 20, sold_date: '2026-04-10', purchase_date: '2026-04-01' }),
    item({ status: 'listed', purchase_price: 7, listing_price: 25, purchase_date: '2026-04-02' }),
    item({ status: 'draft', purchase_price: 4, purchase_date: '2026-01-15' }),
    item({ status: 'archived', archived_from: 'listed', purchase_price: 3 }),
    item({ status: 'archived', archived_from: 'sold', purchase_price: 2, sale_price: 9, sold_date: '2026-04-20' }),
  ]
  it('computes all-time figures', () => {
    const s = summarise(items)
    expect(s.salesCount).toBe(3)
    expect(s.grossRevenue).toBe(69)
    expect(s.netProfit).toBe(69 - 17 - 5) // revenue − costs(10+5+2) − fees/shipping(2+3)
    expect(s.invested).toBe(31)
    expect(s.unsoldCount).toBe(2)
    expect(s.unsoldCost).toBe(11)
    expect(s.inventoryValue).toBe(29) // listed at 25 + draft valued at cost 4
    expect(s.activeListings).toBe(1)
    expect(s.averageSalePrice).toBe(23)
    expect(s.averageProfit).toBeCloseTo(15.67, 2)
  })
  it('filters sales by sold date', () => {
    const s = summarise(items, { from: '2026-04-01', to: '2026-04-30' })
    expect(s.salesCount).toBe(2)
    expect(s.grossRevenue).toBe(29)
    expect(s.netProfit).toBe(22)
    expect(s.invested).toBe(12) // bought in April: 5 + 7
  })
})

describe('monthly', () => {
  it('buckets sales by month including empty months', () => {
    const pts = monthly(
      [item({ status: 'sold', sale_price: 10, purchase_price: 4, sold_date: '2026-03-02' }), item({ status: 'sold', sale_price: 5, sold_date: '2026-03-20' })],
      3,
      new Date(2026, 3, 15),
    )
    expect(pts.map((p) => p.month)).toEqual(['2026-02', '2026-03', '2026-04'])
    expect(pts[1]).toMatchObject({ revenue: 15, profit: 11, sales: 2 })
    expect(pts[0].sales).toBe(0)
  })
})

describe('priceRangeFromHistory', () => {
  it('needs at least three comparable sales', () => {
    const items = [item({ status: 'sold', brand: 'Nike', category: 'Hoodie', sale_price: 20 }), item({ status: 'sold', brand: 'Nike', category: 'Hoodie', sale_price: 30 })]
    expect(priceRangeFromHistory(items, { id: 'x', brand: 'Nike', category: 'Hoodie' })).toBeNull()
  })
  it('returns the interquartile range of past sale prices', () => {
    const items = [10, 20, 30, 40, 50].map((v) => item({ status: 'sold', brand: 'Nike', category: 'Hoodie', sale_price: v }))
    expect(priceRangeFromHistory(items, { id: 'x', brand: 'nike', category: 'hoodie' })).toEqual({ low: 20, high: 40, basis: '5 of your past nike hoodie sales' })
  })
})
