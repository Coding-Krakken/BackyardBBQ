# Environment Variables and Secrets

## Usage Policy

1. Never commit live secrets.
2. Validate required variables at startup for sensitive paths.
3. Keep operational defaults explicit and documented.

## Core Runtime Variables

| Variable | Scope | Purpose |
|---|---|---|
| `DATABASE_URL` | web/admin/api/workers | PostgreSQL connection |
| `STRIPE_SECRET_KEY` | web/admin/api/scripts | Stripe server-side API access |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | web | Stripe client integration |
| `STRIPE_WEBHOOK_SECRET` | api/scripts | Stripe webhook signature validation |
| `NEXTAUTH_SECRET` | web/admin | Session signing key |
| `NEXT_PUBLIC_SITE_URL` | web | Canonical frontend URL for callback/return links |

## Checkout and Tax

| Variable | Default | Notes |
|---|---|---|
| `SALES_TAX_RATE` | `0.08` | Used in checkout and tax routes |

## Delivery Provider Variables

| Variable Group | Examples |
|---|---|
| DoorDash routing/tokens | `DOORDASH_WEBHOOK_*`, `DOORDASH_*_WEBHOOK_TOKEN`, `DOORDASH_WEBHOOK_SECRET`, `DOORDASH_API_BASE_URL`, `DOORDASH_DEVELOPER_ID` |
| UberEats routing/identity | `UBEREATS_WEBHOOK_*`, `UBEREATS_*_WEBHOOK_UUID`, `UBEREATS_WEBHOOK_SECRET`, `UBEREATS_API_BASE_URL` |
| GrubHub routing/secrets | `GRUBHUB_WEBHOOK_*`, `GRUBHUB_WEBHOOK_SECRET`, `GRUBHUB_API_BASE_URL` |
| Generic integration scripts | `DELIVERY_CHANNEL`, `DELIVERY_WEBHOOK_SECRET`, `DELIVERY_WEBHOOK_TOKEN` |

## Alerting and Monitoring

| Variable | Purpose |
|---|---|
| `PAYMENT_ALERT_WEBHOOK_URL` | External alert destination for payment anomalies |
| `DISPUTE_RATE_ALERT_THRESHOLD` | Alert threshold for disputes |
| `REFUND_RATE_ALERT_THRESHOLD` | Alert threshold for refunds |
| `PAYMENT_ALERT_COOLDOWN_MS` | Alert suppression window |
| `DATA_INTEGRITY_ALERT_WEBHOOK_URL` | Data-integrity incident webhook |
| `METRICS_API_KEY` | Optional auth for metrics endpoint |

## Webhook and Security Controls

| Variable | Purpose |
|---|---|
| `WEBHOOK_RATE_LIMIT_PER_MINUTE` | Ingress protection |
| `WEBHOOK_EVENT_TTL_MS` | Event dedupe TTL |
| `STRIPE_WEBHOOK_ALLOWED_IPS` | Optional source allowlist |
| `DELIVERY_SETTLEMENT_IDEMPOTENCY_WINDOW_MS` | Settlement replay/duplication control |
| `INCIDENT_PACKAGE_SIGNING_SECRET` | Signing secret for incident package exports |
| `INCIDENT_PACKAGE_SIGNING_KEY_ID` | Identifier for incident package signing key |

## Public/UX Variables

Selected examples from web content and navigation:

- `NEXT_PUBLIC_ADMIN_URL`
- `NEXT_PUBLIC_ORDER_ONLINE_URL`
- `NEXT_PUBLIC_DOORDASH_URL`
- `NEXT_PUBLIC_UBER_EATS_URL` / `NEXT_PUBLIC_UBEREATS_URL`
- `NEXT_PUBLIC_GRUBHUB_URL`
- `NEXT_PUBLIC_CATERING_INQUIRY_URL`
- `NEXT_PUBLIC_PHONE`, `NEXT_PUBLIC_EMAIL`, `NEXT_PUBLIC_LOCATION`, `NEXT_PUBLIC_HOURS`
- `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_FACEBOOK_URL`, `NEXT_PUBLIC_X_URL`
- `NEXT_PUBLIC_ENABLE_ANIMATIONS`
- `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GTM_ID`

## Script and CI Variables

| Variable | Use |
|---|---|
| `API_BASE_URL` | Integration and replay scripts |
| `ADMIN_BASE_URL` | Settlement replay script support |
| `WEBHOOK_PATH`, `DISPUTES_PATH`, `ADMIN_ROLE` | Stripe replay scripts |
| `GITHUB_STEP_SUMMARY` | CI summary output |
| `SKIP_DATA_INTEGRITY` | Optional skip for validation script |
| `ROLL_OUT_ALLOW_OFFLINE`, `DB_CONNECT_TIMEOUT_MS` | DB rollout tooling |

## Rotation and Audit Guidance

1. Rotate Stripe and webhook secrets on schedule and after any leak suspicion.
2. Verify post-rotation health endpoints and replay tests.
3. Keep per-environment secret inventories in deployment platform secret stores.

## Related

- [09-Deployment-Environments-and-Release](09-Deployment-Environments-and-Release.md)
- [10-Operations-Runbooks-and-Incident-Response](10-Operations-Runbooks-and-Incident-Response.md)
