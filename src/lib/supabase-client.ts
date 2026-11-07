import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config, supabaseConfigured } from './config'

let client: SupabaseClient | null = null

/** The browser Supabase client, or null when the project isn't configured. */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}
