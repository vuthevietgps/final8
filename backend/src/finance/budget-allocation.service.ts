import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CapitalAllocationService } from './capital-allocation.service';
import { AdGroupProfitReportService } from '../ad-group-profit-report/ad-group-profit-report.service';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { BudgetApplyService } from '../advertising-optimization/ai-optimization/budget-apply.service';
import {
  canonicalAdsExecutionRequiredPayload,
  getAdsSafetyConfig,
} from '../common/ads-safety-config';
import { CashflowSafetyService } from './cashflow-safety.service';

export interface BudgetAllocationResult {
  totalAvailable: number;
  totalAllocated: number;
  suggestions?: string[];
  globalStatus?: string;
  recommendation?: string;
  globalAdjustmentRatio?: number;
  systemLocked?: boolean;
  allocations: Array<{
    adGroupId: string;
    adGroupName: string;
    currentBudget: number;
    action?: 'SCALE_UP' | 'SCALE_DOWN' | 'MAINTAIN';
    suggestedBudget: number;
    allocatedBudget: number;
    roi: number;
    profit: number;
    applied: boolean;
    reason?: string;
    baselineBudget?: number;
    scaleCapped?: boolean;  // NEW: Đánh dấu nếu scale bị giới hạn 20%
    scalePercentage?: number;  // NEW: % tăng thực tế
  }>;
  summary: {
    successCount: number;
    failedCount: number;
    skippedCount: number;
  };
  horizontalScaling?: {  // NEW: Đề xuất horizontal scaling
    action?: 'CLONE_AD_GROUP';
    excessBudget: number;
    canCreateNewGroups: boolean;
    suggestedNewGroups: number;
    strategyHint?: string;
    message: string;
  };
}

@Injectable()
export class BudgetAllocationService {
  private readonly logger = new Logger(BudgetAllocationService.name);

  constructor(
    private readonly capitalAllocationService: CapitalAllocationService,
    private readonly adGroupProfitService: AdGroupProfitReportService,
    private readonly budgetApplyService: BudgetApplyService,
    private readonly cashflowSafetyService: CashflowSafetyService,
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
  ) {}

  /**
   * Tự động phân bổ nguồn vốn khả dụng vào ad groups
   * 
   * LOGIC MỚI (2024):
   * ==================
   * Sử dụng computeRealAvailableFunds với 3 mode:
   * - conservative: Chỉ tính đơn đã thanh toán CẢ NCC VÀ Đại lý (realizedNetProfit) - RECOMMENDED
   * - moderate: Hệ số chiết khấu theo trạng thái thanh toán
   * - aggressive: Ước tính + vay
   */
  async autoAllocateBudget(params?: {
    dryRun?: boolean;      // Chỉ tính toán, không apply
    minBudget?: number;    // Ngân sách tối thiểu mỗi ad group
    maxBudget?: number;    // Ngân sách tối đa mỗi ad group
    priorityMode?: 'roi' | 'profit' | 'equal'; // Ưu tiên phân bổ
    fundMode?: 'conservative' | 'moderate' | 'aggressive'; // Chế độ tính vốn
  }): Promise<BudgetAllocationResult> {
    const dryRun = params?.dryRun ?? getAdsSafetyConfig().dryRun;

    // This service is a recommendation/preview engine only. Provider mutations
    // must use the canonical V2 plan so validateOnly, per-action approval,
    // idempotency and the execution audit log cannot be bypassed.
    if (!dryRun) {
      throw new ForbiddenException(canonicalAdsExecutionRequiredPayload());
    }

    const minBudget = params?.minBudget ?? 50000; // 50k VND
    const maxBudget = params?.maxBudget ?? 10000000; // 10M VND
    const priorityMode = params?.priorityMode ?? 'roi';
    const fundMode = params?.fundMode ?? 'conservative'; // Mặc định dùng conservative

    const health = await this.cashflowSafetyService.getCashflowHealthDashboard();
    if ((health.csi ?? health.CSI) < 0.7) {
      return this.buildCriticalCashShortagePlan(dryRun);
    }

    // 1. Lấy vốn tái đầu tư lũy kế còn lại: Tổng tái đầu tư - đã dùng
    const reinvestment = await this.capitalAllocationService.getAvailableReinvestmentBudget();
    const totalAvailable = reinvestment.available;

    if (totalAvailable <= 0) {
      this.logger.warn('Không có vốn khả dụng để phân bổ');
      return {
        totalAvailable,
        totalAllocated: 0,
        allocations: [],
        summary: { successCount: 0, failedCount: 0, skippedCount: 0 }
      };
    }

    // 2. Lấy optimal spend suggestions
    const optimalSpends = await this.adGroupProfitService.getOptimalSpendSuggestions();

    if (optimalSpends.length === 0) {
      this.logger.warn('Không có ad group nào để phân bổ ngân sách');
      return {
        totalAvailable,
        totalAllocated: 0,
        allocations: [],
        summary: { successCount: 0, failedCount: 0, skippedCount: 0 }
      };
    }

    // 3. Lọc ad groups có ROI dương và profit > 0
    const validSpends = optimalSpends.filter(s => {
      const roi = s.lastProfit / Math.max(1, s.lastSpend);
      return roi > 0 && s.lastProfit > 0;
    });

    if (validSpends.length === 0) {
      this.logger.warn('Không có ad group nào có ROI dương');
      return {
        totalAvailable,
        totalAllocated: 0,
        allocations: [],
        summary: { successCount: 0, failedCount: 0, skippedCount: 0 }
      };
    }

    // 4. Tính trọng số dựa trên priority mode
    const weighted = validSpends.map(s => {
      const roi = s.lastProfit / Math.max(1, s.lastSpend);
      let weight = 1;
      
      switch (priorityMode) {
        case 'roi':
          weight = roi;
          break;
        case 'profit':
          weight = s.lastProfit;
          break;
        case 'equal':
          weight = 1;
          break;
      }

      return { ...s, roi, weight };
    });

    // 5. Tính tổng optimal spend
    const totalOptimal = weighted.reduce((sum, s) => sum + s.appliedSpend, 0);

    const adGroupConfigs = await this.adGroupModel
      .find({ adGroupId: { $in: weighted.map(item => item.adGroupId) } })
      .select('adGroupId dailyBudget preferHorizontalScaling')
      .lean();
    const adGroupConfigMap = new Map(
      adGroupConfigs.map((item: any) => [String(item.adGroupId), item]),
    );

    // 6. Tính budget allocation với giới hạn 20% increase
    let totalAllocated = 0;
    const MAX_SAFE_INCREASE = 0.20;  // 20% max để tránh reset machine learning
    
    const allocations = weighted.map(item => {
      let allocatedBudget = 0;
      const adGroupConfig = adGroupConfigMap.get(item.adGroupId);
      const configuredDailyBudget = Number(adGroupConfig?.dailyBudget || 0);
      const baselineBudget = configuredDailyBudget > 0 ? configuredDailyBudget : item.lastSpend;

      if (totalOptimal <= totalAvailable) {
        // Đủ vốn: dùng applied spend
        allocatedBudget = item.appliedSpend;
      } else {
        // Thiếu vốn: scale down theo trọng số
        const totalWeight = weighted.reduce((sum, s) => sum + s.weight, 0);
        const ratio = item.weight / totalWeight;
        allocatedBudget = Math.round(totalAvailable * ratio);
      }

      // Apply min/max constraints
      allocatedBudget = Math.max(minBudget, Math.min(maxBudget, allocatedBudget));
      
      // **GIỚI HẠN 20% INCREASE** để tránh reset machine learning
      const maxAllowedBudget = baselineBudget > 0
        ? baselineBudget * (1 + MAX_SAFE_INCREASE)
        : allocatedBudget;
      const scaleCapped = baselineBudget > 0 && allocatedBudget > maxAllowedBudget;
      
      if (scaleCapped) {
        allocatedBudget = Math.round(maxAllowedBudget);
      }
      
      const scalePercentage = baselineBudget > 0
        ? ((allocatedBudget - baselineBudget) / baselineBudget) * 100
        : 0;
      const action: 'SCALE_UP' | 'SCALE_DOWN' | 'MAINTAIN' = allocatedBudget > baselineBudget
        ? 'SCALE_UP'
        : allocatedBudget < baselineBudget
          ? 'SCALE_DOWN'
          : 'MAINTAIN';
      
      totalAllocated += allocatedBudget;

      return {
        adGroupId: item.adGroupId,
        adGroupName: item.adGroupName,
        currentBudget: baselineBudget,
        action,
        suggestedBudget: item.appliedSpend,
        allocatedBudget,
        roi: item.roi,
        profit: item.lastProfit,
        applied: false,
        baselineBudget,
        reason: scaleCapped ? `Capped at +20% (${item.lastSpend.toLocaleString()} → ${allocatedBudget.toLocaleString()})` : undefined,
        scaleCapped,
        scalePercentage: Math.round(scalePercentage * 10) / 10  // Round to 1 decimal
      };
    });

    // 7. Kiểm tra xem còn dư ngân sách sau khi đã cap 20% chưa
    const excessBudget = totalAvailable - totalAllocated;
    const horizontalScaling = this.calculateHorizontalScaling(excessBudget, allocations);
    const suggestions = horizontalScaling?.canCreateNewGroups
      ? ['CLONE_AD_GROUP', horizontalScaling.strategyHint || 'Expand with Lookalike Audience']
      : [];

    // 8. Apply budget nếu không phải dry run
    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    if (!dryRun) {
      for (const allocation of allocations) {
        try {
          const { adGroup, adAccount } = await this.budgetApplyService.resolveContext(allocation.adGroupId);
          
          if (!adGroup) {
            allocation.reason = 'Ad group không tồn tại';
            skippedCount++;
            continue;
          }

          const success = await this.budgetApplyService.applyBudgetToProvider(
            adGroup,
            adAccount,
            allocation.allocatedBudget
          );

          if (success) {
            allocation.applied = true;
            successCount++;
            this.logger.log(`✅ Phân bổ ${allocation.allocatedBudget.toLocaleString()} VND cho ${allocation.adGroupName} (+${allocation.scalePercentage}%)`);
          } else {
            allocation.reason = 'Không thể apply lên platform';
            failedCount++;
          }
        } catch (err) {
          allocation.reason = err.message || 'Lỗi không xác định';
          failedCount++;
          this.logger.error(`❌ Lỗi phân bổ cho ${allocation.adGroupName}:`, err);
        }
      }
    } else {
      // Dry run: mark all as applied for preview
      allocations.forEach(a => { a.applied = true; });
      successCount = allocations.length;
    }

    return {
      totalAvailable,
      totalAllocated,
      globalStatus: 'NORMAL',
      recommendation: 'Phân bổ theo hiệu suất ROI hiện tại',
      globalAdjustmentRatio: 1,
      systemLocked: false,
      suggestions,
      allocations,
      summary: { successCount, failedCount, skippedCount },
      horizontalScaling
    };
  }

  private async buildCriticalCashShortagePlan(dryRun: boolean): Promise<BudgetAllocationResult> {
    const reinvestment = await this.capitalAllocationService.getAvailableReinvestmentBudget();
    const adGroups = await this.adGroupModel
      .find({ isActive: { $ne: false } })
      .select('adGroupId name dailyBudget')
      .lean();

    const allocations = adGroups.map((adGroup: any) => {
      const currentBudget = Number(adGroup.dailyBudget || 0);
      const allocatedBudget = Math.max(0, Math.round(currentBudget * 0.5));

      return {
        adGroupId: String(adGroup.adGroupId),
        adGroupName: String(adGroup.name || adGroup.adGroupId),
        currentBudget,
        action: currentBudget > 0 ? 'SCALE_DOWN' as const : 'MAINTAIN' as const,
        suggestedBudget: allocatedBudget,
        allocatedBudget,
        roi: 0,
        profit: 0,
        applied: dryRun,
        reason: 'Critical cash shortage lock: forced 50% system-wide reduction',
      };
    });

    const totalAllocated = allocations.reduce((sum, item) => sum + item.allocatedBudget, 0);

    return {
      totalAvailable: reinvestment.available,
      totalAllocated,
      globalStatus: 'CRITICAL_CASH_SHORTAGE',
      recommendation: 'Dừng mọi chiến dịch Scale, Giảm 50% toàn bộ hệ thống',
      globalAdjustmentRatio: 0.5,
      systemLocked: true,
      suggestions: ['STOP_ALL_SCALING', 'CUT_50_PERCENT_SYSTEM_WIDE'],
      allocations,
      summary: {
        successCount: allocations.length,
        failedCount: 0,
        skippedCount: 0,
      },
    };
  }

  /**
   * Tính toán horizontal scaling suggestion
   */
  private calculateHorizontalScaling(
    excessBudget: number,
    allocations: Array<{ adGroupName: string; roi: number; allocatedBudget: number; scaleCapped?: boolean }>
  ) {
    const MIN_BUDGET_FOR_NEW_GROUP = 500_000;  // 500k VND minimum
    
    if (excessBudget < MIN_BUDGET_FOR_NEW_GROUP) {
      return undefined;
    }

    // ROI ở đây là ratio (2.0 = 200%), không phải percent integer.
    const highPerformers = allocations.filter(a => a.roi >= 2 && a.scaleCapped);
    
    if (highPerformers.length === 0) {
      return undefined;
    }

    const suggestedNewGroups = Math.floor(excessBudget / MIN_BUDGET_FOR_NEW_GROUP);
    const topPerformer = highPerformers.sort((a, b) => b.roi - a.roi)[0];

    return {
      action: 'CLONE_AD_GROUP' as const,
      excessBudget,
      canCreateNewGroups: true,
      suggestedNewGroups: Math.min(suggestedNewGroups, 5),  // Max 5 groups
      strategyHint: 'Expand with Lookalike Audience',
      message: `Còn dư ${(excessBudget / 1_000_000).toFixed(1)}M VND. Nên tạo ${Math.min(suggestedNewGroups, 5)} nhóm quảng cáo tương tự "${topPerformer.adGroupName}" (ROI ${(topPerformer.roi * 100).toFixed(0)}%) thay vì tăng ngân sách quá 20%.`
    };
  }

  /**
   * Lấy trạng thái hiện tại của budget allocation
   * Sử dụng vốn tái đầu tư lũy kế (reinvestment) thay vì vốn khả dụng cash
   * 
   * LOGIC:
   * - availableFunds = Tổng vốn tái đầu tư lũy kế - đã sử dụng (reinvestmentAmount - reinvestmentUsed)
   * - totalSuggestedSpend = Tổng đề xuất chi cho các nhóm quảng cáo trong ngày
   * - canAfford = So sánh vốn tái đầu tư còn lại với tổng đề xuất chi
   */
  async getAllocationStatus(fundMode: 'conservative' | 'moderate' | 'aggressive' = 'conservative') {
    const reinvestment = await this.capitalAllocationService.getAvailableReinvestmentBudget();
    const optimalSpends = await this.adGroupProfitService.getOptimalSpendSuggestions();

    // Tổng đề xuất chi trong ngày = tổng appliedSpend của các ad groups
    const totalSuggested = optimalSpends.reduce((sum, s) => sum + s.appliedSpend, 0);
    const canAfford = reinvestment.available >= totalSuggested;

    // Lấy snapshot gần nhất để có thông tin chi tiết hơn
    const latestSnapshot = await this.capitalAllocationService.getLatestSnapshot();
    
    return {
      // ===== THÔNG TIN CHÍNH =====
      availableFunds: reinvestment.available,      // Vốn tái đầu tư khả dụng
      totalSuggestedSpend: totalSuggested,         // Tổng đề xuất chi trong ngày
      canAfford,
      deficit: canAfford ? 0 : totalSuggested - reinvestment.available,
      adGroupCount: optimalSpends.length,
      mode: 'reinvestment-available',
      
      // ===== BREAKDOWN VỐN TÁI ĐẦU TƯ =====
      reinvestmentBreakdown: {
        initialReinvestment: reinvestment.initialReinvestment,  // Vốn tái đầu tư ban đầu
        allocatedFromProfit: reinvestment.totalAllocated,       // Vốn phân bổ từ lợi nhuận
        adsCostSpent: reinvestment.totalUsed,                   // Chi phí ads đã dùng
        available: reinvestment.available,                       // Vốn tái đầu tư khả dụng
        formula: reinvestment.formula                            // Công thức tính
      },
      
      // ===== DỮ LIỆU NGÀY HÔM QUA =====
      yesterday: latestSnapshot ? {
        totalSuggestedSpend: 0, // TODO: Cần lưu lịch sử nếu muốn
        availableFunds: latestSnapshot.reinvestmentAmount - latestSnapshot.reinvestmentUsed,
        canAfford: true
      } : undefined,
      
      // ===== DỮ LIỆU LŨY KẾ =====
      cumulative: {
        totalAllocated: reinvestment.totalAllocated,
        totalSpent: reinvestment.totalUsed,
        totalRevenue: 0,
        totalProfit: 0
      },
      
      // ===== BREAKDOWN CHI TIẾT =====
      breakdown: {
        initialReinvestment: reinvestment.initialReinvestment,
        reinvestmentFromProfit: reinvestment.totalAllocated,
        adsCostUsed: reinvestment.totalUsed,
        reinvestmentAvailable: reinvestment.available,
        todaySnapshot: latestSnapshot ? {
          date: latestSnapshot.date,
          reinvestmentAmount: latestSnapshot.reinvestmentAmount,
          reinvestmentUsed: latestSnapshot.reinvestmentUsed,
          policyName: latestSnapshot.policyName
        } : null
      },
      
      // ===== THÔNG TIN BỔ SUNG =====
      additionalInfo: {
        note: 'Vốn tái đầu tư khả dụng = Vốn ban đầu + Vốn phân bổ từ lợi nhuận - Chi phí ads',
        fundMode: fundMode,
        calculation: reinvestment.formula
      }
    };
  }
}
