# Glossary and FAQ

## Glossary

| Term | Meaning |
|---|---|
| Idempotency | Repeated request/event processing produces same result without duplication |
| Settlement Batch | Provider payout grouping for a period |
| Integration Event | Stored event record for audit and replay diagnostics |
| Payment Intent | Stripe payment object for authorization/capture lifecycle |
| Role Guard | Authorization check enforcing role access |

## Frequently Asked Questions

### Why are prices stored as cents?

To prevent floating point errors and keep calculations stable across payment and reporting surfaces.

### Which app owns webhook logic?

`apps/api` contains dedicated webhook orchestration and health logic; route ownership can vary by deployment mode.

### How do I validate admin access policy changes?

Run `npm run validate:admin` or `npm run validate:admin:fast` from project root.

### How do I verify payment integration behavior quickly?

Use `npm run test:payments:integration` and `npm run report:payments:integration` with replay event IDs.

### Where should new operational scripts live?

In [scripts](../scripts), with corresponding tests in [scripts/__tests__](../scripts/__tests__).
