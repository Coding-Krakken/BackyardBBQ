import { expect, test } from "@playwright/test";

test.describe("Checkout entry flow", () => {
  test("renders secure checkout shell and order summary", async ({ page }) => {
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Secure Checkout" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Order" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit Cart" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Keep Shopping" })).toBeVisible();
  });

  test("shows payment initialization status copy", async ({ page }) => {
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Preparing secure payment...", { exact: true })).toBeVisible();
  });
});
