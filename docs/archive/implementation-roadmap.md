# Backyard BBQ King Implementation Roadmap

## Current baseline
- Monorepo created with customer app, admin app, API, workers, and shared packages.
- Stripe checkout surface started in customer app.
- Catering availability endpoint scaffolded in API.
- Delivery-channel adapter package added with idempotent ingest, retry strategy, and dead-letter fallback in workers.

## Immediate build sequence

1. Authentication and RBAC
- Add auth provider for customer and admin users.
- Enforce role scopes: owner, admin, manager, staff, accounting.

2. Data layer
- Add PostgreSQL and Prisma schema for locations, menus, orders, bookings, payments, and integration events.
- Add migrations and seed scripts for smoke-test data.

3. Catering engine
- Replace placeholder availability endpoint with rule-based capacity calculations.
- Add booking request lifecycle: draft, pending approval, approved, declined, cancelled.
- Add deposit and final payment milestones.

4. Commerce and checkout
- Build cart, tax and fee calculations, and order placement flow.
- Implement Stripe PaymentIntent creation in API and confirmation in web checkout route.
- Add webhook processor for payment success, failure, refunds, disputes.

5. Admin command center
- Build unified order feed combining direct and integration channels.
- Add exception queue and manual override actions.
- Add reconciliation views for payouts and tax exports.

6. Delivery integrations
- Implement channel adapters and idempotent inbound order ingest.
- Add retry strategy and dead-letter queue visibility.

7. Observability and reliability
- Add structured logging, error tracking, and metrics dashboards.
- Add alerting for payment failures and integration degradation.

## Technical priorities for next sprint
- Prisma schema and first migration.
- Auth/RBAC middleware.
- Stripe PaymentIntent API endpoint.
- Booking capacity engine v1.

## Locked Visual Baseline (Approved)
- The cinematic homepage and route styling in `apps/web` is approved and should be treated as the visual baseline.
- Preserve current section order, typography contrast, spacing rhythm, and dark premium color direction unless a new design review explicitly approves changes.
- Keep CTA routing behavior intact: `/catering`, `/checkout`, `/dashboard`, and configured external ordering links.

## Reliability Guardrails (Must Keep)
- Marketing images are pinned to local assets under `apps/web/public/images/marketing` and mapped from `apps/web/app/config/images.ts`.
- Do not switch these assets back to remote CDN URLs without equivalent uptime guarantees and verification.
- Keep checkout env guards in place so missing Stripe or API config fails gracefully without crashing UI.
- For local development, avoid running `next build` and `next dev` concurrently for the same app; if chunk/runtime errors appear, clear `apps/web/.next` and restart dev.

## Seamless Verification Checklist (Locked State)
- Home, catering, checkout, and dashboard routes render without server error overlays.
- Homepage marketing images decode successfully on desktop and mobile.
- Catering and checkout hero images decode successfully on desktop and mobile.
- Production monorepo build completes successfully with no type errors.
