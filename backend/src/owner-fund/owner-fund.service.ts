import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Owner, OwnerDocument } from './schemas/owner.schema';
import { Withdrawal, WithdrawalDocument, WithdrawalStatus } from './schemas/withdrawal.schema';
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
  ) {}

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
    const result = await this.ownerModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Owner with ID ${id} not found`);
    }
  }

  // ==================== WITHDRAWAL MANAGEMENT ====================

  async createWithdrawal(createWithdrawalDto: CreateWithdrawalDto): Promise<Withdrawal> {
    const owner = await this.findOwnerById(createWithdrawalDto.ownerId);
    
    // Kiểm tra số dư khả dụng
    if (createWithdrawalDto.amount > owner.availableBalance) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${owner.availableBalance.toLocaleString('vi-VN')}đ, Requested: ${createWithdrawalDto.amount.toLocaleString('vi-VN')}đ`
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
      query.ownerId = filters.ownerId;
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
    const withdrawal = await this.findWithdrawalById(id);
    
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException(`Cannot approve withdrawal with status: ${withdrawal.status}`);
    }

    // Extract ownerId properly - có thể là populated object hoặc ObjectId
    const ownerIdField = withdrawal.ownerId as any;
    const ownerId = ownerIdField?._id?.toString() || ownerIdField?.toString();
    this.logger.debug(`Approving withdrawal ${id}, ownerId extracted: ${ownerId}`);
    const owner = await this.findOwnerById(ownerId);
    
    // Kiểm tra lại số dư
    if (withdrawal.amount > owner.availableBalance) {
      throw new BadRequestException(`Insufficient balance for approval`);
    }

    // Cập nhật withdrawal
    withdrawal.status = WithdrawalStatus.APPROVED;
    withdrawal.approvedDate = new Date();
    withdrawal.approvedBy = approveDto.approvedBy as any;
    withdrawal.approvalNotes = approveDto.approvalNotes;
    withdrawal.transactionReference = approveDto.transactionReference;

    // Trừ số dư owner
    await this.ownerModel.findByIdAndUpdate(withdrawal.ownerId, {
      $inc: {
        availableBalance: -withdrawal.amount,
        totalWithdrawn: withdrawal.amount,
      },
    });

    // Cập nhật withdrawal
    await this.withdrawalModel.findByIdAndUpdate(id, {
      status: WithdrawalStatus.APPROVED,
      approvedDate: new Date(),
      approvedBy: approveDto.approvedBy,
      approvalNotes: approveDto.approvalNotes,
      transactionReference: approveDto.transactionReference,
    });

    this.logger.log(`✅ Approved withdrawal ${id}: ${withdrawal.amount.toLocaleString('vi-VN')}đ for owner ${owner.name}`);
    
    return withdrawal;
  }

  async completeWithdrawal(id: string, transactionReference?: string): Promise<Withdrawal> {
    const withdrawal = await this.findWithdrawalById(id);
    
    if (withdrawal.status !== WithdrawalStatus.APPROVED) {
      throw new BadRequestException(`Cannot complete withdrawal with status: ${withdrawal.status}`);
    }

    const updateData: any = {
      status: WithdrawalStatus.COMPLETED,
      completedDate: new Date(),
    };
    if (transactionReference) {
      updateData.transactionReference = transactionReference;
    }

    await this.withdrawalModel.findByIdAndUpdate(id, updateData);
    
    this.logger.log(`✅ Completed withdrawal ${id}: ${withdrawal.amount.toLocaleString('vi-VN')}đ`);
    
    return withdrawal;
  }

  async rejectWithdrawal(id: string, approveDto: ApproveWithdrawalDto): Promise<Withdrawal> {
    const withdrawal = await this.findWithdrawalById(id);
    
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException(`Cannot reject withdrawal with status: ${withdrawal.status}`);
    }

    await this.withdrawalModel.findByIdAndUpdate(id, {
      status: WithdrawalStatus.REJECTED,
      approvedDate: new Date(),
      approvedBy: approveDto.approvedBy,
      approvalNotes: approveDto.approvalNotes,
    });
    
    this.logger.log(`❌ Rejected withdrawal ${id}: ${withdrawal.amount.toLocaleString('vi-VN')}đ`);
    
    return withdrawal;
  }

  async cancelWithdrawal(id: string): Promise<Withdrawal> {
    const withdrawal = await this.findWithdrawalById(id);
    
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException(`Cannot cancel withdrawal with status: ${withdrawal.status}`);
    }

    await this.withdrawalModel.findByIdAndUpdate(id, {
      status: WithdrawalStatus.CANCELLED,
    });
    
    return withdrawal;
  }

  // ==================== STATISTICS ====================

  async getOwnerStatistics(ownerId: string): Promise<any> {
    const owner = await this.findOwnerById(ownerId);
    
    const withdrawals = await this.withdrawalModel.find({ ownerId }).exec();
    
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
   * Cập nhật số dư Owner từ lợi nhuận
   * Được gọi từ Financial Control khi phân bổ lợi nhuận
   */
  async updateOwnerBalance(ownerId: string, profitAmount: number): Promise<Owner> {
    const owner = await this.findOwnerById(ownerId);
    
    await this.ownerModel.findByIdAndUpdate(ownerId, {
      $inc: { availableBalance: profitAmount },
    });
    
    this.logger.log(`💰 Updated owner ${owner.name} balance: +${profitAmount.toLocaleString('vi-VN')}đ, new balance: ${owner.availableBalance.toLocaleString('vi-VN')}đ`);
    
    return owner;
  }

  // ==================== FUND TRANSACTIONS ====================

  /**
   * Tạo giao dịch quỹ mới (tiền vào/ra)
   */
  async createFundTransaction(dto: CreateFundTransactionDto): Promise<FundTransaction> {
    const owner = await this.findOwnerById(dto.ownerId);
    
    // Kiểm tra nếu là tiền ra (OUT), đảm bảo đủ số dư
    if (dto.type === FundTransactionType.OUT && dto.amount > owner.availableBalance) {
      throw new BadRequestException(
        `Số dư không đủ. Khả dụng: ${owner.availableBalance.toLocaleString('vi-VN')}đ, Yêu cầu: ${dto.amount.toLocaleString('vi-VN')}đ`
      );
    }

    // Cập nhật số dư owner
    const balanceChange = dto.type === FundTransactionType.IN ? dto.amount : -dto.amount;
    const newBalance = owner.availableBalance + balanceChange;
    
    await this.ownerModel.findByIdAndUpdate(dto.ownerId, {
      $inc: { 
        availableBalance: balanceChange,
        totalWithdrawn: dto.type === FundTransactionType.OUT ? dto.amount : 0,
      },
    });

    // Tạo transaction record
    const transaction = new this.fundTransactionModel({
      ...dto,
      date: dto.date ? new Date(dto.date) : new Date(),
      balanceAfter: newBalance,
    });

    this.logger.log(`💸 Fund transaction: ${dto.type === FundTransactionType.IN ? '+' : '-'}${dto.amount.toLocaleString('vi-VN')}đ for owner ${owner.name}`);
    
    return transaction.save();
  }

  /**
   * Lấy danh sách giao dịch quỹ
   */
  async findAllFundTransactions(filters?: {
    ownerId?: string;
    type?: FundTransactionType;
    category?: FundTransactionCategory;
    startDate?: Date;
    endDate?: Date;
  }): Promise<FundTransaction[]> {
    const query: any = {};
    
    if (filters?.ownerId) query.ownerId = filters.ownerId;
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
   * Lấy tổng hợp quỹ Owner với owner withdrawable từ Financial Control
   */
  async getFundSummary(): Promise<any> {
    const owners = await this.ownerModel.find({ isActive: true }).exec();
    
    // Lấy tất cả transactions
    const allTransactions = await this.fundTransactionModel.find().exec();
    
    // Tính tổng tiền vào/ra
    const totalIn = allTransactions
      .filter(t => t.type === FundTransactionType.IN)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalOut = allTransactions
      .filter(t => t.type === FundTransactionType.OUT)
      .reduce((sum, t) => sum + t.amount, 0);

    // Tính tổng số dư từ owners
    const totalBalance = owners.reduce((sum, o) => sum + o.availableBalance, 0);
    const totalWithdrawn = owners.reduce((sum, o) => sum + o.totalWithdrawn, 0);

    // Lấy owner withdrawable từ Financial Control
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

    // Transactions gần đây (30 ngày)
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
        totalIn,           // Tổng tiền đã vào quỹ
        totalOut,          // Tổng tiền đã ra quỹ
        totalBalance,      // Số dư hiện tại trong quỹ
        totalWithdrawn,    // Tổng đã rút (tất cả thời gian)
        ownerWithdrawable, // Số tiền có thể rút an toàn (từ CFO)
        pendingAmount,     // Số tiền đang chờ duyệt rút
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
   * Lấy lịch sử giao dịch của một owner
   */
  async getOwnerTransactionHistory(ownerId: string): Promise<any> {
    const owner = await this.findOwnerById(ownerId);
    
    const transactions = await this.fundTransactionModel
      .find({ ownerId })
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

  // ==================== OWNER FUND ACCOUNT (Quỹ Owner riêng biệt) ====================

  /**
   * Lấy hoặc tạo tài khoản Quỹ Owner
   */
  async getOrCreateFundAccount(): Promise<OwnerFundAccountDocument> {
    let account = await this.fundAccountModel.findOne().exec();
    
    if (!account) {
      // Tạo tài khoản mặc định nếu chưa có
      account = new this.fundAccountModel({
        name: 'Quỹ Owner',
        balance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalReturnedToCompany: 0,
        bankAccount: '',
        bankName: '',
        isActive: true,
      });
      await account.save();
      this.logger.log('✅ Created default Owner Fund Account');
    }
    
    return account;
  }

  /**
   * Lấy thông tin tài khoản Quỹ Owner
   */
  async getFundAccount(): Promise<any> {
    const account = await this.getOrCreateFundAccount();
    
    // Lấy owner withdrawable từ CFO
    let ownerWithdrawable = 0;
    try {
      const dashboard = await this.financialControlService.getDashboard();
      ownerWithdrawable = dashboard.ownerWithdrawable || 0;
    } catch (err) {
      this.logger.warn('Failed to get owner withdrawable from CFO dashboard');
    }

    return {
      account,
      ownerWithdrawable,  // Số tiền có thể chuyển thêm từ Bank Balance
      canTransferToFund: ownerWithdrawable,  // Alias cho rõ nghĩa hơn
    };
  }

  /**
   * Chuyển tiền TỪ Bank Balance VÀO Quỹ Owner
   * - Giảm Bank Balance (tạo CashflowEntry type: OUT)
   * - Tăng số dư Quỹ Owner
   * - Số tiền chuyển không vượt quá Owner Withdrawable
   */
  async transferToOwnerFund(dto: TransferToOwnerFundDto, userId: string): Promise<any> {
    // Kiểm tra owner withdrawable
    const dashboard = await this.financialControlService.getDashboard();
    const ownerWithdrawable = dashboard.ownerWithdrawable || 0;

    if (dto.amount > ownerWithdrawable) {
      throw new BadRequestException(
        `Số tiền chuyển (${dto.amount.toLocaleString('vi-VN')}đ) vượt quá số tiền Owner có thể rút (${ownerWithdrawable.toLocaleString('vi-VN')}đ)`
      );
    }

    // Lấy tài khoản quỹ Owner
    const account = await this.getOrCreateFundAccount();

    // 1. Tạo CashflowEntry và giảm Bank Balance
    const referenceId = `OWNER_FUND_${Date.now()}`;
    const cashflowEntry = await this.financeService.createCashflowWithBankUpdate({
      direction: 'out',
      sourceType: 'other',
      amount: dto.amount,
      description: dto.description || 'Chuyển tiền sang Quỹ Owner',
      date: new Date().toISOString(),
      category: 'owner_fund_transfer',
      referenceId,
    });

    // 2. Cập nhật số dư tài khoản Quỹ Owner
    await this.fundAccountModel.findByIdAndUpdate(account._id, {
      $inc: {
        balance: dto.amount,
        totalDeposited: dto.amount,
      },
    });

    // 3. Ghi lại giao dịch
    const transaction = new this.fundTransactionModel({
      type: FundTransactionType.IN,
      category: FundTransactionCategory.BANK_TRANSFER_IN,
      amount: dto.amount,
      description: dto.description || 'Chuyển tiền từ Bank Balance vào Quỹ Owner',
      date: new Date(),
      reference: referenceId,
      balanceAfter: account.balance + dto.amount,
      createdBy: userId,
    });
    await transaction.save();

    this.logger.log(`💰 Transferred ${dto.amount.toLocaleString('vi-VN')}đ from Bank Balance to Owner Fund`);

    return {
      success: true,
      message: `Đã chuyển ${dto.amount.toLocaleString('vi-VN')}đ vào Quỹ Owner`,
      transaction,
      cashflowEntry,
      newFundBalance: account.balance + dto.amount,
    };
  }

  /**
   * Chuyển tiền TỪ Quỹ Owner VỀ Bank Balance (trả lại cho công ty)
   * - Tăng Bank Balance (tạo CashflowEntry type: IN)
   * - Giảm số dư Quỹ Owner
   */
  async transferFromOwnerFund(dto: TransferFromOwnerFundDto, userId: string): Promise<any> {
    const account = await this.getOrCreateFundAccount();

    if (dto.amount > account.balance) {
      throw new BadRequestException(
        `Số dư Quỹ Owner không đủ. Hiện có: ${account.balance.toLocaleString('vi-VN')}đ, Yêu cầu: ${dto.amount.toLocaleString('vi-VN')}đ`
      );
    }

    // 1. Tạo CashflowEntry và tăng Bank Balance
    const referenceId = `OWNER_RETURN_${Date.now()}`;
    const cashflowEntry = await this.financeService.createCashflowWithBankUpdate({
      direction: 'in',
      sourceType: 'other',
      amount: dto.amount,
      description: dto.description || 'Owner trả tiền về Quỹ Công Ty',
      date: new Date().toISOString(),
      category: 'owner_fund_return',
      referenceId,
    });

    // 2. Cập nhật số dư tài khoản Quỹ Owner
    await this.fundAccountModel.findByIdAndUpdate(account._id, {
      $inc: {
        balance: -dto.amount,
        totalReturnedToCompany: dto.amount,
      },
    });

    // 3. Ghi lại giao dịch
    const transaction = new this.fundTransactionModel({
      type: FundTransactionType.OUT,
      category: FundTransactionCategory.BANK_TRANSFER_OUT,
      amount: dto.amount,
      description: dto.description || 'Chuyển tiền từ Quỹ Owner về Bank Balance',
      date: new Date(),
      reference: referenceId,
      balanceAfter: account.balance - dto.amount,
      createdBy: userId,
    });
    await transaction.save();

    this.logger.log(`💸 Returned ${dto.amount.toLocaleString('vi-VN')}đ from Owner Fund to Bank Balance`);

    return {
      success: true,
      message: `Đã chuyển ${dto.amount.toLocaleString('vi-VN')}đ về Quỹ Công Ty`,
      transaction,
      cashflowEntry,
      newFundBalance: account.balance - dto.amount,
    };
  }

  /**
   * Owner rút tiền từ Quỹ Owner (ra cá nhân)
   * - Giảm số dư Quỹ Owner
   * - Không ảnh hưởng Bank Balance (vì tiền đã nằm trong Quỹ Owner rồi)
   */
  async ownerWithdrawFromFund(dto: OwnerWithdrawFromFundDto, userId: string): Promise<any> {
    const account = await this.getOrCreateFundAccount();

    if (dto.amount > account.balance) {
      throw new BadRequestException(
        `Số dư Quỹ Owner không đủ. Hiện có: ${account.balance.toLocaleString('vi-VN')}đ, Yêu cầu: ${dto.amount.toLocaleString('vi-VN')}đ`
      );
    }

    // Cập nhật số dư
    await this.fundAccountModel.findByIdAndUpdate(account._id, {
      $inc: {
        balance: -dto.amount,
        totalWithdrawn: dto.amount,
      },
    });

    // Ghi lại giao dịch
    const transaction = new this.fundTransactionModel({
      type: FundTransactionType.OUT,
      category: FundTransactionCategory.PERSONAL_WITHDRAWAL,
      amount: dto.amount,
      description: dto.description || 'Owner rút tiền về cá nhân',
      date: new Date(),
      reference: `OWNER_WITHDRAW_${Date.now()}`,
      balanceAfter: account.balance - dto.amount,
      createdBy: userId,
      bankAccount: dto.bankAccount,
      bankName: dto.bankName,
    });
    await transaction.save();

    this.logger.log(`💳 Owner withdrew ${dto.amount.toLocaleString('vi-VN')}đ from Owner Fund`);

    return {
      success: true,
      message: `Đã rút ${dto.amount.toLocaleString('vi-VN')}đ từ Quỹ Owner`,
      transaction,
      newFundBalance: account.balance - dto.amount,
    };
  }

  /**
   * Cập nhật thông tin tài khoản Quỹ Owner (bank info)
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
   * Lấy danh sách tất cả tài khoản Quỹ Owner
   */
  async listFundAccounts(): Promise<OwnerFundAccountDocument[]> {
    return this.fundAccountModel.find({ isActive: true }).exec();
  }

  /**
   * Lấy tài khoản Quỹ Owner theo ID
   */
  async getFundAccountById(accountId: string): Promise<OwnerFundAccountDocument | null> {
    return this.fundAccountModel.findById(accountId).exec();
  }

  /**
   * Lấy tổng hợp tất cả accounts
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
   * Trừ tiền từ tài khoản Quỹ Owner (cho loan payment)
   */
  async deductFromAccount(
    accountId: string,
    amount: number,
    metadata: { category: string; description: string; referenceId: string },
  ): Promise<void> {
    const account = await this.fundAccountModel.findById(accountId);
    if (!account) {
      throw new NotFoundException(`Owner Fund account ${accountId} not found`);
    }

    const currentBalance = account.balance || 0;
    if (amount > currentBalance) {
      throw new BadRequestException(
        `Số dư Quỹ Owner không đủ. Hiện có: ${currentBalance.toLocaleString('vi-VN')}đ, Yêu cầu: ${amount.toLocaleString('vi-VN')}đ`
      );
    }

    // Cập nhật số dư
    await this.fundAccountModel.findByIdAndUpdate(accountId, {
      $inc: {
        balance: -amount,
      },
    });

    // Ghi lại giao dịch
    const transaction = new this.fundTransactionModel({
      type: FundTransactionType.OUT,
      category: FundTransactionCategory.OTHER_OUT,
      amount,
      description: metadata.description,
      date: new Date(),
      reference: metadata.referenceId,
      referenceType: metadata.category,
      balanceAfter: currentBalance - amount,
    });
    await transaction.save();

    this.logger.log(`💸 Deducted ${amount.toLocaleString('vi-VN')}đ from Owner Fund for ${metadata.category}`);
  }
}
