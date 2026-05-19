# API Reference

## Scope

This page indexes active API surfaces across web, admin, and API service runtime.

## Customer Web API (`apps/web/app/api`)

### Payments

| Route | Methods | Purpose |
|---|---|---|
| `/api/payments/create-checkout-session` | POST | Start checkout session with server validation |
| `/api/payments/verify-session` | GET | Verify session and payment intent status |
| `/api/payments/calculate-tax` | POST | Compute tax for cart payload |
| `/api/payments/create-catering-deposit-session` | POST | Start catering deposit checkout |

### Customer Account and Commerce

| Route Group | Methods |
|---|---|
| `/api/customer/profile` | GET, PATCH |
| `/api/customer/orders` | GET |
| `/api/customer/payment-methods` | GET |
| `/api/customer/payment-methods/[id]` | DELETE |
| `/api/customer/payment-methods/[id]/set-default` | PATCH |
| `/api/customer/portal-session` | POST |
| `/api/customer/addresses` | GET, POST, PATCH, DELETE |
| `/api/customer/notifications` | GET, PATCH, DELETE |
| `/api/customer/referrals` | GET, POST |
| `/api/customer/referrals/code` | GET |
| `/api/customer/bookings` | GET |
| `/api/customer/bookings/[id]` | GET |
| `/api/customer/reorder` | POST |

### Analytics and Misc

| Route | Methods |
|---|---|
| `/api/customer/analytics/spending` | GET |
| `/api/customer/analytics/frequency` | GET |
| `/api/customer/analytics/categories` | GET |
| `/api/auth/signup` | POST |
| `/api/catering/inquiries` | POST |
| `/api/catering/bookings` | POST |
| `/api/support/ticket` | POST |
| `/api/reservations` | POST |
| `/api/revalidate-menu` | POST |

## Admin API (`apps/admin/app/api/admin`)

### Core Domain Routes

| Domain | Route Examples |
|---|---|
| Orders | `/orders`, `/orders/[id]/status`, `/orders/[id]/dispatch`, `/orders/[id]/delivery-action` |
| Payments | `/payments`, `/payments/refunds`, `/payments/[transactionId]/refund`, `/payments/disputes`, `/payments/disputes/[id]`, `/payments/disputes/[id]/review`, `/payments/disputes/[id]/evidence`, `/payments/analytics`, `/payments/ops-metrics` |
| Customers | `/customers`, `/customers/[id]`, `/customers/[id]/payments` |
| Menu | `/menu/items`, `/menu/items/[id]`, `/menu/locations`, `/menu/locations/[id]` |
| Integrations | `/integrations/health`, `/integrations/contracts`, `/integrations/contracts/export`, `/integrations/settlements`, `/integrations/settlements/export`, `/integrations/settlements/trend`, `/integrations/dead-letter`, `/integrations/dead-letter/[id]/retry`, `/integrations/correlation/[id]`, `/integrations/correlation/[id]/contract`, `/integrations/correlation/[id]/export`, `/integrations/correlation/[id]/package`, `/integrations/alerts` |
| Accounting | `/accounting`, `/accounting/finalize`, `/accounting/daily-close`, `/accounting/daily-close/finalize`, `/accounting/daily-close/export` |
| Onboarding | `/onboarding`, `/onboarding/complete`, `/onboarding/skip`, `/onboarding/reset` |
| Analytics | `/analytics/anomalies`, `/analytics/forecast`, `/analytics/forecast/export`, `/analytics/sales`, `/analytics/sales/export` |
| Other | `/overview`, `/notifications`, `/health/data-integrity`, `/catering/bookings`, `/catering/bookings/[id]/status`, `/referrals`, `/referrals/[id]` |

## API Service (`apps/api`)

Important runtime endpoints include:

| Endpoint | Purpose |
|---|---|
| `/health` | Liveness |
| `/api/payments/health` | Payments health |
| `/api/health/stripe` | Stripe connectivity |
| `/api/health/webhook` | Latest webhook status |
| `/api/health/delivery/:channel` | Per-channel integration health |
| `/api/metrics/payments` | Payment KPI export |

## Authentication and Authorization Model

1. Customer routes rely on user session context.
2. Admin routes are protected with `requireAdmin` role checks.
3. Role policies are enforced and validated via admin guard scripts.

References:

- [04-Authentication-and-RBAC](04-Authentication-and-RBAC.md)
- [16-Role-Permission-Matrix](16-Role-Permission-Matrix.md)

## Change Management Rule

When adding routes:

1. Update role policy files for admin endpoints.
2. Add route tests for auth, validation, and error paths.
3. Update this reference page in the same change set.
