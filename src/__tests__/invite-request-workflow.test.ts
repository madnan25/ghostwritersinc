// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireOrgAdminOrPlatformAdmin = vi.fn();
const mockRequirePlatformAdmin = vi.fn();
const mockIsAuthenticatedOrgUser = vi.fn();
const mockIssueUserInvitation = vi.fn();

const mockUsersMaybeSingle = vi.fn();
const mockInviteRequestOrder = vi.fn();
const mockInviteRequestMaybeSingle = vi.fn();
const mockInviteRequestInsertSingle = vi.fn();
const mockInviteRequestUpdateSingle = vi.fn();

vi.mock("@/lib/server-auth", () => ({
  requireOrgAdminOrPlatformAdmin: mockRequireOrgAdminOrPlatformAdmin,
  requirePlatformAdmin: mockRequirePlatformAdmin,
  isAuthenticatedOrgUser: mockIsAuthenticatedOrgUser,
}));

vi.mock("@/lib/invitation-fulfillment", () => ({
  normalizeRequestedRole: vi.fn((role: string) => (role === "admin" ? "admin" : "member")),
  issueUserInvitation: mockIssueUserInvitation,
  InvitationFulfillmentError: class InvitationFulfillmentError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("@/lib/invitations", () => ({
  normalizeInviteEmail: vi.fn((email: string) => email.trim().toLowerCase()),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: mockUsersMaybeSingle,
              })),
            })),
          })),
        };
      }

      if (table === "invite_requests") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: mockInviteRequestOrder,
              maybeSingle: mockInviteRequestMaybeSingle,
            })),
            order: mockInviteRequestOrder,
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: mockInviteRequestInsertSingle,
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: mockInviteRequestUpdateSingle,
              })),
            })),
          })),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  })),
}));

describe("invite request workflow routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates invite requests in the org admin's own org", async () => {
    mockRequireOrgAdminOrPlatformAdmin.mockResolvedValueOnce({
      profile: {
        id: "admin-1",
        organization_id: "org-1",
        role: "admin",
        is_platform_admin: false,
      },
    });
    mockIsAuthenticatedOrgUser.mockReturnValueOnce(true);
    mockUsersMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    mockInviteRequestInsertSingle.mockResolvedValueOnce({
      data: {
        id: "request-1",
        organization_id: "org-1",
        requested_by: "admin-1",
        requested_email: "teammate@example.com",
        requested_role: "member",
        status: "pending",
        created_at: "2026-03-18T00:00:00.000Z",
        updated_at: "2026-03-18T00:00:00.000Z",
      },
      error: null,
    });

    const { POST } = await import("@/app/api/org-admin/invite-requests/route");
    const response = await POST(
      new Request("http://localhost/api/org-admin/invite-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: "org-2",
          email: "Teammate@example.com",
          role: "member",
        }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.organization_id).toBe("org-1");
  });

  it("approves invite requests by issuing the real invitation", async () => {
    mockRequirePlatformAdmin.mockResolvedValueOnce({
      profile: {
        id: "platform-1",
        organization_id: "platform-org",
        role: "admin",
        is_platform_admin: true,
      },
    });
    mockIsAuthenticatedOrgUser.mockReturnValueOnce(true);
    mockInviteRequestMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "request-1",
        organization_id: "org-1",
        requested_email: "teammate@example.com",
        requested_role: "member",
        status: "pending",
        fulfilled_invitation_id: null,
      },
      error: null,
    });
    mockIssueUserInvitation.mockResolvedValueOnce({
      invitation: {
        id: "invite-1",
        organization_id: "org-1",
        email: "teammate@example.com",
        role: "member",
        expires_at: "2026-03-25T00:00:00.000Z",
        created_at: "2026-03-18T00:00:00.000Z",
      },
      inviteUrl: "http://localhost/auth/invite?token=abc",
    });
    mockInviteRequestUpdateSingle.mockResolvedValueOnce({
      data: {
        id: "request-1",
        status: "approved",
        organization_id: "org-1",
        requested_by: "admin-1",
        requested_email: "teammate@example.com",
        requested_role: "member",
        decision_notes: null,
        reviewed_by: "platform-1",
        reviewed_at: "2026-03-18T00:00:00.000Z",
        fulfilled_invitation_id: "invite-1",
        created_at: "2026-03-18T00:00:00.000Z",
        updated_at: "2026-03-18T00:00:00.000Z",
      },
      error: null,
    });

    const { POST } = await import("@/app/api/admin/invite-requests/[id]/approve/route");
    const response = await POST(
      new Request("http://localhost/api/admin/invite-requests/request-1/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "request-1" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockIssueUserInvitation).toHaveBeenCalled();
    expect(json.request.status).toBe("approved");
    expect(json.invitation.invite_url).toContain("/auth/invite?token=");
  });

  it("denies only pending invite requests", async () => {
    mockRequirePlatformAdmin.mockResolvedValueOnce({
      profile: {
        id: "platform-1",
        organization_id: "platform-org",
        role: "admin",
        is_platform_admin: true,
      },
    });
    mockIsAuthenticatedOrgUser.mockReturnValueOnce(true);
    mockInviteRequestMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "request-1",
        status: "pending",
      },
      error: null,
    });
    mockInviteRequestUpdateSingle.mockResolvedValueOnce({
      data: {
        id: "request-1",
        organization_id: "org-1",
        requested_by: "admin-1",
        requested_email: "teammate@example.com",
        requested_role: "member",
        status: "denied",
        decision_notes: null,
        reviewed_by: "platform-1",
        reviewed_at: "2026-03-18T00:00:00.000Z",
        fulfilled_invitation_id: null,
        created_at: "2026-03-18T00:00:00.000Z",
        updated_at: "2026-03-18T00:00:00.000Z",
      },
      error: null,
    });

    const { POST } = await import("@/app/api/admin/invite-requests/[id]/deny/route");
    const response = await POST(
      new Request("http://localhost/api/admin/invite-requests/request-1/deny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: "request-1" }) }
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.status).toBe("denied");
  });
});
