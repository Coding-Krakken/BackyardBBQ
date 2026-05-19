# Role Permission Matrix

## Roles

- owner
- admin
- manager
- staff
- accounting

Source of truth: [apps/admin/lib/roles.ts](../apps/admin/lib/roles.ts)

## Capability Matrix

| Capability | owner | admin | manager | staff | accounting |
|---|---|---|---|---|---|
| Access orders | yes | yes | yes | yes | no |
| Access bookings | yes | yes | yes | yes | no |
| Access customers | yes | yes | yes | no | no |
| Access menu | yes | yes | yes | no | no |
| Access analytics | yes | yes | yes | no | no |
| Access accounting | yes | yes | no | no | yes |
| Access payments | yes | yes | no | no | yes |
| Access integrations | yes | yes | no | no | no |
| Access notifications | yes | yes | no | no | no |
| Access referrals | yes | yes | no | no | no |
| Finalize accounting | yes | no | no | no | no |
| Manage locations | yes | no | no | no | no |
| Manage staff | yes | yes | no | no | no |

## Hierarchy Levels

| Role | Level |
|---|---|
| owner | 5 |
| admin | 4 |
| manager | 3 |
| staff | 2 |
| accounting | 2 |

## Policy Enforcement Layers

1. Middleware/session auth checks.
2. Route-level `requireAdmin([...])` authorization constraints.
3. Static policy config verification scripts.

## Verification Commands

```bash
npm run verify:roles -w @bbq/admin
npm run verify:dashboard-pages -w @bbq/admin
npm run verify:api-roles -w @bbq/admin
```

## Change Protocol

When role permissions change:

1. Update role constants.
2. Update policy config files.
3. Run all three verification scripts.
4. Update this matrix page.

## Related

- [04-Authentication-and-RBAC](04-Authentication-and-RBAC.md)
- [06-Admin-Operations-Playbook](06-Admin-Operations-Playbook.md)
