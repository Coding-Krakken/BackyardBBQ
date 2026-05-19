# Architecture Appendix

## Dependency Map

```text
apps/web
  -> @bbq/database
  -> @bbq/domain
  -> @bbq/ui

apps/admin
  -> @bbq/database
  -> @bbq/domain
  -> @bbq/ui

apps/workers
  -> @bbq/database
  -> @bbq/domain
  -> @bbq/delivery-channels

apps/api
  -> local prisma schema + webhook runtime
```

## High-Risk Coupling Points

1. Prisma schema changes require client regeneration before type checks stabilize.
2. Payment/order status mapping drift can break reconciliation and reporting.
3. Role policy drift can expose admin routes if verification scripts are bypassed.
4. Environment divergence across web/admin/api can break callback URLs and webhook handling.

## Operational Dataflow Notes

- `IntegrationEvent` is the audit spine for incoming/outgoing integration actions.
- Settlement integrity relies on batch uniqueness and line-level correlation quality.
- `PaymentTransaction` to `Order` link integrity is critical for accounting closure.

## Design Invariants

| Invariant | Why It Matters |
|---|---|
| Money in cents | Numeric stability and auditability |
| Idempotent event handling | Replay-safe processing |
| Explicit role checks | Least-privilege operational control |
| Scripted verification | Repeatable release confidence |

## Recommended Observability Tags

1. `channel` (direct/doordash/ubereats/grubhub/catering)
2. `operation` (checkout, refund, dispute, settlement)
3. `role` (owner/admin/manager/staff/accounting)
4. `result` (success/failure/degraded)

## Related

- [01-Platform-Architecture](01-Platform-Architecture.md)
- [03-Data-Model-and-Schema](03-Data-Model-and-Schema.md)
- [13-API-Reference](13-API-Reference.md)
