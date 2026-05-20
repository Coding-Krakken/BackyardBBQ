# Backend API - Fastify Server

**Status:** ⚠️ **DORMANT - Deployed but not actively used**  
**Deployment:** https://backyard-bbq-backend.vercel.app

## Current State

This Fastify API is deployed to Vercel but is **not currently integrated** with the frontend applications. Both the web app and admin dashboard use their own Next.js API routes instead.

### Why It Exists

This backend was created as part of the deployment architecture but was determined to be unnecessary for the current use case. It's being kept deployed for potential future needs.

### Verification

The API is operational and responds to health checks:

```bash
# Health check
curl https://backyard-bbq-backend.vercel.app/health
# Response: {"status":"ok","service":"api"}

# Database health
curl https://backyard-bbq-backend.vercel.app/api/payments/health
# Response: {"eposConfigured":true,"databaseConfigured":true}
```

## Architecture

- **Framework:** Fastify 4.28.1
- **Deployment:** Vercel Serverless
- **Database:** Shared PostgreSQL (same as frontend apps)
- **Routes:** 36 endpoints across orders, catering, payments, analytics, etc.

## When to Activate

Consider using this backend API when:

### 1. Mobile App Development
- iOS/Android apps need a REST API
- Can't use Next.js API routes from native apps
- Need consistent API interface across platforms

### 2. Public API
- Third-party integrations require stable API
- Need API versioning and documentation
- Want to expose services to external developers

### 3. Microservices Architecture
- Team grows and needs service separation
- Want to scale backend independently
- Need to use different tech stacks

### 4. Heavy Processing
- Computational tasks need independent scaling
- Long-running background jobs
- Queue processing, batch operations

## How to Activate

If you decide to use this backend:

1. **Update Frontend Apps:**
   ```typescript
   // Instead of local Next.js API routes
   const response = await fetch('/api/customer/orders');
   
   // Call backend API
   const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/orders`);
   ```

2. **Configure Environment Variables:**
   ```bash
   # Web app
   NEXT_PUBLIC_API_BASE_URL=https://backyard-bbq-backend.vercel.app
   
   # Admin app  
   NEXT_PUBLIC_API_BASE_URL=https://backyard-bbq-backend.vercel.app
   ```

3. **Handle Authentication:**
   - Backend needs to validate sessions
   - Share NEXTAUTH_SECRET across apps
   - Implement JWT or session validation

4. **Update CORS:**
   - Configure allowed origins in Fastify
   - Add frontend URLs to whitelist

## How to Deactivate

If you want to remove this deployment:

1. **Delete Vercel Project:**
   ```bash
   vercel project rm backyard-bbq-backend
   ```

2. **Remove Local Directory Link:**
   ```bash
   cd apps/api
   rm -rf .vercel
   ```

3. **Clean Up Environment Variables:**
   ```bash
   # Remove from web/admin apps
   vercel env rm NEXT_PUBLIC_API_BASE_URL production
   vercel env rm NEXT_PUBLIC_API_BASE_URL preview
   ```

## Available Endpoints

<details>
<summary>36 API routes (click to expand)</summary>

### Orders
- `POST /api/orders` - Create order
- `GET /api/admin/orders` - List orders (admin)
- `PATCH /api/admin/orders/:id/status` - Update order status (admin)

### Catering
- `POST /api/catering/bookings` - Create booking
- `GET /api/catering/availability` - Check availability
- `GET /api/admin/catering/bookings` - List bookings (admin)
- `PATCH /api/admin/catering/bookings/:id/status` - Update booking status (admin)

### Payments
- `POST /api/payments/webhook` - EPOS Now webhook handler
- `GET /api/payments/health` - Payment system health
- `GET /api/health/epos` - EPOS Now connectivity check
- `GET /api/health/webhook` - Last EPOS webhook status check
- `POST /api/admin/payments/refunds` - Process refund (admin)
- `GET /api/admin/payments` - List payments (admin)
- `GET /api/admin/payments/disputes` - List disputes (admin)
- `PATCH /api/admin/payments/disputes/:id/review` - Review dispute (admin)

### Analytics
- `GET /api/admin/analytics/sales` - Sales analytics (admin)
- `GET /api/admin/analytics/forecast` - Revenue forecast (admin)
- `GET /api/admin/analytics/anomalies` - Detect anomalies (admin)

### Integrations
- `GET /api/admin/integrations` - List integration events (admin)
- `POST /api/admin/integrations/dead-letter/:id/retry` - Retry failed event (admin)

### Accounting
- `GET /api/admin/accounting/daily-close` - Get daily close summary (admin)
- `POST /api/admin/accounting/daily-close/finalize` - Finalize daily close (admin)
- `GET /api/admin/accounting/daily-close/export` - Export records (admin)

### Menu Management
- `GET /api/admin/menu/items` - List menu items (admin)
- `POST /api/admin/menu/items` - Create menu item (admin)
- `PATCH /api/admin/menu/items/:id` - Update menu item (admin)
- `DELETE /api/admin/menu/items/:id` - Delete menu item (admin)
- `GET /api/admin/menu/locations` - List locations (admin)
- `POST /api/admin/menu/locations` - Create location (admin)
- `PATCH /api/admin/menu/locations/:id` - Update location (admin)
- `DELETE /api/admin/menu/locations/:id` - Delete location (admin)

### Overview
- `GET /api/admin/overview` - Dashboard overview (admin)

### Metrics & Health
- `GET /api/health/stripe` - Stripe connectivity health check
- `GET /api/health/webhook` - Last Stripe webhook health/status check
- `GET /api/metrics/payments?days=30&format=json|prometheus` - Pull payment KPIs for monitoring (optional `x-metrics-key` header)

### Notifications
- `POST /api/admin/notifications` - Send notification (admin)

### Referrals
- `GET /api/admin/referrals` - List referrals (admin)
- `PATCH /api/admin/referrals/:id` - Update referral (admin)

</details>

## Technical Details

### Dependencies
- `fastify` ^4.28.1 - Web framework
- `@fastify/cors` - CORS support
- `fastify-raw-body` ^4.3.0 - Raw body parsing (Stripe webhooks)
- `@prisma/client` ^6.8.2 - Database ORM
- `stripe` - Payment processing
- `zod` - Request validation

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `STRIPE_SECRET_KEY` - Stripe API key (optional)
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification (optional)
- `PAYMENT_ALERT_WEBHOOK_URL` - Alert destination for payment/dispute incidents (optional)
- `DISPUTE_RATE_ALERT_THRESHOLD` - Dispute rate alert percentage threshold (optional, default 2)
- `REFUND_RATE_ALERT_THRESHOLD` - Refund rate alert percentage threshold (optional, default 5)
- `PAYMENT_ALERT_COOLDOWN_MS` - Alert deduplication cooldown in milliseconds (optional)
- `WEBHOOK_RATE_LIMIT_PER_MINUTE` - Stripe webhook request limit per IP per minute (optional, default 100)
- `STRIPE_WEBHOOK_ALLOWED_IPS` - Comma-separated IP allowlist for Stripe webhooks (optional; disabled when empty)
- `WEBHOOK_EVENT_TTL_MS` - Duplicate webhook event suppression window in milliseconds (optional, default 24h)
- `METRICS_API_KEY` - Optional API key required in `x-metrics-key` for `/api/metrics/payments`
- `VERCEL` - Auto-set by Vercel platform

### Build Process
```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Local development
npm run dev

# Deploy to Vercel
vercel deploy --prod
```

## Maintenance

### Webhook Reliability Notes
- Stripe webhook events are deduplicated in two layers:
   - In-memory cache for fast repeat suppression on the same instance.
   - Persisted lookup against recent Stripe integration events (same event type + `eventId` in payload) to reduce duplicate processing after cold starts/redeploys.

Even though dormant, this deployment:
- ✅ Incurs minimal cost (serverless, pay-per-request)
- ✅ Stays updated with Prisma schema changes (manual sync needed)
- ✅ Can be activated anytime without code changes
- ⚠️ Requires environment variable management
- ⚠️ Needs Prisma schema kept in sync with packages/database

---

**Last Updated:** May 15, 2026  
**Decision:** Keep deployed for flexibility, don't integrate unless needed
