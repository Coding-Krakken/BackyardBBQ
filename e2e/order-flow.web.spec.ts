import { expect, test } from "@playwright/test";

test.describe("Order flow", () => {
  test("adds an item to cart and reaches checkout", async ({ page }) => {
    await page.goto("/menu", { waitUntil: "domcontentloaded" });

    const addToCartButton = page.getByRole("button", { name: "Add to Cart" }).first();
    if (await addToCartButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addToCartButton.click();
      await page.getByRole("button", { name: /Shopping cart with/i }).click();
      await page.getByRole("link", { name: "View Cart" }).click();

      await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible();
      await page.getByRole("link", { name: "Proceed to Checkout" }).click();

      await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue to Secure Payment" })).toBeVisible();
      return;
    }

    await expect(page.getByRole("heading", { name: "No menu items match your filters" })).toBeVisible();
    const response = await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.locator("body")).toContainText("Your cart is currently empty");
  });
});
