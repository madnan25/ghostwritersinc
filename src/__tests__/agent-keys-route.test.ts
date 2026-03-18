// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const mockRequirePlatformAdmin = vi.fn();
const mockIsAuthenticatedOrgUser = vi.fn();
const mockGenerateAgentKey = vi.fn(() => "gw_agent_test_key");
const mockGetAgentKeyPrefix = vi.fn(() => "gw_agent_testpref");
const mockHashAgentKey = vi.fn(async () => "hashed-key");

const mockKeyInsert = vi.fn();
const mockAgentInsert = vi.fn();
const mockPermissionInsert = vi.fn();

vi.mock("@/lib/server-auth", () => ({
  requirePlatformAdmin: mockRequirePlatformAdmin,
  isAuthenticatedOrgUser: mockIsAuthenticatedOrgUser,
}));

vi.mock("@/lib/agent-auth", () => ({
  generateAgentKey: mockGenerateAgentKey,
  getAgentKeyPrefix: mockGetAgentKeyPrefix,
  hashAgentKey: mockHashAgentKey,
  DEFAULT_AGENT_PERMISSIONS: {
    scribe: ["posts:read", "posts:write"],
    strategist: ["posts:read", "pillars:read"],
    inspector: ["posts:read", "reviews:write"],
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: { id: "user-1" },
                  error: null,
                })),
              })),
            })),
          })),
        };
      }

      if (table === "agent_keys") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            })),
          })),
          insert: mockKeyInsert,
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { id: "key-1" }, error: null })),
              })),
            })),
          })),
        };
      }

      if (table === "agents") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            })),
          })),
          insert: mockAgentInsert,
        };
      }

      if (table === "agent_permissions") {
        return {
          insert: mockPermissionInsert,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  })),
}));

describe("agent key admin route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentInsert.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: { id: "agent-1" },
          error: null,
        })),
      })),
    });
    mockPermissionInsert.mockResolvedValue({ error: null });
    mockKeyInsert.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: {
            id: "key-1",
            agent_id: "agent-1",
            organization_id: "org-1",
            user_id: "user-1",
            agent_name: "scribe",
            key_prefix: "gw_agent_testpref",
            permissions: ["posts:read", "posts:write"],
            allow_shared_context: true,
            commissioned_by: "platform-admin-1",
            created_at: "2026-03-18T00:00:00.000Z",
          },
          error: null,
        })),
      })),
    });
  });

  it("returns auth errors from the platform-admin guard", async () => {
    const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    mockRequirePlatformAdmin.mockResolvedValueOnce(unauthorized);
    mockIsAuthenticatedOrgUser.mockReturnValueOnce(false);

    const { POST } = await import("@/app/api/admin/agent-keys/route");
    const response = await POST(
      new Request("http://localhost/api/admin/agent-keys", { method: "POST" })
    );

    expect(response.status).toBe(401);
  });

  it("creates a commissioned key for the selected org and user", async () => {
    mockRequirePlatformAdmin.mockResolvedValueOnce({
      profile: {
        id: "platform-admin-1",
        organization_id: "org-platform",
        role: "admin",
        is_platform_admin: true,
      },
      user: { id: "platform-admin-1" },
    });
    mockIsAuthenticatedOrgUser.mockReturnValueOnce(true);

    const { POST } = await import("@/app/api/admin/agent-keys/route");
    const response = await POST(
      new Request("http://localhost/api/admin/agent-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: "org-1",
          user_id: "user-1",
          agent_name: "scribe",
          allow_shared_context: true,
        }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockAgentInsert).toHaveBeenCalledWith({
      organization_id: "org-1",
      user_id: "user-1",
      name: "Scribe",
      slug: "scribe",
      provider: "ghostwriters",
      agent_type: "scribe",
      status: "active",
      allow_shared_context: true,
      commissioned_by: "platform-admin-1",
    });
    expect(mockKeyInsert).toHaveBeenCalledWith({
      agent_id: "agent-1",
      organization_id: "org-1",
      user_id: "user-1",
      agent_name: "scribe",
      api_key_hash: "hashed-key",
      key_prefix: "gw_agent_testpref",
      permissions: ["posts:read", "posts:write"],
      allow_shared_context: true,
      commissioned_by: "platform-admin-1",
    });
    expect(json.api_key).toBe("gw_agent_test_key");
  });
});
