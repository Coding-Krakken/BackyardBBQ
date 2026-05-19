# Feature Guide: Menu, Checkout, Catering

## Menu System

Primary references:

- [MENU_SYSTEM_GUIDE.md](../MENU_SYSTEM_GUIDE.md)
- [MENU_IMAGE_REFINEMENT.md](../MENU_IMAGE_REFINEMENT.md)

### Menu Capability Map

| Capability | Notes |
|---|---|
| Category browsing | Multi-page category entrypoints |
| Availability controls | Item-level availability flags and sorting |
| Featured merchandising | Item-level featured signals |
| Image quality refinement | Consistent visual standards across pages |

## Checkout Experience

Customer checkout is powered by Stripe elements flow and server-side session creation.

Important safeguards:

1. Request validation and rate limiting.
2. Tax calculation endpoint and tax-drift checks.
3. Session verification endpoint for post-payment reconciliation.

## Catering Lifecycle

| Stage | Booking Status |
|---|---|
| Draft proposal | `draft` |
| Awaiting review | `pending_approval` |
| Confirmed | `approved` |
| Rejected | `declined` |
| Canceled | `cancelled` |

## State Design Principles

- Keep transitions auditable.
- Never mutate historical payment amounts without explicit correction records.
- Favor explicit status enums over inferred states.

## Related Pages

- [02-Payments-and-Stripe](02-Payments-and-Stripe.md)
- [06-Admin-Operations-Playbook](06-Admin-Operations-Playbook.md)
