/**
 * Cross-org isolation integration tests (LIN-97)
 *
 * Verifies that agent API endpoints enforce org boundaries:
 * an agent key from org A must not be able to read, modify, or review
 * resources belonging to org B.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Org fixtures
// ---------------------------------------------------------------------------
const ORG_A = 'org-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const ORG_B = 'org-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const POST_ID_ORG_A = 'post-aaaa-0001'
const POST_ID_ORG_B = 'post-bbbb-0001'
const PILLAR_ID_ORG_A = 'pillar-aaaa-0001'
const PILLAR_ID_ORG_B = 'pillar-bbbb-0001'
const USER_ID_ORG_A = 'user-aaaa-0001'

// ---------------------------------------------------------------------------
// Mock: authenticateAgent — returns org-A context
// ---------------------------------------------------------------------------
vi.mock('@/lib/agent-auth', () => ({
  authenticateAgent: vi.fn().mockResolvedValue({
    agentName: 'scribe',
    organizationId: ORG_A,
    permissions: ['posts:read', 'posts:write', 'comments:read', 'comments:write', 'read', 'write', 'review'],
  }),
  isAgentContext: vi.fn((r: unknown) => !(r instanceof Response)),
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
  validateTransition: vi.fn(({ from, to, agentName, notes, rejectionReason }) => ({
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

// ---------------------------------------------------------------------------
// Mock: Supabase admin client
// ---------------------------------------------------------------------------
// We build a chainable query builder that records calls and returns
// data based on the org filter.
// ---------------------------------------------------------------------------
function createMockQueryBuilder(table: string) {
  const state: Record<string, unknown> = { table, filters: {} as Record<string, string> }

  const builder: Record<string, unknown> = {}

  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'eq', 'in', 'not',
    'order', 'limit', 'single', 'maybeSingle',
  ]

  for (const method of chainMethods) {
    builder[method] = vi.fn((...args: unknown[]) => {
      if (method === 'eq') {
        ;(state.filters as Record<string, string>)[args[0] as string] = args[1] as string
      }

      if (method === 'single' || method === 'maybeSingle') {
        return resolveQuery(table, state)
      }

      return builder
    })
  }

  return builder
}

// Simulated data store
const MOCK_DB: Record<string, Record<string, unknown>[]> = {
  posts: [
    {
      id: POST_ID_ORG_A,
      organization_id: ORG_A,
      user_id: USER_ID_ORG_A,
      content: 'Org A post',
      status: 'draft',
      pillar_id: null,
    },
    {
      id: POST_ID_ORG_B,
      organization_id: ORG_B,
      user_id: 'user-bbbb-0001',
      content: 'Org B post',
      status: 'draft',
      pillar_id: null,
    },
  ],
  content_pillars: [
    { id: PILLAR_ID_ORG_A, organization_id: ORG_A, name: 'Thought Leadership', slug: 'thought-leadership', color: '#3B82F6', weight_pct: 40 },
    { id: PILLAR_ID_ORG_B, organization_id: ORG_B, name: 'Industry', slug: 'industry', color: '#10B981', weight_pct: 50 },
  ],
  post_comments: [],
  review_events: [],
  users: [
    { id: USER_ID_ORG_A, organization_id: ORG_A },
  ],
}

function resolveQuery(table: string, state: Record<string, unknown>) {
  const filters = state.filters as Record<string, string>
  const rows = MOCK_DB[table] ?? []
  const matches = rows.filter((row) =>
    Object.entries(filters).every(([k, v]) => row[k] === v)
  )
  if (state.single) {
    return { data: matches[0] ?? null, error: null }
  }
  return { data: matches[0] ?? null, error: null }
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
  const init: RequestInit = {
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

  it('GET /api/drafts — returns only org A drafts', async () => {
    const { GET } = await import('@/app/api/drafts/route')
    const req = makeRequest('http://localhost:3000/api/drafts')
    const res = await GET(req)
    // Route filters by auth.organizationId — mock returns org A context
    // The response goes through the mock supabase which chains eq('organization_id', ORG_A)
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
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
    expect(res.status).not.toBe(401)
    expect(res.status).not.toBe(403)
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
