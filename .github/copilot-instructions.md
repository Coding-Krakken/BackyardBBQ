# Backyard BBQ King — Copilot Instructions

## Architecture

Turborepo monorepo with npm workspaces. Three deployable apps plus shared packages:

| App / Package | Stack | Purpose |
|---|---|---|
| `apps/web` | Next.js 14 (App Router) | Customer-facing: menu, checkout, catering, profile |
| `apps/admin` | Next.js 14 (App Router) | Operations dashboard: payments, disputes, bookings |
| `apps/api` | Fastify 4 (Vercel serverless) | Stripe webhook processing, payment metrics |
| `apps/workers` | Node.js | Background jobs, delivery-channel adapters |
| `packages/database` | Prisma 5 + PostgreSQL | Shared schema and client |
| `packages/domain` | TypeScript + Zod | Shared types, enums, validation schemas |
| `packages/ui` | React | Shared UI primitives |
| `packages/config` | JSON | Shared tsconfig presets |

Workspace imports use `@bbq/<package>` (e.g., `import { prisma } from "@bbq/database"`).
The API app (`apps/api`) uses its own local Prisma schema — it does **not** import `@bbq/database`.

## TypeScript

- **Strict mode** is on globally via `tsconfig.base.json`.
- `noUncheckedIndexedAccess` is enabled — always guard indexed access with a null check or non-null assertion after a truthiness guard.
- Target `ES2022`, module `ESNext`, module resolution `Bundler`.
- Next.js auto-injects `isolatedModules` and `noEmit` — do not remove them.
- `apps/api/tsconfig.json` includes `"jest"` in `compilerOptions.types`.

## Database & Prisma

- Schema lives at `packages/database/prisma/schema.prisma`.
- **All monetary values are stored in cents** (integers): `subtotalCents`, `taxCents`, `tipCents`, `totalCents`. Convert to dollars only for UI display (`/ 100`).
- Key models: `Customer`, `Order`, `PaymentTransaction`, `CateringBooking`, `SavedPaymentMethod`, `IntegrationEvent`, `Dispute`, `Referral`, `Location`, `MenuItem`.
- Status enums follow Prisma conventions. Import from `@prisma/client`.
- Generate client: `npx prisma generate --schema=packages/database/prisma/schema.prisma`.

## Stripe Integration

- **Checkout Sessions** for order and catering deposit payments (embedded mode).
- **Payment Methods API** for saved cards (create/list/delete/set-default).
- **PaymentIntents** for refund and reconciliation flows.
- **Webhooks** handled in `apps/api/src/index.ts` with hardening:
  - Signature verification (required)
  - In-memory duplicate suppression (24h TTL)
  - Persisted deduplication via `IntegrationEvent` table
  - Per-IP rate limiting (default 100/min)
  - Optional Stripe IP allowlisting
- Events handled: `checkout.session.completed`, `payment_intent.*`, `charge.dispute.*`.
- See `docs/STRIPE-FEATURES.md` for the full integration surface.

## Authentication

- NextAuth 4 with Credentials provider (email + bcrypt password).
- Web sessions: JWT, 30-day expiry. Admin sessions: JWT, 8-hour expiry.
- Roles: `customer`, `admin`, `owner`, `manager`, `staff`, `accounting`.
- Admin app blocks `customer` role at login.
- Admin API routes require `x-admin-role` header. Allowed roles vary by endpoint.

## Testing

**Jest** (unit / integration):
- Default coverage threshold: **70%**. Payment-specific: **80%** (`jest.payments.config.js`).
- Setup file (`jest.setup.js`) is CommonJS — use `require`, no TS type annotations.
- Mocks for Framer Motion, NextAuth, and Next.js router are pre-configured.

**Playwright** (E2E):
- Web tests: `*.web.spec.ts` → `https://backyard-bbq.vercel.app`
- Admin tests: `*.admin.spec.ts` → `https://backyard-bbq-admin.vercel.app`
- Timeout: 45s, parallel enabled.

Key commands:
```bash
npm test                         # Jest all
npm run test:payments:coverage   # Payment tests (80% threshold)
npm run test:e2e                 # All Playwright E2E
npm run test:e2e:smoke           # Non-auth E2E only
```

## Build & Validation

```bash
npm run dev                  # All services in parallel
npm run dev:web              # Web only (port 3000)
npm run dev:admin            # Admin only (port 3001)
npm run dev:api              # API only (port 4000)
npm run build                # Turbo build all
npm run typecheck:all        # Parallel typecheck (web, api, admin)
npm run validate:admin       # Admin guardrails (roles, pages, API policies)
npm run validate:pre-push    # Pre-push hook target (~45s with SKIP_E2E=1)
```

## Deployment

All apps deploy to **Vercel**:
- Web: `backyard-bbq` → https://backyard-bbq.vercel.app
- Admin: `backyard-bbq-admin` → https://backyard-bbq-admin.vercel.app
- API: `backyard-bbq-backend` → https://backyard-bbq-backend.vercel.app

The API serverless handler uses `fastify.server.emit("request", req, res)` — **not** `@fastify/aws-lambda`.
`fastify-raw-body` must be v4 for Fastify v4 compatibility.

## Conventions

- **File naming**: App Router structure under `app/`. API routes use lowercase hyphens (`/api/payment-methods`).
- **Imports**: Use `@/` path alias within Next.js apps (resolves to `app/`). Use `import type` for type-only imports.
- **Prices**: Always cents in code and database. Format for display: `(cents / 100).toFixed(2)`.
- **Admin guardrails**: Three policy verifiers — `verify:roles`, `verify:dashboard-pages`, `verify:api-roles`. Run all via `npm run validate:admin`.
- **Git hooks**: Husky pre-commit runs lint-staged; pre-push runs `validate:pre-push`. Skip E2E with `SKIP_E2E=1`.
- **No custom Prettier/ESLint config** — uses Next.js built-in ESLint defaults.
- **Secrets**: Never commit literal Stripe keys (`sk_test_*`, `pk_test_*`). Use environment variables or neutral placeholders in tests.
