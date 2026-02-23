/**
 * LOAN MANAGEMENT SERVICE
 * =======================
 * Service cao cấp quản lý khoản vay với các tính năng:
 * - Dashboard 3 KPIs (Available to Disburse, Outstanding, Due Soon)
 * - Thanh toán từ Bank Balance hoặc Owner Fund
 * - Lựa chọn thanh toán Gốc/Lãi/Theo kỳ/Tất toán
 * - Gợi ý tối ưu hóa (trả gốc sớm để giảm lãi)
 */

import { Injectable, Logger, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LoanContract, LoanContractDocument } from './schemas/loan-contract.schema';
import { LoanRepayment, LoanRepaymentDocument } from './schemas/loan-repayment.schema';
import { LoanPayment, LoanPaymentDocument, LoanPaymentType, PaymentSource } from './schemas/loan-payment.schema';
import { CashflowEntry, CashflowEntryDocument } from './schemas/cashflow-entry.schema';
import { FinancialControlService } from './financial-control.service';
import { OwnerFundService } from '../owner-fund/owner-fund.service';
import {
  LoanDashboardDto,
  LoanDetailDto,
  LoanAlertDto,
  LoanOptimizationDto,
  LoanMetadataDto,
  PaymentOptionsDto,
  ScheduledPaymentOption,
  PaymentResultDto,
  CreateLoanPaymentDto,
} from './dto/loan-management.dto';

@Injectable()
export class LoanManagementService {
  private readonly logger = new Logger(LoanManagementService.name);

  constructor(
    @InjectModel(LoanContract.name)
    private readonly loanModel: Model<LoanContractDocument>,
    @InjectModel(LoanRepayment.name)
    private readonly repaymentModel: Model<LoanRepaymentDocument>,
    @InjectModel(LoanPayment.name)
    private readonly paymentModel: Model<LoanPaymentDocument>,
    @InjectModel(CashflowEntry.name)
    private readonly cashflowModel: Model<CashflowEntryDocument>,
    @Inject(forwardRef(() => FinancialControlService))
    private readonly financialControlService: FinancialControlService,
    @Inject(forwardRef(() => OwnerFundService))
    private readonly ownerFundService: OwnerFundService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  // DASHBOARD - 3 KPIs + Details
  // ═══════════════════════════════════════════════════════════

  async getDashboard(): Promise<LoanDashboardDto> {
    this.logger.log('Getting loan dashboard');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Lấy tất cả khoản vay active/draft
    const loans = await this.loanModel.find({
      status: { $in: ['active', 'draft'] },
    }).lean();

    // 2. Lấy tất cả repayments chưa trả
    const unpaidRepayments = await this.repaymentModel.find({
      paid: { $ne: true },
    }).lean();

    // 3. Tính các KPIs
    const availableToDisburse = this.calculateAvailableToDisburse(loans);
    const outstandingWithInterest = this.calculateOutstandingWithInterest(loans);
    const totalOutstanding = loans.reduce((sum, l) => sum + (l.principalRemaining || 0), 0);
    const monthlyInterestCost = this.calculateMonthlyInterestCost(loans);

    // 4. Tính nợ đến hạn theo window
    const due7Days = this.calculateDueInDays(loans, unpaidRepayments, 7);
    const due14Days = this.calculateDueInDays(loans, unpaidRepayments, 14);
    const due30Days = this.calculateDueInDays(loans, unpaidRepayments, 30);
    const overdueAmount = this.calculateOverdue(loans, unpaidRepayments);

    // 5. Build loan details
    const byLoan = await this.buildLoanDetails(loans, unpaidRepayments);

    // 6. Generate alerts
    const alerts = this.generateAlerts(loans, unpaidRepayments, byLoan);

    // 7. Get balances for metadata
    let bankBalance = 0;
    let freeCash = 0;
    let ownerFundBalance = 0;

    try {
      const fcDashboard = await this.financialControlService.getDashboard();
      bankBalance = fcDashboard.bankBalance || 0;
      freeCash = fcDashboard.freeCash || 0;
    } catch (err) {
      this.logger.warn('Failed to get Financial Control data');
    }

    try {
      const ownerSummary = await this.ownerFundService.getAccountsSummary();
      ownerFundBalance = ownerSummary.totalBalance || 0;
    } catch (err) {
      this.logger.warn('Failed to get Owner Fund data');
    }

    // 8. Build optimization suggestions
    const optimization = this.buildOptimization(loans, freeCash);

    // 9. Build metadata
    const metadata: LoanMetadataDto = {
      calculatedAt: new Date().toISOString(),
      bankBalance,
      freeCash,
      ownerFundBalance,
      canPayFromBank: freeCash > 0,
      canPayFromOwner: ownerFundBalance > 0,
    };

    return {
      availableToDisburse,
      outstandingWithInterest,
      totalOutstanding,
      monthlyInterestCost,
      due7Days,
      due14Days,
      due30Days,
      overdueAmount,
      byLoan,
      alerts,
      optimization,
      metadata,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // PAYMENT OPTIONS - Lấy các lựa chọn thanh toán
  // ═══════════════════════════════════════════════════════════

  async getPaymentOptions(loanId: string): Promise<PaymentOptionsDto> {
    this.logger.log(`Getting payment options for loan ${loanId}`);

    const loan = await this.loanModel.findById(loanId).lean();
    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    // Lấy các kỳ trả chưa thanh toán
    const unpaidRepayments = await this.repaymentModel.find({
      loanId: new Types.ObjectId(loanId),
      paid: { $ne: true },
    }).sort({ dueDate: 1 }).lean();

    const today = new Date();
    const monthlyInterest = this.calculateLoanMonthlyInterest(loan);

    // Build scheduled payment options
    const scheduledPayments: ScheduledPaymentOption[] = unpaidRepayments.map(r => {
      const dueDate = r.dueDate ? new Date(r.dueDate) : null;
      const isOverdue = dueDate ? dueDate < today : false;
      const daysPastDue = dueDate && isOverdue 
        ? Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        repaymentId: String(r._id),
        dueDate: dueDate?.toISOString().split('T')[0] || '',
        amountPrincipal: r.amountPrincipal || 0,
        amountInterest: r.amountInterest || 0,
        total: (r.amountPrincipal || 0) + (r.amountInterest || 0),
        isOverdue,
        daysPastDue,
      };
    });

    // Get balances
    let bankBalance = 0;
    let freeCash = 0;
    try {
      const fcDashboard = await this.financialControlService.getDashboard();
      bankBalance = fcDashboard.bankBalance || 0;
      freeCash = fcDashboard.freeCash || 0;
    } catch (err) {
      this.logger.warn('Failed to get Financial Control data');
    }

    let ownerAccounts: { id: string; name: string; balance: number }[] = [];
    let ownerTotalBalance = 0;
    try {
      const accounts = await this.ownerFundService.listFundAccounts();
      ownerAccounts = accounts.map(a => ({
        id: String(a._id),
        name: a.name,
        balance: a.balance || 0,
      }));
      ownerTotalBalance = ownerAccounts.reduce((sum, a) => sum + a.balance, 0);
    } catch (err) {
      this.logger.warn('Failed to get Owner Fund accounts');
    }

    // Calculate payoff amount
    const accruedInterest = monthlyInterest; // Simplified - could be prorated
    const totalPayoff = (loan.principalRemaining || 0) + accruedInterest;

    return {
      loan: {
        _id: String(loan._id),
        name: loan.name,
        lenderName: loan.lenderName,
        principal: loan.principal,
        principalRemaining: loan.principalRemaining || 0,
        interestRate: loan.interestRate || 0,
        monthlyInterest,
      },
      options: {
        scheduledPayments,
        principalPayment: {
          minAmount: 0,
          maxAmount: loan.principalRemaining || 0,
          suggestedAmount: Math.min(freeCash * 0.5, loan.principalRemaining || 0),
        },
        interestPayment: {
          currentMonthInterest: monthlyInterest,
          accruedInterest,
        },
        fullPayoff: {
          principalRemaining: loan.principalRemaining || 0,
          accruedInterest,
          totalPayoff,
        },
      },
      sources: {
        bankBalance: {
          available: freeCash,
          canUse: freeCash > 0,
        },
        ownerFund: {
          available: ownerTotalBalance,
          canUse: ownerTotalBalance > 0,
          accounts: ownerAccounts,
        },
      },
    };
  }

  // ═══════════════════════════════════════════════════════════
  // CREATE PAYMENT - Thực hiện thanh toán
  // ═══════════════════════════════════════════════════════════

  async createPayment(loanId: string, dto: CreateLoanPaymentDto): Promise<PaymentResultDto> {
    this.logger.log(`Creating payment for loan ${loanId}: ${JSON.stringify(dto)}`);

    // 1. Validate loan exists
    const loan = await this.loanModel.findById(loanId);
    if (!loan) {
      throw new NotFoundException(`Loan ${loanId} not found`);
    }

    if (loan.status === 'closed') {
      throw new BadRequestException('Cannot pay a closed loan');
    }

    // 2. Validate source has enough balance
    await this.validatePaymentSource(dto.source, dto.amount, dto.sourceAccountId);

    // 3. Calculate payment allocation
    const { amountToPrincipal, amountToInterest } = this.allocatePayment(
      dto.paymentType as LoanPaymentType,
      dto.amount,
      loan,
      dto.repaymentId,
    );

    const principalBefore = loan.principalRemaining || 0;

    // 4. Create payment record
    const payment = new this.paymentModel({
      loanId: new Types.ObjectId(loanId),
      amount: dto.amount,
      paymentType: dto.paymentType,
      amountToPrincipal,
      amountToInterest,
      source: dto.source,
      sourceAccountId: dto.sourceAccountId,
      paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
      referenceId: dto.referenceId,
      notes: dto.notes,
      repaymentId: dto.repaymentId ? new Types.ObjectId(dto.repaymentId) : undefined,
      principalBeforePayment: principalBefore,
      principalAfterPayment: principalBefore - amountToPrincipal,
    });

    await payment.save();

    // 5. Update loan
    loan.principalRemaining = (loan.principalRemaining || 0) - amountToPrincipal;
    loan.totalPrincipalPaid = (loan.totalPrincipalPaid || 0) + amountToPrincipal;
    loan.totalInterestPaid = (loan.totalInterestPaid || 0) + amountToInterest;

    // Check if fully paid off
    if (loan.principalRemaining <= 0 && dto.paymentType === LoanPaymentType.PAYOFF) {
      loan.status = 'closed';
    }

    await loan.save();

    // 6. Mark repayment as paid if applicable
    if (dto.repaymentId && dto.paymentType === LoanPaymentType.SCHEDULED) {
      await this.repaymentModel.findByIdAndUpdate(dto.repaymentId, {
        paid: true,
        paidDate: new Date(),
      });
    }

    // 7. Create cashflow entry (Cash Out)
    const cashflow = new this.cashflowModel({
      direction: 'out',
      amount: dto.amount,
      sourceType: 'loan',
      description: `Thanh toán khoản vay: ${loan.name} (${loan.lenderName})`,
      date: new Date(),
      referenceId: String(payment._id),
      category: 'loan_payment',
    });
    await cashflow.save();

    // 8. Deduct from source
    let newBankBalance: number | undefined;
    let newOwnerFundBalance: number | undefined;

    if (dto.source === PaymentSource.OWNER_FUND && dto.sourceAccountId) {
      // Deduct from Owner Fund
      try {
        await this.ownerFundService.deductFromAccount(dto.sourceAccountId, dto.amount, {
          category: 'loan_payment',
          description: `Thanh toán khoản vay: ${loan.name}`,
          referenceId: String(payment._id),
        });
        const account = await this.ownerFundService.getFundAccountById(dto.sourceAccountId);
        newOwnerFundBalance = account?.balance;
      } catch (err) {
        this.logger.error('Failed to deduct from Owner Fund', err);
      }
    } else {
      // Bank Balance is tracked through cashflow entries
      try {
        const fcDashboard = await this.financialControlService.getDashboard();
        newBankBalance = fcDashboard.bankBalance - dto.amount;
      } catch (err) {
        this.logger.warn('Failed to get new bank balance');
      }
    }

    // 9. Calculate savings
    const interestRate = loan.interestRate || 0;
    const monthlyInterestSaved = amountToPrincipal * (interestRate / 100 / 12);
    const annualInterestSaved = monthlyInterestSaved * 12;

    const message = this.buildPaymentMessage(dto.paymentType as LoanPaymentType, amountToPrincipal, amountToInterest, loan.name);

    return {
      success: true,
      payment: {
        _id: String(payment._id),
        amount: dto.amount,
        paymentType: dto.paymentType,
        amountToPrincipal,
        amountToInterest,
        source: dto.source,
        paymentDate: payment.paymentDate.toISOString(),
      },
      loan: {
        _id: String(loan._id),
        name: loan.name,
        principalRemaining: loan.principalRemaining,
        totalPrincipalPaid: loan.totalPrincipalPaid,
        totalInterestPaid: loan.totalInterestPaid,
      },
      balances: {
        newBankBalance,
        newOwnerFundBalance,
      },
      savings: amountToPrincipal > 0 ? {
        monthlyInterestSaved,
        annualInterestSaved,
      } : undefined,
      message,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // PAYMENT HISTORY
  // ═══════════════════════════════════════════════════════════

  async getPaymentHistory(loanId: string) {
    return this.paymentModel.find({
      loanId: new Types.ObjectId(loanId),
    })
      .sort({ paymentDate: -1 })
      .lean();
  }

  async getAllPayments(limit = 50) {
    return this.paymentModel.find()
      .sort({ paymentDate: -1 })
      .limit(limit)
      .populate('loanId', 'name lenderName')
      .lean();
  }

  // ═══════════════════════════════════════════════════════════
  // PRIVATE HELPER METHODS
  // ═══════════════════════════════════════════════════════════

  private calculateAvailableToDisburse(loans: any[]): number {
    return loans
      .filter(l => l.disbursementStatus !== 'fully')
      .reduce((sum, l) => sum + ((l.principal || 0) - (l.disbursedAmount || 0)), 0);
  }

  private calculateOutstandingWithInterest(loans: any[]): number {
    return loans
      .filter(l => l.status === 'active' && (l.interestRate || 0) > 0)
      .reduce((sum, l) => sum + (l.principalRemaining || 0), 0);
  }

  private calculateMonthlyInterestCost(loans: any[]): number {
    return loans
      .filter(l => l.status === 'active')
      .reduce((sum, l) => {
        const principal = l.principalRemaining || 0;
        const rate = l.interestRate || 0;
        return sum + (principal * rate / 100 / 12);
      }, 0);
  }

  private calculateLoanMonthlyInterest(loan: any): number {
    const principal = loan.principalRemaining || 0;
    const rate = loan.interestRate || 0;
    return principal * rate / 100 / 12;
  }

  private calculateDueInDays(loans: any[], repayments: any[], days: number): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + days);

    const activeLoanIds = new Set(
      loans.filter(l => l.status === 'active').map(l => String(l._id))
    );

    return repayments
      .filter(r => {
        if (!activeLoanIds.has(String(r.loanId))) return false;
        if (!r.dueDate) return false;
        const dueDate = new Date(r.dueDate);
        return dueDate >= today && dueDate <= windowEnd;
      })
      .reduce((sum, r) => sum + (r.amountPrincipal || 0) + (r.amountInterest || 0), 0);
  }

  private calculateOverdue(loans: any[], repayments: any[]): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeLoanIds = new Set(
      loans.filter(l => l.status === 'active').map(l => String(l._id))
    );

    return repayments
      .filter(r => {
        if (!activeLoanIds.has(String(r.loanId))) return false;
        if (!r.dueDate) return false;
        return new Date(r.dueDate) < today;
      })
      .reduce((sum, r) => sum + (r.amountPrincipal || 0) + (r.amountInterest || 0), 0);
  }

  private async buildLoanDetails(loans: any[], repayments: any[]): Promise<LoanDetailDto[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return loans.map(loan => {
      const loanId = String(loan._id);
      const loanRepayments = repayments.filter(r => String(r.loanId) === loanId);
      
      // Next due
      const futureRepayments = loanRepayments
        .filter(r => r.dueDate && new Date(r.dueDate) >= today)
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

      const nextDue = futureRepayments[0];
      const nextDueDate = nextDue?.dueDate 
        ? new Date(nextDue.dueDate).toISOString().split('T')[0] 
        : null;
      const nextDueAmount = nextDue 
        ? (nextDue.amountPrincipal || 0) + (nextDue.amountInterest || 0) 
        : 0;

      // Overdue for this loan
      const overdueAmount = loanRepayments
        .filter(r => r.dueDate && new Date(r.dueDate) < today)
        .reduce((sum, r) => sum + (r.amountPrincipal || 0) + (r.amountInterest || 0), 0);

      const monthlyInterest = this.calculateLoanMonthlyInterest(loan);

      return {
        loanId,
        name: loan.name || 'Unnamed',
        lenderName: loan.lenderName || 'Unknown',
        principal: loan.principal || 0,
        disbursedAmount: loan.disbursedAmount || 0,
        canDisburse: (loan.principal || 0) - (loan.disbursedAmount || 0),
        principalRemaining: loan.principalRemaining || 0,
        interestRate: loan.interestRate || 0,
        monthlyInterest,
        nextDueDate,
        nextDueAmount,
        overdueAmount,
        status: loan.status || 'draft',
        disbursementStatus: loan.disbursementStatus || 'pending',
      };
    });
  }

  private generateAlerts(loans: any[], repayments: any[], loanDetails: LoanDetailDto[]): LoanAlertDto[] {
    const alerts: LoanAlertDto[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    // Check each loan detail for issues
    for (const detail of loanDetails) {
      // Overdue alert
      if (detail.overdueAmount > 0) {
        alerts.push({
          type: 'overdue',
          message: `Khoản vay "${detail.name}" có ${this.formatCurrency(detail.overdueAmount)} quá hạn chưa trả`,
          loanId: detail.loanId,
          loanName: detail.name,
          severity: 'critical',
          amount: detail.overdueAmount,
        });
      }

      // Due soon alert
      if (detail.nextDueDate && detail.nextDueAmount > 0) {
        const dueDate = new Date(detail.nextDueDate);
        if (dueDate <= sevenDaysLater && dueDate >= today) {
          const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          alerts.push({
            type: 'due_soon',
            message: `Khoản vay "${detail.name}" có ${this.formatCurrency(detail.nextDueAmount)} đến hạn trong ${daysUntil} ngày`,
            loanId: detail.loanId,
            loanName: detail.name,
            severity: daysUntil <= 3 ? 'warning' : 'info',
            amount: detail.nextDueAmount,
            dueDate: detail.nextDueDate,
          });
        }
      }

      // High interest alert
      if (detail.interestRate >= 15) {
        alerts.push({
          type: 'high_interest',
          message: `Khoản vay "${detail.name}" có lãi suất cao (${detail.interestRate}%/năm)`,
          loanId: detail.loanId,
          loanName: detail.name,
          severity: 'warning',
        });
      }
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private buildOptimization(loans: any[], freeCash: number): LoanOptimizationDto {
    // Sort loans by interest rate (highest first) for priority
    const activeLoans = loans
      .filter(l => l.status === 'active' && (l.principalRemaining || 0) > 0)
      .map(l => ({
        loanId: String(l._id),
        loanName: l.name || 'Unnamed',
        effectiveRate: l.interestRate || 0,
        principalRemaining: l.principalRemaining || 0,
      }))
      .sort((a, b) => b.effectiveRate - a.effectiveRate);

    // Add priority ranking
    const loanPriority = activeLoans.map((l, index) => ({
      ...l,
      priority: index + 1,
    }));

    // Early payment suggestion
    const topLoan = activeLoans[0];
    const suggestedPayment = topLoan 
      ? Math.min(freeCash * 0.5, topLoan.principalRemaining) 
      : 0;
    const monthlySavings = suggestedPayment * ((topLoan?.effectiveRate || 0) / 100 / 12);
    const annualSavings = monthlySavings * 12;

    return {
      earlyPaymentSuggestion: {
        available: freeCash > 0 && topLoan !== undefined,
        availableFreeCash: freeCash,
        suggestedPayment,
        monthlySavings,
        annualSavings,
        targetLoanId: topLoan?.loanId || null,
        targetLoanName: topLoan?.loanName || null,
        targetLoanRate: topLoan?.effectiveRate || 0,
      },
      loanPriority,
    };
  }

  private async validatePaymentSource(source: string, amount: number, sourceAccountId?: string) {
    if (source === PaymentSource.BANK_BALANCE) {
      try {
        const fcDashboard = await this.financialControlService.getDashboard();
        const freeCash = fcDashboard.freeCash || 0;
        if (amount > freeCash) {
          throw new BadRequestException(
            `Insufficient Bank Balance. Available: ${this.formatCurrency(freeCash)}, Requested: ${this.formatCurrency(amount)}`
          );
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        this.logger.warn('Failed to validate bank balance');
      }
    } else if (source === PaymentSource.OWNER_FUND) {
      if (!sourceAccountId) {
        throw new BadRequestException('sourceAccountId is required for Owner Fund payments');
      }
      try {
        const account = await this.ownerFundService.getFundAccountById(sourceAccountId);
        if (!account) {
          throw new BadRequestException(`Owner Fund account ${sourceAccountId} not found`);
        }
        if (amount > (account.balance || 0)) {
          throw new BadRequestException(
            `Insufficient Owner Fund balance. Available: ${this.formatCurrency(account.balance || 0)}, Requested: ${this.formatCurrency(amount)}`
          );
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('Failed to validate Owner Fund balance');
      }
    }
  }

  private allocatePayment(
    paymentType: LoanPaymentType,
    amount: number,
    loan: any,
    repaymentId?: string,
  ): { amountToPrincipal: number; amountToInterest: number } {
    switch (paymentType) {
      case LoanPaymentType.PRINCIPAL:
        // All goes to principal
        return {
          amountToPrincipal: Math.min(amount, loan.principalRemaining || 0),
          amountToInterest: 0,
        };

      case LoanPaymentType.INTEREST:
        // All goes to interest
        return {
          amountToPrincipal: 0,
          amountToInterest: amount,
        };

      case LoanPaymentType.PAYOFF:
        // Remaining principal + some interest
        const principal = loan.principalRemaining || 0;
        const interest = amount - principal;
        return {
          amountToPrincipal: principal,
          amountToInterest: Math.max(0, interest),
        };

      case LoanPaymentType.SCHEDULED:
      default:
        // Split according to repayment schedule (or 50/50 if not specified)
        // In real implementation, would look up the repayment record
        return {
          amountToPrincipal: Math.floor(amount * 0.7), // Assume 70% principal
          amountToInterest: Math.floor(amount * 0.3),  // Assume 30% interest
        };
    }
  }

  private buildPaymentMessage(
    paymentType: LoanPaymentType,
    amountToPrincipal: number,
    amountToInterest: number,
    loanName: string,
  ): string {
    const total = amountToPrincipal + amountToInterest;
    switch (paymentType) {
      case LoanPaymentType.PRINCIPAL:
        return `Đã trả ${this.formatCurrency(amountToPrincipal)} gốc cho khoản vay "${loanName}"`;
      case LoanPaymentType.INTEREST:
        return `Đã trả ${this.formatCurrency(amountToInterest)} lãi cho khoản vay "${loanName}"`;
      case LoanPaymentType.PAYOFF:
        return `Đã tất toán khoản vay "${loanName}" (${this.formatCurrency(total)})`;
      case LoanPaymentType.SCHEDULED:
        return `Đã thanh toán kỳ hạn ${this.formatCurrency(total)} cho khoản vay "${loanName}"`;
      default:
        return `Đã thanh toán ${this.formatCurrency(total)} cho khoản vay "${loanName}"`;
    }
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  }
}
