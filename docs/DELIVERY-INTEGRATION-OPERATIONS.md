# Delivery Integration Operations Guide

This document describes how to validate and operate the DoorDash, UberEats, and Grubhub integration paths currently implemented.

## Environment Variables

Set provider credentials in the runtime environment for workers and API:

- `DOORDASH_API_KEY`
- `DOORDASH_API_SECRET`
- `DOORDASH_WEBHOOK_SECRET`
- `DOORDASH_MERCHANT_ID`
- `DOORDASH_STORE_ID`

- `UBEREATS_API_KEY`
- `UBEREATS_API_SECRET`
- `UBEREATS_WEBHOOK_SECRET`
- `UBEREATS_MERCHANT_ID`
- `UBEREATS_STORE_ID`

- `GRUBHUB_API_KEY`
- `GRUBHUB_API_SECRET`
- `GRUBHUB_WEBHOOK_SECRET`
- `GRUBHUB_MERCHANT_ID`
- `GRUBHUB_STORE_ID`

Optional endpoint overrides:

- `DOORDASH_API_BASE_URL`
- `UBEREATS_API_BASE_URL`
- `GRUBHUB_API_BASE_URL`

## Dispatch Queue Behavior

Dispatch requests are written as `IntegrationEvent` rows with:

- `eventType=delivery.dispatch.requested`
- `status=queued`

Worker processing loop:

1. Picks queued/pending dispatch events.
2. Calls provider status sync with `accepted` action.
3. Marks event `processed` on success.
4. Increments attempts and re-queues on transient failure.
5. Marks `dead_letter` when max attempts is reached.

## Replay and Idempotency Validation

### Delivery webhook replay

Command:

```bash
npm run test:delivery:webhook-replay -- --channel doordash --api-base-url http://localhost:4000 --webhook-secret <secret>
```

Expected:

- First POST: accepted and processed.
- Second POST with same `eventId`: duplicate suppression (`duplicate: true`).
- No duplicate order creation for same `(externalChannel, externalOrderId)`.

### Dispatch replay

Command:

```bash
npm run test:delivery:dispatch-replay -- --channel doordash --api-base-url http://localhost:4000
```

Expected:

- First dispatch request queued.
- Second dispatch request for same order/channel returns duplicate metadata.

## Admin Operations

Admin dashboard supports:

- Dispatch action from Orders page.
- Integrations health visibility including:
  - processed count
  - failed count
  - dead-letter count
  - queued count
  - dispatch queued count
  - dispatch processed count

Dead-letter retry endpoint re-queues event and records retry metadata.

## Suggested Operational Checks

1. Verify `/api/health/delivery/:channel` for each provider.
2. Confirm worker logs show dispatch queue cycle execution.
3. Confirm dead-letter queue trends in admin integrations dashboard.
4. Run replay scripts in staging before production cutover.
