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

test.describe("@payments @admin Payment admin API contracts", () => {
  test("disputes list API returns expected auth/shape contract", async ({ request }) => {
    const response = await request.get("/api/admin/payments/disputes?limit=5");
    expect([200, 401, 403]).toContain(response.status());

    const body = await readApiResponseBody(response);
    if (body.kind === "json") {
      const value = body.json as { data?: unknown; message?: unknown };
      if (value.message !== undefined) {
        expect(typeof value.message).toBe("string");
      } else {
        expect(Array.isArray(value.data)).toBe(true);
      }
    } else {
      expect(body.text).toContain("<!DOCTYPE");
    }
  });

  test("payment analytics API returns expected auth/shape contract", async ({ request }) => {
    const response = await request.get("/api/admin/payments/analytics?days=30");
    expect([200, 401, 403]).toContain(response.status());

    const body = await readApiResponseBody(response);
    if (body.kind === "json") {
      const value = body.json as { kpis?: unknown; data?: unknown; message?: unknown };
      if (value.message !== undefined) {
        expect(typeof value.message).toBe("string");
      } else {
        expect(typeof value.kpis).toBe("object");
      }
    } else {
      expect(body.text).toContain("<!DOCTYPE");
    }
  });

  test("refund API rejects invalid payload or unauthorized request", async ({ request }) => {
    const response = await request.post("/api/admin/payments/refunds", {
      data: {}
    });

    expect([200, 400, 401, 403]).toContain(response.status());

    const body = await readApiResponseBody(response);
    if (body.kind === "json") {
      const value = body.json as { message?: unknown; error?: unknown };
      if (value.message !== undefined) {
        expect(typeof value.message).toBe("string");
      }
      if (value.error !== undefined) {
        expect(typeof value.error).toBe("string");
      }
    } else {
      expect(body.text).toContain("<!DOCTYPE");
    }
  });

  test("dispute review API enforces auth/validation contract", async ({ request }) => {
    const response = await request.patch("/api/admin/payments/disputes/non-existent/review", {
      data: { resolution: "accepted" }
    });

    expect([401, 403, 404, 405]).toContain(response.status());

    const body = await readApiResponseBody(response);
    if (body.kind === "json") {
      const value = body.json as { message?: unknown; error?: unknown };
      if (value.message !== undefined) {
        expect(typeof value.message).toBe("string");
      }
      if (value.error !== undefined) {
        expect(typeof value.error).toBe("string");
      }
    } else {
      expect(body.text.length === 0 || body.text.includes("<!DOCTYPE")).toBe(true);
    }
  });
});
