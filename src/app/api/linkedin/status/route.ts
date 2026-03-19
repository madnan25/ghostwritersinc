import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnectionStatus } from '@/lib/linkedin-tokens'

/** GET /api/linkedin/status — get current user's LinkedIn connection status */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: dbUser } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const status = await getConnectionStatus(user.id, dbUser.organization_id)

  return NextResponse.json(status ?? { connected: false, linkedinMemberId: null, connectedAt: null, expiresAt: null })
}
