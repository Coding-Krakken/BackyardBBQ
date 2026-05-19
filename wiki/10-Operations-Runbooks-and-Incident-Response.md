# Operations Runbooks and Incident Response

## Incident Classes

| Class | Typical Trigger |
|---|---|
| Payment degradation | Checkout failures, verify-session mismatch, refund spike |
| Webhook instability | Signature failures, event backlog, dedupe anomalies |
| Delivery outage | Provider events failing, status/settlement drift |
| Data integrity drift | Orders without payments or payment records without orders |

## Triage Commands

```bash
npm run db:diagnose
npm run data:integrity:check
npm run test:payments:integration -- --api-base-url <url>
npm run test:delivery:integration -- --channel all --run-live false --api-base-url <url>
```

## Payment Incident Playbook

1. Confirm Stripe secret and webhook secret are valid in target environment.
2. Check payment health and latest webhook event status.
3. Run replay checks on representative checkout and dispute events.
4. Escalate if dispute/refund thresholds trend above expected limits.

## Delivery Incident Playbook

1. Inspect provider-specific health endpoint data.
2. Run contract and integration summaries to isolate channel failures.
3. Reconcile settlement batches for duplicate or missing lines.
4. Recover queued events before reopening normal operations.

## Data Integrity Drift Playbook

1. Run check mode to quantify drift.
2. Run dry reconciliation.
3. Execute reconciliation only after confirming expected impact.

Related script: [scripts/reconcile-orphaned-orders.mjs](../scripts/reconcile-orphaned-orders.mjs)
