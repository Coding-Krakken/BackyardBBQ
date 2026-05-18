import { normalizeReservationForm, reservationSchema } from "../validation";

describe("reservation validation", () => {
  it("accepts a valid reservation payload", () => {
    const payload = {
      name: "Jane Smoke",
      email: "jane@example.com",
      phone: "+1 555-101-2020",
      date: "2026-06-01",
      time: "6:30 PM",
      partySize: 4,
      occasion: "Birthday",
      specialRequests: "Window table"
    };

    const parsed = reservationSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid payloads", () => {
    const parsed = reservationSchema.safeParse({
      name: "",
      email: "bad",
      phone: "123",
      date: "",
      time: "",
      partySize: 0
    });

    expect(parsed.success).toBe(false);
  });

  it("normalizes numeric party size from string", () => {
    const normalized = normalizeReservationForm({
      name: "Jane Smoke",
      email: "jane@example.com",
      phone: "+1 555-101-2020",
      date: "2026-06-01",
      time: "6:30 PM",
      partySize: "5"
    });

    expect(normalized.partySize).toBe(5);
  });
});
