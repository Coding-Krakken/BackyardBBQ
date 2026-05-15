# Deployment Guide

## Overview
This guide covers the deployment process for the BackyardBBQ application with the new animation system and improvements.

## Pre-Deployment Checklist

### 1. Code Quality
```bash
# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run tests
npm run test

# Generate coverage report
npm run test:coverage
```

### 2. Build Verification
```bash
# Build all packages
npm run build

# Analyze bundle size
npm run analyze
```

### 3. Environment Variables

#### Required Variables
```bash
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="https://your-production-domain.com"

# Stripe
STRIPE_SECRET_KEY="sk_live_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
```

#### Optional Variables
```bash
# Feature Flags
NEXT_PUBLIC_ENABLE_ANIMATIONS="true"  # Default: true

# Analytics (future)
NEXT_PUBLIC_GA_MEASUREMENT_ID=""

# Error Tracking (future)
NEXT_PUBLIC_SENTRY_DSN=""
SENTRY_AUTH_TOKEN=""
```

## Vercel Deployment

### Initial Setup
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link project
vercel link
```

### Set Environment Variables
```bash
# Set production variables
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production
vercel env add STRIPE_SECRET_KEY production

# Set preview variables (same values or different)
vercel env add DATABASE_URL preview
vercel env add NEXTAUTH_SECRET preview
vercel env add NEXTAUTH_URL preview

# Set development variables
vercel env add DATABASE_URL development
```

### Deploy to Preview
```bash
# Deploy current branch to preview
vercel

# Deploy specific branch
vercel --branch feat/modernization
```

### Deploy to Production
```bash
# Deploy to production
vercel --prod

# Or use Git integration (automatic on merge to main)
git checkout main
git merge feat/modernization
git push origin main
```

## Build Configuration

### Vercel Configuration (vercel.json)
```json
{
  "buildCommand": "prisma generate && npm run build",
  "framework": "nextjs",
  "installCommand": "npm install",
  "regions": ["iad1"],
  "env": {
    "NEXT_PUBLIC_ENABLE_ANIMATIONS": "true"
  },
  "build": {
    "env": {
      "DATABASE_URL": "@database_url"
    }
  }
}
```

### Next.js Configuration
Ensure proper configuration in `next.config.mjs`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode
  reactStrictMode: true,
  
  // Optimize images
  images: {
    domains: ['your-cdn-domain.com'],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Bundle analyzer (only in development)
  ...(process.env.ANALYZE === 'true' && {
    webpack: (config) => {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: true,
        })
      );
      return config;
    },
  }),
};

export default nextConfig;
```

## Database Migrations

### Prisma Setup
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database (optional)
npx prisma db seed
```

### Production Migration Strategy
1. **Test migrations locally:**
   ```bash
   npx prisma migrate dev
   ```

2. **Review migration SQL:**
   ```bash
   cat prisma/migrations/[timestamp]_[name]/migration.sql
   ```

3. **Deploy migrations:**
   ```bash
   # In Vercel, migrations run automatically via build command
   # Or manually:
   vercel env pull .env.production
   npx prisma migrate deploy
   ```

## Rollback Procedures

### Quick Rollback (Disable Animations)
If animations cause issues:
```bash
# Disable via environment variable
vercel env rm NEXT_PUBLIC_ENABLE_ANIMATIONS production
vercel env add NEXT_PUBLIC_ENABLE_ANIMATIONS production
# Enter: false

# Redeploy
vercel --prod
```

### Full Rollback
```bash
# Rollback to previous deployment
vercel rollback

# Or rollback to specific deployment
vercel rollback [deployment-url]
```

### Database Rollback
```bash
# Prisma doesn't support automatic rollback
# Manual process required:

1. # Identify migration to rollback
   ls prisma/migrations

2. # Create manual down migration
   CREATE MIGRATION FILE manually

3. # Apply down migration
   npx prisma db execute --file ./rollback.sql
```

## Monitoring

### Post-Deployment Checks

#### 1. Health Checks
```bash
# Check homepage
curl https://your-domain.com

# Check API health
curl https://your-domain.com/api/health

# Check database connection
curl https://your-domain.com/api/db-check
```

#### 2. Performance Checks
- Lighthouse audit: https://web.dev/measure/
- Web Vitals: Check Vercel Analytics
- Bundle size: Compare with previous deployment

#### 3. Error Monitoring
- Check Vercel logs: `vercel logs`
- Monitor error rates
- Check Sentry (if configured)

### Performance Targets
- Lighthouse Score: >90
- First Contentful Paint: <1.8s
- Largest Contentful Paint: <2.5s
- Cumulative Layout Shift: <0.1
- First Input Delay: <100ms
- Time to Interactive: <3.8s

## Gradual Rollout Strategy

### Phase 1: Preview (Week 1)
- Deploy to preview environment
- Internal testing
- Stakeholder review
- Monitor metrics

### Phase 2: Canary (Week 2)
- Deploy to 10% of production traffic
- Monitor error rates
- Check performance metrics
- Gather user feedback

### Phase 3: Full Rollout (Week 3+)
- Increase to 50% traffic
- Monitor for 48 hours
- If stable, increase to 100%

### Implementation (using Vercel)
```bash
# Deploy to preview
vercel

# Deploy to production with gradual rollout
# (Requires Vercel Pro/Enterprise)
vercel --prod

# Monitor and adjust traffic split in Vercel dashboard
```

## Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build

# Check Prisma
npx prisma generate
npx prisma validate
```

#### 2. Animation Performance Issues
```bash
# Disable animations temporarily
vercel env add NEXT_PUBLIC_ENABLE_ANIMATIONS=false production
vercel --prod

# Check bundle size
npm run analyze

# Verify GPU acceleration in DevTools
```

#### 3. Database Connection Issues
```bash
# Verify connection string
npx prisma db pull

# Check firewall rules
# Ensure Vercel IPs are whitelisted

# Test connection
npx prisma db execute --stdin <<< "SELECT 1"
```

#### 4. Environment Variable Issues
```bash
# List all variables
vercel env ls

# Pull variables locally
vercel env pull .env.local

# Verify variables in deployment
vercel inspect [deployment-url]
```

## Performance Optimization

### CDN Configuration
- Enable Vercel Edge Network
- Configure caching headers
- Optimize image delivery

### Database Optimization
- Enable connection pooling
- Use prepared statements
- Implement query caching
- Add database indices

### Bundle Optimization
```bash
# Analyze bundle
npm run analyze

# Check for duplicate dependencies
npx npm-check-duplicates

# Tree shaking verification
# Review webpack bundle analyzer output
```

## Security Checklist

- [ ] All secrets in environment variables
- [ ] No hardcoded API keys
- [ ] HTTPS enforced
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] SQL injection protection (Prisma)
- [ ] XSS protection (React)
- [ ] CSRF tokens for mutations
- [ ] Security headers configured
- [ ] Dependencies up to date

## Compliance

### GDPR/Privacy
- [ ] Cookie consent implemented
- [ ] Privacy policy updated
- [ ] Data retention policy configured
- [ ] User data export capability
- [ ] User data deletion capability

### Accessibility
- [ ] WCAG 2.1 AA compliance verified
- [ ] Screen reader testing completed
- [ ] Keyboard navigation verified
- [ ] Color contrast checked
- [ ] Reduced motion supported

## Support

### Resources
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)

### Emergency Contacts
- DevOps Lead: [contact]
- Database Admin: [contact]
- Security Team: [contact]

---

**Last Updated:** 2026-05-15  
**Version:** 1.0.0
