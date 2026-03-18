// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockRequirePlatformAdmin = vi.fn();
const mockIsAuthenticatedOrgUser = vi.fn();
const mockRateLimit = vi.fn();

// Supabase query builder helpers
const mockFromAgents = vi.fn();
const mockFromAgentKeys = vi.fn();
const mockFromAgentPermissions = vi.fn();
const mockFromUsers = vi.fn();
const mockFromOrganizations = vi.fn();

vi.mock("@/lib/server-auth", () => ({
  requirePlatformAdmin: (...args: unknown[]) => mockRequirePlatformAdmin(...args),
  isAuthenticatedOrgUser: (...args: unknown[]) => mockIsAuthenticatedOrgUser(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

// Mock agent-auth exports that agent-fulfillment needs
vi.mock("@/lib/agent-auth", () => ({
  generateAgentKey: vi.fn(() => "gw_agent_abcdef1234567890abcdef1234567890ab"),
  getAgentKeyPrefix: vi.fn(() => "gw_agent_abcdef12"),
  hashAgentKey: vi.fn(async () => "$2b$10$hashedkey"),
}));

vi.mock("@/lib/agent-context-sharing", () => ({
  getSharedContextGuardMessage: vi.fn(() => null),
}));

vi.mock("@/lib/agent-permissions", () => ({
  ALL_AGENT_PERMISSIONS: [
    "drafts:read", "drafts:write", "comments:read", "comments:write",
    "reviews:read", "reviews:write", "pillars:read", "pillars:write",
    "research:read", "research:write", "strategy:read", "strategy:write",
  ],
  DEFAULT_AGENT_PERMISSIONS: {
    scribe: ["drafts:read", "drafts:write", "comments:read", "comments:write"],
    strategist: ["strategy:read", "strategy:write", "pillars:read"],
    inspector: ["drafts:read", "reviews:read", "reviews:write"],
    researcher: ["research:read", "research:write"],
    reviewer: ["drafts:read", "reviews:read", "reviews:write", "comments:read", "comments:write"],
    custom: [],
  },
  normalizeAgentName: vi.fn((name: string) => name.toLowerCase().replace(/\s+/g, "-")),
  titleizeAgentName: vi.fn((name: string) => name.charAt(0).toUpperCase() + name.slice(1)),
}));

vi.mock("@/lib/agent-team-presets", () => ({
  getAgentTeamPreset: vi.fn(() => null),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      switch (table) {
        case "agents": return mockFromAgents();
        case "agent_keys": return mockFromAgentKeys();
        case "agent_permissions": return mockFromAgentPermissions();
        case "users": return mockFromUsers();
        case "organizations": return mockFromOrganizations();
        default: throw new Error(`Unexpected table: ${table}`);
      }
    }),
  })),
}));

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ADMIN_AUTH = {
  profile: {
    id: "platform-admin-1",
    organization_id: "org-platform",
    role: "admin",
    is_platform_admin: true,
  },
  user: { id: "platform-admin-1" },
};

function makeValidPayload(overrides: Record<string, unknown> = {}) {
  return {
    organization_id: "00000000-0000-4000-a000-000000000001",
    user_id: "00000000-0000-4000-a000-000000000002",
    name: "My Agent",
    agent_type: "scribe",
    provider: "paperclip",
    provider_agent_ref: "ext-agent-ref-123",
    ...overrides,
  };
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/agent-bridge/provision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Recursive chainable proxy that resolves any depth of .eq().eq()... chains */
function chainableProxy(terminalResult: unknown): unknown {
  const handler: ProxyHandler<() => unknown> = {
    apply() {
      return new Proxy(() => terminalResult, handler);
    },
    get(_target, prop) {
      if (prop === "single" || prop === "maybeSingle") {
        return async () => terminalResult;
      }
      if (prop === "then") return undefined;
      return new Proxy(() => terminalResult, handler);
    },
  };
  return new Proxy(() => terminalResult, handler);
}

/** Simple fixed-depth select chain for agents lookup */
function selectChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn(() => chainableProxy({ data, error })),
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("POST /api/agent-bridge/provision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Default: authenticated admin
    mockRequirePlatformAdmin.mockResolvedValue(ADMIN_AUTH);
    mockIsAuthenticatedOrgUser.mockReturnValue(true);
    mockRateLimit.mockResolvedValue(null);

    // Default: no existing agent found (lookup returns null)
    mockFromAgents.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: {
              id: "new-agent-1",
              organization_id: "00000000-0000-4000-a000-000000000001",
              user_id: "00000000-0000-4000-a000-000000000002",
              name: "My Agent",
              slug: "my-agent",
              provider: "paperclip",
              provider_agent_ref: "ext-agent-ref-123",
              agent_type: "scribe",
              job_title: null,
              status: "active",
              allow_shared_context: false,
              commissioned_by: "platform-admin-1",
              created_at: "2026-03-18T00:00:00Z",
              updated_at: "2026-03-18T00:00:00Z",
            },
            error: null,
          })),
        })),
      })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ data: null, error: null })) })),
    });

    // Users lookup succeeds
    mockFromUsers.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { id: "00000000-0000-4000-a000-000000000002" },
              error: null,
            })),
          })),
        })),
      })),
    });

    // Organizations lookup succeeds
    mockFromOrganizations.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: { context_sharing_enabled: true },
            error: null,
          })),
        })),
      })),
    });

    // Agent permissions insert succeeds
    mockFromAgentPermissions.mockReturnValue({
      insert: vi.fn(async () => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({
          data: [{ permission: "drafts:read" }, { permission: "drafts:write" }],
          error: null,
        })),
      })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ data: null, error: null })) })),
    });

    // Agent keys insert succeeds
    mockFromAgentKeys.mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: {
              id: "key-1",
              agent_id: "new-agent-1",
              key_prefix: "gw_agent_abcdef12",
              created_at: "2026-03-18T00:00:00Z",
            },
            error: null,
          })),
        })),
      })),
    });
  });

  /* ======== 1. Happy path ======== */
  describe("happy path", () => {
    it("provisions a new agent and returns revealed_key + idempotent: false", async () => {
      const { POST } = await import("@/app/api/agent-bridge/provision/route");
      const res = await POST(makeRequest(makeValidPayload()));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.revealed_key).toBe("gw_agent_abcdef1234567890abcdef1234567890ab");
      expect(json.idempotent).toBe(false);
      expect(json.id).toBe("new-agent-1");
      expect(json.permissions).toEqual(expect.arrayContaining(["drafts:read", "drafts:write"]));
      expect(json.assigned_user).toEqual({ id: "00000000-0000-4000-a000-000000000002" });
      expect(json.organization).toEqual({ id: "00000000-0000-4000-a000-000000000001" });
    });
  });

  /* ======== 2. Idempotency ======== */
  describe("idempotency", () => {
    it("returns existing agent with new key + idempotent: true on re-provision", async () => {
      const existingAgent = {
        id: "existing-agent-1",
        organization_id: "00000000-0000-4000-a000-000000000001",
        user_id: "00000000-0000-4000-a000-000000000002",
        name: "My Agent",
        slug: "my-agent",
        provider: "paperclip",
        provider_agent_ref: "ext-agent-ref-123",
        agent_type: "scribe",
        status: "active",
        allow_shared_context: false,
        revoked_at: null,
        agent_permissions: [{ permission: "drafts:read" }, { permission: "drafts:write" }],
        agent_keys: [{ id: "old-key", agent_id: "existing-agent-1", key_prefix: "gw_agent_oldprefix", created_at: "2026-03-17T00:00:00Z" }],
      };

      // The route first queries agents with .select(...).eq(org).eq(provider).eq(ref).maybeSingle()
      // Then issueAgentKeyForAgent queries agents with .select(...).eq(id).maybeSingle()
      // Both go through the same mock, so use a counter to return different results.
      let agentSelectCallCount = 0;
      mockFromAgents.mockReturnValue({
        select: vi.fn(() => {
          agentSelectCallCount++;
          if (agentSelectCallCount === 1) {
            // Route lookup: existing agent found
            return chainableProxy({ data: existingAgent, error: null });
          }
          // issueAgentKeyForAgent lookup
          return chainableProxy({
            data: {
              id: "existing-agent-1",
              organization_id: "00000000-0000-4000-a000-000000000001",
              user_id: "00000000-0000-4000-a000-000000000002",
              agent_type: "scribe",
              allow_shared_context: false,
            },
            error: null,
          });
        }),
      });

      // issueAgentKeyForAgent also queries agent_permissions
      mockFromAgentPermissions.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({
            data: [{ permission: "drafts:read" }, { permission: "drafts:write" }],
            error: null,
          })),
        })),
        insert: vi.fn(async () => ({ error: null })),
        delete: vi.fn(() => ({ eq: vi.fn(() => ({ data: null, error: null })) })),
      });

      const { POST } = await import("@/app/api/agent-bridge/provision/route");
      const res = await POST(makeRequest(makeValidPayload()));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.idempotent).toBe(true);
      expect(json.id).toBe("existing-agent-1");
      expect(json.revealed_key).toBeDefined();
      expect(json.permissions).toEqual(["drafts:read", "drafts:write"]);
    });
  });

  /* ======== 3. Revoked agent ======== */
  describe("revoked agent", () => {
    it("returns 409 when re-provisioning a revoked agent", async () => {
      mockFromAgents.mockReturnValue(
        selectChain({
          id: "revoked-agent-1",
          status: "revoked",
          revoked_at: "2026-03-15T00:00:00Z",
          provider: "paperclip",
          provider_agent_ref: "ext-agent-ref-123",
          agent_permissions: [],
          agent_keys: [],
        })
      );

      const { POST } = await import("@/app/api/agent-bridge/provision/route");
      const res = await POST(makeRequest(makeValidPayload()));
      const json = await res.json();

      expect(res.status).toBe(409);
      expect(json.error).toMatch(/revoked/i);
    });

    it("returns 409 when agent status is inactive (not active)", async () => {
      mockFromAgents.mockReturnValue(
        selectChain({
          id: "inactive-agent-1",
          status: "inactive",
          revoked_at: null,
          provider: "paperclip",
          provider_agent_ref: "ext-agent-ref-123",
          agent_permissions: [],
          agent_keys: [],
        })
      );

      const { POST } = await import("@/app/api/agent-bridge/provision/route");
      const res = await POST(makeRequest(makeValidPayload()));

      expect(res.status).toBe(409);
    });
  });

  /* ======== 4. Validation errors ======== */
  describe("validation", () => {
    it("returns 400 for missing required fields", async () => {
      const { POST } = await import("@/app/api/agent-bridge/provision/route");
      const res = await POST(makeRequest({}));
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Validation error");
      expect(json.details).toBeDefined();
      expect(json.details.length).toBeGreaterThan(0);
    });

    it("returns 400 for invalid UUID in organization_id", async () => {
      const { POST } = await import("@/app/api/agent-bridge/provision/route");
      const res = await POST(
        makeRequest(makeValidPayload({ organization_id: "not-a-uuid" }))
      );
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Validation error");
    });

    it("returns 400 for invalid UUID in user_id", async () => {
      const { POST } = await import("@/app/api/agent-bridge/provision/route");
      const res = await POST(
        makeRequest(makeValidPayload({ user_id: "bad-uuid" }))
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 for empty provider_agent_ref", async () => {
      const { POST } = await import("@/app/api/agent-bridge/provision/route");
      const res = await POST(
        makeRequest(makeValidPayload({ provider_agent_ref: "" }))
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid agent_type", async () => {
      const { POST } = await import("@/app/api/agent-bridge/provision/route");
      const res = await POST(
        makeRequest(makeValidPayload({ agent_type: "invalid_type" }))
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid provider", async () => {
      const { POST } = await import("@/app/api/agent-bridge/provision/route");
      const res = await POST(
        makeRequest(makeValidPayload({ provider: "unknown_provider" }))
      );

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid JSON body", async () => {
      const { POST } = await import("@/app/api/agent-bridge/provision/route");
      const res = await POST(
        new Request("http://localhost/api/agent-bridge/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "not-json{",
        })
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Invalid JSON body");
    });
  });

  /* ======== 5. Auth ======== */
  describe("authentication", () => {
    it("returns 401 for unauthenticated request", async () => {
      const unauthorized = NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
      mockRequirePlatformAdmin.mockResolvedValueOnce(unauthorized);
      mockIsAuthenticatedOrgUser.mockReturnValueOnce(false);

      const { POST } = await import("@/app/api/agent-bridge/provision/route");
      const res = await POST(makeRequest(makeValidPayload()));

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin user", async () => {
      const forbidden = NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
      mockRequirePlatformAdmin.mockResolvedValueOnce(forbidden);
      mockIsAuthenticatedOrgUser.mockReturnValueOnce(false);

      const { POST } = await import("@/app/api/agent-bridge/provision/route");
      const res = await POST(makeRequest(makeValidPayload()));

      expect(res.status).toBe(403);
    });
  });

  /* ======== 6. Rate limiting ======== */
  describe("rate limiting", () => {
    it("returns 429 with Retry-After when rate limited", async () => {
      const rateLimitResponse = NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": "42" } }
      );
      mockRateLimit.mockResolvedValueOnce(rateLimitResponse);

      const { POST } = await import("@/app/api/agent-bridge/provision/route");
      const res = await POST(makeRequest(makeValidPayload()));

      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBe("42");
    });
  });

  /* ======== 7. Cross-provider isolation ======== */
  describe("cross-provider isolation", () => {
    it("same provider_agent_ref with different provider creates new agent", async () => {
      // No existing agent for this provider+ref combo
      mockFromAgents.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: {
                id: "new-agent-paperclip",
                organization_id: "00000000-0000-4000-a000-000000000001",
                user_id: "00000000-0000-4000-a000-000000000002",
                name: "My Agent",
                slug: "my-agent",
                provider: "paperclip",
                provider_agent_ref: "shared-ref-123",
                agent_type: "scribe",
                status: "active",
              },
              error: null,
            })),
          })),
        })),
        delete: vi.fn(() => ({ eq: vi.fn(() => ({ data: null, error: null })) })),
      });

      const { POST } = await import("@/app/api/agent-bridge/provision/route");

      // First: provision with provider "paperclip"
      const res1 = await POST(
        makeRequest(
          makeValidPayload({ provider: "paperclip", provider_agent_ref: "shared-ref-123" })
        )
      );
      expect(res1.status).toBe(200);
      const json1 = await res1.json();
      expect(json1.idempotent).toBe(false);

      // Reset modules so the import re-runs with fresh mock state
      vi.resetModules();

      // Second: provision with provider "openclaw" and same provider_agent_ref
      // Still no existing agent (different provider)
      mockFromAgents.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
          })),
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: {
                id: "new-agent-openclaw",
                organization_id: "00000000-0000-4000-a000-000000000001",
                user_id: "00000000-0000-4000-a000-000000000002",
                name: "My Agent",
                slug: "my-agent",
                provider: "openclaw",
                provider_agent_ref: "shared-ref-123",
                agent_type: "scribe",
                status: "active",
              },
              error: null,
            })),
          })),
        })),
        delete: vi.fn(() => ({ eq: vi.fn(() => ({ data: null, error: null })) })),
      });

      const { POST: POST2 } = await import("@/app/api/agent-bridge/provision/route");
      const res2 = await POST2(
        makeRequest(
          makeValidPayload({ provider: "openclaw", provider_agent_ref: "shared-ref-123" })
        )
      );
      const json2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(json2.idempotent).toBe(false);
      expect(json2.id).toBe("new-agent-openclaw");
      // Different agents created for different providers
      expect(json1.id).not.toBe(json2.id);
    });
  });
});
