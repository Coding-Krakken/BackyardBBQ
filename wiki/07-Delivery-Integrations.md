# Delivery Integrations

## Providers

- DoorDash
- UberEats
- GrubHub

## Integration Components

| Component | Role |
|---|---|
| `@bbq/delivery-channels` | Provider clients and status mapping |
| `apps/workers` | Background sync and adapter orchestration |
| `apps/api` | Inbound webhook handling and settlement processing |
| DB settlement models | Financial reconciliation and audit |

## Event Types

1. Orders
2. Status updates
3. Settlements

## Settlement Controls

- Batch uniqueness constraint: `channel + externalBatchId`
- Line-level linking to internal orders when correlation is possible
- Separate gross, fees, adjustments, and net payout fields

## Operational Commands

```bash
npm run test:delivery:integration -- --channel all --run-live false --api-base-url <url>
npm run report:delivery:integration:all
```

## Key References

- [docs/DELIVERY-INTEGRATION-OPERATIONS.md](../docs/DELIVERY-INTEGRATION-OPERATIONS.md)
- [packages/delivery-channels/src](../packages/delivery-channels/src)
- [apps/workers/src/index.ts](../apps/workers/src/index.ts)
