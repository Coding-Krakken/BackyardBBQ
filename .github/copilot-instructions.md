# Backyard BBQ King - Copilot Instructions

This is the canonical guidance file for AI-assisted coding in this repository.
Favor precise, minimal changes that preserve existing behavior unless the task requires a change.

## 1) Repository Architecture

Turborepo monorepo with npm workspaces.

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

Workspace package imports use `@bbq/<package>`.
Within Next.js apps, use `@/` alias (resolves to each app's `app/` directory).

Important: `apps/api` uses its own local Prisma schema and should not import `@bbq/database`.

## 2) TypeScript and Code Style

- Strict mode is enabled globally via `tsconfig.base.json`.
- `noUncheckedIndexedAccess` is enabled. Guard array/object indexed access before use.
- Target is `ES2022`; module is `ESNext`; module resolution is `Bundler`.
- Keep Next.js defaults (`isolatedModules`, `noEmit`) intact.
- Prefer `import type` for type-only imports.
- Keep edits focused. Do not reformat unrelated files.

## 3) Database and Prisma Rules

- Primary schema is `packages/database/prisma/schema.prisma`.
- All money is integer cents in code and DB: `subtotalCents`, `taxCents`, `tipCents`, `totalCents`.
- Only convert for display in UI, for example: `(cents / 100).toFixed(2)`.
- Use enums/status types from `@prisma/client`.
- After schema updates, regenerate Prisma client:

```bash
npx prisma generate --schema=packages/database/prisma/schema.prisma
```

## 4) Payments and Stripe

Use the established split:

- Checkout Sessions (embedded mode): order payments and catering deposits.
- Payment Methods API: saved card list/delete/set-default flows.
- PaymentIntents: refunds and reconciliation paths.

Webhook processing is in `apps/api/src/index.ts` and must retain hardening:

- Signature verification required.
- In-memory duplicate suppression with TTL.
- Persisted deduplication via integration events.
- Per-IP webhook rate limiting (default 100/min).
- Optional Stripe IP allowlisting.

Handled event groups:

- `checkout.session.completed`
- `payment_intent.*`
- `charge.dispute.*`

Do not commit real Stripe keys (`sk_*`, `pk_*`). Use env vars and sanitized fixtures.

## 5) Auth and Authorization

- NextAuth 4 Credentials provider (email + bcrypt).
- Web sessions: JWT, 30-day expiry.
- Admin sessions: JWT, 8-hour expiry.
- Roles: `customer`, `admin`, `owner`, `manager`, `staff`, `accounting`.
- Admin login must reject `customer` role.
- Admin APIs require `x-admin-role` header and role-based checks by endpoint.

Environment reliability notes:

- Manual auth flows require proper auth secrets. Missing secrets can cause 500s in login/signup actions.
- For preview deployments, avoid redirect/CORS regressions by checking preview host conditions in addition to environment flags.

## 6) Testing Standards

Jest:

- Default quality baseline: 70% coverage.
- Payments lane: 80% coverage via `jest.payments.config.js`.
- `jest.setup.js` is CommonJS. Use `require`, not ESM imports.
- Root Jest alias `^@/(.*)$` points to web app paths; use relative imports in cross-app tests when needed.

Playwright:

- `*.web.spec.ts` targets customer web flows.
- `*.admin.spec.ts` targets admin flows.
- Base URLs default to deployed domains; override for local validation:

```bash
E2E_WEB_BASE_URL=http://localhost:3000 E2E_ADMIN_BASE_URL=http://localhost:3001 npm run test:e2e
```

- Auth-tagged tests use `@auth` and can be filtered with `npm run test:e2e:auth`.

Useful commands:

```bash
npm test
npm run test:payments:coverage
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:auth
```

## 7) Build and Validation Commands

Core workflows:

```bash
npm run dev
npm run dev:web
npm run dev:admin
npm run dev:api
npm run dev:workers
npm run build
npm run typecheck:all
```

Guardrails:

```bash
npm run validate:admin
npm run validate:admin:fast
npm run validate:pre-push
npm run validate:payments:core
```

Admin validation policy includes all of:

- `verify:roles`
- `verify:dashboard-pages`
- `verify:api-roles`

## 8) Delivery and Worker Guidance

Delivery ingest and adapters should preserve:

- Idempotent processing.
- Bounded retries.
- Dead-letter fallback path.

Integration script lanes:

```bash
npm run test:delivery:integration
npm run test:integration:scripts
npm run report:delivery:integration
```

## 9) Deployment Notes

All apps deploy on Vercel:

- Web: `backyard-bbq`
- Admin: `backyard-bbq-admin`
- API: `backyard-bbq-backend`

Serverless adapter behavior in API:

- Keep `fastify.server.emit("request", req, res)` integration.
- Keep `fastify-raw-body` on v4 for Fastify v4 compatibility.

## 10) Frontend Animation and Performance

Animation stack includes Framer Motion + Lenis.

- Prefer transform/opacity animations over layout properties.
- Avoid width/height animation where possible.
- Target smooth 60fps interactions.
- Keep mobile complexity reduced (especially particles/parallax).
- Respect reduced-motion accessibility settings.

## 11) Common Pitfalls to Avoid

- Do not mix dollars and cents in business logic.
- Do not bypass webhook signature validation or deduplication.
- Do not initialize critical SDK clients at module scope with empty fallback secrets in route handlers.
- Do not assume raw TCP DB checks are equivalent to Prisma readiness checks.
- Do not rely only on environment flags for preview behavior when host-based safeguards are required.
- Do not run local build/dev in conflicting ways that cause stale Next.js artifacts; clear `.next` when chunk/runtime mismatch appears.

## 12) Change Philosophy for Copilot

- Make the smallest safe change that satisfies the request.
- Preserve established APIs, route shapes, and existing env variable names unless asked to change them.
- Add or update tests when behavior changes.
- If uncertain, prefer explicit validation and fail-fast error handling over silent fallback.
