#!/usr/bin/env node

import { execSync } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';

const PRISMA_HOST = 'db.prisma.io';
const PRISMA_PORT = 5432;
const CHECK_TIMEOUT_MS = 5000;

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  BackyardBBQ Database Connectivity Diagnostics');
console.log('═══════════════════════════════════════════════════════════\n');

// 1. Check current env/location
console.log('📍 Environment Information:');
try {
  const publicIp = execSync('curl -s --connect-timeout 3 https://ifconfig.io', { encoding: 'utf8' }).trim();
  console.log(`   Public IP: ${publicIp}`);
} catch {
  console.log('   Public IP: (unable to fetch)');
}

try {
  const hostname = execSync('hostname', { encoding: 'utf8' }).trim();
  console.log(`   Hostname: ${hostname}`);
} catch {
  console.log('   Hostname: (unknown)');
}

// 2. Check DATABASE_URL from .env
console.log('\n🔐 Database Configuration:');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const dbUrlLine = envContent.split('\n').find(l => l.trim().startsWith('DATABASE_URL='));
  if (dbUrlLine) {
    const urlPart = dbUrlLine.split('=').slice(1).join('=').trim().replace(/^['\"]|['\"]$/g, '');
    const redacted = urlPart.replace(/:(.*?)@/, ':***@');
    console.log(`   DATABASE_URL: ${redacted}`);
  }
} else {
  console.log('   DATABASE_URL: (no .env file)');
}

// 3. Test raw TCP reachability
console.log('\n🔌 Raw TCP Connectivity:');
function testTcp(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finalize = (ok, reason) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ok, reason });
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finalize(true, 'connected'));
    socket.on('timeout', () => finalize(false, `timeout after ${timeoutMs}ms`));
    socket.on('error', (err) => finalize(false, err.message));

    socket.connect(port, host);
  });
}

(async () => {
  const tcpResult = await testTcp(PRISMA_HOST, PRISMA_PORT, CHECK_TIMEOUT_MS);
  if (tcpResult.ok) {
    console.log(`   ✓ ${PRISMA_HOST}:${PRISMA_PORT} — reachable`);
  } else {
    console.log(`   ✗ ${PRISMA_HOST}:${PRISMA_PORT} — ${tcpResult.reason}`);
  }

  // 4. Test localhost tunnel (SSH port forwarding)
  console.log('\n🔗 SSH Tunnel (localhost:5432):');
  const localTcpResult = await testTcp('localhost', PRISMA_PORT, CHECK_TIMEOUT_MS);
  if (localTcpResult.ok) {
    console.log(`   ✓ localhost:${PRISMA_PORT} — tunnel is active`);
  } else {
    console.log(`   ✗ localhost:${PRISMA_PORT} — no tunnel (${localTcpResult.reason})`);
  }

  // 5. Test Prisma preflight (if DATABASE_URL is set)
  console.log('\n⚙️  Prisma Connectivity:');
  if (!process.env.DATABASE_URL && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const dbUrlLine = envContent.split('\n').find(l => l.trim().startsWith('DATABASE_URL='));
    if (dbUrlLine) {
      const urlValue = dbUrlLine.split('=').slice(1).join('=').trim().replace(/^['\"]|['\"]$/g, '');
      process.env.DATABASE_URL = urlValue;
    }
  }

  if (process.env.DATABASE_URL) {
    try {
      const result = execSync(
        'npm exec -w @bbq/database prisma -- db pull --schema=prisma/schema.prisma --print',
        { stdio: 'pipe', encoding: 'utf8', timeout: CHECK_TIMEOUT_MS + 2000 }
      );
      console.log('   ✓ Prisma introspection successful (db pull worked)');
    } catch (error) {
      const errorMsg = error.toString();
      if (errorMsg.includes('P1001')) {
        console.log('   ✗ Prisma P1001: Cannot reach database server');
      } else if (errorMsg.includes('P1000')) {
        console.log('   ✗ Prisma P1000: Authentication failed');
      } else if (errorMsg.includes('timeout')) {
        console.log('   ✗ Prisma: Connection timeout');
      } else {
        console.log(`   ✗ Prisma error: ${errorMsg.split('\n')[0]}`);
      }
    }
  } else {
    console.log('   ⊘ DATABASE_URL not set (cannot test)');
  }

  // 6. Summary & recommendations
  console.log('\n📋 Recommendations:');
  if (tcpResult.ok) {
    console.log('   ✓ Direct DB connection: WORKS');
    console.log('     → Run: npm run db:rollout:onboarding');
  } else if (localTcpResult.ok) {
    console.log('   ✓ SSH tunnel (localhost:5432): DETECTED');
    console.log('     → Ensure tunnel is kept active in another terminal');
    console.log('     → Run: npm run db:rollout:onboarding:preflight');
  } else {
    console.log('   ✗ No direct connectivity or tunnel detected.');
    console.log('     Option 1: Set up SSH port forwarding:');
    console.log('       ssh -N -L 5432:db.prisma.io:5432 USER@JUMP_HOST');
    console.log('     Option 2: Use offline mode (currently available):');
    console.log('       npm run db:rollout:onboarding:offline');
    console.log('     Option 3: Use local PostgreSQL (see docs/DB-ROLLOUT-CONNECTIVITY.md)');
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
})();
