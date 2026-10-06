#!/usr/bin/env node
import { execSync } from 'child_process';

const dummyDbUrl = 'postgresql://postgres:postgres@localhost:5432/postgres?schema=public';
const originalDbUrl = process.env.DATABASE_URL;

if (!originalDbUrl) {
  console.log('[vercel-build] DATABASE_URL not set; using fallback for prisma generate');
  process.env.DATABASE_URL = dummyDbUrl;
}

console.log('[vercel-build] Generating Prisma client...');
execSync('npx prisma generate --schema=packages/database/prisma/schema.prisma', {
  stdio: 'inherit',
  env: process.env,
});

if (originalDbUrl && originalDbUrl !== dummyDbUrl) {
  try {
    console.log('[vercel-build] Pushing database schema (best effort)...');
    execSync('npx prisma db push --schema=packages/database/prisma/schema.prisma --skip-generate', {
      stdio: 'inherit',
      env: process.env,
    });

    console.log('[vercel-build] Running make-admin seed script (best effort)...');
    execSync('npx tsx packages/database/prisma/make-admin.ts', {
      stdio: 'inherit',
      env: process.env,
    });
  } catch (error) {
    console.warn('[vercel-build] Database push/seed failed (non-blocking in build):', error?.message || error);
  }
} else {
  console.log('[vercel-build] Skipping db push and seed in build environment without live DATABASE_URL.');
}

console.log('[vercel-build] Building web application...');
execSync('npm run build -w @bbq/web', {
  stdio: 'inherit',
  env: process.env,
});
