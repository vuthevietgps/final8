import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { FundingSource, FundingSourceDocument } from './schemas/funding-source.schema';
import { BudgetBucket, BudgetBucketDocument } from './schemas/budget-bucket.schema';
import { CashflowEntry, CashflowEntryDocument } from './schemas/cashflow-entry.schema';
import { LoanContract, LoanContractDocument } from './schemas/loan-contract.schema';
import { LoanRepayment, LoanRepaymentDocument, LoanRepaymentFundingSource } from './schemas/loan-repayment.schema';
import { LoanPayment, LoanPaymentDocument, PaymentSource } from './schemas/loan-payment.schema';
import { SystemSettings, SystemSettingsDocument } from './schemas/system-settings.schema';
import { AvailableFundSnapshot, AvailableFundSnapshotDocument } from './schemas/available-fund-snapshot.schema';
import { SupplierPayable, SupplierPayableDocument } from '../supplier-payable/schemas/supplier-payable.schema';
import { AgentStatement, AgentStatementDocument } from '../agent-receivable/schemas/agent-statement.schema';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { LaborStatement, LaborStatementDocument } from '../labor-cost1/schemas/labor-statement.schema';
import { OtherCost, OtherCostDocument } from '../other-cost/schemas/other-cost.schema';
import { AdvertisingCost, AdvertisingCostDocument } from '../advertising-cost/schemas/advertising-cost.schema';
import { ProductCategory, ProductCategoryDocument } from '../product-category/schemas/product-category.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateFundingSourceDto } from './dto/create-funding-source.dto';
import { UpdateFundingSourceDto } from './dto/update-funding-source.dto';
import { CreateBudgetBucketDto } from './dto/create-budget-bucket.dto';
import { UpdateBudgetBucketDto } from './dto/update-budget-bucket.dto';
import { CreateCashflowEntryDto } from './dto/create-cashflow-entry.dto';
import { CreateLoanContractDto } from './dto/create-loan-contract.dto';
import { UpdateLoanContractDto } from './dto/update-loan-contract.dto';
import { CreateLoanRepaymentDto } from './dto/create-loan-repayment.dto';
import { MarkRepaymentPaidDto } from './dto/mark-repayment-paid.dto';
import { FinanceEvents } from './events/finance-events.constants';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);
  private static readonly CACHE_KEY_MASTER_BANK_BALANCE = 'finance:master_bank_balance';
  private static readonly CACHE_TTL_MASTER_BANK_BALANCE = 15_000;
  private pendingMasterBankBalance: Promise<number> | null = null;

  constructor(
    @InjectModel(FundingSource.name)
    private readonly fundingSourceModel: Model<FundingSourceDocument>,
    @InjectModel(BudgetBucket.name)
    private readonly budgetBucketModel: Model<BudgetBucketDocument>,
    @InjectModel(ProductCategory.name)
    private readonly productCategoryModel: Model<ProductCategoryDocument>,
    @InjectModel(CashflowEntry.name)
    private readonly cashflowModel: Model<CashflowEntryDocument>,
    @InjectModel(LoanContract.name)
    private readonly loanModel: Model<LoanContractDocument>,
    @InjectModel(LoanPayment.name)
    private readonly loanPaymentModel: Model<LoanPaymentDocument>,
    @InjectModel(SystemSettings.name)
    private readonly systemSettingsModel: Model<SystemSettingsDocument>,
    @InjectModel(LoanRepayment.name)
    private readonly repaymentModel: Model<LoanRepaymentDocument>,
    @InjectModel(AvailableFundSnapshot.name)
    private readonly availableFundModel: Model<AvailableFundSnapshotDocument>,
    @InjectModel(SupplierPayable.name)
    private readonly supplierPayableModel: Model<SupplierPayableDocument>,
    @InjectModel(AgentStatement.name)
    private readonly agentStatementModel: Model<AgentStatementDocument>,
    @InjectModel(TestOrder2.name)
    private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(LaborStatement.name)
    private readonly laborStatementModel: Model<LaborStatementDocument>,
    @InjectModel(OtherCost.name)
    private readonly otherCostModel: Model<OtherCostDocument>,
    @InjectModel(AdvertisingCost.name)
    private readonly adsCostModel: Model<AdvertisingCostDocument>,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
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

  // Chạy tự động mỗi ngày 08:15 AM (Asia/Ho_Chi_Minh) để chụp snapshot vốn khả dụng
  @Cron('15 8 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async snapshotDailyAvailableFunds() {
    try {
      await this.captureAvailableFunds({ note: 'auto-daily' });
      this.logger.log('[available-funds] Auto snapshot created at 01:00');
    } catch (err) {
      this.logger.error('[available-funds] Auto snapshot failed', err as any);
    }
  }

  /**
   * Tính vốn khả dụng dựa trên lợi nhuận thuần thực tế
   * 
   * LOGIC MỚI (Cash-based accounting):
   * ==================================
   * - Lợi nhuận THỰC TẾ = Chỉ tính đơn đã thanh toán CẢ NCC VÀ Đại lý (realizedNetProfit)
   * - Lợi nhuận ƯỚC TÍNH = Tất cả đơn đã kết thúc (netProfit)
   * - Tiền chắc ăn = Lợi nhuận thực tế (cash đã thực sự nhận được)
   * 
   * @param mode - 'conservative' | 'moderate' | 'aggressive'
   *   - conservative: Chỉ tính đơn đã thanh toán cả 2 bên (realizedNetProfit) - RECOMMENDED
   *   - moderate: Áp dụng hệ số chiết khấu theo trạng thái thanh toán
   *   - aggressive: Tính hết ước tính + vay (risky)
   */
  async computeRealAvailableFunds(mode: 'conservative' | 'moderate' | 'aggressive' = 'moderate') {
    try {
      switch (mode) {
        case 'conservative':
          return this.computeConservativeFunds();
        case 'moderate':
          return this.computeModerateFunds();
        case 'aggressive':
          return this.computeAggressiveFunds();
      }
    } catch (err) {
      this.logger.error('computeRealAvailableFunds failed', err);
      throw err;
    }
  }

  /**
   * CONSERVATIVE MODE: Chỉ tính lợi nhuận THỰC TẾ từ đơn đã thanh toán cả 2 bên
   * - NCC đã trả tiền (supplierPaymentStatus = 'paid')
   * - Đại lý đã nhận tiền hoặc N/A (agentPaymentStatus = 'paid' hoặc 'n/a')
   * 
   * An toàn nhất, không bao giờ overspend vì chỉ tính tiền đã thực sự nhận được
   */
  private async computeConservativeFunds() {
    // 1. Lợi nhuận THỰC TẾ từ đơn đã thanh toán cả 2 bên
    const realizedResult = await this.orderModel.aggregate([
      { 
        $match: { 
          realizedAt: { $exists: true, $ne: null },  // Đã được đánh dấu realized
          realizedNetProfit: { $exists: true }
        } 
      },
      { 
        $group: { 
          _id: null, 
          totalRealizedNetProfit: { $sum: '$realizedNetProfit' },
          totalRealizedGrossProfit: { $sum: '$realizedGrossProfit' },
          totalAdsCost: { $sum: { $ifNull: ['$advertisingCost', 0] } },
          // Doanh thu = Tổng supplierPaidAmount (số tiền thu được sau khi thanh toán với NCC)
          totalRevenue: { $sum: { $ifNull: ['$supplierPaidAmount', 0] } },
          count: { $sum: 1 }
        } 
      }
    ]);
    
    const realizedData = realizedResult?.[0] || { 
      totalRealizedNetProfit: 0, 
      totalRealizedGrossProfit: 0,
      totalAdsCost: 0,
      totalRevenue: 0,
      count: 0 
    };

    // 1b. Tính vốn đặt chỗ vận hành = Chi phí khác + Chi phí nhân công chưa thanh toán
    const reservedOperatingCapital = await this.calculateReservedOperatingCapital();

    // 2. Lợi nhuận ƯỚC TÍNH từ đơn đã kết thúc nhưng chưa thanh toán
    const pendingResult = await this.orderModel.aggregate([
      { 
        $match: { 
          orderStatus: { $in: ['Giao thành công', 'Hàng hoàn'] },
          $or: [
            { realizedAt: { $exists: false } },
            { realizedAt: null }
          ]
        } 
      },
      { 
        $group: { 
          _id: null, 
          totalEstimatedNetProfit: { $sum: '$netProfit' },
          totalEstimatedGrossProfit: { $sum: '$grossProfit' },
          count: { $sum: 1 }
        } 
      }
    ]);
    
    const pendingData = pendingResult?.[0] || { 
      totalEstimatedNetProfit: 0, 
      totalEstimatedGrossProfit: 0,
      count: 0 
    };

    // 3. Lấy vốn ban đầu từ funding sources (vốn bôi trơn)
    const initialCapital = await this.getInitialCapitalFromFundingSources();

    // 4. Vốn CHẮC ĂN = Lợi nhuận thực tế + Vốn đầu
    const safeAvailableFunds = Math.max(0, realizedData.totalRealizedNetProfit + initialCapital);

    return {
      safeAvailableFunds,
      totalNetProfit: realizedData.totalRealizedNetProfit + pendingData.totalEstimatedNetProfit,
      mode: 'conservative',
      cashFlow: {
        // Thực tế (đã thanh toán cả 2 bên)
        realizedNetProfit: realizedData.totalRealizedNetProfit,
        realizedGrossProfit: realizedData.totalRealizedGrossProfit,
        realizedOrderCount: realizedData.count,
        totalAdsCost: realizedData.totalAdsCost,
        
        // Doanh thu = Số tiền thu được sau khi thanh toán với NCC
        revenue: realizedData.totalRevenue,
        
        // Vốn đặt chỗ vận hành = Chi phí khác + Chi phí nhân công chưa thanh toán
        reservedOperatingCapital,
        
        // Ước tính (chờ thanh toán)
        pendingNetProfit: pendingData.totalEstimatedNetProfit,
        pendingGrossProfit: pendingData.totalEstimatedGrossProfit,
        pendingOrderCount: pendingData.count,
        
        // Vốn
        initialCapital,
        netCashAvailable: safeAvailableFunds
      },
      additionalInfo: {
        riskLevel: 'LOW',
        description: 'Chỉ tính đơn đã thanh toán CẢ NCC VÀ Đại lý - An toàn tuyệt đối',
        note: 'realizedNetProfit = supplierPaidAmount - agentPaidAmount - chi phí phân bổ'
      },
      calculatedAt: new Date()
    };
  }

  /**
   * MODERATE MODE: Phân loại theo trạng thái thanh toán
   * - Đã thanh toán cả 2 bên: 100%
   * - Đã thanh toán 1 bên: 70%
   * - Chưa thanh toán: 40%
   */
  private async computeModerateFunds() {
    // 1. Lợi nhuận THỰC TẾ (đã thanh toán cả 2 bên) - 100%
    const realizedResult = await this.orderModel.aggregate([
      { 
        $match: { 
          realizedAt: { $exists: true, $ne: null },
          realizedNetProfit: { $exists: true }
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$realizedNetProfit' },
          // Doanh thu = Tổng supplierPaidAmount
          totalRevenue: { $sum: { $ifNull: ['$supplierPaidAmount', 0] } },
          count: { $sum: 1 }
        } 
      }
    ]);
    const realizedProfit = realizedResult?.[0]?.total || 0;
    const realizedRevenue = realizedResult?.[0]?.totalRevenue || 0;
    const realizedCount = realizedResult?.[0]?.count || 0;

    // 2. Đơn NCC đã thanh toán (bên quan trọng nhất trong mô hình trung gian) - 85%
    // Logic: NCC paid = Công ty ĐÃ NHẬN TIỀN THỰC (tiền thừa sau khi trừ giá vốn)
    // Agent chưa paid không quan trọng vì công ty trả SAU khi có tiền
    const supplierPaidResult = await this.orderModel.aggregate([
      { 
        $match: { 
          orderStatus: { $in: ['Giao thành công', 'Hàng hoàn'] },
          realizedAt: { $in: [null, undefined] },
          supplierPaymentStatus: 'paid',
          // Agent chưa paid hoặc pending
          agentPaymentStatus: { $in: ['pending', null, undefined] }
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$netProfit' },
          count: { $sum: 1 }
        } 
      }
    ]);
    const supplierPaidProfit = supplierPaidResult?.[0]?.total || 0;
    const supplierPaidCount = supplierPaidResult?.[0]?.count || 0;

    // 2b. Đơn NCC paid + Agent n/a (không có đại lý) - 100% (như realized)
    const supplierPaidNoAgentResult = await this.orderModel.aggregate([
      { 
        $match: { 
          orderStatus: { $in: ['Giao thành công', 'Hàng hoàn'] },
          realizedAt: { $in: [null, undefined] },
          supplierPaymentStatus: 'paid',
          agentPaymentStatus: 'n/a'
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$netProfit' },
          count: { $sum: 1 }
        } 
      }
    ]);
    const supplierPaidNoAgentProfit = supplierPaidNoAgentResult?.[0]?.total || 0;
    const supplierPaidNoAgentCount = supplierPaidNoAgentResult?.[0]?.count || 0;

    // 3. Đơn Agent paid nhưng NCC chưa paid - 30% (NGUY HIỂM - công ty ĐÃ TRẢ nhưng CHƯA NHẬN)
    // Logic: Đã trả hoa hồng cho Agent nhưng NCC chưa gửi tiền thừa về
    // Đây là trạng thái cash outflow trước inflow - RẤT RISKY
    const agentPaidOnlyResult = await this.orderModel.aggregate([
      { 
        $match: { 
          orderStatus: { $in: ['Giao thành công', 'Hàng hoàn'] },
          realizedAt: { $in: [null, undefined] },
          supplierPaymentStatus: { $ne: 'paid' },
          agentPaymentStatus: 'paid'
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$netProfit' },
          count: { $sum: 1 }
        } 
      }
    ]);
    const agentPaidOnlyProfit = agentPaidOnlyResult?.[0]?.total || 0;
    const agentPaidOnlyCount = agentPaidOnlyResult?.[0]?.count || 0;

    // 4. Đơn chưa thanh toán cả 2 bên - 40%
    const pendingResult = await this.orderModel.aggregate([
      { 
        $match: { 
          orderStatus: { $in: ['Giao thành công', 'Hàng hoàn'] },
          realizedAt: { $in: [null, undefined] },
          supplierPaymentStatus: { $ne: 'paid' },
          agentPaymentStatus: { $in: ['pending', null, undefined] }
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$netProfit' },
          count: { $sum: 1 }
        } 
      }
    ]);
    const pendingProfit = pendingResult?.[0]?.total || 0;
    const pendingCount = pendingResult?.[0]?.count || 0;

    // 5. Áp dụng hệ số chiết khấu (ĐÃ SỬA CHO MÔ HÌNH TRUNG GIAN)
    const discountedFunds = 
      realizedProfit * 1.0 +              // 100% - đã thanh toán cả 2 bên
      supplierPaidNoAgentProfit * 1.0 +   // 100% - NCC paid, không có Agent (như realized)
      supplierPaidProfit * 0.85 +         // 85% - NCC paid, Agent chưa (tiền đã nhận, chưa trả agent)
      agentPaidOnlyProfit * 0.30 +        // 30% - Agent paid, NCC chưa (NGUY HIỂM - đã trả chưa nhận)
      pendingProfit * 0.40;               // 40% - chờ thanh toán cả 2

    // 6. Cộng vốn ban đầu
    const initialCapital = await this.getInitialCapitalFromFundingSources();
    const safeAvailableFunds = Math.max(0, discountedFunds + initialCapital);
    const totalNetProfit = realizedProfit + supplierPaidNoAgentProfit + supplierPaidProfit + agentPaidOnlyProfit + pendingProfit;

    // 7. Tính vốn đặt chỗ vận hành
    const reservedOperatingCapital = await this.calculateReservedOperatingCapital();

    return {
      safeAvailableFunds,
      totalNetProfit,
      mode: 'moderate',
      cashFlow: {
        // Doanh thu = Số tiền thu được sau khi thanh toán với NCC
        revenue: realizedRevenue,
        // Vốn đặt chỗ vận hành = Chi phí khác + Chi phí nhân công chưa thanh toán
        reservedOperatingCapital,
        // Đã thanh toán cả 2 bên
        realizedProfit,
        realizedCount,
        // NCC paid, không có Agent (coi như realized)
        supplierPaidNoAgentProfit,
        supplierPaidNoAgentCount,
        // NCC paid, Agent chưa
        supplierPaidProfit,
        supplierPaidCount,
        // Agent paid, NCC chưa (NGUY HIỂM)
        agentPaidOnlyProfit,
        agentPaidOnlyCount,
        // Chưa thanh toán cả 2
        pendingProfit,
        pendingCount,
        // Tổng sau chiết khấu
        discountedFunds,
        initialCapital,
        netCashAvailable: safeAvailableFunds
      },
      additionalInfo: {
        riskLevel: 'MEDIUM',
        description: 'Hệ số chiết khấu tối ưu cho mô hình TRUNG GIAN DROPSHIPPING',
        discountRates: {
          realized: 1.0,              // Đã thanh toán cả 2 bên
          supplierPaidNoAgent: 1.0,   // NCC paid, không có Agent
          supplierPaid: 0.85,         // NCC paid, Agent chưa (tiền đã nhận)
          agentPaidOnly: 0.30,        // Agent paid, NCC chưa (NGUY HIỂM - đã trả chưa nhận)
          pending: 0.40               // Chờ cả 2
        },
        note: 'Ưu tiên NCC paid vì đó là nguồn tiền thực trong mô hình trung gian'
      },
      calculatedAt: new Date()
    };
  }

  /**
   * AGGRESSIVE MODE: Dùng 100% lợi nhuận ước tính + vay
   * Rủi ro cao, chỉ dùng khi cần scale nhanh
   */
  private async computeAggressiveFunds() {
    try {
      // 1. Tổng lợi nhuận thuần từ TẤT CẢ đơn đã kết thúc (ước tính)
      const estimatedResult = await this.orderModel.aggregate([
        { 
          $match: { 
            orderStatus: { $in: ['Giao thành công', 'Hàng hoàn'] },
            netProfit: { $exists: true } 
          } 
        },
        { 
          $group: { 
            _id: null, 
            total: { $sum: '$netProfit' },
            // Doanh thu ước tính = Tổng grossProfit (tổng lợi nhuận gộp)
            totalRevenue: { $sum: { $ifNull: ['$grossProfit', 0] } }
          } 
        }
      ]);
      const totalEstimatedProfit = estimatedResult?.[0]?.total || 0;
      const totalEstimatedRevenue = estimatedResult?.[0]?.totalRevenue || 0;

      // 2. Lợi nhuận thực tế (để so sánh)
      const realizedResult = await this.orderModel.aggregate([
        { 
          $match: { 
            realizedAt: { $exists: true, $ne: null },
            realizedNetProfit: { $exists: true }
          } 
        },
        { 
          $group: { 
            _id: null, 
            total: { $sum: '$realizedNetProfit' },
            totalRevenue: { $sum: { $ifNull: ['$supplierPaidAmount', 0] } }
          } 
        }
      ]);
      const totalRealizedProfit = realizedResult?.[0]?.total || 0;
      const totalRealizedRevenue = realizedResult?.[0]?.totalRevenue || 0;

      // 3. Khoản vay khả dụng
      const loanAvailable = await this.getLoanRoomAvailable();

      // 4. Vốn ban đầu
      const initialCapital = await this.getInitialCapitalFromFundingSources();

      // 5. Vốn đặt chỗ vận hành
      const reservedOperatingCapital = await this.calculateReservedOperatingCapital();

      // Aggressive = Ước tính + Vốn + Vay
      const safeAvailableFunds = totalEstimatedProfit + initialCapital + loanAvailable;

      return {
        safeAvailableFunds,
        totalNetProfit: totalEstimatedProfit,
        mode: 'aggressive',
        cashFlow: {
          // Doanh thu ước tính và thực tế
          revenue: totalRealizedRevenue,
          estimatedRevenue: totalEstimatedRevenue,
          // Vốn đặt chỗ vận hành
          reservedOperatingCapital,
          estimatedProfit: totalEstimatedProfit,
          realizedProfit: totalRealizedProfit,
          unrealizedProfit: totalEstimatedProfit - totalRealizedProfit,
          initialCapital,
          loanAvailable,
          netCashAvailable: safeAvailableFunds
        },
        additionalInfo: {
          riskLevel: 'HIGH',
          description: 'Dùng 100% lợi nhuận ước tính + vốn + vay - RỦI RO CAO',
          warning: 'Có thể overspend nếu NCC/Đại lý chưa thanh toán',
          recommendation: 'Chỉ dùng khi cần scale nhanh và chấp nhận rủi ro thanh khoản'
        },
        calculatedAt: new Date()
      };
    } catch (err) {
      this.logger.error('computeAggressiveFunds failed', err);
      throw err;
    }
  }

  /**
   * Tính vốn đặt chỗ vận hành = Chi phí khác chưa thanh toán + Chi phí nhân công chưa thanh toán
   * 
   * CẬP NHẬT LOGIC MỚI:
   * - Chi phí khác: othercosts collection với isConfirmed = false
   * - Chi phí nhân công: Tính từ LaborStatement với status = 'open' hoặc 'draft'
   *   (Thay vì query trực tiếp laborcost1 collection)
   */
  private async calculateReservedOperatingCapital(): Promise<number> {
    try {
      // 1. Chi phí khác chưa xác nhận (chưa chi)
      const unpaidOtherCostResult = await this.orderModel.db.collection('othercosts').aggregate([
        { $match: { isConfirmed: { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).toArray();
      const unpaidOtherCost = unpaidOtherCostResult?.[0]?.total || 0;

      // 2. Chi phí nhân công chưa thanh toán
      // Tính từ LaborStatement với status = 'open' hoặc 'draft'
      const unpaidLaborCostResult = await this.orderModel.db.collection('laborstatements').aggregate([
        { $match: { status: { $in: ['draft', 'open'] } } },
        { $group: { _id: null, total: { $sum: '$closingBalance' } } }
      ]).toArray();
      const unpaidLaborCost = unpaidLaborCostResult?.[0]?.total || 0;

      return unpaidOtherCost + unpaidLaborCost;
    } catch (err) {
      this.logger.warn(`calculateReservedOperatingCapital fallback to 0: ${err?.message ?? err}`);
      return 0;
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
      // Lấy lợi nhuận thuần từ đơn hàng hôm nay
      const { start, end } = this.getTodayRange();
      const res = await this.orderModel.aggregate([
        { $match: { orderDate: { $gte: start, $lt: end }, netProfit: { $exists: true } } },
        { $group: { _id: null, total: { $sum: '$netProfit' } } },
      ]);
      return res?.[0]?.total ?? 0;
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
    const saved = await doc.save();
    this.eventEmitter.emit(FinanceEvents.FINANCE_STATE_CHANGED, {
      source: 'funding_source.create',
      entityId: String(saved._id),
    });
    return saved;
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
    this.eventEmitter.emit(FinanceEvents.FINANCE_STATE_CHANGED, {
      source: 'funding_source.update',
      entityId: id,
    });
    return updated;
  }

  // Budget buckets
  async createBudgetBucket(dto: CreateBudgetBucketDto) {
    const payload = this.normalizeBudgetBucket(dto, true);
    this.assertValidBudgetBucket(payload);
    await this.assertBudgetBucketCategoriesExist(payload.productGroupIds);
    const doc = new this.budgetBucketModel(payload);
    const saved = await doc.save();
    this.eventEmitter.emit(FinanceEvents.FINANCE_STATE_CHANGED, {
      source: 'budget_bucket.create',
      entityId: String(saved._id),
    });
    return saved;
  }

  async listBudgetBuckets(active?: boolean) {
    const query = active === undefined ? {} : { active };
    return this.budgetBucketModel.find(query).sort({ active: -1, createdAt: -1 }).lean();
  }

  async updateBudgetBucket(id: string, dto: UpdateBudgetBucketDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Budget bucket id is invalid');
    const existing = await this.budgetBucketModel.findById(id).lean();
    if (!existing) throw new NotFoundException('Budget bucket not found');

    const payload = this.normalizeBudgetBucket(dto, false);
    const merged = { ...existing, ...payload };
    this.assertValidBudgetBucket(merged);
    await this.assertBudgetBucketCategoriesExist(merged.productGroupIds);
    const updated = await this.budgetBucketModel
      .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
      .lean();
    if (!updated) throw new NotFoundException('Budget bucket not found');
    this.eventEmitter.emit(FinanceEvents.FINANCE_STATE_CHANGED, {
      source: 'budget_bucket.update',
      entityId: id,
    });
    return updated;
  }

  private normalizeBudgetBucket(
    dto: CreateBudgetBucketDto | UpdateBudgetBucketDto,
    applyDefaults: boolean,
  ): Record<string, any> {
    const normalized: Record<string, any> = { ...dto };
    if (dto.name !== undefined) normalized.name = String(dto.name).trim();
    if (dto.code !== undefined) {
      normalized.code = String(dto.code).trim().toUpperCase() || undefined;
    }
    if (dto.productGroupIds !== undefined) {
      normalized.productGroupIds = Array.from(new Set(
        dto.productGroupIds.map((id) => String(id).trim()).filter(Boolean),
      ));
    } else if (applyDefaults) {
      normalized.productGroupIds = [];
    }
    for (const field of ['dailyCap', 'weeklyCap', 'monthlyCap'] as const) {
      if (dto[field] !== undefined) normalized[field] = Number(dto[field]);
      else if (applyDefaults) normalized[field] = 0;
    }
    if (applyDefaults && dto.active === undefined) normalized.active = true;
    if (dto.notes !== undefined) normalized.notes = String(dto.notes).trim();
    return normalized;
  }

  private assertValidBudgetBucket(bucket: Record<string, any>): void {
    const name = String(bucket.name || '').trim();
    if (!name) throw new BadRequestException('Budget bucket name is required');

    const categoryIds = Array.isArray(bucket.productGroupIds) ? bucket.productGroupIds : [];
    if (categoryIds.some((id: unknown) => !Types.ObjectId.isValid(String(id)))) {
      throw new BadRequestException('productGroupIds must contain Product.categoryId ObjectIds');
    }

    const caps = {
      daily: Number(bucket.dailyCap || 0),
      weekly: Number(bucket.weeklyCap || 0),
      monthly: Number(bucket.monthlyCap || 0),
    };
    if (Object.values(caps).some((value) => !Number.isFinite(value) || value < 0)) {
      throw new BadRequestException('Budget caps must be finite non-negative numbers');
    }
    if (caps.daily > 0 && caps.weekly > 0 && caps.weekly < caps.daily) {
      throw new BadRequestException('weeklyCap must be zero or greater than or equal to dailyCap');
    }
    if (caps.weekly > 0 && caps.monthly > 0 && caps.monthly < caps.weekly) {
      throw new BadRequestException('monthlyCap must be zero or greater than or equal to weeklyCap');
    }
    if (caps.daily > 0 && caps.monthly > 0 && caps.monthly < caps.daily) {
      throw new BadRequestException('monthlyCap must be zero or greater than or equal to dailyCap');
    }

    for (const source of bucket.linkedSources || []) {
      const allocated = Number(source?.allocated || 0);
      if (!Number.isFinite(allocated) || allocated < 0) {
        throw new BadRequestException('Linked source allocation must be non-negative');
      }
    }
  }

  private async assertBudgetBucketCategoriesExist(categoryIds: unknown): Promise<void> {
    const ids = Array.isArray(categoryIds)
      ? Array.from(new Set(categoryIds.map((id) => String(id).trim()).filter(Boolean)))
      : [];
    if (ids.length === 0) return;

    const existingCount = await this.productCategoryModel.countDocuments({
      _id: { $in: ids },
    });
    if (existingCount !== ids.length) {
      throw new BadRequestException('One or more productGroupIds reference a ProductCategory that does not exist');
    }
  }

  // Cashflows
  async createCashflow(
    dto: CreateCashflowEntryDto,
    options: { session?: ClientSession; emitEvent?: boolean } = {},
  ) {
    const idempotencyKey = String(dto.idempotencyKey || '').trim();
    if (dto.fundingSourceId && !options.session) {
      if (!idempotencyKey) {
        throw new BadRequestException('idempotencyKey is required for cashflow funding-source updates');
      }
      if (await this.cashflowModel.exists({ idempotencyKey })) {
        throw new ConflictException('Cashflow with this idempotencyKey was already processed');
      }

      const session = await this.cashflowModel.db.startSession();
      let saved: CashflowEntryDocument | undefined;
      try {
        await session.withTransaction(async () => {
          await this.acquireCashflowSerializationLock(session);
          saved = await this.createCashflow(dto, { session, emitEvent: false });
        });
      } catch (error) {
        if ((error as any)?.code === 11000) {
          throw new ConflictException('Cashflow with this idempotencyKey was already processed');
        }
        throw error;
      } finally {
        await session.endSession();
      }
      if (!saved) throw new BadRequestException('Cashflow transaction did not commit');
      if (options.emitEvent !== false) {
        this.eventEmitter.emit(FinanceEvents.FINANCE_STATE_CHANGED, {
          source: 'cashflow.create',
          entityId: String((saved as any)._id),
        });
      }
      return saved;
    }

    if (idempotencyKey && !options.session && await this.cashflowModel.exists({ idempotencyKey })) {
      throw new ConflictException('Cashflow with this idempotencyKey was already processed');
    }

    const doc = new this.cashflowModel(dto);
    let saved: CashflowEntryDocument;
    try {
      saved = await doc.save(options.session ? { session: options.session } : undefined);
    } catch (error) {
      if ((error as any)?.code === 11000) {
        throw new ConflictException('Cashflow with this idempotencyKey was already processed');
      }
      throw error;
    }

    // Nếu là tiền vào và có fundingSourceId → tăng availableBalance
    if (dto.direction === 'in' && dto.fundingSourceId) {
      const result = await this.fundingSourceModel.updateOne(
        { _id: dto.fundingSourceId },
        { $inc: { availableBalance: dto.amount } },
        options.session ? { session: options.session } : undefined,
      );
      if (!result.matchedCount) throw new BadRequestException('Funding source not found');
    }

    // Nếu là tiền ra và có fundingSourceId → giảm availableBalance
    if (dto.direction === 'out' && dto.fundingSourceId) {
      const result = await this.fundingSourceModel.updateOne(
        { _id: dto.fundingSourceId },
        { $inc: { availableBalance: -dto.amount } },
        options.session ? { session: options.session } : undefined,
      );
      if (!result.matchedCount) throw new BadRequestException('Funding source not found');
    }

    if (options.emitEvent !== false) {
      this.eventEmitter.emit(FinanceEvents.FINANCE_STATE_CHANGED, {
        source: 'cashflow.create',
        entityId: String(saved._id),
      });
    }
    return saved;
  }

  /**
   * Lấy bank account mặc định (đầu tiên) để thực hiện giao dịch
   */
  async getDefaultBankAccount(session?: ClientSession): Promise<FundingSourceDocument | null> {
    const query = this.fundingSourceModel.findOne({
      status: 'active',
      restricted: { $ne: true },
    }).sort({ type: 1, createdAt: 1 });
    if (session) query.session(session);
    return query.exec();
  }

  async acquireCashflowSerializationLock(session: ClientSession): Promise<void> {
    const locked = await this.systemSettingsModel.findOneAndUpdate(
      { key: 'financial_cashflow_serialization_lock' },
      {
        $inc: { 'value.version': 1 },
        $set: { updatedBy: 'system:financial-transaction' },
        $setOnInsert: {
          description: 'Serialization mutex for bank-impacting financial transactions',
          'value.kind': 'cashflow_serialization',
        },
      },
      { upsert: true, new: true, session },
    ).exec();
    if (!locked) {
      throw new BadRequestException(
        'Financial transaction serialization lock is unavailable',
      );
    }
  }

  async hasCashflowIdempotencyKey(idempotencyKey: string): Promise<boolean> {
    return Boolean(await this.cashflowModel.exists({ idempotencyKey }));
  }

  /**
   * Cập nhật số dư bank account
   * @param amount Số tiền thay đổi (dương = tăng, âm = giảm)
   * @param bankAccountId ID của bank account (nếu không có, dùng mặc định)
   */
  async updateBankBalance(
    amount: number,
    bankAccountId?: string,
    session?: ClientSession,
  ): Promise<boolean> {
    let bankAccount: FundingSourceDocument | null;
    
    if (bankAccountId) {
      const query = this.fundingSourceModel.findById(bankAccountId);
      if (session) query.session(session);
      bankAccount = await query.exec();
    } else {
      bankAccount = await this.getDefaultBankAccount(session);
    }

    if (!bankAccount) {
      this.logger.warn('No bank account found to update balance');
      return false;
    }

    await this.fundingSourceModel.updateOne(
      { _id: bankAccount._id },
      { $inc: { availableBalance: amount } },
      session ? { session } : undefined,
    );

    this.logger.log(`💰 Updated bank balance: ${amount > 0 ? '+' : ''}${amount.toLocaleString('vi-VN')}đ`);
    return true;
  }

  /**
   * Tạo cashflow entry VÀ cập nhật bank balance tự động
   */
  async createCashflowWithBankUpdate(
    dto: CreateCashflowEntryDto,
    options: {
      session?: ClientSession;
      requireBankAccount?: boolean;
      emitEvent?: boolean;
    } = {},
  ): Promise<CashflowEntry> {
    // Tạo cashflow entry
    const entry = await this.createCashflow(dto, {
      session: options.session,
      emitEvent: false,
    });

    // Nếu không có fundingSourceId, tự động cập nhật bank account mặc định
    if (!dto.fundingSourceId) {
      const amount = dto.direction === 'in' ? dto.amount : -dto.amount;
      const updated = await this.updateBankBalance(amount, undefined, options.session);
      if (!updated && options.requireBankAccount) {
        throw new BadRequestException('No active bank account is available for this cashflow');
      }
    }

    if (options.emitEvent !== false) {
      this.eventEmitter.emit(FinanceEvents.FINANCE_STATE_CHANGED, {
        source: 'cashflow.create',
        entityId: String((entry as any)._id),
      });
    }

    return entry;
  }

  async listCashflows(filter: { direction?: string; sourceType?: string; bucketId?: string; category?: string }) {
    const q: any = {};
    if (filter.direction) q.direction = filter.direction;
    if (filter.sourceType) q.sourceType = filter.sourceType;
    if (filter.bucketId) q.bucketId = filter.bucketId;
    if (filter.category) q.category = filter.category;
    return this.cashflowModel.find(q).sort({ date: -1 }).lean();
  }

  /**
   * Lấy tổng Cashflow IN/OUT (cho Financial Control)
   * - Chỉ tính các transfers nội bộ (Owner Fund, etc.)
   * - KHÔNG tính loan_disbursement (đã tính trong capital)
   * - KHÔNG tính revenue (đã tính riêng)
   */
  async getCashflowTotals(): Promise<{ cashflowIn: number; cashflowOut: number }> {
    const [outResult, inResult] = await Promise.all([
      // Chỉ tính OUT với category owner_fund_transfer
      this.cashflowModel.aggregate([
        { $match: { direction: 'out', category: 'owner_fund_transfer' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // Chỉ tính IN với category owner_fund_return
      this.cashflowModel.aggregate([
        { $match: { direction: 'in', category: 'owner_fund_return' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    return {
      cashflowOut: outResult[0]?.total || 0,
      cashflowIn: inResult[0]?.total || 0,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // MASTER BANK BALANCE — Single Source of Truth
  // ═══════════════════════════════════════════════════════════

  /**
   * NGUỒN SỰ THẬT DUY NHẤT cho Số Dư Ngân Hàng.
   * Được gọi bởi cả FinancialControlService và FundsService để đảm bảo
   * mọi dashboard luôn hiển thị cùng một con số.
   *
   * Công thức:
   *   BankBalance
   *     = personalCapital + loanDisbursed − loanPaid   (vốn ròng)
   *     + revenue          (supplierPaidAmount, supplierPaymentStatus='paid')
   *     − agentPaid        (agentPaidAmount,   agentPaymentStatus='paid')
   *     − adsCost          (spentAmount từ AdvertisingCost)
   *     − laborCost        (statementPaymentTotal từ LaborStatement đã closed)
   *     − otherCost        (amount từ OtherCost đã confirmed)
   *     − cashflowOut      (owner_fund_transfer ra khỏi ngân hàng)
   *     + cashflowIn       (owner_fund_return trả lại ngân hàng)
   */
  async calculateMasterBankBalance(): Promise<number> {
    const cached = await this.cacheManager.get<number>(FinanceService.CACHE_KEY_MASTER_BANK_BALANCE);
    if (cached !== undefined && cached !== null) {
      return cached;
    }

    if (this.pendingMasterBankBalance) {
      return this.pendingMasterBankBalance;
    }

    this.pendingMasterBankBalance = this.doCalculateMasterBankBalance();
    try {
      const balance = await this.pendingMasterBankBalance;
      await this.cacheManager.set(
        FinanceService.CACHE_KEY_MASTER_BANK_BALANCE,
        balance,
        FinanceService.CACHE_TTL_MASTER_BANK_BALANCE,
      );
      return balance;
    } finally {
      this.pendingMasterBankBalance = null;
    }
  }

  async invalidateMasterBankBalanceCache(reason = 'unspecified'): Promise<void> {
    await this.cacheManager.del(FinanceService.CACHE_KEY_MASTER_BANK_BALANCE).catch((err) => {
      this.logger.warn(`[CACHE_INVALIDATED] master bank balance delete failed`, err);
    });
    this.logger.debug(`[CACHE_INVALIDATED] master bank balance ${reason}`);
  }

  private async doCalculateMasterBankBalance(): Promise<number> {
    const [
      personalCapitalResult,
      loanResult,
      repaymentPaidResult,
      loanPaymentAuditResult,
      revenueResult,
      agentPaidResult,
      adsResult,
      laborResult,
      otherResult,
      cashflowTotals,
    ] = await Promise.all([
      // 1. Vốn cá nhân từ FundingSource
      this.fundingSourceModel.aggregate([
        { $match: { type: { $in: ['equity', 'internal'] }, status: 'active' } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$principal', 0] } } } },
      ]),
      // 2. Khoản vay: đã giải ngân và đã trả (gốc + lãi)
      this.loanModel.aggregate([
        {
          $group: {
            _id: null,
            disbursed: { $sum: { $ifNull: ['$disbursedAmount', 0] } },
          },
        },
      ]),
      this.loanModel.aggregate([
        {
          $group: {
            _id: null,
            principalPaid: { $sum: { $ifNull: ['$totalPrincipalPaid', 0] } },
            interestPaid: { $sum: { $ifNull: ['$totalInterestPaid', 0] } },
          },
        },
      ]),
      // LoanContract totals include payments from every source. Reconcile the
      // auditable bank-funded subset so Owner Fund payments do not reduce the
      // company bank balance a second time. Historical unattributed amounts
      // remain bank-funded conservatively.
      this.loanPaymentModel.aggregate([
        {
          $group: {
            _id: null,
            totalRecorded: { $sum: { $ifNull: ['$amount', 0] } },
            bankRecorded: {
              $sum: {
                $cond: [
                  { $eq: ['$source', PaymentSource.BANK_BALANCE] },
                  { $ifNull: ['$amount', 0] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      // 3. Doanh thu đã thu (tiền NCC chuyển về)
      this.orderModel.aggregate([
        { $match: { supplierPaymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$supplierPaidAmount', 0] } } } },
      ]),
      // 4. Hoa hồng đại lý đã trả
      this.orderModel.aggregate([
        { $match: { agentPaymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$agentPaidAmount', 0] } } } },
      ]),
      // 5. Chi phí quảng cáo đã chi
      this.adsCostModel.aggregate([
        { $group: { _id: null, total: { $sum: { $ifNull: ['$spentAmount', 0] } } } },
      ]),
      // 6. Lương đã trả (LaborStatement đã closed)
      this.laborStatementModel.aggregate([
        { $match: { status: 'closed' } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$statementPaymentTotal', 0] } } } },
      ]),
      // 7. Chi phí khác đã xác nhận
      this.otherCostModel.aggregate([
        { $match: { isConfirmed: true } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      // 8. Cashflow nội bộ (chuyển quỹ owner)
      this.getCashflowTotals(),
    ]);

    const personalCapital = personalCapitalResult[0]?.total || 0;
    const loanDisbursed = loanResult[0]?.disbursed || 0;
    const contractLoanPaid = (repaymentPaidResult[0]?.principalPaid || 0)
      + (repaymentPaidResult[0]?.interestPaid || 0);
    const loanPaid = this.reconcileBankFundedLoanPaid(
      contractLoanPaid,
      loanPaymentAuditResult[0]?.totalRecorded || 0,
      loanPaymentAuditResult[0]?.bankRecorded || 0,
    );
    const revenue = revenueResult[0]?.total || 0;
    const agentPaid = agentPaidResult[0]?.total || 0;
    const adsCost = adsResult[0]?.total || 0;
    const laborCost = laborResult[0]?.total || 0;
    const otherCost = otherResult[0]?.total || 0;
    const { cashflowOut, cashflowIn } = cashflowTotals;

    const capital = personalCapital + loanDisbursed - loanPaid;
    const balance = capital + revenue - agentPaid - adsCost - laborCost - otherCost - cashflowOut + cashflowIn;

    this.logger.debug(
      `[MASTER_BANK_BALANCE] capital=${capital} revenue=${revenue} agentPaid=${agentPaid}` +
        ` adsCost=${adsCost} laborCost=${laborCost} otherCost=${otherCost}` +
        ` cashflowOut=${cashflowOut} cashflowIn=${cashflowIn} → balance=${balance}`,
    );

    return balance;
  }

  private reconcileBankFundedLoanPaid(
    contractTotalPaid: number,
    totalRecordedPayments: number,
    bankRecordedPayments: number,
  ): number {
    const contractTotal = Math.max(0, Number(contractTotalPaid) || 0);
    const recordedTotal = Math.max(0, Number(totalRecordedPayments) || 0);
    const recordedBank = Math.max(0, Number(bankRecordedPayments) || 0);
    const historicalUnattributed = Math.max(0, contractTotal - recordedTotal);
    return recordedBank + historicalUnattributed;
  }

  /**
   * Lấy Owner Fund balance (cho Financial Control)
   */
  async getOwnerFundAccountBalance(): Promise<number> {
    try {
      // Truy vấn owner_fund_accounts collection
      const account = await this.fundingSourceModel.db.collection('owner_fund_accounts').findOne({ isActive: true });
      return account?.balance || 0;
    } catch (error) {
      return 0;
    }
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
    this.eventEmitter.emit(FinanceEvents.FINANCE_STATE_CHANGED, {
      source: 'loan_contract.update',
      entityId: id,
    });
    return updated;
  }

  // Loan repayments
  async createLoanRepayment(dto: CreateLoanRepaymentDto) {
    if (dto.paid) {
      throw new BadRequestException(
        'Creating an already-paid repayment is disabled; create the schedule first and pay through loan-management',
      );
    }
    const loan = await this.loanModel.findById(dto.loanId);
    if (!loan) throw new NotFoundException('Loan contract not found');

    const doc = new this.repaymentModel(dto);
    const saved = await doc.save();

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

  // Helper: áp dụng ảnh hưởng khi đã trả (giảm dư nợ, ghi cashflow theo nguồn tiền)
  private async applyRepaymentEffects(rep: LoanRepaymentDocument) {
    const principalDelta = rep.amountPrincipal || 0;
    const interest = rep.amountInterest || 0;
    const totalPaid = principalDelta + interest;
    const paidDate = rep.paidDate || new Date();
    const fundingSource = rep.fundingSource || LoanRepaymentFundingSource.BANK;

    await this.loanModel.updateOne(
      { _id: rep.loanId },
      { $inc: { principalRemaining: -principalDelta }, $set: { updatedAt: new Date() } },
    );

    if (fundingSource === LoanRepaymentFundingSource.OWNER_FUND) {
      await this.applyOwnerFundRepaymentEffects(rep, totalPaid, paidDate);
    } else {
      await this.applyBankRepaymentEffects(rep, totalPaid, paidDate);
    }

    // Cập nhật tổng đã trả trên LoanContract
    await this.loanModel.updateOne(
      { _id: rep.loanId },
      {
        $inc: {
          totalPrincipalPaid: principalDelta,
          totalInterestPaid: interest,
        },
      },
    );
  }

  private async applyBankRepaymentEffects(rep: LoanRepaymentDocument, amount: number, paidDate: Date) {
    await this.createCashflowWithBankUpdate({
      direction: 'out',
      sourceType: 'loan',
      amount,
      date: paidDate.toISOString(),
      category: 'loan_repayment',
      referenceId: String(rep._id),
      description: 'Trả nợ vay (gốc+lãi)',
    });
  }

  private async applyOwnerFundRepaymentEffects(rep: LoanRepaymentDocument, amount: number, paidDate: Date) {
    const ownerFundAccountCollection = this.fundingSourceModel.db.collection('owner_fund_accounts');
    const fundTransactionCollection = this.fundingSourceModel.db.collection('fund_transactions');
    const activeAccount = await ownerFundAccountCollection.findOne({ isActive: true });

    if (!activeAccount) {
      throw new BadRequestException('Active owner fund account not found');
    }

    if ((activeAccount.balance || 0) < amount) {
      throw new BadRequestException('Insufficient owner fund balance for loan repayment');
    }

    const debitResult = await ownerFundAccountCollection.updateOne(
      {
        _id: activeAccount._id,
        balance: { $gte: amount },
      },
      {
        $inc: { balance: -amount },
        $set: { updatedAt: new Date() },
      },
    );

    if (!debitResult.modifiedCount) {
      throw new BadRequestException('Failed to debit owner fund balance for loan repayment');
    }

    const refreshedAccount = await ownerFundAccountCollection.findOne({ _id: activeAccount._id });

    await this.cashflowModel.create({
      direction: 'out',
      sourceType: 'owner_fund',
      amount,
      date: paidDate,
      category: 'loan_repayment',
      referenceId: String(rep._id),
      description: 'Trả nợ vay bằng Quỹ Owner',
    });

    await fundTransactionCollection.insertOne({
      type: 'out',
      category: 'other_out',
      amount,
      date: paidDate,
      description: 'Thanh toán khoản vay bằng Quỹ Owner',
      notes: rep.notes || 'Owner fund loan repayment',
      referenceId: String(rep._id),
      reference: `LOAN_REPAYMENT_${String(rep._id)}`,
      referenceType: 'loan_repayment',
      balanceAfter: refreshedAccount?.balance || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.eventEmitter.emit(FinanceEvents.OWNER_FUND_CHANGED, {
      accountId: String(activeAccount._id),
      type: 'withdrawal',
      amount,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // GIẢI NGÂN (DISBURSEMENT) - Tiền VÀO Bank Balance
  // ═══════════════════════════════════════════════════════════

  /**
   * Ghi nhận giải ngân khoản vay
   * - Cập nhật disbursementStatus, disbursedAmount, disbursedDate
   * - Tạo cashflow entry (tiền VÀO)
   */
  async recordDisbursement(
    loanId: string,
    dto: { amount: number; date?: string; notes?: string; idempotencyKey?: string },
  ) {
    const rawKey = String(dto.idempotencyKey || '').trim();
    if (!rawKey) throw new BadRequestException('idempotencyKey is required for loan disbursement');
    const idempotencyKey = `loan-disbursement:${rawKey}`;
    if (await this.cashflowModel.exists({ idempotencyKey })) {
      throw new ConflictException('Loan disbursement with this idempotencyKey was already processed');
    }
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('Disbursement amount must be a positive finite number');
    }

    const session = await this.loanModel.db.startSession();
    let updated: any;
    try {
      await session.withTransaction(async () => {
        await this.acquireCashflowSerializationLock(session);
        const loan = await this.loanModel.findById(loanId).session(session).exec();
        if (!loan) throw new NotFoundException('Loan contract not found');

    const disbursedDate = dto.date ? new Date(dto.date) : new Date();
    const newDisbursedAmount = (loan.disbursedAmount || 0) + dto.amount;
    if (newDisbursedAmount > Number(loan.principal || 0)) {
      throw new BadRequestException('Disbursement would exceed the loan principal');
    }

    // Xác định trạng thái giải ngân
    let disbursementStatus: 'pending' | 'partial' | 'fully' = 'partial';
    if (newDisbursedAmount >= loan.principal) {
      disbursementStatus = 'fully';
    } else if (newDisbursedAmount === 0) {
      disbursementStatus = 'pending';
    }

    // Cập nhật loan
    updated = await this.loanModel.findByIdAndUpdate(
      loanId,
      {
        $set: {
          disbursementStatus,
          disbursedAmount: newDisbursedAmount,
          disbursedDate,
          // Khi giải ngân, principalRemaining = số tiền đã giải ngân (nợ phải trả)
          principalRemaining: Number(loan.principalRemaining || 0) + dto.amount,
        },
      },
      { new: true, session },
    ).lean();

    await this.createCashflow({
      idempotencyKey,
      direction: 'in',
      sourceType: 'loan',
      amount: dto.amount,
      date: disbursedDate.toISOString(),
      category: 'loan_disbursement',
      referenceId: loanId,
      description: `Giải ngân khoản vay: ${loan.name} - ${dto.notes || ''}`,
    }, { session, emitEvent: false });
      });
    } catch (error) {
      if ((error as any)?.code === 11000) {
        throw new ConflictException('Loan disbursement with this idempotencyKey was already processed');
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (!updated) throw new BadRequestException('Loan disbursement did not commit');

    this.eventEmitter.emit(FinanceEvents.LOAN_DISBURSED, {
      loanId,
      amount: dto.amount,
    });

    return updated;
  }

  /**
   * Tổng hợp thông tin vay nợ cho CFO Dashboard
   */
  async getLoanSummary(): Promise<{
    totalContracts: number;
    totalPrincipal: number;
    totalDisbursed: number;
    totalPendingDisbursement: number;
    totalPrincipalRemaining: number;
    totalPrincipalPaid: number;
    totalInterestPaid: number;
    byStatus: { pending: number; partial: number; fully: number };
    upcomingRepayments: number;
  }> {
    const loans = await this.loanModel.find({ status: { $ne: 'closed' } }).lean();

    const summary = {
      totalContracts: loans.length,
      totalPrincipal: 0,
      totalDisbursed: 0,
      totalPendingDisbursement: 0,
      totalPrincipalRemaining: 0,
      totalPrincipalPaid: 0,
      totalInterestPaid: 0,
      byStatus: { pending: 0, partial: 0, fully: 0 },
      upcomingRepayments: 0,
    };

    for (const loan of loans) {
      summary.totalPrincipal += loan.principal || 0;
      summary.totalDisbursed += loan.disbursedAmount || 0;
      summary.totalPrincipalRemaining += loan.principalRemaining || 0;
      summary.totalPrincipalPaid += loan.totalPrincipalPaid || 0;
      summary.totalInterestPaid += loan.totalInterestPaid || 0;

      const status = loan.disbursementStatus || 'pending';
      if (status === 'pending') summary.byStatus.pending++;
      else if (status === 'partial') summary.byStatus.partial++;
      else if (status === 'fully') summary.byStatus.fully++;
    }

    summary.totalPendingDisbursement = summary.totalPrincipal - summary.totalDisbursed;

    // Đếm các kỳ trả nợ sắp đến hạn (14 ngày)
    const today = new Date();
    const future = new Date(today.getTime() + 14 * 86400000);
    const upcomingCount = await this.repaymentModel.countDocuments({
      paid: { $ne: true },
      dueDate: { $gte: today, $lte: future },
    });
    summary.upcomingRepayments = upcomingCount;

    return summary;
  }

  /**
   * Đánh dấu một kỳ trả nợ đã trả
   */
  async markRepaymentPaid(repaymentId: string, dto: MarkRepaymentPaidDto) {
    void repaymentId;
    void dto;
    throw new BadRequestException(
      'Legacy repayment execution is disabled; use loan-management/loans/:id/pay',
    );
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

  /**
   * Vốn ban đầu: chỉ lấy từ các khoản vay đang active (loan)
   */
  private async getInitialCapitalFromFundingSources(): Promise<number> {
    try {
      const fundingSources = await this.fundingSourceModel
        .find({ status: 'active', type: 'loan' })
        .lean();

      const totalCapital = fundingSources.reduce((sum, source) => {
        const balance = source?.availableBalance ?? 0;
        return sum + balance;
      }, 0);

      return Math.max(0, totalCapital);
    } catch (error) {
      this.logger.error(`Error getting initial capital: ${error.message}`, error.stack);
      return 0; // Fallback to 0 if error
    }
  }

  /**
   * Get pending money FROM suppliers (supplier owes user)
   * 
   * TERMINOLOGY CLARIFICATION:
   * ==========================
   * Collection name: "supplier-payable" (CÓ THỂ GÂY HIỂU NHẦM!)
   * Actual meaning: Money supplier OWES to user (pending reconciliation)
   * 
   * COMMISSION MODEL:
   * -----------------
   * 1. Supplier ships COD, collects from customer
   * 2. Supplier HOLDS cash (COD collected)
   * 3. Every 10 days: Supplier reconciles and PAYS user (COD - COGS)
   * 4. This tracks: Money supplier collected but NOT YET paid to user
   * 
   * EXAMPLE:
   * --------
   * 100 orders "Giao thành công", each netProfit = 300k
   * - totalAmount: 30M (supplier owes user)
   * - amountPaid: 0 (supplier hasn't paid yet)
   * - balance: 30M (pending reconciliation)
   * 
   * NOTE: This is RECEIVABLE (user will receive), not PAYABLE (user doesn't owe)!
   * But we keep collection name for backward compatibility.
   */
  private async getPendingFromSuppliers(): Promise<number> {
    try {
      const result = await this.supplierPayableModel.aggregate([
        {
          $match: {
            status: { $in: ['unpaid', 'partial'] }  // Fixed: was paymentStatus
          }
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $subtract: ['$totalAmount', { $ifNull: ['$amountPaid', 0] }]
              }
            }
          }
        }
      ]);

      return result?.[0]?.total || 0;
    } catch (error) {
      this.logger.error(`Error calculating pending from suppliers: ${error.message}`, error.stack);
      return 0;
    }
  }

  /**
   * Get pending payments TO agents (user owes agents)
   * 
   * COMMISSION MODEL:
   * -----------------
   * 1. Agent creates orders for user
   * 2. User receives commission from supplier
   * 3. User MUST PAY agent their share
   * 4. This tracks: Money user owes to agents
   * 
   * EXAMPLE:
   * --------
   * Agent generated 10M netProfit, commission rate = 20%
   * - periodReceivables: 2M (user owes agent)
   * - statementPaymentTotal: 0 (user hasn't paid)
   * - closingBalance: 2M (user still owes)
   */
  private async getPendingToAgents(): Promise<number> {
    try {
      const result = await this.agentStatementModel.aggregate([
        {
          $match: {
            status: 'open'  // Open statements = unpaid
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$closingBalance' }
          }
        }
      ]);

      return result?.[0]?.total || 0;
    } catch (error) {
      this.logger.error(`Error calculating pending to agents: ${error.message}`, error.stack);
      return 0;
    }
  }

  /**
   * Lấy các funding sources để làm vốn tái đầu tư cho ads
   * Hiện tại schema chỉ hỗ trợ type: loan | equity | internal,
   * nên tạm thời lấy tất cả nguồn vốn đang active.
   */
  async getFundingSourcesForAds(): Promise<FundingSourceDocument[]> {
    try {
      // Return hydrated documents so downstream callers keep full typings
      return await this.fundingSourceModel
        .find({ status: 'active' })
        .exec();
    } catch (error) {
      this.logger.error(`Error getting funding sources for ads: ${error.message}`, error.stack);
      return [];
    }
  }

  // ============================================
  // CFO SPEC v1: DEBT CASHFLOW SUMMARY
  // ============================================

  /**
   * Get debt cashflow summary for Financial Control
   * 
   * CFO Spec v1:
   * - totalLoanDisbursed: Cash-in from loans
   * - totalDebtPaid: Cash-out (principal + interest paid)
   * - totalDebtDue14d: Committed cash (due within windowDays)
   * - dueByDay7d: Forecast array
   * - byLoan: Breakdown by loan contract
   * - alerts: Missing schedule, overdue, etc.
   */
  async getDebtCashflowSummary(windowDays = 14): Promise<{
    totalLoanDisbursed: number;
    totalDebtPaid: number;
    totalInterestPaid: number;
    totalPrincipalPaid: number;
    totalDebtOutstanding: number;
    totalDebtDue14d: number;
    nextDebtDueDate: string | null;
    dueByDay7d: { date: string; amount: number; count: number }[];
    byLoan: {
      loanId: string;
      lenderName: string;
      outstanding: number;
      due14d: number;
      nextDueDate: string | null;
      status: 'active' | 'draft' | 'closed';
    }[];
    metadata: {
      asOfDate: string;
      timezone: string;
      windowDays: number;
      generatedAt: string;
    };
    alerts: string[];
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today.getTime() + windowDays * 86400000);
    const forecastEnd = new Date(today.getTime() + 7 * 86400000);
    const alerts: string[] = [];

    // 1. Get all active loans
    const activeLoans = await this.loanModel.find({ status: 'active' }).lean();
    
    // 2. Get total disbursed (actual disbursedAmount, not contract principal)
    const allLoans = await this.loanModel.find().lean();
    const totalLoanDisbursed = allLoans.reduce((sum, loan) => sum + (loan.disbursedAmount || 0), 0);

    // 3. Get total outstanding
    const totalDebtOutstanding = activeLoans.reduce(
      (sum, loan) => sum + (loan.principalRemaining ?? loan.principal ?? 0),
      0,
    );

    // 4. Get all repayments
    const allRepayments = await this.repaymentModel.find().lean();
    const paidRepayments = allRepayments.filter(r => r.paid);
    const unpaidRepayments = allRepayments.filter(r => !r.paid);

    // 5. Calculate paid amounts
    const totalPrincipalPaid = paidRepayments.reduce(
      (sum, r) => sum + (r.amountPrincipal || 0),
      0,
    );
    const totalInterestPaid = paidRepayments.reduce(
      (sum, r) => sum + (r.amountInterest || 0),
      0,
    );
    const totalDebtPaid = totalPrincipalPaid + totalInterestPaid;

    // 6. Calculate due14d (committed cash)
    // Only count unpaid repayments where dueDate <= today + windowDays
    // AND loan is active
    const activeLoanIds = new Set(activeLoans.map(l => String(l._id)));
    const dueRepayments = unpaidRepayments.filter(r => {
      if (!r.dueDate) return false;
      const dueDate = new Date(r.dueDate);
      return dueDate <= windowEnd && activeLoanIds.has(String(r.loanId));
    });

    const totalDebtDue14d = dueRepayments.reduce(
      (sum, r) => sum + (r.amountPrincipal || 0) + (r.amountInterest || 0),
      0,
    );

    // 7. Find next due date
    const allUnpaidSorted = unpaidRepayments
      .filter(r => r.dueDate && activeLoanIds.has(String(r.loanId)))
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
    const nextDebtDueDate = allUnpaidSorted.length > 0
      ? new Date(allUnpaidSorted[0].dueDate!).toISOString().split('T')[0]
      : null;

    // 8. Build dueByDay7d forecast
    const dueByDay7d: { date: string; amount: number; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(today.getTime() + i * 86400000);
      const dayStr = day.toISOString().split('T')[0];
      const dayRepayments = unpaidRepayments.filter(r => {
        if (!r.dueDate) return false;
        const rDate = new Date(r.dueDate).toISOString().split('T')[0];
        return rDate === dayStr && activeLoanIds.has(String(r.loanId));
      });
      const amount = dayRepayments.reduce(
        (sum, r) => sum + (r.amountPrincipal || 0) + (r.amountInterest || 0),
        0,
      );
      dueByDay7d.push({ date: dayStr, amount, count: dayRepayments.length });
    }

    // 9. Build byLoan breakdown
    const byLoan = activeLoans.map(loan => {
      const loanIdStr = String(loan._id);
      const loanRepayments = unpaidRepayments.filter(
        r => String(r.loanId) === loanIdStr && r.dueDate && new Date(r.dueDate) <= windowEnd,
      );
      const due14d = loanRepayments.reduce(
        (sum, r) => sum + (r.amountPrincipal || 0) + (r.amountInterest || 0),
        0,
      );
      const loanUnpaidSorted = unpaidRepayments
        .filter(r => String(r.loanId) === loanIdStr && r.dueDate)
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
      const nextDueDate = loanUnpaidSorted.length > 0
        ? new Date(loanUnpaidSorted[0].dueDate!).toISOString().split('T')[0]
        : null;

      return {
        loanId: loanIdStr,
        lenderName: loan.lenderName || 'Unknown',
        outstanding: loan.principalRemaining ?? loan.principal ?? 0,
        due14d,
        nextDueDate,
        status: loan.status || 'active',
      };
    });

    // 10. Generate alerts
    // Alert 1: Active loans without any schedule
    for (const loan of activeLoans) {
      const loanIdStr = String(loan._id);
      const hasSchedule = allRepayments.some(r => String(r.loanId) === loanIdStr);
      if (!hasSchedule) {
        alerts.push(`[MISSING_SCHEDULE] Loan "${loan.name}" (${loan.lenderName}) has no repayment schedule`);
        this.logger.warn(`[DebtSummary] Loan ${loan.name} missing repayment schedule`);
      }
    }

    // Alert 2: Overdue repayments
    const overdueRepayments = unpaidRepayments.filter(r => {
      if (!r.dueDate) return false;
      return new Date(r.dueDate) < today && activeLoanIds.has(String(r.loanId));
    });
    if (overdueRepayments.length > 0) {
      const overdueTotal = overdueRepayments.reduce(
        (sum, r) => sum + (r.amountPrincipal || 0) + (r.amountInterest || 0),
        0,
      );
      alerts.push(`[OVERDUE] ${overdueRepayments.length} repayments overdue, total: ${overdueTotal.toLocaleString('vi-VN')}đ`);
      this.logger.warn(`[DebtSummary] ${overdueRepayments.length} overdue repayments, total: ${overdueTotal}`);
    }

    // Alert 3: High debt due in 7 days (> 50M)
    const due7dTotal = dueByDay7d.reduce((sum, d) => sum + d.amount, 0);
    if (due7dTotal > 50_000_000) {
      alerts.push(`[HIGH_DUE_7D] ${due7dTotal.toLocaleString('vi-VN')}đ debt due in next 7 days`);
    }

    return {
      totalLoanDisbursed,
      totalDebtPaid,
      totalInterestPaid,
      totalPrincipalPaid,
      totalDebtOutstanding,
      totalDebtDue14d,
      nextDebtDueDate,
      dueByDay7d,
      byLoan,
      metadata: {
        asOfDate: today.toISOString().split('T')[0],
        timezone: 'Asia/Ho_Chi_Minh',
        windowDays,
        generatedAt: new Date().toISOString(),
      },
      alerts,
    };
  }
}
