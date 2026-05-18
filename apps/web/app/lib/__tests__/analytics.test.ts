import { trackEvent } from "../analytics";

describe("analytics trackEvent", () => {
  it("does not throw when no analytics provider exists", () => {
    expect(() => trackEvent("test_event", { source: "unit_test" })).not.toThrow();
  });

  it("calls gtag when available", () => {
    const gtag = jest.fn();
    Object.defineProperty(window, "gtag", {
      configurable: true,
      writable: true,
      value: gtag
    });

    trackEvent("menu_item_added_to_cart", { itemId: "abc" });

    expect(gtag).toHaveBeenCalledWith("event", "menu_item_added_to_cart", { itemId: "abc" });
  });
});
