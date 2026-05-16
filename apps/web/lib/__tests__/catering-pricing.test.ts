import { calculateCateringPricing } from "../catering-pricing";

describe("calculateCateringPricing", () => {
  it("uses base tier for small party sizes", () => {
    const result = calculateCateringPricing({ partySize: 20 });

    expect(result.perGuestCents).toBe(2500);
    expect(result.estimatedTotalCents).toBe(50000);
    expect(result.depositCents).toBe(15000);
    expect(result.finalPaymentCents).toBe(35000);
    expect(result.depositRate).toBe(0.3);
  });

  it("applies tiered pricing for larger parties", () => {
    const result = calculateCateringPricing({ partySize: 120 });

    expect(result.perGuestCents).toBe(2200);
    expect(result.estimatedTotalCents).toBe(264000);
    expect(result.depositCents + result.finalPaymentCents).toBe(result.estimatedTotalCents);
  });

  it("applies premium package multiplier", () => {
    const result = calculateCateringPricing({
      partySize: 60,
      packageName: "Premium Smokehouse",
    });

    expect(result.perGuestCents).toBe(2820);
    expect(result.estimatedTotalCents).toBe(169200);
  });

  it("normalizes non-integer and low party sizes", () => {
    const result = calculateCateringPricing({ partySize: 0.4 });

    expect(result.perGuestCents).toBe(2500);
    expect(result.estimatedTotalCents).toBe(2500);
    expect(result.depositCents).toBe(750);
    expect(result.finalPaymentCents).toBe(1750);
  });
});
