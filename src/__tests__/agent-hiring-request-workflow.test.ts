// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireOrgAdminOrPlatformAdmin = vi.fn();
const mockRequirePlatformAdmin = vi.fn();
const mockIsAuthenticatedOrgUser = vi.fn();
const mockCommissionPresetAgentTeam = vi.fn();

const mockOrganizationMaybeSingle = vi.fn();
const mockUserMaybeSingle = vi.fn();
const mockHiringRequestInsertSingle = vi.fn();
const mockHiringRequestMaybeSingle = vi.fn();
const mockHiringRequestUpdateSingle = vi.fn();

vi.mock("@/lib/server-auth", () => ({
  requireOrgAdminOrPlatformAdmin: mockRequireOrgAdminOrPlatformAdmin,
  requirePlatformAdmin: mockRequirePlatformAdmin,
  isAuthenticatedOrgUser: mockIsAuthenticatedOrgUser,
}));

vi.mock("@/lib/agent-team-presets", () => ({
  getAgentTeamPreset: vi.fn((key: string) =>
    key === "editorial-core" ? { key, label: "Editorial Core" } : null
  ),
}));

vi.mock("@/lib/agent-fulfillment", () => ({
  commissionPresetAgentTeam: mockCommissionPresetAgentTeam,
  AgentFulfillmentError: class AgentFulfillmentError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "organizations") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: mockOrganizationMaybeSingle,
            })),
          })),
        };
      }

      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: mockUserMaybeSingle,
              })),
            })),
          })),
        };
      }

      if (table === "agent_hiring_requests") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: mockHiringRequestMaybeSingle,
              order: vi.fn(),
            })),
            order: vi.fn(),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: mockHiringRequestInsertSingle,
            })),
          })),
          update: vi.fn(() => {
            const eqChain: Record<string, unknown> = {};
            eqChain.eq = vi.fn(() => eqChain);
            eqChain.select = vi.fn(() => ({
              maybeSingle: mockHiringRequestMaybeSingle,
              single: mockHiringRequestUpdateSingle,
            }));
            return eqChain;
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  })),
}));

describe("agent hiring request workflow routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects shared-context hiring requests when org sharing is off", async () => {
    mockRequireOrgAdminOrPlatformAdmin.mockResolvedValueOnce({
      profile: {
        id: "admin-1",
        organization_id: "org-1",
        role: "admin",
        is_platform_admin: false,
      },
    });
    mockIsAuthenticatedOrgUser.mockReturnValueOnce(true);
    mockOrganizationMaybeSingle.mockResolvedValueOnce({
      data: { context_sharing_enabled: false },
      error: null,
    });

    const { POST } = await import("@/app/api/org-admin/agent-hiring-requests/route");
    const response = await POST(
      new Request("http://localhost/api/org-admin/agent-hiring-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_for_user_id: "user-1",
          preset_key: "editorial-core",
          requested_shared_context: true,
        }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toMatch(/Turn on Agent context sharing/i);
  });

  it("creates an org-admin hiring request for a same-org user", async () => {
    mockRequireOrgAdminOrPlatformAdmin.mockResolvedValueOnce({
      profile: {
        id: "admin-1",
        organization_id: "org-1",
        role: "admin",
        is_platform_admin: false,
      },
    });
    mockIsAuthenticatedOrgUser.mockReturnValueOnce(true);
    mockOrganizationMaybeSingle.mockResolvedValueOnce({
      data: { context_sharing_enabled: true },
      error: null,
    });
    mockUserMaybeSingle.mockResolvedValueOnce({
      data: { id: "user-1" },
      error: null,
    });
    mockHiringRequestInsertSingle.mockResolvedValueOnce({
      data: {
        id: "request-1",
        organization_id: "org-1",
        requested_by: "admin-1",
        requested_for_user_id: "user-1",
        preset_key: "editorial-core",
        requested_shared_context: false,
        status: "pending",
        created_at: "2026-03-18T00:00:00.000Z",
        updated_at: "2026-03-18T00:00:00.000Z",
      },
      error: null,
    });

    const { POST } = await import("@/app/api/org-admin/agent-hiring-requests/route");
    const response = await POST(
      new Request("http://localhost/api/org-admin/agent-hiring-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: "org-2",
          requested_for_user_id: "user-1",
          preset_key: "editorial-core",
          requested_shared_context: false,
        }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.organization_id).toBe("org-1");
  });

  it("approves pending hiring requests by commissioning the preset team", async () => {
    mockRequirePlatformAdmin.mockResolvedValueOnce({
      profile: {
        id: "platform-1",
        organization_id: "platform-org",
        role: "admin",
        is_platform_admin: true,
      },
    });
    mockIsAuthenticatedOrgUser.mockReturnValueOnce(true);
    mockHiringRequestMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "request-1",
        organization_id: "org-1",
        requested_for_user_id: "user-1",
        preset_key: "editorial-core",
        requested_shared_context: false,
        status: "pending",
      },
      error: null,
    });
    mockCommissionPresetAgentTeam.mockResolvedValueOnce([
      { id: "agent-1" },
      { id: "agent-2" },
    ]);
    mockHiringRequestUpdateSingle.mockResolvedValueOnce({
      data: {
        id: "request-1",
        organization_id: "org-1",
        requested_by: "admin-1",
        requested_for_user_id: "user-1",
        preset_key: "editorial-core",
        requested_shared_context: false,
        status: "approved",
        decision_notes: null,
        reviewed_by: "platform-1",
        reviewed_at: "2026-03-18T00:00:00.000Z",
        fulfilled_agent_ids: ["agent-1", "agent-2"],
        created_at: "2026-03-18T00:00:00.000Z",
        updated_at: "2026-03-18T00:00:00.000Z",
      },
      error: null,
    });

    const { POST } = await import("@/app/api/admin/agent-hiring-requests/[id]/approve/route");
    const response = await POST(
      new Request("http://localhost/api/admin/agent-hiring-requests/request-1/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "request-1" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockCommissionPresetAgentTeam).toHaveBeenCalled();
    expect(json.request.status).toBe("approved");
    expect(json.commissioned_agents).toHaveLength(2);
  });
});
