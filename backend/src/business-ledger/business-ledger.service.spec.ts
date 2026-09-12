import { ConflictException } from "@nestjs/common";
import { Types } from "mongoose";
import { validate } from "class-validator";
import { BusinessLedgerService } from "./business-ledger.service";
import { LedgerEntrySchema } from "./business-ledger.schema";
import { BusinessLedgerController } from "./business-ledger.controller";
import { CreateLedgerEntryDto } from "./business-ledger.dto";
import { PERMISSIONS_KEY } from "../auth/decorators/auth.decorator";
import { emptyEffects } from "./business-ledger.rules";

const actor = new Types.ObjectId().toString();
const id = new Types.ObjectId().toString();
const accountId = new Types.ObjectId().toString();
const lean = (value: any) => ({ lean: async () => value });
function harness(initial: any[] = []) {
  const rows = [...initial];
  const entries: any = {
    db: { startSession: async () => ({ withTransaction: async (work:any) => work(), endSession: async () => {} }),
      collection: () => ({ updateOne: async () => ({}) }) },
    findOne: jest.fn((q: any) =>
      lean(rows.find((e) => e.idempotencyKey === q.idempotencyKey) || null),
    ),
    findById: jest.fn((key: string) =>
      lean(rows.find((e) => String(e._id) === key) || null),
    ),
    create: jest.fn(async (value: any) => {
      const row = { _id: new Types.ObjectId().toString(), ...value };
      rows.push(row);
      return row;
    }),
    findOneAndUpdate: jest.fn((q: any, u: any) => {
      const row = rows.find(
        (e) => String(e._id) === q._id && e.status === q.status,
      );
      if (!row) return lean(null);
      Object.assign(row, u.$set);
      return lean({ ...row });
    }),
    createIndexes: jest.fn().mockResolvedValue([]),
  };
  const accounts: any = {
    findById: jest.fn(() =>
      lean({ _id: accountId, openingAt: "2026-09-01T00:00:00Z" }),
    ),
    createIndexes: jest.fn().mockResolvedValue([]),
  };
  const profiles: any = { createIndexes: jest.fn().mockResolvedValue([]) };
  return {
    service: new BusinessLedgerService(entries, accounts, profiles, {} as any),
    entries,
    accounts,
    rows,
  };
}
const receipt: CreateLedgerEntryDto = {
  idempotencyKey: "receipt-fixture",
  kind: "payment",
  amount: 100_000,
  occurredAt: "2026-09-02T03:00:00Z",
  evidence: "Receipt fixture",
  description: "Capital fixture",
  fromParty: "other",
  toParty: "company",
  otherParty: "owner",
  toAccountId: accountId,
};

describe("Business ledger write boundary", () => {
  it("creates drafts, derives effects on the server, and authenticates the audit actor", async () => {
    const h = harness();
    const draft = await h.service.createEntry(receipt, actor);
    expect(draft.status).toBe("draft");
    expect(draft.createdBy).toBe(actor);
    expect(draft.effects).toEqual({
      ...emptyEffects(),
      cash: [{ accountId, amount: 100_000 }],
    });
    expect(draft.confirmedAt).toBeUndefined();
  });
  it("an identical retry returns the original; changed payload with same key is rejected", async () => {
    const h = harness();
    const first = await h.service.createEntry(receipt, actor);
    expect(await h.service.createEntry(receipt, actor)).toBe(first);
    expect(h.entries.create).toHaveBeenCalledTimes(1);
    await expect(
      h.service.createEntry({ ...receipt, amount: 200_000 }, actor),
    ).rejects.toThrow(ConflictException);
  });
  it("does not accept a payment included in the opening balance", async () => {
    const h = harness();
    await expect(
      h.service.createEntry(
        { ...receipt, occurredAt: "2026-08-31T00:00:00Z" },
        actor,
      ),
    ).rejects.toThrow("mốc số dư");
    expect(h.entries.create).not.toHaveBeenCalled();
  });
  it("requires an actual registered company account", async () => {
    const h = harness();
    h.accounts.findById.mockImplementation(() => lean(null));
    await expect(h.service.createEntry(receipt, actor)).rejects.toThrow(
      "chưa được khai báo",
    );
  });
  it("confirms exactly once with a draft-status compare-and-set", async () => {
    const h = harness([
      {
        _id: id,
        status: "draft",
        kind: "sale",
        effects: emptyEffects(),
        occurredAt: new Date(),
      },
    ]);
    const results = await Promise.allSettled([
      h.service.confirmEntry(id, actor),
      h.service.confirmEntry(id, actor),
    ]);
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    expect(h.rows[0].status).toBe("confirmed");
    expect(h.rows[0].confirmedBy).toBe(actor);
    expect(h.entries.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, status: "draft" },
      expect.anything(),
      expect.objectContaining({ new: true, session: expect.anything() }),
    );
    const count = h.entries.findOneAndUpdate.mock.calls.length;
    await h.service.confirmEntry(id, actor);
    expect(h.entries.findOneAndUpdate).toHaveBeenCalledTimes(count);
  });
  it("reject cannot rewrite a confirmed record", async () => {
    const h = harness([
      { _id: id, status: "confirmed", effects: emptyEffects() },
    ]);
    await expect(h.service.rejectEntry(id, "reason", actor)).rejects.toThrow(
      ConflictException,
    );
    expect(h.rows[0].status).toBe("confirmed");
  });
  it("a reversal is generated from immutable original effects and remains a draft", async () => {
    const effects = {
      ...emptyEffects(),
      revenue: 123,
      debts: [{ partyKey: "customer:test", amount: 123 }],
    };
    const h = harness([
      {
        _id: id,
        status: "confirmed",
        kind: "sale",
        amount: 123,
        effects,
        occurredAt: "2026-09-01T03:00:00Z",
      },
    ]);
    const reverse = await h.service.createEntry(
      {
        idempotencyKey: "reverse",
        kind: "reversal",
        amount: 123,
        reversalOf: id,
        occurredAt: "2026-09-02T03:00:00Z",
        evidence: "Correction",
        description: "Correction",
      },
      actor,
    );
    expect(reverse.effects.revenue).toBe(-123);
    expect(reverse.status).toBe("draft");
    expect(h.rows[0].effects.revenue).toBe(123);
    expect(LedgerEntrySchema.indexes()).toContainEqual([
      { reversalOf: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: {
          reversalOf: { $type: "string" },
          status: "confirmed",
        },
      }),
    ]);
  });
  it("ensures unique indexes before accepting business writes", async () => {
    const h = harness();
    await h.service.onModuleInit();
    expect(h.entries.createIndexes).toHaveBeenCalledTimes(1);
  });
  it("protects every endpoint with financial permissions", () => {
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, BusinessLedgerController),
    ).toEqual(["finance", "finance.cashflow.manage"]);
    expect(
      Object.getOwnPropertyNames(BusinessLedgerController.prototype),
    ).not.toContain("delete");
  });
  it("DTO rejects caller-supplied confirmation and effects", async () => {
    const dto = Object.assign(new CreateLedgerEntryDto(), receipt, {
      status: "confirmed",
      effects: { revenue: 999 },
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.map((e) => e.property)).toEqual(
      expect.arrayContaining(["status", "effects"]),
    );
  });
});
