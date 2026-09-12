import { Types } from 'mongoose';
import { BankReconciliationService } from './bank-reconciliation.service';

const query = (value: any) => {
  const q: any = {
    lean: async () => value,
    sort: () => q,
    limit: () => q,
  };
  return q;
};

describe('Bank reconciliation', () => {
  const actorId = String(new Types.ObjectId());
  const accountId = String(new Types.ObjectId());
  const statementId = String(new Types.ObjectId());
  const lineId = String(new Types.ObjectId());
  const entryInId = String(new Types.ObjectId());
  const entryOutId = String(new Types.ObjectId());
  const account = {
    _id: accountId,
    code: 'VCB',
    name: 'Ngân hàng VCB',
    openingBalance: 1_000,
    openingAt: new Date('2026-09-01T00:00:00+07:00'),
  };
  const statement = {
    _id: statementId,
    accountId,
    statementKey: 'VCB-2026-09',
    from: '2026-09-01',
    to: '2026-09-30',
    openingBalance: 1_000,
    closingBalance: 1_150,
    bankMovement: 150,
  };
  const entries = [
    {
      _id: entryInId,
      kind: 'payment',
      occurredAt: new Date('2026-09-02T03:00:00Z'),
      description: 'Khách chuyển khoản',
      evidence: 'Phiếu thu',
      effects: { cash: [{ accountId, amount: 200 }] },
    },
    {
      _id: entryOutId,
      kind: 'payment',
      occurredAt: new Date('2026-09-03T03:00:00Z'),
      description: 'Phí ngân hàng',
      evidence: 'Phiếu chi',
      effects: { cash: [{ accountId, amount: -50 }] },
    },
  ];

  function service(overrides: any = {}) {
    const statements: any = {
      createIndexes: jest.fn(),
      findOne: () => query(null),
      findById: () => query(statement),
      find: () => query([statement]),
      db: { startSession: jest.fn() },
      ...overrides.statements,
    };
    const lines: any = {
      createIndexes: jest.fn(),
      find: () => query([
        {
          _id: lineId,
          statementId,
          accountId,
          externalId: 'BANK-IN',
          occurredAt: new Date('2026-09-02T03:00:00Z'),
          amount: 200,
          description: 'Khách chuyển khoản',
          status: 'matched',
          matchedEntryId: entryInId,
        },
        {
          _id: String(new Types.ObjectId()),
          statementId,
          accountId,
          externalId: 'BANK-FEE',
          occurredAt: new Date('2026-09-03T03:00:00Z'),
          amount: -50,
          description: 'Phí ngân hàng',
          status: 'unmatched',
        },
      ]),
      ...overrides.lines,
    };
    const accounts: any = { findById: () => query(account), ...overrides.accounts };
    const ledger: any = {
      find: () => query(entries),
      findOne: () => query(entries[0]),
      ...overrides.entries,
    };
    return { instance: new BankReconciliationService(statements, lines, accounts, ledger), statements, lines, accounts, ledger };
  }

  it('reconciles declared bank balance with the book and exposes unmatched pairs', async () => {
    const result = await service().instance.reconciliation(statementId);
    expect(result.bank).toMatchObject({ declaredClosing: 1_150, integrityDifference: 0 });
    expect(result.book).toEqual({ openingBalance: 1_000, movement: 150, closingBalance: 1_150 });
    expect(result.difference).toBe(0);
    expect(result.matched).toEqual({ count: 1, amount: 200 });
    expect(result.unmatchedBankLines[0].candidates[0]).toMatchObject({ entryId: entryOutId, amount: -50, dayDifference: 0 });
    expect(result.unmatchedLedgerEntries).toHaveLength(1);
    expect(result.fullyReconciled).toBe(false);
  });

  it('rejects a statement whose opening plus movement does not equal closing', async () => {
    const dto: any = {
      requestKey: 'import-1', accountId, statementKey: 'VCB-1', from: '2026-09-01', to: '2026-09-30',
      openingBalance: 1_000, closingBalance: 1_201, evidence: 'CSV VCB',
      lines: [{ externalId: 'BANK-1', occurredAt: '2026-09-02T03:00:00Z', amount: 200, description: 'Thu' }],
    };
    await expect(service().instance.create(dto, actorId)).rejects.toThrow('không bằng số dư cuối kỳ');
  });

  it('matches only an exact account cash movement and records the audit evidence', async () => {
    const line = {
      _id: lineId, statementId, accountId, externalId: 'BANK-IN', amount: 200,
      occurredAt: new Date('2026-09-02T03:00:00Z'), status: 'unmatched',
    };
    const update = jest.fn(() => query({ ...line, status: 'matched', matchedEntryId: entryInId }));
    const h = service({
      lines: { findById: () => query(line), findOneAndUpdate: update },
      entries: { findOne: () => query(entries[0]) },
    });
    await h.instance.match(lineId, { entryId: entryInId, evidence: 'Khớp mã ngân hàng' }, actorId);
    expect((update.mock.calls as any)[0][1].$push.matchHistory).toMatchObject({ action: 'matched', entryId: entryInId, actorId });
  });

  it('refuses to match the same bank line to a different signed amount', async () => {
    const line = {
      _id: lineId, statementId, accountId, externalId: 'BANK-OUT', amount: -200,
      occurredAt: new Date('2026-09-02T03:00:00Z'), status: 'unmatched',
    };
    const h = service({ lines: { findById: () => query(line) } });
    await expect(h.instance.match(lineId, { entryId: entryInId, evidence: 'Sai chiều' }, actorId))
      .rejects.toThrow('không khớp');
  });
});
