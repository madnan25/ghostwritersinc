import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  const { data: uploads, error } = await admin
    .from('research_uploads')
    .select('*')
    .eq('organization_id', dbUser.organization_id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(uploads)
}
