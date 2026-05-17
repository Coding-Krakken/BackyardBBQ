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

Settlement retry processing:

1. Re-queued settlement events (`status=queued|pending` and `eventType` containing `settlement`) are consumed by workers.
2. Worker normalizes settlement payload fields (`settlementId`, gross, fees, net, currency, settledAt).
3. Duplicate settlement IDs are marked `ignored` to prevent double counting.
4. Invalid settlement payload retries increment attempts and eventually return to `dead_letter` after max attempts.

## Replay and Idempotency Validation

### Automated integration checks

Command (non-live wiring validation):

```bash
npm run test:delivery:integration -- --run-live false
```

Command (live replay validation):

```bash
npm run test:delivery:integration -- --run-live true --channel doordash --api-base-url http://localhost:4000 --webhook-secret <secret>
```

Command (live replay validation across all channels):

```bash
npm run test:delivery:integration -- --run-live true --channel all --api-base-url http://localhost:4000
```

Notes:

- Live mode enforces summary validation by default (`--validate-summary true`).
- Disable strict summary gating only for exploratory runs with `--validate-summary false`.
- In `--channel all` mode, channel-specific webhook secrets must be configured for each provider.
- In `--channel all` live mode, a consolidated strict summary is also generated and validated after per-channel runs.

Summary report from replay artifacts:

```bash
npm run report:delivery:integration -- --input-dir artifacts/delivery-replay
```

Consolidated all-channel summary report (expects per-channel subdirectories under `artifacts/delivery-replay`):

```bash
npm run report:delivery:integration -- --input-dir artifacts/delivery-replay --all-channels true --require-files true --require-pass true
```

Shortcut command:

```bash
npm run report:delivery:integration:all -- --input-dir artifacts/delivery-replay
```

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

### Delivery action replay

Command:

```bash
npm run test:delivery:action-replay -- --channel doordash --action accept --api-base-url http://localhost:4000
```

Expected:

- First action request queued.
- Second action request for same order/channel/action returns duplicate metadata.
- Worker consumes queued action and transitions it to processed or dead-letter after retry exhaustion.

### Delivery settlement replay

Command:

```bash
npm run test:delivery:settlement-replay -- --channel doordash --api-base-url http://localhost:4000 --webhook-secret <secret>
```

Expected:

- First settlement webhook event is accepted and persisted.
- Second settlement webhook event with the same `eventId` returns duplicate metadata.
- Settlement events with a reused `settlementId` are also suppressed, even if event IDs differ.
- Replay checker validates both duplicate paths (`eventId` replay and `settlementId` business-key replay).
- Daily close summary includes `settlementNetCents` and `settlementByChannel` values.

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
- Settlement event stream visibility (`/api/admin/integrations/settlements`) with settlementId, payoutId, gross, fees, and net.
- Settlement CSV export (`/api/admin/integrations/settlements/export`) for reconciliation handoff and audit trails.
- Settlement feed/export filters supported via query params: `channel`, `status`, and `limit` (feed), plus `from`/`to` (export).
- Settlement feed now returns summary totals for the filtered window (`grossCents`, `feesCents`, `netCents`, and status counts) to support on-page reconciliation.
- Settlement trend analytics endpoint (`/api/admin/integrations/settlements/trend`) provides daily gross/fees/net and fee-rate series for the selected channel window.

Dead-letter retry endpoint re-queues event and records retry metadata.

Dead-letter feed now supports targeted filter params for triage views:

- `channel`
- `status` (`failed` or `dead_letter`)
- `eventType` (substring match)
- `from` / `to` (date-time bounds)

Retry behavior details:

- Retried dead-letter events are set back to `queued` so worker loops consume them.
- Retry metadata is persisted (`retriedAt`, role, and incremented attempts).
- Re-queued events disappear from dead-letter views once status transitions away from dead-letter.

Alerting behavior details:

- Integrations alerts include settlement-specific dead-letter/failure signals.
- Integrations alerts include queued/pending settlement backlog thresholds.
- Integrations alerts include settlement fee-rate spike detection versus the previous 7-day baseline window.
- Integrations alerts now include triage evidence pointers (sample event IDs, settlement IDs, and API/artifact paths) in dashboard responses.
- Delivery webhook, dispatch, action, and settlement queue flows now carry `correlationId` metadata for end-to-end incident tracing.

## Suggested Operational Checks

1. Verify `/api/health/delivery/:channel` for each provider.
2. Confirm worker logs show dispatch queue cycle execution.
3. Confirm dead-letter queue trends in admin integrations dashboard.
4. Run replay scripts in staging before production cutover.
5. Reconcile settlement totals from delivery channels against accounting daily-close exports.
