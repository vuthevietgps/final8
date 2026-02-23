import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CapitalAllocationService } from './capital-allocation.service';
import { AdGroupProfitReportService } from '../ad-group-profit-report/ad-group-profit-report.service';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { BudgetApplyService } from '../advertising-optimization/ai-optimization/budget-apply.service';

export interface BudgetAllocationResult {
  totalAvailable: number;
  totalAllocated: number;
  allocations: Array<{
    adGroupId: string;
    adGroupName: string;
    currentBudget: number;
    suggestedBudget: number;
    allocatedBudget: number;
    roi: number;
    profit: number;
    applied: boolean;
    reason?: string;
    scaleCapped?: boolean;  // NEW: Đánh dấu nếu scale bị giới hạn 20%
    scalePercentage?: number;  // NEW: % tăng thực tế
  }>;
  summary: {
    successCount: number;
    failedCount: number;
    skippedCount: number;
  };
  horizontalScaling?: {  // NEW: Đề xuất horizontal scaling
    excessBudget: number;
    canCreateNewGroups: boolean;
    suggestedNewGroups: number;
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
    const dryRun = params?.dryRun ?? false;
    const minBudget = params?.minBudget ?? 50000; // 50k VND
    const maxBudget = params?.maxBudget ?? 10000000; // 10M VND
    const priorityMode = params?.priorityMode ?? 'roi';
    const fundMode = params?.fundMode ?? 'conservative'; // Mặc định dùng conservative

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

    // 6. Tính budget allocation với giới hạn 20% increase
    let totalAllocated = 0;
    const MAX_SAFE_INCREASE = 0.20;  // 20% max để tránh reset machine learning
    
    const allocations = weighted.map(item => {
      let allocatedBudget = 0;

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
      const maxAllowedBudget = item.lastSpend * (1 + MAX_SAFE_INCREASE);
      const scaleCapped = allocatedBudget > maxAllowedBudget;
      
      if (scaleCapped) {
        allocatedBudget = Math.round(maxAllowedBudget);
      }
      
      const scalePercentage = ((allocatedBudget - item.lastSpend) / item.lastSpend) * 100;
      
      totalAllocated += allocatedBudget;

      return {
        adGroupId: item.adGroupId,
        adGroupName: item.adGroupName,
        currentBudget: item.lastSpend,
        suggestedBudget: item.appliedSpend,
        allocatedBudget,
        roi: item.roi,
        profit: item.lastProfit,
        applied: false,
        reason: scaleCapped ? `Capped at +20% (${item.lastSpend.toLocaleString()} → ${allocatedBudget.toLocaleString()})` : undefined,
        scaleCapped,
        scalePercentage: Math.round(scalePercentage * 10) / 10  // Round to 1 decimal
      };
    });

    // 7. Kiểm tra xem còn dư ngân sách sau khi đã cap 20% chưa
    const excessBudget = totalAvailable - totalAllocated;
    const horizontalScaling = this.calculateHorizontalScaling(excessBudget, allocations);

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
      allocations,
      summary: { successCount, failedCount, skippedCount },
      horizontalScaling
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

    // Tìm các ad groups có ROI cao và đã bị cap 20%
    const highPerformers = allocations.filter(a => a.roi >= 200 && a.scaleCapped);
    
    if (highPerformers.length === 0) {
      return undefined;
    }

    const suggestedNewGroups = Math.floor(excessBudget / MIN_BUDGET_FOR_NEW_GROUP);
    const topPerformer = highPerformers.sort((a, b) => b.roi - a.roi)[0];

    return {
      excessBudget,
      canCreateNewGroups: true,
      suggestedNewGroups: Math.min(suggestedNewGroups, 5),  // Max 5 groups
      message: `Còn dư ${(excessBudget / 1_000_000).toFixed(1)}M VND. Nên tạo ${Math.min(suggestedNewGroups, 5)} nhóm quảng cáo tương tự "${topPerformer.adGroupName}" (ROI ${topPerformer.roi.toFixed(0)}%) thay vì tăng ngân sách quá 20%.`
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
