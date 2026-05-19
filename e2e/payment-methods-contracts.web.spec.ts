import { expect, test } from "@playwright/test";

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

test.describe("@payments Customer payment-method contracts", () => {
  test("payment-method list endpoint returns auth/shape contract", async ({ request }) => {
    const response = await request.get("/api/customer/payment-methods");
    expect([200, 401]).toContain(response.status());

    const body = await readApiResponseBody(response);
    if (body.kind === "json") {
      const value = body.json as { paymentMethods?: unknown; error?: unknown };
      if (value.error !== undefined) {
        expect(typeof value.error).toBe("string");
      } else {
        expect(Array.isArray(value.paymentMethods)).toBe(true);
      }
    } else {
      expect(body.text).toContain("<!DOCTYPE");
    }
  });

  test("set-default endpoint enforces auth/validation contract", async ({ request }) => {
    const response = await request.post("/api/customer/payment-methods/pm_test_missing/set-default");
    expect([400, 401, 404, 405]).toContain(response.status());

    const body = await readApiResponseBody(response);
    if (body.kind === "json") {
      const value = body.json as { error?: unknown; message?: unknown };
      if (value.error !== undefined) {
        expect(typeof value.error).toBe("string");
      }
      if (value.message !== undefined) {
        expect(typeof value.message).toBe("string");
      }
    } else {
      expect(body.text.length === 0 || body.text.includes("<!DOCTYPE")).toBe(true);
    }
  });

  test("delete endpoint enforces auth/validation contract", async ({ request }) => {
    const response = await request.delete("/api/customer/payment-methods/pm_test_missing");
    expect([401, 404]).toContain(response.status());

    const body = await readApiResponseBody(response);
    if (body.kind === "json") {
      const value = body.json as { error?: unknown; message?: unknown };
      if (value.error !== undefined) {
        expect(typeof value.error).toBe("string");
      }
      if (value.message !== undefined) {
        expect(typeof value.message).toBe("string");
      }
    } else {
      expect(body.text.length === 0 || body.text.includes("<!DOCTYPE")).toBe(true);
    }
  });
});
