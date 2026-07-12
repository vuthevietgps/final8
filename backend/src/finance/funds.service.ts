/**
﻿/**
 * FUNDS SERVICE - Quản lý 4 Quỹ theo Spec Chuẩn
 * ==================================================
 * 
 * KIẾN TRÚC CÁC QUỸ (FUNDS ARCHITECTURE):
 * 1. QUỸ ĐẶT CHỖ (Committed Cash) - Tiền đã có CHỦ nhưng CHƯA chi
 * 2. QUỸ ADS (Growth Capital) - Nguồn duy nhất được phép chạy ads
 * 3. QUỸ DỰ PHÒNG (Survival Buffer) - Đệm chống sốc hệ thống
 * 4. QUỸ OWNER (Thu nhập) - Tiền thực sự thuộc về chủ
 * 
 * MỖI QUỸ CÓ 5 LỚP DỮ LIỆU:
 * - Flow (Hôm qua): Δ tăng/giảm
 * - Stock (Lũy kế): Số dư hiện tại
 * - Projection (7-15 ngày): Ước tính tương lai
 * - Threshold (Ngưỡng): Mức an toàn / cảnh báo
 * - Permission (Quyền): Ai được dùng, điều kiện nào
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { FundingSource, FundingSourceDocument } from './schemas/funding-source.schema';
import { LoanContract, LoanContractDocument } from './schemas/loan-contract.schema';
import { FinanceService } from './finance.service';

// ===== INTERFACES =====

/**
 * Dữ liệu 5 lớp của mỗi quỹ
 */
export interface FundLayer {
  // 1. Flow (Hôm qua)
  flow: {
    yesterday: number;        // Số tiền tăng/giảm hôm qua
    reason?: string;          // Lý do tăng/giảm
  };
  
  // 2. Stock (Lũy kế)
  stock: {
    current: number;          // Số dư hiện tại
    asOf: Date;               // Thời điểm tính
  };
  
  // 3. Projection (7-15 ngày)
  projection: {
    days7: number;            // Ước tính sau 7 ngày
    days15: number;           // Ước tính sau 15 ngày
    trend: 'up' | 'down' | 'stable';
    dailyAverage: number;     // Trung bình ngày
  };
  
  // 4. Threshold (Ngưỡng)
  threshold: {
    min: number;              // Ngưỡng tối thiểu
    max: number;              // Ngưỡng tối đa
    status: 'safe' | 'warning' | 'danger';
    daysUntilMin?: number;    // Số ngày đến ngưỡng min
  };
  
  // 5. Permission (Quyền)
  permission: {
    canUse: boolean;          // Có được dùng không
    allowedFor: string[];     // Dùng cho việc gì
    blockedFor: string[];     // Không được dùng cho việc gì
    approvalRequired: boolean; // Cần duyệt không
  };
}

/**
 * Quỹ Đặt Chỗ (Committed Cash)
 */
export interface CommittedCashFund extends FundLayer {
  breakdown: {
    unpaidLaborCost: number;      // Lương chưa trả
    unpaidOtherCost: number;      // Chi phí vận hành chưa thanh toán
    unpaidAgentCommission: number; // Hoa hồng đại lý chưa trả
  };
}

/**
 * Quỹ Ads (Growth Capital)
 */
export interface AdsFund extends FundLayer {
  breakdown: {
    fromInitialCapital: number;   // 45% vốn ban đầu
    fromReinvestment: number;     // 45% lợi nhuận tái đầu tư
    adsSpent: number;             // Đã chi ads
    remaining: number;            // Còn lại
  };
  dailyBudget: {
    suggested: number;            // Budget đề xuất/ngày
    actual: number;               // Budget thực tế/ngày
    daysRemaining: number;        // Số ngày có thể chạy
  };
}

/**
 * Quỹ Dự Phòng (Survival Buffer)
 * Tích lũy theo 20% lợi nhuận, target = 3 tháng chi phí cố định
 */
export interface SurvivalBufferFund extends FundLayer {
  breakdown: {
    fromProfit: number;           // Tích lũy từ 20% lợi nhuận thuần
    used: number;                 // Đã sử dụng (emergency)
    remaining: number;            // Còn lại
  };
  target: {
    amount: number;               // Mục tiêu = 3 tháng chi phí cố định
    monthlyFixedCost: number;     // Chi phí cố định 1 tháng (lương + vận hành)
    targetMonths: number;         // Số tháng mục tiêu (3)
  };
  health: {
    percent: number;              // % đạt mục tiêu (current / target × 100)
    status: 'sufficient' | 'building' | 'critical'; // >= 100% | 50-99% | < 50%
    canSurviveMonths: number;     // Số tháng có thể duy trì với Reserve hiện tại
  };
  allocation: {
    profitPercent: number;        // % lợi nhuận phân bổ (20%)
    lastAllocation: number;       // Số tiền phân bổ lần gần nhất
    totalAllocated: number;       // Tổng đã phân bổ từ trước đến nay
  };
}

/**
 * Quỹ Owner (Thu nhập)
 * Được phân bổ 35% lợi nhuận, nhưng Owner ĐÃ RÚT ra ngoài hệ thống
 */
export interface OwnerFund extends FundLayer {
  breakdown: {
    fromProfit: number;           // 35% lợi nhuận thuần (KHÔNG phải 20%)
    withdrawn: number;            // Đã rút (OUT khỏi Bank Balance)
    retained: number;             // Giữ lại (vẫn trong hệ thống, chưa rút)
  };
  allocation: {
    profitPercent: number;        // % lợi nhuận phân bổ (35%)
    lastAllocation: number;       // Số tiền phân bổ lần gần nhất
    totalAllocated: number;       // Tổng đã phân bổ từ trước đến nay
  };
  withdrawalStats: {
    totalWithdrawn: number;       // Tổng đã rút từ trước đến nay
    lastWithdrawalDate: Date | null; // Lần rút gần nhất
    pendingWithdrawals: number;   // Số tiền đang chờ duyệt rút
  };
}

/**
 * Kết quả tính toán tổng hợp các quỹ
 */
export interface FundsOverview {
  // Doanh thu (Net Revenue)
  revenue: {
    total: number;                // Tổng doanh thu = COD thành công - tiền nhập hàng
    realized: number;             // Đã nhận từ NCC
    pending: number;              // Đang chờ NCC thanh toán
    orderCount: number;           // Số đơn
  };
  
  // Vốn ban đầu (Seed Capital) - NGUỒN, không phải quỹ
  seedCapital: {
    total: number;                // Tổng vốn vay/cá nhân
    allocated: number;            // Đã phân bổ
    remaining: number;            // Còn lại
  };
  
  // 4 Quỹ cốt lõi
  committedCash: CommittedCashFund;   // Quỹ Đặt Chỗ
  adsFund: AdsFund;                   // Quỹ Ads
  survivalBuffer: SurvivalBufferFund; // Quỹ Dự Phòng
  ownerFund: OwnerFund;               // Quỹ Owner
  
  // Lợi nhuận thuần (để phân bổ)
  netProfit: {
    realized: number;             // Lợi nhuận thuần đã thực hiện
    pending: number;              // Lợi nhuận thuần đang chờ
    total: number;                // Tổng
  };
  
  // Công thức kiểm tra
  validation: {
    bankBalance: number;          // T?ng ti?n ng�n h�ng hi?n t?i
    bankBalanceYesterday: number; // S? du ng�n h�ng h�m qua
    bankBalanceDelta: number;     // Bi?n d?ng (h�m nay - h�m qua)
    totalFunds: number;           // T?ng c�c qu?
    difference: number;           // Ch�nh l?ch (ph?i � 0)
    isValid: boolean;             // H? th?ng c� d�ng kh�ng
  };
  
  // Công thức cốt lõi
  formulas: {
    tienTuDo: number;             // TienTuDo = TongTienNganHang – QuyDatCho
    adsBudgetAllowed: number;     // AdsBudgetAllowed = min(QuyAds, TienTuDo)
  };
  
  // Dòng tiền (Cash Flow Tracking)
  cashFlow: {
    bankBalance: number;          // Tiền trong tài khoản
    bankBalanceYesterday: number;
    bankBalanceDelta: number;
    committedCash: number;        // Nợ phải trả
    freeCash: number;             // Tiền có thể dùng = Bank - Committed
  };
  
  // Hiệu quả kinh doanh (Business Performance)
  businessPerformance: {
    allocatedCash: number;        // Tiền đã phân bổ mục đích
    unallocatedCash: number;      // Tiền chưa phân bổ
    breakdown: {
      adsFund: number;
      reserveFund: number;
      ownerFund: number;
    };
  };
  
  calculatedAt: Date;
}

@Injectable()
export class FundsService {
  private readonly logger = new Logger(FundsService.name);
  private static readonly CACHE_KEY_OVERVIEW = 'finance:funds_overview';
  private static readonly CACHE_TTL_OVERVIEW = 15_000;
  private pendingOverview: Promise<FundsOverview> | null = null;

  constructor(
    @InjectModel(TestOrder2.name)
    private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(FundingSource.name)
    private readonly fundingSourceModel: Model<FundingSourceDocument>,
    @InjectModel(LoanContract.name)
    private readonly loanModel: Model<LoanContractDocument>,
    private readonly financeService: FinanceService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  /**
   * Tính toán tổng hợp các quỹ theo Spec chuẩn
   */
  async computeFundsOverview(): Promise<FundsOverview> {
    try {
      const cached = await this.cacheManager.get<FundsOverview>(FundsService.CACHE_KEY_OVERVIEW);
      if (cached) {
        return cached;
      }

      if (this.pendingOverview) {
        return this.pendingOverview;
      }

      this.pendingOverview = this.doComputeFundsOverview();
      const overview = await this.pendingOverview;
      await this.cacheManager.set(FundsService.CACHE_KEY_OVERVIEW, overview, FundsService.CACHE_TTL_OVERVIEW);
      return overview;
    } catch (err) {
      this.logger.error('computeFundsOverview failed', err);
      throw err;
    } finally {
      this.pendingOverview = null;
    }
  }

  invalidateCache(reason = 'unspecified'): void {
    void this.cacheManager.del(FundsService.CACHE_KEY_OVERVIEW).catch((err) => {
      this.logger.warn(`[CACHE_INVALIDATED] funds overview delete failed`, err);
    });
    this.logger.debug(`[CACHE_INVALIDATED] ${reason}`);
  }

  private async doComputeFundsOverview(): Promise<FundsOverview> {
    // 1. Lấy Vốn ban đầu (Seed Capital) trước vì vài nhánh phụ thuộc seed
    const seedCapital = await this.getSeedCapital();

    // 2. Những phép tính không phụ thuộc nhau chạy song song
    const [revenue, netProfit, committedCash, bankBalance] = await Promise.all([
      this.computeRevenue(),
      this.computeNetProfit(),
      this.computeCommittedCashFund(),
      this.computeBankBalance(seedCapital.total),
    ]);

    // 3. Các quỹ phụ thuộc vào netProfit/seedCapital
    const [adsFund, survivalBuffer, ownerFund, bankBalanceYesterday] = await Promise.all([
      this.computeAdsFund(seedCapital.total, netProfit.realized),
      this.computeSurvivalBufferFund(netProfit.realized),
      this.computeOwnerFund(netProfit.realized),
      this.computeBankBalanceAsOf(this.getYesterdayEnd(), seedCapital.total),
    ]);

    // 4. Công thức kiểm tra
    const totalFunds = committedCash.stock.current + adsFund.stock.current +
                      survivalBuffer.stock.current + ownerFund.stock.current;

    // ===== 10. PHÂN TÁCH: DÒNG TIỀN vs HIỆU QUẢ KINH DOANH =====

    /**
     * ════════════════════════════════════════════════════════════════════════
     * PHẦN 1: DÒNG TIỀN (CASH FLOW TRACKING)
     * ════════════════════════════════════════════════════════════════════════
     * Mục đích: Theo dõi tiền MẶT THỰC TẾ
     * Câu hỏi: "Có bao nhiêu tiền CÓ THỂ chi ngay bây giờ?"
     */

    const freeCashFlow = bankBalance - committedCash.stock.current;
    const allocatedCash = adsFund.stock.current + survivalBuffer.stock.current + ownerFund.stock.current;
    const unallocatedCash = freeCashFlow - allocatedCash;
    const tienTuDo = freeCashFlow;
    const adsBudgetAllowed = adsFund.stock.current;
    const bankBalanceDelta = bankBalance - bankBalanceYesterday;

    return {
      revenue,
      seedCapital,
      committedCash,
      adsFund,
      survivalBuffer,
      ownerFund,
      netProfit,
      cashFlow: {
        bankBalance,
        bankBalanceYesterday,
        bankBalanceDelta,
        committedCash: committedCash.stock.current,
        freeCash: freeCashFlow,
      },
      businessPerformance: {
        allocatedCash,
        unallocatedCash,
        breakdown: {
          adsFund: adsFund.stock.current,
          reserveFund: survivalBuffer.stock.current,
          ownerFund: ownerFund.stock.current,
        }
      },
      validation: {
        bankBalance,
        bankBalanceYesterday,
        bankBalanceDelta,
        totalFunds,
        difference: Math.abs(bankBalance - totalFunds),
        isValid: Math.abs(bankBalance - totalFunds) < 1000
      },
      formulas: {
        tienTuDo,
        adsBudgetAllowed
      },
      calculatedAt: new Date()
    };
  }

  private getYesterdayEnd(): Date {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);
    return yesterday;
  }

  /**
   * DOANH THU = COD giao thành công - tiền nhập hàng
   * Chỉ ghi nhận khi: đơn đã chốt + NCC đã thanh toán
   */
  private async computeRevenue() {
    // 1. Doanh thu đã realized (NCC đã thanh toán)
    const realizedResult = await this.orderModel.aggregate([
      { 
        $match: { 
          orderStatus: 'Giao thành công',
          supplierPaymentStatus: 'paid',
          codAmount: { $exists: true, $gt: 0 }
        } 
      },
      { 
        $group: { 
          _id: null,
          // Doanh thu = COD - tiền nhập hàng (supplierAppliedPrice * quantity)
          totalRevenue: { 
            $sum: { 
              $subtract: [
                { $ifNull: ['$codAmount', 0] },
                { $multiply: [
                  { $ifNull: ['$supplierAppliedPrice', 0] },
                  { $ifNull: ['$quantity', 1] }
                ]}
              ]
            }
          },
          count: { $sum: 1 }
        } 
      }
    ]);
    
    const realizedRevenue = realizedResult?.[0]?.totalRevenue || 0;
    const realizedCount = realizedResult?.[0]?.count || 0;

    // 2. Doanh thu pending (đơn thành công nhưng NCC chưa thanh toán)
    const pendingResult = await this.orderModel.aggregate([
      { 
        $match: { 
          orderStatus: 'Giao thành công',
          supplierPaymentStatus: { $ne: 'paid' },
          codAmount: { $exists: true, $gt: 0 }
        } 
      },
      { 
        $group: { 
          _id: null,
          totalRevenue: { 
            $sum: { 
              $subtract: [
                { $ifNull: ['$codAmount', 0] },
                { $multiply: [
                  { $ifNull: ['$supplierAppliedPrice', 0] },
                  { $ifNull: ['$quantity', 1] }
                ]}
              ]
            }
          },
          count: { $sum: 1 }
        } 
      }
    ]);
    
    const pendingRevenue = pendingResult?.[0]?.totalRevenue || 0;
    const pendingCount = pendingResult?.[0]?.count || 0;

    return {
      total: realizedRevenue + pendingRevenue,
      realized: realizedRevenue,
      pending: pendingRevenue,
      orderCount: realizedCount + pendingCount
    };
  }

  /**
   * VỐN BAN ĐẦU (Seed Capital)
   * = Vốn vay + Vốn cá nhân bỏ vào
   */
  private async getSeedCapital() {
    // 1. Lấy vốn từ LoanContract (khoản vay) - CHỈ tính phần đã giải ngân
    const loanResult = await this.loanModel.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ['$disbursedAmount', 0] } } } }
    ]);
    const loanTotal = loanResult?.[0]?.total || 0;
    
    // 2. Lấy vốn từ FundingSource
    const fundingSources = await this.fundingSourceModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$principal', { $ifNull: ['$initialAmount', 0] }] } },
          allocated: { $sum: { $ifNull: ['$allocatedAmount', 0] } }
        }
      }
    ]);

    const fundingTotal = fundingSources?.[0]?.total || 0;
    const allocated = fundingSources?.[0]?.allocated || 0;

    return {
      total: loanTotal + fundingTotal,
      allocated,
      remaining: loanTotal + fundingTotal - allocated
    };
  }

  /**
   * LỢI NHUẬN THUẦN
   */
  private async computeNetProfit() {
    // 1. Realized (đã thanh toán cả 2 bên)
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
          total: { $sum: '$realizedNetProfit' }
        } 
      }
    ]);
    const realized = realizedResult?.[0]?.total || 0;

    // 2. Pending (chờ thanh toán)
    const pendingResult = await this.orderModel.aggregate([
      { 
        $match: { 
          orderStatus: { $in: ['Giao thành công', 'Hàng hoàn'] },
          realizedAt: { $in: [null, undefined] },
          netProfit: { $exists: true }
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$netProfit' }
        } 
      }
    ]);
    const pending = pendingResult?.[0]?.total || 0;

    return {
      realized,
      pending,
      total: realized + pending
    };
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * SỐ DƯ NGÂN HÀNG (Bank Balance)
   * ═══════════════════════════════════════════════════════════════════════════
   * 
   * ĐẠI DIỆN CHO: Số tiền THỰC TẾ trong tài khoản ngân hàng tại thời điểm hiện tại
   * 
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * CÔNG THỨC TỔNG QUÁT:
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 
   * Bank Balance = Vốn Đầu Vào + Doanh Thu Thực Tế - Chi Phí Đã Chi
   * 
   * Hay:
   * Bank Balance = Initial Capital + Total Revenue - Total Actual Costs
   * 
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * CHI TIẾT TỪNG THÀNH PHẦN:
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 
   * 1️⃣ TIỀN VÀO (+):
   *    ┌─────────────────────────────────────────────────────────────────────┐
   *    │ a) Initial Capital (Vốn Ban Đầu)                                    │
   *    │    - Nguồn: funding_sources collection                              │
   *    │    - Điều kiện: type = 'initial_capital'                            │
   *    │    - Ý nghĩa: Vốn gốc bỏ ra lúc bắt đầu kinh doanh                 │
   *    │    - Ví dụ: Vay ngân hàng 1 tỷ, vốn tự có 500M → Total: 1.5 tỷ   │
   *    └─────────────────────────────────────────────────────────────────────┘
   *    
   *    ┌─────────────────────────────────────────────────────────────────────┐
   *    │ b) Total Revenue (Doanh Thu Thực Tế)                                │
   *    │    - Nguồn: testorder2 collection                                   │
   *    │    - Điều kiện: supplierPaymentStatus = 'paid'                      │
   *    │    - Field: SUM(supplierPaidAmount)                                 │
   *    │    - Ý nghĩa: Tổng tiền THỰC SỰ nhận được từ đơn hàng              │
   *    │    - Logic: Chỉ tính đơn đã thanh toán cho NCC (nghĩa là            │
   *    │             khách hàng đã trả tiền cho ta)                          │
   *    │    - Ví dụ:                                                         │
   *    │      * Đơn #1: Khách trả 100k → Đã thanh toán NCC → +100k ✅       │
   *    │      * Đơn #2: Khách trả 200k → Chưa trả NCC → KHÔNG TÍNH ❌       │
   *    │      → Revenue = 100k                                               │
   *    └─────────────────────────────────────────────────────────────────────┘
   * 
   * 2️⃣ TIỀN RA (-):
   *    ┌─────────────────────────────────────────────────────────────────────┐
   *    │ a) Supplier Cost Paid (Chi Phí NCC Đã Trả)                         │
   *    │    - Nguồn: testorder2 collection                                   │
   *    │    - Điều kiện: supplierPaymentStatus = 'paid'                      │
   *    │    - Công thức: SUM(supplierQuote × quantity)                       │
   *    │    - Ý nghĩa: Tiền ĐÃ CHUYỂN cho nhà cung cấp                       │
   *    │    - Ví dụ:                                                         │
   *    │      * Đơn #1: Mua hàng 70k → Đã trả NCC → -70k ✅                 │
   *    │      * Đơn #2: Mua hàng 50k → Chưa trả → KHÔNG TRỪ ❌              │
   *    └─────────────────────────────────────────────────────────────────────┘
   *    
   *    ┌─────────────────────────────────────────────────────────────────────┐
   *    │ b) Agent Commission Paid (Hoa Hồng Đại Lý Đã Trả)                  │
   *    │    - Nguồn: testorder2 collection                                   │
   *    │    - Điều kiện: agentPaymentStatus = 'paid'                         │
   *    │    - Công thức: SUM(agentQuote × quantity)                          │
   *    │    - Ý nghĩa: Tiền ĐÃ TRẢ cho đại lý/sales                          │
   *    │    - Ví dụ: Đại lý A được hoa hồng 10k/đơn → Đã trả → -10k        │
   *    └─────────────────────────────────────────────────────────────────────┘
   *    
   *    ┌─────────────────────────────────────────────────────────────────────┐
   *    │ c) Labor Cost Paid (Lương Đã Trả)                                   │
   *    │    - Nguồn: laborstatements collection                              │
   *    │    - Điều kiện: status = 'closed'                                   │
   *    │    - Công thức: SUM(openingBalance + periodCost + bonus - deduction)│
   *    │    - Ý nghĩa: Lương ĐÃ CHUYỂN CHO nhân viên                         │
   *    │    - Ví dụ: Tháng 1 đã trả lương 50M → -50M                         │
   *    └─────────────────────────────────────────────────────────────────────┘
   *    
   *    ┌─────────────────────────────────────────────────────────────────────┐
   *    │ d) Other Cost Confirmed (Chi Phí Khác Đã Chi)                       │
   *    │    - Nguồn: othercosts collection                                   │
   *    │    - Điều kiện: isConfirmed = true                                  │
   *    │    - Field: SUM(amount)                                             │
   *    │    - Ý nghĩa: Chi phí văn phòng, điện nước... ĐÃ THANH TOÁN        │
   *    │    - Workflow:                                                      │
   *    │      * isConfirmed=false → Chưa chi, chỉ cam kết                    │
   *    │      * isConfirmed=true → ĐÃ CHI, trừ vào bank balance             │
   *    │    - Ví dụ: Tiền điện 5M đã thanh toán → -5M                        │
   *    └─────────────────────────────────────────────────────────────────────┘
   *    
   *    ┌─────────────────────────────────────────────────────────────────────┐
   *    │ e) Ads Spent (Chi Phí Quảng Cáo)                                    │
   *    │    - Nguồn: testorder2.advertisingCost                              │
   *    │    - Field: SUM(advertisingCost)                                    │
   *    │    - Ý nghĩa: Tổng chi phí ads đã phát sinh từ đơn hàng             │
   *    │    - Ví dụ: Chạy ads cho 10 đơn, mỗi đơn cost 50k → -500k          │
   *    └─────────────────────────────────────────────────────────────────────┘
   * 
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * VÍ DỤ TÍNH TOÁN THỰC TẾ:
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 
   * Vốn ban đầu:           1,000,000,000₫  (1 tỷ)
   * (+) Doanh thu:           500,000,000₫  (Khách đã trả, NCC đã thanh toán)
   * (-) Chi NCC:            -300,000,000₫  (Đã chuyển tiền cho NCC)
   * (-) Hoa hồng đại lý:     -50,000,000₫  (Đã trả sales)
   * (-) Lương:              -100,000,000₫  (Đã trả nhân viên)
   * (-) Chi phí khác:        -20,000,000₫  (Điện, nước, văn phòng đã thanh toán)
   * (-) Chi phí ads:         -80,000,000₫  (Đã chạy ads)
   * ──────────────────────────────────────
   * = Số dư ngân hàng:       950,000,000₫ ✅
   * 
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * NGUYÊN TẮC QUAN TRỌNG:
   * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   * 
   * ✅ CHỈ TÍNH: Giao dịch ĐÃ HOÀN THÀNH (tiền đã vào/ra thực tế)
   * ❌ KHÔNG TÍNH: Khoản dự kiến, chưa thanh toán (→ thuộc Committed Cash)
   * 
   * Bank Balance = "Tiền THẬT trong ngân hàng lúc này"
   * ≠ Tiền dự kiến có
   * ≠ Tiền sẽ thu
   * ≠ Lợi nhuận ước tính
   * 
   * ═══════════════════════════════════════════════════════════════════════════
   * ---------------------------------------------------------------------------
   */
  private async computeBankBalance(_seedCapital: number): Promise<number> {
    // Delegate to the single authoritative implementation in FinanceService.
    // This ensures the Funds Dashboard always matches the CFO Dashboard.
    return this.financeService.calculateMasterBankBalance();
  }

  /**
   * TÍNH SỐ DƯ NGÂN HÀNG TẠI THỜI ĐIỂM CỤ THỂ
   * Dùng để tính Bank Balance hôm qua, hoặc bất kỳ ngày nào trong quá khứ
   */
  private async computeBankBalanceAsOf(endDate: Date, seedCapital: number): Promise<number> {
    // ---------------------------------------------------------------------------
    // DOANH THU = supplierPaidAmount (d� thanh to�n TRU?C endDate)
    // ---------------------------------------------------------------------------
    const revenueResult = await this.orderModel.aggregate([
      {
        $match: {
          supplierPaymentStatus: 'paid',
          supplierPaidAt: { $lte: endDate },
          supplierPaidAmount: { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$supplierPaidAmount' }
        }
      }
    ]);
    const totalRevenue = revenueResult?.[0]?.totalRevenue || 0;

    // ---------------------------------------------------------------------------
    // HOA H?NG �?I L� �� TR? (tru?c endDate)
    // ---------------------------------------------------------------------------
    const agentCommissionResult = await this.orderModel.aggregate([
      {
        $match: {
          agentPaymentStatus: 'paid',
          agentPaidAt: { $lte: endDate },
          agentPaidAmount: { $exists: true, $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$agentPaidAmount' }
        }
      }
    ]);
    const agentCommissionPaid = agentCommissionResult?.[0]?.total || 0;

    // ---------------------------------------------------------------------------
    // LUONG �� TR? (k? luong d� d�ng tru?c endDate)
    // ---------------------------------------------------------------------------
    const laborResult = await this.orderModel.db.collection('laborstatements').aggregate([
      { 
        $match: { 
          status: 'closed',
          closedAt: { $lte: endDate }
        } 
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $add: [
                { $ifNull: ['$openingBalance', 0] },
                { $ifNull: ['$periodCost', 0] },
                { $ifNull: ['$bonus', 0] },
                { $multiply: [{ $ifNull: ['$deduction', 0] }, -1] }
              ]
            }
          }
        }
      }
    ]).toArray();
    const laborCostPaid = laborResult?.[0]?.total || 0;

    // ---------------------------------------------------------------------------
    // CHI PH� KH�C �� X�C NH?N (tru?c endDate)
    // ---------------------------------------------------------------------------
    const otherCostResult = await this.orderModel.db.collection('othercosts').aggregate([
      { 
        $match: { 
          isConfirmed: true,
          confirmedAt: { $lte: endDate }
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    const otherCostConfirmed = otherCostResult?.[0]?.total || 0;

    // ---------------------------------------------------------------------------
    // CHI PH� QU?NG C�O (tru?c endDate)
    // ---------------------------------------------------------------------------
    const adsSpentResult = await this.orderModel.db.collection('advertisingcosts').aggregate([
      { 
        $match: {
          date: { $lte: endDate }
        }
      },
      { $group: { _id: null, total: { $sum: '$spend' } } }
    ]).toArray();
    const adsSpent = adsSpentResult?.[0]?.total || 0;

    // ---------------------------------------------------------------------------
    // OWNER FUND �� R�T (tru?c endDate)
    // ---------------------------------------------------------------------------
    const ownerWithdrawnResult = await this.orderModel.db.collection('capital_allocation_snapshots').aggregate([
      { 
        $match: {
          date: { $lte: endDate }
        }
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$personalIncomeWithdrawn', 0] } } } }
    ]).toArray();
    const ownerWithdrawn = ownerWithdrawnResult?.[0]?.total || 0;

    // ---------------------------------------------------------------------------
    // TRẢ NỢ VAY (trước endDate)
    // ---------------------------------------------------------------------------
    const loanRepaymentResult = await this.orderModel.db.collection('loanrepayments').aggregate([
      {
        $match: {
          paid: true,
          paidDate: { $lte: endDate },
          fundingSource: { $ne: 'owner_fund' }
        }
      },
      { $group: {
        _id: null,
        total: { $sum: { $add: [{ $ifNull: ['$amountPrincipal', 0] }, { $ifNull: ['$amountInterest', 0] }] } }
      } }
    ]).toArray();
    const loanRepayment = loanRepaymentResult?.[0]?.total || 0;

    // ---------------------------------------------------------------------------
    // T�NH S? DU NG�N H�NG T?I endDate
    // ---------------------------------------------------------------------------
    const totalCashIn = seedCapital + totalRevenue;
    const totalCashOut = adsSpent + laborCostPaid + otherCostConfirmed + agentCommissionPaid + ownerWithdrawn + loanRepayment;
    const bankBalance = totalCashIn - totalCashOut;

    return Math.max(0, bankBalance);
  }

  private async computeCommittedCashFund(): Promise<CommittedCashFund> {
    // 1. Lương chưa trả - Từ LaborStatement
    const unpaidLaborResult = await this.orderModel.db.collection('laborstatements').aggregate([
      { $match: { status: { $in: ['draft', 'open'] } } },
      { $group: { _id: null, total: { $sum: '$closingBalance' } } }
    ]).toArray();
    const unpaidLaborCost = unpaidLaborResult?.[0]?.total || 0;

    // 2. Chi phí vận hành CHƯA THANH TOÁN (isConfirmed = false)
    // → Đã phát sinh nghĩa vụ nhưng chưa chi thực tế
    // → Ghi nhận vào Committed Cash để "đặt chỗ" tiền
    const unpaidOtherResult = await this.orderModel.db.collection('othercosts').aggregate([
      { $match: { isConfirmed: { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();
    const unpaidOtherCost = unpaidOtherResult?.[0]?.total || 0;

    // 3. Hoa hồng đại lý chưa trả
    const unpaidAgentResult = await this.orderModel.aggregate([
      { 
        $match: { 
          orderStatus: { $in: ['Giao thành công', 'Hàng hoàn'] },
          agentPaymentStatus: 'pending',
          agentQuote: { $gt: 0 }
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: { $multiply: ['$agentQuote', { $ifNull: ['$quantity', 1] }] } }
        } 
      }
    ]);
    const unpaidAgentCommission = unpaidAgentResult?.[0]?.total || 0;

    const totalCommitted = unpaidLaborCost + unpaidOtherCost + unpaidAgentCommission;

    // Tính Flow (hôm qua) - cần snapshot trước
    const yesterday = await this.getYesterdayCommitted();
    const flowYesterday = totalCommitted - yesterday;

    return {
      breakdown: {
        unpaidLaborCost,
        unpaidOtherCost,
        unpaidAgentCommission
      },
      flow: {
        yesterday: flowYesterday,
        reason: flowYesterday > 0 ? 'Nghĩa vụ tăng' : flowYesterday < 0 ? 'Đã thanh toán' : 'Không đổi'
      },
      stock: {
        current: totalCommitted,
        asOf: new Date()
      },
      projection: {
        days7: totalCommitted * 1.1, // Ước tính tăng 10%
        days15: totalCommitted * 1.2,
        trend: flowYesterday > 0 ? 'up' : flowYesterday < 0 ? 'down' : 'stable',
        dailyAverage: Math.abs(flowYesterday)
      },
      threshold: {
        min: 0,
        max: totalCommitted * 2, // Cảnh báo nếu vượt 2x
        status: totalCommitted < 50000000 ? 'safe' : totalCommitted < 100000000 ? 'warning' : 'danger',
        daysUntilMin: undefined
      },
      permission: {
        canUse: false,
        allowedFor: ['Trả lương', 'Trả chi phí vận hành', 'Trả hoa hồng đại lý'],
        blockedFor: ['Chạy ads', 'Chi tiêu cá nhân', 'Đầu tư'],
        approvalRequired: true
      }
    };
  }

  /**
   * QUỸ ADS (Growth Capital)
   * = 45% vốn ban đầu + 45% lợi nhuận thuần tái đầu tư - ads đã chi
   */
  private async computeAdsFund(seedCapital: number, realizedProfit: number): Promise<AdsFund> {
    // Tính nguồn
    const fromInitialCapital = Math.round(seedCapital * 0.45);
    const fromReinvestment = Math.round(realizedProfit * 0.45);
    
    // Ads đã chi (tổng lũy kế từ đơn hàng)
    const adsSpentResult = await this.orderModel.aggregate([
      { 
        $match: { 
          advertisingCost: { $exists: true, $gt: 0 }
        } 
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$advertisingCost' }
        } 
      }
    ]);
    const adsSpent = adsSpentResult?.[0]?.total || 0;
    
    const totalAvailable = fromInitialCapital + fromReinvestment;
    const remaining = Math.max(0, totalAvailable - adsSpent);

    // ===== CHI PHÍ ADS NGÀY HÔM QUA (từ collection advertisingcosts) =====
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const yesterdayResult = await this.orderModel.db.collection('advertisingcosts').aggregate([
      { 
        $match: { 
          date: { $gte: yesterday, $lte: endOfYesterday }
        }
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$spentAmount' }
        } 
      }
    ]).toArray();
    const yesterdaySpent = yesterdayResult?.[0]?.total || 0;

    // ===== TRUNG BÌNH 7 NGÀY (để tính projection) =====
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyAdsResult = await this.orderModel.db.collection('advertisingcosts').aggregate([
      { 
        $match: { 
          date: { $gte: sevenDaysAgo }
        }
      },
      { 
        $group: { 
          _id: null, 
          total: { $sum: '$spentAmount' }, 
          days: { $addToSet: '$date' } 
        } 
      }
    ]).toArray();
    const avgDailySpend = dailyAdsResult?.[0] 
      ? dailyAdsResult[0].total / (dailyAdsResult[0].days?.length || 7)
      : 0;
    const daysRemaining = avgDailySpend > 0 ? Math.floor(remaining / avgDailySpend) : 999;

    return {
      breakdown: {
        fromInitialCapital,
        fromReinvestment,
        adsSpent,
        remaining
      },
      flow: {
        yesterday: -Math.abs(yesterdaySpent), // Chi phí ads thực tế ngày hôm qua (luôn âm)
        reason: `Chi phí quảng cáo ngày hôm qua: ${yesterdaySpent.toLocaleString('vi-VN')} đ`
      },
      stock: {
        current: remaining,
        asOf: new Date()
      },
      projection: {
        days7: remaining - avgDailySpend * 7,
        days15: remaining - avgDailySpend * 15,
        trend: 'down',
        dailyAverage: avgDailySpend
      },
      threshold: {
        min: avgDailySpend * 3, // Tối thiểu 3 ngày
        max: totalAvailable,
        status: daysRemaining >= 7 ? 'safe' : daysRemaining >= 3 ? 'warning' : 'danger',
        daysUntilMin: daysRemaining
      },
      permission: {
        canUse: true,
        allowedFor: ['Chạy ads Facebook', 'Chạy ads Google', 'Chạy ads TikTok'],
        blockedFor: ['Trả lương', 'Chi tiêu cá nhân', 'Trả hoa hồng'],
        approvalRequired: false
      },
      dailyBudget: {
        suggested: Math.min(remaining / 7, avgDailySpend * 1.2), // Không tăng quá 20%
        actual: avgDailySpend,
        daysRemaining
      }
    };
  }

  /**
   * QUỸ DỰ PHÒNG (Survival Buffer)
   * = 20% lợi nhuận thuần
   */
  /**
   * QUỸ DỰ PHÒNG (Survival Buffer)
   * 
   * LOGIC MỚI:
   * 1. Tích lũy: 20% lợi nhuận thuần mỗi kỳ
   * 2. Target: 3 tháng chi phí cố định (lương + vận hành)
   * 3. Health: % đạt target, số tháng có thể duy trì
   */
  private async computeSurvivalBufferFund(realizedProfit: number): Promise<SurvivalBufferFund> {
    // 1. Phân bổ từ lợi nhuận
    const profitPercent = 0.20; // 20%
    const fromProfit = Math.round(realizedProfit * profitPercent);
    const used = 0; // TODO: Track emergency usage from DB
    const remaining = fromProfit - used;

    // 2. Tính chi phí cố định hàng tháng (lương + vận hành)
    // Lấy trung bình 3 tháng gần nhất
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    // Lương trung bình/tháng
    const laborAvgResult = await this.orderModel.db.collection('laborstatements').aggregate([
      { 
        $match: { 
          status: 'closed',
          closedAt: { $gte: threeMonthsAgo }
        } 
      },
      {
        $group: {
          _id: { 
            year: { $year: '$closedAt' },
            month: { $month: '$closedAt' }
          },
          monthlyTotal: {
            $sum: {
              $add: [
                { $ifNull: ['$openingBalance', 0] },
                { $ifNull: ['$periodCost', 0] },
                { $ifNull: ['$bonus', 0] },
                { $multiply: [{ $ifNull: ['$deduction', 0] }, -1] }
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          avgMonthlyLabor: { $avg: '$monthlyTotal' }
        }
      }
    ]).toArray();
    const avgMonthlyLabor = laborAvgResult?.[0]?.avgMonthlyLabor || 0;

    // Vận hành trung bình/tháng
    const otherCostAvgResult = await this.orderModel.db.collection('othercosts').aggregate([
      { 
        $match: { 
          isConfirmed: true,
          confirmedAt: { $gte: threeMonthsAgo }
        } 
      },
      {
        $group: {
          _id: { 
            year: { $year: '$confirmedAt' },
            month: { $month: '$confirmedAt' }
          },
          monthlyTotal: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: null,
          avgMonthlyOther: { $avg: '$monthlyTotal' }
        }
      }
    ]).toArray();
    const avgMonthlyOther = otherCostAvgResult?.[0]?.avgMonthlyOther || 0;

    const monthlyFixedCost = Math.round(avgMonthlyLabor + avgMonthlyOther);
    const targetMonths = 3;
    const targetAmount = monthlyFixedCost * targetMonths;

    // 3. Tính health
    const healthPercent = targetAmount > 0 
      ? Math.round((remaining / targetAmount) * 100) 
      : 100;
    
    const canSurviveMonths = monthlyFixedCost > 0
      ? Number((remaining / monthlyFixedCost).toFixed(1))
      : 999;

    let healthStatus: 'sufficient' | 'building' | 'critical';
    if (healthPercent >= 100) {
      healthStatus = 'sufficient';
    } else if (healthPercent >= 50) {
      healthStatus = 'building';
    } else {
      healthStatus = 'critical';
    }

    return {
      breakdown: {
        fromProfit,
        used,
        remaining
      },
      target: {
        amount: targetAmount,
        monthlyFixedCost,
        targetMonths
      },
      health: {
        percent: healthPercent,
        status: healthStatus,
        canSurviveMonths
      },
      allocation: {
        profitPercent,
        lastAllocation: fromProfit,
        totalAllocated: fromProfit // TODO: Sum from historical data
      },
      flow: {
        yesterday: 0, // TODO: Track daily changes
        reason: 'Tích lũy từ lợi nhuận'
      },
      stock: {
        current: remaining,
        asOf: new Date()
      },
      projection: {
        days7: remaining,
        days15: remaining,
        trend: 'stable',
        dailyAverage: 0
      },
      threshold: {
        min: monthlyFixedCost * 1.5, // Tối thiểu 1.5 tháng
        max: targetAmount,            // Tối đa 3 tháng
        status: healthStatus === 'sufficient' ? 'safe' : 
                healthStatus === 'building' ? 'warning' : 'danger',
        daysUntilMin: canSurviveMonths * 30 // Convert to days
      },
      permission: {
        canUse: false, // Chỉ dùng khi khủng hoảng
        allowedFor: ['Khủng hoảng cashflow', 'Emergency', 'Sự cố bất khả kháng'],
        blockedFor: ['Chạy ads', 'Scale', 'Chi tiêu thường xuyên', 'Bonus'],
        approvalRequired: true // Cần Director approve
      }
    };
  }

  /**
   * QUỸ OWNER (Thu nhập)
   * 
   * LOGIC MỚI:
   * 1. Phân bổ: 35% lợi nhuận thuần (KHÔNG phải 20%)
   * 2. Owner có thể RÚT tiền ra ngoài hệ thống
   * 3. Tiền đã rút = OUT khỏi Bank Balance, KHÔNG tính vào Allocated Cash
   */
  private async computeOwnerFund(realizedProfit: number): Promise<OwnerFund> {
    const profitPercent = 0.35; // 35%
    const fromProfit = Math.round(realizedProfit * profitPercent);
    
    // TODO: Query từ Owner Fund Management module
    const withdrawn = 0; // Tổng đã rút (từ withdrawals collection)
    const retained = fromProfit - withdrawn;

    return {
      breakdown: {
        fromProfit,
        withdrawn,
        retained
      },
      allocation: {
        profitPercent,
        lastAllocation: fromProfit,
        totalAllocated: fromProfit // TODO: Sum from historical data
      },
      withdrawalStats: {
        totalWithdrawn: withdrawn,
        lastWithdrawalDate: null, // TODO: Query last withdrawal
        pendingWithdrawals: 0 // TODO: Count pending withdrawals
      },
      flow: {
        yesterday: 0,
        reason: 'Phân bổ từ lợi nhuận'
      },
      stock: {
        current: retained, // Chỉ tính phần chưa rút
        asOf: new Date()
      },
      projection: {
        days7: retained,
        days15: retained,
        trend: 'stable',
        dailyAverage: 0
      },
      threshold: {
        min: 0,
        max: fromProfit,
        status: 'safe',
        daysUntilMin: 999
      },
      permission: {
        canUse: true, // Owner được toàn quyền rút
        allowedFor: ['Rút về tài khoản cá nhân', 'Thu nhập chủ doanh nghiệp'],
        blockedFor: [], // Không bị chặn
        approvalRequired: false // Tự động approve (vì là Owner)
      }
    };
  }

  /**
   * Helper: Lấy committed cash hôm qua (từ snapshot)
   */
  private async getYesterdayCommitted(): Promise<number> {
    // TODO: Implement snapshot system
    return 0;
  }
}
