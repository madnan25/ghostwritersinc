import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for API routes.
 * Bypasses RLS — use only in server-side API handlers with validated auth.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
