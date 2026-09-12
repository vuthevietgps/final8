import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Types } from 'mongoose';
import { ledgerCashAccounts } from './ledger-cash';

/** Called only by a committed-domain operation, inside its Mongo transaction. */
export async function postTreasuryJournal(db: any, session: any, input: {
  referenceId: string; category: string; amount: number; direction: 'in' | 'out';
  occurredAt: Date; accountId?: string; actorId?: string; interest?: number;
  ownerFund?: boolean;
}) {
  if (!session?.inTransaction()) throw new BadRequestException('Ghi sổ tiền cần giao dịch MongoDB.');
  const interest = input.interest || 0;
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > 1e12
    || !Number.isSafeInteger(interest) || interest < 0 || interest > input.amount)
    throw new BadRequestException('Số tiền phải là số nguyên VND hợp lệ.');
  if (!Number.isFinite(+input.occurredAt) || +input.occurredAt > Date.now())
    throw new BadRequestException('Ngày ghi nhận tiền phải hợp lệ và không ở tương lai.');
  const cash: { accountId: string; amount: number }[] = [];
  await db.collection('businessledgerlocks').updateOne({ _id: 'journal' as any },
    { $inc: { revision: 1 } }, { upsert: true, session });
  if (!input.ownerFund) {
    if (input.accountId && !Types.ObjectId.isValid(input.accountId))
      throw new BadRequestException('Tài khoản sổ tiền không hợp lệ.');
    const accounts = await db.collection('businessledgeraccounts').find({
      ...(input.accountId ? { _id: new Types.ObjectId(input.accountId) } : {}),
      openingAt: { $lte: input.occurredAt },
    }, { session }).limit(2).toArray();
    if (accounts.length !== 1)
      throw new BadRequestException('Cần chọn ledgerAccountId của tài khoản trong Sổ kinh doanh; ngày giao dịch phải sau ngày mở sổ.');
    const account = accounts[0];
    // Keep an account revision for treasury audit.
    await db.collection('businessledgeraccounts').updateOne({ _id: account._id },
      { $inc: { treasuryVersion: 1 } }, { session });
    if (input.direction === 'out') {
      const entries = await db.collection('businessledgerentries').find({
        status: 'confirmed', occurredAt: { $gte: account.openingAt, $lte: new Date() },
        'effects.cash.accountId': String(account._id),
      }, { session }).limit(20001).toArray();
      if (entries.length > 20000) throw new BadRequestException('Vượt giới hạn đối soát tiền.');
      if (ledgerCashAccounts([account], entries, new Date())[0].balance < input.amount)
        throw new BadRequestException('Tài khoản đã chọn không đủ tiền thực nhận.');
    }
    cash.push({ accountId: String(account._id), amount: input.direction === 'in' ? input.amount : -input.amount });
  }
  const idempotencyKey = `treasury:${input.category}:${input.referenceId}`;
  const actor = input.actorId || `system:${input.category}`;
  const now = new Date();
  await db.collection('businessledgerentries').insertOne({
    idempotencyKey, requestHash: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
    kind: 'payment', amount: input.amount, status: 'confirmed', occurredAt: input.occurredAt,
    evidence: `${input.category}:${input.referenceId}`, description: input.category,
    posting: { kind: 'payment', amount: input.amount, settlesDebt: false },
    effects: { revenue: 0, cogs: 0, expense: interest, debts: [], cash },
    createdBy: actor, confirmedBy: actor, confirmedAt: now, createdAt: now, updatedAt: now,
  }, { session });
}
