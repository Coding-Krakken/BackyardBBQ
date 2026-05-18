#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const SCHEMAS = [
  'packages/database/prisma/schema.prisma',
  'apps/admin/prisma/schema.prisma',
];

const ALLOW_OFFLINE = process.env.ROLL_OUT_ALLOW_OFFLINE === '1';
const CONNECT_TIMEOUT_MS = Number(process.env.DB_CONNECT_TIMEOUT_MS ?? '4000');
const PREFLIGHT_ONLY = process.argv.includes('--preflight-only');

function readEnvFileDatabaseUrl() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return undefined;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (key !== 'DATABASE_URL') continue;
    return line.slice(idx + 1).trim();
  }

  return undefined;
}

function parseHostPort(urlString) {
  if (!urlString) return null;
  const normalized = urlString.trim().replace(/^['\"]|['\"]$/g, '');
  try {
    const url = new URL(normalized);
    return {
      host: url.hostname,
      port: Number(url.port || '5432'),
      protocol: url.protocol,
    };
  } catch {
    return null;
  }
}

function run(command, args, options = {}) {
  const stdio = options.stdio ?? 'inherit';
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio,
      env: process.env,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}

function checkTcpReachability(host, port, timeoutMs) {
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

async function main() {
  console.log('[onboarding-rollout] Starting Prisma onboarding rollout');

  const databaseUrl = process.env.DATABASE_URL ?? readEnvFileDatabaseUrl();
  const target = parseHostPort(databaseUrl);
  if (!target) {
    const msg = '[onboarding-rollout] DATABASE_URL is missing or invalid. Skipping db push.';
    if (ALLOW_OFFLINE && !PREFLIGHT_ONLY) {
      console.warn(`${msg} Offline mode enabled; completing without db push.`);
      return;
    }
    throw new Error(msg);
  }

  // Ensure workspace-scoped prisma invocations can resolve env("DATABASE_URL")
  // even when .env is only present at monorepo root.
  process.env.DATABASE_URL = databaseUrl.trim().replace(/^['\"]|['\"]$/g, '');

  if (PREFLIGHT_ONLY) {
    const reachability = await checkTcpReachability(target.host, target.port, CONNECT_TIMEOUT_MS);
    if (!reachability.ok) {
      throw new Error(
        `[onboarding-rollout] Preflight failed: database ${target.host}:${target.port} is unreachable (${reachability.reason}).`
      );
    }

    console.log('[onboarding-rollout] Running Prisma preflight against packages/database schema');
    await run(
      'npm',
      ['exec', '-w', '@bbq/database', 'prisma', '--', 'db', 'pull', '--schema=prisma/schema.prisma', '--print'],
      { stdio: ['ignore', 'ignore', 'inherit'] }
    );

    console.log(`[onboarding-rollout] Preflight passed: Prisma can reach ${target.host}:${target.port}.`);
    return;
  }

  console.log('[onboarding-rollout] Generating Prisma client for packages/database');
  await run('npm', ['run', 'db:generate', '-w', '@bbq/database']);

  console.log('[onboarding-rollout] Generating Prisma client for apps/admin');
  await run('npm', ['exec', '-w', '@bbq/admin', 'prisma', '--', 'generate', '--schema=prisma/schema.prisma']);

  const reachability = await checkTcpReachability(target.host, target.port, CONNECT_TIMEOUT_MS);
  if (!reachability.ok) {
    const baseMsg = `[onboarding-rollout] Database ${target.host}:${target.port} is unreachable (${reachability.reason}).`;
    if (ALLOW_OFFLINE) {
      console.warn(`${baseMsg} Offline mode enabled; skipping db push.`);
      return;
    }
    throw new Error(`${baseMsg} Set ROLL_OUT_ALLOW_OFFLINE=1 to skip db push after generation in offline environments.`);
  }

  for (const schema of SCHEMAS) {
    console.log(`[onboarding-rollout] Pushing schema changes for ${schema}`);
    try {
      if (schema === 'packages/database/prisma/schema.prisma') {
        await run('npm', ['exec', '-w', '@bbq/database', 'prisma', '--', 'db', 'push', '--schema=prisma/schema.prisma', '--skip-generate']);
      } else {
        await run('npm', ['exec', '-w', '@bbq/admin', 'prisma', '--', 'db', 'push', '--schema=prisma/schema.prisma', '--skip-generate']);
      }
    } catch (error) {
      if (ALLOW_OFFLINE) {
        console.warn(
          `[onboarding-rollout] Skipping db push for ${schema} in offline mode (${error.message}).`
        );
        continue;
      }
      throw error;
    }
  }

  console.log('[onboarding-rollout] Rollout complete.');
}

main().catch((error) => {
  console.error('[onboarding-rollout] Failed:', error.message);
  process.exit(1);
});
