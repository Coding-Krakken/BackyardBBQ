import { expect, test } from "@playwright/test";

test.describe("Web menu experience", () => {
  test("loads primary menu content and category controls", async ({ page }) => {
    await page.goto("/menu", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Slow-Smoked BBQ, Sides & More" })).toBeVisible();
    await expect(page.getByRole("button", { name: "All Items" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mains / Platters" })).toBeVisible();
  });

  test("opens a menu item detail modal", async ({ page }) => {
    await page.goto("/menu", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: /Smoked Brisket/i }).first().click();
    await expect(page.getByRole("heading", { name: "Smoked Brisket" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Add to Cart/i })).toBeVisible();
  });
});
