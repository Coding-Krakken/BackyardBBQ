# EPOS Now Integration and Operations

This document summarizes the EPOS Now API v4 integration across web, admin, and API services.

## Implemented Features

### Checkout and Payment Processing
- EPOS embedded payment flow for order checkout
- Server-side transaction creation and verification
- Transaction ID prefixing with `epos_txn_` for internal tracking
- Real-time transaction status synchronization

### Catering Deposits
- EPOS-based catering booking deposit flow
- Booking-linked payment metadata for deposit and final payment tracking
- Deposit amount validation and transaction creation

### Admin Operations

#### Refunds
- Manual refund queue via integration events
- Transaction-scoped partial/full refunds with reason capture
- Refund request recording with admin role validation (admin, owner, accounting)
- EPOS refund processing via manual operational workflow

#### Disputes
- Dispute tracking via integration events
- Dispute review workflows with status updates
- Evidence recording and submission tracking
- Manual dispute resolution process

### Analytics and Reporting
- Admin payment analytics endpoint with EPOS transaction aggregation
- Customer payment history with EPOS transaction details
- Operational payment metrics endpoint (JSON and Prometheus formats)
- Revenue tracking by source and time period

## Webhook Handling

EPOS webhook processing is implemented in [apps/api/src/index.ts](apps/api/src/index.ts) and [apps/api/src/webhook/epos-handler.ts](apps/api/src/webhook/epos-handler.ts).

### Supported Events
- `epos.webhook.CompleteTransaction` - Payment completion
- `epos.webhook.RefundTransaction` - Refund completion
- `epos.webhook.VoidTransaction` - Transaction void/cancellation
- Custom dispute events for chargeback notifications

### Webhook Security
- HMAC signature verification (SHA-256)
- Request body integrity validation
- Signature header: `X-EPOS-Signature`

### Durability and Safety Controls
- In-memory duplicate suppression with configurable TTL
- Persisted duplicate suppression using EPOS event IDs in integration events
- Per-IP rate limiting on webhook ingress (default 100 requests/minute)
- Optional EPOS webhook IP allowlisting
- Transaction idempotency via event ID tracking

### Event Processing Pipeline
1. Signature verification
2. IP allowlist check (if configured)
3. Rate limit validation
4. In-memory duplicate check
5. Persisted duplicate check
6. Event handler dispatch
7. Integration event persistence
8. Payment transaction creation/update

## Correlation ID Tracing

Request-level correlation context for incident reconstruction:
- Incoming `X-Correlation-ID` or `X-Request-ID` is reused when present
- New UUID correlation ID generated when no inbound ID exists
- API responses include `X-Correlation-ID` for downstream propagation

Correlation IDs are persisted:
- `IntegrationEvent.correlationId`
- `PaymentTransaction.correlationId`
- `Order.correlationId`

Admin tracing endpoint:
- `GET /api/admin/integrations/correlation/:id`
- Returns matched integration events plus related payments and orders

## Operational Health Endpoints

Implemented in [apps/api/src/index.ts](apps/api/src/index.ts):
- `GET /api/health/epos` - EPOS API connectivity check
- `GET /api/health/webhook` - Webhook endpoint health

## Operational Alerting

Implemented in [apps/api/src/index.ts](apps/api/src/index.ts):
- Structured payment/dispute/refund operational logs
- Alert webhook delivery for critical failures
- Threshold-based alerts for dispute and refund rate breaches (30-day window)
- Pull-based metrics: `GET /api/metrics/payments?days=<N>&format=json|prometheus`

### Alert Types
- **Payment Failures**: Transaction creation/completion failures
- **Dispute Rate**: Threshold breach on dispute-to-payment ratio
- **Refund Rate**: Threshold breach on refund-to-payment ratio
- **Webhook Failures**: Signature verification, parsing, or processing errors

## Environment Variables

### Required
- `EPOS_NOW_API_KEY` - EPOS Now API key for transaction operations
- `EPOS_NOW_WEBHOOK_SECRET` - HMAC secret for webhook signature verification
- `DATABASE_URL` - PostgreSQL connection string

### Optional - Webhook Hardening
- `WEBHOOK_RATE_LIMIT_PER_MINUTE` (default: 100)
- `EPOS_NOW_WEBHOOK_ALLOWED_IPS` (comma-separated IP allowlist)
- `WEBHOOK_EVENT_TTL_MS` (default: 86400000 / 24 hours)

### Optional - Operational Alerting
- `PAYMENT_ALERT_WEBHOOK_URL` - Webhook URL for operational alerts
- `DISPUTE_RATE_ALERT_THRESHOLD` (default: 2%)
- `REFUND_RATE_ALERT_THRESHOLD` (default: 5%)
- `PAYMENT_ALERT_COOLDOWN_MS` (default: 1800000 / 30 minutes)

### Optional - Metrics Protection
- `METRICS_API_KEY` - API key for metrics endpoint access

## EPOS Now API Integration

### API Base URL
- Production: `https://api.eposnowhq.com/api/v4`

### Authentication
- Header: `Authorization: Basic <base64(API_KEY:)>`
- API key configured via `EPOS_NOW_API_KEY` environment variable

### Key Endpoints Used
- `POST /transactions` - Create payment transaction
- `GET /transactions/{id}` - Retrieve transaction status
- `POST /refunds` - Initiate refund (manual queue in current implementation)
- `GET /products` - Product catalog sync (future enhancement)

### Transaction States
- `pending` - Transaction initiated, awaiting completion
- `processing` - Transaction in progress
- `succeeded` - Transaction completed successfully
- `failed` - Transaction failed
- `canceled` - Transaction canceled
- `refunded` - Transaction fully refunded

### Error Handling
- Network failures: Retry with exponential backoff
- API errors: Log and alert, return user-friendly messages
- Webhook failures: Retry with TTL-based deduplication
- Rate limiting: Respect rate limits, queue requests if needed

## Payment Flow Architecture

### Customer Checkout Flow
1. User completes cart and proceeds to payment
2. Frontend calls `POST /api/payments/create-checkout-session`
3. Server creates `PaymentTransaction` record with `pending` status
4. Server returns EPOS transaction ID to frontend
5. Frontend redirects to EPOS payment page or embedded flow
6. User completes payment on EPOS interface
7. EPOS sends webhook to `POST /api/payments/webhook`
8. Webhook handler updates `PaymentTransaction` status
9. Frontend polls `GET /api/payments/verify-session` or receives redirect

### Refund Flow
1. Admin initiates refund from payments dashboard
2. Admin calls `POST /api/admin/payments/[transactionId]/refund`
3. Server creates `IntegrationEvent` with refund request details
4. Manual operator processes refund in EPOS dashboard
5. EPOS sends refund webhook
6. Webhook handler updates payment transaction status

## Database Schema Notes

### PaymentTransaction Fields
- `stripePaymentIntentId` - Repurposed for EPOS transaction IDs (prefixed with `epos_txn_`)
- `provider` - Set to `"epos"` for all new transactions
- `status` - Maps to EPOS transaction states
- `correlationId` - Request correlation ID for tracing

### Historical Data
- Legacy Stripe transactions preserved with `provider = "stripe"`
- Historical `stripePaymentIntentId` values kept intact for audit trail
- Admin dashboard displays provider-specific external links when available

## Incident Response Runbook

### Payment Webhook Failures
1. Check `GET /api/health/webhook` endpoint
2. Review webhook rate limit counters
3. Verify `EPOS_NOW_WEBHOOK_SECRET` is correctly configured
4. Check EPOS webhook IP against allowlist (if configured)
5. Review integration events for signature verification failures
6. Replay failed events using correlation ID trace

### Transaction Sync Issues
1. Query payment transaction by correlation ID
2. Check corresponding integration events
3. Verify EPOS transaction status via dashboard or API
4. Reconcile status mismatch and update local record if needed

### Refund Processing Delays
1. Check integration events for pending refund requests
2. Verify manual refund completed in EPOS dashboard
3. Confirm refund webhook received and processed
4. Update transaction status manually if webhook missed

## Monitoring and Metrics

### Key Metrics
- Transaction success rate (succeeded / total)
- Average transaction processing time
- Webhook processing latency
- Dispute rate (disputes / successful transactions)
- Refund rate (refunds / successful transactions)

### Prometheus Metrics Endpoint
- `GET /api/metrics/payments?format=prometheus&days=30`

### JSON Metrics Endpoint
- `GET /api/metrics/payments?format=json&days=30`

### Alert Thresholds
- Dispute rate > 2% (configurable)
- Refund rate > 5% (configurable)
- Transaction failure rate > 10%
- Webhook processing > 5s p95

## Future Enhancements

### Planned Features
- Real-time refund API integration (replace manual queue)
- Product catalog synchronization
- Inventory management integration
- Customer loyalty point tracking
- Multi-location support
- Enhanced dispute automation
- Saved payment methods (if EPOS tokenization becomes available)

### Performance Optimizations
- Webhook batch processing for high-volume periods
- Database indexing optimizations for correlation ID queries
- Caching layer for frequently accessed transaction data
- Async job queue for non-critical webhook processing

## Support and Troubleshooting

### Common Issues

**Webhook signature verification failures**
- Verify `EPOS_NOW_WEBHOOK_SECRET` matches EPOS dashboard configuration
- Check for whitespace or encoding issues in secret
- Confirm webhook payload hasn't been modified by proxies

**Transaction status not updating**
- Check webhook delivery logs in EPOS dashboard
- Verify webhook endpoint is publicly accessible
- Review integration events for processing errors
- Manually trigger status update via admin dashboard

**Refund not processing**
- Verify refund request created in integration events
- Check admin role has refund permissions
- Confirm EPOS refund manually completed
- Verify refund webhook received and processed

### Contact Information
- EPOS Now Support: support@eposnowhq.com
- EPOS Now Developer Docs: https://developer.eposnowhq.com
- Internal Engineering: #payments-engineering channel
