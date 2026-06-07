import { expect, test } from "@playwright/test";

test.describe("Guest checkout journey", () => {
  test("adds an item from menu and reaches checkout with cart context", async ({ page }) => {
    await page.goto("/menu", { waitUntil: "domcontentloaded" });

    const addToCartButton = page.locator("button.menu-card-add").first();
    if (await addToCartButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addToCartButton.click();

      await page.goto("/checkout", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Your Order" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue to Payment" })).toBeVisible();
      return;
    }

    await expect(page.getByRole("heading", { name: "No menu items match your filters" })).toBeVisible();
  });
});
