import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const enableMutations = process.env.E2E_ADMIN_ENABLE_MUTATIONS === "true";
const deadLetterRowToken = process.env.E2E_ADMIN_DEAD_LETTER_ROW_TOKEN;

type ApiResponseBody =
  | { kind: "json"; json: unknown }
  | { kind: "text"; text: string };

async function readApiResponseBody(response: { headers(): Record<string, string>; json(): Promise<unknown>; text(): Promise<string> }): Promise<ApiResponseBody> {
  const contentType = response.headers()["content-type"] ?? "";
  if (contentType.includes("application/json")) {
    return { kind: "json", json: await response.json() };
  }

  return { kind: "text", text: await response.text() };
}

function expectArrayDataContract(body: unknown) {
  expect(typeof body).toBe("object");
  expect(body).not.toBeNull();
  const value = body as { data?: unknown; message?: unknown };
  if (value.message !== undefined) {
    expect(typeof value.message).toBe("string");
    return;
  }

  expect(Array.isArray(value.data)).toBe(true);
}

async function signInToAdminIntegrations(page: Parameters<typeof test>[0]["page"]) {
  await page.goto("/dashboard/integrations", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/auth\/login/);

  await page.getByRole("textbox", { name: "Email" }).fill(adminEmail ?? "");
  await page.getByRole("textbox", { name: "Password" }).fill(adminPassword ?? "");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL(/\/dashboard\/integrations/);
  await expect(page.getByRole("heading", { name: "Integrations" })).toBeVisible();
}

test.describe("Admin integrations API contracts", () => {
  test("dead-letter queue API returns expected auth/shape contract", async ({ request }) => {
    const response = await request.get("/api/admin/integrations/dead-letter?limit=5");
    expect([200, 401, 403]).toContain(response.status());

    const body = await readApiResponseBody(response);
    if (body.kind === "json") {
      expectArrayDataContract(body.json);
    } else {
      expect(body.text).toContain("<!DOCTYPE");
    }
  });

  test("settlements API returns expected auth/shape contract", async ({ request }) => {
    const response = await request.get("/api/admin/integrations/settlements?limit=5");
    expect([200, 401, 403]).toContain(response.status());

    const body = await readApiResponseBody(response);
    if (body.kind === "json") {
      expect(typeof body.json).toBe("object");
      expect(body.json).not.toBeNull();
      const value = body.json as { data?: unknown; summary?: unknown; message?: unknown };
      if (value.message !== undefined) {
        expect(typeof value.message).toBe("string");
      } else {
        expect(Array.isArray(value.data)).toBe(true);
        expect(typeof value.summary).toBe("object");
      }
    } else {
      expect(body.text).toContain("<!DOCTYPE");
    }
  });

  test("settlement trend API returns expected auth/shape contract", async ({ request }) => {
    const response = await request.get("/api/admin/integrations/settlements/trend?days=14");
    expect([200, 401, 403]).toContain(response.status());

    const body = await readApiResponseBody(response);
    if (body.kind === "json") {
      expect(typeof body.json).toBe("object");
      expect(body.json).not.toBeNull();
      const value = body.json as { data?: unknown; windowDays?: unknown; message?: unknown };
      if (value.message !== undefined) {
        expect(typeof value.message).toBe("string");
      } else {
        expect(Array.isArray(value.data)).toBe(true);
        expect(typeof value.windowDays).toBe("number");
      }
    } else {
      expect(body.text).toContain("<!DOCTYPE");
    }
  });

  test("settlement CSV export responds with csv or auth redirect", async ({ request }) => {
    const response = await request.get("/api/admin/integrations/settlements/export");
    expect([200, 401, 403]).toContain(response.status());

    const contentType = response.headers()["content-type"] ?? "";
    if (response.status() === 200) {
      expect(contentType.includes("text/csv") || contentType.includes("text/html")).toBe(true);
    }
  });
});

test.describe("@auth @admin Integrations operational workflows", () => {
  test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated integrations tests.");

  test("loads dead-letter and settlement reconciliation sections", async ({ page }) => {
    await signInToAdminIntegrations(page);

    await expect(page.getByText("Dead Letter Queue", { exact: true })).toBeVisible();
    await expect(page.getByText("Recent Settlement Events", { exact: true })).toBeVisible();
    await expect(page.getByText(/Settlement Trend/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Export Settlements CSV" })).toBeVisible();
  });

  test("retries a seeded dead-letter event and shows success toast", async ({ page }) => {
    test.skip(!enableMutations || !deadLetterRowToken, "Set E2E_ADMIN_ENABLE_MUTATIONS=true and E2E_ADMIN_DEAD_LETTER_ROW_TOKEN to validate dead-letter retry.");

    await signInToAdminIntegrations(page);

    const row = page.locator("tr", { hasText: deadLetterRowToken ?? "" }).first();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Retry" }).click();

    await expect(page.getByText("Message retried", { exact: true })).toBeVisible();
  });
});
