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

export interface ProductData {
  importPrice?: number;
  shippingCost?: number;
  packagingCost?: number;
  productCostOverride?: number; // allow supplier/FIFO cost override per order
}

export interface ExistingSummary4 {
  manualPaymentAmount?: number;
}

export interface Summary4Calculation {
  approvedQuotePrice: number;         // Giá báo cho đại lý (từ Quote)
  mustPayAmount: number;              // Chi phí giá vốn sản phẩm (từ Product)
  paidToCompanyAmount: number;        // Doanh thu thực tế
  manualPaymentAmount: number;        // Chi phí thủ công khác
  needToPayAmount: number;            // Số tiền còn phải thu
}

function normalize(str?: string): string {
  return (str || '').trim();
}

/**
 * Core calculation function with updated revenue logic
 * 
 * Doanh thu (paidToCompany):
 * - Đơn giản hóa: unitPrice × qty (giá báo) khi "Đã trả kết quả"
 * - Không phân nhánh nội/ngoại để giảm phức tạp
 *
 * Chi phí (mustPayToCompany):
 * - Giá vốn sản phẩm × qty (importPrice + shippingCost + packagingCost)
 * - Chỉ tính khi "Đã trả kết quả"
 */
export function computeSummary4Derived(
  order: Summary4CalculationInput,
  quote: QuoteData = {},
  product: ProductData = {},
  existing: ExistingSummary4 = {}
): Summary4Calculation {
  // Extract values with defaults
  const unitPrice = Number(quote?.unitPrice || 0) || 0;
  const qty = Number(order.quantity || 0) || 0;
  const production = normalize(order.productionStatus);
  
  // Tính giá vốn sản phẩm (từ Product)
  const importPrice = Number(product?.importPrice || 0) || 0;
  const shippingCost = Number(product?.shippingCost || 0) || 0;
  const packagingCost = Number(product?.packagingCost || 0) || 0;
  const productCostBase = importPrice + shippingCost + packagingCost;
  const productCost = Number(product?.productCostOverride ?? productCostBase) || 0;
  
  // Giá báo cho đại lý (để reference, không dùng tính toán)
  const approvedQuotePrice = unitPrice;
  
  // Chi phí giá vốn sản phẩm: chỉ tính khi đã trả kết quả
  // mustPayAmount = (importPrice + shippingCost + packagingCost) × quantity
  const mustPayAmount = production === 'Đã trả kết quả' ? productCost * qty : 0;
  
  // Logic doanh thu (paidToCompanyAmount) đơn giản: chỉ theo báo giá × qty khi đã trả kết quả
  const paidToCompanyAmount = production === 'Đã trả kết quả' ? unitPrice * qty : 0;
  
  // Chi phí thủ công (vận chuyển, đóng gói thêm, etc.)
  const manualPaymentAmount = (order.manualPayment ?? existing?.manualPaymentAmount ?? 0) || 0;
  
  // Số tiền còn phải thu = doanh thu - chi phí giá vốn - chi phí thủ công
  const needToPayAmount = paidToCompanyAmount - mustPayAmount - manualPaymentAmount;

  return {
    approvedQuotePrice,
    mustPayAmount,
    paidToCompanyAmount,
    manualPaymentAmount,
    needToPayAmount,
  };
}