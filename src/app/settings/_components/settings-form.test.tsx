import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsForm } from "./settings-form";

const { mockStartLinkedInOAuth } = vi.hoisted(() => ({
  mockStartLinkedInOAuth: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("@/lib/linkedin-oauth", () => ({
  startLinkedInOAuth: mockStartLinkedInOAuth,
}));

vi.mock("@/app/actions/auth", () => ({
  updateUserSettings: vi.fn(),
  signOut: vi.fn(),
}));

describe("SettingsForm", () => {
  it("toggles notifications accessibly", async () => {
    const user = userEvent.setup();

    render(
      <SettingsForm
        name="Alex"
        email="alex@example.com"
        avatarUrl={null}
        timezone="UTC"
        notificationsEnabled={true}
        linkedInConnected={false}
        linkedInExpiresAt={null}
      />
    );

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("uses the shared LinkedIn reconnect flow", async () => {
    const user = userEvent.setup();

    render(
      <SettingsForm
        name="Alex"
        email="alex@example.com"
        avatarUrl={null}
        timezone="UTC"
        notificationsEnabled={true}
        linkedInConnected={false}
        linkedInExpiresAt={null}
      />
    );

    await user.click(screen.getAllByRole("button", { name: "Connect LinkedIn" })[0]);
    expect(mockStartLinkedInOAuth).toHaveBeenCalledWith("/settings");
  });
});
