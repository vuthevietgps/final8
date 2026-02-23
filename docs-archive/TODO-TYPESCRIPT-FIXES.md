# TODO: TypeScript Type Fixes

## Ticket 1: Fix `any` cast for Mongoose timestamps

### File: `backend/src/advertising-cost/advertising-cost.service.ts`

### Issue:
```typescript
// Line 665 - Using `any` to access updatedAt from timestamps
const latestRecord = await this.model.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean() as any;
```

### Root Cause:
- Schema has `timestamps: true` which adds `createdAt` and `updatedAt` automatically
- But `AdvertisingCostDocument` type doesn't include these fields
- TypeScript doesn't know about timestamps

### Fix Options:

#### Option A: Extend Document type
```typescript
// In advertising-cost.schema.ts
export type AdvertisingCostDocument = AdvertisingCost & Document & {
  createdAt: Date;
  updatedAt: Date;
};
```

#### Option B: Use HydratedDocument with timestamps
```typescript
import { HydratedDocument } from 'mongoose';

export type AdvertisingCostDocument = HydratedDocument<AdvertisingCost & {
  createdAt: Date;
  updatedAt: Date;
}>;
```

### Priority: Low (not blocking, just code quality)

### Status: Open

---

## Similar patterns to check:
- [ ] supplier-payable.schema.ts (if using timestamps)
- [ ] agent-statement.schema.ts (if using timestamps)
- [ ] other schemas with timestamps: true

---

Created: 2026-02-03
