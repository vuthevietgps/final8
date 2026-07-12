import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Owner, OwnerDocument } from './schemas/owner.schema';
import { Withdrawal, WithdrawalDocument, WithdrawalStatus, WithdrawalType } from './schemas/withdrawal.schema';
import { FundTransaction, FundTransactionDocument, FundTransactionType, FundTransactionCategory } from './schemas/fund-transaction.schema';
import { OwnerFundAccount, OwnerFundAccountDocument } from './schemas/owner-fund-account.schema';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ApproveWithdrawalDto } from './dto/approve-withdrawal.dto';
import { CreateFundTransactionDto } from './dto/create-fund-transaction.dto';
import { TransferToOwnerFundDto, TransferFromOwnerFundDto, OwnerWithdrawFromFundDto } from './dto/transfer.dto';
import { FinancialControlService } from '../finance/financial-control.service';
import { FinanceService } from '../finance/finance.service';
import { FinanceEvents } from '../finance/events/finance-events.constants';

@Injectable()
export class OwnerFundService {
  private readonly logger = new Logger(OwnerFundService.name);

  constructor(
    @InjectModel(Owner.name) private ownerModel: Model<OwnerDocument>,
    @InjectModel(Withdrawal.name) private withdrawalModel: Model<WithdrawalDocument>,
    @InjectModel(FundTransaction.name) private fundTransactionModel: Model<FundTransactionDocument>,
    @InjectModel(OwnerFundAccount.name) private fundAccountModel: Model<OwnerFundAccountDocument>,
    @Inject(forwardRef(() => FinancialControlService))
    private financialControlService: FinancialControlService,
    @Inject(forwardRef(() => FinanceService))
    private financeService: FinanceService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private normalizeFinancialIdempotencyKey(prefix: string, value: unknown): string {
    const raw = String(value || '').trim();
    if (!raw) throw new BadRequestException('idempotencyKey is required for financial transactions');
    return `${prefix}:${raw}`;
  }

  private assertAuthenticatedActorId(userId: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Authenticated actor id is invalid');
    }
    return new Types.ObjectId(userId);
  }

  private buildFlexibleOwnerIdFilter(ownerId: string): Record<string, unknown> {
    return {
      $expr: {
        $eq: [{ $toString: '$ownerId' }, ownerId],
      },
    };
  }

  // ==================== OWNER MANAGEMENT ====================

  async createOwner(createOwnerDto: CreateOwnerDto): Promise<Owner> {
    const owner = new this.ownerModel(createOwnerDto);
    return owner.save();
  }

  async findAllOwners(): Promise<Owner[]> {
    return this.ownerModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOwnerById(id: string): Promise<Owner> {
    const owner = await this.ownerModel.findById(id).exec();
    if (!owner) {
      throw new NotFoundException(`Owner with ID ${id} not found`);
    }
    return owner;
  }

  async updateOwner(id: string, updateOwnerDto: UpdateOwnerDto): Promise<Owner> {
    const owner = await this.ownerModel.findByIdAndUpdate(
      id,
      updateOwnerDto,
      { new: true },
    ).exec();

    if (!owner) {
      throw new NotFoundException(`Owner with ID ${id} not found`);
    }

    return owner;
  }

  async deleteOwner(id: string): Promise<void> {
    const owner = await this.ownerModel.findById(id).exec();
    if (!owner) {
      throw new NotFoundException(`Owner with ID ${id} not found`);
    }

    const ownerFilter = this.buildFlexibleOwnerIdFilter(id);
    const [withdrawalCount, fundTransactionCount] = await Promise.all([
      this.withdrawalModel.countDocuments(ownerFilter).exec(),
      this.fundTransactionModel.countDocuments(ownerFilter).exec(),
    ]);

    if (withdrawalCount > 0 || fundTransactionCount > 0) {
      throw new BadRequestException(
        `Cannot delete owner with existing financial history (withdrawals=${withdrawalCount}, fundTransactions=${fundTransactionCount})`,
      );
    }

    await owner.deleteOne();
  }

  // ==================== WITHDRAWAL MANAGEMENT ====================

  async createWithdrawal(createWithdrawalDto: CreateWithdrawalDto): Promise<Withdrawal> {
    const owner = await this.findOwnerById(createWithdrawalDto.ownerId);

    // Kiá»ƒm tra sá»‘ dÆ° kháº£ dá»¥ng
    if (createWithdrawalDto.amount > owner.availableBalance) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${owner.availableBalance.toLocaleString('vi-VN')}Ä‘, Requested: ${createWithdrawalDto.amount.toLocaleString('vi-VN')}Ä‘`
      );
    }

    const withdrawal = new this.withdrawalModel({
      ...createWithdrawalDto,
      requestDate: new Date(),
      status: WithdrawalStatus.PENDING,
    });

    return withdrawal.save();
  }

  async findAllWithdrawals(filters?: {
    ownerId?: string;
    status?: WithdrawalStatus;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Withdrawal[]> {
    const query: any = {};

    if (filters?.ownerId) {
      Object.assign(query, this.buildFlexibleOwnerIdFilter(filters.ownerId));
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      query.requestDate = {};
      if (filters.startDate) query.requestDate.$gte = filters.startDate;
      if (filters.endDate) query.requestDate.$lte = filters.endDate;
    }

    return this.withdrawalModel
      .find(query)
      .populate('ownerId', 'name email phone')
      .populate('approvedBy', 'name email')
      .sort({ requestDate: -1 })
      .exec();
  }

  async findWithdrawalById(id: string): Promise<Withdrawal> {
    const withdrawal = await this.withdrawalModel
      .findById(id)
      .populate('ownerId', 'name email phone bankAccount bankName bankAccountName')
      .populate('approvedBy', 'name email')
      .exec();

    if (!withdrawal) {
      throw new NotFoundException(`Withdrawal with ID ${id} not found`);
    }

    return withdrawal;
  }

  async approveWithdrawal(id: string, approveDto: ApproveWithdrawalDto): Promise<Withdrawal> {
    const session = await this.withdrawalModel.db.startSession();
    let approvedAmount = 0;
    let ownerName = '';
    let approvedWithdrawal: WithdrawalDocument | null = null;

    try {
      await session.withTransaction(async () => {
        const approvedDate = new Date();
        const withdrawal = await this.withdrawalModel.findOneAndUpdate(
          { _id: id, status: WithdrawalStatus.PENDING },
          {
            $set: {
              status: WithdrawalStatus.APPROVED,
              approvedDate,
              approvedBy: approveDto.approvedBy,
              approvalNotes: approveDto.approvalNotes,
              transactionReference: approveDto.transactionReference,
            },
          },
          { new: true, session },
        ).exec();

        if (!withdrawal) {
          await this.throwWithdrawalTransitionFailure(id, 'approve', session);
        }

        approvedAmount = withdrawal.amount;
        approvedWithdrawal = withdrawal;

        const owner = await this.ownerModel.findOneAndUpdate(
          {
            _id: withdrawal.ownerId,
            availableBalance: { $gte: withdrawal.amount },
          },
          {
            $inc: {
              availableBalance: -withdrawal.amount,
              totalWithdrawn: withdrawal.amount,
            },
          },
          { new: true, session },
        ).exec();

        if (!owner) {
          throw new BadRequestException('Insufficient balance for approval');
        }

        const withdrawalFundTransaction = new this.fundTransactionModel({
          ownerId: withdrawal.ownerId,
          type: FundTransactionType.OUT,
          category: this.getWithdrawalFundTransactionCategory(withdrawal.type),
          amount: withdrawal.amount,
          date: approvedDate,
          description: withdrawal.reason || 'Owner withdrawal approved',
          notes: withdrawal.notes || approveDto.approvalNotes,
          referenceId: String(withdrawal._id),
          reference: approveDto.transactionReference || `WITHDRAWAL_${String(withdrawal._id)}`,
          referenceType: 'withdrawal',
          createdBy: approveDto.approvedBy,
          balanceAfter: owner.availableBalance,
          bankAccount: withdrawal.bankAccount,
          bankName: withdrawal.bankName,
        });
        await withdrawalFundTransaction.save({ session });

        ownerName = owner.name;
      });
    } catch (error) {
      await this.rethrowWithdrawalTransitionConflict(error, id, 'approve');
    } finally {
      await session.endSession();
    }

    if (!approvedWithdrawal) {
      throw new NotFoundException(`Withdrawal with ID ${id} not found`);
    }

    this.emitOwnerFundChanged(String(approvedWithdrawal.ownerId), approvedAmount);
    this.logger.log(`Approved withdrawal ${id}: ${approvedAmount.toLocaleString('vi-VN')} for owner ${ownerName}`);
    return approvedWithdrawal;
  }

  async completeWithdrawal(id: string, transactionReference?: string): Promise<Withdrawal> {
    const updateData: Record<string, unknown> = {
      status: WithdrawalStatus.COMPLETED,
      completedDate: new Date(),
    };
    if (transactionReference) {
      updateData.transactionReference = transactionReference;
    }

    const withdrawal = await this.transitionWithdrawalStatus(
      id,
      'complete',
      WithdrawalStatus.APPROVED,
      updateData,
    );

    if (transactionReference) {
      await this.syncWithdrawalLedgerReference(id, transactionReference);
    }

    this.logger.log(`Completed withdrawal ${id}: ${withdrawal.amount.toLocaleString('vi-VN')}`);
    return withdrawal;
  }

  private async syncWithdrawalLedgerReference(id: string, transactionReference: string): Promise<void> {
    const result = await this.fundTransactionModel.updateOne(
      {
        referenceId: id,
        referenceType: 'withdrawal',
      },
      {
        $set: {
          reference: transactionReference,
        },
      },
    ).exec();

    if (!result.matchedCount) {
      this.logger.warn(`Missing withdrawal ledger entry while completing withdrawal ${id}`);
    }
  }

  private getWithdrawalFundTransactionCategory(type?: WithdrawalType): FundTransactionCategory {
    switch (type) {
      case WithdrawalType.EMERGENCY:
        return FundTransactionCategory.WITHDRAWAL_EMERGENCY;
      case WithdrawalType.ADVANCE:
        return FundTransactionCategory.WITHDRAWAL_ADVANCE;
      case WithdrawalType.PROFIT_SHARE:
      default:
        return FundTransactionCategory.WITHDRAWAL_PROFIT;
    }
  }

  private emitOwnerFundChanged(accountId: string, amount: number): void {
    this.eventEmitter.emit(FinanceEvents.OWNER_FUND_CHANGED, {
      accountId,
      type: 'withdrawal',
      amount,
    });
  }

  async rejectWithdrawal(id: string, approveDto: ApproveWithdrawalDto): Promise<Withdrawal> {
    const withdrawal = await this.transitionWithdrawalStatus(
      id,
      'reject',
      WithdrawalStatus.PENDING,
      {
        status: WithdrawalStatus.REJECTED,
        approvedDate: new Date(),
        approvedBy: approveDto.approvedBy,
        approvalNotes: approveDto.approvalNotes,
      },
    );

    this.logger.log(`Rejected withdrawal ${id}: ${withdrawal.amount.toLocaleString('vi-VN')}`);
    return withdrawal;
  }

  async cancelWithdrawal(id: string): Promise<Withdrawal> {
    const withdrawal = await this.transitionWithdrawalStatus(
      id,
      'cancel',
      WithdrawalStatus.PENDING,
      { status: WithdrawalStatus.CANCELLED },
    );

    return withdrawal;
  }

  private async transitionWithdrawalStatus(
    id: string,
    action: 'complete' | 'reject' | 'cancel',
    expectedStatus: WithdrawalStatus,
    setFields: Record<string, unknown>,
  ): Promise<WithdrawalDocument> {
    const session = await this.withdrawalModel.db.startSession();
    let updatedWithdrawal: WithdrawalDocument | null = null;

    try {
      await session.withTransaction(async () => {
        updatedWithdrawal = await this.withdrawalModel.findOneAndUpdate(
          { _id: id, status: expectedStatus },
          { $set: setFields },
          { new: true, session },
        ).exec();

        if (!updatedWithdrawal) {
          await this.throwWithdrawalTransitionFailure(id, action, session);
        }
      });
    } catch (error) {
      await this.rethrowWithdrawalTransitionConflict(error, id, action);
    } finally {
      await session.endSession();
    }

    if (!updatedWithdrawal) {
      throw new NotFoundException(`Withdrawal with ID ${id} not found`);
    }

    return updatedWithdrawal;
  }

  private async throwWithdrawalTransitionFailure(
    id: string,
    action: 'approve' | 'complete' | 'reject' | 'cancel',
    session?: ClientSession,
  ): Promise<never> {
    const existing = session
      ? await this.withdrawalModel.findById(id).session(session).exec()
      : await this.withdrawalModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`Withdrawal with ID ${id} not found`);
    }
    throw new BadRequestException(`Cannot ${action} withdrawal with status: ${existing.status}`);
  }

  private async rethrowWithdrawalTransitionConflict(
    error: unknown,
    id: string,
    action: 'approve' | 'complete' | 'reject' | 'cancel',
  ): Promise<never> {
    const message = String((error as any)?.message || '');
    if (message.includes('WriteConflict') || message.includes('TransientTransactionError')) {
      await this.throwWithdrawalTransitionFailure(id, action);
    }
    throw error;
  }

  // ==================== STATISTICS ====================

  async getOwnerStatistics(ownerId: string): Promise<any> {
    const owner = await this.findOwnerById(ownerId);

    const withdrawals = await this.withdrawalModel.find(this.buildFlexibleOwnerIdFilter(ownerId)).exec();

    const pending = withdrawals.filter(w => w.status === WithdrawalStatus.PENDING);
    const approved = withdrawals.filter(w => w.status === WithdrawalStatus.APPROVED);
    const completed = withdrawals.filter(w => w.status === WithdrawalStatus.COMPLETED);
    const rejected = withdrawals.filter(w => w.status === WithdrawalStatus.REJECTED);

    return {
      owner: {
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        profitSharePercentage: owner.profitSharePercentage,
      },
      balance: {
        available: owner.availableBalance,
        totalWithdrawn: owner.totalWithdrawn,
      },
      withdrawals: {
        total: withdrawals.length,
        pending: {
          count: pending.length,
          amount: pending.reduce((sum, w) => sum + w.amount, 0),
        },
        approved: {
          count: approved.length,
          amount: approved.reduce((sum, w) => sum + w.amount, 0),
        },
        completed: {
          count: completed.length,
          amount: completed.reduce((sum, w) => sum + w.amount, 0),
        },
        rejected: {
          count: rejected.length,
          amount: rejected.reduce((sum, w) => sum + w.amount, 0),
        },
      },
      recentWithdrawals: withdrawals.slice(0, 10),
    };
  }

  async getSystemStatistics(): Promise<any> {
    const owners = await this.ownerModel.find().exec();
    const withdrawals = await this.withdrawalModel.find().exec();

    const pending = withdrawals.filter(w => w.status === WithdrawalStatus.PENDING);
    const urgent = withdrawals.filter(w => w.isUrgent && w.status === WithdrawalStatus.PENDING);

    return {
      owners: {
        total: owners.length,
        active: owners.filter(o => o.isActive).length,
        totalBalance: owners.reduce((sum, o) => sum + o.availableBalance, 0),
        totalWithdrawn: owners.reduce((sum, o) => sum + o.totalWithdrawn, 0),
      },
      withdrawals: {
        total: withdrawals.length,
        pending: {
          count: pending.length,
          amount: pending.reduce((sum, w) => sum + w.amount, 0),
        },
        urgent: {
          count: urgent.length,
          amount: urgent.reduce((sum, w) => sum + w.amount, 0),
        },
        thisMonth: {
          count: withdrawals.filter(w => {
            const now = new Date();
            const wDate = new Date(w.requestDate);
            return wDate.getMonth() === now.getMonth() &&
                   wDate.getFullYear() === now.getFullYear();
          }).length,
        },
      },
    };
  }

  /**
   * Cáº­p nháº­t sá»‘ dÆ° Owner tá»« lá»£i nhuáº­n
   * ÄÆ°á»£c gá»i tá»« Financial Control khi phÃ¢n bá»• lá»£i nhuáº­n
   */
  async updateOwnerBalance(ownerId: string, profitAmount: number): Promise<Owner> {
    const owner = await this.findOwnerById(ownerId);

    await this.ownerModel.findByIdAndUpdate(ownerId, {
      $inc: { availableBalance: profitAmount },
    });

    this.logger.log(`ðŸ’° Updated owner ${owner.name} balance: +${profitAmount.toLocaleString('vi-VN')}Ä‘, new balance: ${owner.availableBalance.toLocaleString('vi-VN')}Ä‘`);

    return owner;
  }

  // ==================== FUND TRANSACTIONS ====================

  /**
   * Táº¡o giao dá»‹ch quá»¹ má»›i (tiá»n vÃ o/ra)
   */
  async createFundTransaction(dto: CreateFundTransactionDto): Promise<FundTransaction> {
    const owner = await this.findOwnerById(dto.ownerId);

    // Kiá»ƒm tra náº¿u lÃ  tiá»n ra (OUT), Ä‘áº£m báº£o Ä‘á»§ sá»‘ dÆ°
    if (dto.type === FundTransactionType.OUT && dto.amount > owner.availableBalance) {
      throw new BadRequestException(
        `Sá»‘ dÆ° khÃ´ng Ä‘á»§. Kháº£ dá»¥ng: ${owner.availableBalance.toLocaleString('vi-VN')}Ä‘, YÃªu cáº§u: ${dto.amount.toLocaleString('vi-VN')}Ä‘`
      );
    }

    // Cáº­p nháº­t sá»‘ dÆ° owner
    const balanceChange = dto.type === FundTransactionType.IN ? dto.amount : -dto.amount;
    const newBalance = owner.availableBalance + balanceChange;

    await this.ownerModel.findByIdAndUpdate(dto.ownerId, {
      $inc: {
        availableBalance: balanceChange,
        totalWithdrawn: dto.type === FundTransactionType.OUT ? dto.amount : 0,
      },
    });

    // Táº¡o transaction record
    const transaction = new this.fundTransactionModel({
      ...dto,
      date: dto.date ? new Date(dto.date) : new Date(),
      balanceAfter: newBalance,
    });

    this.logger.log(`ðŸ’¸ Fund transaction: ${dto.type === FundTransactionType.IN ? '+' : '-'}${dto.amount.toLocaleString('vi-VN')}Ä‘ for owner ${owner.name}`);

    return transaction.save();
  }

  /**
   * Láº¥y danh sÃ¡ch giao dá»‹ch quá»¹
   */
  async findAllFundTransactions(filters?: {
    ownerId?: string;
    type?: FundTransactionType;
    category?: FundTransactionCategory;
    startDate?: Date;
    endDate?: Date;
  }): Promise<FundTransaction[]> {
    const query: any = {};

    if (filters?.ownerId) Object.assign(query, this.buildFlexibleOwnerIdFilter(filters.ownerId));
    if (filters?.type) query.type = filters.type;
    if (filters?.category) query.category = filters.category;

    if (filters?.startDate || filters?.endDate) {
      query.date = {};
      if (filters.startDate) query.date.$gte = filters.startDate;
      if (filters.endDate) query.date.$lte = filters.endDate;
    }

    return this.fundTransactionModel
      .find(query)
      .populate('ownerId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ date: -1 })
      .exec();
  }

  /**
   * Láº¥y tá»•ng há»£p quá»¹ Owner vá»›i owner withdrawable tá»« Financial Control
   */
  async getFundSummary(): Promise<any> {
    const owners = await this.ownerModel.find({ isActive: true }).exec();

    // Láº¥y táº¥t cáº£ transactions
    const allTransactions = await this.fundTransactionModel.find().exec();

    // TÃ­nh tá»•ng tiá»n vÃ o/ra
    const totalIn = allTransactions
      .filter(t => t.type === FundTransactionType.IN)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalOut = allTransactions
      .filter(t => t.type === FundTransactionType.OUT)
      .reduce((sum, t) => sum + t.amount, 0);

    // TÃ­nh tá»•ng sá»‘ dÆ° tá»« owners
    const totalBalance = owners.reduce((sum, o) => sum + o.availableBalance, 0);
    const totalWithdrawn = owners.reduce((sum, o) => sum + o.totalWithdrawn, 0);

    // Láº¥y owner withdrawable tá»« Financial Control
    let ownerWithdrawable = 0;
    let cfoDashboard: any = null;
    try {
      cfoDashboard = await this.financialControlService.getDashboard();
      ownerWithdrawable = cfoDashboard.ownerWithdrawable || 0;
    } catch (err) {
      this.logger.warn('Failed to get CFO dashboard for owner withdrawable');
    }

    // Pending withdrawals
    const pendingWithdrawals = await this.withdrawalModel.find({
      status: WithdrawalStatus.PENDING
    }).exec();
    const pendingAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);

    // Transactions gáº§n Ä‘Ã¢y (30 ngÃ y)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentIn = allTransactions
      .filter(t => t.type === FundTransactionType.IN && new Date(t.date) >= thirtyDaysAgo)
      .reduce((sum, t) => sum + t.amount, 0);

    const recentOut = allTransactions
      .filter(t => t.type === FundTransactionType.OUT && new Date(t.date) >= thirtyDaysAgo)
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      summary: {
        totalIn,           // Tá»•ng tiá»n Ä‘Ã£ vÃ o quá»¹
        totalOut,          // Tá»•ng tiá»n Ä‘Ã£ ra quá»¹
        totalBalance,      // Sá»‘ dÆ° hiá»‡n táº¡i trong quá»¹
        totalWithdrawn,    // Tá»•ng Ä‘Ã£ rÃºt (táº¥t cáº£ thá»i gian)
        ownerWithdrawable, // Sá»‘ tiá»n cÃ³ thá»ƒ rÃºt an toÃ n (tá»« CFO)
        pendingAmount,     // Sá»‘ tiá»n Ä‘ang chá» duyá»‡t rÃºt
      },
      recent30Days: {
        in: recentIn,
        out: recentOut,
        net: recentIn - recentOut,
      },
      owners: owners.map(o => ({
        _id: o._id,
        name: o.name,
        availableBalance: o.availableBalance,
        totalWithdrawn: o.totalWithdrawn,
        profitSharePercentage: o.profitSharePercentage,
      })),
      cfoDashboard: cfoDashboard ? {
        bankBalance: cfoDashboard.bankBalance,
        freeCash: cfoDashboard.freeCash,
        runwayMonths: cfoDashboard.runwayMonths,
        ownerWithdrawable: cfoDashboard.ownerWithdrawable,
      } : null,
    };
  }

  /**
   * Láº¥y lá»‹ch sá»­ giao dá»‹ch cá»§a má»™t owner
   */
  async getOwnerTransactionHistory(ownerId: string): Promise<any> {
    const owner = await this.findOwnerById(ownerId);

    const transactions = await this.fundTransactionModel
      .find(this.buildFlexibleOwnerIdFilter(ownerId))
      .sort({ date: -1 })
      .limit(100)
      .exec();

    const totalIn = transactions
      .filter(t => t.type === FundTransactionType.IN)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalOut = transactions
      .filter(t => t.type === FundTransactionType.OUT)
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      owner: {
        _id: (owner as OwnerDocument)._id,
        name: owner.name,
        availableBalance: owner.availableBalance,
        totalWithdrawn: owner.totalWithdrawn,
      },
      summary: {
        totalIn,
        totalOut,
        net: totalIn - totalOut,
      },
      transactions,
    };
  }

  // ==================== OWNER FUND ACCOUNT (Quá»¹ Owner riÃªng biá»‡t) ====================

  /**
   * Láº¥y hoáº·c táº¡o tÃ i khoáº£n Quá»¹ Owner
   */
  async getOrCreateFundAccount(session?: ClientSession): Promise<OwnerFundAccountDocument> {
    const query = this.fundAccountModel.findOne();
    if (session) query.session(session);
    let account = await query.exec();

    if (!account) {
      // Táº¡o tÃ i khoáº£n máº·c Ä‘á»‹nh náº¿u chÆ°a cÃ³
      account = new this.fundAccountModel({
        name: 'Quá»¹ Owner',
        balance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalReturnedToCompany: 0,
        bankAccount: '',
        bankName: '',
        isActive: true,
      });
      await account.save(session ? { session } : undefined);
      this.logger.log('âœ… Created default Owner Fund Account');
    }

    return account;
  }

  /**
   * Láº¥y thÃ´ng tin tÃ i khoáº£n Quá»¹ Owner
   */
  async getFundAccount(): Promise<any> {
    const account = await this.getOrCreateFundAccount();

    // Láº¥y owner withdrawable tá»« CFO
    let ownerWithdrawable = 0;
    try {
      const dashboard = await this.financialControlService.getDashboard();
      ownerWithdrawable = dashboard.ownerWithdrawable || 0;
    } catch (err) {
      this.logger.warn('Failed to get owner withdrawable from CFO dashboard');
    }

    return {
      account,
      ownerWithdrawable,  // Sá»‘ tiá»n cÃ³ thá»ƒ chuyá»ƒn thÃªm tá»« Bank Balance
      canTransferToFund: ownerWithdrawable,  // Alias cho rÃµ nghÄ©a hÆ¡n
    };
  }

  /**
   * Chuyá»ƒn tiá»n Tá»ª Bank Balance VÃ€O Quá»¹ Owner
   * - Giáº£m Bank Balance (táº¡o CashflowEntry type: OUT)
   * - TÄƒng sá»‘ dÆ° Quá»¹ Owner
   * - Sá»‘ tiá»n chuyá»ƒn khÃ´ng vÆ°á»£t quÃ¡ Owner Withdrawable
   */
  async transferToOwnerFund(dto: TransferToOwnerFundDto, userId: string): Promise<any> {
    return this.transferToOwnerFundTransactional(dto, userId);
  }

  /**
   * Chuyá»ƒn tiá»n Tá»ª Quá»¹ Owner Vá»€ Bank Balance (tráº£ láº¡i cho cÃ´ng ty)
   * - TÄƒng Bank Balance (táº¡o CashflowEntry type: IN)
   * - Giáº£m sá»‘ dÆ° Quá»¹ Owner
   */
  private async transferToOwnerFundTransactional(
    dto: TransferToOwnerFundDto,
    userId: string,
  ): Promise<any> {
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('Transfer amount must be a positive finite number');
    }
    const actorId = this.assertAuthenticatedActorId(userId);
    const idempotencyKey = this.normalizeFinancialIdempotencyKey('owner-transfer-in', dto.idempotencyKey);
    if (await this.financeService.hasCashflowIdempotencyKey(idempotencyKey)) {
      throw new ConflictException('Owner transfer with this idempotencyKey was already processed');
    }

    const session = await this.fundAccountModel.db.startSession();
    let cashflowEntry: any;
    let transaction: FundTransactionDocument | undefined;
    let newFundBalance = 0;
    let accountId = '';
    const referenceId = `OWNER_FUND_${new Date().getTime()}_${Math.random().toString(36).slice(2, 10)}`;

    try {
      await session.withTransaction(async () => {
        const account = await this.getOrCreateFundAccount(session);
        accountId = String(account._id);

        // Database-backed mutex: a concurrent transfer conflicts on this write.
        // withTransaction retries the entire callback, including the fresh FC check.
        const lockedAccount = await this.fundAccountModel.findOneAndUpdate(
          { _id: account._id },
          { $inc: { transferVersion: 1 } },
          { new: true, session },
        ).exec();
        if (!lockedAccount) {
          throw new BadRequestException('Owner Fund account is not available');
        }

        await this.financeService.acquireCashflowSerializationLock(session);

        await this.financeService.invalidateMasterBankBalanceCache('owner-fund-transfer:preflight');
        this.financialControlService.invalidateCache('owner-fund-transfer:preflight');

        let dashboard;
        try {
          dashboard = await this.financialControlService.getDashboard(true);
        } catch (error) {
          this.logger.warn('Failed to validate Owner transfer against Financial Control');
          throw new BadRequestException('Financial Control is unavailable; Owner transfer was not executed');
        }

        const ownerWithdrawable = Number(dashboard.ownerWithdrawable);
        if (
          dashboard.dataQuality?.isDecisionLocked ||
          !Number.isFinite(ownerWithdrawable) ||
          ownerWithdrawable < 0
        ) {
          throw new BadRequestException('Financial Control did not return a safe Owner withdrawal limit');
        }
        if (dto.amount > ownerWithdrawable) {
          throw new BadRequestException(
            `Transfer amount (${dto.amount.toLocaleString('vi-VN')}) exceeds the safe Owner withdrawal limit (${ownerWithdrawable.toLocaleString('vi-VN')})`,
          );
        }

        // CashflowEntry is the canonical bank ledger for Owner transfers.
        // FundingSource has no bank_account type, so do not mutate an arbitrary
        // capital source as a second pseudo-bank ledger.
        cashflowEntry = await this.financeService.createCashflow(
          {
            direction: 'out',
            idempotencyKey,
            sourceType: 'other',
            amount: dto.amount,
            description: dto.description || 'Transfer to Owner Fund',
            date: new Date().toISOString(),
            category: 'owner_fund_transfer',
            referenceId,
          },
          { session, emitEvent: false },
        );

        const updatedAccount = await this.fundAccountModel.findByIdAndUpdate(
          account._id,
          {
            $inc: {
              balance: dto.amount,
              totalDeposited: dto.amount,
            },
          },
          { new: true, session },
        ).exec();
        if (!updatedAccount) {
          throw new BadRequestException('Owner Fund account disappeared during transfer');
        }
        newFundBalance = updatedAccount.balance;

        transaction = new this.fundTransactionModel({
          type: FundTransactionType.IN,
          idempotencyKey,
          category: FundTransactionCategory.BANK_TRANSFER_IN,
          amount: dto.amount,
          description: dto.description || 'Transfer from Bank Balance to Owner Fund',
          date: new Date(),
          reference: referenceId,
          balanceAfter: newFundBalance,
          createdBy: actorId,
        });
        await transaction.save({ session });
      });
    } catch (error) {
      if ((error as any)?.code === 11000) {
        throw new ConflictException('Owner transfer with this idempotencyKey was already processed');
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!transaction || !cashflowEntry) {
      throw new BadRequestException('Owner transfer did not commit');
    }

    this.eventEmitter.emit(FinanceEvents.FINANCE_STATE_CHANGED, {
      source: 'owner_fund.transfer_in',
      entityId: String(transaction._id),
    });
    this.eventEmitter.emit(FinanceEvents.OWNER_FUND_CHANGED, {
      accountId,
      type: 'bank_transfer_in',
      amount: dto.amount,
    });

    this.logger.log(`Transferred ${dto.amount.toLocaleString('vi-VN')} from Bank Balance to Owner Fund`);
    return {
      success: true,
      message: `Transferred ${dto.amount.toLocaleString('vi-VN')} to Owner Fund`,
      transaction,
      cashflowEntry,
      newFundBalance,
    };
  }

  async transferFromOwnerFund(dto: TransferFromOwnerFundDto, userId: string): Promise<any> {
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('Transfer amount must be a positive finite number');
    }
    const actorId = this.assertAuthenticatedActorId(userId);
    const idempotencyKey = this.normalizeFinancialIdempotencyKey('owner-transfer-out', dto.idempotencyKey);
    if (await this.financeService.hasCashflowIdempotencyKey(idempotencyKey)) {
      throw new ConflictException('Owner transfer with this idempotencyKey was already processed');
    }

    const session = await this.fundAccountModel.db.startSession();
    let cashflowEntry: any;
    let transaction: FundTransactionDocument | undefined;
    let newFundBalance = 0;
    let accountId = '';
    const referenceId = `OWNER_RETURN_${idempotencyKey}`;

    try {
      await session.withTransaction(async () => {
        await this.financeService.acquireCashflowSerializationLock(session);
        const account = await this.getOrCreateFundAccount(session);
        accountId = String(account._id);

    if (dto.amount > account.balance) {
      throw new BadRequestException(
        `Sá»‘ dÆ° Quá»¹ Owner khÃ´ng Ä‘á»§. Hiá»‡n cÃ³: ${account.balance.toLocaleString('vi-VN')}Ä‘, YÃªu cáº§u: ${dto.amount.toLocaleString('vi-VN')}Ä‘`
      );
    }

    // 1. Táº¡o CashflowEntry vÃ  tÄƒng Bank Balance
    cashflowEntry = await this.financeService.createCashflow({
      idempotencyKey,
      direction: 'in',
      sourceType: 'other',
      amount: dto.amount,
      description: dto.description || 'Owner tráº£ tiá»n vá» Quá»¹ CÃ´ng Ty',
      date: new Date().toISOString(),
      category: 'owner_fund_return',
      referenceId,
    }, { session, emitEvent: false });

    // 2. Cáº­p nháº­t sá»‘ dÆ° tÃ i khoáº£n Quá»¹ Owner
    const updatedAccount = await this.fundAccountModel.findOneAndUpdate(
      { _id: account._id, balance: { $gte: dto.amount } },
      { $inc: { balance: -dto.amount, totalReturnedToCompany: dto.amount } },
      { new: true, session },
    ).exec();
    if (!updatedAccount) throw new BadRequestException('Owner Fund balance changed; transfer was not executed');
    newFundBalance = updatedAccount.balance;

    // 3. Ghi láº¡i giao dá»‹ch
    transaction = new this.fundTransactionModel({
      idempotencyKey,
      type: FundTransactionType.OUT,
      category: FundTransactionCategory.BANK_TRANSFER_OUT,
      amount: dto.amount,
      description: dto.description || 'Chuyá»ƒn tiá»n tá»« Quá»¹ Owner vá» Bank Balance',
      date: new Date(),
      reference: referenceId,
      balanceAfter: newFundBalance,
      createdBy: actorId,
    });
    await transaction.save({ session });
      });
    } catch (error) {
      if ((error as any)?.code === 11000) {
        throw new ConflictException('Owner transfer with this idempotencyKey was already processed');
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!transaction || !cashflowEntry) throw new BadRequestException('Owner transfer did not commit');
    this.eventEmitter.emit(FinanceEvents.FINANCE_STATE_CHANGED, {
      source: 'owner_fund.transfer_out',
      entityId: String(transaction._id),
    });
    this.eventEmitter.emit(FinanceEvents.OWNER_FUND_CHANGED, {
      accountId,
      type: 'bank_transfer_out',
      amount: dto.amount,
    });

    this.logger.log(`ðŸ’¸ Returned ${dto.amount.toLocaleString('vi-VN')}Ä‘ from Owner Fund to Bank Balance`);

    return {
      success: true,
      message: `ÄÃ£ chuyá»ƒn ${dto.amount.toLocaleString('vi-VN')}Ä‘ vá» Quá»¹ CÃ´ng Ty`,
      transaction,
      cashflowEntry,
      newFundBalance,
    };
  }

  /**
   * Owner rÃºt tiá»n tá»« Quá»¹ Owner (ra cÃ¡ nhÃ¢n)
   * - Giáº£m sá»‘ dÆ° Quá»¹ Owner
   * - KhÃ´ng áº£nh hÆ°á»Ÿng Bank Balance (vÃ¬ tiá»n Ä‘Ã£ náº±m trong Quá»¹ Owner rá»“i)
   */
  async ownerWithdrawFromFund(dto: OwnerWithdrawFromFundDto, userId: string): Promise<any> {
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('Withdrawal amount must be a positive finite number');
    }
    const actorId = this.assertAuthenticatedActorId(userId);
    const idempotencyKey = this.normalizeFinancialIdempotencyKey('owner-withdraw', dto.idempotencyKey);
    if (await this.fundTransactionModel.exists({ idempotencyKey })) {
      throw new ConflictException('Owner withdrawal with this idempotencyKey was already processed');
    }

    const session = await this.fundAccountModel.db.startSession();
    let transaction: FundTransactionDocument | undefined;
    let newFundBalance = 0;
    let accountId = '';

    try {
      await session.withTransaction(async () => {
        const account = await this.getOrCreateFundAccount(session);
        accountId = String(account._id);

    if (dto.amount > account.balance) {
      throw new BadRequestException(
        `Sá»‘ dÆ° Quá»¹ Owner khÃ´ng Ä‘á»§. Hiá»‡n cÃ³: ${account.balance.toLocaleString('vi-VN')}Ä‘, YÃªu cáº§u: ${dto.amount.toLocaleString('vi-VN')}Ä‘`
      );
    }

    // Cáº­p nháº­t sá»‘ dÆ°
    const updatedAccount = await this.fundAccountModel.findOneAndUpdate(
      { _id: account._id, balance: { $gte: dto.amount } },
      { $inc: { balance: -dto.amount, totalWithdrawn: dto.amount } },
      { new: true, session },
    ).exec();
    if (!updatedAccount) throw new BadRequestException('Owner Fund balance changed; withdrawal was not executed');
    newFundBalance = updatedAccount.balance;

    // Ghi láº¡i giao dá»‹ch
    transaction = new this.fundTransactionModel({
      idempotencyKey,
      type: FundTransactionType.OUT,
      category: FundTransactionCategory.PERSONAL_WITHDRAWAL,
      amount: dto.amount,
      description: dto.description || 'Owner rÃºt tiá»n vá» cÃ¡ nhÃ¢n',
      date: new Date(),
      reference: `OWNER_WITHDRAW_${idempotencyKey}`,
      balanceAfter: newFundBalance,
      createdBy: actorId,
      bankAccount: dto.bankAccount,
      bankName: dto.bankName,
    });
    await transaction.save({ session });
      });
    } catch (error) {
      if ((error as any)?.code === 11000) {
        throw new ConflictException('Owner withdrawal with this idempotencyKey was already processed');
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!transaction) throw new BadRequestException('Owner withdrawal did not commit');
    this.eventEmitter.emit(FinanceEvents.OWNER_FUND_CHANGED, {
      accountId,
      type: 'withdrawal',
      amount: dto.amount,
    });

    this.logger.log(`ðŸ’³ Owner withdrew ${dto.amount.toLocaleString('vi-VN')}Ä‘ from Owner Fund`);

    return {
      success: true,
      message: `ÄÃ£ rÃºt ${dto.amount.toLocaleString('vi-VN')}Ä‘ tá»« Quá»¹ Owner`,
      transaction,
      newFundBalance,
    };
  }

  /**
   * Cáº­p nháº­t thÃ´ng tin tÃ i khoáº£n Quá»¹ Owner (bank info)
   */
  async updateFundAccount(updateDto: { bankAccount?: string; bankName?: string; name?: string }): Promise<OwnerFundAccount> {
    const account = await this.getOrCreateFundAccount();

    await this.fundAccountModel.findByIdAndUpdate(account._id, {
      $set: updateDto,
    });

    return this.fundAccountModel.findById(account._id).exec();
  }

  // ==================== LOAN PAYMENT SUPPORT ====================

  /**
   * Láº¥y danh sÃ¡ch táº¥t cáº£ tÃ i khoáº£n Quá»¹ Owner
   */
  async listFundAccounts(): Promise<OwnerFundAccountDocument[]> {
    return this.fundAccountModel.find({ isActive: true }).exec();
  }

  /**
   * Láº¥y tÃ i khoáº£n Quá»¹ Owner theo ID
   */
  async getFundAccountById(accountId: string): Promise<OwnerFundAccountDocument | null> {
    return this.fundAccountModel.findById(accountId).exec();
  }

  /**
   * Láº¥y tá»•ng há»£p táº¥t cáº£ accounts
   */
  async getAccountsSummary(): Promise<{ totalBalance: number; accounts: any[] }> {
    const accounts = await this.listFundAccounts();
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    return {
      totalBalance,
      accounts: accounts.map(a => ({
        _id: a._id,
        name: a.name,
        balance: a.balance || 0,
      })),
    };
  }

  /**
   * Trá»« tiá»n tá»« tÃ i khoáº£n Quá»¹ Owner (cho loan payment)
   */
  async deductFromAccount(
    accountId: string,
    amount: number,
    metadata: { category: string; description: string; referenceId: string },
    session?: ClientSession,
  ): Promise<number> {
    const accountQuery = this.fundAccountModel.findById(accountId);
    if (session) accountQuery.session(session);
    const account = await accountQuery.exec();
    if (!account) {
      throw new NotFoundException(`Owner Fund account ${accountId} not found`);
    }

    const currentBalance = account.balance || 0;
    if (amount > currentBalance) {
      throw new BadRequestException(
        `Sá»‘ dÆ° Quá»¹ Owner khÃ´ng Ä‘á»§. Hiá»‡n cÃ³: ${currentBalance.toLocaleString('vi-VN')}Ä‘, YÃªu cáº§u: ${amount.toLocaleString('vi-VN')}Ä‘`
      );
    }

    // Cáº­p nháº­t sá»‘ dÆ°
    const updatedAccount = await this.fundAccountModel.findOneAndUpdate(
      { _id: accountId, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true, session },
    ).exec();
    if (!updatedAccount) {
      throw new BadRequestException('Owner Fund balance changed; payment was not executed');
    }

    // Ghi láº¡i giao dá»‹ch
    const transaction = new this.fundTransactionModel({
      type: FundTransactionType.OUT,
      category: FundTransactionCategory.OTHER_OUT,
      amount,
      description: metadata.description,
      date: new Date(),
      reference: metadata.referenceId,
      referenceType: metadata.category,
      balanceAfter: updatedAccount.balance,
    });
    await transaction.save(session ? { session } : undefined);

    this.logger.log(`ðŸ’¸ Deducted ${amount.toLocaleString('vi-VN')}Ä‘ from Owner Fund for ${metadata.category}`);
    return updatedAccount.balance;
  }
}
