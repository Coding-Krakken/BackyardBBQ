# Authentication and RBAC

## Authentication Surfaces

| Surface | Mechanism | Session TTL |
|---|---|---|
| Customer Web | NextAuth Credentials (`apps/web/lib/auth.ts`) | 30 days |
| Admin Dashboard | NextAuth + middleware + role policies | 8 hours (per project conventions) |

## Customer Auth Flow

1. User submits credentials.
2. `prisma.customer.findUnique` resolves account.
3. `bcryptjs.compare` validates password hash.
4. JWT contains `id` and `role`; session receives both fields.

Source: [apps/web/lib/auth.ts](../apps/web/lib/auth.ts)

## Admin Role Model

Roles defined in [apps/admin/lib/roles.ts](../apps/admin/lib/roles.ts):

- owner
- admin
- manager
- staff
- accounting

## Permission Domains

| Permission | owner | admin | manager | staff | accounting |
|---|---|---|---|---|---|
| Orders | yes | yes | yes | yes | no |
| Payments | yes | yes | no | no | yes |
| Accounting | yes | yes | no | no | yes |
| Integrations | yes | yes | no | no | no |
| Staff management | yes | yes | no | no | no |

## Policy Validation Guards

- API access policy file: [apps/admin/config/api-access-rules.json](../apps/admin/config/api-access-rules.json)
- Dashboard access policy file: [apps/admin/config/dashboard-page-access-rules.json](../apps/admin/config/dashboard-page-access-rules.json)
- Verification commands:

```bash
npm run verify:roles -w @bbq/admin
npm run verify:dashboard-pages -w @bbq/admin
npm run verify:api-roles -w @bbq/admin
```

## Operational Guidance

- Never grant `owner` casually; it includes accounting finalization and staff/location controls.
- Keep admin policy configs versioned and reviewed like source code.
