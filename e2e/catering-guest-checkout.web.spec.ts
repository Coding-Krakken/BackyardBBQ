import { expect, test } from "@playwright/test";

test.describe("@catering Guest catering checkout readiness", () => {
  test("renders catering lead funnel and quote entry action", async ({ page }) => {
    const response = await page.goto("/catering", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("button", { name: "Get Catering Quote" }).first()).toBeVisible();
    await expect(page.locator("body")).toContainText(/catering/i);
  });

  test("submits catering quote and keeps checkout path available", async ({ page }) => {
    await page.goto("/catering", { waitUntil: "domcontentloaded" });

    const wizardPanel = page.locator(".wizard-panel");
    await page.getByRole("button", { name: "Get Catering Quote" }).first().click({ force: true });

    await wizardPanel.getByLabel("Event date").fill("2026-08-14");
    await wizardPanel.getByRole("button", { name: "Continue" }).click();
    await wizardPanel.getByLabel("Guest count").fill("48");
    await wizardPanel.getByRole("button", { name: "Continue" }).click();
    await wizardPanel.getByLabel("Name").fill("Casey Ember");
    await wizardPanel.getByLabel("Email").fill("casey@example.com");
    await wizardPanel.getByLabel("Phone").fill("+1 555-818-2233");
    await wizardPanel.getByRole("button", { name: "Continue" }).click();
    await wizardPanel.getByRole("button", { name: "Submit Catering Quote" }).click();

    await expect(page.getByRole("heading", { name: "Quote Request Submitted" })).toBeVisible();

    const checkoutResponse = await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    expect(checkoutResponse?.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/checkout/);
  });
});
