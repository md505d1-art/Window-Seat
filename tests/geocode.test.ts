import { describe, expect, it } from 'vitest'
import { categorise, osmUrl, parseNominatim } from '../src/lib/geocode'
import { searchDocs } from '../src/lib/search-core'

describe('parseNominatim', () => {
  it('maps provider rows without inventing fields', () => {
    const rows = parseNominatim([
      {
        osm_type: 'way', osm_id: 25270282, lat: '38.6915837', lon: '-9.2159767', name: 'Torre de Belém', category: 'tourism', type: 'attraction',
        display_name: 'Torre de Belém, Avenida Brasília, Belém, Lisboa, Portugal',
        address: { city: 'Lisboa', country: 'Portugal', country_code: 'pt' },
      },
      { lat: 'x', lon: '1', display_name: 'broken' },
      { osm_type: 'relation', osm_id: 5400890, lat: '38.7077507', lon: '-9.1365919', name: 'Lisboa', category: 'boundary', type: 'administrative', display_name: 'Lisboa, Portugal', address: { country: 'Portugal', country_code: 'pt' } },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      ref: 'way/25270282', name: 'Torre de Belém', address: 'Torre de Belém, Avenida Brasília, Belém, Lisboa, Portugal', city: 'Lisboa',
      country: 'Portugal', country_code: 'pt', lat: 38.6915837, lng: -9.2159767, category: 'sight', kind: 'attraction',
    })
    expect(rows[1].category).toBe('city')
    expect(rows[1].city).toBe('')
  })
  it('categorises common place types', () => {
    expect(categorise('cafe')).toBe('food')
    expect(categorise('museum')).toBe('culture')
    expect(categorise('peak')).toBe('nature')
    expect(categorise('something', 'shop')).toBe('shop')
    expect(categorise('unknown')).toBe('other')
  })
  it('builds OpenStreetMap links', () => {
    expect(osmUrl('node/1', null, null)).toBe('https://www.openstreetmap.org/node/1')
    expect(osmUrl(null, 1.5, 2)).toBe('https://www.openstreetmap.org/?mlat=1.5&mlon=2#map=15/1.5/2')
    expect(osmUrl('bad', null, null)).toBeNull()
  })
})

describe('searchDocs', () => {
  const docs = [
    { id: '1', module: 'atlas' as const, kind: 'Trip', title: 'Long weekend in Lisbon', subtitle: 'Portugal', to: '/a', text: '' },
    { id: '2', module: 'spark' as const, kind: 'Idea', title: 'Lisbon photo series', subtitle: '', to: '/b', text: 'tiles trams' },
    { id: '3', module: 'flip' as const, kind: 'Item', title: 'Nike hoodie', subtitle: 'FL-0003', to: '/c', text: 'grey' },
  ]
  it('requires every word and ranks title-prefix matches first', () => {
    expect(searchDocs(docs, 'lisbon').map((h) => h.id)).toEqual(['2', '1'])
    expect(searchDocs(docs, 'lisbon trams').map((h) => h.id)).toEqual(['2'])
    expect(searchDocs(docs, 'fl-0003').map((h) => h.id)).toEqual(['3'])
    expect(searchDocs(docs, '   ')).toEqual([])
  })
})
