import { Types } from 'mongoose';

/**
 * Interface for order calculation context
 * Used to maintain type safety in auto-calculation methods
 */
export interface OrderCalculationContext {
  productSource?: string;
  inventoryUnitCostSnapshot?: number;
  resalePolicySnapshot?: string;
  dealerShippingFeeSnapshot?: number;
  dealerReturnFeeSnapshot?: number;
  _id?: Types.ObjectId;
  productId?: Types.ObjectId;
  supplierId?: Types.ObjectId;
  agentId?: Types.ObjectId;
  saleMode?: 'retail' | 'dealer';
  agentRoleSnapshot?: 'internal_agent' | 'external_agent';
  
  // ============ SUPPLIER QUOTE SNAPSHOT ============
  supplierQuoteId?: Types.ObjectId;       // Reference đến báo giá NCC
  supplierAppliedPrice?: number;          // Giá NCC snapshot
  supplierQuoteSnapshotAt?: Date;         // Thời điểm snapshot
  supplierQuoteEffectiveAt?: Date;
  supplierPriceSource?: string;
  packagingCostSnapshot?: number;
  supplierShippingFeeSnapshot?: number;     // Phí ship từ quote
  supplierReturnFeeSnapshot?: number;       // Phí hoàn từ quote
  supplierIsReturnableSnapshot?: boolean;   // Chính sách hoàn hàng (true=NCC nhận lại; false=không nhận)
  
  shippingFee?: number;
  returnFee?: number;
  supplierQuote?: number;
  agentQuoteId?: string;
  agentAppliedPrice?: number;
  agentQuoteSnapshotAt?: Date;  // Thời điểm snapshot báo giá đại lý
  agentQuoteEffectiveAt?: Date;
  agentPaymentDueDate?: Date;   // Ngày đến hạn thanh toán đại lý (biweekly)
  agentQuote?: number;
  productType?: string;
  productCategoryIdSnapshot?: Types.ObjectId;
  productCategoryNameSnapshot?: string;
  productCategoryCodeSnapshot?: string;
  quantity?: number;
  grossProfit?: number;
  productionStatus?: string;
  orderStatus?: string;
  codAmount?: number;
  adGroupId?: string;
  orderDate?: Date;
  advertisingCost?: number;
  laborCostAllocation?: number;
  otherCostAllocation?: number;
  netProfit?: number;
  
  // Payment amounts
  supplierPaidAmount?: number;
  agentPaidAmount?: number;
  
  // Realized profit
  realizedGrossProfit?: number;
  realizedNetProfit?: number;
  realizedAt?: Date;
}

/**
 * Interface for supplier quote result from database
 */
export interface SupplierQuoteResult {
  currency?: string;
  _id?: Types.ObjectId;
  price?: number;
  shippingFee?: number;
  returnFee?: number;
  isReturnableOverride?: boolean;
  effectiveAt?: Date;
  createdAt?: Date;
}

/**
 * Interface for product with populated category
 */
export interface ProductWithCategory {
  resalePolicy?: string;
  _id: Types.ObjectId;
  importPrice?: number;
  shippingCost?: number;
  packagingCost?: number;
  isReturnable?: boolean;
  categoryId?: {
    _id?: Types.ObjectId;
    name?: string;
    code?: string;
  };
}

/**
 * Interface for agent quote result
 */
export interface AgentQuoteResult {
  shippingFee?: number;
  returnFee?: number;
  validFrom?: Date;
  _id?: any;
  unitPrice?: number;
}
