/**
 * FINANCE EVENTS — Phase 3 Architecture
 * ======================================
 * Thay vì các module Finance gọi trực tiếp (forwardRef), các domain module
 * khác (LaborCost, OtherCost, Agent, Supplier, Order) sẽ emit event khi có
 * thay đổi. FinanceEventListenerService lắng nghe và invalidate / repopulate
 * cache, loại bỏ nhu cầu circular-dependency.
 *
 * Quy ước đặt tên: "<domain>.<action>"
 */
export const FinanceEvents = {
  // === Generic finance read-model invalidation ===
  FINANCE_STATE_CHANGED: 'finance.state_changed',
  FINANCIAL_CONTROL_POLICY_UPDATED: 'finance.financial_control_policy_updated',

  // === Đơn hàng ===
  ORDER_PAYMENT_UPDATED: 'order.payment_updated',       // supplierPaymentStatus / agentPaymentStatus changed
  ORDER_COMPLETED: 'order.completed',                    // orderStatus → Giao thành công

  // === Chi phí lao động ===
  LABOR_STATEMENT_UPDATED: 'labor.statement_updated',   // StatementStatus changed / amount changed
  LABOR_STATEMENT_CLOSED: 'labor.statement_closed',

  // === Chi phí khác ===
  OTHER_COST_UPDATED: 'other_cost.updated',
  OTHER_COST_CONFIRMED: 'other_cost.confirmed',

  // === Công nợ đại lý ===
  AGENT_RECEIVABLE_UPDATED: 'agent_receivable.updated', // payment recorded / status changed

  // === Công nợ NCC ===
  SUPPLIER_PAYABLE_UPDATED: 'supplier_payable.updated',

  // === Khoản vay ===
  LOAN_DISBURSED: 'loan.disbursed',
  LOAN_REPAYMENT_MADE: 'loan.repayment_made',

  // === Quỹ / vốn ===
  OWNER_FUND_CHANGED: 'owner_fund.changed',             // deposit / withdrawal completed
} as const;

export type FinanceEventName = (typeof FinanceEvents)[keyof typeof FinanceEvents];
