import { expect, test } from "@playwright/test";

test.describe("Catering lead flow", () => {
  test("progresses through wizard and submits inquiry", async ({ page }) => {
    await page.goto("/catering", { waitUntil: "domcontentloaded" });
    const wizardPanel = page.locator(".wizard-panel");

    await page.getByRole("button", { name: "Get Catering Quote" }).first().click({ force: true });

    await wizardPanel.getByLabel("Event date").fill("2026-07-10");
    await wizardPanel.getByRole("button", { name: "Continue" }).click();
    await expect(wizardPanel.getByRole("heading", { name: "Step 2 of 4" })).toBeVisible();

    await wizardPanel.getByLabel("Guest count").fill("60");
    await wizardPanel.getByRole("button", { name: "Continue" }).click();
    await expect(wizardPanel.getByRole("heading", { name: "Step 3 of 4" })).toBeVisible();

    await wizardPanel.getByLabel("Name").fill("Jordan Smoke");
    await wizardPanel.getByLabel("Email").fill("jordan@example.com");
    await wizardPanel.getByLabel("Phone").fill("+1 555-222-3333");
    await wizardPanel.getByRole("button", { name: "Continue" }).click();
    await expect(wizardPanel.getByRole("heading", { name: "Step 4 of 4" })).toBeVisible();

    await wizardPanel.getByRole("button", { name: "Submit Catering Quote" }).click();

    await expect(page.getByRole("heading", { name: "Quote Request Submitted" })).toBeVisible();
  });
});
