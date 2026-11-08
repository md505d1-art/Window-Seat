import type { FlipItem, ListingDraft } from './types'

/**
 * Listing formatting rules (Flip):
 *  - Only brand names and proper nouns keep capital letters; everything else is lowercase.
 *  - The SKU goes at the end of the title.
 *  - Descriptions are short bullet points.
 *  - Exactly five relevant hashtags.
 *  - Price is a suggested range, never a guaranteed price.
 *  - Nothing is invented: missing facts become "please verify" prompts instead.
 */


/** Lowercases text except for protected words (brands, proper nouns) and the SKU. */
export function applyCasing(text: string, protectedWords: string[], sku?: string): string {
  const guards = protectedWords
    .map((w) => w.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  let out = ''
  let i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    const lowerRest = rest.toLowerCase()
    const prevChar = i > 0 ? text[i - 1] : ' '
    const atWordStart = !/[\p{L}\p{N}]/u.test(prevChar)
    let matched = false
    if (atWordStart) {
      for (const g of [...(sku ? [sku] : []), ...guards]) {
        if (lowerRest.startsWith(g.toLowerCase())) {
          const next = rest[g.length]
          if (next === undefined || !/[\p{L}\p{N}]/u.test(next)) {
            out += g
            i += g.length
            matched = true
            break
          }
        }
      }
    }
    if (!matched) {
      out += text[i].toLowerCase()
      i++
    }
  }
  return out
}

export function cleanSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\s+([,.])/g, '$1').trim()
}

export interface TitleParts {
  brand: string
  description: string // e.g. "vintage crewneck sweatshirt"
  colour: string
  size: string
  sku: string
  properNouns?: string[]
}

function hasPhrase(text: string, phrase: string): boolean {
  if (!phrase.trim()) return false
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(phrase.trim().toLowerCase())}($|[^\\p{L}\\p{N}])`, 'u').test(text.toLowerCase())
}

/** Removes brand, SKU, colour and size from an existing title, leaving just what the item is. */
export function describeFromTitle(item: Pick<FlipItem, 'title' | 'brand' | 'sku' | 'colour' | 'size' | 'category'>): string {
  let t = item.title
  for (const part of [item.sku, item.brand, item.size ? `size ${item.size}` : '', item.colour]) {
    if (part.trim()) t = t.replace(new RegExp(escapeRegExp(part.trim()), 'gi'), ' ')
  }
  t = cleanSpaces(t).toLowerCase()
  return t || item.category.trim().toLowerCase()
}

export function composeTitle(parts: TitleParts): string {
  const desc = parts.description
  // Don't repeat details the description already mentions.
  const size = parts.size.trim() && !hasPhrase(desc, `size ${parts.size}`) ? `size ${parts.size.trim()}` : ''
  const colour = hasPhrase(desc, parts.colour) ? '' : parts.colour
  const brand = hasPhrase(desc, parts.brand) ? '' : parts.brand
  const body = cleanSpaces([brand, desc, colour, size].filter(Boolean).join(' '))
  // Strip any SKU the person may have typed, then add it once at the end.
  const withoutSku = parts.sku ? cleanSpaces(body.replace(new RegExp(escapeRegExp(parts.sku), 'gi'), '')) : body
  const cased = applyCasing(withoutSku, [parts.brand, ...(parts.properNouns ?? [])])
  return cleanSpaces(parts.sku ? `${cased} ${parts.sku}` : cased)
}

/** Enforces casing + SKU-at-end on a title someone (or the AI) wrote. */
export function normaliseTitle(title: string, brand: string, sku: string, properNouns: string[] = []): string {
  const withoutSku = sku ? cleanSpaces(title.replace(new RegExp(escapeRegExp(sku), 'gi'), '')) : cleanSpaces(title)
  const cased = applyCasing(withoutSku, [brand, ...properNouns])
  return cleanSpaces(sku ? `${cased} ${sku}` : cased)
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function toHashtag(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
}

const GENERIC_TAGS = ['preloved', 'secondhand', 'sustainablefashion', 'wardrobe', 'style']

/** Exactly five unique hashtags: item facts first, then honest generic resale tags. */
export function buildHashtags(item: Pick<FlipItem, 'brand' | 'category' | 'colour' | 'title'>, extra: string[] = []): string[] {
  const words = (item.title || '').toLowerCase().split(/\s+/)
  const style = ['vintage', 'y2k', 'retro', 'streetwear', 'workwear', 'designer', 'handmade', 'deadstock'].filter((w) => words.includes(w))
  const candidates = [
    ...extra,
    item.brand,
    item.category,
    item.brand && item.category ? `${item.brand} ${item.category}` : '',
    ...style,
    item.colour && item.category ? `${item.colour} ${item.category}` : '',
    ...GENERIC_TAGS,
  ]
  const out: string[] = []
  for (const c of candidates) {
    const tag = toHashtag(c)
    if (tag.length >= 2 && tag.length <= 40 && !out.includes(tag)) out.push(tag)
    if (out.length === 5) break
  }
  return out.map((t) => `#${t}`)
}

/** Normalises any list (AI output included) to exactly five valid, unique hashtags. */
export function normaliseHashtags(tags: string[], item: Pick<FlipItem, 'brand' | 'category' | 'colour' | 'title'>): string[] {
  const cleaned = tags.map((t) => toHashtag(t)).filter((t) => t.length >= 2)
  return buildHashtags(item, cleaned)
}

/** Facts we would need to invent to write a full listing; shown to the person to check. */
export function missingFacts(item: Partial<FlipItem>): string[] {
  const out: string[] = []
  if (!item.brand?.trim()) out.push('Brand — check the label. Leave blank if unbranded.')
  if (!item.size?.trim()) out.push('Size — check the size label or add measurements.')
  if (!item.condition?.trim()) out.push('Condition — describe it yourself, including any marks or wear.')
  if (!item.colour?.trim()) out.push('Colour')
  if (!item.category?.trim()) out.push('Category')
  if (!item.measurements?.trim()) out.push('Measurements help buyers and reduce returns.')
  return out
}

/** Short bullet description built only from facts the person entered. */
export function composeDescription(item: Pick<FlipItem, 'brand' | 'category' | 'size' | 'colour' | 'condition' | 'measurements' | 'notes'>): string {
  const lines: string[] = []
  const brand = item.brand.trim()
  const lc = (s: string) => applyCasing(s.trim(), [brand])
  if (brand) lines.push(`• brand: ${brand}`)
  if (item.category.trim()) lines.push(`• type: ${lc(item.category)}`)
  if (item.size.trim()) lines.push(`• size: ${lc(item.size)}`)
  if (item.colour.trim()) lines.push(`• colour: ${lc(item.colour)}`)
  if (item.condition.trim()) lines.push(`• condition: ${lc(item.condition)} — please see photos`)
  if (item.measurements.trim()) lines.push(`• measurements: ${lc(item.measurements)}`)
  if (item.notes.trim()) lines.push(`• ${lc(item.notes).replace(/\n+/g, ' ')}`)
  return lines.join('\n')
}

/** Builds a listing from the person's own details only (no AI). */
export function templateListing(
  item: FlipItem,
  description: string,
  range: { low: number; high: number; basis: string } | null,
  properNouns: string[] = [],
): ListingDraft {
  return {
    title: composeTitle({ brand: item.brand, description, colour: item.colour, size: item.size, sku: item.sku, properNouns }),
    description: composeDescription(item),
    hashtags: buildHashtags({ ...item, title: description }),
    category: item.category,
    price_low: range?.low ?? null,
    price_high: range?.high ?? null,
    price_basis: range ? `Based on ${range.basis}.` : 'Not enough past sales of similar items to suggest a range.',
    source: 'template',
    verify: missingFacts(item),
    generated_at: new Date().toISOString(),
  }
}

export function fullListingText(d: Pick<ListingDraft, 'title' | 'description' | 'hashtags'>): string {
  return [d.title, '', d.description, '', d.hashtags.join(' ')].join('\n').trim()
}

/** Next SKU in the FL-0001 sequence. */
export function nextSku(existing: string[], prefix = 'FL'): string {
  let max = 0
  const re = new RegExp(`^${prefix}-(\\d+)$`, 'i')
  for (const s of existing) {
    const m = re.exec(s.trim())
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`
}
