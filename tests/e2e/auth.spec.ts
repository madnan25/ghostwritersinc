import { test, expect } from "@playwright/test";

const SUPABASE_URL = "https://oucymcrnspbbkegusjac.supabase.co";

test.describe("Auth — Login page", () => {
  test("renders login page with heading and LinkedIn button", async ({
    page,
  }) => {
    await page.goto("/login");

    // Heading
    await expect(
      page.getByRole("heading", { name: /editorial workspace/i })
    ).toBeVisible();

    // LinkedIn sign-in button
    const linkedInBtn = page.getByRole("button", {
      name: /sign in with linkedin/i,
    });
    await expect(linkedInBtn).toBeVisible();

    // Info text
    await expect(
      page.getByText(/continue with linkedin oauth/i)
    ).toBeVisible();

    // Footer
    await expect(
      page.getByText(/invitation-only/i)
    ).toBeVisible();
  });

  test("shows 'Private Access' kicker label", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByText("Private Access")).toBeVisible();
  });

  test("displays error for invalid invitation", async ({ page }) => {
    await page.goto("/login?error=invalid_invitation");

    await expect(
      page.getByText(/invitation is invalid or has expired/i)
    ).toBeVisible();
  });

  test("displays error for missing invitation", async ({ page }) => {
    await page.goto("/login?error=no_invitation");

    await expect(
      page.getByText(/you need an invitation to join/i)
    ).toBeVisible();
  });

  test("displays error for email mismatch", async ({ page }) => {
    await page.goto("/login?error=invite_email_mismatch");

    await expect(
      page.getByText(/sign in with the same email/i)
    ).toBeVisible();
  });

  test("displays error for profile load failure", async ({ page }) => {
    await page.goto("/login?error=profile_load_failed");

    await expect(
      page.getByText(/workspace profile could not be loaded/i)
    ).toBeVisible();
  });

  test("unauthenticated user accessing /dashboard is redirected to /login", async ({
    page,
  }) => {
    // Mock Supabase auth to return no user (unauthenticated)
    await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Invalid token",
          status: 401,
        }),
      })
    );

    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("LinkedIn button triggers OAuth flow", async ({ page }) => {
    // Intercept the LinkedIn OAuth redirect
    let oauthRequested = false;
    await page.route(`${SUPABASE_URL}/auth/v1/**`, (route) => {
      oauthRequested = true;
      // Fulfill with a redirect-like response to prevent actual navigation
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          provider: "linkedin_oidc",
          url: "https://www.linkedin.com/oauth/v2/authorization?fake=true",
        }),
      });
    });

    await page.goto("/login");
    const linkedInBtn = page.getByRole("button", {
      name: /sign in with linkedin/i,
    });

    await linkedInBtn.click();

    // Give it a moment for the click handler to fire
    await page.waitForTimeout(500);
    expect(oauthRequested).toBe(true);
  });
});
