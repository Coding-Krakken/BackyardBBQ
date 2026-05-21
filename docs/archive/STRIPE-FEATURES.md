# Stripe Features and Operations

This document summarizes the currently implemented Stripe integration surface across web, admin, and API services.

## Implemented Features

### Checkout and Tax
- Embedded Checkout Session flow for order payments
- Automatic tax enabled via Stripe Tax
- Server-side checkout verification endpoint returning subtotal, tax, and total

### Saved Payment Methods
- Stripe customer creation/sync for authenticated customers
- Saved card method synchronization to local database
- Customer payment methods API for list/delete/set-default
- Customer portal session endpoint for self-service billing updates

### Catering Deposits
- Catering booking deposit checkout session flow
- Booking-linked payment metadata for deposit and final payment tracking

### Admin Refunds and Disputes
- Transaction-scoped partial/full refunds with reason capture
- Stripe refund execution and local audit event recording
- Refund history includes Stripe refund IDs for direct dashboard drill-through
- Dispute review workflows and detail view
- Dispute evidence submission with optional file uploads to Stripe Files API
- Dispute lifecycle reconciliation from webhook events

### Analytics and Customer Payment History
- Admin payment analytics endpoint and dashboard tab
- Customer payment history endpoint with filters and aggregates
- Operational payment metrics endpoint with JSON and Prometheus output formats

## Webhook Handling

Stripe webhook processing is implemented in [apps/api/src/index.ts](apps/api/src/index.ts).

Handled event groups include:
- checkout.session.completed
- payment_intent.*
- charge.dispute.*

Stored data includes payment intent status, dispute status, due-by metadata, evidence details, and checkout-session payment-method sync outcomes.

Durability and safety controls include:
- In-memory duplicate suppression with configurable TTL
- Persisted duplicate suppression using Stripe event IDs stored in integration events
- Per-IP rate limiting on webhook ingress
- Optional Stripe webhook IP allowlisting

### Correlation ID Tracing

Webhook and API requests now carry request-level correlation context:
- Incoming `X-Correlation-ID` or `X-Request-ID` is reused when present.
- A new UUID correlation ID is generated when no inbound ID exists.
- API responses include `X-Correlation-ID` for downstream propagation.

Correlation IDs are persisted for incident reconstruction:
- `IntegrationEvent.correlationId`
- `PaymentTransaction.correlationId`
- `Order.correlationId`

Admin tracing endpoint:
- `GET /api/admin/integrations/correlation/:id`
- Returns matched integration events plus related payments and orders in a single timeline.

## Operational Health Endpoints

Implemented in [apps/api/src/index.ts](apps/api/src/index.ts):
- GET /api/health/stripe
- GET /api/health/webhook

## Operational Alerting

Implemented in [apps/api/src/index.ts](apps/api/src/index.ts):
- Structured payment/dispute/refund operational logs
- Alert webhook delivery for critical failures
- Threshold-based alerts for dispute and refund rate breaches over a 30-day window
- Pull-based operational metrics endpoint: `GET /api/metrics/payments?days=&format=json|prometheus`

### Environment Variables

Required:
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET

Optional operational alerting:
- PAYMENT_ALERT_WEBHOOK_URL
- DISPUTE_RATE_ALERT_THRESHOLD (default 2)
- REFUND_RATE_ALERT_THRESHOLD (default 5)
- PAYMENT_ALERT_COOLDOWN_MS (default 1800000)

Optional webhook hardening:
- WEBHOOK_RATE_LIMIT_PER_MINUTE (default 100)
- STRIPE_WEBHOOK_ALLOWED_IPS (comma-separated)
- WEBHOOK_EVENT_TTL_MS (default 86400000)

Optional metrics protection:
- METRICS_API_KEY

## Key Files

- [apps/web/app/api/payments/create-checkout-session/route.ts](apps/web/app/api/payments/create-checkout-session/route.ts)
- [apps/web/app/api/payments/verify-session/route.ts](apps/web/app/api/payments/verify-session/route.ts)
- [apps/web/app/api/customer/payment-methods/route.ts](apps/web/app/api/customer/payment-methods/route.ts)
- [apps/web/app/api/customer/portal-session/route.ts](apps/web/app/api/customer/portal-session/route.ts)
- [apps/admin/app/api/admin/payments/[transactionId]/refund/route.ts](apps/admin/app/api/admin/payments/[transactionId]/refund/route.ts)
- [apps/admin/app/dashboard/payments/page.tsx](apps/admin/app/dashboard/payments/page.tsx)
- [apps/admin/app/api/admin/payments/disputes/[id]/evidence/route.ts](apps/admin/app/api/admin/payments/disputes/[id]/evidence/route.ts)
- [apps/admin/app/api/admin/customers/[id]/payments/route.ts](apps/admin/app/api/admin/customers/[id]/payments/route.ts)
- [apps/api/src/index.ts](apps/api/src/index.ts)

## Test Guidance

Recommended Stripe test mode validation runs:
1. Checkout Session create -> pay -> verify local transaction update.
2. Partial refund -> confirm Stripe refund and local state transition.
3. Dispute creation -> webhook status update -> evidence submit with file.
4. Health and metrics endpoints return expected status for configured and misconfigured scenarios.
5. Replay a known webhook event ID and confirm duplicate handling returns early.

### Webhook Replay Integration Check

Use the replay script to validate signature handling plus duplicate suppression against a real Stripe event:

```bash
# Terminal 1: run API locally with Stripe env configured
npm run dev:api

# Terminal 2: replay an existing Stripe event twice (second should be duplicate)
npm run test:stripe:webhook-replay -- --event-id evt_123 --api-base-url http://localhost:4000
```

- Script-level guardrail tests for replay tooling:
	- `npm run test:payments:scripts`
For dispute webhook flow verification, use the dispute replay checker. It validates duplicate suppression and confirms the replayed dispute is visible through the admin disputes API.

```bash
# Replay a charge.dispute.* event twice, then assert persistence via admin disputes API
npm run test:stripe:dispute-replay -w @bbq/api -- --event-id evt_123 --api-base-url http://localhost:4000
```

Unified integration command (runs checkout replay + dispute replay in sequence):

```bash
npm run test:payments:integration -- --checkout-event-id evt_checkout --dispute-event-id evt_dispute --api-base-url http://localhost:4000
```

This command now performs preflight validation before replay execution (required Stripe env vars, `evt_...` event id format, API URL format, route path shape, and allowed admin roles).

Required environment variables:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Optional arguments:
- `--webhook-path` (default `/api/payments/webhook`)
- `--disputes-path` (default `/api/admin/payments/disputes?limit=100`)
- `--admin-role` (default `owner`)
- `--output-json` (optional path to write machine-readable replay results)
- `--api-key`
- `--webhook-secret`

### Browser E2E Smoke Coverage (Playwright)

Playwright is configured at repository root with separate projects for web and admin surfaces.

```bash
# Install dependencies (once)
npm install

# Install Playwright browser binaries (once per machine)
npx playwright install

# Run all E2E smoke tests
npm run test:e2e

# Run public smoke tests only (no admin credentials needed)
npm run test:e2e:smoke

# Run authenticated admin tests only
npm run test:e2e:auth
```

Current smoke checks:
- `e2e/menu.web.spec.ts`
	- Menu page renders key category controls
	- Menu item detail opens and exposes Add to Cart action
- `e2e/checkout.web.spec.ts`
	- Checkout page renders secure payment shell and order summary links
	- Payment initialization status copy is visible
- `e2e/guest-checkout-journey.web.spec.ts`
	- Guest adds menu item to cart and navigates to checkout
	- Checkout order summary shows selected item context
- `e2e/admin-login.admin.spec.ts`
	- Protected admin payments route redirects to login
	- Login form controls are visible
- `e2e/admin-payments-auth.admin.spec.ts`
	- Signs in to admin with test credentials
	- Verifies Payments dashboard and core tabs (Transactions, Disputes, Analytics)
	- Asserts tab-specific UI for disputes filters and analytics KPI/chart sections
- `e2e/admin-payments-actions.admin.spec.ts`
	- Fixture-driven: locates known transaction/dispute rows by token
	- Opens Refund and Submit Evidence dialogs, then cancels to avoid mutating payment state
	- Optional seeded mutation path: submits dispute evidence and verifies success toast

Optional target overrides:
- `E2E_WEB_BASE_URL`
- `E2E_ADMIN_BASE_URL`

Authenticated admin test credentials:
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`

Deterministic admin action fixture tokens:
- `E2E_ADMIN_REFUND_ROW_TOKEN` (text token present in a refundable transaction row)
- `E2E_ADMIN_DISPUTE_ROW_TOKEN` (text token present in a dispute row)

Optional seeded mutation controls:
- `E2E_ADMIN_ENABLE_MUTATIONS` (`true` to enable submit-and-verify mutation path)
- `E2E_ADMIN_MUTATION_DISPUTE_ROW_TOKEN` (row token dedicated to mutation test)
- `E2E_ADMIN_EVIDENCE_SUMMARY` (optional custom evidence summary text)

Note: `e2e/admin-payments-auth.admin.spec.ts` auto-skips when credential env vars are not set.
Note: `e2e/admin-payments-actions.admin.spec.ts` auto-skips when credentials or fixture tokens are not set.
Note: submit-and-verify mutation assertions auto-skip unless `E2E_ADMIN_ENABLE_MUTATIONS=true` and mutation token env vars are provided.

Tagging convention:
- Authenticated admin E2E tests include `@auth` in the describe title and can be filtered with `--grep @auth`.

### CI workflow

GitHub Actions workflow: `.github/workflows/e2e-payments.yml`

Core validation workflow: `.github/workflows/payments-quality.yml`

Manual replay workflow: `.github/workflows/stripe-replay-checks.yml`

- `e2e-smoke` job runs `npm run test:e2e:smoke` on PR/push when E2E-related files change.
- `e2e-auth` job runs `npm run test:e2e:auth` only when all required E2E admin secrets are present:
	- `E2E_ADMIN_EMAIL`
	- `E2E_ADMIN_PASSWORD`
	- `E2E_ADMIN_REFUND_ROW_TOKEN`
	- `E2E_ADMIN_DISPUTE_ROW_TOKEN`
- On failure, each CI lane uploads Playwright artifacts (`playwright-report/`, `test-results/`) for debugging traces, screenshots, and videos.
- `payments-quality` job runs non-E2E quality gates for payment workstream changes:
	- `npm run validate:payments:core`
	- command expands to unit/route tests + web/api/admin typechecks + admin API role policy verification + payment-focused coverage gate
	- payment-focused coverage command: `npm run test:payments:coverage` (Jest config: `jest.payments.config.js`, threshold: 80% global)
	- reusable coverage summary command: `npm run report:payments:coverage` (reads `coverage/coverage-summary.json` and appends to GitHub step summary in CI)
	- publishes a `Payments Coverage Summary` table in the workflow run summary and uploads `payments-coverage-artifacts` (`coverage/`)
- `stripe-replay-checks` workflow runs on manual dispatch and validates:
	- checkout webhook replay duplicate suppression (`checkout.session.completed` event)
	- dispute webhook replay duplicate suppression + dispute persistence lookup via admin disputes API
	- runs via `npm run test:payments:integration` for local/CI behavior parity and shared preflight input validation
	- uses `npm run report:payments:integration -- --input-dir artifacts/stripe-replay --require-files true --require-pass true` to publish replay summary table and fail when replay checks are not successful
	- uploads `stripe-replay-artifacts` containing `checkout-replay.json` and `dispute-replay.json` outputs for audit and triage

Required repository secrets for manual replay workflow:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Required workflow dispatch inputs:
- `api_base_url`
- `webhook_path`
- `disputes_path`
- `checkout_event_id`
- `dispute_event_id`

`stripe-replay-checks` also publishes a workflow run summary table (GitHub job summary) with core replay pass/fail fields.

Mutation path can be enabled in CI by additionally setting:
- `E2E_ADMIN_ENABLE_MUTATIONS`
- `E2E_ADMIN_MUTATION_DISPUTE_ROW_TOKEN`
- `E2E_ADMIN_EVIDENCE_SUMMARY` (optional)

When mutation mode is enabled, the auth action suite verifies all of the following after evidence submission:
- success toast is shown
- dispute row status transitions to an expected review state (`under_review`, `warning_under_review`, or `evidence_submitted`)
- dispute detail page shows the `Evidence Timeline` section with a populated submission timestamp label

### CI Failure Triage Runbook

When an E2E CI lane fails:

1. Open the failed workflow run and download the uploaded artifact for the failed lane:
	- `playwright-smoke-artifacts` or `playwright-auth-artifacts`
2. Inspect `playwright-report/index.html` for failed test names and timeline details.
3. Inspect `test-results/**/error-context.md` for the DOM snapshot and failing locator.
4. Replay trace locally for the failing test:

```bash
npx playwright show-trace path/to/test-results/<failed-test>/trace.zip
```

5. Re-run only the failing lane locally:

```bash
npm run test:e2e:smoke
# or
npm run test:e2e:auth
```

6. If failure is selector drift, tighten locators to role + explicit text/level and avoid ambiguous matches.

### Replay Artifact Triage (Manual Workflow)

When `.github/workflows/stripe-replay-checks.yml` runs, download `stripe-replay-artifacts` and inspect:
- `checkout-replay.json`
- `dispute-replay.json`

Quick pass criteria:
- `firstAttempt.ok = true`
- `secondAttempt.ok = true`
- `duplicateSuppressed = true`
- For disputes, `disputesLookup.found = true`

Field interpretation:
- `firstAttempt`
	- First signed webhook replay result.
	- Failure indicates endpoint/config/signature acceptance issue.
- `secondAttempt`
	- Immediate duplicate replay result.
	- Failure indicates unstable webhook handling path or upstream outage.
- `duplicateSuppressed`
	- Expected `true`; confirms dedupe logic is active.
	- `false` indicates duplicate-event suppression regression.
- `disputesLookup.status`
	- Admin disputes API response status from replay workflow.
	- Non-200 usually indicates auth/route/deployment mismatch.
- `disputesLookup.found`
	- Expected `true`; confirms dispute webhook persistence is queryable through admin API.
	- `false` indicates persistence or query-shape drift.

Common failure signatures and first checks:
- `firstAttempt.status = 400`
	- Check webhook secret mismatch (`STRIPE_WEBHOOK_SECRET`) and request signature handling.
- `firstAttempt.status = 403`
	- Check webhook IP allowlist configuration for the target environment.
- `firstAttempt.status = 429`
	- Check webhook rate-limit settings and concurrent replay runs.
- `duplicateSuppressed = false`
	- Check in-memory/persisted dedupe logic and TTL assumptions.
- `disputesLookup.status = 401/403`
	- Check `admin_role` workflow input and admin-role route policy.
- `disputesLookup.found = false`
	- Verify replay event is `charge.dispute.*`, then inspect webhook logs and dispute event persistence path.
