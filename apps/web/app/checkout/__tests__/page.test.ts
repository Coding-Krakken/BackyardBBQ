import { getCheckoutIntroText, getCheckoutPendingLabel, getCheckoutPrimaryActionLabel } from "../checkout-copy";

describe("getCheckoutIntroText", () => {
  it("returns EPOS checkout copy", () => {
    expect(getCheckoutIntroText("epos")).toBe(
      "Complete your order details to place your order through our integrated EPOS payment flow."
    );
  });
});

describe("checkout labels", () => {
  it("uses neutral checkout copy for the primary action", () => {
    expect(getCheckoutPrimaryActionLabel()).toBe("Continue to Payment");
  });

  it("uses neutral checkout copy while payment is pending", () => {
    expect(getCheckoutPendingLabel()).toBe("Preparing payment...");
  });
});