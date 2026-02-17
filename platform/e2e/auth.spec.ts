import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should show login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Contrasena")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
  });

  test("should show register form", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByLabel("Nombre", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Contrasena")).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear Cuenta" })).toBeVisible();
  });

  test("should reject invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("wrong@email.com");
    await page.getByLabel("Contrasena").fill("wrongpassword");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText("Email o contrasena incorrectos")).toBeVisible({ timeout: 10000 });
  });

  test("should login with demo user", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("demo@saasfactory.dev");
    await page.getByLabel("Contrasena").fill("demo1234");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await page.waitForURL(/\/(dashboard|apps)/, { timeout: 15000 });
    const url = page.url();
    expect(url).not.toContain("/login");
  });

  test("should redirect unauthenticated users to login", async ({ page }) => {
    await page.goto("/apps");
    await expect(page).toHaveURL(/\/login/);
  });

  test("should redirect unauthenticated users from settings", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });
});
