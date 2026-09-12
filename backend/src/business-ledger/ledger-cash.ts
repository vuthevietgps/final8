import { BadRequestException } from '@nestjs/common';

/** One definition of cash: opening balances plus confirmed account movements. */
export function ledgerCashAccounts(accounts: any[], entries: any[], through: Date) {
  const end = +through;
  if (!Number.isFinite(end)) throw new BadRequestException('Mốc tính số dư không hợp lệ.');
  return accounts.filter(a => +new Date(a.openingAt) <= end).map(account => {
    if (!Number.isSafeInteger(account.openingBalance) || account.openingBalance < 0)
      throw new BadRequestException('Số dư đầu kỳ không hợp lệ.');
    let receipts = 0, payments = 0, adjustments = 0;
    for (const entry of entries) {
      if (entry.status !== 'confirmed' || +new Date(entry.occurredAt) > end
        || +new Date(entry.occurredAt) < +new Date(account.openingAt)) continue;
      for (const movement of entry.effects.cash) {
        if (String(movement.accountId) !== String(account._id)) continue;
        if (!Number.isSafeInteger(movement.amount)) throw new BadRequestException('Số tiền chứng từ không hợp lệ.');
        if (entry.kind === 'reversal' || entry.kind.startsWith('cash_adjustment_')) adjustments += movement.amount;
        else if (movement.amount >= 0) receipts += movement.amount;
        else payments -= movement.amount;
        if (![receipts, payments, adjustments, account.openingBalance + receipts - payments + adjustments].every(Number.isSafeInteger))
          throw new BadRequestException('Số dư vượt giới hạn số nguyên chính xác.');
      }
    }
    return { id: String(account._id), code: account.code, name: account.name,
      openingAt: account.openingAt, openingBalance: account.openingBalance,
      receipts, payments, adjustments, balance: account.openingBalance + receipts - payments + adjustments };
  });
}

export async function readRegisteredCashBalance(db: any, through = new Date()): Promise<number> {
  const accounts = await db.collection('businessledgeraccounts')
    .find({ openingAt: { $lte: through } }).limit(1001).toArray();
  if (!accounts.length) throw new BadRequestException('Cần khai báo tài khoản và đối soát số dư đầu kỳ trong Sổ kinh doanh trước khi tính tiền khả dụng.');
  if (accounts.length > 1000) throw new BadRequestException('Vượt giới hạn tài khoản; không dùng số dư bị cắt bớt.');
  const firstOpening = new Date(Math.min(...accounts.map(a => +new Date(a.openingAt))));
  const entries = await db.collection('businessledgerentries').find({ status: 'confirmed',
    occurredAt: { $gte: firstOpening, $lte: through }, 'effects.cash.0': { $exists: true },
  }, { projection: { status: 1, occurredAt: 1, kind: 1, 'effects.cash': 1 } }).limit(20001).toArray();
  if (entries.length > 20000) throw new BadRequestException('Vượt giới hạn chứng từ tiền; không dùng số dư bị cắt bớt.');
  const total = ledgerCashAccounts(accounts, entries, through).reduce((sum, row) => sum + row.balance, 0);
  if (!Number.isSafeInteger(total)) throw new BadRequestException('Tổng tiền vượt giới hạn số nguyên chính xác.');
  return total;
}
