# Option C: Fix Database Connectivity — Action Plan

**Current Status:**
- ✅ Offline rollout: WORKS (Prisma clients generated successfully)
- ✅ TCP connectivity: db.prisma.io:5432 is reachable
- ❌ Strict rollout: FAILS with Prisma P1001 "Can't reach database server"

**Root Cause:**
Prisma CLI cannot connect to db.prisma.io despite TCP connectivity working. This suggests a Prisma-specific networking or credential issue.

---

## Diagnostic Steps (Do These First)

### 1. Check Prisma Database Status

Visit your Prisma Cloud console and verify:
- Database is **online** and accepting connections
- Your IP address is in the **IP whitelist**
- Credentials (username/password) are correct
- Project/database hasn't been suspended

**Console URL:** https://cloud.prisma.io (or check your account)

### 2. Verify IP Whitelist

Get your public IP:
```bash
curl https://ifconfig.io
```

Add it to Prisma Cloud database network access rules.

### 3. Test Connection String Format

Ensure your DATABASE_URL in `.env` is:
```
postgres://USER:PASSWORD@db.prisma.io:5432/DATABASE?sslmode=require
```

Common issues:
- ❌ Special characters in password not URL-encoded
- ❌ Mismatched database name
- ❌ Expired credentials

---

## Resolution Strategies (Pick One)

### Strategy 1: Use SSH Tunnel (Recommended if jump host available)

```bash
# Terminal 1: Start tunnel
ssh -N -L 5432:db.prisma.io:5432 USER@JUMP_HOST

# Terminal 2: Update DATABASE_URL temporarily
export DATABASE_URL="postgres://ffb94e0ed780acdb1ad5939b557eac58b8bc102f237441f66230b718ac84fb4c:sk_SVNNecQP3nePBJfz1iqKU@localhost:5432/postgres?sslmode=disable"

# Then run rollout
npm run db:rollout:onboarding:preflight
npm run db:rollout:onboarding
```

### Strategy 2: Use Local PostgreSQL Development Database

```bash
# Install and start Postgres
brew install postgresql@15
brew services start postgresql@15

# Create dev database
createdb backyard_bbq_dev
createuser bbq_dev --password

# Update .env
export DATABASE_URL="postgres://bbq_dev:DEVPASS@localhost:5432/backyard_bbq_dev?sslmode=disable"

# Run rollout
npm run db:rollout:onboarding:preflight
npm run db:rollout:onboarding
```

### Strategy 3: Verify and Fix Prisma Database Access

1. **Check database credentials:**
   ```bash
   # From Prisma console, copy exact connection string
   # Replace PASSWORD with actual password
   export DATABASE_URL="postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require"
   npm run db:diagnose
   ```

2. **Check database permissions:**
   - Verify user has `CREATEDB` and `CREATE SCHEMA` permissions
   - Or create schema manually in Prisma console first

3. **Check for connection restrictions:**
   - VPN required?
   - IP range restrictions?
   - Contact database administrator if not owner

### Strategy 4: Continue with Offline Mode + Manual DB Sync

```bash
# Generate clients (works, no DB needed)
npm run db:rollout:onboarding:offline

# Later, when DB is accessible:
npm run db:rollout:onboarding  # Run strict rollout
```

---

## Testing Each Strategy

After choosing a strategy, test with:

```bash
# 1. Run diagnostics
npm run db:diagnose

# 2. Run preflight (non-destructive)
npm run db:rollout:onboarding:preflight

# 3. If preflight passes, run full rollout
npm run db:rollout:onboarding
```

---

## If All Else Fails

**Option: Use Offline Mode Permanently**

The system is designed to work without strict DB rollout:

```bash
# This always works - clients are generated, db push is skipped
npm run db:rollout:onboarding:offline

# The onboarding feature will work at runtime via API
# Just won't have database schema migration from CLI
```

The schema can be deployed separately or manually through:
- Prisma Cloud console
- Prisma migrate via different environment
- Manual SQL execution

---

## Summary

| Strategy | Effort | Connectivity | Recommendation |
|----------|--------|--------------|-----------------|
| SSH Tunnel | Low | ✓ | If you have a jump host |
| Local Postgres | Medium | ✓ | If staying in dev environment |
| Fix Prisma DB | Medium | ✓ | For production/staging |
| Offline Mode | None | ✗ | Always works, use as fallback |

**Current Recommendation:** 
1. Check Prisma Cloud database status (5 min)
2. If DB is online and whitelist is correct, try Strategy 2 (local Postgres) or Strategy 1 (SSH tunnel)
3. If blocked, use offline mode + manual schema deployment
