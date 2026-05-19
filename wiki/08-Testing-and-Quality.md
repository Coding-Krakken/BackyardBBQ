# Testing and Quality

## Quality Stack

| Layer | Tool | Command |
|---|---|---|
| Unit/Integration | Jest | `npm test` |
| Admin-focused tests | Jest admin config | `npm run test:admin` |
| Payments coverage | Jest payments config | `npm run test:payments:coverage` |
| E2E | Playwright | `npm run test:e2e` |
| Script-level integration tests | Node test runner | `npm run test:integration:scripts` |

## Coverage Policy

- Baseline project threshold: 70%
- Payment-critical threshold: 80%

## E2E Environments

Source: [playwright.config.ts](../playwright.config.ts)

- Web project default base URL: `https://backyard-bbq.vercel.app`
- Admin project default base URL: `https://backyard-bbq-admin.vercel.app`

## Pre-push Validation

`npm run validate:pre-push` runs:

1. full Jest suite
2. integration script tests
3. type checks for web/api/admin
4. fast admin policy verification
5. data-integrity validation

## Recommended Release Gate

1. Payment coverage pass
2. Integration script pass
3. Role-policy verification pass
4. Smoke E2E pass
