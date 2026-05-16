import { expect, test } from "@playwright/test";

test.describe("Admin access", () => {
  test("redirects protected dashboard route to login", async ({ page }) => {
    await page.goto("/dashboard/payments", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole("heading", { name: "Backyard BBQ" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });
});
