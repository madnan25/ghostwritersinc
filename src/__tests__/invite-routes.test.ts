// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = {
  set: vi.fn(),
};

const mockGetPendingInvitationByToken = vi.fn();
const mockSetInviteCookie = vi.fn();
const mockFrom = vi.fn((table: string) => {
  if (table === "organizations") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: { name: "Ghostwriters Inc." }, error: null })),
        })),
      })),
    };
  }

  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(async () => ({ data: null, error: null })),
      })),
    })),
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@/lib/invitations", () => ({
  getPendingInvitationByToken: mockGetPendingInvitationByToken,
  setInviteCookie: mockSetInviteCookie,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe("invite routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when validate is missing a token", async () => {
    const { GET } = await import("@/app/api/auth/invite/validate/route");
    const response = await GET(new Request("http://localhost/api/auth/invite/validate"));

    expect(response.status).toBe(400);
  });

  it("returns organization metadata for a valid token", async () => {
    mockGetPendingInvitationByToken.mockResolvedValueOnce({
      id: "invite-1",
      organization_id: "org-1",
      email: "admin@example.com",
      role: "member",
    });

    const { GET } = await import("@/app/api/auth/invite/validate/route");
    const response = await GET(
      new Request("http://localhost/api/auth/invite/validate?token=valid-token")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ organization_name: "Ghostwriters Inc." });
  });

  it("sets the invite cookie for a valid invite session", async () => {
    mockGetPendingInvitationByToken.mockResolvedValueOnce({
      id: "invite-1",
      organization_id: "org-1",
      email: "invitee@example.com",
      role: "member",
    });

    const { POST } = await import("@/app/api/auth/invite/session/route");
    const response = await POST(
      new Request("http://localhost/api/auth/invite/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost",
          Host: "localhost",
        },
        body: JSON.stringify({ token: "valid-token" }),
      })
    );

    expect(response.status).toBe(200);
    expect(mockSetInviteCookie).toHaveBeenCalledWith(cookieStore, "valid-token");
  });

  it("rejects invite session setup for invalid invites", async () => {
    mockGetPendingInvitationByToken.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/auth/invite/session/route");
    const response = await POST(
      new Request("http://localhost/api/auth/invite/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost",
          Host: "localhost",
        },
        body: JSON.stringify({ token: "invalid-token" }),
      })
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Invalid or expired invitation");
  });
});
