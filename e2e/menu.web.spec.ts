import { expect, test } from "@playwright/test";

test.describe("Web menu experience", () => {
  test("loads primary menu content and category controls", async ({ page }) => {
    await page.goto("/menu", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Slow-Smoked BBQ, Sides & More" })).toBeVisible();
    await expect(page.locator(".category-nav").getByRole("button", { name: "All Items", exact: true })).toBeVisible();
    await expect(page.locator(".category-nav").getByRole("button", { name: "Meats", exact: true })).toBeVisible();
    await expect(page.getByPlaceholder("Search combos, meats, sides, drinks, and more")).toBeVisible();
  });

  test("opens a menu item detail modal when items are available", async ({ page }) => {
    await page.goto("/menu", { waitUntil: "domcontentloaded" });

    const menuCards = page.locator(".menu-card");
    if (await menuCards.count()) {
      await menuCards.first().click();
      await expect(page.locator(".modal-content")).toBeVisible();
      await expect(page.locator(".modal-title")).toBeVisible();
      await expect(page.locator(".modal-footer").locator("button.btn-full").first()).toBeVisible();
      return;
    }

    await expect(page.getByRole("heading", { name: "No menu items match your filters" })).toBeVisible();
  });
});
