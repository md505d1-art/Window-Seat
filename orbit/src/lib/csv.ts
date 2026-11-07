import Papa from 'papaparse'
import { netProfit } from './finance'
import { nextSku } from './listing'
import { FLIP_STATUSES, type FlipItem, type FlipStatus, type NewRow } from './types'

export const CSV_COLUMNS = [
  'sku', 'title', 'brand', 'category', 'size', 'colour', 'condition', 'status', 'platform',
  'purchase_price', 'listing_price', 'sale_price', 'seller_fees', 'shipping_cost', 'other_expenses',
  'purchase_date', 'listed_date', 'sold_date', 'measurements', 'notes',
] as const

export function itemsToCsv(items: FlipItem[]): string {
  return Papa.unparse(
    items.map((i) => ({
      ...Object.fromEntries(CSV_COLUMNS.map((c) => [c, i[c] ?? ''])),
      net_profit: netProfit(i) ?? '',
    })),
    { columns: [...CSV_COLUMNS, 'net_profit'] },
  )
}

const STATUS_ALIASES: Record<string, FlipStatus> = {
  draft: 'draft', 'ready to list': 'ready', ready: 'ready', listed: 'listed', live: 'listed', active: 'listed',
  reserved: 'reserved', pending: 'reserved', sold: 'sold', archived: 'archived',
}

function money(v: string | undefined, field: string, errors: string[]): number | null {
  if (v === undefined || v.trim() === '') return null
  const n = Number(v.replace(/[£$€,\s]/g, ''))
  if (Number.isNaN(n) || n < 0) {
    errors.push(`${field} “${v}” isn’t a valid amount`)
    return null
  }
  return Math.round(n * 100) / 100
}

function date(v: string | undefined, field: string, errors: string[]): string | null {
  if (!v || !v.trim()) return null
  const s = v.trim()
  // Accept yyyy-mm-dd and dd/mm/yyyy (UK).
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m) return s
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  errors.push(`${field} “${v}” should look like 2026-03-14 or 14/03/2026`)
  return null
}

export interface CsvImportResult {
  rows: NewRow<'flip_items'>[]
  errors: { line: number; message: string }[]
  skipped: number
}

/** Parses an inventory CSV. Rows with errors are reported and left out; missing SKUs are assigned. */
export function parseItemsCsv(text: string, existingSkus: string[]): CsvImportResult {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'),
  })
  const rows: NewRow<'flip_items'>[] = []
  const errors: CsvImportResult['errors'] = []
  const skus = new Set(existingSkus.map((s) => s.toUpperCase()))
  const taken = [...existingSkus]
  let skipped = 0

  parsed.data.forEach((r, idx) => {
    const line = idx + 2 // header is line 1
    const problems: string[] = []
    const title = (r.title ?? '').trim()
    const brand = (r.brand ?? '').trim()
    if (!title && !brand && !(r.category ?? '').trim()) {
      skipped++
      return
    }
    const rawStatus = (r.status ?? '').trim().toLowerCase()
    const status: FlipStatus = rawStatus ? STATUS_ALIASES[rawStatus] ?? (FLIP_STATUSES.includes(rawStatus as FlipStatus) ? (rawStatus as FlipStatus) : 'draft') : 'draft'
    if (rawStatus && !STATUS_ALIASES[rawStatus]) problems.push(`status “${r.status}” isn’t recognised`)
    let sku = (r.sku ?? '').trim()
    if (sku && skus.has(sku.toUpperCase())) problems.push(`SKU ${sku} already exists`)
    if (!sku) sku = nextSku(taken)
    const row: NewRow<'flip_items'> = {
      sku,
      title,
      brand,
      category: (r.category ?? '').trim(),
      size: (r.size ?? '').trim(),
      colour: (r.colour ?? r.color ?? '').trim(),
      condition: (r.condition ?? '').trim(),
      status,
      platform: (r.platform ?? '').trim(),
      purchase_price: money(r.purchase_price, 'Purchase price', problems),
      listing_price: money(r.listing_price, 'Listing price', problems),
      sale_price: money(r.sale_price, 'Sale price', problems),
      seller_fees: money(r.seller_fees, 'Seller fees', problems) ?? 0,
      shipping_cost: money(r.shipping_cost, 'Shipping', problems) ?? 0,
      other_expenses: money(r.other_expenses, 'Other expenses', problems) ?? 0,
      purchase_date: date(r.purchase_date, 'Purchase date', problems),
      listed_date: date(r.listed_date, 'Listed date', problems),
      sold_date: date(r.sold_date, 'Sold date', problems),
      measurements: (r.measurements ?? '').trim(),
      notes: (r.notes ?? '').trim(),
    }
    if (row.status === 'sold' && row.sale_price === null) problems.push('sold items need a sale price')
    if (problems.length) {
      errors.push({ line, message: problems.join('; ') })
      return
    }
    skus.add(sku.toUpperCase())
    taken.push(sku)
    rows.push(row)
  })
  for (const e of parsed.errors) errors.push({ line: (e.row ?? 0) + 2, message: e.message })
  return { rows, errors, skipped }
}

export function salesReportCsv(items: FlipItem[], summary: Record<string, string | number>): string {
  const head = Papa.unparse(Object.entries(summary).map(([k, v]) => ({ metric: k, value: v })))
  const sales = Papa.unparse(
    items.map((i) => ({
      sold_date: i.sold_date ?? '',
      sku: i.sku,
      title: i.title,
      platform: i.platform,
      sale_price: i.sale_price ?? '',
      purchase_price: i.purchase_price ?? '',
      seller_fees: i.seller_fees,
      shipping_cost: i.shipping_cost,
      other_expenses: i.other_expenses,
      net_profit: netProfit(i) ?? '',
    })),
  )
  return `${head}\n\n${sales}\n`
}
