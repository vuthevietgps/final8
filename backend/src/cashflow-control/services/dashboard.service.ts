/**
 * File: cashflow-control/services/dashboard.service.ts
 * Purpose: Business logic for the main dashboard summary
 * 
 * CORE CONCEPT: Cash Clarity
 * - BankBalance: Total cash in accounts (what we SEE)
 * - CommittedCash: Already allocated to obligations (SPOKEN FOR)
 * - FreeCash: Actually spendable (BankBalance - CommittedCash)
 * 
 * The key insight: Having 1 billion in the bank means NOTHING
 * if 900 million is already committed to suppliers, salaries, etc.
 */

import { Injectable } from '@nestjs/common';
import { DashboardSummaryDto } from '../dto/dashboard-summary.dto';
import { IBankAccount, ICommitment } from '../interfaces/cashflow.interfaces';

@Injectable()
export class DashboardService {
  
  /**
   * Get the main dashboard summary
   * This is the "one glance" view for Owner/CFO
   */
  getSummary(): DashboardSummaryDto {
    // In production, these would come from database queries
    const bankAccounts = this.getBankAccounts();
    const commitments = this.getCommitments();
    const adsFundBalance = this.getAdsFundBalance();

    // Calculate totals
    const bankBalance = this.calculateTotalBankBalance(bankAccounts);
    const committedCash = this.calculateTotalCommitments(commitments);
    
    // CORE FORMULA: FreeCash = BankBalance - CommittedCash
    const freeCash = bankBalance - committedCash;
    
    // Calculate safety index
    const cashflowSafetyIndex = this.calculateSafetyIndex(freeCash, bankBalance);

    return {
      bankBalance,
      committedCash,
      freeCash,
      adsFundBalance,
      cashflowSafetyIndex,
      asOf: new Date(),
      formulas: {
        freeCash: 'BankBalance - CommittedCash',
        safetyIndex: 'FreeCash / BankBalance (normalized, considers burn rate)',
      },
    };
  }

  /**
   * Calculate total bank balance across all accounts
   */
  private calculateTotalBankBalance(accounts: IBankAccount[]): number {
    return accounts.reduce((sum, account) => sum + account.balance, 0);
  }

  /**
   * Calculate total committed cash (pending obligations)
   * 
   * Committed cash includes:
   * - Pending supplier payments
   * - Upcoming salary payments
   * - Scheduled operational expenses
   * - Ads prepayments
   */
  private calculateTotalCommitments(commitments: ICommitment[]): number {
    return commitments.reduce((sum, c) => sum + c.amount, 0);
  }

  /**
   * Calculate Cashflow Safety Index (CSI)
   * 
   * CSI = FreeCash / (MonthlyBurnRate)
   * Normalized to 0-1 range where:
   * - 1.0 = 3+ months of runway
   * - 0.6 = 2 months (safe)
   * - 0.3 = 1 month (warning)
   * - 0.0 = no runway (danger)
   */
  private calculateSafetyIndex(freeCash: number, bankBalance: number): number {
    if (bankBalance <= 0) return 0;
    
    // Estimate monthly burn rate (in production, use actual historical data)
    const estimatedMonthlyBurn = 500000000; // 500M VND example
    
    // Calculate months of runway
    const monthsRunway = freeCash / estimatedMonthlyBurn;
    
    // Normalize to 0-1 (3 months = 1.0)
    const normalized = Math.min(monthsRunway / 3, 1);
    
    return Math.max(0, Math.round(normalized * 100) / 100);
  }

  /**
   * Get current Ads Fund balance
   */
  private getAdsFundBalance(): number {
    // Mock data - in production, query from fund allocations
    return 180000000; // 180M VND
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOCK DATA (Replace with database queries in production)
  // ═══════════════════════════════════════════════════════════════════════════

  private getBankAccounts(): IBankAccount[] {
    return [
      {
        accountId: 'vcb-001',
        accountName: 'Vietcombank - Main',
        balance: 650000000,
        lastUpdated: new Date(),
      },
      {
        accountId: 'tcb-001',
        accountName: 'Techcombank - Operations',
        balance: 200000000,
        lastUpdated: new Date(),
      },
    ];
  }

  private getCommitments(): ICommitment[] {
    return [
      {
        id: 'c-001',
        description: 'Supplier A - January batch',
        amount: 150000000,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        category: 'supplier',
      },
      {
        id: 'c-002',
        description: 'February Salaries',
        amount: 120000000,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        category: 'labor',
      },
      {
        id: 'c-003',
        description: 'Facebook Ads Prepayment',
        amount: 50000000,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        category: 'ads',
      },
    ];
  }
}
