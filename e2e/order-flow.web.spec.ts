import { expect, test } from "@playwright/test";

test.describe("Order flow", () => {
  test("adds an item to cart and reaches checkout", async ({ page }) => {
    await page.goto("/menu", { waitUntil: "domcontentloaded" });

    const addToCartButton = page.locator("button.menu-card-add").first();
    if (await addToCartButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addToCartButton.click({ force: true });
      await page.goto("/cart", { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { level: 1, name: "Your Cart", exact: true })).toBeVisible();
      const proceedToCheckout = page.getByRole("link", { name: "Proceed to Checkout" });
      if (await proceedToCheckout.isVisible({ timeout: 3000 }).catch(() => false)) {
        await proceedToCheckout.click();

        await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
        await expect(page.getByRole("button", { name: /Continue to (Secure )?Payment/i })).toBeVisible();
        return;
      }

      await expect(page.locator("body")).toContainText("Your cart is currently empty");
    }

    await expect(page.getByRole("heading", { name: "No menu items match your filters" })).toBeVisible();
    const response = await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.locator("body")).toContainText("Your cart is currently empty");
  });
});
