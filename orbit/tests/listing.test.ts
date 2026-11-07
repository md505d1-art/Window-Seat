import { describe, expect, it } from 'vitest'
import { applyCasing, buildHashtags, describeFromTitle, composeDescription, composeTitle, fullListingText, missingFacts, nextSku, normaliseHashtags, normaliseTitle } from '../src/lib/listing'

describe('casing rules', () => {
  it('lowercases everything except brands and proper nouns', () => {
    expect(applyCasing('Vintage Levi\'s 501 Jeans In Blue', ["Levi's"])).toBe("vintage Levi's 501 jeans in blue")
  })
  it('keeps proper nouns supplied by the person', () => {
    expect(applyCasing('Barbour Bedale Wax Jacket', ['Barbour', 'Bedale'])).toBe('Barbour Bedale wax jacket')
  })
  it('only protects whole words', () => {
    expect(applyCasing('NIKEFAN Nike Tee', ['Nike'])).toBe('nikefan Nike tee')
  })
})

describe('composeTitle', () => {
  it('puts the SKU at the end and lowercases the rest', () => {
    expect(composeTitle({ brand: 'Ralph Lauren', description: 'Cable Knit Jumper', colour: 'Navy', size: 'M', sku: 'FL-0042' })).toBe(
      'Ralph Lauren cable knit jumper navy size m FL-0042',
    )
  })
  it('does not repeat brand, colour or size already in the description', () => {
    expect(composeTitle({ brand: 'Nike', description: 'nike black hoodie size m', colour: 'Black', size: 'M', sku: 'FL-0003' })).toBe('Nike black hoodie size m FL-0003')
  })
  it('extracts what the item is from an existing title', () => {
    expect(describeFromTitle({ title: "Arc'teryx jacket black size m FL-0011", brand: "Arc'teryx", sku: 'FL-0011', colour: 'Black', size: 'M', category: 'Jacket' })).toBe('jacket')
    expect(describeFromTitle({ title: '', brand: 'X', sku: 'FL-1', colour: '', size: '', category: 'Boots' })).toBe('boots')
  })
  it('works without a brand', () => {
    expect(composeTitle({ brand: '', description: 'linen shirt', colour: '', size: '', sku: 'FL-0001' })).toBe('linen shirt FL-0001')
  })
})

describe('normaliseTitle', () => {
  it('moves an SKU written mid-title to the end, once', () => {
    expect(normaliseTitle('FL-0007 Nike Air Max Trainers White', 'Nike', 'FL-0007', ['Air Max'])).toBe('Nike Air Max trainers white FL-0007')
  })
})

describe('hashtags', () => {
  it('always returns exactly five unique tags', () => {
    const tags = buildHashtags({ brand: 'Carhartt', category: 'Jacket', colour: 'Brown', title: 'vintage workwear jacket' })
    expect(tags).toHaveLength(5)
    expect(new Set(tags).size).toBe(5)
    expect(tags.slice(0, 2)).toEqual(['#carhartt', '#jacket'])
    expect(tags.every((t) => /^#[a-z0-9]+$/.test(t))).toBe(true)
  })
  it('still returns five with almost no details', () => {
    expect(buildHashtags({ brand: '', category: '', colour: '', title: '' })).toHaveLength(5)
  })
  it('normalises messy AI tags to five', () => {
    const t = normaliseHashtags(['#Y2K Fashion', 'y2k fashion', '#', 'Baggy Jeans!', 'denim', 'levis', 'streetwear', 'extra'], { brand: "Levi's", category: 'Jeans', colour: '', title: '' })
    expect(t).toEqual(['#y2kfashion', '#baggyjeans', '#denim', '#levis', '#streetwear'])
  })
})

describe('description and verification', () => {
  const item = { brand: 'Arc\'teryx', category: 'Fleece', size: 'L', colour: 'Black', condition: 'Good, small mark on cuff', measurements: 'pit to pit 58cm', notes: '' }
  it('builds short bullets only from entered facts', () => {
    const d = composeDescription(item)
    expect(d.split('\n')).toHaveLength(6)
    expect(d).toContain("• brand: Arc'teryx")
    expect(d).toContain('• condition: good, small mark on cuff — please see photos')
  })
  it('asks the person to verify missing facts instead of inventing them', () => {
    const m = missingFacts({ brand: '', size: '', condition: '', colour: 'red', category: 'dress', measurements: '' })
    expect(m.join(' ')).toMatch(/Brand/)
    expect(m.join(' ')).toMatch(/Condition/)
    expect(m.join(' ')).not.toMatch(/Colour/)
  })
  it('formats a full listing for copying', () => {
    expect(fullListingText({ title: 't', description: 'd', hashtags: ['#a', '#b'] })).toBe('t\n\nd\n\n#a #b')
  })
})

describe('nextSku', () => {
  it('continues the highest FL number', () => {
    expect(nextSku(['FL-0001', 'FL-0009', 'OTHER-55', 'fl-0003'])).toBe('FL-0010')
    expect(nextSku([])).toBe('FL-0001')
  })
})
