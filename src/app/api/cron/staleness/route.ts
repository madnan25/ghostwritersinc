import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/cron/staleness — run post freshness processing.
 *
 * Calls process_post_freshness() which:
 *   - Auto-archives date_locked posts past their expiry_date
 *   - Returns count of stale time_sensitive posts (not auto-archived)
 *
 * Triggered by Vercel Cron (hourly) or manual call.
 * Protected by CRON_SECRET header when set.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .rpc('process_post_freshness')
    .single() as { data: { auto_archived_count: number; stale_time_sensitive_count: number } | null; error: unknown }

  if (error) {
    console.error('[cron/staleness] DB error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({
    auto_archived: data?.auto_archived_count ?? 0,
    stale_time_sensitive: data?.stale_time_sensitive_count ?? 0,
  })
}
