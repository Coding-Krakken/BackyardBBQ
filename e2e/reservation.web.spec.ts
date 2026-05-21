import { expect, test } from "@playwright/test";

test.describe("Reservation flow", () => {
  test.skip(
    process.env.NEXT_PUBLIC_ENABLE_DINE_IN !== "true",
    "Dine-in feature disabled"
  );

  test("submits a reservation and shows confirmation", async ({ page }) => {
    await page.goto("/reserve", { waitUntil: "domcontentloaded" });
    const form = page.locator("form.reserve-form");

    await form.getByLabel("Full name").fill("Alex Pitmaster");
    await form.getByLabel("Email").fill("alex@example.com");
    await form.getByLabel("Phone").fill("+1 555-000-1234");
    await form.getByLabel("Date", { exact: true }).fill("2026-06-20");
    await form.getByLabel("Time").selectOption({ label: "6:30 PM (Limited)" });
    await form.getByLabel("Party size").fill("4");
    const submit = async () => {
      await Promise.all([
        page.waitForRequest(
          (request) => request.url().includes("/api/reservations") && request.method() === "POST"
        ),
        form.getByRole("button", { name: "Submit Reservation" }).click()
      ]);
    };

    await submit();

    const confirmationHeading = page.getByRole("heading", { name: "You Are On The Book" });
    const transientError = form.getByText("Failed to fetch", { exact: true });

    if (await transientError.isVisible()) {
      await submit();
    }

    await expect(confirmationHeading).toBeVisible({ timeout: 15000 });
  });
});
