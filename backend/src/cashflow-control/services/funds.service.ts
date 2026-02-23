/**
 * File: cashflow-control/services/funds.service.ts
 * Purpose: Business logic for the 4 Virtual Funds system
 * 
 * THE 4 FUNDS MODEL:
 * 
 * 1. COMMITTED_CASH: Money we OWE - not spendable
 *    - Supplier payments pending
 *    - Salaries due
 *    - Scheduled expenses
 * 
 * 2. ADS_FUND: Reserved for marketing
 *    - Only used for advertising
 *    - Replenished from profit allocation
 *    - Daily spend limits apply
 * 
 * 3. SURVIVAL_BUFFER: Emergency reserve
 *    - NEVER touch unless survival at stake
 *    - Typically 2-3 months of fixed costs
 *    - Touching this triggers CRITICAL alert
 * 
 * 4. OWNER_FUND: Withdrawable profit
 *    - Owner can withdraw anytime
 *    - Accumulated from profit allocation
 *    - No operational dependency
 */

import { Injectable } from '@nestjs/common';
import { FundsListResponseDto, FundStatusDto } from '../dto/fund-status.dto';
import { FundType, FundStatus } from '../interfaces/cashflow.interfaces';

@Injectable()
export class FundsService {

  /**
   * Get status of all 4 funds
   */
  getFundsStatus(): FundsListResponseDto {
    const funds = this.calculateAllFunds();
    
    const fundsAtRisk = funds.filter(
      f => f.status === FundStatus.WARNING || f.status === FundStatus.DANGER
    ).length;

    const totalBalance = funds.reduce((sum, f) => sum + f.currentBalance, 0);

    return {
      funds,
      totalBalance,
      fundsAtRisk,
      asOf: new Date(),
    };
  }

  /**
   * Calculate status for all 4 funds
   */
  private calculateAllFunds(): FundStatusDto[] {
    return [
      this.calculateCommittedCashFund(),
      this.calculateAdsFund(),
      this.calculateSurvivalBufferFund(),
      this.calculateOwnerFund(),
    ];
  }

  /**
   * COMMITTED CASH FUND
   * This is NOT spendable - it's money we already owe
   * 
   * Status logic:
   * - SAFE: Commitments < 50% of bank balance
   * - WARNING: Commitments 50-70% of bank balance  
   * - DANGER: Commitments > 70% of bank balance
   */
  private calculateCommittedCashFund(): FundStatusDto {
    const currentBalance = 320000000; // 320M committed
    const threshold = 400000000; // Alert if > 400M
    const yesterdayBalance = 310000000;
    
    // Project based on upcoming commitments
    const projection7d = 380000000;
    
    const status = this.calculateStatus(currentBalance, threshold, true);

    return {
      fundType: FundType.COMMITTED_CASH,
      displayName: 'Committed Cash',
      description: 'Allocated to pending obligations - NOT spendable',
      currentBalance,
      yesterdayChange: currentBalance - yesterdayBalance,
      projection7d,
      threshold,
      status,
      usageRules: [
        'Automatically allocated from pending payables',
        'Released when payments are made',
        'Cannot be manually adjusted',
      ],
      icon: '📌',
    };
  }

  /**
   * ADS FUND
   * Reserved specifically for advertising spend
   * 
   * Status logic:
   * - SAFE: Balance > 7 days of ads spend
   * - WARNING: Balance 3-7 days of ads spend
   * - DANGER: Balance < 3 days of ads spend
   */
  private calculateAdsFund(): FundStatusDto {
    const currentBalance = 180000000; // 180M
    const threshold = 100000000; // Min 100M (about 4 days at 25M/day)
    const yesterdayBalance = 195000000;
    
    // Project based on daily burn and expected replenishment
    const dailyBurn = 22000000;
    const expectedReplenishment = 100000000; // Weekly from profit
    const projection7d = currentBalance - (dailyBurn * 7) + expectedReplenishment;
    
    const status = this.calculateStatus(currentBalance, threshold);

    return {
      fundType: FundType.ADS_FUND,
      displayName: 'Ads Fund',
      description: 'Reserved for advertising - replenished from profits',
      currentBalance,
      yesterdayChange: currentBalance - yesterdayBalance,
      projection7d,
      threshold,
      status,
      usageRules: [
        'Only for advertising platforms (Facebook, Google, TikTok)',
        'Daily limit: 25M unless approved by CFO',
        'Replenished weekly from profit allocation (40%)',
      ],
      icon: '📢',
    };
  }

  /**
   * SURVIVAL BUFFER
   * Emergency reserve - NEVER touch under normal operations
   * 
   * Status logic:
   * - SAFE: Buffer = target (2-3 months fixed costs)
   * - WARNING: Buffer < target but > 1 month
   * - DANGER: Buffer < 1 month of fixed costs
   */
  private calculateSurvivalBufferFund(): FundStatusDto {
    const currentBalance = 200000000; // 200M
    const threshold = 150000000; // Min 150M (about 1 month operations)
    const yesterdayBalance = 200000000; // Should be stable
    
    // Survival buffer should stay constant
    const projection7d = currentBalance;
    
    const status = this.calculateStatus(currentBalance, threshold);

    return {
      fundType: FundType.SURVIVAL_BUFFER,
      displayName: 'Survival Buffer',
      description: 'Emergency reserve - DO NOT TOUCH',
      currentBalance,
      yesterdayChange: currentBalance - yesterdayBalance,
      projection7d,
      threshold,
      status,
      usageRules: [
        '⚠️ NEVER use for normal operations',
        'Only for business survival emergencies',
        'Touching this triggers CRITICAL alert to owner',
        'Target: 2-3 months of fixed costs',
      ],
      icon: '🛡️',
    };
  }

  /**
   * OWNER FUND
   * Withdrawable profit accumulated from profit allocation
   * 
   * Status is always SAFE - owner can withdraw anytime
   */
  private calculateOwnerFund(): FundStatusDto {
    const currentBalance = 150000000; // 150M
    const threshold = 0; // No minimum required
    const yesterdayBalance = 145000000;
    
    // Project based on expected profit allocation
    const weeklyProfitShare = 30000000; // 30M/week (30% of ~100M profit)
    const projection7d = currentBalance + weeklyProfitShare;
    
    return {
      fundType: FundType.OWNER_FUND,
      displayName: 'Owner Fund',
      description: 'Withdrawable profit - available anytime',
      currentBalance,
      yesterdayChange: currentBalance - yesterdayBalance,
      projection7d,
      threshold,
      status: FundStatus.SAFE, // Always safe for owner
      usageRules: [
        'Can be withdrawn anytime by owner',
        'Replenished from profit allocation (30%)',
        'No operational dependency',
      ],
      icon: '👤',
    };
  }

  /**
   * Calculate fund status based on current balance vs threshold
   * 
   * @param current Current balance
   * @param threshold Minimum threshold
   * @param inverse If true, higher balance = worse (for committed cash)
   */
  private calculateStatus(
    current: number,
    threshold: number,
    inverse: boolean = false
  ): FundStatus {
    if (inverse) {
      // For committed cash: higher = worse
      if (current > threshold * 1.2) return FundStatus.DANGER;
      if (current > threshold) return FundStatus.WARNING;
      return FundStatus.SAFE;
    }
    
    // For other funds: lower = worse
    if (current < threshold * 0.5) return FundStatus.DANGER;
    if (current < threshold) return FundStatus.WARNING;
    return FundStatus.SAFE;
  }
}
