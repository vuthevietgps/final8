export interface TestOrder2 {
  _id: string;
  productId: { _id: string; name?: string; color?: string } | string;
  productUsageDurationMonths?: number;
  productSource?: 'inventory' | 'supplier' | 'dealer_custody';
  inventoryBatchId?: string;
  financialModelVersion?: number;
  saleMode?: 'retail' | 'dealer';
  agentRoleSnapshot?: 'internal_agent' | 'external_agent';
  profitAssessment?: {state:string;label:string;reasons:string[]};
  retailSaleAmount?: number;
  resalePolicySnapshot?: string;
  inventoryUnitCostSnapshot?: number;
  dealerShippingFeeSnapshot?: number;
  dealerReturnFeeSnapshot?: number;
  shipments?: any[];
  receivedReturnQuantity?: number;
  deliveredQuantity?: number;
  supplierId?: string | { _id: string };
  supplierPriceLevel?: number;
  supplierAppliedPrice?: number;
  customerName: string;
  quantity: number;
  agentId: { _id: string; name?: string; fullName?: string } | string;
  adGroupId: string; // empty means unattributed; provider IDs must never use a sentinel
  customerAcquisitionSource?: 'ads' | 'non_ads';
  adsProvider?: 'google' | 'facebook' | 'tiktok';
  adAccountProviderId?: string;
  adCampaignId?: string;
  adAccountNameSnapshot?: string;
  adCampaignNameSnapshot?: string;
  adGroupNameSnapshot?: string;
  adsAttributionSource?: 'windsor' | 'erp_ad_group' | 'manual';
  adsAttributionSyncedAt?: string;
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
  dealerShippingIncludedInPrice?: boolean;
  dealerSaleRecognizedAt?: string;
  dealerReturnedAt?: string;
  dealerProfitState?: 'awaiting_dispatch' | 'missing_quotes' | 'recognized';
  retailProfitState?: 'awaiting_delivery' | 'missing_quotes' | 'missing_sale_price' | 'recognized';
  supplierContractAmount?: number;
  goodsOwner?: 'dealer';
  returnDisposition?: 'dealer_custody';
  recognizedRevenue?: number;
  recognizedGoodsCost?: number;
  dealerRecoverableFees?: number;
  dealerContractAmount?: number;
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
  readonly businessConfirmedAt?: string | null;
  readonly businessConfirmedBy?: string;
  readonly businessConfirmationSource?: 'erp_manual_confirmation' | 'pending_order_approval';
}

export type CreateTestOrder2 = Omit<
  TestOrder2,
  | '_id'
  | 'createdAt'
  | 'updatedAt'
  | 'businessConfirmedAt'
  | 'businessConfirmedBy'
  | 'businessConfirmationSource'
>;
export type UpdateTestOrder2 = Partial<CreateTestOrder2>;

export interface NamedItem { _id: string; name: string; color?: string; role?: string; }

export interface AdsAttributionOption {
  selectionKey: string;
  source: 'windsor' | 'erp_ad_group';
  provider: 'google' | 'facebook' | 'tiktok';
  adGroupId: string;
  adGroupName?: string;
  campaignId?: string;
  campaignName?: string;
  accountId?: string;
  accountName?: string;
  status?: string;
  lastSeenAt?: string;
  label: string;
}

export interface AdsAttributionOptionsResponse {
  items: AdsAttributionOption[];
  syncedAt?: string;
}

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
