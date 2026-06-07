import { expect, test } from "@playwright/test";

test.describe("@catering Guest catering inquiry flow", () => {
  test("renders catering inquiry form with required fields", async ({ page }) => {
    const response = await page.goto("/catering", { waitUntil: "domcontentloaded" });

    expect(response?.ok()).toBeTruthy();
    await expect(page.locator("body")).toContainText(/catering/i);
    await expect(page.getByRole("heading", { name: "Custom BBQ Catering for Your Event" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit Catering Inquiry" })).toBeVisible();
  });

  test("submits catering inquiry and redirects to confirmation", async ({ page }) => {
    await page.goto("/catering", { waitUntil: "domcontentloaded" });

    const form = page.locator(".inquiry-form");

    await form.locator("input[type='date']").fill("2026-08-14");
    await form.locator("input[type='number']").fill("48");
    await form.locator("input[type='text']").first().fill("City Park Pavilion, Austin TX");
    await form.locator("textarea").first().fill("Pulled pork and brisket with mac & cheese, coleslaw, and cornbread for 48 guests");
    await form.locator("input[type='text']").nth(1).fill("Casey Ember");
    await form.locator("input[type='email']").fill("casey@example.com");
    await form.locator("input[type='tel']").fill("+1 555-818-2233");

    await page.getByRole("button", { name: "Submit Catering Inquiry" }).click();

    await page.waitForURL(/\/catering\/confirmation\//, { timeout: 30000 });
    await expect(page.getByRole("heading", { name: "Inquiry Submitted!" })).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".reference")).toContainText(/CAT-/);
  });

  test("checkout path remains available", async ({ page }) => {
    const checkoutResponse = await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    expect(checkoutResponse?.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/checkout/);
  });
});
