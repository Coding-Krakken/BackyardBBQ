import { calculateSubtotalCents, calculateTaxCents, calculateTotalCents } from "../cart-calculations";

describe("cart calculations", () => {
  it("calculates subtotal including customizations and quantity", () => {
    const subtotal = calculateSubtotalCents([
      {
        unitPriceCents: 1200,
        quantity: 2,
        customizations: [{ priceCents: 150 }]
      },
      {
        unitPriceCents: 800,
        quantity: 1,
        customizations: []
      }
    ]);

    expect(subtotal).toBe(3500);
  });

  it("calculates tax and total", () => {
    const tax = calculateTaxCents(2500, 0.08);
    const total = calculateTotalCents(2500, tax, 500);

    expect(tax).toBe(200);
    expect(total).toBe(3200);
  });
});
