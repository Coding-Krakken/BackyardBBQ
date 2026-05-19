# Data Model and Schema

## Design Rules

1. All money is stored as integer cents.
2. External provider data is captured as JSON metadata but normalized where it drives workflows.
3. Order and payment linkages are explicit and auditable.

## Core Models

| Model | Purpose |
|---|---|
| `Customer` | Accounts, auth, role, Stripe customer mapping |
| `Order` | Core commerce record for direct and external channel orders |
| `OrderItem` | Line-item snapshot for each order |
| `PaymentTransaction` | Stripe intent-level transaction record |
| `CateringBooking` | Catering inquiry and booking state |
| `SavedPaymentMethod` | Stored card metadata for customers |
| `IntegrationEvent` | Auditable integration event history |

## Delivery and Settlement Models

| Model | Purpose |
|---|---|
| `DeliveryChannelCredential` | Per-location provider credentials |
| `DeliveryChannelStore` | Provider store identity mapping |
| `DeliverySettlementBatch` | Provider payout batch |
| `DeliverySettlementLine` | Per-order settlement economics |

## Enumerations

- `OrderSource`: direct, doordash, ubereats, grubhub, catering
- `OrderStatus`: pending, confirmed, preparing, ready, completed, cancelled
- `PaymentStatus`: requires_payment_method .. refunded
- `BookingStatus`: draft, pending_approval, approved, declined, cancelled

## Relationship Highlights

- `Order.customerId` is optional for guest and external-provider scenarios.
- `PaymentTransaction.orderId` is unique to enforce one primary transaction row per order.
- Settlement lines can link to orders when correlation is available.

## Schema Location

- [packages/database/prisma/schema.prisma](../packages/database/prisma/schema.prisma)

## Prisma Lifecycle

1. Generate client after schema changes.
2. Validate app type-check after generation.
3. Run integrity checks before deployment.

Commands:

```bash
npx prisma generate --schema=packages/database/prisma/schema.prisma
npm run data:integrity:check
npm run data:integrity:validate
```

## Related Pages

- [02-Payments-and-Stripe](02-Payments-and-Stripe.md)
- [07-Delivery-Integrations](07-Delivery-Integrations.md)
- [10-Operations-Runbooks-and-Incident-Response](10-Operations-Runbooks-and-Incident-Response.md)
