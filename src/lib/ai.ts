import { FunctionsHttpError } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/features/auth/auth'
import { getSupabase } from './supabase-client'

/**
 * Client for the `orbit-ai` Supabase Edge Function. The Anthropic API key lives only in the
 * function's secrets; the browser never sees it. When AI isn't available, every caller gets an
 * honest status instead of simulated output.
 */

export type AiStatus =
  | { state: 'ready'; model: string }
  | { state: 'demo' }
  | { state: 'not-deployed' }
  | { state: 'no-key' }
  | { state: 'error'; message: string }

export class AiUnavailableError extends Error {
  constructor(public status: AiStatus) {
    super(describeAiStatus(status))
  }
}

export function describeAiStatus(s: AiStatus): string {
  switch (s.state) {
    case 'ready':
      return `AI is connected (${s.model}).`
    case 'demo':
      return 'AI isn’t available in demo mode. Connect a Supabase project and deploy the orbit-ai function to turn it on.'
    case 'not-deployed':
      return 'The orbit-ai function isn’t deployed to your Supabase project yet. See the README for the one-line deploy command.'
    case 'no-key':
      return 'The orbit-ai function is deployed but has no ANTHROPIC_API_KEY secret. Add it with `supabase secrets set`.'
    case 'error':
      return `AI is unavailable right now: ${s.message}`
  }
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase()
  if (!sb) throw new AiUnavailableError({ state: 'demo' })
  const { data, error } = await sb.functions.invoke('orbit-ai', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const status = error.context?.status as number | undefined
      let payload: { error?: string; message?: string } = {}
      try {
        payload = await error.context.json()
      } catch {
        /* not JSON */
      }
      if (status === 404) throw new AiUnavailableError({ state: 'not-deployed' })
      if (payload.error === 'not_configured') throw new AiUnavailableError({ state: 'no-key' })
      throw new Error(payload.message || 'The AI service returned an error. Try again in a moment.')
    }
    throw new AiUnavailableError({ state: 'error', message: error.message })
  }
  return data as T
}

export function useAiStatus() {
  const session = useSession()
  return useQuery<AiStatus>({
    queryKey: ['ai-status', session.mode, session.user.id],
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      if (session.mode === 'local') return { state: 'demo' }
      try {
        const r = await invoke<{ configured: boolean; model?: string }>({ task: 'status' })
        return r.configured ? { state: 'ready', model: r.model ?? 'Claude' } : { state: 'no-key' }
      } catch (e) {
        if (e instanceof AiUnavailableError) return e.status
        return { state: 'error', message: e instanceof Error ? e.message : 'unknown error' }
      }
    },
  })
}

// ─── listing assistant ───────────────────────────────────────────────────────
export interface ListingAiInput {
  facts: {
    sku: string
    brand: string
    category: string
    size: string
    colour: string
    condition: string
    measurements: string
    notes: string
    what_it_is: string
    proper_nouns: string[]
    currency: string
  }
  images: { data: string; media_type: string }[]
  /** The person's own comparable sales, so pricing guidance is grounded in real numbers. */
  comparable_sales: { brand: string; category: string; sale_price: number; sold_date: string | null }[]
}

export interface ListingAiOutput {
  title: string
  bullets: string[]
  hashtags: string[]
  category: string
  price_low: number | null
  price_high: number | null
  price_rationale: string
  verify: string[]
}

export function generateListing(input: ListingAiInput) {
  return invoke<ListingAiOutput>({ task: 'listing', ...input })
}

// ─── Spark brainstorming ─────────────────────────────────────────────────────
export const BRAINSTORM_MODES = [
  { id: 'expand', label: 'Expand the concept' },
  { id: 'features', label: 'Possible features' },
  { id: 'audience', label: 'Target audiences' },
  { id: 'opportunities', label: 'Opportunities and challenges' },
  { id: 'names', label: 'Project names' },
  { id: 'approach', label: 'Development approach' },
  { id: 'plan', label: 'Implementation plan' },
  { id: 'mvp', label: 'Minimum viable product' },
  { id: 'milestones', label: 'Milestones' },
] as const
export type BrainstormMode = (typeof BRAINSTORM_MODES)[number]['id']

export interface BrainstormSection {
  mode: BrainstormMode
  heading: string
  items: { title: string; detail: string }[]
}

export interface BrainstormOutput {
  summary: string
  sections: BrainstormSection[]
}

export function brainstorm(input: { idea: string; context: string; modes: BrainstormMode[] }) {
  return invoke<BrainstormOutput>({ task: 'brainstorm', ...input })
}
