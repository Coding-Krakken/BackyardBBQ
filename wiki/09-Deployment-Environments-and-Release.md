# Deployment, Environments, and Release

## Deployment Targets

| App | URL |
|---|---|
| Web | https://backyard-bbq.vercel.app |
| Admin | https://backyard-bbq-admin.vercel.app |
| API | https://backyard-bbq-backend.vercel.app |

## Build and Deploy Commands

Core build:

```bash
npm run build
npm run typecheck:all
npm run validate:admin
```

## Required Runtime Baseline

- Node.js `>= 20`
- PostgreSQL reachable via `DATABASE_URL`
- Stripe key material for payment paths

## Environment Classes

| Class | Purpose |
|---|---|
| Local | Developer iteration and focused tests |
| Preview | Branch validation and pre-merge checks |
| Production | Customer and operations runtime |

## Deployment References

- [docs/THREE-APP-DEPLOYMENT.md](../docs/THREE-APP-DEPLOYMENT.md)
- [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)
- [vercel.json](../vercel.json)
- [apps/admin/vercel.json](../apps/admin/vercel.json)

## Release Checklist

1. Verify schema/client alignment.
2. Validate admin access-policy scripts.
3. Run payment integration replay checks for sensitive changes.
4. Confirm health endpoints and dashboard access after deploy.
