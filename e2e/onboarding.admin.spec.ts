import { expect, test } from "@playwright/test";

async function readApiResponseBody(response: { headers(): Record<string, string>; json(): Promise<unknown>; text(): Promise<string> }) {
  const contentType = response.headers()["content-type"] ?? "";
  if (contentType.includes("application/json")) {
    const json = await response.json();
    return { kind: "json" as const, json };
  }

  const text = await response.text();
  return { kind: "text" as const, text };
}

function expectOnboardingReadContract(body: unknown) {
  expect(typeof body).toBe("object");
  expect(body).not.toBeNull();
  const candidate = body as {
    error?: unknown;
    progress?: unknown;
    featureConfig?: { version?: unknown; features?: unknown };
  };

  if (candidate.error !== undefined) {
    expect(typeof candidate.error).toBe("string");
    return;
  }

  expect(candidate).toHaveProperty("featureConfig");
  expect(typeof candidate.featureConfig?.version).toBe("number");
  expect(typeof candidate.featureConfig?.features).toBe("object");
}

function expectOnboardingWriteContract(body: unknown) {
  expect(typeof body).toBe("object");
  expect(body).not.toBeNull();
  const candidate = body as {
    error?: unknown;
    progress?: {
      completedSteps?: unknown;
      tourVersion?: unknown;
    };
  };

  if (candidate.error !== undefined) {
    expect(typeof candidate.error).toBe("string");
    return;
  }

  expect(candidate).toHaveProperty("progress");
  expect(Array.isArray(candidate.progress?.completedSteps)).toBe(true);
  expect(typeof candidate.progress?.tourVersion).toBe("number");
}

/**
 * Onboarding suite – smoke tests for the admin onboarding experience.
 * Authentication flows require ADMIN_AUTH_SECRET to be set in the environment.
 * The unauthenticated redirect tests run without any credentials.
 */

test.describe("Admin onboarding – API response contracts", () => {
  test("redirects /dashboard to login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("onboarding progress API returns expected contract", async ({
    request,
  }) => {
    const response = await request.get("/api/admin/onboarding");
    expect([200, 401, 403]).toContain(response.status());
    const body = await readApiResponseBody(response);
    if (body.kind === "json") {
      expectOnboardingReadContract(body.json);
    } else {
      expect(body.text).toContain("<!DOCTYPE");
    }
  });

  test("onboarding skip API returns expected contract", async ({
    request,
  }) => {
    const response = await request.post("/api/admin/onboarding/skip");
    expect([200, 401, 403]).toContain(response.status());
    const body = await readApiResponseBody(response);
    if (body.kind === "json") {
      expectOnboardingWriteContract(body.json);
    } else {
      expect(body.text).toContain("<!DOCTYPE");
    }
  });

  test("onboarding complete API returns expected contract", async ({
    request,
  }) => {
    const response = await request.post("/api/admin/onboarding/complete");
    expect([200, 401, 403]).toContain(response.status());
    const body = await readApiResponseBody(response);
    if (body.kind === "json") {
      expectOnboardingWriteContract(body.json);
    } else {
      expect(body.text).toContain("<!DOCTYPE");
    }
  });

  test("onboarding reset API returns expected contract", async ({
    request,
  }) => {
    const response = await request.post("/api/admin/onboarding/reset");
    expect([200, 401, 403]).toContain(response.status());
    const body = await readApiResponseBody(response);
    if (body.kind === "json") {
      expectOnboardingWriteContract(body.json);
    } else {
      expect(body.text).toContain("<!DOCTYPE");
    }
  });
});

test.describe("Admin onboarding – login page elements", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });

  test("invalid credentials show error message", async ({ page }) => {
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.getByRole("textbox", { name: "Email" }).fill("bad@example.com");
    await page.getByRole("textbox", { name: "Password" }).fill("wrongpass");
    await page.getByRole("button", { name: "Sign In" }).click();
    // Should stay on login page or show error – not redirect to dashboard
    await expect(page).not.toHaveURL(/\/dashboard/);
  });
});

test.describe("Admin onboarding – feature-status config endpoint", () => {
  test("onboarding API returns structured JSON", async ({
    request,
  }) => {
    const response = await request.get("/api/admin/onboarding");
    expect([200, 401, 403]).toContain(response.status());
    const body = await readApiResponseBody(response);
    if (body.kind === "json") {
      expectOnboardingReadContract(body.json);
    } else {
      expect(body.text).toContain("<!DOCTYPE");
    }
  });
});

test.describe("Admin onboarding – authenticated flow", () => {
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;

  test.skip(
    !adminEmail || !adminPassword,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated onboarding tests"
  );

  test("owner/admin sees welcome modal and can complete first onboarding interaction", async ({
    page,
  }) => {
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.getByRole("textbox", { name: "Email" }).fill(adminEmail!);
    await page.getByRole("textbox", { name: "Password" }).fill(adminPassword!);
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    const startButton = page.getByRole("button", {
      name: /start tour|continue tour|see what's new/i,
    });
    await expect(startButton).toBeVisible();
    await startButton.click();

    const popover = page.locator(".driver-popover");
    await expect(popover).toBeVisible();

    const nextButton = popover.getByRole("button", { name: /next/i });
    await expect(nextButton).toBeVisible();
  });
});
