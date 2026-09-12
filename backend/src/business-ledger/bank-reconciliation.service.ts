import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Model, Types } from 'mongoose';
import { businessDay } from '../common/business-day';
import { LedgerAccount, LedgerEntry } from './business-ledger.schema';
import {
  BankStatement,
  BankStatementLine,
} from './bank-reconciliation.schema';
import {
  CreateBankStatementDto,
  MatchBankStatementLineDto,
  UnmatchBankStatementLineDto,
} from './bank-reconciliation.dto';

@Injectable()
export class BankReconciliationService implements OnModuleInit {
  constructor(
    @InjectModel(BankStatement.name) private readonly statements: Model<BankStatement>,
    @InjectModel(BankStatementLine.name) private readonly lines: Model<BankStatementLine>,
    @InjectModel(LedgerAccount.name) private readonly accounts: Model<LedgerAccount>,
    @InjectModel(LedgerEntry.name) private readonly entries: Model<LedgerEntry>,
  ) {}

  async onModuleInit() {
    await Promise.all([this.statements.createIndexes(), this.lines.createIndexes()]);
  }

  private id(value: string) {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException('Mã không hợp lệ.');
    return value;
  }

  private text(value: string, label: string) {
    if (!value?.trim()) throw new BadRequestException(`Cần ${label}.`);
    return value.trim();
  }

  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private validDay(value: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
      && businessDay(`${value}T00:00:00+07:00`) === value;
  }

  async create(dto: CreateBankStatementDto, actorId: string) {
    this.id(actorId);
    if (!this.validDay(dto.from) || !this.validDay(dto.to) || dto.from > dto.to)
      throw new BadRequestException('Khoảng ngày sao kê không hợp lệ.');
    const start = new Date(`${dto.from}T00:00:00+07:00`);
    const end = new Date(`${dto.to}T23:59:59.999+07:00`);
    if (+end - +start > 366 * 86_400_000)
      throw new BadRequestException('Một sao kê không được dài quá 366 ngày.');
    const account = await this.accounts.findById(this.id(dto.accountId)).lean();
    if (!account) throw new NotFoundException('Không tìm thấy tài khoản tiền.');
    if (+new Date(account.openingAt) > +start)
      throw new BadRequestException('Sao kê bắt đầu trước mốc số dư đầu kỳ của tài khoản.');

    const externalIds = new Set<string>();
    let movement = 0;
    const rows = dto.lines.map((line) => {
      const externalId = this.text(line.externalId, 'mã giao dịch ngân hàng');
      if (externalIds.has(externalId))
        throw new BadRequestException(`Mã giao dịch ngân hàng bị lặp trong tệp: ${externalId}.`);
      externalIds.add(externalId);
      if (!Number.isSafeInteger(line.amount) || line.amount === 0)
        throw new BadRequestException('Số tiền sao kê phải là số nguyên VND khác 0.');
      const occurredAt = new Date(line.occurredAt);
      if (!Number.isFinite(+occurredAt) || +occurredAt < +start || +occurredAt > +end)
        throw new BadRequestException(`Giao dịch ${externalId} nằm ngoài kỳ sao kê.`);
      movement += line.amount;
      if (!Number.isSafeInteger(movement))
        throw new BadRequestException('Tổng sao kê vượt giới hạn số nguyên chính xác.');
      return {
        externalId,
        occurredAt,
        amount: line.amount,
        reference: line.reference?.trim() || undefined,
        description: this.text(line.description, 'diễn giải giao dịch'),
      };
    });
    if (!Number.isSafeInteger(dto.openingBalance + movement)
      || dto.openingBalance + movement !== dto.closingBalance)
      throw new BadRequestException('Số dư đầu kỳ cộng phát sinh không bằng số dư cuối kỳ sao kê.');

    const normalized = {
      ...dto,
      currency: 'VND',
      statementKey: this.text(dto.statementKey, 'mã sao kê'),
      evidence: this.text(dto.evidence, 'nguồn/tệp sao kê'),
      lines: rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString() })),
    };
    const requestHash = this.hash(normalized);
    const existing = await this.statements.findOne({ requestKey: dto.requestKey }).lean();
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new ConflictException('Mã yêu cầu đã dùng với nội dung sao kê khác.');
      return this.detail(String((existing as any)._id));
    }

    const session = await this.statements.db.startSession();
    try {
      let statement: any;
      await session.withTransaction(async () => {
        const created = await this.statements.create([{
          requestKey: this.text(dto.requestKey, 'mã yêu cầu'),
          requestHash,
          accountId: dto.accountId,
          statementKey: normalized.statementKey,
          from: dto.from,
          to: dto.to,
          openingBalance: dto.openingBalance,
          closingBalance: dto.closingBalance,
          bankMovement: movement,
          lineCount: rows.length,
          currency: 'VND',
          evidence: normalized.evidence,
          createdBy: actorId,
        }], { session });
        statement = created[0];
        await this.lines.insertMany(rows.map((row) => ({
          ...row,
          statementId: String(statement._id),
          accountId: dto.accountId,
          status: 'unmatched',
          matchHistory: [],
        })), { session });
      });
      return this.detail(String(statement._id));
    } catch (error) {
      if ((error as any)?.code === 11000)
        throw new ConflictException('Sao kê hoặc mã giao dịch ngân hàng đã được nhập trước đó.');
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async list(accountId?: string) {
    const filter: any = {};
    if (accountId) filter.accountId = this.id(accountId);
    return this.statements.find(filter).sort({ from: -1, statementKey: -1 }).limit(500).lean();
  }

  async detail(id: string) {
    const statement = await this.statements.findById(this.id(id)).lean();
    if (!statement) throw new NotFoundException('Không tìm thấy sao kê.');
    const lines = await this.lines.find({ statementId: id }).sort({ occurredAt: 1, _id: 1 }).lean();
    return { statement, lines };
  }

  private cashAmount(entry: any, accountId: string) {
    return (entry.effects?.cash || [])
      .filter((row: any) => String(row.accountId) === accountId)
      .reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
  }

  async match(lineId: string, dto: MatchBankStatementLineDto, actorId: string) {
    this.id(actorId);
    const line = await this.lines.findById(this.id(lineId)).lean();
    if (!line) throw new NotFoundException('Không tìm thấy dòng sao kê.');
    if (line.status === 'matched') {
      if (line.matchedEntryId === dto.entryId) return line;
      throw new ConflictException('Dòng sao kê đã được đối chiếu với nghiệp vụ khác.');
    }
    const statement = await this.statements.findById(line.statementId).lean();
    const entry = await this.entries.findOne({ _id: this.id(dto.entryId), status: 'confirmed' }).lean();
    if (!statement || !entry) throw new NotFoundException('Không tìm thấy sao kê hoặc nghiệp vụ đã xác nhận.');
    if (businessDay(entry.occurredAt) < statement.from || businessDay(entry.occurredAt) > statement.to)
      throw new BadRequestException('Ngày nghiệp vụ nằm ngoài kỳ sao kê.');
    if (this.cashAmount(entry, line.accountId) !== line.amount)
      throw new BadRequestException('Số tiền vào/ra tài khoản trên sổ không khớp dòng sao kê.');
    const evidence = this.text(dto.evidence, 'căn cứ đối chiếu');
    try {
      const updated = await this.lines.findOneAndUpdate(
        { _id: lineId, status: 'unmatched' },
        {
          $set: {
            status: 'matched', matchedEntryId: dto.entryId, matchedBy: actorId,
            matchedAt: new Date(), matchEvidence: evidence,
          },
          $push: { matchHistory: { action: 'matched', entryId: dto.entryId, actorId, at: new Date(), evidence } },
        },
        { new: true },
      ).lean();
      if (!updated) throw new ConflictException('Dòng sao kê vừa được người khác xử lý.');
      return updated;
    } catch (error) {
      if ((error as any)?.code === 11000)
        throw new ConflictException('Nghiệp vụ sổ này đã được ghép với một dòng ngân hàng khác.');
      throw error;
    }
  }

  async unmatch(lineId: string, dto: UnmatchBankStatementLineDto, actorId: string) {
    this.id(actorId);
    const evidence = this.text(dto.evidence, 'lý do bỏ đối chiếu');
    const current = await this.lines.findOne({ _id: this.id(lineId), status: 'matched' }).lean();
    if (!current) throw new ConflictException('Dòng sao kê chưa được đối chiếu.');
    const updated = await this.lines.findOneAndUpdate(
      { _id: lineId, status: 'matched', matchedEntryId: current.matchedEntryId },
      {
        $set: { status: 'unmatched' },
        $unset: { matchedEntryId: 1, matchedBy: 1, matchedAt: 1, matchEvidence: 1 },
        $push: { matchHistory: { action: 'unmatched', entryId: current.matchedEntryId, actorId, at: new Date(), evidence } },
      },
      { new: true },
    ).lean();
    if (!updated) throw new ConflictException('Dòng sao kê vừa được người khác xử lý.');
    return updated;
  }

  async reconciliation(statementId: string) {
    const { statement, lines } = await this.detail(statementId);
    const account = await this.accounts.findById(statement.accountId).lean();
    if (!account) throw new NotFoundException('Tài khoản của sao kê không còn tồn tại.');
    const start = new Date(`${statement.from}T00:00:00+07:00`);
    const end = new Date(`${statement.to}T23:59:59.999+07:00`);
    const entries = await this.entries.find({
      status: 'confirmed', occurredAt: { $gte: new Date(account.openingAt), $lte: end },
      'effects.cash.accountId': statement.accountId,
    }).sort({ occurredAt: 1, _id: 1 }).limit(50001).lean();
    if (entries.length > 50000)
      throw new BadRequestException('Vượt giới hạn dòng sổ đối chiếu; cần tổng hợp phía máy chủ.');
    let bookOpening = Number(account.openingBalance);
    const ledgerRows: any[] = [];
    for (const entry of entries) {
      const amount = this.cashAmount(entry, statement.accountId);
      if (!amount) continue;
      if (+new Date(entry.occurredAt) < +start) bookOpening += amount;
      else ledgerRows.push({
        entryId: String((entry as any)._id), occurredAt: entry.occurredAt, amount,
        kind: entry.kind, description: entry.description, evidence: entry.evidence,
      });
    }
    const bookMovement = ledgerRows.reduce((sum, row) => sum + row.amount, 0);
    const bookClosing = bookOpening + bookMovement;
    const matchedEntryIds = new Set(lines.filter((line: any) => line.status === 'matched').map((line: any) => line.matchedEntryId));
    const unmatchedLedgerEntries = ledgerRows.filter((row) => !matchedEntryIds.has(row.entryId));
    const unmatchedBankLines = lines.filter((line: any) => line.status !== 'matched').map((line: any) => {
      const day = +new Date(line.occurredAt);
      const candidates = unmatchedLedgerEntries
        .filter((row) => row.amount === line.amount && Math.abs(+new Date(row.occurredAt) - day) <= 3 * 86_400_000)
        .map((row) => ({ ...row, dayDifference: Math.round(Math.abs(+new Date(row.occurredAt) - day) / 86_400_000) }))
        .sort((a, b) => a.dayDifference - b.dayDifference)
        .slice(0, 5);
      return { ...line, candidates };
    });
    const matchedLines = lines.filter((line: any) => line.status === 'matched');
    const bankCalculatedClosing = statement.openingBalance + lines.reduce((sum: number, line: any) => sum + line.amount, 0);
    const statementIntegrityDifference = statement.closingBalance - bankCalculatedClosing;
    const bookDifference = statement.closingBalance - bookClosing;
    return {
      statement,
      account: { id: String((account as any)._id), code: account.code, name: account.name },
      bank: {
        openingBalance: statement.openingBalance,
        movement: statement.bankMovement,
        calculatedClosing: bankCalculatedClosing,
        declaredClosing: statement.closingBalance,
        integrityDifference: statementIntegrityDifference,
      },
      book: { openingBalance: bookOpening, movement: bookMovement, closingBalance: bookClosing },
      difference: bookDifference,
      matched: { count: matchedLines.length, amount: matchedLines.reduce((sum: number, line: any) => sum + Math.abs(line.amount), 0) },
      lines,
      unmatchedBankLines,
      unmatchedLedgerEntries,
      fullyReconciled: statementIntegrityDifference === 0 && bookDifference === 0
        && unmatchedBankLines.length === 0 && unmatchedLedgerEntries.length === 0,
    };
  }
}
