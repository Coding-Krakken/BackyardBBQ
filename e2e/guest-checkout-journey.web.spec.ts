import { expect, test } from "@playwright/test";

test.describe("Guest checkout journey", () => {
  test("adds an item from menu and reaches checkout with cart context", async ({ page }) => {
    await page.goto("/menu", { waitUntil: "domcontentloaded" });

    const brisketCard = page.getByRole("button", { name: /Smoked Brisket/i }).first();
    const addToCartButton = page.getByRole("button", { name: /Add to Cart/i }).first();

    await brisketCard.click();
    if (!(await addToCartButton.isVisible())) {
      // Hydration can race the first click on server-rendered cards in production builds.
      await brisketCard.click();
    }

    await expect(addToCartButton).toBeVisible();
    await addToCartButton.click();

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Your Cart", exact: true })).toBeVisible();
    await expect(page.getByText("Smoked Brisket", { exact: false })).toBeVisible();

    await page.getByRole("link", { name: "Proceed to Checkout" }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByRole("heading", { name: "Secure Checkout" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Order" })).toBeVisible();
    await expect(page.getByText("Smoked Brisket", { exact: false })).toBeVisible();
  });
});
