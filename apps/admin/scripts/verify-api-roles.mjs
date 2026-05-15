import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const apiRoot = path.join(cwd, 'app', 'api', 'admin');
const rulesPath = path.join(cwd, 'config', 'api-access-rules.json');

const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else if (entry.isFile() && entry.name === 'route.ts') {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizeRoutePath(filePath) {
  const rel = path.relative(apiRoot, filePath).replace(/\\/g, '/');
  const routePart = rel.replace(/\/route\.ts$/, '');
  return `/api/admin/${routePart}`;
}

function parseMethodBlocks(fileContent) {
  const methodMatches = [...fileContent.matchAll(/export\s+async\s+function\s+([A-Z]+)\s*\(/g)];
  const blocks = [];

  for (let i = 0; i < methodMatches.length; i += 1) {
    const current = methodMatches[i];
    const next = methodMatches[i + 1];
    const method = current[1];
    const start = current.index ?? 0;
    const end = next?.index ?? fileContent.length;
    const block = fileContent.slice(start, end);
    blocks.push({ method, block });
  }

  return blocks;
}

function parseRolesFromBlock(block) {
  const rolesMatch = block.match(/requireAdmin\s*\(\s*\[([^\]]*)\]\s*\)/);
  if (!rolesMatch) {
    return null;
  }

  return rolesMatch[1]
    .split(',')
    .map((part) => part.trim().replace(/^['\"]|['\"]$/g, ''))
    .filter(Boolean)
    .sort();
}

function sorted(values) {
  return [...values].sort();
}

const routeFiles = walk(apiRoot);
const actualPolicy = {};
let failures = 0;

for (const routeFile of routeFiles) {
  const routePath = normalizeRoutePath(routeFile);
  const fileContent = fs.readFileSync(routeFile, 'utf8');
  const blocks = parseMethodBlocks(fileContent);

  actualPolicy[routePath] = {};

  for (const { method, block } of blocks) {
    const roles = parseRolesFromBlock(block);

    if (!roles) {
      failures += 1;
      console.error(`[FAIL] ${routePath} ${method}: missing requireAdmin([...])`);
      continue;
    }

    actualPolicy[routePath][method] = roles;
  }
}

const expectedRoutes = rules.routes;

for (const [routePath, expectedMethods] of Object.entries(expectedRoutes)) {
  if (!actualPolicy[routePath]) {
    failures += 1;
    console.error(`[FAIL] Missing route implementation for ${routePath}`);
    continue;
  }

  for (const [method, expectedRolesRaw] of Object.entries(expectedMethods)) {
    const expectedRoles = sorted(expectedRolesRaw);
    const actualRoles = actualPolicy[routePath][method];

    if (!actualRoles) {
      failures += 1;
      console.error(`[FAIL] ${routePath} ${method}: method missing in implementation`);
      continue;
    }

    if (JSON.stringify(expectedRoles) !== JSON.stringify(actualRoles)) {
      failures += 1;
      console.error(
        `[FAIL] ${routePath} ${method}: expected roles=${expectedRoles.join(',')} got=${actualRoles.join(',')}`
      );
    } else {
      console.log(`[PASS] ${routePath} ${method}`);
    }
  }
}

for (const [routePath, methods] of Object.entries(actualPolicy)) {
  if (!expectedRoutes[routePath]) {
    failures += 1;
    console.error(`[FAIL] Unexpected implemented route not in policy: ${routePath}`);
    continue;
  }

  for (const method of Object.keys(methods)) {
    if (!expectedRoutes[routePath][method]) {
      failures += 1;
      console.error(`[FAIL] Unexpected implemented method not in policy: ${routePath} ${method}`);
    }
  }
}

if (failures > 0) {
  console.error(`\nAPI role policy verification failed with ${failures} failure(s).`);
  process.exit(1);
}

console.log('\nAPI role policy verification passed.');
