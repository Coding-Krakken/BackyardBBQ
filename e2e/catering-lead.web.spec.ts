import { expect, test } from "@playwright/test";

test.describe("Catering lead flow", () => {
  test("submits inquiry form and displays confirmation", async ({ page }) => {
    await page.goto("/catering", { waitUntil: "domcontentloaded" });

    const form = page.locator(".inquiry-form");
    await expect(form).toBeVisible();

    // Fill event details
    await form.locator("input[type='date']").fill("2026-07-10");
    await form.locator("input[type='number']").fill("60");
    await form.locator("input[type='text']").first().fill("Riverside Park Event Center");

    // Fill food preferences
    await form.locator("textarea").first().fill("Brisket, pulled pork, and ribs with all the classic sides. Need a gluten-free option.");

    // Fill contact information
    await form.locator("input[type='text']").nth(1).fill("Jordan Smoke");
    await form.locator("input[type='email']").fill("jordan@example.com");
    await form.locator("input[type='tel']").fill("+1 555-222-3333");

    await page.getByRole("button", { name: "Submit Catering Inquiry" }).click();

    await expect(page.getByRole("heading", { name: "Inquiry Submitted!" })).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".reference")).toContainText(/CAT-/);
  });

  test("validates required fields before submission", async ({ page }) => {
    await page.goto("/catering", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: "Submit Catering Inquiry" }).click();

    // Should show validation errors, not navigate away
    await expect(page).toHaveURL(/\/catering$/);
    await expect(page.locator(".field-error").first()).toBeVisible();
  });
});
