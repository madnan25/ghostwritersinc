// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mockRequirePlatformAdmin = vi.fn();
const mockIsAuthenticatedOrgUser = vi.fn();
const mockOrder = vi.fn();
const mockSelect = vi.fn(() => ({ order: mockOrder }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/server-auth", () => ({
  requirePlatformAdmin: mockRequirePlatformAdmin,
  isAuthenticatedOrgUser: mockIsAuthenticatedOrgUser,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth errors from the shared guard", async () => {
    const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    mockRequirePlatformAdmin.mockResolvedValueOnce(unauthorized);
    mockIsAuthenticatedOrgUser.mockReturnValueOnce(false);

    const { GET } = await import("@/app/api/admin/users/route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns platform users for platform admins", async () => {
    mockRequirePlatformAdmin.mockResolvedValueOnce({
      profile: {
        id: "user-1",
        organization_id: "org-1",
        role: "admin",
        is_platform_admin: true,
      },
      user: { id: "user-1" },
    });
    mockIsAuthenticatedOrgUser.mockReturnValueOnce(true);
    mockOrder.mockResolvedValueOnce({
      data: [{ id: "user-2", email: "member@example.com" }],
      error: null,
    });

    const { GET } = await import("@/app/api/admin/users/route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual([{ id: "user-2", email: "member@example.com" }]);
    expect(mockSelect).toHaveBeenCalledWith(
      "id, organization_id, name, email, avatar_url, role, is_active, is_platform_admin, created_at"
    );
  });
});
