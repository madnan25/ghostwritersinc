import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("marketing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Ghostwriters/i);
  });

  test("login page is accessible", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toBeVisible();
  });
});
