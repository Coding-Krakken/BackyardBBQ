import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("@auth Admin payments authenticated journey", () => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated admin E2E tests.");

  test("signs in and loads payments dashboard", async ({ page }) => {
    await page.goto("/dashboard/payments", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/auth\/login/);
    await page.getByRole("textbox", { name: "Email" }).fill(adminEmail ?? "");
    await page.getByRole("textbox", { name: "Password" }).fill(adminPassword ?? "");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page).toHaveURL(/\/dashboard(\/payments)?/);
    await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Transactions" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Disputes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Analytics" })).toBeVisible();

    await page.getByRole("button", { name: "Disputes" }).click();
    await expect(page.getByText("Status:", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Analytics" }).click();
    await expect(page.getByText("Total Volume", { exact: true })).toBeVisible();
    await expect(page.getByText("Refund Amount Trend", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Transactions" }).click();
    await expect(page.getByText("Select at least 2 successful transactions.", { exact: true })).toBeVisible();
  });
});
