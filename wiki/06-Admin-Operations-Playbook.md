# Admin Operations Playbook

## Dashboard Operating Domains

Admin routes include the following major domains:

- orders
- payments
- customers
- catering
- menu
- integrations
- analytics
- accounting
- notifications

Source root: [apps/admin/app/api/admin](../apps/admin/app/api/admin)

## Daily Operations Rhythm

1. Validate dashboard health and integration status.
2. Review pending disputes and refunds.
3. Reconcile payments and settlement anomalies.
4. Review catering pipeline and order throughput.

## Payments Desk

| Operation | Path |
|---|---|
| Issue refunds | `payments/[transactionId]/refund` |
| Read disputes | `payments/disputes` |
| Submit dispute evidence | `payments/disputes/[id]/evidence` |

## Integration Desk

| Operation | Path |
|---|---|
| Integration health | `integrations/health` |
| Contracts and correlation diagnostics | `integrations/contracts` |
| Settlement reporting | `integrations/settlements` |

## Governance Checklist

- Confirm role compliance for newly added routes.
- Ensure accounting actions are only exposed to authorized roles.
- Log all high-risk operations (refunds, dispute submissions, reconciliations).

## Source Anchors

- [apps/admin/lib/requireAdmin.ts](../apps/admin/lib/requireAdmin.ts)
- [apps/admin/lib/dashboardAccess.ts](../apps/admin/lib/dashboardAccess.ts)
- [docs/DEPLOYMENT-SUMMARY.md](../docs/DEPLOYMENT-SUMMARY.md)
