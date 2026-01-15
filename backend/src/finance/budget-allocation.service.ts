import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FinanceService } from './finance.service';
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
  }>;
  summary: {
    successCount: number;
    failedCount: number;
    skippedCount: number;
  };
}

@Injectable()
export class BudgetAllocationService {
  private readonly logger = new Logger(BudgetAllocationService.name);

  constructor(
    private readonly financeService: FinanceService,
    private readonly adGroupProfitService: AdGroupProfitReportService,
    private readonly budgetApplyService: BudgetApplyService,
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
  ) {}

  /**
   * Tự động phân bổ nguồn vốn khả dụng vào ad groups
   */
  async autoAllocateBudget(params?: {
    dryRun?: boolean;      // Chỉ tính toán, không apply
    minBudget?: number;    // Ngân sách tối thiểu mỗi ad group
    maxBudget?: number;    // Ngân sách tối đa mỗi ad group
    priorityMode?: 'roi' | 'profit' | 'equal'; // Ưu tiên phân bổ
  }): Promise<BudgetAllocationResult> {
    const dryRun = params?.dryRun ?? false;
    const minBudget = params?.minBudget ?? 50000; // 50k VND
    const maxBudget = params?.maxBudget ?? 10000000; // 10M VND
    const priorityMode = params?.priorityMode ?? 'roi';

    // 1. Lấy vốn khả dụng
    const funds = await this.financeService.computeAvailableFunds();
    const totalAvailable = funds.available;

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

    // 6. Tính budget allocation
    let totalAllocated = 0;
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
        reason: undefined as string | undefined,
      };
    });

    // 7. Apply budget nếu không phải dry run
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
            this.logger.log(`✅ Phân bổ ${allocation.allocatedBudget.toLocaleString()} VND cho ${allocation.adGroupName}`);
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
      summary: { successCount, failedCount, skippedCount }
    };
  }

  /**
   * Lấy trạng thái hiện tại của budget allocation
   */
  async getAllocationStatus() {
    const funds = await this.financeService.computeAvailableFunds();
    const optimalSpends = await this.adGroupProfitService.getOptimalSpendSuggestions();

    const totalSuggested = optimalSpends.reduce((sum, s) => sum + s.appliedSpend, 0);
    const canAfford = funds.available >= totalSuggested;

    return {
      availableFunds: funds.available,
      totalSuggestedSpend: totalSuggested,
      canAfford,
      deficit: canAfford ? 0 : totalSuggested - funds.available,
      adGroupCount: optimalSpends.length,
      breakdown: {
        collectedRevenue: funds.collectedRevenue,
        loanAvailable: funds.loanAvailable,
        actualSpent: funds.actualSpent,
        reservedTotal: (funds.reservedPayroll || 0) + (funds.reservedInterest || 0) + 
                      (funds.reservedPayables || 0) + (funds.reservedSuppliers || 0) + 
                      (funds.reservedAgents || 0) + (funds.reservedOther || 0)
      }
    };
  }
}
