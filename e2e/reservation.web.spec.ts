import { expect, test } from "@playwright/test";

test.describe("Reservation flow", () => {
  test("submits a reservation and shows confirmation", async ({ page }) => {
    await page.goto("/reserve", { waitUntil: "domcontentloaded" });
    const form = page.locator("form.reserve-form");

    await form.getByLabel("Full name").fill("Alex Pitmaster");
    await form.getByLabel("Email").fill("alex@example.com");
    await form.getByLabel("Phone").fill("+1 555-000-1234");
    await form.getByLabel("Date", { exact: true }).fill("2026-06-20");
    await form.getByLabel("Time").selectOption({ label: "6:30 PM (Limited)" });
    await form.getByLabel("Party size").fill("4");
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/reservations") && response.request().method() === "POST"),
      form.getByRole("button", { name: "Submit Reservation" }).click()
    ]);

    await expect(page.getByRole("heading", { name: "You Are On The Book" })).toBeVisible({ timeout: 15000 });
  });
});
