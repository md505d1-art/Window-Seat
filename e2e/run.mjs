// End-to-end check of Orbit in demo mode, using Playwright's Chromium.
//
//   npm run build && npx vite preview --port 4173 &   (or: npm run dev)
//   BASE=http://localhost:4173 npm run e2e
//
// Starts from an empty account and walks through every workspace, then runs axe-core
// accessibility checks and a phone-width overflow check on each main page.
// Map tiles and place search are stubbed so the run needs no internet access.
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const BASE = (process.env.BASE || 'http://localhost:4173').replace(/\/$/, '')
const OUT = new URL('./out/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

let failures = 0
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`)
  if (!cond) failures++
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true })
const page = await context.newPage()
const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`))
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
await page.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ body: png, contentType: 'image/png' }))
await page.route('https://nominatim.openstreetmap.org/search**', (r) =>
  r.fulfill({ json: [{ osm_type: 'node', osm_id: 42, lat: '51.5081', lon: '-0.0759', name: 'Tower of London', category: 'tourism', type: 'castle', display_name: 'Tower of London, London, England, United Kingdom', address: { city: 'London', country: 'United Kingdom', country_code: 'gb' } }] }),
)
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ body: '', contentType: 'text/css' }))
const toast = (text) => page.locator('[data-sonner-toast]', { hasText: text }).first().waitFor()
const appears = (locator) => locator.first().waitFor({ timeout: 8000 }).then(() => true, () => false)
const path = (p) => BASE + p

// ── Onboarding (demo mode, empty start) ─────────────────────────────────────
await page.goto(path('/'))
await page.getByRole('button', { name: 'Explore Orbit in demo mode' }).click()
await page.getByLabel('Your name').fill('Riley')
await page.getByRole('button', { name: 'Continue' }).click()
await page.getByRole('button', { name: 'Continue' }).click()
await page.getByRole('radio', { name: /Start empty/ }).click()
await page.getByRole('button', { name: 'Open my Orbit' }).click()
await page.getByRole('heading', { name: /Riley/ }).waitFor()
ok(await page.getByRole('dialog', { name: /Flip — your reselling desk/ }).isVisible(), 'guided tour starts after onboarding')
await page.getByRole('button', { name: 'Skip tour' }).click()
await page.waitForTimeout(300)

// ── Flip: add, sell, check profit ───────────────────────────────────────────
await page.goto(path('/flip/items/new'))
ok((await page.locator('#f-sku').inputValue()) === 'FL-0001', 'first item gets SKU FL-0001')
await page.locator('#f-title').fill("Levi's 501 jeans")
await page.locator('#f-brand').fill("Levi's")
await page.locator('#f-cost').fill('8')
await page.locator('#f-list').fill('30')
await page.getByRole('button', { name: 'Add to inventory' }).first().click()
await toast('added to inventory')
await page.locator('#f-status').selectOption('sold')
await page.locator('#f-sale').fill('28')
await page.locator('#f-fees').fill('1.40')
await page.locator('#f-ship').fill('3.10')
ok((await page.locator('div.rounded-xl[aria-live=polite]').innerText()).includes('£15.50'), 'net profit = 28 − 8 − 1.40 − 3.10 = £15.50')
await page.getByRole('button', { name: 'Save changes' }).first().click()
await toast('Saved')
await page.goto(path('/flip/sales'))
await page.getByText('Gross revenue').waitFor()
const stats = await page.locator('main').innerText()
ok(stats.includes('£28.00') && stats.includes('£15.50'), 'sales dashboard shows revenue £28.00 and profit £15.50')

// ── Spark: idea → project → task moved on the board ─────────────────────────
await page.goto(path('/spark'))
await page.getByRole('button', { name: 'Capture idea' }).first().click()
await page.getByLabel('Idea', { exact: true }).fill('Market stall pilot')
await page.getByRole('button', { name: 'Save idea' }).click()
await toast('Idea captured')
await page.getByRole('link', { name: /Market stall pilot/ }).first().click()
await page.getByRole('button', { name: 'Turn into project' }).click()
await page.getByRole('button', { name: 'Create project' }).click()
await page.waitForURL(/\/spark\/projects\//)
await page.getByRole('tab', { name: 'Tasks' }).click()
await page.locator('#qa-todo').fill('Book a pitch')
await page.locator('#qa-todo').press('Enter')
await page.getByText('Book a pitch').waitFor()
await page.locator('[aria-roledescription="sortable"]', { hasText: 'Book a pitch' }).focus()
await page.keyboard.press('Space')
await page.waitForTimeout(250)
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(250)
await page.keyboard.press('Space')
await page.waitForTimeout(500)
ok((await page.getByRole('region', { name: /^In progress/ }).innerText()).includes('Book a pitch'), 'keyboard drag moves a task to In progress')

// ── Atlas: search & save a place, plan a trip, add a stop, write a journal entry
await page.goto(path('/atlas'))
await page.getByLabel('Search for a place').fill('Tower of London')
await page.getByRole('button', { name: 'Search', exact: true }).click()
await page.getByRole('button', { name: 'Save Tower of London' }).click()
await page.getByRole('menuitem', { name: 'Want to visit' }).click()
await toast('saved')
await page.goto(path('/atlas/trips'))
await page.getByRole('button', { name: 'Plan a trip' }).first().click()
await page.locator('#trip-title').fill('London weekend')
await page.locator('#trip-start').fill('2030-05-01')
await page.locator('#trip-end').fill('2030-05-02')
await page.getByRole('button', { name: 'Create trip' }).click()
await page.waitForURL(/\/atlas\/trips\//)
await page.getByRole('button', { name: 'Add stop' }).first().click()
await page.locator('#st-title').fill('Crown Jewels')
await page.locator('#st-place').selectOption({ label: 'Tower of London (London)' })
await page.getByRole('button', { name: 'Add stop' }).last().click()
ok(await appears(page.getByText('Crown Jewels')), 'itinerary stop added to day 1')
await page.goto(path('/atlas/journal?new=1'))
await page.locator('#j-title').fill('First visit')
await page.getByRole('button', { name: 'Add to journal' }).click()
await toast('Memory added')

// ── Cross-module: search, notifications, home ───────────────────────────────
await page.goto(path('/search?q=london'))
ok((await appears(page.getByRole('link', { name: /London weekend/ }))) && (await appears(page.getByRole('link', { name: /Tower of London/ }))), 'unified search finds the trip and the place')
await page.goto(path('/notifications'))
ok(await appears(page.getByText(/Sold: Levi's 501 jeans/)), 'selling an item creates a notification')
await page.goto(path('/'))
ok(await appears(page.getByText('Market stall pilot')), 'home shows the active project')

// ── Settings: workspace toggle, theme, export ───────────────────────────────
await page.goto(path('/settings'))
await page.getByRole('switch', { name: 'Atlas workspace' }).click()
await page.waitForTimeout(300)
ok((await page.locator('aside nav[aria-label="Main"]').innerText()).includes('Atlas') === false, 'turning Atlas off hides it from navigation')
await page.getByRole('switch', { name: 'Atlas workspace' }).click()
await page.getByRole('radio', { name: 'Light' }).click()
ok(!(await page.evaluate(() => document.documentElement.classList.contains('dark'))), 'light theme applies')
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export JSON' }).click()])
const exported = JSON.parse(readFileSync(await download.path(), 'utf8'))
ok(exported.flip_items.length === 1 && exported.atlas_trips.length === 1, 'export contains the created item and trip')
await page.getByRole('radio', { name: 'Dark' }).click()

// ── Accessibility (axe-core) and phone layout on every main page ────────────
const routes = ['/', '/flip', '/flip/items/new', '/flip/listing', '/flip/sales', '/spark', '/spark/projects', '/spark/canvas', '/spark/assistant', '/atlas', '/atlas/map', '/atlas/trips', '/atlas/journal', '/atlas/stats', '/tasks', '/search', '/notifications', '/settings', '/profile']
for (const theme of ['Dark', 'Light']) {
  // Set the theme through Settings so the account preference matches (it is re-applied on each load).
  await page.goto(path('/settings'))
  await page.getByRole('radio', { name: theme }).click()
  await page.waitForTimeout(400)
  ok((await page.evaluate(() => document.documentElement.classList.contains('dark'))) === (theme === 'Dark'), `${theme.toLowerCase()} theme active for accessibility checks`)
  for (const r of routes) {
    await page.goto(path(r))
    await page.waitForTimeout(350)
    await page.addScriptTag({ content: axeSource })
    const res = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      const out = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'], resultTypes: ['violations'] })
      return out.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`)
    })
    ok(res.length === 0, `axe ${theme} ${r}${res.length ? `\n    ${res.join('\n    ')}` : ''}`)
  }
}
await page.setViewportSize({ width: 390, height: 844 })
for (const r of routes) {
  await page.goto(path(r))
  await page.waitForTimeout(300)
  const { overflow, culprits } = await page.evaluate(() => ({
    overflow: Math.max(document.documentElement.scrollWidth, document.querySelector('#orbit-main')?.scrollWidth ?? 0) - window.innerWidth,
    culprits: [...document.querySelectorAll('#orbit-main *')]
      .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest('[class*="overflow-x-auto"],.leaflet-container,.react-flow'))
      .slice(0, 3)
      .map((e) => `${e.tagName.toLowerCase()} "${(e.textContent || '').trim().slice(0, 40)}"`),
  }))
  ok(overflow <= 0, `no sideways scroll at 390px on ${r}${overflow > 0 ? ` (${overflow}px: ${culprits.join(', ')})` : ''}`)
}
await page.screenshot({ path: `${OUT}phone-profile.png` })

ok(consoleErrors.length === 0, `no console errors${consoleErrors.length ? `:\n    ${consoleErrors.slice(0, 5).join('\n    ')}` : ''}`)
await browser.close()
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
