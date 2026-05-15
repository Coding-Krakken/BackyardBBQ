import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const rulesPath = path.join(cwd, 'config', 'dashboard-page-access-rules.json');
const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

function routeToPagePath(route) {
  if (route === '/dashboard') {
    return path.join(cwd, 'app', 'dashboard', 'page.tsx');
  }

  const routeWithoutPrefix = route.replace('/dashboard/', '');
  return path.join(cwd, 'app', 'dashboard', ...routeWithoutPrefix.split('/'), 'page.tsx');
}

function sorted(values) {
  return [...values].sort();
}

function parseQuotedRoles(csv) {
  return csv
    .split(',')
    .map((value) => value.trim().replace(/^['\"]|['\"]$/g, ''))
    .filter(Boolean)
    .sort();
}

function parseClientAllowedRoles(content) {
  const match = content.match(/<RoleGate\s+allowedRoles=\{\[([^\]]+)\]\}/m);
  if (!match) return null;
  return parseQuotedRoles(match[1]);
}

function parseServerAllowedRoles(content) {
  const match = content.match(/hasAnyRole\(role,\s*\[([^\]]+)\]\s+satisfies\s+Role\[\]\)/m);
  if (!match) return null;
  return parseQuotedRoles(match[1]);
}

let failures = 0;

for (const [route, expectedRolesRaw] of Object.entries(rules.clientPages)) {
  const expectedRoles = sorted(expectedRolesRaw);
  const filePath = routeToPagePath(route);

  if (!fs.existsSync(filePath)) {
    failures += 1;
    console.error(`[FAIL] Missing client page for ${route}: ${filePath}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const actualRoles = parseClientAllowedRoles(content);

  if (!actualRoles) {
    failures += 1;
    console.error(`[FAIL] ${route}: missing <RoleGate allowedRoles={[...]} />`);
    continue;
  }

  if (JSON.stringify(actualRoles) !== JSON.stringify(expectedRoles)) {
    failures += 1;
    console.error(
      `[FAIL] ${route}: expected roles=${expectedRoles.join(',')} got=${actualRoles.join(',')}`
    );
    continue;
  }

  console.log(`[PASS] ${route}`);
}

for (const [route, expectedRolesRaw] of Object.entries(rules.serverPages)) {
  const expectedRoles = sorted(expectedRolesRaw);
  const filePath = routeToPagePath(route);

  if (!fs.existsSync(filePath)) {
    failures += 1;
    console.error(`[FAIL] Missing server page for ${route}: ${filePath}`);
    continue;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const actualRoles = parseServerAllowedRoles(content);

  if (!actualRoles) {
    failures += 1;
    console.error(`[FAIL] ${route}: missing hasAnyRole(role, [...]) guard`);
    continue;
  }

  if (JSON.stringify(actualRoles) !== JSON.stringify(expectedRoles)) {
    failures += 1;
    console.error(
      `[FAIL] ${route}: expected roles=${expectedRoles.join(',')} got=${actualRoles.join(',')}`
    );
    continue;
  }

  console.log(`[PASS] ${route}`);
}

if (failures > 0) {
  console.error(`\nDashboard page role verification failed with ${failures} failure(s).`);
  process.exit(1);
}

console.log('\nDashboard page role verification passed.');
