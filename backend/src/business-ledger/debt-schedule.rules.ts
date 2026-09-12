import { businessDay } from '../common/business-day';

export function validScheduleDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(+new Date(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
const lateDays = (day: string, deadline: string | null) => deadline
  ? Math.max(0, Math.round((+new Date(day) - +new Date(deadline)) / 86400000)) : null;

export function debtPaymentTiming(row: any, revisions: any[], journal: any[], asOf: Date) {
  const today = businessDay(asOf);
  const history = revisions.filter(r => r.partyKey === row.partyKey && r.orderId === row.orderId && +new Date(r.recordedAt) <= +asOf)
    .sort((a, b) => +new Date(a.recordedAt) - +new Date(b.recordedAt) || a.revision - b.revision);
  const confirmed = journal.filter(e => e.orderId === row.orderId && e.status === 'confirmed' && +new Date(e.occurredAt) <= +asOf);
  const reversals = new Map(confirmed.filter(e => e.kind === 'reversal').map(e => [String(e.reversalOf), e]));
  const payments = confirmed.filter(e => ['payment', 'debt_offset'].includes(e.kind)).flatMap(e => {
    const movement = (e.effects?.debts || []).filter(d => d.partyKey === row.partyKey).reduce((sum, d) => sum + d.amount, 0);
    if (!movement) return [];
    // Both actual cash and non-cash custody/offset movements are retained, with distinct labels.
    const direction = movement < 0 ? 'receivable' : 'payable';
    const schedules = history.filter(r => r.direction === direction);
    const known = schedules.filter(r => +new Date(r.recordedAt) <= +new Date(e.occurredAt));
    const schedule = known[known.length - 1];
    const day = businessDay(e.occurredAt);
    const cash = (e.effects?.cash || []).reduce((sum, c) => sum + c.amount, 0);
    const actualCash = e.kind === 'payment' && Math.sign(cash) === -Math.sign(movement);
    const reversed = reversals.get(String(e._id));
    return [{ entryId: String(e._id), settlementId: e.settlementId || null, occurredAt: e.occurredAt,
      recordedAt: e.confirmedAt || e.createdAt || null, direction, debtReduction: Math.abs(movement),
      cashAmount: actualCash ? Math.min(Math.abs(cash), Math.abs(movement)) : 0,
      kind: actualCash ? 'cash_payment' : e.kind === 'debt_offset' ? 'offset' : 'custody_or_transfer',
      evidence: e.evidence || null, effective: !reversed, reversalEntryId: reversed ? String(reversed._id) : null,
      reversedAt: reversed?.occurredAt || null, scheduleRevision: schedule?.revision ?? null,
      dueDate: schedule?.dueDate ?? null, promisedDate: schedule?.promisedDate ?? null,
      lateDays: lateDays(day, schedule?.dueDate), promiseLateDays: lateDays(day, schedule?.promisedDate),
      timingBasis: schedule ? 'schedule_recorded_before_payment' : 'unknown_historical_deadline',
    }];
  }).sort((a, b) => +new Date(a.occurredAt) - +new Date(b.occurredAt) || a.entryId.localeCompare(b.entryId));
  const direction = row.balance > 0 ? 'receivable' : row.balance < 0 ? 'payable' : null;
  const matching = history.filter(r => r.direction === direction);
  const current = matching[matching.length - 1];
  const dueDate = current?.dueDate ?? null, promisedDate = current?.promisedDate ?? null;
  const late = lateDays(today, dueDate), promiseLate = lateDays(today, promisedDate);
  const effectivePayments = payments.filter(p => p.effective && p.kind === 'cash_payment');
  return {
    asOf: asOf.toISOString(), timezone: 'Asia/Ho_Chi_Minh', direction,
    revision: current?.revision ?? 0, dueDate, promisedDate,
    expectedDate: direction ? promisedDate || dueDate : null,
    daysOverdue: direction ? late : 0, promiseDaysOverdue: direction ? promiseLate : 0,
    status: !direction ? 'settled' : !dueDate ? 'unscheduled' : late > 0 ? 'overdue' : 'not_due',
    remainingAmount: Math.abs(row.balance),
    history: history.map(({ requestHash, sourceHash, ...revision }, index) => {
      const previous = history.slice(0, index).filter(r => r.direction === revision.direction).pop();
      const stillOwed = revision.direction === 'receivable' ? revision.balanceAtRevision > 0 : revision.balanceAtRevision < 0;
      return { ...revision,
        previousDueDaysOverdueAtRevision: previous && stillOwed ? lateDays(businessDay(revision.recordedAt), previous.dueDate) : null,
        previousPromiseDaysOverdueAtRevision: previous && stillOwed ? lateDays(businessDay(revision.recordedAt), previous.promisedDate) : null,
      };
    }),
    payments,
    latePaymentCount: effectivePayments.filter(p => p.lateDays != null && p.lateDays > 0).length,
    unknownTimingPaymentCount: effectivePayments.filter(p => p.lateDays == null).length,
    note: 'Lịch dự kiến không phải tiền chắc chắn thu/chi. Thiếu hạn tại thời điểm thanh toán được giữ là chưa rõ; sửa lịch không viết lại lịch sử trả trễ.',
  };
}

export function debtScheduleSummary(rows: any[], asOf: Date) {
  const daily = new Map<string, any>();
  let unscheduledReceivable = 0, unscheduledPayable = 0, overdueReceivable = 0, overduePayable = 0;
  let unknownDueCount = 0, reviewAmount = 0;
  for (const row of rows) {
    if (!row.balance) continue;
    const t = row.paymentTiming, receivable = row.balance > 0, amount = Math.abs(row.balance);
    if (!t?.dueDate) unknownDueCount++;
    if (row.reviewReasons?.length) { reviewAmount += amount; continue; }
    if (t?.daysOverdue > 0) receivable ? overdueReceivable += amount : overduePayable += amount;
    if (!t?.expectedDate) { receivable ? unscheduledReceivable += amount : unscheduledPayable += amount; continue; }
    const day = daily.get(t.expectedDate) || { date: t.expectedDate, receivable: 0, payable: 0, orderKeys: [] };
    day[receivable ? 'receivable' : 'payable'] += amount; day.orderKeys.push(row.key); daily.set(t.expectedDate, day);
  }
  const scheduledByDay = [...daily.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (![unscheduledReceivable, unscheduledPayable, overdueReceivable, overduePayable, reviewAmount,
    ...scheduledByDay.flatMap(d => [d.receivable, d.payable])].every(Number.isSafeInteger))
    throw new Error('Tổng lịch công nợ vượt giới hạn chính xác của số nguyên đồng.');
  return { asOf: asOf.toISOString(), timezone: 'Asia/Ho_Chi_Minh', basis: 'explicit_debt_deadlines_and_promises',
    scheduleConfigured: unknownDueCount === 0 && reviewAmount === 0, unknownDueCount, reviewAmount,
    unscheduledReceivable, unscheduledPayable, overdueReceivable, overduePayable, scheduledByDay,
    pastExpectedDatesAreOverdueNotGuaranteedToday: true };
}
