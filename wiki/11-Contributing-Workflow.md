# Contributing Workflow

## Development Setup

```bash
npm install
npm run dev
```

Focused dev commands:

- `npm run dev:web`
- `npm run dev:admin`
- `npm run dev:api`
- `npm run dev:workers`

## Contribution Standards

1. Keep money math in cents end-to-end.
2. Use strict typing and guard indexed access.
3. Update role policies when adding admin routes/pages.
4. Include tests for payment and integration-touching changes.

## Validation Before PR

```bash
npm run typecheck:all
npm run validate:admin:fast
npm run test:integration:scripts
npm run test:e2e:smoke
```

## Pull Request Expectations

- Clear summary of behavior change.
- Risk callout for payments/auth/deployment changes.
- Test evidence for touched domains.
- Docs update when adding API surface, role policy, or operational scripts.

## Related Files

- [package.json](../package.json)
- [.husky/pre-push](../.husky/pre-push)
- [.husky/pre-commit](../.husky/pre-commit)
