import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { CapitalAllocationPolicy, CapitalAllocationPolicyDocument } from './schemas/capital-allocation-policy.schema';
import { CapitalAllocationSnapshot, CapitalAllocationSnapshotDocument } from './schemas/capital-allocation-snapshot.schema';
import { FinanceService } from './finance.service';
import { CreateCapitalAllocationPolicyDto, UpdateCapitalAllocationPolicyDto } from './dto/create-capital-allocation-policy.dto';

@Injectable()
export class CapitalAllocationService {
  private readonly logger = new Logger(CapitalAllocationService.name);

  constructor(
    @InjectModel(CapitalAllocationPolicy.name)
    private readonly policyModel: Model<CapitalAllocationPolicyDocument>,
    @InjectModel(CapitalAllocationSnapshot.name)
    private readonly snapshotModel: Model<CapitalAllocationSnapshotDocument>,
    private readonly financeService: FinanceService,
  ) {}

  /**
   * Tạo policy mới
   */
  async createPolicy(dto: CreateCapitalAllocationPolicyDto) {
    // Validate tổng tỷ lệ = 100%
    const total = dto.reinvestmentRatio + dto.safetyReserveRatio + 
                  dto.personalIncomeRatio + dto.longTermAssetRatio;
    
    if (Math.abs(total - 100) > 0.01) {
      throw new BadRequestException(`Tổng tỷ lệ phải = 100%. Hiện tại: ${total}%`);
    }

    // Nếu set isActive = true, cần deactivate policy cũ
    if (dto.isActive) {
      await this.policyModel.updateMany(
        { isActive: true },
        { $set: { isActive: false } }
      );
    }

    const policy = new this.policyModel({
      ...dto,
      activatedAt: dto.isActive ? new Date() : undefined
    });

    return policy.save();
  }

  /**
   * Lấy tất cả policies
   */
  async getAllPolicies() {
    return this.policyModel.find().sort({ isActive: -1, createdAt: -1 }).exec();
  }

  /**
   * Lấy active policy
   */
  async getActivePolicy() {
    const policy = await this.policyModel.findOne({ isActive: true }).exec();
    if (!policy) {
      throw new NotFoundException('Chưa có policy active. Vui lòng tạo và kích hoạt policy.');
    }
    return policy;
  }

  /**
   * Update policy
   */
  async updatePolicy(id: string, dto: UpdateCapitalAllocationPolicyDto) {
    const policy = await this.policyModel.findById(id);
    if (!policy) {
      throw new NotFoundException('Policy không tồn tại');
    }

    // Nếu update tỷ lệ, validate tổng = 100%
    if (dto.reinvestmentRatio !== undefined || dto.safetyReserveRatio !== undefined ||
        dto.personalIncomeRatio !== undefined || dto.longTermAssetRatio !== undefined) {
      const reinvestment = dto.reinvestmentRatio ?? policy.reinvestmentRatio;
      const safety = dto.safetyReserveRatio ?? policy.safetyReserveRatio;
      const personal = dto.personalIncomeRatio ?? policy.personalIncomeRatio;
      const longTerm = dto.longTermAssetRatio ?? policy.longTermAssetRatio;
      const total = reinvestment + safety + personal + longTerm;

      if (Math.abs(total - 100) > 0.01) {
        throw new BadRequestException(`Tổng tỷ lệ phải = 100%. Hiện tại: ${total}%`);
      }
    }

    // Nếu set isActive = true, deactivate các policy khác
    if (dto.isActive === true && !policy.isActive) {
      await this.policyModel.updateMany(
        { _id: { $ne: id }, isActive: true },
        { $set: { isActive: false } }
      );
      dto['activatedAt'] = new Date();
    }

    Object.assign(policy, dto);
    return policy.save();
  }

  /**
   * Delete policy
   */
  async deletePolicy(id: string) {
    const policy = await this.policyModel.findById(id);
    if (!policy) {
      throw new NotFoundException('Policy không tồn tại');
    }

    if (policy.isActive) {
      throw new BadRequestException('Không thể xóa policy đang active');
    }

    await policy.deleteOne();
    return { message: 'Đã xóa policy thành công' };
  }

  /**
   * Tính toán phân bổ vốn từ lợi nhuận thuần
   * 
   * CRITICAL FIX: Dùng safeAvailableFunds (cash-based), KHÔNG dùng totalNetProfit (accrual-based)
   * 
   * WHY:
   * ----
   * - totalNetProfit = Accrual accounting (tất cả orders, kể cả chưa nhận tiền)
   * - safeAvailableFunds = Cash accounting (dynamic weights + initial capital)
   * 
   * EXAMPLE:
   * --------
   * totalNetProfit = 100M (tất cả orders)
   * safeAvailableFunds = 84.5M (discounted + initial capital)
   * 
   * Nếu dùng totalNetProfit → Phân bổ 45M reinvestment
   * → Nhưng chỉ có 84.5M cash thực tế
   * → OVERSPENDING 15.5M!
   * 
   * Đúng: Dùng safeAvailableFunds → Phân bổ 38M reinvestment
   * → An toàn, không chi tiền chưa có
   * 
   * LOGIC MỚI (2024):
   * ==================
   * - conservative: Chỉ tính đơn đã thanh toán CẢ NCC VÀ Đại lý (realizedNetProfit)
   * - moderate: Hệ số chiết khấu theo trạng thái thanh toán (100%/70%/40%)
   * - aggressive: Ước tính + vay
   */
  async computeAllocation(policyId?: string, mode: 'conservative' | 'moderate' | 'aggressive' = 'conservative') {
    // 1. Lấy policy (dùng active nếu không chỉ định)
    const policy = policyId 
      ? await this.policyModel.findById(policyId)
      : await this.getActivePolicy();

    if (!policy) {
      throw new NotFoundException('Policy không tồn tại');
    }

    // 2. Lấy lợi nhuận thuần thực tế (CASH-BASED - realizedNetProfit)
    // ✅ Mặc định dùng conservative = chỉ tính đơn đã thanh toán cả 2 bên
    const fundsData = await this.financeService.computeRealAvailableFunds(mode);
    
    // ✅ FIX: Dùng safeAvailableFunds (= realizedNetProfit + initialCapital)
    const cashAvailable = fundsData.safeAvailableFunds;
    const totalNetProfit = fundsData.totalNetProfit;  // Giữ để reference

    // ===== ALLOCATION LOGIC (YÊU CẦU MỚI) =====
    // Vốn ban đầu = Vốn vay (loan)
    // Vốn tái đầu tư = 45% vốn ban đầu + 45% lợi nhuận thuần - chi phí ads
    // Dự phòng = 25% lợi nhuận thuần
    // Thu nhập = 20% lợi nhuận thuần
    // Tài sản dài hạn = 10% lợi nhuận thuần
    // 55% vốn ban đầu còn lại dành cho vận hành/phí đệm
    
    // Normalize cashFlow để tránh lỗi TypeScript với union types
    const cashFlow = (fundsData.cashFlow || {}) as any;
    const initialCapital = cashFlow.initialCapital ?? 0;
    const realizedProfit = cashFlow.realizedNetProfit ?? cashFlow.realizedProfit ?? totalNetProfit ?? 0;
    
    // Chi phí ads đã chi (lấy từ tổng chi ads trong đơn hàng realized)
    const totalAdsCost = cashFlow.totalAdsCost ?? 0;

    // Vốn tái đầu tư = 45% vốn vay + 45% lợi nhuận thuần - chi phí ads đã dùng
    const reinvestmentAmount = Math.round(0.45 * initialCapital + 0.45 * realizedProfit - totalAdsCost);
    const safetyReserveAmount = Math.round(0.25 * realizedProfit);
    const personalIncomeAmount = Math.round(0.20 * realizedProfit);
    const longTermAssetAmount = Math.round(0.10 * realizedProfit);

    // Ratios trả về để hiển thị (theo tổng cashAvailable để không phá schema cũ)
    const ratios = {
      reinvestmentRatio: cashAvailable > 0 ? (reinvestmentAmount / cashAvailable) * 100 : 0,
      safetyReserveRatio: cashAvailable > 0 ? (safetyReserveAmount / cashAvailable) * 100 : 0,
      personalIncomeRatio: cashAvailable > 0 ? (personalIncomeAmount / cashAvailable) * 100 : 0,
      longTermAssetRatio: cashAvailable > 0 ? (longTermAssetAmount / cashAvailable) * 100 : 0,
    };

    return {
      date: new Date(),
      policyName: policy.name,
      mode: fundsData.mode,
      
      // Cash available (actual money can allocate - based on realized profit)
      cashAvailable,
      
      // Total profit (for reference - includes pending)
      totalNetProfit,
      
      // Phân bổ (số tiền) - DỰA TRÊN CASH AVAILABLE (realized only)
      reinvestmentAmount,
      safetyReserveAmount,
      personalIncomeAmount,
      longTermAssetAmount,

      // Tỷ lệ (derived từ tổng cashAvailable để hiển thị; logic thực tế dùng công thức cố định)
      ratios,

      // Dòng tiền chi tiết (từ FinanceService)
      cashFlowDetail: fundsData.cashFlow,
      additionalInfo: fundsData.additionalInfo
    };
  }

  /**
   * Tạo snapshot phân bổ vốn
   */
  async captureSnapshot(note?: string, policyId?: string) {
    const allocation = await this.computeAllocation(policyId);

    const snapshot = new this.snapshotModel({
      date: new Date(),
      policyName: allocation.policyName,
      totalNetProfit: allocation.totalNetProfit,
      
      reinvestmentAmount: allocation.reinvestmentAmount,
      safetyReserveAmount: allocation.safetyReserveAmount,
      personalIncomeAmount: allocation.personalIncomeAmount,
      longTermAssetAmount: allocation.longTermAssetAmount,

      reinvestmentRatio: allocation.ratios.reinvestmentRatio,
      safetyReserveRatio: allocation.ratios.safetyReserveRatio,
      personalIncomeRatio: allocation.ratios.personalIncomeRatio,
      longTermAssetRatio: allocation.ratios.longTermAssetRatio,

      note,
      isAutoGenerated: !note
    });

    return snapshot.save();
  }

  /**
   * Cron job: Tự động chụp snapshot mỗi ngày 2:00 AM
   */
  @Cron('0 2 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async autoCaptureSnapshot() {
    try {
      // Kiểm tra xem hôm nay đã có snapshot chưa
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existing = await this.snapshotModel.findOne({
        date: { $gte: today, $lt: tomorrow },
        isAutoGenerated: true
      });

      if (existing) {
        this.logger.log('[capital-allocation] Snapshot hôm nay đã tồn tại, skip');
        return;
      }

      await this.captureSnapshot('auto-daily-2am');
      this.logger.log('[capital-allocation] ✅ Auto snapshot created at 02:00');
    } catch (err) {
      this.logger.error('[capital-allocation] Auto snapshot failed', err);
    }
  }

  /**
   * Lấy lịch sử snapshots
   */
  async getSnapshots(limit = 30) {
    return this.snapshotModel
      .find()
      .sort({ date: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Lấy snapshot mới nhất
   */
  async getLatestSnapshot() {
    return this.snapshotModel
      .findOne()
      .sort({ date: -1 })
      .exec();
  }

  /**
   * Update việc sử dụng vốn đã phân bổ
   * (Dùng khi apply budget vào ads, rút tiền cá nhân, v.v.)
   */
  async updateSnapshotUsage(snapshotId: string, updates: {
    reinvestmentUsed?: number;
    safetyReserveUsed?: number;
    personalIncomeWithdrawn?: number;
    longTermAssetInvested?: number;
  }) {
    const snapshot = await this.snapshotModel.findById(snapshotId);
    if (!snapshot) {
      throw new NotFoundException('Snapshot không tồn tại');
    }

    if (updates.reinvestmentUsed !== undefined) {
      snapshot.reinvestmentUsed += updates.reinvestmentUsed;
    }
    if (updates.safetyReserveUsed !== undefined) {
      snapshot.safetyReserveUsed += updates.safetyReserveUsed;
    }
    if (updates.personalIncomeWithdrawn !== undefined) {
      snapshot.personalIncomeWithdrawn += updates.personalIncomeWithdrawn;
    }
    if (updates.longTermAssetInvested !== undefined) {
      snapshot.longTermAssetInvested += updates.longTermAssetInvested;
    }

    return snapshot.save();
  }

  /**
   * Lấy vốn tái đầu tư khả dụng cho ads
   * 
   * CÔNG THỨC MỚI:
   * ==============
   * Vốn tái đầu tư khả dụng = Vốn tái đầu tư ban đầu + Vốn tái đầu tư được phân bổ - Chi phí ads
   * 
   * Trong đó:
  * - Vốn tái đầu tư ban đầu: Từ funding sources đang active
   * - Vốn tái đầu tư được phân bổ: Tổng reinvestmentAmount từ các snapshots
   * - Chi phí ads: Tổng reinvestmentUsed (đã chi cho quảng cáo)
   */
  async getAvailableReinvestmentBudget() {
    // 1. Lấy vốn tái đầu tư ban đầu từ funding sources
    const initialReinvestment = await this.getInitialReinvestmentCapital();

    // 2. Lấy tổng vốn được phân bổ và đã dùng từ snapshots
    const result = await this.snapshotModel.aggregate([
      {
        $group: {
          _id: null,
          totalAllocated: { $sum: '$reinvestmentAmount' },
          totalUsed: { $sum: '$reinvestmentUsed' }
        }
      }
    ]);

    const snapshotData = result?.[0] || { totalAllocated: 0, totalUsed: 0 };

    // 3. Tính vốn tái đầu tư khả dụng
    const available = initialReinvestment + snapshotData.totalAllocated - snapshotData.totalUsed;

    return {
      initialReinvestment,                          // Vốn tái đầu tư ban đầu
      totalAllocated: snapshotData.totalAllocated,  // Vốn được phân bổ (từ lợi nhuận)
      totalUsed: snapshotData.totalUsed,            // Chi phí ads đã dùng
      available: Math.max(0, available),            // Vốn tái đầu tư khả dụng
      formula: `${initialReinvestment.toLocaleString()} + ${snapshotData.totalAllocated.toLocaleString()} - ${snapshotData.totalUsed.toLocaleString()} = ${Math.max(0, available).toLocaleString()}`
    };
  }

  /**
   * Lấy vốn tái đầu tư ban đầu từ funding sources
   * Đây là vốn được cấp ban đầu dành riêng cho quảng cáo
   */
  private async getInitialReinvestmentCapital(): Promise<number> {
    try {
      // Lấy tất cả funding sources đang active (schema chưa có type riêng cho ads)
      const fundingSources = await this.financeService.getFundingSourcesForAds();
      return fundingSources.reduce((sum, source) => sum + (source.availableBalance || 0), 0);
    } catch (error) {
      this.logger.warn(`Không lấy được vốn tái đầu tư ban đầu: ${error.message}`);
      return 0;
    }
  }
}
