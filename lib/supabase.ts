import { createClient } from '@supabase/supabase-js'

/**
 * Supabase browser client.
 *
 * This app historically used `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`.
 * Supabase docs commonly refer to the anon key as `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
 *
 * We support BOTH to make env setup idiot-proof.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY).'
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})
