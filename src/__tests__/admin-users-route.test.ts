// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mockRequireOrgUser = vi.fn();
const mockIsAuthenticatedOrgUser = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn(() => ({ order: mockOrder }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/server-auth", () => ({
  requireOrgUser: mockRequireOrgUser,
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
    mockRequireOrgUser.mockResolvedValueOnce(unauthorized);
    mockIsAuthenticatedOrgUser.mockReturnValueOnce(false);

    const { GET } = await import("@/app/api/admin/users/route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("returns organization users for owners", async () => {
    mockRequireOrgUser.mockResolvedValueOnce({
      profile: {
        id: "user-1",
        organization_id: "org-1",
        role: "owner",
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
    expect(mockEq).toHaveBeenCalledWith("organization_id", "org-1");
  });
});
