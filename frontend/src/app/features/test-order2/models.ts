export interface TestOrder2 {
  _id: string;
  productId: { _id: string; name?: string; color?: string } | string;
  productSource?: 'inventory' | 'supplier';
  supplierId?: string | { _id: string };
  supplierPriceLevel?: number;
  supplierAppliedPrice?: number;
  customerName: string;
  quantity: number;
  agentId: { _id: string; name?: string; fullName?: string } | string;
  adGroupId: string; // may be '0'
  isActive: boolean;
  serviceDetails?: string;
  productionStatus: string;
  orderStatus: string;
  submitLink?: string;
  trackingNumber?: string;
  depositAmount: number;
  codAmount: number;
  manualPayment?: number;
  shippingFee?: number;
  returnFee?: number;
  supplierQuote?: number;
  agentQuoteId?: string;
  agentAppliedPrice?: number;
  agentQuote?: number;
  productType?: string;
  grossProfit?: number;
  advertisingCost?: number;
  laborCostAllocation?: number;
  otherCostAllocation?: number;
  netProfit?: number;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateTestOrder2 = Omit<TestOrder2, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateTestOrder2 = Partial<CreateTestOrder2>;

export interface NamedItem { _id: string; name: string; color?: string; }

export interface ProductWithSuppliers extends NamedItem {
  suppliers?: Array<{
    supplierId?: string;
    price1?: number;
    price2?: number;
    price3?: number;
    appliedLevel?: number;
    appliedPrice?: number;
    priority?: number;
    isDefault?: boolean;
  }>;
}
