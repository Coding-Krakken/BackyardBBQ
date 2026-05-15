import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const rulesPath = path.join(cwd, 'config', 'dashboard-access-rules.json');
const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

function canAccessDashboardPath(role, pathname) {
  const accessRule = rules.roles[role];

  if (!accessRule) {
    return false;
  }

  if (accessRule.fullDashboardAccess) {
    return pathname.startsWith('/dashboard');
  }

  if (pathname === '/dashboard') {
    return true;
  }

  return accessRule.dashboardPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function resolveRedirect(role, pathname) {
  const accessRule = rules.roles[role];
  if (!accessRule) return '/auth/login';

  if (pathname === '/dashboard' && !accessRule.fullDashboardAccess) {
    return accessRule.defaultDashboard;
  }

  if (!canAccessDashboardPath(role, pathname)) {
    return accessRule.defaultDashboard;
  }

  return null;
}

const cases = [
  { role: 'owner', path: '/dashboard/analytics', allowed: true },
  { role: 'admin', path: '/dashboard/integrations', allowed: true },
  { role: 'manager', path: '/dashboard/orders', allowed: true },
  { role: 'manager', path: '/dashboard/accounting', allowed: false, redirect: '/dashboard' },
  { role: 'staff', path: '/dashboard', allowed: true, redirect: '/dashboard/orders' },
  { role: 'staff', path: '/dashboard/accounting', allowed: false, redirect: '/dashboard/orders' },
  { role: 'accounting', path: '/dashboard', allowed: true, redirect: '/dashboard/payments' },
  { role: 'accounting', path: '/dashboard/orders', allowed: false, redirect: '/dashboard/payments' },
  { role: 'accounting', path: '/dashboard/payments/disputes', allowed: true }
];

let failures = 0;

for (const testCase of cases) {
  const actualAllowed = canAccessDashboardPath(testCase.role, testCase.path);
  if (actualAllowed !== testCase.allowed) {
    failures += 1;
    console.error(
      `[FAIL] ${testCase.role} -> ${testCase.path}: expected allowed=${testCase.allowed}, got ${actualAllowed}`
    );
    continue;
  }

  const actualRedirect = resolveRedirect(testCase.role, testCase.path);
  if (testCase.redirect && actualRedirect !== testCase.redirect) {
    failures += 1;
    console.error(
      `[FAIL] ${testCase.role} -> ${testCase.path}: expected redirect=${testCase.redirect}, got ${actualRedirect}`
    );
    continue;
  }

  if (!testCase.redirect && !testCase.allowed && !actualRedirect) {
    failures += 1;
    console.error(
      `[FAIL] ${testCase.role} -> ${testCase.path}: expected redirect for denied path, got none`
    );
    continue;
  }

  console.log(`[PASS] ${testCase.role} -> ${testCase.path}`);
}

if (failures > 0) {
  console.error(`\nRole matrix verification failed with ${failures} failure(s).`);
  process.exit(1);
}

console.log('\nRole matrix verification passed.');
