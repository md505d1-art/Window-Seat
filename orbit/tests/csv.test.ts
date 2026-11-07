import { describe, expect, it } from 'vitest'
import { itemsToCsv, parseItemsCsv } from '../src/lib/csv'
import type { FlipItem } from '../src/lib/types'

describe('parseItemsCsv', () => {
  it('imports valid rows, assigns missing SKUs and reads UK dates and £ amounts', () => {
    const csv = `SKU,Title,Brand,Status,Purchase Price,Sale Price,Sold Date
,nike hoodie grey,Nike,listed,£5.50,,
FL-0100,levi's jeans,Levi's,sold,8,"£1,032.10",14/03/2026`
    const r = parseItemsCsv(csv, ['FL-0004'])
    expect(r.errors).toEqual([])
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toMatchObject({ sku: 'FL-0005', status: 'listed', purchase_price: 5.5 })
    expect(r.rows[1]).toMatchObject({ sku: 'FL-0100', status: 'sold', sale_price: 1032.1, sold_date: '2026-03-14' })
  })

  it('reports bad rows by line and leaves them out', () => {
    const csv = `sku,title,status,purchase_price,sold_date
FL-0001,dup,listed,3,
,bad price,listed,abc,
,sold without price,sold,,2026-01-01
,weird status,flogged,2,`
    const r = parseItemsCsv(csv, ['FL-0001'])
    expect(r.rows).toHaveLength(0)
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 4, 5])
    expect(r.errors[0].message).toMatch(/already exists/)
    expect(r.errors[1].message).toMatch(/Purchase price/)
    expect(r.errors[2].message).toMatch(/need a sale price/)
    expect(r.errors[3].message).toMatch(/isn’t recognised/)
  })

  it('round-trips an export', () => {
    const item = {
      sku: 'FL-0001', title: 'barbour jacket', brand: 'Barbour', category: 'Jacket', size: 'L', colour: 'olive', condition: 'good',
      status: 'sold', platform: 'eBay', purchase_price: 20, listing_price: 80, sale_price: 75, seller_fees: 9.5, shipping_cost: 4,
      other_expenses: 0, purchase_date: '2026-01-02', listed_date: '2026-01-05', sold_date: '2026-02-01', measurements: 'p2p 60cm', notes: 'a, "quoted" note',
    } as unknown as FlipItem
    const csv = itemsToCsv([item])
    expect(csv.split('\n')[0]).toContain('net_profit')
    expect(csv).toContain(',41.5')
    const back = parseItemsCsv(csv, [])
    expect(back.errors).toEqual([])
    expect(back.rows[0]).toMatchObject({ sku: 'FL-0001', sale_price: 75, notes: 'a, "quoted" note', sold_date: '2026-02-01' })
  })
})
