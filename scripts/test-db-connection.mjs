#!/usr/bin/env node

/**
 * Direct test of PostgreSQL connection using the DATABASE_URL from .env
 * Helps diagnose P1001 errors that Prisma reports
 */

import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';

const envPath = path.resolve(process.cwd(), '.env');

// Extract DATABASE_URL from .env
let dbUrl = process.env.DATABASE_URL;
if (!dbUrl && fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const line = content.split('\n').find(l => l.trim().startsWith('DATABASE_URL='));
  if (line) {
    dbUrl = line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
}

if (!dbUrl) {
  console.error('ERROR: DATABASE_URL not found in environment or .env');
  process.exit(1);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  PostgreSQL Direct Connection Test');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('🔗 Connection String (redacted):');
const redacted = dbUrl.replace(/:(.*?)@/, ':***@');
console.log(`   ${redacted}\n`);

// Test 1: Try with psql
console.log('📋 Test 1: Connection with psql');
exec(`psql "${dbUrl}" -c "SELECT version();"`, { timeout: 10000 }, (error, stdout, stderr) => {
  if (error) {
    if (stderr.includes('invalid sslmode')) {
      console.log('   ✗ SSL mode error: Connection string may need quotes around sslmode');
      console.log(`     Error: ${stderr.split('\n')[0]}`);
    } else if (stderr.includes('connection refused')) {
      console.log('   ✗ Connection refused: Database server not responding');
    } else if (stderr.includes('authentication failed')) {
      console.log('   ✗ Authentication failed: Invalid credentials');
    } else {
      console.log(`   ✗ Error: ${stderr.split('\n')[0]}`);
    }
  } else {
    console.log('   ✓ Connected successfully!');
    console.log(`     ${stdout.split('\n')[0]}`);
  }

  // Test 2: Try with pg CLI if available
  console.log('\n📋 Test 2: Connection with node-postgres (pg)');
  const testScript = `
    import pg from 'pg';
    const url = process.argv[1];
    const client = new pg.Client(url);
    client.connect()
      .then(() => {
        console.log('   ✓ Connected successfully!');
        return client.query('SELECT version()');
      })
      .then(res => {
        console.log(\`     \${res.rows[0].version.split(',')[0]}\`);
        return client.end();
      })
      .catch(err => {
        if (err.code === 'ECONNREFUSED') {
          console.log('   ✗ Connection refused');
        } else if (err.code === 'ENOTFOUND') {
          console.log('   ✗ Host not found (DNS resolution failed)');
        } else if (err.message.includes('authentication')) {
          console.log('   ✗ Authentication failed: Invalid credentials');
        } else {
          console.log(\`   ✗ Error: \${err.message}\`);
        }
      });
  `;

  exec(
    `node --input-type=module -e "${testScript.replace(/"/g, '\\"')}" "${dbUrl}"`,
    { timeout: 10000 },
    (error, stdout, stderr) => {
      console.log(stdout || stderr || '   (no response)');

      console.log('\n📋 Recommendations:');
      console.log('   If both tests fail:');
      console.log('   1. Check DATABASE_URL is correct in .env');
      console.log('   2. Verify database credentials (user/password)');
      console.log('   3. Ensure database is running and accepting connections');
      console.log('   4. Check firewall/network allows connections to db.prisma.io:5432');
      console.log('   5. Try offline mode: npm run db:rollout:onboarding:offline');
      console.log('\n═══════════════════════════════════════════════════════════\n');
    }
  );
});
