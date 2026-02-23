/**
 * File: cashflow-control/dto/fund-status.dto.ts
 * Purpose: DTO for individual fund status and the funds list
 * 
 * The 4 Virtual Funds Model:
 * 1. Committed Cash - Money we owe (not spendable)
 * 2. Ads Fund - Reserved for marketing
 * 3. Survival Buffer - Emergency reserve (DON'T TOUCH)
 * 4. Owner Fund - Withdrawable profit
 */

import { FundType, FundStatus } from '../interfaces/cashflow.interfaces';

export class FundStatusDto {
  /** Type of fund */
  fundType: FundType;

  /** Display name for the fund */
  displayName: string;

  /** Short description of fund purpose */
  description: string;

  /** Current balance in VND */
  currentBalance: number;

  /** Change from yesterday (positive = inflow) */
  yesterdayChange: number;

  /** Projected balance in 7 days based on current trends */
  projection7d: number;

  /** Minimum threshold - below this triggers warning */
  threshold: number;

  /** Current status based on balance vs threshold */
  status: FundStatus;

  /** Usage rules for this fund */
  usageRules: string[];

  /** Icon identifier for UI */
  icon: string;
}

export class FundsListResponseDto {
  /** List of all fund statuses */
  funds: FundStatusDto[];

  /** Total balance across all funds */
  totalBalance: number;

  /** Number of funds in warning/danger status */
  fundsAtRisk: number;

  /** Timestamp of data */
  asOf: Date;
}
