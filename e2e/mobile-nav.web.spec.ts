import { expect, test } from "@playwright/test";

test.describe("Mobile conversion bar", () => {
  test("shows sticky mobile bottom bar links", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const quickActions = page.getByRole("navigation", { name: "Mobile quick actions" });
    await expect(quickActions).toBeVisible();
    await expect(quickActions.getByRole("link", { name: "Order", exact: true })).toBeVisible();
    await expect(quickActions.getByRole("link", { name: "Catering", exact: true })).toBeVisible();

    const reserveLink = quickActions.getByRole("link", { name: "Reserve", exact: true });
    if (await reserveLink.count() > 0) {
      await expect(reserveLink).toBeVisible();
    }
  });
});
