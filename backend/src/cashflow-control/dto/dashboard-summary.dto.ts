/**
 * File: cashflow-control/dto/dashboard-summary.dto.ts
 * Purpose: DTO for the main dashboard summary endpoint
 * 
 * This is the "ONE GLANCE" view for Owner/CFO to answer:
 * - How much cash do we have?
 * - How much is actually spendable?
 * - Are we safe?
 */

export class DashboardSummaryDto {
  /** Total cash across all bank accounts */
  bankBalance: number;

  /** Cash allocated to pending obligations (supplier payments, salaries, etc.) */
  committedCash: number;

  /** Actually spendable cash: BankBalance - CommittedCash */
  freeCash: number;

  /** Current balance reserved for advertising */
  adsFundBalance: number;

  /** Cashflow safety index (0-1). Higher = safer. Below 0.3 = danger */
  cashflowSafetyIndex: number;

  /** Timestamp when this data was computed */
  asOf: Date;

  /** Human-readable formulas for transparency */
  formulas: {
    freeCash: string;
    safetyIndex: string;
  };
}
