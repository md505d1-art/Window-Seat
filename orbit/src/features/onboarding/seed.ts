import { addDays, format, subDays } from 'date-fns'
import type { Backend } from '@/lib/backend/types'
import type { NewRow } from '@/lib/types'

const d = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd')
const ago = (days: number) => format(subDays(new Date(), days), 'yyyy-MM-dd')

/**
 * Optional sample data, offered during onboarding. Every row is flagged is_demo so the UI
 * labels it "Demo" and Settings can remove it in one go. Places use real, public coordinates;
 * no ratings, prices or opening hours are invented.
 */
export async function seedDemoData(backend: Backend, ws: { flip: boolean; spark: boolean; atlas: boolean }) {
  const demo = { is_demo: true }
  let tripId: string | null = null

  if (ws.atlas) {
    const [lisbon, edinburgh] = await backend.insertMany('atlas_trips', [
      {
        ...demo, title: 'Long weekend in Lisbon', destination: 'Lisbon, Portugal', start_date: d(21), end_date: d(24),
        description: 'Tiles, tram 28 and as many pastéis de nata as possible.', budget: 650, currency: 'GBP',
        accommodation_notes: 'Apartment in Alfama — check-in from 3pm.', transport_notes: 'Flights from LGW. Get a Viva Viagem card at the airport.',
      },
      {
        ...demo, title: 'Edinburgh in the autumn', destination: 'Edinburgh, Scotland', start_date: ago(62), end_date: ago(59),
        description: 'Old Town walks and a climb up Arthur’s Seat.', budget: 400, currency: 'GBP',
        accommodation_notes: 'Hotel near the Royal Mile.', transport_notes: 'LNER from King’s Cross.',
      },
    ])
    tripId = lisbon.id

    const [favs, food] = await backend.insertMany('atlas_collections', [
      { ...demo, name: 'Bucket list' },
      { ...demo, name: 'Food spots' },
    ])

    const places = await backend.insertMany('atlas_places', [
      { ...demo, name: 'Belém Tower', city: 'Lisbon', country: 'Portugal', country_code: 'pt', lat: 38.6916, lng: -9.216, category: 'sight', status: 'want', notes: 'Go early to beat the queue.' },
      { ...demo, name: 'LX Factory', city: 'Lisbon', country: 'Portugal', country_code: 'pt', lat: 38.7034, lng: -9.1784, category: 'shop', status: 'want', notes: 'Bookshop and Sunday market.' },
      { ...demo, name: 'Time Out Market Lisboa', city: 'Lisbon', country: 'Portugal', country_code: 'pt', lat: 38.7071, lng: -9.1458, category: 'food', status: 'want' },
      { ...demo, name: 'Edinburgh Castle', city: 'Edinburgh', country: 'United Kingdom', country_code: 'gb', lat: 55.9486, lng: -3.1999, category: 'sight', status: 'visited', visited_on: ago(61), favourite: true },
      { ...demo, name: 'Arthur’s Seat', city: 'Edinburgh', country: 'United Kingdom', country_code: 'gb', lat: 55.9441, lng: -3.1618, category: 'nature', status: 'visited', visited_on: ago(60), notes: 'Windy at the top — worth it.' },
      { ...demo, name: 'Rijksmuseum', city: 'Amsterdam', country: 'Netherlands', country_code: 'nl', lat: 52.36, lng: 4.8852, category: 'culture', status: 'visited', visited_on: ago(400) },
      { ...demo, name: 'Fushimi Inari Taisha', city: 'Kyoto', country: 'Japan', country_code: 'jp', lat: 34.9671, lng: 135.7727, category: 'culture', status: 'want', favourite: true, notes: 'Walk the full trail at sunrise.' },
      { ...demo, name: 'Hallgrímskirkja', city: 'Reykjavík', country: 'Iceland', country_code: 'is', lat: 64.1417, lng: -21.9266, category: 'sight', status: 'want' },
    ])
    const [belem, lx, market, castle, seat, , inari, hall] = places
    await backend.insertMany('atlas_place_collections', [
      { ...demo, place_id: inari.id, collection_id: favs.id },
      { ...demo, place_id: hall.id, collection_id: favs.id },
      { ...demo, place_id: market.id, collection_id: food.id },
    ])
    await backend.insertMany('atlas_trip_places', [
      { ...demo, trip_id: lisbon.id, place_id: belem.id },
      { ...demo, trip_id: lisbon.id, place_id: lx.id },
      { ...demo, trip_id: lisbon.id, place_id: market.id },
      { ...demo, trip_id: edinburgh.id, place_id: castle.id },
      { ...demo, trip_id: edinburgh.id, place_id: seat.id },
    ])
    await backend.insertMany('atlas_stops', [
      { ...demo, trip_id: lisbon.id, day: d(21), position: 1000, time: '15:00', kind: 'stay', title: 'Check in at the apartment' },
      { ...demo, trip_id: lisbon.id, day: d(21), position: 2000, time: '19:30', kind: 'food', title: 'Dinner at Time Out Market', place_id: market.id },
      { ...demo, trip_id: lisbon.id, day: d(22), position: 1000, time: '09:00', kind: 'activity', title: 'Belém Tower and the riverside walk', place_id: belem.id },
      { ...demo, trip_id: lisbon.id, day: d(22), position: 2000, time: '14:00', kind: 'activity', title: 'Browse LX Factory', place_id: lx.id },
      { ...demo, trip_id: lisbon.id, day: d(23), position: 1000, time: '10:00', kind: 'transport', title: 'Tram 28 across the old town' },
      { ...demo, trip_id: edinburgh.id, day: ago(61), position: 1000, time: '10:00', kind: 'activity', title: 'Edinburgh Castle', place_id: castle.id },
      { ...demo, trip_id: edinburgh.id, day: ago(60), position: 1000, time: '08:00', kind: 'activity', title: 'Sunrise climb up Arthur’s Seat', place_id: seat.id },
    ])
    await backend.insertMany('atlas_checklist', [
      { ...demo, trip_id: lisbon.id, label: 'Passport (valid for 3+ months)', done: true, position: 1000 },
      { ...demo, trip_id: lisbon.id, label: 'Book airport transfer', done: false, position: 2000 },
      { ...demo, trip_id: lisbon.id, label: 'Travel insurance', done: true, position: 3000 },
      { ...demo, trip_id: lisbon.id, label: 'EU plug adapter', done: false, position: 4000 },
      { ...demo, trip_id: lisbon.id, label: 'Download offline maps', done: false, position: 5000 },
    ])
    await backend.insertMany('atlas_journal', [
      { ...demo, trip_id: edinburgh.id, place_id: seat.id, title: 'Sunrise on Arthur’s Seat', entry_date: ago(60), tags: ['hiking', 'sunrise'], favourite: true, body: 'Left the hotel at 6:30. Fog over the city until the sun came through — the whole Old Town lit up gold.' },
      { ...demo, trip_id: edinburgh.id, place_id: castle.id, title: 'Castle and the one o’clock gun', entry_date: ago(61), tags: ['history'], body: 'Made it just in time for the gun. The crown jewels queue was shorter than expected.' },
      { ...demo, title: 'Rijksmuseum afternoon', entry_date: ago(400), tags: ['art', 'museums'], body: 'Spent an hour in front of The Night Watch. Need to come back for the library.' },
    ])
  }

  if (ws.flip) {
    const brands: [string, string, string, string, string][] = [
      // brand, category, size, colour, condition
      ["Levi's", 'Jeans', 'W32 L30', 'Blue', 'Very good, light fading'],
      ['Carhartt', 'Jacket', 'L', 'Brown', 'Good, worn cuffs'],
      ['Nike', 'Hoodie', 'M', 'Grey', 'Very good'],
      ['Ralph Lauren', 'Jumper', 'M', 'Navy', 'Excellent'],
      ['Patagonia', 'Fleece', 'S', 'Green', 'Good'],
      ['Dr. Martens', 'Boots', 'UK 7', 'Black', 'Good, some creasing'],
      ['Barbour', 'Jacket', 'XL', 'Olive', 'Good, rewaxed'],
      ['Adidas', 'Track top', 'M', 'Blue', 'Very good'],
      ['Stone Island', 'Sweatshirt', 'L', 'Black', 'Very good'],
      ['Zara', 'Dress', 'S', 'Red', 'New with tags'],
      ['Arc’teryx', 'Jacket', 'M', 'Black', 'Excellent'],
      ['Nike', 'Trainers', 'UK 9', 'White', 'Good, cleaned'],
    ]
    const plan: { status: NewRow<'flip_items'>['status']; cost: number; list: number; sale?: number; fees?: number; ship?: number; soldAgo?: number; boughtAgo: number; platform: string }[] = [
      { status: 'sold', cost: 8, list: 35, sale: 32, fees: 1.6, ship: 3.39, soldAgo: 150, boughtAgo: 170, platform: 'Vinted' },
      { status: 'sold', cost: 22, list: 75, sale: 68, fees: 8.6, ship: 4.5, soldAgo: 118, boughtAgo: 140, platform: 'eBay' },
      { status: 'sold', cost: 6, list: 28, sale: 25, fees: 1.25, ship: 3.39, soldAgo: 95, boughtAgo: 120, platform: 'Depop' },
      { status: 'sold', cost: 9, list: 40, sale: 38, fees: 1.9, ship: 3.39, soldAgo: 64, boughtAgo: 90, platform: 'Vinted' },
      { status: 'sold', cost: 12, list: 45, sale: 42, fees: 5.3, ship: 3.99, soldAgo: 33, boughtAgo: 60, platform: 'eBay' },
      { status: 'sold', cost: 15, list: 55, sale: 50, fees: 2.5, ship: 4.5, soldAgo: 9, boughtAgo: 40, platform: 'Vinted' },
      { status: 'reserved', cost: 30, list: 95, boughtAgo: 30, platform: 'eBay' },
      { status: 'listed', cost: 5, list: 24, boughtAgo: 25, platform: 'Vinted' },
      { status: 'listed', cost: 18, list: 70, boughtAgo: 20, platform: 'Depop' },
      { status: 'ready', cost: 4, list: 18, boughtAgo: 12, platform: '' },
      { status: 'draft', cost: 35, list: 120, boughtAgo: 5, platform: '' },
      { status: 'draft', cost: 7, list: 30, boughtAgo: 2, platform: '' },
    ]
    await backend.insertMany(
      'flip_items',
      plan.map((p, i) => {
        const [brand, category, size, colour, condition] = brands[i]
        return {
          ...demo,
          sku: `FL-${String(i + 1).padStart(4, '0')}`,
          title: `${brand} ${category.toLowerCase()} ${colour.toLowerCase()} size ${size.toLowerCase()} FL-${String(i + 1).padStart(4, '0')}`,
          brand, category, size, colour, condition,
          status: p.status,
          platform: p.platform,
          purchase_price: p.cost,
          listing_price: p.list,
          sale_price: p.sale ?? null,
          seller_fees: p.fees ?? 0,
          shipping_cost: p.ship ?? 0,
          purchase_date: ago(p.boughtAgo),
          listed_date: p.status === 'draft' || p.status === 'ready' ? null : ago(Math.max(0, p.boughtAgo - 3)),
          sold_date: p.soldAgo !== undefined ? ago(p.soldAgo) : null,
          favourite: i === 6,
          notes: i === 1 ? 'Double-knee. Small paint mark on left leg shown in photo 4.' : '',
        }
      }),
    )
  }

  if (ws.spark) {
    const [business, travel] = await backend.insertMany('spark_folders', [
      { ...demo, name: 'Business', position: 1000 },
      { ...demo, name: 'Travel & content', position: 2000 },
    ])
    const projects = await backend.insertMany('spark_projects', [
      {
        ...demo, name: 'Grow the reselling side hustle', kind: 'reselling', linked_flip: true, status: 'active',
        description: 'Reach a steady £500 a month profit from Flip by sourcing smarter and listing faster.',
        start_date: ago(30), due_date: d(60), color: 'emerald', favourite: true,
      },
      ...(tripId
        ? [{
            ...demo, name: 'Lisbon photo series', kind: 'travel' as const, linked_trip_id: tripId, status: 'planning' as const,
            description: 'A 12-photo series on Lisbon’s tiles and trams, edited for a small print run.', start_date: d(0), due_date: d(45), color: 'sky',
          }]
        : []),
    ])
    const [resell, photo] = projects
    const [m1, m2] = await backend.insertMany('spark_milestones', [
      { ...demo, project_id: resell.id, title: 'Sourcing system', due_date: d(7), position: 1000, done: false },
      { ...demo, project_id: resell.id, title: 'Listing workflow under 10 minutes', due_date: d(30), position: 2000 },
      { ...demo, project_id: resell.id, title: '£500 profit month', due_date: d(60), position: 3000 },
    ])
    await backend.insertMany('spark_tasks', [
      { ...demo, project_id: resell.id, milestone_id: m1.id, title: 'Map five charity shops on the weekend route', status: 'completed', priority: 'medium', position: 1000, completed_at: new Date().toISOString() },
      { ...demo, project_id: resell.id, milestone_id: m1.id, title: 'Set a maximum buy price per category', status: 'in_progress', priority: 'high', due_date: d(2), position: 2000 },
      { ...demo, project_id: resell.id, milestone_id: m2.id, title: 'Photo backdrop and lighting setup', status: 'todo', priority: 'medium', due_date: d(9), position: 3000 },
      { ...demo, project_id: resell.id, milestone_id: m2.id, title: 'Draft listing templates in Flip', status: 'in_review', priority: 'medium', position: 4000 },
      { ...demo, project_id: resell.id, title: 'Research bulk shipping discounts', status: 'backlog', priority: 'low', position: 5000 },
      ...(photo
        ? [
            { ...demo, project_id: photo.id, title: 'Shot list for each neighbourhood', status: 'todo' as const, priority: 'high' as const, due_date: d(14), position: 1000 },
            { ...demo, project_id: photo.id, title: 'Pick a print lab and paper', status: 'backlog' as const, priority: 'low' as const, position: 2000 },
          ]
        : []),
      { ...demo, title: 'Renew railcard', module: 'general', status: 'todo', priority: 'medium', due_date: d(5), position: 1000 },
    ])
    await backend.insertMany('spark_ideas', [
      { ...demo, folder_id: business.id, title: 'Weekly “best finds” newsletter', description: 'Share sourcing hauls and link the live listings. Could grow repeat buyers.', category: 'Business', tags: ['newsletter', 'reselling'], stage: 'exploring', favourite: true },
      { ...demo, folder_id: business.id, title: 'Bundle discounts for repeat buyers', description: 'Offer 10% off bundles of three or more.', category: 'Business', tags: ['pricing'], stage: 'inbox' },
      { ...demo, folder_id: business.id, title: 'Grow the reselling side hustle', description: 'Turned into a project.', category: 'Business', tags: ['goals'], stage: 'converted', project_id: resell.id },
      { ...demo, folder_id: travel.id, title: 'Tile pattern print series', description: 'Collect tile patterns from each trip and design a print set.', category: 'Creative', tags: ['photography', 'design'], stage: 'promising', links: [{ url: 'https://en.wikipedia.org/wiki/Azulejo', label: 'Azulejo (Wikipedia)' }] },
      { ...demo, folder_id: travel.id, title: 'Rail-only Europe route', description: 'London → Paris → Barcelona → Lisbon without flying.', category: 'Travel', tags: ['rail'], stage: 'inbox' },
      { ...demo, title: 'Habit tracker for sourcing trips', description: 'Log spend vs. finds per shop to see which routes pay off.', category: 'App', tags: ['app'], stage: 'exploring' },
    ])
    await backend.insert('spark_canvases', {
      ...demo,
      name: 'Reselling brainstorm',
      project_id: resell.id,
      data: {
        viewport: { x: 40, y: 40, zoom: 0.9 },
        nodes: [
          { id: 'n1', type: 'sticky', position: { x: 0, y: 0 }, data: { text: 'Where do I find stock?', color: 'yellow' } },
          { id: 'n2', type: 'sticky', position: { x: 300, y: -80 }, data: { text: 'Charity shops — weekend loop', color: 'green' } },
          { id: 'n3', type: 'sticky', position: { x: 300, y: 90 }, data: { text: 'Car boot sales (early!)', color: 'green' } },
          { id: 'n4', type: 'sticky', position: { x: 600, y: 0 }, data: { text: 'Track buy price vs sale price per source', color: 'violet' } },
          { id: 'n5', type: 'link', position: { x: 0, y: 200 }, data: { url: 'https://www.vinted.co.uk', title: 'Vinted' } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e2', source: 'n1', target: 'n3' },
          { id: 'e3', source: 'n2', target: 'n4' },
          { id: 'e4', source: 'n3', target: 'n4' },
        ],
      },
    })
  }

  await backend.insertMany('activity', [
    { ...demo, module: 'orbit', action: 'added sample data', entity_type: 'workspace', title: 'Demo content for your workspaces', link: '/settings' },
  ])
  await backend.insertIgnore('notifications', {
    ...demo, module: 'orbit', title: 'Sample data added', body: 'Everything marked “Demo” can be removed in Settings → Data.', link: '/settings', dedupe_key: 'demo-seeded',
  })
}

export async function removeDemoData(backend: Backend) {
  const tables = [
    'spark_tasks', 'spark_milestones', 'spark_canvases', 'spark_ideas', 'spark_projects', 'spark_folders',
    'atlas_stops', 'atlas_checklist', 'atlas_journal', 'atlas_place_collections', 'atlas_trip_places', 'atlas_places',
    'atlas_collections', 'atlas_trips', 'flip_items', 'activity', 'notifications', 'files',
  ] as const
  for (const t of tables) await backend.removeWhere(t, { is_demo: true })
}
