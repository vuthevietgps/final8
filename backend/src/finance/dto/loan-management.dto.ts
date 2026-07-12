import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { LoanPaymentType, PaymentSource } from '../schemas/loan-payment.schema';

/**
 * DTO tạo thanh toán khoản vay
 */
export class CreateLoanPaymentDto {
  @IsString()
  @MaxLength(200)
  idempotencyKey: string;

  @IsEnum(LoanPaymentType)
  paymentType: LoanPaymentType;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsEnum(PaymentSource)
  source: PaymentSource;

  @IsOptional()
  @IsString()
  sourceAccountId?: string; // Required if source = owner_fund

  @IsOptional()
  @IsString()
  repaymentId?: string; // Required if paymentType = scheduled

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  paymentDate?: string;
}

/**
 * Response cho Dashboard
 */
export class LoanDashboardDto {
  availableToDisburse: number;      // Có thể giải ngân
  outstandingWithInterest: number;  // Đang chịu lãi
  totalOutstanding: number;         // Tổng dư nợ
  monthlyInterestCost: number;      // Chi phí lãi/tháng
  due7Days: number;                 // Sắp trả 7 ngày
  due14Days: number;                // Sắp trả 14 ngày
  due30Days: number;                // Sắp trả 30 ngày
  overdueAmount: number;            // Đã quá hạn

  byLoan: LoanDetailDto[];
  alerts: LoanAlertDto[];
  optimization: LoanOptimizationDto;
  metadata: LoanMetadataDto;
}

export class LoanDetailDto {
  loanId: string;
  name: string;
  lenderName: string;
  principal: number;
  disbursedAmount: number;
  canDisburse: number;              // Còn có thể giải ngân
  principalRemaining: number;
  interestRate: number;
  monthlyInterest: number;
  nextDueDate: string | null;
  nextDueAmount: number;
  overdueAmount: number;
  status: string;
  disbursementStatus: string;
}

export class LoanAlertDto {
  type: 'overdue' | 'due_soon' | 'high_interest' | 'cash_crunch';
  message: string;
  loanId?: string;
  loanName?: string;
  severity: 'critical' | 'warning' | 'info';
  amount?: number;
  dueDate?: string;
}

export class LoanOptimizationDto {
  // Gợi ý trả gốc sớm
  earlyPaymentSuggestion: {
    available: boolean;
    availableFreeCash: number;
    suggestedPayment: number;
    monthlySavings: number;
    annualSavings: number;
    targetLoanId: string | null;
    targetLoanName: string | null;
    targetLoanRate: number;
  };

  // So sánh khoản vay (ưu tiên trả)
  loanPriority: {
    loanId: string;
    loanName: string;
    effectiveRate: number;
    principalRemaining: number;
    priority: number; // 1 = ưu tiên cao nhất
  }[];
}

export class LoanMetadataDto {
  calculatedAt: string;
  bankBalance: number;
  freeCash: number;
  ownerFundBalance: number;
  canPayFromBank: boolean;
  canPayFromOwner: boolean;
}

/**
 * Payment Options Response
 */
export class PaymentOptionsDto {
  loan: {
    _id: string;
    name: string;
    lenderName: string;
    principal: number;
    principalRemaining: number;
    interestRate: number;
    monthlyInterest: number;
  };

  options: {
    scheduledPayments: ScheduledPaymentOption[];
    principalPayment: {
      minAmount: number;
      maxAmount: number;
      suggestedAmount: number;
    };
    interestPayment: {
      currentMonthInterest: number;
      accruedInterest: number;
    };
    fullPayoff: {
      principalRemaining: number;
      accruedInterest: number;
      totalPayoff: number;
    };
  };

  sources: {
    bankBalance: {
      available: number;
      canUse: boolean;
    };
    ownerFund: {
      available: number;
      canUse: boolean;
      accounts: { id: string; name: string; balance: number }[];
    };
  };
}

export class ScheduledPaymentOption {
  repaymentId: string;
  dueDate: string;
  amountPrincipal: number;
  amountInterest: number;
  total: number;
  isOverdue: boolean;
  daysPastDue: number;
}

/**
 * Payment Result Response
 */
export class PaymentResultDto {
  success: boolean;
  payment: {
    _id: string;
    amount: number;
    paymentType: string;
    amountToPrincipal: number;
    amountToInterest: number;
    source: string;
    paymentDate: string;
  };
  loan: {
    _id: string;
    name: string;
    principalRemaining: number;
    totalPrincipalPaid: number;
    totalInterestPaid: number;
  };
  balances: {
    newBankBalance?: number;
    newOwnerFundBalance?: number;
  };
  savings?: {
    monthlyInterestSaved: number;
    annualInterestSaved: number;
  };
  message: string;
}
