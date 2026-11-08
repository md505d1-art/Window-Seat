// Renders the Orbit brand assets from brand/*.svg using Playwright's Chromium.
//   node scripts/build-icons.mjs
// Outputs app icons, favicons and Apple touch icon into public/, the link-preview image
// (public/og-image.png) and the GitHub social preview (.github/social-preview.png).
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const { chromium } = createRequire(import.meta.url)('playwright')
const root = new URL('../', import.meta.url).pathname
const svg = (name) => `data:image/svg+xml;base64,${Buffer.from(readFileSync(`${root}brand/${name}`)).toString('base64')}`

const browser = await chromium.launch()
const page = await browser.newPage()

async function renderIcon(src, size, out, { transparent = true } = {}) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:transparent"><img src="${src}" width="${size}" height="${size}" style="display:block"></body></html>`)
  await page.locator('img').evaluate((img) => img.decode())
  writeFileSync(`${root}${out}`, await page.screenshot({ omitBackground: transparent, type: 'png' }))
  console.log('wrote', out)
}

await renderIcon(svg('icon.svg'), 192, 'public/icon-192.png')
await renderIcon(svg('icon.svg'), 512, 'public/icon-512.png')
await renderIcon(svg('icon-maskable.svg'), 512, 'public/icon-maskable-512.png', { transparent: false })
await renderIcon(svg('icon-maskable.svg'), 180, 'public/apple-touch-icon.png', { transparent: false })
await renderIcon(svg('favicon.svg'), 32, 'public/favicon-32.png')

async function renderCard(width, height, out) {
  await page.setViewportSize({ width, height })
  const k = width / 1200
  await page.setContent(`<!doctype html><html><head><style>
    *{box-sizing:border-box;margin:0}
    body{width:${width}px;height:${height}px;overflow:hidden;font-family:'Inter Display','Inter',system-ui,sans-serif;color:#f8fafc;
      background:radial-gradient(900px 600px at 18% 30%,#2a1d52 0%,transparent 60%),radial-gradient(700px 500px at 95% 100%,#0c2f45 0%,transparent 60%),#0b0d12}
    .wrap{position:absolute;inset:0;padding:${80 * k}px ${92 * k}px;display:flex;align-items:center;gap:${64 * k}px}
    img{width:${300 * k}px;height:${300 * k}px;flex:none;filter:drop-shadow(0 ${24 * k}px ${48 * k}px rgba(0,0,0,.5))}
    h1{font-size:${132 * k}px;font-weight:700;letter-spacing:-.04em;line-height:.95}
    p{margin-top:${18 * k}px;font-size:${34 * k}px;line-height:1.3;color:#cbd5e1;max-width:${640 * k}px}
    .chips{display:flex;gap:${14 * k}px;margin-top:${38 * k}px}
    .chip{display:flex;align-items:center;gap:${10 * k}px;padding:${11 * k}px ${18 * k}px;border-radius:${999}px;font-size:${24 * k}px;font-weight:600;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)}
    .dot{width:${14 * k}px;height:${14 * k}px;border-radius:50%}
    .ring{position:absolute;border:${2 * k}px solid rgba(248,250,252,.08);border-radius:50%;transform:rotate(-24deg)}
  </style></head><body>
    <div class="ring" style="width:${1400 * k}px;height:${520 * k}px;left:${-120 * k}px;top:${70 * k}px"></div>
    <div class="ring" style="width:${1900 * k}px;height:${760 * k}px;left:${-360 * k}px;top:${-40 * k}px"></div>
    <div class="wrap">
      <img src="${svg('icon.svg')}" alt="">
      <div>
        <h1>Orbit</h1>
        <p>Your reselling, ideas and travel in one personal workspace.</p>
        <div class="chips">
          <span class="chip"><span class="dot" style="background:#10b981"></span>Flip</span>
          <span class="chip"><span class="dot" style="background:#a855f7"></span>Spark</span>
          <span class="chip"><span class="dot" style="background:#38bdf8"></span>Atlas</span>
        </div>
      </div>
    </div>
  </body></html>`)
  await page.locator('img').evaluate((img) => img.decode())
  await page.evaluate(() => document.fonts.ready)
  writeFileSync(`${root}${out}`, await page.screenshot({ type: 'png' }))
  console.log('wrote', out)
}

mkdirSync(`${root}.github`, { recursive: true })
await renderCard(1200, 630, 'public/og-image.png')
await renderCard(1280, 640, '.github/social-preview.png')
await browser.close()
