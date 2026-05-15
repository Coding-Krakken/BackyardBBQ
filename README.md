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

## Implemented API surface

- POST /api/orders
- POST /api/catering/bookings
- POST /api/catering/availability
- POST /api/payments/create-intent
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
