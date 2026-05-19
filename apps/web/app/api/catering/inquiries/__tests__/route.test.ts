/** @jest-environment node */

import { NextRequest } from "next/server";
import { POST } from "../route";

describe("POST /api/catering/inquiries", () => {
  it("returns 201 with inquiry id for a valid payload", async () => {
    const request = new NextRequest("http://localhost/api/catering/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventDate: "2026-12-31",
        eventType: "birthday",
        eventAddress: "123 Main St",
        partySize: 40,
        packageName: "smokehouse-feast",
        contactName: "Pat Grill",
        contactEmail: "pat@example.com",
        contactPhone: "5551234567",
        notes: "Need setup by 4pm",
        estimatedSubtotalCents: 50000,
        estimatedDepositCents: 10000,
        estimatedBalanceCents: 40000,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.inquiryId).toMatch(/^inq_\d+_[a-z0-9]+$/);
    expect(payload.message).toContain("Catering inquiry submitted");
  });

  it("returns 400 with validation details for invalid payload", async () => {
    const request = new NextRequest("http://localhost/api/catering/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventDate: "",
        eventType: "",
        partySize: 0,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid inquiry payload");
    expect(payload.details).toBeDefined();
  });

  it("returns 400 with parse error message for malformed JSON", async () => {
    const request = new NextRequest("http://localhost/api/catering/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(typeof payload.error).toBe("string");
  });

  it("returns fallback message when a non-Error is thrown", async () => {
    const request = {
      json: jest.fn().mockRejectedValue("boom"),
    } as unknown as Request;

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Unable to submit inquiry.");
  });

  it("returns thrown Error message from catch handler", async () => {
    const request = {
      json: jest.fn().mockRejectedValue(new Error("explode")),
    } as unknown as Request;

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("explode");
  });
});
