import { expect, test } from "@playwright/test";

test.describe("@payments Concurrent checkout sessions", () => {
  test("loads checkout in parallel browser tabs without shell regressions", async ({ context }) => {
    const [firstPage, secondPage] = await Promise.all([context.newPage(), context.newPage()]);

    const [firstResponse, secondResponse] = await Promise.all([
      firstPage.goto("/checkout", { waitUntil: "domcontentloaded" }),
      secondPage.goto("/checkout", { waitUntil: "domcontentloaded" })
    ]);

    expect(firstResponse?.ok()).toBeTruthy();
    expect(secondResponse?.ok()).toBeTruthy();

    await expect(firstPage.locator("body")).toContainText("Checkout");
    await expect(secondPage.locator("body")).toContainText("Checkout");

    await Promise.all([firstPage.close(), secondPage.close()]);
  });

  test("handles parallel invalid checkout-session submissions deterministically", async ({ request }) => {
    const invalidPayload = {
      amountCents: 10,
      currency: "usd",
      metadata: {
        orderId: "concurrency-check"
      }
    };

    const [firstResponse, secondResponse] = await Promise.all([
      request.post("/api/payments/create-checkout-session", { data: invalidPayload }),
      request.post("/api/payments/create-checkout-session", { data: invalidPayload })
    ]);

    expect(firstResponse.status()).toBeGreaterThanOrEqual(400);
    expect(firstResponse.status()).toBeLessThan(500);
    expect(secondResponse.status()).toBeGreaterThanOrEqual(400);
    expect(secondResponse.status()).toBeLessThan(500);

    const firstBody = await firstResponse.json();
    const secondBody = await secondResponse.json();

    expect(typeof (firstBody as { error?: unknown }).error).toBe("string");
    expect(typeof (secondBody as { error?: unknown }).error).toBe("string");
  });
});
