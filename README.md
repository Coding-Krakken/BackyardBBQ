# Backyard BBQ King Platform

Enterprise-grade platform for Backyard BBQ King, with:
- Customer commerce and catering booking web app
- Unified admin operations dashboard
- Stripe payments
- Delivery-channel integration adapters
- API and worker services in a monorepo

## Getting started

1. Install dependencies:
   npm install
2. Start all services:
   npm run dev
3. Start an individual service:
   npm run dev:web
   npm run dev:admin
   npm run dev:api
   npm run dev:workers

## Monorepo layout

- apps/web: customer-facing Next.js app
- apps/admin: internal operations dashboard Next.js app
- apps/api: API service (Fastify)
- apps/workers: background workers and integration jobs
   - Delivery ingest now uses channel adapters with idempotent processing, bounded retries, and fallback dead-letter queuing.
- packages/ui: shared UI primitives
- packages/domain: shared domain types and schemas
- packages/database: Prisma schema and database client
- packages/config: shared tsconfig presets

## Environment setup

1. Copy .env.example to .env in the project root.
2. Set DATABASE_URL to your PostgreSQL instance.
3. Set Stripe keys for API and web.
4. Optionally run Prisma generation in the database package:
   npm run db:generate -w @bbq/database
5. Run database seed data for local demos:
   npm run db:seed -w @bbq/database

## Stripe payments and operations

- Core implementation details are documented in [docs/STRIPE-FEATURES.md](docs/STRIPE-FEATURES.md).
- Webhook processing supports checkout completion, payment-intent reconciliation, and dispute lifecycle updates.
- Webhook hardening includes signature validation, optional IP allowlisting, rate limiting, and duplicate-event suppression.
- Operational endpoints include Stripe/webhook health checks and payment metrics export (`json` or `prometheus`).
- Admin payments supports partial and bulk refunds, dispute evidence submission, and Stripe dashboard drill-through links.
- Integration replay commands:
   - `npm run test:stripe:webhook-replay -- --event-id evt_123 --api-base-url http://localhost:4000`
   - `npm run test:stripe:dispute-replay -- --event-id evt_123 --api-base-url http://localhost:4000`
   - `npm run test:payments:integration -- --checkout-event-id evt_checkout --dispute-event-id evt_dispute --api-base-url http://localhost:4000`
      - includes preflight validation for required Stripe env vars, event-id format (`evt_...`), URL/path shape, and admin role values
   - `npm run report:payments:integration -- --input-dir artifacts/stripe-replay`
   - strict mode (fails when replay JSON files are missing): `npm run report:payments:integration -- --input-dir artifacts/stripe-replay --require-files true`
   - strict pass mode (fails when replay checks do not pass): `npm run report:payments:integration -- --input-dir artifacts/stripe-replay --require-files true --require-pass true`
   - script-level replay guardrail tests: `npm run test:payments:scripts`
- Core payment quality gate command (same command used by CI): `npm run validate:payments:core`
- Payment-focused coverage command: `npm run test:payments:coverage` (80% global threshold via `jest.payments.config.js`)
- Payment coverage summary command: `npm run report:payments:coverage` (expects `coverage/coverage-summary.json` from prior coverage run)
- `payments-quality` CI workflow publishes a payment coverage summary table and uploads `payments-coverage-artifacts` (`coverage/`).
- Manual CI replay workflow: `.github/workflows/stripe-replay-checks.yml` (workflow_dispatch with API URL/path inputs plus checkout/dispute event IDs; publishes a replay summary table and JSON artifacts)

### E2E lanes in CI

- Workflow: `.github/workflows/e2e-payments.yml`
- Core validation workflow: `.github/workflows/payments-quality.yml`
- Default lane: `npm run test:e2e:smoke` (runs on PR/push when E2E-related files change)
- Auth lane: `npm run test:e2e:auth` (runs only when admin E2E secrets are configured)
- On lane failure, Playwright reports and test artifacts are uploaded by CI for debugging.
- Failure triage runbook: see `docs/STRIPE-FEATURES.md` ("CI Failure Triage Runbook").

## Implemented API surface

- POST /api/orders
- POST /api/catering/bookings
- POST /api/catering/availability
- POST /api/payments/webhook
- GET /api/admin/orders
- PATCH /api/admin/orders/:orderId/status
- GET /api/admin/catering/bookings
- PATCH /api/admin/catering/bookings/:bookingId/status
- GET /api/admin/payments
- POST /api/admin/payments/refunds
- GET /api/admin/payments/disputes
- PATCH /api/admin/payments/disputes/:eventId/review
- GET /api/admin/accounting/daily-close
- POST /api/admin/accounting/daily-close/finalize
- GET /api/admin/accounting/daily-close/export
- GET /api/admin/analytics/sales
- GET /api/admin/analytics/sales/export
- GET /api/admin/analytics/forecast
- GET /api/admin/analytics/forecast/export
- GET /api/admin/analytics/anomalies
- GET /api/admin/integrations/health
- GET /api/admin/integrations/alerts
- GET /api/admin/integrations/dead-letter
- PATCH /api/admin/integrations/dead-letter/:eventId/retry
- GET /api/admin/overview
