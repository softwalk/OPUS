import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should display the landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/SaaS Factory/);
  });

  test("should show hero section with CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /comenzar/i }).first()).toBeVisible();
  });

  test("should navigate to login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /iniciar|login|entrar/i }).first().click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("should navigate to register", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /registr|signup|crear cuenta|comenzar/i }).first().click();
    await expect(page).toHaveURL(/\/register/);
  });
});
