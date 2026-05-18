import { expect, test } from "@playwright/test";

test.describe("Empty cart checkout", () => {
  test("shows useful empty state", async ({ page }) => {
    const response = await page.goto("/checkout", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.locator("body")).toContainText("Checkout");
    await expect(page.locator("body")).toContainText("Your cart is currently empty");
    await expect(page.locator("body")).toContainText("Browse Menu");
    await expect(page.locator("body")).toContainText("No items yet.");
  });
});
