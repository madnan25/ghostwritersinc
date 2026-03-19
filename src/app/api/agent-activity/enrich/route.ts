import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAuthenticatedOrgUser, requireOrgUser } from '@/lib/server-auth'

const EnrichRequestSchema = z.object({
  agent_ids: z.array(z.string()).max(100).optional().default([]),
  post_ids: z.array(z.string()).max(100).optional().default([]),
})

function derivePostTitle(content: string | null | undefined): string | null {
  if (!content) return null

  const firstLine = content
    .split('\n')
    .map((line) => line.trim().replace(/^[-*#>\s]+/, ''))
    .find(Boolean)

  return firstLine ? firstLine.slice(0, 120) : null
}

export async function POST(request: Request) {
  const auth = await requireOrgUser()
  if (!isAuthenticatedOrgUser(auth)) {
    return auth
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = EnrichRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const agentIds = Array.from(new Set(parsed.data.agent_ids.filter(Boolean)))
  const postIds = Array.from(new Set(parsed.data.post_ids.filter(Boolean)))
  const admin = createAdminClient()

  const [agentsResult, postsResult] = await Promise.all([
    agentIds.length
      ? admin
          .from('agents')
          .select('id, name')
          .eq('organization_id', auth.profile.organization_id)
          .in('id', agentIds)
      : Promise.resolve({ data: [], error: null as unknown }),
    postIds.length
      ? admin
          .from('posts')
          .select('id, content')
          .eq('organization_id', auth.profile.organization_id)
          .in('id', postIds)
      : Promise.resolve({ data: [], error: null as unknown }),
  ])

  if (agentsResult.error || postsResult.error) {
    return NextResponse.json({ error: 'Failed to enrich activity feed' }, { status: 500 })
  }

  const agentNames = Object.fromEntries(
    ((agentsResult.data ?? []) as Array<{ id: string; name: string | null }>).map((agent) => [
      agent.id,
      agent.name,
    ])
  )

  const postTitles = Object.fromEntries(
    ((postsResult.data ?? []) as Array<{ id: string; content: string | null }>).map((post) => [
      post.id,
      derivePostTitle(post.content),
    ])
  )

  return NextResponse.json({ agentNames, postTitles })
}
