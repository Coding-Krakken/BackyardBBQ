import { TAX_RATE } from "../config/constants";

export interface CalculationItem {
  unitPriceCents: number;
  quantity: number;
  customizations: Array<{ priceCents: number }>;
}

export function calculateSubtotalCents(items: CalculationItem[]) {
  return items.reduce((sum, item) => {
    const customizationTotal = item.customizations.reduce((cSum, customization) => cSum + customization.priceCents, 0);
    return sum + (item.unitPriceCents + customizationTotal) * item.quantity;
  }, 0);
}

export function calculateTaxCents(subtotalCents: number, taxRate = TAX_RATE) {
  return Math.round(subtotalCents * taxRate);
}

export function calculateTotalCents(subtotalCents: number, taxCents: number, tipCents = 0) {
  return subtotalCents + taxCents + tipCents;
}
