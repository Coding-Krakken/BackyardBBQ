import type { PaymentProvider } from "../lib/payment-provider";

export function getCheckoutIntroText(_provider: PaymentProvider) {
  return "Complete your order details to place your order through our integrated EPOS payment flow.";
}

export function getCheckoutPrimaryActionLabel() {
  return "Continue to Payment";
}

export function getCheckoutPendingLabel() {
  return "Preparing payment...";
}