type AnalyticsProps = Record<string, unknown>;

type WindowWithAnalytics = Window & {
  gtag?: (command: string, eventName: string, params?: AnalyticsProps) => void;
  dataLayer?: unknown[];
};

export const AnalyticsEvents = {
  ctaClickedOrderOnline: "cta_clicked_order_online",
  ctaClickedBookCatering: "cta_clicked_book_catering",
  ctaClickedReserveTable: "cta_clicked_reserve_table",
  menuItemViewed: "menu_item_viewed",
  menuItemAddedToCart: "menu_item_added_to_cart",
  cartOpened: "cart_opened",
  checkoutStarted: "checkout_started",
  checkoutSubmitted: "checkout_submitted",
  orderConfirmed: "order_confirmed",
  cateringQuoteStarted: "catering_quote_started",
  cateringQuoteSubmitted: "catering_quote_submitted",
  reservationSubmitted: "reservation_submitted",
  signupStarted: "signup_started",
  loginSubmitted: "login_submitted"
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents] | string;

function hasConfiguredAnalytics() {
  return Boolean(process.env.NEXT_PUBLIC_GA_ID || process.env.NEXT_PUBLIC_GTM_ID);
}

export function trackEvent(name: AnalyticsEventName, properties: AnalyticsProps = {}) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const runtimeWindow = window as WindowWithAnalytics;

    if (runtimeWindow.gtag) {
      runtimeWindow.gtag("event", name, properties);
      return;
    }

    if (hasConfiguredAnalytics() && Array.isArray(runtimeWindow.dataLayer)) {
      runtimeWindow.dataLayer.push({ event: name, ...properties });
    }
  } catch {
    // Intentionally swallow analytics errors so conversion flows never break.
  }
}
