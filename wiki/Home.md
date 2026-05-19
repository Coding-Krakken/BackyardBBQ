# Backyard BBQ King Wiki

> Premium Texas-style smokehouse platform documentation for engineering, operations, and business stakeholders.

## Welcome

This wiki is the operational and technical source of truth for the BackyardBBQ platform.

### Platform Snapshot

| Area | What It Covers |
|---|---|
| Customer Experience | Ordering, checkout, menu, catering booking |
| Operations | Admin dashboard, refunds, disputes, delivery reconciliation |
| Platform Engineering | Monorepo architecture, API surfaces, data model, deployment |
| Reliability | Testing matrix, health checks, incident response runbooks |

## Jump By Audience

- Engineering and Platform: [01-Platform-Architecture](01-Platform-Architecture.md), [03-Data-Model-and-Schema](03-Data-Model-and-Schema.md), [09-Deployment-Environments-and-Release](09-Deployment-Environments-and-Release.md)
- Product and Features: [05-Feature-Guide-Menu-Checkout-Catering](05-Feature-Guide-Menu-Checkout-Catering.md), [02-Payments-and-Stripe](02-Payments-and-Stripe.md)
- Operations and Business: [06-Admin-Operations-Playbook](06-Admin-Operations-Playbook.md), [07-Delivery-Integrations](07-Delivery-Integrations.md), [10-Operations-Runbooks-and-Incident-Response](10-Operations-Runbooks-and-Incident-Response.md)
- QA and Governance: [08-Testing-and-Quality](08-Testing-and-Quality.md), [11-Contributing-Workflow](11-Contributing-Workflow.md)

## Core Principles

1. Money is always stored as cents in code and database.
2. Payment and webhook flows are idempotent first.
3. Role-based access controls are explicit and validated by scripts.
4. Operational runbooks are treated as production code.

## Wiki Map

1. [01-Platform-Architecture](01-Platform-Architecture.md)
2. [02-Payments-and-Stripe](02-Payments-and-Stripe.md)
3. [03-Data-Model-and-Schema](03-Data-Model-and-Schema.md)
4. [04-Authentication-and-RBAC](04-Authentication-and-RBAC.md)
5. [05-Feature-Guide-Menu-Checkout-Catering](05-Feature-Guide-Menu-Checkout-Catering.md)
6. [06-Admin-Operations-Playbook](06-Admin-Operations-Playbook.md)
7. [07-Delivery-Integrations](07-Delivery-Integrations.md)
8. [08-Testing-and-Quality](08-Testing-and-Quality.md)
9. [09-Deployment-Environments-and-Release](09-Deployment-Environments-and-Release.md)
10. [10-Operations-Runbooks-and-Incident-Response](10-Operations-Runbooks-and-Incident-Response.md)
11. [11-Contributing-Workflow](11-Contributing-Workflow.md)
12. [12-Glossary-and-FAQ](12-Glossary-and-FAQ.md)
13. [13-API-Reference](13-API-Reference.md)
14. [14-Environment-Variables-and-Secrets](14-Environment-Variables-and-Secrets.md)
15. [15-Architecture-Appendix](15-Architecture-Appendix.md)
16. [16-Role-Permission-Matrix](16-Role-Permission-Matrix.md)

## Source Anchors

- [README.md](../README.md)
- [.github/copilot-instructions.md](../.github/copilot-instructions.md)
- [docs/THREE-APP-DEPLOYMENT.md](../docs/THREE-APP-DEPLOYMENT.md)
- [docs/STRIPE-FEATURES.md](../docs/STRIPE-FEATURES.md)

## Governance

- Last validated: 2026-05-18
- Owners: Platform Engineering, Payments, Operations
- Review cadence: monthly and after payment/auth/deployment changes
