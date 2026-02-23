export interface Owner {
  _id?: string;
  name: string;
  email?: string;
  phone?: string;
  profitSharePercentage: number;
  totalWithdrawn: number;
  availableBalance: number;
  bankAccount?: string;
  bankName?: string;
  bankAccountName?: string;
  isActive: boolean;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export enum WithdrawalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum WithdrawalType {
  PROFIT_SHARE = 'profit_share',
  EMERGENCY = 'emergency',
  ADVANCE = 'advance',
}

export interface Withdrawal {
  _id?: string;
  ownerId: string | Owner;
  amount: number;
  type: WithdrawalType;
  status: WithdrawalStatus;
  requestDate: Date;
  approvedDate?: Date;
  completedDate?: Date;
  approvedBy?: string;
  approvalNotes?: string;
  reason?: string;
  notes?: string;
  bankAccount?: string;
  bankName?: string;
  bankAccountName?: string;
  transactionReference?: string;
  isUrgent: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OwnerStatistics {
  owner: {
    name: string;
    email?: string;
    phone?: string;
    profitSharePercentage: number;
  };
  balance: {
    available: number;
    totalWithdrawn: number;
  };
  withdrawals: {
    total: number;
    pending: {
      count: number;
      amount: number;
    };
    approved: {
      count: number;
      amount: number;
    };
    completed: {
      count: number;
      amount: number;
    };
    rejected: {
      count: number;
      amount: number;
    };
  };
  recentWithdrawals: Withdrawal[];
}

// ==================== FUND TRANSACTIONS ====================

export enum FundTransactionType {
  IN = 'in',
  OUT = 'out',
}

export enum FundTransactionCategory {
  // Loại tiền VÀO
  PROFIT_SHARE = 'profit_share',
  CAPITAL_CONTRIBUTION = 'capital_contribution',
  REFUND = 'refund',
  BANK_TRANSFER_IN = 'bank_transfer_in',
  OTHER_IN = 'other_in',
  
  // Loại tiền RA
  WITHDRAWAL_PROFIT = 'withdrawal_profit',
  WITHDRAWAL_EMERGENCY = 'withdrawal_emergency',
  WITHDRAWAL_ADVANCE = 'withdrawal_advance',
  BANK_TRANSFER_OUT = 'bank_transfer_out',
  PERSONAL_WITHDRAWAL = 'personal_withdrawal',
  TAX = 'tax',
  OTHER_OUT = 'other_out',
}

export interface FundTransaction {
  _id?: string;
  ownerId: string | Owner;
  type: FundTransactionType;
  category: FundTransactionCategory;
  amount: number;
  date: Date;
  description?: string;
  notes?: string;
  referenceId?: string;
  referenceType?: string;
  createdBy?: string;
  balanceAfter: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FundSummary {
  summary: {
    totalIn: number;
    totalOut: number;
    totalBalance: number;
    totalWithdrawn: number;
    ownerWithdrawable: number;
    pendingAmount: number;
  };
  recent30Days: {
    in: number;
    out: number;
    net: number;
  };
  owners: {
    _id: string;
    name: string;
    availableBalance: number;
    totalWithdrawn: number;
    profitSharePercentage: number;
  }[];
  cfoDashboard: {
    bankBalance: number;
    freeCash: number;
    runwayMonths: number;
    ownerWithdrawable: number;
  } | null;
}

// ==================== FUND ACCOUNT (Quỹ Owner riêng) ====================

export interface OwnerFundAccount {
  _id?: string;
  name: string;
  balance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  totalReturnedToCompany: number;
  bankAccount?: string;
  bankName?: string;
  isActive: boolean;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FundAccountInfo {
  account: OwnerFundAccount;
  ownerWithdrawable: number;
  canTransferToFund: number;
}
