/**
 * Payment Status Constants
 * 
 * Standardized status definitions for consistent financial metrics across the application.
 * These should be used by all API routes that calculate revenue, refunds, or payment analytics.
 */

/**
 * Payment statuses that indicate a successful, collected payment.
 * Use for calculating gross revenue and successful transaction counts.
 */
export const PAYMENT_SUCCESS_STATUSES = ["succeeded"] as const;

/**
 * Payment statuses that indicate a refund has occurred.
 * Use for calculating refund amounts and rates.
 */
export const PAYMENT_REFUND_STATUSES = ["refunded", "partially_refunded"] as const;

/**
 * Payment statuses that indicate revenue was collected (even if partially refunded).
 * Use for comprehensive revenue calculations that need to account for partial refunds.
 */
export const PAYMENT_REVENUE_STATUSES = ["succeeded", "partially_refunded"] as const;

/**
 * Payment statuses that indicate the payment failed or was cancelled.
 * These should be excluded from revenue calculations.
 */
export const PAYMENT_FAILED_STATUSES = ["failed", "canceled"] as const;

/**
 * Delivery channels that process payments through third-party platforms.
 * Orders from these channels should NOT have PaymentTransaction records.
 */
export const THIRD_PARTY_DELIVERY_CHANNELS = ["doordash", "ubereats", "grubhub"] as const;

/**
 * Order sources that process payments through EPOS Now.
 * Orders from these sources SHOULD have corresponding PaymentTransaction records.
 */
export const EPOS_PAYMENT_SOURCES = ["direct", "catering"] as const;

/** @deprecated Use EPOS_PAYMENT_SOURCES instead */
export const STRIPE_PAYMENT_SOURCES = EPOS_PAYMENT_SOURCES;

// Type exports for TypeScript consumers
export type PaymentSuccessStatus = (typeof PAYMENT_SUCCESS_STATUSES)[number];
export type PaymentRefundStatus = (typeof PAYMENT_REFUND_STATUSES)[number];
export type PaymentRevenueStatus = (typeof PAYMENT_REVENUE_STATUSES)[number];
export type PaymentFailedStatus = (typeof PAYMENT_FAILED_STATUSES)[number];
export type ThirdPartyDeliveryChannel = (typeof THIRD_PARTY_DELIVERY_CHANNELS)[number];
export type EposPaymentSource = (typeof EPOS_PAYMENT_SOURCES)[number];
/** @deprecated Use EposPaymentSource instead */
export type StripePaymentSource = EposPaymentSource;
