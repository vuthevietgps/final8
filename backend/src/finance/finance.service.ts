import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FundingSource, FundingSourceDocument } from './schemas/funding-source.schema';
import { BudgetBucket, BudgetBucketDocument } from './schemas/budget-bucket.schema';
import { CashflowEntry, CashflowEntryDocument } from './schemas/cashflow-entry.schema';
import { LoanContract, LoanContractDocument } from './schemas/loan-contract.schema';
import { LoanRepayment, LoanRepaymentDocument } from './schemas/loan-repayment.schema';
import { AvailableFundSnapshot, AvailableFundSnapshotDocument } from './schemas/available-fund-snapshot.schema';
import { Summary5, Summary5Document } from '../summary5/schemas/summary5.schema';
import { Summary4, Summary4Document } from '../summary4/schemas/summary4.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateFundingSourceDto } from './dto/create-funding-source.dto';
import { UpdateFundingSourceDto } from './dto/update-funding-source.dto';
import { CreateBudgetBucketDto } from './dto/create-budget-bucket.dto';
import { UpdateBudgetBucketDto } from './dto/update-budget-bucket.dto';
import { CreateCashflowEntryDto } from './dto/create-cashflow-entry.dto';
import { CreateLoanContractDto } from './dto/create-loan-contract.dto';
import { UpdateLoanContractDto } from './dto/update-loan-contract.dto';
import { CreateLoanRepaymentDto } from './dto/create-loan-repayment.dto';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    @InjectModel(FundingSource.name)
    private readonly fundingSourceModel: Model<FundingSourceDocument>,
    @InjectModel(BudgetBucket.name)
    private readonly budgetBucketModel: Model<BudgetBucketDocument>,
    @InjectModel(CashflowEntry.name)
    private readonly cashflowModel: Model<CashflowEntryDocument>,
    @InjectModel(LoanContract.name)
    private readonly loanModel: Model<LoanContractDocument>,
    @InjectModel(LoanRepayment.name)
    private readonly repaymentModel: Model<LoanRepaymentDocument>,
    @InjectModel(AvailableFundSnapshot.name)
    private readonly availableFundModel: Model<AvailableFundSnapshotDocument>,
    @InjectModel(Summary5.name)
    private readonly summary5Model: Model<Summary5Document>,
    @InjectModel(Summary4.name)
    private readonly summary4Model: Model<Summary4Document>,
  ) {}

  // Available funds: compute and snapshot
  async computeAvailableFunds(params?: {
    collectedRevenue?: number;
    loanAvailable?: number;
    actualSpent?: number;
    reservedPayroll?: number;
    reservedInterest?: number;
    reservedPayables?: number;
    reservedSuppliers?: number;
    reservedAgents?: number;
    reservedOther?: number;
  }) {
    const [autoCollected, autoLoan, autoSpent] = await Promise.all([
      params?.collectedRevenue !== undefined ? Promise.resolve(undefined) : this.getCollectedRevenueToday(),
      params?.loanAvailable !== undefined ? Promise.resolve(undefined) : this.getLoanRoomAvailable(),
      params?.actualSpent !== undefined ? Promise.resolve(undefined) : this.getActualSpentToday(),
    ]);

    const collectedRevenue = params?.collectedRevenue ?? autoCollected ?? 0; // chỉ tính phần đã thu
    const loanAvailable = params?.loanAvailable ?? autoLoan ?? 0; // room vay còn lại
    const actualSpent = params?.actualSpent ?? autoSpent ?? 0; // đã chi thực tế trong ngày
    const reservedPayroll = params?.reservedPayroll ?? 0;
    const reservedInterest = params?.reservedInterest ?? 0;
    const reservedPayables = params?.reservedPayables ?? 0;
    const reservedSuppliers = params?.reservedSuppliers ?? 0;
    const reservedAgents = params?.reservedAgents ?? 0;
    const reservedOther = params?.reservedOther ?? 0;
    const reservedTotal = reservedPayroll + reservedInterest + reservedPayables + reservedSuppliers + reservedAgents + reservedOther;

    const available = collectedRevenue + loanAvailable - actualSpent - reservedTotal;

    return {
      collectedRevenue,
      loanAvailable,
      actualSpent,
      reservedPayroll,
      reservedInterest,
      reservedPayables,
      reservedSuppliers,
      reservedAgents,
      reservedOther,
      available,
      capturedAt: new Date(),
    };
  }

  async captureAvailableFunds(params?: {
    collectedRevenue?: number;
    loanAvailable?: number;
    actualSpent?: number;
    reservedPayroll?: number;
    reservedInterest?: number;
    reservedPayables?: number;
    reservedSuppliers?: number;
    reservedAgents?: number;
    reservedOther?: number;
    note?: string;
  }) {
    const computed = await this.computeAvailableFunds(params);
    const doc = new this.availableFundModel({ ...computed, note: params?.note });
    return doc.save();
  }

  // Chạy tự động mỗi ngày 01:00 (Asia/Ho_Chi_Minh) để chụp snapshot vốn khả dụng
  @Cron('0 1 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async snapshotDailyAvailableFunds() {
    try {
      await this.captureAvailableFunds({ note: 'auto-daily' });
      this.logger.log('[available-funds] Auto snapshot created at 01:00');
    } catch (err) {
      this.logger.error('[available-funds] Auto snapshot failed', err as any);
    }
  }

  private getTodayRange() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  private async getCollectedRevenueToday(): Promise<number> {
    try {
      const { start, end } = this.getTodayRange();
      const res = await this.summary5Model.aggregate([
        { $match: { orderDate: { $gte: start, $lt: end } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$collectedAmount', 0] } } } },
      ]);
      if (res?.[0]?.total !== undefined) return res[0].total;

      // Fallback: dùng Summary4 nếu Summary5 chưa có dữ liệu
      const res4 = await this.summary4Model.aggregate([
        { $match: { orderDate: { $gte: start, $lt: end } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$collectedAmount', 0] } } } },
      ]);
      return res4?.[0]?.total ?? 0;
    } catch (err) {
      this.logger.warn(`getCollectedRevenueToday fallback to 0: ${err?.message ?? err}`);
      return 0;
    }
  }

  private async getLoanRoomAvailable(): Promise<number> {
    try {
      const res = await this.loanModel.aggregate([
        { $match: { status: { $ne: 'closed' } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$principalRemaining', '$principal'] } } } },
      ]);
      return res?.[0]?.total ?? 0;
    } catch (err) {
      this.logger.warn(`getLoanRoomAvailable fallback to 0: ${err?.message ?? err}`);
      return 0;
    }
  }

  private async getActualSpentToday(): Promise<number> {
    try {
      const { start, end } = this.getTodayRange();
      const res = await this.cashflowModel.aggregate([
        { $match: { direction: 'out', date: { $gte: start, $lt: end } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } },
      ]);
      return res?.[0]?.total ?? 0;
    } catch (err) {
      this.logger.warn(`getActualSpentToday fallback to 0: ${err?.message ?? err}`);
      return 0;
    }
  }

  async listAvailableFundSnapshots(limit = 50) {
    return this.availableFundModel.find().sort({ capturedAt: -1 }).limit(limit).lean();
  }

  // Funding sources
  async createFundingSource(dto: CreateFundingSourceDto) {
    const doc = new this.fundingSourceModel({
      ...dto,
      availableBalance: dto.availableBalance ?? dto.principal ?? 0,
    });
    return doc.save();
  }

  async listFundingSources(filter: { type?: string; status?: string }) {
    const q: any = {};
    if (filter.type) q.type = filter.type;
    if (filter.status) q.status = filter.status;
    return this.fundingSourceModel.find(q).sort({ createdAt: -1 }).lean();
  }

  async updateFundingSource(id: string, dto: UpdateFundingSourceDto) {
    const updated = await this.fundingSourceModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Funding source not found');
    return updated;
  }

  // Budget buckets
  async createBudgetBucket(dto: CreateBudgetBucketDto) {
    const doc = new this.budgetBucketModel(dto);
    return doc.save();
  }

  async listBudgetBuckets() {
    return this.budgetBucketModel.find().sort({ createdAt: -1 }).lean();
  }

  async updateBudgetBucket(id: string, dto: UpdateBudgetBucketDto) {
    const updated = await this.budgetBucketModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Budget bucket not found');
    return updated;
  }

  // Cashflows
  async createCashflow(dto: CreateCashflowEntryDto) {
    const doc = new this.cashflowModel(dto);
    const saved = await doc.save();

    // Nếu là tiền vào và có fundingSourceId → tăng availableBalance
    if (dto.direction === 'in' && dto.fundingSourceId) {
      await this.fundingSourceModel.updateOne(
        { _id: dto.fundingSourceId },
        { $inc: { availableBalance: dto.amount } },
      );
    }

    // Nếu là tiền ra và có fundingSourceId → giảm availableBalance
    if (dto.direction === 'out' && dto.fundingSourceId) {
      await this.fundingSourceModel.updateOne(
        { _id: dto.fundingSourceId },
        { $inc: { availableBalance: -dto.amount } },
      );
    }

    return saved;
  }

  async listCashflows(filter: { direction?: string; sourceType?: string; bucketId?: string }) {
    const q: any = {};
    if (filter.direction) q.direction = filter.direction;
    if (filter.sourceType) q.sourceType = filter.sourceType;
    if (filter.bucketId) q.bucketId = filter.bucketId;
    return this.cashflowModel.find(q).sort({ date: -1 }).lean();
  }

  // Summary view for management
  async summary() {
    const [totals, buckets] = await Promise.all([
      this.cashflowModel.aggregate([
        {
          $group: {
            _id: '$direction',
            total: { $sum: '$amount' },
          },
        },
      ]),
      this.budgetBucketModel.aggregate([
        {
          $project: {
            name: 1,
            code: 1,
            productGroupIds: 1,
            dailyCap: 1,
            weeklyCap: 1,
            monthlyCap: 1,
            linkedSources: 1,
          },
        },
      ]),
    ]);

    const totalIn = totals.find(t => t._id === 'in')?.total || 0;
    const totalOut = totals.find(t => t._id === 'out')?.total || 0;

    return {
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      buckets,
    };
  }

  // Loan contracts
  async createLoanContract(dto: CreateLoanContractDto) {
    const doc = new this.loanModel({
      ...dto,
      principalRemaining: dto.principal,
    });
    return doc.save();
  }

  async listLoanContracts(status?: string) {
    const q: any = {};
    if (status) q.status = status;
    return this.loanModel.find(q).sort({ createdAt: -1 }).lean();
  }

  async getLoanContract(id: string) {
    const doc = await this.loanModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Loan contract not found');
    return doc;
  }

  async updateLoanContract(id: string, dto: UpdateLoanContractDto) {
    const updated = await this.loanModel.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!updated) throw new NotFoundException('Loan contract not found');
    return updated;
  }

  // Loan repayments
  async createLoanRepayment(dto: CreateLoanRepaymentDto) {
    const loan = await this.loanModel.findById(dto.loanId);
    if (!loan) throw new NotFoundException('Loan contract not found');

    const doc = new this.repaymentModel(dto);
    const saved = await doc.save();

    if (dto.paid) {
      await this.applyRepaymentEffects(saved);
    }

    return saved;
  }

  async listLoanRepayments(loanId: string) {
    return this.repaymentModel.find({ loanId }).sort({ dueDate: 1 }).lean();
  }

  async listUpcomingRepayments(daysAhead = 7) {
    const today = new Date();
    const future = new Date(today.getTime() + daysAhead * 86400000);
    return this.repaymentModel
      .find({
        paid: { $ne: true },
        dueDate: { $gte: today, $lte: future },
      })
      .sort({ dueDate: 1 })
      .lean();
  }

  // Helper: áp dụng ảnh hưởng khi đã trả (giảm dư nợ, ghi cashflow)
  private async applyRepaymentEffects(rep: LoanRepaymentDocument) {
    const principalDelta = rep.amountPrincipal || 0;
    const interest = rep.amountInterest || 0;
    const paidDate = rep.paidDate || new Date();

    await this.loanModel.updateOne(
      { _id: rep.loanId },
      { $inc: { principalRemaining: -principalDelta }, $set: { updatedAt: new Date() } },
    );

    await this.cashflowModel.create({
      direction: 'out',
      sourceType: 'loan',
      amount: principalDelta + interest,
      date: paidDate,
      category: 'loan_repayment',
      referenceId: String(rep._id),
      description: 'Trả nợ vay (gốc+lãi)',
    });
  }

  // Cron: nhắc lịch trả nợ sắp đến hạn (T-3 ngày)
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async remindUpcomingRepayments() {
    const today = new Date();
    const threeDaysLater = new Date(today.getTime() + 3 * 86400000);
    const dues = await this.repaymentModel.find({
      paid: { $ne: true },
      dueDate: { $lte: threeDaysLater },
    }).lean();

    if (dues.length) {
      this.logger.warn(`[LoanReminder] ${dues.length} kỳ trả nợ sắp đến hạn trong 3 ngày`);
    }
    return dues.length;
  }
}
