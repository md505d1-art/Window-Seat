# Orbit

Orbit is a personal workspace that combines three tools:

- **Flip**: inventory, listings and profit tracking for reselling clothes and accessories on Vinted, eBay and Depop.
- **Spark**: ideas, projects, task boards, roadmaps, a brainstorming canvas and an AI assistant.
- **Atlas**: saved places on a map, trip planning, a travel journal and travel statistics.

It is built with React 19, TypeScript, Tailwind CSS 4, shadcn-style components on Radix, Lucide icons, TanStack Query, Recharts, Leaflet, React Flow and dnd-kit. The backend is Supabase: Postgres with row-level security, Auth, private Storage and an Edge Function for AI.

## Run it locally

```bash
cd orbit
npm install
npm run dev            # http://localhost:5173
```

Without Supabase settings, sign-up is switched off and the login page offers **demo mode**. Demo mode keeps everything in this browser's IndexedDB on this device only, and the app labels it clearly wherever it applies. It is for trying Orbit out. It is not a substitute for the database.

## Connect Supabase (real accounts and storage)

1. Create a Supabase project.
2. Apply the schema. Either paste `supabase/migrations/20261107000000_orbit_init.sql` into the SQL editor, or run `supabase db push` with the Supabase CLI. This creates:
   - every table, with row-level security that allows only the owner's rows;
   - composite `(id, user_id)` foreign keys, so a row can never reference another user's record;
   - a trigger that creates a profile for each new user;
   - a `delete_my_account()` function;
   - the private `orbit-files` storage bucket, with per-user folder policies.
3. In **Authentication → URL configuration**, set the Site URL to where Orbit is hosted. Add `<site>/update-password` as a redirect URL for password resets.
4. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Settings → API). The anon key is meant to be public. Row-level security protects the data.

## Turn on AI (listing drafts and brainstorming)

The browser never sees the Anthropic key. It lives in the Edge Function's secrets:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy orbit-ai
```

The function (`supabase/functions/orbit-ai`) does three things:
- It checks the caller's Supabase session.
- It calls Claude (`claude-opus-5-5`) with JSON-schema structured outputs.
- It enables Anthropic's server-side refusal fallback (`fallbacks: "default"`), so a request a safety classifier declines is retried on Anthropic's recommended model.

Settings → AI shows whether the function is reachable and configured. When it isn't, the AI buttons stay disabled and say why. Orbit never shows made-up output in place of real AI responses. "Build from my details" formats a listing from your own data without AI.

## Deploy

`.github/workflows/pages.yml` builds Orbit on every push to `main`, runs the unit tests and publishes it to GitHub Pages at `/<repo>/orbit/`. Little Borough stays at the site root. To use Supabase in that build, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository **variables** (Settings → Secrets and variables → Actions → Variables). Without them the deployed site runs in demo mode.

Deep links such as `/orbit/flip/items/…` work through `deploy/gh-pages-404.html`, which forwards them to the app.

## Tests

```bash
npm test                 # unit tests: profit maths, listing rules, CSV import/export, geocoder parsing, search ranking
npm run test:rls         # applies the migration to a throwaway local PostgreSQL 15+ database and checks
                         # row-level security, cross-user references, storage folders, cascades and account deletion
npm run build && npx vite preview --port 4173 &
BASE=http://localhost:4173 npm run e2e
```

The end-to-end suite uses Playwright with Chromium in demo mode. It:
- starts from an empty account and adds an item, sells it and checks the profit;
- turns an idea into a project and moves a task with the keyboard;
- saves a place, plans a trip with a stop, writes a journal entry;
- checks search, notifications, workspace switching and data export;
- runs axe-core (WCAG 2 A/AA, serious and critical issues) on 19 pages in dark and light themes;
- checks that no page scrolls sideways at phone width (390px).

## How it fits together

| Area | Where |
| --- | --- |
| Data API (one interface, two implementations) | `src/lib/backend/` — `supabase.ts` (production), `local.ts` (demo mode) |
| Schema, RLS, storage policies | `supabase/migrations/` |
| Shell: sidebar, breadcrumbs, ⌘K palette, notifications | `src/components/layout/` |
| Home dashboard and widget settings | `src/features/home/` |
| Flip / Spark / Atlas | `src/features/{flip,spark,atlas}/` |
| Profit maths, listing rules, CSV | `src/lib/finance.ts`, `src/lib/listing.ts`, `src/lib/csv.ts` |

How the workspaces connect:
- A Spark project can be marked as a **reselling plan**. It then shows live Flip figures and appears in Flip's sales page.
- A Spark project can be linked to an **Atlas trip**.
- Home combines tasks, sales, projects, trips and favourites from all three.
- Search and notifications cover every workspace that's turned on.

## Limits to know about

- **Marketplaces:** Orbit does not post to Vinted, eBay or Depop; none offers a supported integration for this. Copy the listing text with the copy buttons and paste it into the marketplace's own form.
- **Maps:** map tiles and place search use OpenStreetMap's public services by default. They are fine for personal use. For heavier traffic, set `VITE_MAP_TILE_URL` / `VITE_GEOCODER_URL` to a commercial provider. Search runs only when you submit it (no autocomplete) and at most once a second, as OSM's policy asks.
- **Location:** only requested when you tap "Find me", and only once.
- **Notifications:** in-app only (no email or push).
- **AI pricing guidance:** an estimate based on your own past sales and the model's judgement, never a guaranteed price.
