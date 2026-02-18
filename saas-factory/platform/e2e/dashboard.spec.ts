import { test, expect } from "@playwright/test";

// Reusable login helper
async function loginAsDemo(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill("demo@saasfactory.dev");
  await page.getByLabel("Contrasena").fill("demo1234");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(/\/(dashboard|apps)/, { timeout: 15000 });
}

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
  });

  test("should display apps page", async ({ page }) => {
    await page.goto("/apps");
    await expect(page).toHaveURL(/\/apps/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("should display new app wizard", async ({ page }) => {
    await page.goto("/apps/new");
    await expect(page).toHaveURL(/\/apps\/new/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("should display settings page with org info", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText("demo@saasfactory.dev")).toBeVisible();
  });
});

test.describe("API - Blueprints", () => {
  test("should return blueprints list (public)", async ({ request }) => {
    const response = await request.get("/api/v1/blueprints");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    const crm = data.find((b: { id: string }) => b.id === "crm");
    expect(crm).toBeTruthy();
    expect(crm.name).toContain("CRM");
  });

  test("should return specific blueprint with entities", async ({ request }) => {
    const response = await request.get("/api/v1/blueprints?id=crm");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.id || data[0]?.id).toBe("crm");
  });
});
