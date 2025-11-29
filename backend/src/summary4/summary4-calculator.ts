/**
 * Summary4 Calculator - Restored from Docker v10.0
 * Business Logic for Financial Calculations
 * Converts TestOrder2 + Quote data into Summary4 financial fields
 */

export interface Summary4CalculationInput {
  productionStatus?: string;
  orderStatus?: string;
  codAmount?: number;
  depositAmount?: number;
  quantity?: number;
  manualPayment?: number;
}

export interface QuoteData {
  unitPrice?: number;
}

export interface ExistingSummary4 {
  manualPaymentAmount?: number;
}

export interface Summary4Calculation {
  approvedQuotePrice: number;
  mustPayToCompany: number;
  paidToCompany: number;
  manualPayment: number;
  needToPay: number;
}

function normalize(str?: string): string {
  return (str || '').trim();
}

/**
 * Core calculation function - exact logic from Docker v10.0
 */
export function computeSummary4Derived(
  order: Summary4CalculationInput,
  quote: QuoteData = {},
  existing: ExistingSummary4 = {}
): Summary4Calculation {
  // Extract values with defaults (exact logic from Docker v10.0)
  const unitPrice = Number(quote?.unitPrice || 0) || 0;
  const qty = Number(order.quantity || 0) || 0;
  const cod = Number(order.codAmount || 0) || 0;
  
  const production = normalize(order.productionStatus);
  const status = normalize(order.orderStatus);
  
  // Core calculation logic from Docker v10.0
  const approvedQuotePrice = unitPrice;
  const mustPayToCompany = production === 'Đã trả kết quả' ? unitPrice * qty : 0;
  const paidToCompany = status === 'Giao thành công' ? cod : 0;
  const manualPayment = (order.manualPayment ?? existing?.manualPaymentAmount ?? 0) || 0;
  const needToPay = paidToCompany - mustPayToCompany - manualPayment;

  return {
    approvedQuotePrice,
    mustPayToCompany,
    paidToCompany,
    manualPayment,
    needToPay,
  };
}