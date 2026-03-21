import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { OrgAdminAgentHiringRequestsClient } from "./org-admin-agent-hiring-requests-client";

describe("OrgAdminAgentHiringRequestsClient", () => {
  it("blocks shared-context requests when org sharing is off", async () => {
    const user = userEvent.setup();

    render(
      <OrgAdminAgentHiringRequestsClient
        users={[{ id: "user-1", name: "Alex", email: "alex@example.com" }]}
        initialRequests={[]}
        organizationContextSharingEnabled={false}
      />
    );

    await user.click(screen.getByRole("checkbox"));

    expect(
      screen.getByText(/Turn on Agent context sharing in Settings/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Submit Hiring Request/i })
    ).toBeDisabled();
  });
});
