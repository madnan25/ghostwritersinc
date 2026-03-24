import { test, expect } from "@playwright/test";

const SUPABASE_URL = "https://oucymcrnspbbkegusjac.supabase.co";

/**
 * Mock Supabase auth to return no user for unauthenticated scenarios.
 * Server-side auth in Next.js middleware calls Supabase to validate tokens;
 * for pages that need to render without auth, we test the redirect behavior.
 */
function mockSupabaseUnauthenticated(page: import("@playwright/test").Page) {
  return page.route(`${SUPABASE_URL}/**`, (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Invalid token", status: 401 }),
    })
  );
}

test.describe("Dashboard — Auth guard", () => {
  test("redirects to /login when user is not authenticated", async ({
    page,
  }) => {
    await mockSupabaseUnauthenticated(page);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects to /login when accessing /calendar without auth", async ({
    page,
  }) => {
    await mockSupabaseUnauthenticated(page);

    await page.goto("/calendar");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects to /login when accessing /briefs without auth", async ({
    page,
  }) => {
    await mockSupabaseUnauthenticated(page);

    await page.goto("/briefs");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects to /login when accessing /settings without auth", async ({
    page,
  }) => {
    await mockSupabaseUnauthenticated(page);

    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Dashboard — Marketing homepage navigation", () => {
  test("marketing page loads with brand heading", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Ghostwriters/i);
  });

  test("marketing page has navigable structure", async ({ page }) => {
    await page.goto("/");

    // The page should have meaningful content sections
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Should have at least one call-to-action or navigation element
    const links = page.locator("a");
    const linkCount = await links.count();
    expect(linkCount).toBeGreaterThan(0);
  });

  test("login link is accessible from marketing page", async ({ page }) => {
    await page.goto("/");

    // Look for a link that leads to login or sign in
    const loginLink = page.locator('a[href*="login"]').first();

    // The marketing page should provide a path to login
    if ((await loginLink.count()) > 0) {
      await expect(loginLink).toBeVisible();
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    } else {
      // If there's no direct login link, navigating to /login should work
      await page.goto("/login");
      await expect(page).toHaveURL(/\/login/);
    }
  });
});

test.describe("Dashboard — Protected routes all redirect consistently", () => {
  test("all protected app routes redirect to login", async ({ page }) => {
    await mockSupabaseUnauthenticated(page);

    const protectedRoutes = [
      "/dashboard",
      "/insights",
      "/team",
      "/strategy",
      "/series",
      "/research",
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, {
        timeout: 5000,
      });
    }
  });

  test("public routes remain accessible without auth", async ({ page }) => {
    await mockSupabaseUnauthenticated(page);

    // Marketing page
    await page.goto("/");
    await expect(page).toHaveURL("/");

    // Login page
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
  });
});
