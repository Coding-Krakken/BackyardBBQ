# Platform Architecture

## System Topology

BackyardBBQ is a Turborepo monorepo with three deployable apps and shared packages:

| Workspace | Stack | Purpose |
|---|---|---|
| `apps/web` | Next.js 14 | Customer site: menu, checkout, catering, profile |
| `apps/admin` | Next.js 14 | Operations dashboard: payments, disputes, orders, integrations |
| `apps/api` | Fastify 4 | Dedicated webhook/metrics runtime (currently dormant for some paths) |
| `apps/workers` | Node.js | Background delivery channel and settlement tasks |
| `packages/database` | Prisma + PostgreSQL | Shared schema and client |
| `packages/domain` | TypeScript + Zod | Shared validation and domain contracts |
| `packages/delivery-channels` | TypeScript | Provider adapters: DoorDash, UberEats, GrubHub |

## Architecture Diagram

```mermaid
flowchart LR
  C[Customer Browser] --> W[apps/web]
  O[Ops User] --> A[apps/admin]
  W --> DB[(PostgreSQL)]
  A --> DB
  W --> S[(Stripe)]
  A --> S
  S --> API[apps/api webhook endpoints]
  API --> DB
  D[Delivery Providers] --> API
  API --> WRK[apps/workers]
  WRK --> DB
  W --> P1[@bbq/database]
  A --> P1
  WRK --> P1
```

## Runtime Boundaries

1. `apps/web` owns customer checkout orchestration and customer payment-method APIs.
2. `apps/admin` owns privileged operational APIs and role-gated dashboards.
3. `apps/api` centralizes webhook and health logic when activated by deployment path.
4. `apps/workers` handles async provider synchronization and settlement workflows.

## Shared Contracts

- Validation contracts: [packages/domain/src/index.ts](../packages/domain/src/index.ts)
- Prisma schema: [packages/database/prisma/schema.prisma](../packages/database/prisma/schema.prisma)
- Monorepo build graph: [turbo.json](../turbo.json)

## Critical Conventions

- Strict TypeScript mode enabled globally in [tsconfig.base.json](../tsconfig.base.json).
- `noUncheckedIndexedAccess` is enabled; indexed reads must be guarded.
- Monetary fields are integer cents (`subtotalCents`, `taxCents`, `tipCents`, `totalCents`).

## Related Pages

- [02-Payments-and-Stripe](02-Payments-and-Stripe.md)
- [03-Data-Model-and-Schema](03-Data-Model-and-Schema.md)
- [09-Deployment-Environments-and-Release](09-Deployment-Environments-and-Release.md)
