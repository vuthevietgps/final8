import { createHash } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { debtPaymentTiming, debtScheduleSummary, validScheduleDay } from './debt-schedule.rules';
import { CounterpartyLedgerService } from './counterparty-ledger.service';
import { DebtScheduleService } from './debt-schedule.service';
import { SaveDebtScheduleDto } from './debt-schedule.dto';
import { FinanceEvents } from '../finance/events/finance-events.constants';

const actor = '111111111111111111111111';
const row = { key: `agent:${actor}|order1`, partyKey: `agent:${actor}`, orderId: 'order1',
  balance: 600, reviewReasons: [], context: { orderId: 'order1' } };
const asOf = new Date('2026-09-05T17:00:00Z'); // September 6 in Vietnam
const rev = { ...row, direction: 'receivable', revision: 1, dueDate: '2026-09-02', promisedDate: '2026-09-03',
  recordedAt: '2026-09-01T00:00:00Z', reason: 'Contract', evidence: 'Contract 001', createdBy: actor };
const payment = { _id: 'payment1', orderId: row.orderId, kind: 'payment', status: 'confirmed',
  occurredAt: '2026-09-04T03:00:00Z', evidence: 'Bank 001',
  effects: { debts: [{ partyKey: row.partyKey, amount: -400 }], cash: [{ accountId: 'bank', amount: 400 }] } };

describe('Debt schedules and evidence', () => {
  it.each(['2026-02-30', '2026-9-01', '2026-13-01', '', undefined])('rejects invalid day %s', date => {
    expect(validScheduleDay(date)).toBe(false);
  });
  it('accepts leap day and compares business days at the Vietnam boundary', () => {
    expect(validScheduleDay('2028-02-29')).toBe(true);
    expect(debtPaymentTiming(row, [rev], [], asOf)).toMatchObject({ daysOverdue: 4, promiseDaysOverdue: 3 });
  });
  it('keeps partial payment lateness and the unpaid balance separately', () => {
    const result = debtPaymentTiming(row, [rev], [payment], asOf);
    expect(result).toMatchObject({ remainingAmount: 600, status: 'overdue', latePaymentCount: 1 });
    expect(result.payments[0]).toMatchObject({ cashAmount: 400, lateDays: 2, promiseLateDays: 1, effective: true });
  });
  it('does not rewrite past lateness after a renegotiation or reset contractual overdue with a new promise', () => {
    const renewed = { ...rev, revision: 2, balanceAtRevision: 600, promisedDate: '2026-09-10', recordedAt: '2026-09-05T00:00:00Z' };
    const result = debtPaymentTiming(row, [rev, renewed], [payment], asOf);
    expect(result).toMatchObject({ status: 'overdue', daysOverdue: 4, promiseDaysOverdue: 0, expectedDate: '2026-09-10' });
    expect(result.payments[0]).toMatchObject({ scheduleRevision: 1, lateDays: 2, promiseLateDays: 1 });
    expect(result.history).toHaveLength(2);
    expect(result.history[1].previousPromiseDaysOverdueAtRevision).toBe(2);
  });
  it('keeps reversed cash in the audit trail without counting it as an effective late payment', () => {
    const reversal = { ...payment, _id: 'reverse1', kind: 'reversal', reversalOf: payment._id,
      occurredAt: '2026-09-05T00:00:00Z' };
    const result = debtPaymentTiming({ ...row, balance: 1000 }, [rev], [payment, reversal], asOf);
    expect(result).toMatchObject({ remainingAmount: 1000, latePaymentCount: 0 });
    expect(result.payments[0]).toMatchObject({ effective: false, reversalEntryId: 'reverse1' });
  });
  it('does not classify old payments using a deadline entered after they happened', () => {
    const result = debtPaymentTiming(row, [{ ...rev, recordedAt: '2026-09-05T00:00:00Z' }], [payment], asOf);
    expect(result.payments[0]).toMatchObject({ lateDays: null, timingBasis: 'unknown_historical_deadline' });
    expect(result.unknownTimingPaymentCount).toBe(1);
  });
  it('preserves a settled order history and does not inherit the opposite direction deadline', () => {
    expect(debtPaymentTiming({ ...row, balance: 0 }, [rev], [payment], asOf)).toMatchObject({ status: 'settled', expectedDate: null });
    expect(debtPaymentTiming({ ...row, balance: -100 }, [rev], [payment], asOf)).toMatchObject({ status: 'unscheduled', direction: 'payable', revision: 0 });
  });
  it('measures supplier cash payments in the payable direction', () => {
    const p = { ...payment, effects: { debts: [{ partyKey: row.partyKey, amount: 400 }], cash: [{ accountId: 'bank', amount: -400 }] } };
    expect(debtPaymentTiming({ ...row, balance: -600 }, [{ ...rev, direction: 'payable' }], [p], asOf).payments[0])
      .toMatchObject({ direction: 'payable', cashAmount: 400, lateDays: 2 });
  });
  it('does not treat offsets, customer custody or drafts as company cash received', () => {
    const payments = [ { ...payment, _id: 'offset', kind: 'debt_offset', effects: { ...payment.effects, cash: [] } },
      { ...payment, _id: 'custody', effects: { ...payment.effects, cash: [] } }, { ...payment, _id: 'draft', status: 'draft' } ];
    const result = debtPaymentTiming(row, [rev], payments, asOf);
    expect(result.payments).toHaveLength(2);
    expect(result.payments.map(p => p.kind)).toEqual(['custody_or_transfer', 'offset']);
    expect(result.latePaymentCount).toBe(0);
  });
  it('keeps unknown, disputed and overdue amounts outside a fabricated today forecast', () => {
    const known = { ...row, paymentTiming: debtPaymentTiming(row, [rev], [], asOf) };
    const unknown = { ...row, balance: -200, paymentTiming: debtPaymentTiming({ ...row, balance: -200 }, [], [], asOf) };
    const review = { ...known, balance: 50, reviewReasons: ['Review'] };
    expect(debtScheduleSummary([known, unknown, review], asOf)).toMatchObject({
      scheduleConfigured: false, unscheduledPayable: 200, overdueReceivable: 600, reviewAmount: 50,
      scheduledByDay: [{ date: '2026-09-03', receivable: 600, payable: 0 }],
    });
  });
  it('preserves financial hashes and old receipt idempotency when schedule metadata changes', () => {
    const service = new CounterpartyLedgerService({} as any, {} as any);
    const old = createHash('sha256').update(JSON.stringify(['bank', 'receipt'])).digest('hex');
    expect(service.hash(['bank', 'receipt'])).toBe(old);
    expect(service.hash([row])).toBe(service.hash([{ ...row, paymentTiming: { daysOverdue: 99 } }]));
  });
});

function harness() {
  const docs: any[] = [];
  const model: any = {
    createIndexes: jest.fn(),
    findOne: jest.fn(query => {
      const found = () => docs.filter(d => Object.entries(query).every(([k, v]) => d[k] === v)).sort((a, b) => b.revision - a.revision)[0];
      return { lean: async () => found(), sort: () => ({ lean: async () => found() }) };
    }),
    create: jest.fn(async value => { docs.push({ ...value }); return value; }),
  };
  const ledger: any = { hash: new CounterpartyLedgerService({} as any, {} as any).hash,
    snapshot: jest.fn(async () => ({ rows: [row], sourceHash: 'a'.repeat(64) })) };
  const dto: SaveDebtScheduleDto = { requestKey: 'request-001', partyKey: row.partyKey, orderId: row.orderId,
    sourceHash: 'a'.repeat(64), direction: 'receivable', expectedRevision: 0,
    dueDate: '2026-09-02', promisedDate: null, reason: 'Contract terms', evidence: 'Contract 001' };
  const events: any = { emit: jest.fn() };
  return { service: new DebtScheduleService(model, ledger, events), dto, docs, model, ledger, events };
}
describe('Debt schedule writes', () => {
  it('creates auditable append-only revisions and retries idempotently', async () => {
    const { service, dto, docs, events } = harness();
    const first = await service.save(dto, actor);
    await service.save(dto, actor);
    await service.save({ ...dto, requestKey: 'request-002', expectedRevision: 1, promisedDate: '2026-09-10' }, actor);
    expect(docs).toHaveLength(2);
    expect(first).toMatchObject({ revision: 1, createdBy: actor, balanceAtRevision: 600, promisedDate: null });
    expect(events.emit).toHaveBeenCalledWith(FinanceEvents.AGENT_RECEIVABLE_UPDATED,
      { recordId: 'order1', agentId: actor, amountChanged: false });
  });
  it('rejects stale revisions, changed balances and reused request IDs', async () => {
    const { service, dto, ledger } = harness();
    await service.save(dto, actor);
    await expect(service.save({ ...dto, promisedDate: '2026-09-10' }, actor)).rejects.toThrow('nội dung khác');
    await expect(service.save({ ...dto, requestKey: 'another-001' }, actor)).rejects.toThrow('người khác');
    ledger.snapshot.mockResolvedValue({ rows: [row], sourceHash: 'b'.repeat(64) });
    await expect(service.save({ ...dto, requestKey: 'another-002' }, actor)).rejects.toThrow('Công nợ đã thay đổi');
  });
  it('rejects missing actors, bad dates and a different debt direction', async () => {
    const { service, dto } = harness();
    await expect(service.save(dto, '')).rejects.toThrow('Người ghi');
    await expect(service.save({ ...dto, dueDate: '2026-02-30' }, actor)).rejects.toThrow('Ngày');
    await expect(service.save({ ...dto, direction: 'payable' }, actor)).rejects.toThrow('Chiều');
  });
  it('requires dates to be present explicitly even when unknown', async () => {
    const { dto } = harness();
    expect(await validate(plainToInstance(SaveDebtScheduleDto, dto))).toHaveLength(0);
    expect((await validate(plainToInstance(SaveDebtScheduleDto, { ...dto, dueDate: undefined }))).length).toBeGreaterThan(0);
  });
  it('maps concurrent revision collisions to a reload conflict without overwriting', async () => {
    const { service, dto, model } = harness();
    model.create.mockRejectedValue({ code: 11000 });
    await expect(service.save(dto, actor)).rejects.toThrow('vừa được cập nhật');
  });
});

describe('Canonical source integration', () => {
  it('joins legacy candidates and schedules without assigning legacy commission deadlines to goods debt', async () => {
    const order: any = { _id: 'order1', productId: 'product1', agentId: actor, orderDate: '2026-09-01T03:00:00Z',
      quantity: 1, financialModelVersion: 2, saleMode: 'dealer', dealerProfitState: 'recognized', agentQuoteId: 'quote1',
      dealerContractAmount: 1000, recognizedRevenue: 1000, recognizedGoodsCost: 0, shipments: [], agentPaymentDueDate: '2026-09-15' };
    const revisions: any[] = [];
    const cursor = (rows: any[]) => { const q: any = { limit: () => q, session: () => q,
      lean: async () => rows, toArray: async () => rows }; return q; };
    const orders: any = { find: () => cursor([order]), db: { collection: (name: string) => ({
      find: () => cursor(name === 'businessledgerdebtschedules' ? revisions : []),
    }) } };
    const entries: any = { find: () => cursor([payment]) };
    const service = new CounterpartyLedgerService(orders, entries);
    const unscheduled = await service.snapshot(row.partyKey);
    expect(unscheduled.rows[0].paymentTiming).toMatchObject({ status: 'unscheduled',
      legacyCandidates: [{ dueDate: '2026-09-15', legacyDirection: 'payable', requiresReconciliation: true }] });
    revisions.push(rev);
    const scheduled = await service.snapshot(row.partyKey);
    expect(scheduled.rows[0]).toMatchObject({ balance: 600, paymentTiming: { dueDate: '2026-09-02', latePaymentCount: 1 } });
    expect(scheduled.sourceHash).toBe(unscheduled.sourceHash);
    expect(scheduled.evidenceHash).not.toBe(unscheduled.evidenceHash);
    expect(scheduled.paymentSchedule.scheduledByDay).toEqual([{ date: '2026-09-03', receivable: 600, payable: 0, orderKeys: [row.key] }]);
  });
});
