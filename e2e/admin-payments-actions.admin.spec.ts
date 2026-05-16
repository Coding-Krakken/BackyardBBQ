import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const refundRowToken = process.env.E2E_ADMIN_REFUND_ROW_TOKEN;
const disputeRowToken = process.env.E2E_ADMIN_DISPUTE_ROW_TOKEN;
const enableMutations = process.env.E2E_ADMIN_ENABLE_MUTATIONS === "true";
const mutationDisputeRowToken = process.env.E2E_ADMIN_MUTATION_DISPUTE_ROW_TOKEN;
const evidenceSummary = process.env.E2E_ADMIN_EVIDENCE_SUMMARY ?? "Seeded evidence submission from automated test run.";

async function signInToAdminPayments(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("/dashboard/payments", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/auth\/login/);
  await page.getByRole("textbox", { name: "Email" }).fill(adminEmail ?? "");
  await page.getByRole("textbox", { name: "Password" }).fill(adminPassword ?? "");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL(/\/dashboard(\/payments)?/);
  await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
}

test.describe("@auth Admin payments deterministic actions", () => {
  test.skip(
    !adminEmail || !adminPassword || !refundRowToken || !disputeRowToken,
    "Set E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_ADMIN_REFUND_ROW_TOKEN, and E2E_ADMIN_DISPUTE_ROW_TOKEN to run deterministic admin action tests."
  );

  test("opens refund and dispute evidence dialogs and cancels safely", async ({ page }) => {
    await signInToAdminPayments(page);

    const refundRow = page.locator("tr", { hasText: refundRowToken ?? "" }).first();
    await expect(refundRow).toBeVisible();
    await refundRow.getByRole("button", { name: "Refund" }).click();

    await expect(page.getByRole("heading", { name: "Issue Refund" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Issue Refund" })).not.toBeVisible();

    await page.getByRole("button", { name: "Disputes" }).click();
    await expect(page.getByText("Status:", { exact: true })).toBeVisible();

    const disputeRow = page.locator("tr", { hasText: disputeRowToken ?? "" }).first();
    await expect(disputeRow).toBeVisible();
    await disputeRow.getByRole("button", { name: "Submit Evidence" }).click();

    await expect(page.getByRole("heading", { name: "Submit Dispute Evidence" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Submit Dispute Evidence" })).not.toBeVisible();
  });

  test("opens dispute detail page from table and shows operational controls", async ({ page }) => {
    await signInToAdminPayments(page);

    await page.getByRole("button", { name: "Disputes" }).click();
    await expect(page.getByText("Status:", { exact: true })).toBeVisible();

    const disputeRow = page.locator("tr", { hasText: disputeRowToken ?? "" }).first();
    await expect(disputeRow).toBeVisible();

    await disputeRow.getByRole("link", { name: "View" }).click();

    await expect(page).toHaveURL(/\/dashboard\/payments\/disputes\//);
    await expect(page.getByRole("heading", { name: "Dispute Details" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Submit Evidence" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark Reviewed" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to Payments" })).toBeVisible();
  });

  test("submits dispute evidence and confirms success toast", async ({ page }) => {
    test.skip(
      !enableMutations || !mutationDisputeRowToken,
      "Set E2E_ADMIN_ENABLE_MUTATIONS=true and E2E_ADMIN_MUTATION_DISPUTE_ROW_TOKEN for seeded mutation assertions."
    );

    await signInToAdminPayments(page);

    await page.getByRole("button", { name: "Disputes" }).click();
    await expect(page.getByText("Status:", { exact: true })).toBeVisible();

    const disputeRow = page.locator("tr", { hasText: mutationDisputeRowToken ?? "" }).first();
    await expect(disputeRow).toBeVisible();
    await disputeRow.getByRole("button", { name: "Submit Evidence" }).click();

    await expect(page.getByRole("heading", { name: "Submit Dispute Evidence" })).toBeVisible();
    await page.getByLabel("Evidence Summary").fill(evidenceSummary);
    await page.getByRole("button", { name: "Submit Evidence" }).click();

    await expect(page.getByText("Dispute evidence submitted", { exact: true })).toBeVisible();

    const updatedDisputeRow = page.locator("tr", { hasText: mutationDisputeRowToken ?? "" }).first();
    await expect(updatedDisputeRow).toContainText(/under_review|warning_under_review|evidence_submitted/i);

    await updatedDisputeRow.getByRole("link", { name: "View" }).click();
    await expect(page).toHaveURL(/\/dashboard\/payments\/disputes\//);
    await expect(page.getByRole("heading", { name: "Dispute Details" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Evidence Timeline" })).toBeVisible();
    await expect(page.getByText("Last evidence submission:")).toBeVisible();
  });
});
