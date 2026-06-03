/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

// Mock @bbq/database
jest.mock("@bbq/database", () => ({
  prisma: {
    cateringInquiry: {
      create: jest.fn().mockResolvedValue({
        id: "test-id",
        referenceNumber: "CAT-20261231-ABCD",
        status: "pending",
      }),
    },
  },
}));

// Mock email functions (path relative from the route file's location)
jest.mock("../../../../../lib/email", () => ({
  sendCateringInquiryNotification: jest.fn().mockResolvedValue(undefined),
  sendCateringConfirmation: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from "../route";

describe("POST /api/catering/inquiries", () => {
  it("returns 201 with reference number for a valid payload", async () => {
    const request = new NextRequest("http://localhost/api/catering/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventDate: "2026-12-31",
        partySize: 40,
        eventLocation: "123 Main St, Austin TX",
        foodPreferences: "Brisket, pulled pork, and all the classic sides for 40 guests.",
        contactName: "Pat Grill",
        contactEmail: "pat@example.com",
        contactPhone: "5551234567",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { referenceNumber?: string; message?: string };

    expect(response.status).toBe(201);
    expect(payload.referenceNumber).toMatch(/^CAT-/);
    expect(payload.message).toContain("Catering inquiry submitted");
  });

  it("returns 400 with validation details for invalid payload", async () => {
    const request = new NextRequest("http://localhost/api/catering/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventDate: "",
        partySize: 0,
        eventLocation: "",
        foodPreferences: "",
        contactName: "",
        contactEmail: "invalid",
        contactPhone: "",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error?: string; details?: unknown };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid inquiry payload");
    expect(payload.details).toBeDefined();
  });

  it("returns 500 with error message for malformed JSON", async () => {
    const request = new NextRequest("http://localhost/api/catering/inquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(typeof payload.error).toBe("string");
  });

  it("returns fallback message when a non-Error is thrown", async () => {
    const request = {
      json: jest.fn().mockRejectedValue("boom"),
    } as unknown as Request;

    const response = await POST(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(payload.error).toBe("Unable to submit inquiry.");
  });

  it("returns thrown Error message from catch handler", async () => {
    const request = {
      json: jest.fn().mockRejectedValue(new Error("explode")),
    } as unknown as Request;

    const response = await POST(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(payload.error).toBe("explode");
  });
});
