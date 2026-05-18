/**
 * Create admin user: derek@backyardbbqking.com
 * 
 * Run with: npx tsx prisma/create-admin.ts
 */
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { hash } from 'bcryptjs';
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

function loadWorkspaceEnv() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = resolve(scriptDir, '../../..');
  const candidates = [
    resolve(workspaceRoot, '.env.local'),
    resolve(workspaceRoot, '.env')
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) {
      continue;
    }

    const lines = readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex < 1) {
        continue;
      }

      const key = trimmed.slice(0, equalsIndex).trim();
      if (process.env[key]) {
        continue;
      }

      const rawValue = trimmed.slice(equalsIndex + 1).trim();
      process.env[key] = rawValue.replace(/^"|"$/g, '');
    }
  }
}

loadWorkspaceEnv();

function getResolvedDatabaseUrl(urlValue: string | undefined): string | undefined {
  if (!urlValue || process.env.NODE_ENV === 'production') {
    return urlValue;
  }

  try {
    const parsed = new URL(urlValue);
    if (parsed.hostname === 'host') {
      parsed.hostname = 'localhost';
      console.warn('[create-admin] DATABASE_URL host placeholder detected. Falling back to localhost for local development.');
      return parsed.toString();
    }
  } catch {
    // Keep original value when DATABASE_URL cannot be parsed.
  }

  return urlValue;
}

const resolvedDatabaseUrl = getResolvedDatabaseUrl(
  process.env.PRISMA_DATABASE_URL ?? process.env.DATABASE_URL
);
const prisma = new PrismaClient(
  resolvedDatabaseUrl
    ? { datasources: { db: { url: resolvedDatabaseUrl } } }
    : undefined
).$extends(withAccelerate());

async function main() {
  const email = 'derek@backyardbbqking.com';
  const password = 'KingofBBQ315';
  
  console.log(`Creating admin user: ${email}`);
  
  // Hash the password
  const passwordHash = await hash(password, 10);
  
  // Check if user already exists
  const existing = await prisma.customer.findUnique({
    where: { email }
  });
  
  if (existing) {
    console.log('User already exists. Updating to admin role...');
    await prisma.customer.update({
      where: { email },
      data: { 
        role: 'admin',
        passwordHash,
        firstName: 'Derek',
        lastName: 'Admin'
      }
    });
    console.log('✅ Updated user to admin role');
  } else {
    // Create new admin user
    const user = await prisma.customer.create({
      data: {
        email,
        passwordHash,
        role: 'admin',
        firstName: 'Derek',
        lastName: 'Admin'
      }
    });
    console.log('✅ Created admin user:', user.email);
  }
  
  console.log('\nLogin credentials:');
  console.log('  Email:', email);
  console.log('  Password: KingofBBQ315');
  console.log('  Role: admin');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
