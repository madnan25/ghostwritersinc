import { test, expect } from "@playwright/test";

const SUPABASE_URL = "https://oucymcrnspbbkegusjac.supabase.co";

function mockSupabaseUnauthenticated(page: import("@playwright/test").Page) {
  return page.route(`${SUPABASE_URL}/**`, (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Invalid token", status: 401 }),
    })
  );
}

test.describe("Post CRUD — Auth guards on post routes", () => {
  test("accessing /post/:id without auth redirects to /login", async ({
    page,
  }) => {
    await mockSupabaseUnauthenticated(page);

    await page.goto("/post/00000000-0000-0000-0000-000000000001");
    await expect(page).toHaveURL(/\/login/);
  });

  test("accessing /onboarding without auth redirects to /login", async ({
    page,
  }) => {
    await mockSupabaseUnauthenticated(page);
    await page.goto("/onboarding");
    // Middleware redirects unauthenticated onboarding to login
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Post CRUD — Invite flow (client-rendered)", () => {
  test("invite page without token shows invalid state", async ({ page }) => {
    await page.goto("/auth/invite");

    await expect(page.getByText(/invalid invitation/i)).toBeVisible();
    await expect(
      page.getByText(/invitation link is invalid or has expired/i)
    ).toBeVisible();

    // Should have a link back to login
    const backLink = page.getByRole("link", { name: /back to login/i });
    await expect(backLink).toBeVisible();
  });

  test("invite page with invalid token shows invalid state after validation", async ({
    page,
  }) => {
    // Mock the validate endpoint to return no org name (invalid)
    await page.route("**/api/auth/invite/validate*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ valid: false }),
      })
    );

    await page.goto("/auth/invite?token=fake-expired-token");

    // Should show loading first, then invalid
    await expect(page.getByText(/invalid invitation/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("invite page with valid token shows org name and sign-in button", async ({
    page,
  }) => {
    // Mock the validate endpoint to return a valid org
    await page.route("**/api/auth/invite/validate*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ organization_name: "Acme Corp" }),
      })
    );

    await page.goto("/auth/invite?token=valid-test-token");

    // Should display the org name
    await expect(page.getByText("Acme Corp", { exact: true })).toBeVisible({ timeout: 5000 });

    // Should have Sign in with LinkedIn button
    const signInBtn = page.getByRole("button", {
      name: /sign in with linkedin/i,
    });
    await expect(signInBtn).toBeVisible();

    // Should show feature cards
    await expect(page.getByText("Review Flow")).toBeVisible();
    await expect(page.getByText("Team Access")).toBeVisible();
  });

  test("invite sign-in button calls session endpoint then triggers OAuth", async ({
    page,
  }) => {
    // Mock validate
    await page.route("**/api/auth/invite/validate*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ organization_name: "Test Workspace" }),
      })
    );

    // Mock session creation
    let sessionCalled = false;
    await page.route("**/api/auth/invite/session", (route) => {
      sessionCalled = true;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    // Mock Supabase OAuth call
    let oauthCalled = false;
    await page.route(`${SUPABASE_URL}/auth/v1/**`, (route) => {
      oauthCalled = true;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          provider: "linkedin_oidc",
          url: "https://www.linkedin.com/oauth/v2/authorization?fake=true",
        }),
      });
    });

    await page.goto("/auth/invite?token=valid-test-token");

    // Wait for valid state
    await expect(page.getByText("Test Workspace", { exact: true })).toBeVisible({
      timeout: 5000,
    });

    // Click sign in
    const signInBtn = page.getByRole("button", {
      name: /sign in with linkedin/i,
    });
    await signInBtn.click();

    // Wait for session and OAuth to be called
    await page.waitForTimeout(1000);
    expect(sessionCalled).toBe(true);
    expect(oauthCalled).toBe(true);
  });

  test("invite sign-in with failed session reverts to invalid", async ({
    page,
  }) => {
    // Mock validate as valid
    await page.route("**/api/auth/invite/validate*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ organization_name: "Test Org" }),
      })
    );

    // Mock session creation as failure
    await page.route("**/api/auth/invite/session", (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "Token expired" }),
      })
    );

    await page.goto("/auth/invite?token=expired-token");
    await expect(page.getByText("Test Org", { exact: true })).toBeVisible({ timeout: 5000 });

    // Click sign in — should fail and show invalid state
    const signInBtn = page.getByRole("button", {
      name: /sign in with linkedin/i,
    });
    await signInBtn.click();

    await expect(page.getByText(/invalid invitation/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("back to login link from invalid invite navigates correctly", async ({
    page,
  }) => {
    await page.goto("/auth/invite");

    await expect(page.getByText(/invalid invitation/i)).toBeVisible();

    const backLink = page.getByRole("link", { name: /back to login/i });
    await backLink.click();

    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Post CRUD — Auth callback route", () => {
  test("auth callback without code parameter still loads", async ({
    page,
  }) => {
    // The callback is a server route (route.ts), so it may redirect or return an error
    const response = await page.goto("/auth/callback");

    // Should get some response (redirect or error) — not crash
    expect(response).not.toBeNull();
  });
});
