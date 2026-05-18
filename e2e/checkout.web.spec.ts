import { expect, test } from "@playwright/test";

test.describe("Checkout entry flow", () => {
  test("renders secure checkout shell and order summary", async ({ page }) => {
    const response = await page.goto("/checkout", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.locator("body")).toContainText("Checkout");
    await expect(page.locator("body")).toContainText("Your Order");
    await expect(page.locator("body")).toContainText("Edit Cart");
    await expect(page.locator("body")).toContainText("Keep Shopping");
  });

  test("shows checkout initialization status copy", async ({ page }) => {
    const response = await page.goto("/checkout", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.locator("body")).toContainText("Your cart is currently empty");
    await expect(page.locator("body")).toContainText("Browse Menu");
  });
});
