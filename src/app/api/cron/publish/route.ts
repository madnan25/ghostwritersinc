import { NextRequest, NextResponse } from 'next/server'
import { processDuePosts } from '@/lib/publish-scheduled'

/**
 * POST /api/cron/publish — process scheduled posts due for publishing.
 *
 * Triggered by Vercel Cron (daily), external cron, or manual call.
 * Protected by CRON_SECRET header when set.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await processDuePosts()

  return NextResponse.json(result)
}
