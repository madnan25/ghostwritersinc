// @vitest-environment node

/**
 * Cross-org isolation integration tests (LIN-97)
 *
 * Verifies that agent API endpoints enforce org boundaries:
 * an agent key from org A must not be able to read, modify, or review
 * resources belonging to org B.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Org fixtures
// ---------------------------------------------------------------------------
const ORG_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const ORG_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const POST_ID_ORG_A = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a001'
const POST_ID_ORG_B = 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b001'
const POST_ID_ORG_A_SECONDARY = 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a002'
const PILLAR_ID_ORG_A = 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c001'
const PILLAR_ID_ORG_B = 'c0c0c0c0-c0c0-c0c0-c0c0-c0c0c0c0c002'
const USER_ID_ORG_A = 'd0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d001'
const USER_ID_ORG_A_SECONDARY = 'd0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d002'

// ---------------------------------------------------------------------------
// Mock: authenticateAgent — returns org-A context
// ---------------------------------------------------------------------------
vi.mock('@/lib/agent-auth', () => ({
  authenticateAgent: vi.fn().mockResolvedValue({
    agentId: 'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e001',
    agentName: 'scribe',
    agentSlug: 'scribe',
    agentType: 'scribe',
    provider: 'ghostwriters',
    status: 'active',
    organizationId: ORG_A,
    userId: USER_ID_ORG_A,
    permissions: ['posts:read', 'posts:write', 'comments:read', 'comments:write', 'read', 'write', 'review'],
    allowSharedContext: false,
    scopeMode: 'user',
  }),
  getAgentRateLimitKey: vi.fn((auth: { organizationId: string; userId: string; agentName: string }, capability: string) =>
    `${capability}:${auth.organizationId}:${auth.userId}:${auth.agentName}`
  ),
  hasAgentPermission: vi.fn(() => true),
  isAgentContext: vi.fn((r: unknown) => !(r instanceof Response)),
  isSharedOrgAgentContext: vi.fn((auth: { scopeMode: string }) => auth.scopeMode === 'shared_org'),
  canAccessAgentUserRecord: vi.fn(
    (
      auth: { organizationId: string; userId: string; scopeMode: string },
      record: { organization_id: string; user_id: string | null }
    ) =>
      record.organization_id === auth.organizationId &&
      (auth.scopeMode === 'shared_org' || record.user_id === auth.userId)
  ),
  canAccessAgentOrgRecord: vi.fn(
    (
      auth: { organizationId: string },
      record: { organization_id: string }
    ) => record.organization_id === auth.organizationId
  ),
  requireSharedOrgAgentContext: vi.fn((auth: { scopeMode: string }) =>
    auth.scopeMode === 'shared_org'
      ? null
      : NextResponse.json(
          { error: 'Shared org context is disabled for this agent key' },
          { status: 403 }
        )
  ),
  DEFAULT_AGENT_PERMISSIONS: {
    scribe: ['posts:read', 'posts:write'],
    strategist: ['posts:read'],
    inspector: ['posts:read', 'reviews:read', 'reviews:write'],
  },
  generateAgentKey: vi.fn(() => 'gw_agent_test1234567890abcdef'),
  hashAgentKey: vi.fn(async () => '$2a$12$fakehash'),
}))

// ---------------------------------------------------------------------------
// Mock: rate-limit — always allow
// ---------------------------------------------------------------------------
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => null),
}))

// ---------------------------------------------------------------------------
// Mock: workflow — pass through
// ---------------------------------------------------------------------------
vi.mock('@/lib/workflow', () => ({
  validateTransition: vi.fn(({ to, notes, rejectionReason }) => ({
    reviewAction: to === 'rejected' ? 'rejected' : 'approved',
    updateFields: {
      status: to,
      rejection_reason: rejectionReason,
      agent_notes: notes,
      updated_at: new Date().toISOString(),
    },
  })),
  WorkflowError: class WorkflowError extends Error {
    code: string
    constructor(message: string, code: string) {
      super(message)
      this.code = code
    }
  },
}))

// Simulated data store
const MOCK_DB: Record<string, Record<string, unknown>[]> = {
  posts: [
    {
      id: POST_ID_ORG_A,
      organization_id: ORG_A,
      user_id: USER_ID_ORG_A,
      content: 'Org A post',
      status: 'draft',
      pillar_id: PILLAR_ID_ORG_A,
    },
    {
      id: POST_ID_ORG_A_SECONDARY,
      organization_id: ORG_A,
      user_id: USER_ID_ORG_A_SECONDARY,
      content: 'Org A teammate post',
      status: 'draft',
      pillar_id: PILLAR_ID_ORG_A,
    },
    {
      id: POST_ID_ORG_B,
      organization_id: ORG_B,
      user_id: 'd0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d003',
      content: 'Org B post',
      status: 'draft',
      pillar_id: PILLAR_ID_ORG_B,
    },
  ],
  content_pillars: [
    { id: PILLAR_ID_ORG_A, organization_id: ORG_A, user_id: USER_ID_ORG_A, name: 'Thought Leadership', slug: 'thought-leadership', color: '#3B82F6', weight_pct: 40 },
    { id: PILLAR_ID_ORG_B, organization_id: ORG_B, user_id: 'd0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d003', name: 'Industry', slug: 'industry', color: '#10B981', weight_pct: 50 },
  ],
  post_comments: [],
  review_events: [],
  users: [
    { id: USER_ID_ORG_A, organization_id: ORG_A },
    { id: USER_ID_ORG_A_SECONDARY, organization_id: ORG_A },
  ],
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      const state: { filters: Record<string, string>; insertData?: unknown } = { filters: {} }

      function getFilteredRows() {
        const rows = MOCK_DB[table] ?? []
        return rows.filter((row) =>
          Object.entries(state.filters).every(([k, v]) => row[k] === v)
        )
      }

      const chainResult: Record<string, unknown> = {
        select: vi.fn(() => chainResult),
        insert: vi.fn((data: unknown) => {
          state.insertData = data
          return chainResult
        }),
        upsert: vi.fn((data: unknown) => {
          state.insertData = data
          return chainResult
        }),
        update: vi.fn(() => chainResult),
        delete: vi.fn(() => chainResult),
        eq: vi.fn((col: string, val: string) => {
          state.filters[col] = val
          return chainResult
        }),
        in: vi.fn(() => chainResult),
        not: vi.fn(() => chainResult),
        order: vi.fn(() => chainResult),
        limit: vi.fn(() => chainResult),
        single: vi.fn(() => {
          const match = getFilteredRows()[0]
          return { data: match ?? null, error: null }
        }),
        maybeSingle: vi.fn(() => {
          const match = getFilteredRows()[0]
          return { data: match ?? null, error: null }
        }),
        // Make chainResult thenable so `await query` returns list results
        then: vi.fn((resolve: (val: unknown) => void) => {
          resolve({ data: getFilteredRows(), error: null })
        }),
      }

      return chainResult
    }),
  })),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(
  url: string,
  method = 'GET',
  body?: Record<string, unknown>
): NextRequest {
  const init: {
    method: string
    headers: Record<string, string>
    body?: string
  } = {
    method,
    headers: { Authorization: 'Bearer gw_agent_fakekey', 'Content-Type': 'application/json' },
  }
  if (body) init.body = JSON.stringify(body)
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Cross-org isolation — Drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/drafts — returns only the assigned user drafts by default', async () => {
    const { GET } = await import('@/app/api/drafts/route')
    const req = makeRequest('http://localhost:3000/api/drafts')
    const res = await GET(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toHaveLength(1)
    expect(json[0]).toMatchObject({
      id: POST_ID_ORG_A,
      organization_id: ORG_A,
      user_id: USER_ID_ORG_A,
    })
  })

  it('GET /api/drafts — can read other org-user drafts only when sharing is enabled', async () => {
    const { authenticateAgent } = await import('@/lib/agent-auth')
    vi.mocked(authenticateAgent).mockResolvedValueOnce({
      agentId: 'e0e0e0e0-e0e0-e0e0-e0e0-e0e0e0e0e002',
      agentName: 'strategist',
      agentSlug: 'strategist',
      agentType: 'strategist',
      provider: 'ghostwriters',
      status: 'active',
      organizationId: ORG_A,
      userId: USER_ID_ORG_A,
      permissions: ['posts:read', 'read'],
      allowSharedContext: true,
      scopeMode: 'shared_org',
    })

    const { GET } = await import('@/app/api/drafts/route')
    const req = makeRequest('http://localhost:3000/api/drafts')
    const res = await GET(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toHaveLength(2)
  })

  it('PATCH /api/drafts/:id — rejects update to org B post', async () => {
    const { PATCH } = await import('@/app/api/drafts/[id]/route')
    const req = makeRequest(
      `http://localhost:3000/api/drafts/${POST_ID_ORG_B}`,
      'PATCH',
      { content: 'hacked content' }
    )
    const res = await PATCH(req, { params: Promise.resolve({ id: POST_ID_ORG_B }) })
    const json = await res.json()
    // Should get 404 because the post belongs to org B, not org A
    expect(res.status).toBe(404)
    expect(json.error).toBe('Post not found')
  })

  it('PATCH /api/drafts/:id — rejects update to another user in same org when sharing is off', async () => {
    const { PATCH } = await import('@/app/api/drafts/[id]/route')
    const req = makeRequest(
      `http://localhost:3000/api/drafts/${POST_ID_ORG_A_SECONDARY}`,
      'PATCH',
      { content: 'hacked teammate content' }
    )
    const res = await PATCH(req, { params: Promise.resolve({ id: POST_ID_ORG_A_SECONDARY }) })
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toBe('Post not found')
  })

  it('PATCH /api/drafts/:id — allows update to own org post', async () => {
    const { PATCH } = await import('@/app/api/drafts/[id]/route')
    const req = makeRequest(
      `http://localhost:3000/api/drafts/${POST_ID_ORG_A}`,
      'PATCH',
      { content: 'updated content' }
    )
    const res = await PATCH(req, { params: Promise.resolve({ id: POST_ID_ORG_A }) })
    // Should not be 404 (it's our own org's post)
    expect(res.status).not.toBe(404)
  })
})

describe('Cross-org isolation — Comments', () => {
  it('GET /api/drafts/:id/comments — rejects access to org B post', async () => {
    const { GET } = await import('@/app/api/drafts/[id]/comments/route')
    const req = makeRequest(
      `http://localhost:3000/api/drafts/${POST_ID_ORG_B}/comments`
    )
    const res = await GET(req, { params: Promise.resolve({ id: POST_ID_ORG_B }) })
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toBe('Post not found')
  })

  it('GET /api/drafts/:id/comments — allows access to own org post', async () => {
    const { GET } = await import('@/app/api/drafts/[id]/comments/route')
    const req = makeRequest(
      `http://localhost:3000/api/drafts/${POST_ID_ORG_A}/comments`
    )
    const res = await GET(req, { params: Promise.resolve({ id: POST_ID_ORG_A }) })
    expect(res.status).not.toBe(404)
  })

  it('GET /api/drafts/:id/comments — rejects access to another user in same org when sharing is off', async () => {
    const { GET } = await import('@/app/api/drafts/[id]/comments/route')
    const req = makeRequest(
      `http://localhost:3000/api/drafts/${POST_ID_ORG_A_SECONDARY}/comments`
    )
    const res = await GET(req, { params: Promise.resolve({ id: POST_ID_ORG_A_SECONDARY }) })
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toBe('Post not found')
  })
})

describe('Cross-org isolation — Reviews', () => {
  it('POST /api/drafts/:id/review — rejects review of org B post', async () => {
    const { POST } = await import('@/app/api/drafts/[id]/review/route')
    const req = makeRequest(
      `http://localhost:3000/api/drafts/${POST_ID_ORG_B}/review`,
      'POST',
      { action: 'approved', notes: 'looks good' }
    )
    const res = await POST(req, { params: Promise.resolve({ id: POST_ID_ORG_B }) })
    const json = await res.json()
    expect(res.status).toBe(404)
    expect(json.error).toBe('Post not found')
  })

  it('POST /api/drafts/:id/review — allows review of own org post', async () => {
    const { POST } = await import('@/app/api/drafts/[id]/review/route')
    const req = makeRequest(
      `http://localhost:3000/api/drafts/${POST_ID_ORG_A}/review`,
      'POST',
      { action: 'approved', notes: 'ship it' }
    )
    const res = await POST(req, { params: Promise.resolve({ id: POST_ID_ORG_A }) })
    expect(res.status).not.toBe(404)
  })
})

describe('Cross-org isolation — Pillars', () => {
  it('GET /api/pillars — scopes to org A only', async () => {
    const { GET } = await import('@/app/api/pillars/route')
    const req = makeRequest('http://localhost:3000/api/pillars')
    const res = await GET(req)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toHaveLength(1)
    expect(json[0]).toMatchObject({
      id: PILLAR_ID_ORG_A,
      organization_id: ORG_A,
    })
  })
})

describe('Cross-org isolation — Auth layer', () => {
  it('rejects requests without Authorization header', async () => {
    // Reset the mock for this specific test
    const { authenticateAgent } = await import('@/lib/agent-auth')
    const mockAuth = vi.mocked(authenticateAgent)
    const { NextResponse } = await import('next/server')
    mockAuth.mockResolvedValueOnce(
      NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
    )

    const { GET } = await import('@/app/api/drafts/route')
    const req = new NextRequest(new URL('http://localhost:3000/api/drafts'))
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('rejects requests with invalid API key', async () => {
    const { authenticateAgent } = await import('@/lib/agent-auth')
    const mockAuth = vi.mocked(authenticateAgent)
    const { NextResponse } = await import('next/server')
    mockAuth.mockResolvedValueOnce(
      NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    )

    const { GET } = await import('@/app/api/drafts/route')
    const req = new NextRequest(
      new URL('http://localhost:3000/api/drafts'),
      { headers: { Authorization: 'Bearer invalid_key' } }
    )
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})
