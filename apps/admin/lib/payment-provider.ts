export const SUPPORTED_PAYMENT_PROVIDERS = ["epos"] as const;

export type PaymentProvider = (typeof SUPPORTED_PAYMENT_PROVIDERS)[number];

export function getPaymentProvider(): PaymentProvider {
  return "epos";
}

export function unsupportedProviderMessage(endpoint: string): string {
  return `${endpoint} is not supported in EPOS mode.`;
}
