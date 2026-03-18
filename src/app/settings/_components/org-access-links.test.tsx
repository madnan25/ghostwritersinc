import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrgAccessLinks } from "./org-access-links";

describe("OrgAccessLinks", () => {
  it("shows disabled cards for members", () => {
    render(<OrgAccessLinks disabled={true} />);

    expect(screen.getByText("Hiring Agents")).toBeInTheDocument();
    expect(screen.getByText("Team Access")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Hire Agent Team/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Manage Users/i })).not.toBeInTheDocument();
  });

  it("shows active links for admins", () => {
    render(<OrgAccessLinks disabled={false} />);

    expect(screen.getByRole("link", { name: /Hire Agent Team/i })).toHaveAttribute(
      "href",
      "/settings/agents"
    );
    expect(screen.getByRole("link", { name: /Manage Users/i })).toHaveAttribute(
      "href",
      "/settings/users"
    );
  });
});
