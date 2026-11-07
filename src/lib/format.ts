import { differenceInCalendarDays, format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns'

const moneyFormatters = new Map<string, Intl.NumberFormat>()

export function money(value: number | null | undefined, currency = 'GBP', opts: { compact?: boolean } = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const key = `${currency}-${opts.compact ? 'c' : 'f'}`
  let f = moneyFormatters.get(key)
  if (!f) {
    f = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      notation: opts.compact ? 'compact' : 'standard',
      maximumFractionDigits: opts.compact ? 1 : 2,
      minimumFractionDigits: opts.compact ? 0 : 2,
    })
    moneyFormatters.set(key, f)
  }
  return f.format(value)
}

export function currencySymbol(currency = 'GBP'): string {
  return (
    new Intl.NumberFormat('en-GB', { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')
      ?.value ?? currency
  )
}

export function toDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = value.length <= 10 ? parseISO(value) : new Date(value)
  return isValid(d) ? d : null
}

export function shortDate(value: string | null | undefined): string {
  const d = toDate(value)
  return d ? format(d, 'd MMM yyyy') : '—'
}

export function dayLabel(value: string | null | undefined): string {
  const d = toDate(value)
  return d ? format(d, 'EEE d MMM') : '—'
}

export function dateRange(start: string | null, end: string | null): string {
  const s = toDate(start)
  const e = toDate(end)
  if (!s && !e) return 'Dates not set'
  if (s && !e) return `From ${format(s, 'd MMM yyyy')}`
  if (!s && e) return `Until ${format(e, 'd MMM yyyy')}`
  if (s!.getFullYear() === e!.getFullYear()) {
    if (s!.getMonth() === e!.getMonth()) return `${format(s!, 'd')}–${format(e!, 'd MMM yyyy')}`
    return `${format(s!, 'd MMM')} – ${format(e!, 'd MMM yyyy')}`
  }
  return `${format(s!, 'd MMM yyyy')} – ${format(e!, 'd MMM yyyy')}`
}

export function relativeTime(value: string | null | undefined): string {
  const d = toDate(value)
  return d ? `${formatDistanceToNowStrict(d)} ago` : ''
}

export function daysUntil(value: string | null | undefined): number | null {
  const d = toDate(value)
  return d ? differenceInCalendarDays(d, new Date()) : null
}

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function isoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}
