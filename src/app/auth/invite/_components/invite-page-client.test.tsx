import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvitePageClient } from "./invite-page-client";

const { mockStartLinkedInOAuth, mockUseSearchParams } = vi.hoisted(() => ({
  mockStartLinkedInOAuth: vi.fn(),
  mockUseSearchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockUseSearchParams(),
}));

vi.mock("@/lib/linkedin-oauth", () => ({
  startLinkedInOAuth: mockStartLinkedInOAuth,
}));

describe("InvitePageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows invalid state when there is no token", () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());

    render(<InvitePageClient />);

    expect(screen.getByText("Invalid invitation")).toBeInTheDocument();
  });

  it("loads invite metadata and starts OAuth after session setup", async () => {
    const user = userEvent.setup();
    mockUseSearchParams.mockReturnValue(new URLSearchParams("token=invite-token"));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ organization_name: "Ghostwriters Inc." }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

    vi.stubGlobal("fetch", fetchMock);

    render(<InvitePageClient />);

    await screen.findByRole("heading", { name: /you're invited/i });
    expect(screen.getByText("Ghostwriters Inc.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /sign in with linkedin/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/invite/session",
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(mockStartLinkedInOAuth).toHaveBeenCalledWith("/dashboard");
  });
});
