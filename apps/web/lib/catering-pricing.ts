export type CateringPricingInput = {
  partySize: number;
  packageName?: string;
};

export type CateringPricingResult = {
  estimatedTotalCents: number;
  depositCents: number;
  finalPaymentCents: number;
  perGuestCents: number;
  depositRate: number;
};

const DEPOSIT_RATE = 0.3;

function getPerGuestCents(partySize: number, packageName?: string) {
  const packageFactor = packageName?.toLowerCase().includes("premium") ? 1.2 : 1;

  let basePerGuestCents = 2500;
  if (partySize >= 150) {
    basePerGuestCents = 2100;
  } else if (partySize >= 100) {
    basePerGuestCents = 2200;
  } else if (partySize >= 50) {
    basePerGuestCents = 2350;
  }

  return Math.round(basePerGuestCents * packageFactor);
}

export function calculateCateringPricing(input: CateringPricingInput): CateringPricingResult {
  const partySize = Math.max(1, Math.floor(input.partySize));
  const perGuestCents = getPerGuestCents(partySize, input.packageName);
  const estimatedTotalCents = perGuestCents * partySize;
  const depositCents = Math.round(estimatedTotalCents * DEPOSIT_RATE);
  const finalPaymentCents = estimatedTotalCents - depositCents;

  return {
    estimatedTotalCents,
    depositCents,
    finalPaymentCents,
    perGuestCents,
    depositRate: DEPOSIT_RATE,
  };
}
