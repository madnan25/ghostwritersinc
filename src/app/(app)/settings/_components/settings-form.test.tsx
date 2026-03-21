import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsForm } from "./settings-form";

vi.mock("next/image", () => ({
  default: () => null,
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
        canManageOrgSettings={false}
        contextSharingEnabled={false}
      />
    );

    const toggle = screen.getByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("only enables save when settings have changed", async () => {
    const user = userEvent.setup();

    render(
      <SettingsForm
        name="Alex"
        email="alex@example.com"
        avatarUrl={null}
        timezone="UTC"
        notificationsEnabled={true}
        canManageOrgSettings={false}
        contextSharingEnabled={false}
      />
    );

    const saveButton = screen.getAllByRole("button", { name: "Save Settings" }).at(-1);
    expect(saveButton).toBeDefined();
    if (!saveButton) throw new Error("Save Settings button not found");
    expect(saveButton).toBeDisabled();

    const notificationsSwitch = screen.getAllByRole("switch").at(-1);
    expect(notificationsSwitch).toBeDefined();
    if (!notificationsSwitch) throw new Error("Notifications switch not found");

    await user.click(notificationsSwitch);
    expect(saveButton).toBeEnabled();

    await user.click(notificationsSwitch);
    expect(saveButton).toBeDisabled();
  });
});
