# Delivery Integration Operations Guide

This document describes how to validate and operate the DoorDash, UberEats, and Grubhub integration paths currently implemented.

## Environment Variables

Set provider credentials in the runtime environment for workers and API:

- `DOORDASH_API_KEY`
- `DOORDASH_API_SECRET`
- `DOORDASH_WEBHOOK_SECRET`
- `DOORDASH_MERCHANT_ID`
- `DOORDASH_STORE_ID`
- `DOORDASH_ENVIRONMENT` (`sandbox` or `production`)

- `UBEREATS_API_KEY`
- `UBEREATS_API_SECRET`
- `UBEREATS_WEBHOOK_SECRET`
- `UBEREATS_MERCHANT_ID`
- `UBEREATS_STORE_ID`
- `UBEREATS_ENVIRONMENT` (`sandbox` or `production`)

- `GRUBHUB_API_KEY`
- `GRUBHUB_API_SECRET`
- `GRUBHUB_WEBHOOK_SECRET`
- `GRUBHUB_MERCHANT_ID`
- `GRUBHUB_STORE_ID`
- `GRUBHUB_ENVIRONMENT` (`sandbox` or `production`)

Delivery webhook endpoints:

- `POST /api/webhooks/delivery/:channel/orders`
- `POST /api/webhooks/delivery/:channel/status`
- `POST /api/webhooks/delivery/:channel/settlements`

Worker webhook processing behavior:

1. `delivery.webhook.order.received` events are consumed and create channel-linked orders when the external order does not already exist.
2. `delivery.webhook.status.received` events are consumed and update internal order status by internal ID or `(externalChannel, externalOrderId)` fallback.
3. `delivery.webhook.settlement.received` events feed the existing settlement queue cycle and dedupe logic.

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
- Optional: pass `--correlation-id <id>` to `test:delivery:integration` for deterministic replay traces. In `--channel all` mode, the runner appends `-<channel>` automatically.

Summary report from replay artifacts:

```bash
npm run report:delivery:integration -- --input-dir artifacts/delivery-replay
```

Consolidated all-channel summary report (expects per-channel subdirectories under `artifacts/delivery-replay`):

```bash
npm run report:delivery:integration -- --input-dir artifacts/delivery-replay --all-channels true --require-files true --require-pass true
```

Strict validation can also target one correlation ID in single-channel mode:

```bash
npm run report:delivery:integration -- --input-dir artifacts/delivery-replay --require-files true --require-pass true --correlation-id corr-delivery-123
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

### Delivery status webhook replay

Command:

```bash
npm run test:delivery:status-replay -- --channel doordash --api-base-url http://localhost:4000 --webhook-secret <secret>
```

Expected:

- First status webhook event is accepted and queued.
- Second status webhook event with same `eventId` returns duplicate metadata.
- Correlation ID remains consistent across the replay pair.

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
- Replay artifacts now include correlation consistency metadata and strict summary validation fails when correlation continuity breaks.

### Correlation contract replay

Command:

```bash
npm run test:delivery:contract-replay -- --api-base-url http://localhost:4000 --correlation-id corr-delivery-123
```

Expected:

- Contract endpoint returns `result.passed=true` for a healthy flow.
- Artifact includes contract score and failed check count.
- Integration summary fails strict mode when contract replay fails.

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
- `correlationId` (exact match)
- `from` / `to` (date-time bounds)

Settlement feed supports `correlationId` exact-match filtering to trace a single delivery flow end-to-end.

Correlation timeline endpoint (ordered event trace for one correlation ID):

```bash
GET /api/admin/integrations/correlation/:id?limit=200
```

Correlation incident export endpoint (handoff bundle):

```bash
GET /api/admin/integrations/correlation/:id/export?format=json
GET /api/admin/integrations/correlation/:id/export?format=csv
```

Correlation contract validation endpoint (flow completeness and failure checks):

```bash
GET /api/admin/integrations/correlation/:id/contract
```

Contract response includes:

- `checks[]` with pass/fail, details, and evidence event IDs
- `result.passed`, `result.scorePercent`, `result.failedCount`
- rollups for `summary.channels`, `summary.statuses`, and `summary.eventTypes`

Combined incident package endpoint (JSON + timeline CSV + settlements CSV in one response):

```bash
GET /api/admin/integrations/correlation/:id/package
GET /api/admin/integrations/correlation/:id/package?download=true
```

Package response includes integrity metadata for audit workflows:

- `manifest.generatedAt`
- `manifest.eventCount`
- `manifest.digests.timelineCsvSha256`
- `manifest.digests.settlementsCsvSha256`
- `manifest.digests.contractJsonSha256`

Package payload also includes embedded contract evaluation snapshot:

- `contract.summary`
- `contract.checks[]`
- `contract.result`

Optional package signing for audit authenticity:

- `INCIDENT_PACKAGE_SIGNING_SECRET`
- `INCIDENT_PACKAGE_SIGNING_KEY_ID` (default: `local-v1`)

When signing is configured, package responses include `manifest.integrity.signatureHex` and `manifest.integrity.keyId` and emit corresponding response headers.

Admin dashboard includes an Incident Package Inspector panel to fetch a correlation package by ID and verify CSV digests client-side.
The inspector also runs contract validation and renders a pass/fail checklist for inbound webhooks, dispatch/action presence, settlement presence, and failed/dead-letter detection.

JSON export includes rollups for handoff:

- `summary.firstSeenAt`, `summary.lastSeenAt`, `summary.durationMs`
- `summary.statuses` and `summary.eventTypes`
- `summary.settlementTotals` (`grossCents`, `feesCents`, `netCents`, `count`)

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
