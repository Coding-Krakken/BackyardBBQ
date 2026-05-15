# Three-App Deployment Architecture

**Date:** May 15, 2026  
**Status:** ✅ All deployments complete and verified  
**Architecture:** Self-contained Next.js apps with shared database

## Overview

The Backyard BBQ King platform is deployed as **two active Vercel projects** plus one dormant backend:

1. **Main Web App** - Customer-facing website with built-in API routes
2. **Admin Dashboard** - Staff operations interface with built-in API routes  
3. **Backend API** (Dormant) - Fastify API server deployed but not actively used

> **Note:** The backend API is deployed as a separate project but is **not currently integrated**. Both frontend apps use Next.js API routes for all functionality. The backend deployment is kept available for potential future use (mobile apps, public API, etc.).

## Deployment URLs

| Application | Production URL | Purpose |
|------------|----------------|---------|
| Web App | https://backyard-bbq.vercel.app | Customer ordering, catering requests, marketing |
| Admin Dashboard | https://backyard-bbq-admin.vercel.app | Staff operations, analytics, order management |
| Backend API | https://backyard-bbq-backend.vercel.app | Centralized API for complex operations |

## Architecture Details

### 1. Main Web App (backyard-bbq)

**Location:** `apps/web/`  
**Framework:** Next.js 14 (App Router)  
**Deployment:** Monorepo-aware build  
**Architecture:** Self-contained with built-in API routes

**Key Features:**
- Customer-facing homepage with animations
- Online ordering system
- Catering request forms
- User dashboard (orders, bookings, profile)
- Admin redirect (`/admin` → admin dashboard)
- **Built-in API routes:** `/api/customer/*`, `/api/auth/*`, `/api/support/*`

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection
- `NEXTAUTH_URL` - Auth callback URL
- `NEXTAUTH_SECRET` - Session encryption key
- `NEXT_PUBLIC_ADMIN_URL` - Admin dashboard URL (https://backyard-bbq-admin.vercel.app)
- `NEXT_PUBLIC_ENABLE_ANIMATIONS` - Animation toggle

**Build Configuration:**
```json
{
  "framework": "nextjs",
  "buildCommand": "npx prisma generate --schema=packages/database/prisma/schema.prisma && npx prisma db push --schema=packages/database/prisma/schema.prisma --skip-generate && npx tsx packages/database/prisma/make-admin.ts && npm run build -w @bbq/web",
  "outputDirectory": "apps/web/.next"
}
```

### 2. Admin Dashboard (backyard-bbq-admin)

**Location:** `apps/admin/`  
**Framework:** Next.js 14 (App Router)  
**Deployment:** Self-contained (no workspace dependencies)  
**Architecture:** Self-contained with built-in API routes

**Key Features:**
- Role-based access control (owner, admin, manager, staff, accounting)
- Real-time dashboard with SWR auto-refresh
- Order management (status updates, details)
- Catering bookings management
- Payment operations (refunds, disputes)
- Analytics and forecasting
- Menu management (items, categories, locations)
- Notification center
- Accounting tools (daily close, exports)
- **Built-in API routes:** `/api/admin/*` (30+ endpoints)

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection
- `NEXTAUTH_URL` - Auth callback URL (https://backyard-bbq-admin.vercel.app)
- `NEXTAUTH_SECRET` - Session encryption key

**Build Configuration:**
```json
{
  "framework": "nextjs",
  "buildCommand": "npx prisma generate && npm run build",
  "outputDirectory": ".next"
}
```

**Self-Contained Setup:**
- ✅ Local Prisma schema (`apps/admin/prisma/schema.prisma`)
- ✅ Local Prisma client (`apps/admin/lib/prisma.ts`)
- ✅ Direct dependencies (no workspace packages)
- ✅ Standalone TypeScript config - **DORMANT**

**Location:** `apps/api/`  
**Framework:** Fastify 4.28.1 (Serverless)  
**Deployment:** Self-contained with Vercel adapter  
**Status:** ⚠️ **Deployed but not actively used**

> **Current State:** This API is deployed and operational but is **not integrated** with the frontend apps. Both web and admin apps use their own Next.js API routes instead. This deployment is kept available for potential future use cases:
> - Mobile app development (iOS/Android)
> - Public API for third-party integrations
> - Microservices architecture evolution
> - Heavy computational tasks that need independent scaling

**Available Features (if activated)* Self-contained with Vercel adapter

**Key Features:**
- 36 API routes (orders, catering, payments, analytics, integrations, accounting)
- Stripe payment processing
- Zod request validation
- CORS configuration
- Database operations via Prisma

**Environment Variables:**
- `DATABASE_URL` - PostgreSQL connection
- `STRIPE_SECRET_KEY` - Stripe API key
- `STRIPE_WEBHOOK_SECRET` - Webhook signature verification
- `VERCEL` - Serverless mode flag

**Build Configuration:**
```json
{
  "buildCommand": "npx prisma generate",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api"
    }
  ]
}
```

**Serverless Adapter:**
```typescript
// apps/api/api/index.ts
import { buildApp } from "../src/index.js";

let fastify: FastifyInstance | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!fastify) {
    fastify = await buildApp();
    await fastify.ready();
  }
  fastify.server.emit("request", req, res);
}
```

**Self-Contained Setup:**
- ✅ Local Prisma schema (`apps/api/prisma/schema.prisma`)
- ✅ Local Prisma client (`apps/api/src/prisma.ts`)
- ✅ Direct dependencies (no workspace packages)
- ✅ Standalone TypeScript config
- ✅ fastify-raw-body v4.3.0 (compatible with Fastify v4)

## Verification Results

### Web App
```bash
$ curl -I https://backyard-bbq.vercel.app/admin
HTTP/1.1 308 Permanent Redirect
# Redirects to: https://backyard-bbq-admin.vercel.app
```

### Admin Dashboard
```bash
$ curl -s https://backyard-bbq-admin.vercel.app/auth/login | grep "title"
<title>Backyard BBQ King Admin</title>
```

### Backend API
```bash
$ curl -s https://backyard-bbq-backend.vercel.app/health
{"status":"ok","service":"api"}
```

## Database

**Provider:** PostgreSQL (Prisma Cloud)  
**Connection:** All three apps share the same database via `DATABASE_URL`

```
postgres://ffb94e0ed780acdb1ad5939b557eac58b8bc102f237441f66230b718ac84fb4c:sk_SVNNecQP3nePBJfz1iqKU@db.prisma.io:5432/postgres?sslmode=require
```

## Deployment Process

### Initial Setup (One-time)

1. **Create Vercel Projects:**
   ```bash
   vercel project add backyard-bbq
   vercel project add backyard-bbq-admin
   vercel project add backyard-bbq-backend
   ```

2. **Link Directories:**
   ```bash
   # Root → backyard-bbq
   cd C:\Users\david\Documents\BackyardBBQ
   vercel link --project backyard-bbq --yes
   
   # Admin → backyard-bbq-admin
   cd apps/admin
   vercel link --project backyard-bbq-admin --yes
   
   # API → backyard-bbq-backend
   cd apps/api
   vercel link --project backyard-bbq-backend --yes
   ```

3. **Configure Environment Variables:**
   ```bash
   # Backend API
   cd apps/api
   vercel env add DATABASE_URL production
   vercel env add DATABASE_URL preview
   
   # Admin Dashboard
   cd apps/admin
   vercel env add DATABASE_URL production
   vercel env add NEXTAUTH_SECRET production
   vercel env add NEXTAUTH_URL production
   vercel env add DATABASE_URL preview
   vercel env add NEXTAUTH_SECRET preview
   
   # Web App
   cd ../..
   vercel env add NEXT_PUBLIC_ADMIN_URL production
   vercel env add NEXT_PUBLIC_ADMIN_URL preview
   ```

### Deploying Updates

```bash
# Backend API
cd apps/api
vercel deploy --prod --yes

# Admin Dashboard
cd apps/admin
vercel deploy --prod --yes

# Web App
cd ../..
vercel deploy --prod --yes
```

## Security Considerations

1. **Environment Variables:**
   - All secrets marked as sensitive in Vercel
   - Database credentials encrypted at rest
   - NextAuth secrets generated via `openssl rand -base64 32`

2. **Authentication:**
   - NextAuth.js with credentials provider
   - Role-based access control in admin app
   - Session-based authentication

3. **API Security:**
   - CORS configured for allowed origins
   - Request validation with Zod
   - Stripe webhook signature verification

## Monitoring

- **Vercel Dashboard:** Real-time deployment logs and metrics
- **Log Commands:**
  ```bash
  vercel logs --prod --since 5m
  vercel logs --prod --since 5m --expand
  ```

## Troubleshooting

### Issue: Workspace Dependencies Not Found
**Solution:** Make apps self-contained by copying Prisma schema and removing workspace dependencies.

### Issue: Fastify Plugin Version Mismatch
**Solution:** Use fastify-raw-body@^4.3.0 with Fastify v4 (not v5).

### Issue: Vercel Strips URL Paths
**Solution:** Use native Fastify HTTP emission pattern instead of @fastify/aws-lambda:
```Architecture Decision Record

### Why Self-Contained Apps?

**Decision:** Use Next.js API routes in each frontend app instead of a centralized backend.

**Rationale:**
- ✅ **Lower latency** - no extra network hop between frontend and backend
- ✅ **Simpler deployment** - fewer moving parts to manage
- ✅ **Easier debugging** - all code in one place per app
- ✅ **Better DX** - co-located API routes with UI components
- ✅ **Cost effective** - fewer Vercel projects to maintain

**Trade-offs:**
- ❌ Code duplication between web/admin apps (mitigated by shared database package)
- ❌ Harder to add mobile apps later (would need to extract API)
- ✅ But: Can migrate to centralized backend when/if needed

### When to Activate the Backend API

Consider switching to the centralized backend API when:
1. **Mobile app development starts** - iOS/Android apps need a REST API
2. **Public API needed** - third-party integrations require stable API
3. **Microservices required** - team grows and needs service separation
4. **Heavy processing** - computational tasks need independent scaling

## Next Steps

- [ ] Configure custom domains
- [ ] Set up monitoring alerts
- [ ] Implement error tracking (Sentry)
- [ ] Add performance monitoring
- [ ] Configure CDN for static assets
- [ ] Set up staging environments
- [ ] Implement CI/CD pipeline
- [ ] Add automated tests
- [ ] Configure database backups
- [ ] (Optional) Deactivate backend API deployment if not needed
- [ ] Implement error tracking (Sentry)
- [ ] Add performance monitoring
- [ ] Configure CDN for static assets
- [ ] Set up staging environments
- [ ] Implement CI/CD pipeline
- [ ] Add automated tests
- [ ] Configure database backups

## Maintenance

### Database Migrations
```bash
# From monorepo root
npx prisma migrate dev --schema=packages/database/prisma/schema.prisma
npx prisma generate --schema=packages/database/prisma/schema.prisma

# Copy updated schema to self-contained apps
cp packages/database/prisma/schema.prisma apps/admin/prisma/schema.prisma
cp packages/database/prisma/schema.prisma apps/api/prisma/schema.prisma
```

### Dependency Updates
```bash
# Update all workspaces
npm update

# Rebuild and redeploy
npm run build
vercel deploy --prod --yes
```

## Documentation Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Fastify Documentation](https://fastify.dev/)
- [Vercel Documentation](https://vercel.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tremor UI Components](https://tremor.so/docs)

---

**Last Updated:** May 15, 2026  
**Maintained By:** Development Team
