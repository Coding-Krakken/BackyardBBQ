# Onboarding Database Rollout — Connectivity Resolution

## Current Status

- **Database Host:** `db.prisma.io:5432` (Prisma Cloud PostgreSQL)
- **Environment:** SSH remote at `100.119.155.92`
- **Blocker:** Direct connection to database is blocked (likely firewall/IP restrictions)
- **Workaround:** Offline rollout mode works; `npm run db:rollout:onboarding:offline` succeeds

## Resolution Strategies

Choose one approach based on your infrastructure setup.

---

## Option 1: SSH Port Forwarding (Recommended for Remote Dev)

**Use this if:** You have SSH access to a jump host that can reach the database.

### Setup

Create an SSH tunnel to forward local port 5432 to the remote database:

```bash
# Terminal 1: Start the tunnel (replace USER@JUMP_HOST)
ssh -N -L 5432:db.prisma.io:5432 USER@JUMP_HOST

# Or with timeout and auto-reconnect:
while true; do
  ssh -N -L 5432:db.prisma.io:5432 USER@JUMP_HOST
  sleep 5
done
```

### Apply to Rollout

Once the tunnel is active (port 5432 listening locally):

```bash
# Update .env to use localhost tunnel
export DATABASE_URL="postgres://ffb94e0ed780acdb1ad5939b557eac58b8bc102f237441f66230b718ac84fb4c:sk_SVNNecQP3nePBJfz1iqKU@localhost:5432/postgres?sslmode=require"

# Verify tunnel connectivity
npm run db:rollout:onboarding:preflight

# Run rollout (strict mode)
npm run db:rollout:onboarding
```

### Troubleshooting SSH Tunnel

```bash
# Check if tunnel is active
netstat -tuln | grep 5432
# or (macOS):
lsof -i :5432

# Test connectivity through tunnel
psql postgres://ffb94e0ed780acdb1ad5939b557eac58b8bc102f237441f66230b718ac84fb4c:sk_SVNNecQP3nePBJfz1iqKU@localhost:5432/postgres?sslmode=require -c "SELECT 1"
```

---

## Option 2: Local PostgreSQL for Development

**Use this if:** You prefer a local database for dev/test cycles.

### Setup

```bash
# Install PostgreSQL locally (macOS)
brew install postgresql

# Or (Ubuntu/Debian)
sudo apt-get install postgresql postgresql-contrib

# Start local Postgres
brew services start postgresql  # macOS
# or
sudo systemctl start postgresql  # Linux

# Create a test database
createdb backyard_bbq_dev
psql -c "CREATE USER bbq_dev WITH PASSWORD 'dev_password_change_me';"
psql -c "ALTER DATABASE backyard_bbq_dev OWNER TO bbq_dev;"
```

### Apply to Rollout

Create a `.env.local` or modify `.env`:

```bash
# Use local database for development
export DATABASE_URL="postgres://bbq_dev:dev_password_change_me@localhost:5432/backyard_bbq_dev"

# Verify preflight
npm run db:rollout:onboarding:preflight

# Run rollout (strict mode)
npm run db:rollout:onboarding
```

---

## Option 3: Configure IP Whitelist on Prisma Database

**Use this if:** The database owner has already whitelisted other IPs.

### Steps

1. **Get this environment's public IP:**
   ```bash
   curl -s https://ifconfig.io
   # or
   curl -s https://api.ipify.org
   ```

2. **Provide IP to database owner** for Prisma Cloud firewall whitelist (usually in Prisma console under "Network Access").

3. **Once whitelisted, verify and run rollout:**
   ```bash
   npm run db:rollout:onboarding:preflight
   npm run db:rollout:onboarding
   ```

---

## Option 4: Use Alternative Database Host

**Use this if:** You have access to a different PostgreSQL instance.

### Apply to Rollout

Update DATABASE_URL in `.env`:

```bash
export DATABASE_URL="postgres://user:password@alternative-host.example.com:5432/dbname"

# Verify connectivity
npm run db:rollout:onboarding:preflight

# Run rollout (strict mode)
npm run db:rollout:onboarding
```

---

## Option 5: Continue with Offline Mode (Current Workaround)

**Use this if:** You want to proceed without strict DB migration right now.

### Current Behavior

```bash
# Generates Prisma clients ✓
# Skips db push (graceful degradation) ✓
npm run db:rollout:onboarding:offline
```

### When DB Becomes Reachable

Switch to strict mode:

```bash
npm run db:rollout:onboarding:preflight   # Validate connectivity first
npm run db:rollout:onboarding              # Run strict rollout
```

---

## Rollout Command Reference

| Command | Behavior |
|---------|----------|
| `npm run db:rollout:onboarding:preflight` | Validate DB connectivity only (non-destructive Prisma check) |
| `npm run db:rollout:onboarding` | Full rollout (generate + db push) — **fails if DB unreachable** |
| `npm run db:rollout:onboarding:offline` | Partial rollout (generate only) — **skips db push** |

---

## Quick Diagnostics

### Test Database Connectivity

```bash
# Check if port is reachable (non-Prisma)
timeout 5 bash -c 'echo > /dev/tcp/db.prisma.io/5432' && echo "Port reachable" || echo "Port blocked"

# Check with Prisma (requires CONNECTION_URL in process.env)
npm run db:rollout:onboarding:preflight

# Manual Prisma connectivity test
DATABASE_URL="<your-db-url>" npm exec -w @bbq/database prisma -- db pull --schema=prisma/schema.prisma --print
```

### Check Network/Firewall

```bash
# Inspect network from this environment
curl -s https://ifconfig.io          # Your public IP
echo $SSH_CLIENT                     # SSH connection source
env | grep -i proxy                  # Check for proxy settings
```

---

## Recommended Next Steps

1. **Immediate:** Continue using `npm run db:rollout:onboarding:offline` for development (already works).

2. **Short-term:** Pick one of the five options above and test preflight:
   ```bash
   npm run db:rollout:onboarding:preflight
   ```

3. **Production:** Ensure strict rollout runs where database is accessible:
   ```bash
   npm run db:rollout:onboarding
   ```

---

## Support

If you hit other issues:
- Check `.env` DATABASE_URL format is correct
- Verify Prisma credentials have sufficient permissions
- Confirm firewall/VPN rules allow egress to `db.prisma.io:5432`
- Review Prisma Cloud console for rate limits or access logs
