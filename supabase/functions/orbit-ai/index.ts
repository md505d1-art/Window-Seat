// Orbit AI — Supabase Edge Function (Deno).
//
// Generates Flip listing drafts (with photos) and Spark brainstorms using Claude.
// The Anthropic API key lives only in this function's secrets:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy orbit-ai
// Every request must carry a signed-in user's Supabase JWT.

import Anthropic from 'npm:@anthropic-ai/sdk@1.6.0'
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const MODEL = 'claude-opus-5-5'
const MAX_IMAGES = 4
const MAX_IMAGE_BASE64 = 5_000_000 // ~3.7 MB per image after base64
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function fail(status: number, error: string, message: string) {
  return json({ error, message }, status)
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

// ─── listing ─────────────────────────────────────────────────────────────────
const LISTING_SYSTEM = `You write second-hand clothing and accessory listings for marketplaces such as Vinted, eBay and Depop, for a UK reseller.

Rules you must follow:
- Use only facts given by the seller or clearly visible in the photos. Never invent a brand, size, material, measurement, condition detail or defect. If something matters and you can't confirm it, add a short entry to "verify" asking the seller to check it instead of guessing.
- Title: lowercase except brand names and proper nouns (keep the brand exactly as the seller wrote it). Describe the item plainly: brand, what it is, key style, colour, size. Do not include the SKU; it is appended separately. No emoji, no hype words, no ALL CAPS.
- Bullets: 3 to 7 short bullet points, lowercase except brand names and proper nouns, no leading bullet characters. Cover type, size, colour, condition (as described by the seller), measurements and notable details.
- Hashtags: exactly five, relevant to this item, lowercase, letters and digits only, no "#".
- Category: a short marketplace category such as "jacket", "jeans", "trainers".
- Pricing: suggest a realistic resale range in the seller's currency, based on the brand, type, condition and the seller's own comparable sales when given. It is an estimate, never a guarantee. If you have no reasonable basis, set price_estimate_available to false and both prices to 0.
- price_rationale: one or two plain sentences explaining the range.`

const LISTING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'bullets', 'hashtags', 'category', 'price_estimate_available', 'price_low', 'price_high', 'price_rationale', 'verify'],
  properties: {
    title: { type: 'string' },
    bullets: { type: 'array', items: { type: 'string' } },
    hashtags: { type: 'array', items: { type: 'string' } },
    category: { type: 'string' },
    price_estimate_available: { type: 'boolean' },
    price_low: { type: 'number' },
    price_high: { type: 'number' },
    price_rationale: { type: 'string' },
    verify: { type: 'array', items: { type: 'string' } },
  },
}

interface ListingModelOutput {
  title: string
  bullets: string[]
  hashtags: string[]
  category: string
  price_estimate_available: boolean
  price_low: number
  price_high: number
  price_rationale: string
  verify: string[]
}

// ─── brainstorm ──────────────────────────────────────────────────────────────
const MODES: Record<string, string> = {
  expand: 'Expand the concept: what it could become, in concrete terms',
  features: 'Possible features',
  audience: 'Target audiences and what each needs',
  opportunities: 'Opportunities and challenges (label each item as an opportunity or a challenge in its title)',
  names: 'Project name ideas (title = the name, detail = why it fits)',
  approach: 'Suggested development approach (tools, skills, order of work)',
  plan: 'Structured implementation plan, as ordered steps',
  mvp: 'Minimum viable product: the smallest set of tasks that tests the idea, each phrased as an actionable task',
  milestones: 'Milestones that break the project into checkpoints, in order, each phrased as an outcome',
}

const BRAINSTORM_SYSTEM = `You are a practical thinking partner helping someone develop an idea into a project they can start this week.
Be specific to their idea and context; avoid generic advice. Keep each item's title under 80 characters and its detail to one or two sentences.
Give 3 to 7 items per section. Write in British English, plainly, without hype.`

function brainstormSchema(modes: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'sections'],
    properties: {
      summary: { type: 'string' },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['mode', 'heading', 'items'],
          properties: {
            mode: { type: 'string', enum: modes },
            heading: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'detail'],
                properties: { title: { type: 'string' }, detail: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  }
}

// ─── Claude call ─────────────────────────────────────────────────────────────
async function generate(
  client: Anthropic,
  opts: { system: string; content: Anthropic.Beta.BetaContentBlockParam[]; schema: Record<string, unknown>; effort: 'low' | 'medium' | 'high' },
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: opts.system,
    messages: [{ role: 'user', content: opts.content }],
    output_config: { effort: opts.effort, format: { type: 'json_schema', schema: opts.schema } },
    // Server-side fallback: if a safety classifier declines, the request is retried on
    // Anthropic's recommended model for that refusal category.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  })
  if (response.stop_reason === 'refusal') {
    return { ok: false, response: fail(422, 'refused', 'The AI declined this request. Try rewording it or removing anything unrelated to the task.') }
  }
  if (response.stop_reason === 'max_tokens') {
    return { ok: false, response: fail(502, 'incomplete', 'The AI response was cut short. Try again with less text.') }
  }
  const text = response.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text
  if (!text) return { ok: false, response: fail(502, 'empty', 'The AI returned no content. Try again.') }
  try {
    return { ok: true, data: JSON.parse(text) }
  } catch {
    return { ok: false, response: fail(502, 'bad_output', 'The AI returned an unreadable response. Try again.') }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail(405, 'method', 'Use POST.')

  // Only signed-in Orbit users may call this function.
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return fail(401, 'unauthorised', 'Sign in to use AI features.')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail(400, 'bad_request', 'The request body must be JSON.')
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (body.task === 'status') return json({ configured: Boolean(apiKey), model: MODEL })
  if (!apiKey) return fail(503, 'not_configured', 'ANTHROPIC_API_KEY is not set for the orbit-ai function.')

  const client = new Anthropic({ apiKey })

  try {
    if (body.task === 'listing') {
      const facts = (body.facts ?? {}) as Record<string, unknown>
      const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : []
      const content: Anthropic.Beta.BetaContentBlockParam[] = []
      for (const img of images as { data?: unknown; media_type?: unknown }[]) {
        const data = typeof img.data === 'string' ? img.data : ''
        const type = typeof img.media_type === 'string' ? img.media_type : ''
        if (!data || data.length > MAX_IMAGE_BASE64 || !IMAGE_TYPES.has(type)) continue
        content.push({ type: 'image', source: { type: 'base64', media_type: type as 'image/jpeg', data } })
      }
      const comparable = (Array.isArray(body.comparable_sales) ? body.comparable_sales : []).slice(0, 25)
      const seller = {
        brand: str(facts.brand, 120),
        what_it_is: str(facts.what_it_is, 200),
        category: str(facts.category, 80),
        size: str(facts.size, 60),
        colour: str(facts.colour, 60),
        condition: str(facts.condition, 300),
        measurements: str(facts.measurements, 300),
        notes: str(facts.notes, 1000),
        proper_nouns_to_keep_capitalised: (Array.isArray(facts.proper_nouns) ? facts.proper_nouns : []).map((p) => str(p, 60)).slice(0, 10),
        currency: str(facts.currency, 3) || 'GBP',
      }
      content.push({
        type: 'text',
        text:
          `${content.length ? `${content.length} photo(s) of the item are attached above.` : 'No photos were provided.'}\n\n` +
          `Seller's details (blank means unknown — don't fill it in):\n${JSON.stringify(seller, null, 2)}\n\n` +
          `Seller's own comparable past sales:\n${comparable.length ? JSON.stringify(comparable) : 'none'}\n\n` +
          'Write the listing.',
      })
      const r = await generate(client, { system: LISTING_SYSTEM, content, schema: LISTING_SCHEMA, effort: 'medium' })
      if (!r.ok) return r.response
      const out = r.data as ListingModelOutput
      const hasPrice = out.price_estimate_available && out.price_high > 0 && out.price_low >= 0 && out.price_low <= out.price_high
      return json({
        title: out.title,
        bullets: out.bullets.slice(0, 8),
        hashtags: out.hashtags,
        category: out.category,
        price_low: hasPrice ? Math.round(out.price_low) : null,
        price_high: hasPrice ? Math.round(out.price_high) : null,
        price_rationale: hasPrice ? out.price_rationale : '',
        verify: out.verify.slice(0, 8),
      })
    }

    if (body.task === 'brainstorm') {
      const idea = str(body.idea, 8000).trim()
      if (!idea) return fail(400, 'bad_request', 'Describe the idea first.')
      const modes = (Array.isArray(body.modes) ? body.modes : []).filter((m): m is string => typeof m === 'string' && m in MODES)
      if (!modes.length) return fail(400, 'bad_request', 'Choose at least one thing to work on.')
      const context = str(body.context, 4000).trim()
      const r = await generate(client, {
        system: BRAINSTORM_SYSTEM,
        schema: brainstormSchema(modes),
        effort: 'high',
        content: [
          {
            type: 'text',
            text:
              `The idea:\n${idea}\n\n` +
              (context ? `Their context and constraints:\n${context}\n\n` : '') +
              `Return a one-paragraph summary, then one section for each of these, in this order:\n` +
              modes.map((m) => `- ${m}: ${MODES[m]}`).join('\n'),
          },
        ],
      })
      if (!r.ok) return r.response
      return json(r.data)
    }

    return fail(400, 'bad_request', 'Unknown task.')
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
      return fail(503, 'not_configured', 'The Anthropic API key was rejected. Check the ANTHROPIC_API_KEY secret.')
    }
    if (e instanceof Anthropic.RateLimitError) return fail(429, 'rate_limited', 'The AI is busy. Try again in a minute.')
    if (e instanceof Anthropic.BadRequestError) return fail(400, 'bad_request', 'The AI service rejected the request. Try fewer or smaller photos.')
    if (e instanceof Anthropic.APIError) return fail(502, 'upstream', 'The AI service had a problem. Try again shortly.')
    console.error(e)
    return fail(500, 'internal', 'Something went wrong generating that.')
  }
})
