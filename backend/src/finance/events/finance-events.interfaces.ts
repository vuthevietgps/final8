/**
 * FINANCE EVENT PAYLOADS — Phase 3
 * Mỗi event đi kèm payload tối thiểu để listener biết cần invalidate gì.
 */

export interface OrderPaymentUpdatedEvent {
  orderId: string;
  /** 'supplier' | 'agent' | 'both' */
  paymentType: 'supplier' | 'agent' | 'both';
  oldStatus: string;
  newStatus: string;
}

export interface FinanceStateChangedEvent {
  source: string;
  entityId?: string;
}

export interface FinancialControlPolicyUpdatedEvent {
  changedFields: string[];
  changedBy: string;
}

export interface OrderCompletedEvent {
  orderId: string;
  orderDate?: string | Date;
  adGroupId?: string;
  supplierId?: string;
  agentId?: string;
  codAmount?: number;
}

export interface LaborStatementUpdatedEvent {
  statementId: string;
  oldStatus?: string;
  newStatus?: string;
  amountChanged: boolean;
}

export interface OtherCostUpdatedEvent {
  costId: string;
  category?: string;
  confirmed?: boolean;
}

export interface AgentReceivableUpdatedEvent {
  recordId: string;
  agentId: string;
  amountChanged: boolean;
}

export interface SupplierPayableUpdatedEvent {
  recordId: string;
  supplierId: string;
  amountChanged: boolean;
}

export interface LoanEvent {
  loanId: string;
  amount: number;
}

export interface OwnerFundChangedEvent {
  accountId: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
}
