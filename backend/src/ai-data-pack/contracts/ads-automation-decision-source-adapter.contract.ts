import type {
  AdsAutomationDecisionSnapshotInput,
  AdsAutomationEvidenceWindow,
  AdsAutomationPolicyInput,
} from "./ads-automation-decision.contract";

export type AdsAutomationDecisionSourceKey =
  | "ads_performance"
  | "campaign_budgets"
  | "product_performance"
  | "supplier_safety"
  | "pause_review"
  | "cashflow_policy";

export type AdsAutomationDecisionSourceFreshnessStatus =
  | "fresh"
  | "stale"
  | "missing"
  | "unknown";

export type AdsAutomationDecisionSourceDecisionUse = "yes" | "cautious" | "no";

export type AdsAutomationDecisionSourceEntityType =
  | "ad_group"
  | "product"
  | "supplier"
  | "policy";

export interface AdsAutomationDecisionSourceEvidence {
  sourceKey: AdsAutomationDecisionSourceKey;
  sourceLabel: string;
  status: AdsAutomationDecisionSourceFreshnessStatus;
  canUseForDecision: AdsAutomationDecisionSourceDecisionUse;
  latestObservedAt: string | null;
  maxAgeHours: number;
  ageHours: number | null;
  rowCount: number;
  missingFields: string[];
  affectedEntityIds: string[];
}

export interface AdsAutomationDecisionMissingFieldEvidence {
  sourceKey: AdsAutomationDecisionSourceKey;
  entityType: AdsAutomationDecisionSourceEntityType;
  entityId: string;
  missingFields: string[];
}

export interface AdsAutomationDecisionAdapterSafety {
  read_only: true;
  db_connection_used: false;
  provider_api_used: false;
  google_ads_api_used: false;
  live_ads_execution_used: false;
  erp_mutation_used: false;
  payment_mutation_used: false;
  production_ready: false;
}

export interface AdsAutomationDecisionSourceAdapterResult {
  snapshotInput: AdsAutomationDecisionSnapshotInput;
  sourceEvidence: AdsAutomationDecisionSourceEvidence[];
  missingFieldEvidence: AdsAutomationDecisionMissingFieldEvidence[];
  mappingEvidence: AdsAutomationDecisionSourceMappingEvidence;
  safety: AdsAutomationDecisionAdapterSafety;
}

export interface AdsAutomationDecisionSourceAdapterInput {
  snapshotDate?: string;
  evidenceWindow?: AdsAutomationEvidenceWindow;
  policy?: AdsAutomationCashflowPolicyReadRow;
  adGroups?: AdsAutomationAdGroupReadRow[];
  products?: AdsAutomationProductReadRow[];
  suppliers?: AdsAutomationSupplierReadRow[];
  sourceWatermarks?: Partial<
    Record<AdsAutomationDecisionSourceKey, string | Date>
  >;
}

export interface AdsAutomationDecisionSourceAdapterOptions {
  snapshotDate?: string;
  evidenceWindow?: AdsAutomationEvidenceWindow;
  now?: string | Date;
  maxAgeHours?: Partial<Record<AdsAutomationDecisionSourceKey, number>>;
}

export interface AdsAutomationDecisionErpSourceAdapterInput {
  snapshotDate?: string;
  evidenceWindow?: AdsAutomationEvidenceWindow;
  adGroups?: AdsAutomationErpAdGroupRecord[];
  advertisingCosts?: AdsAutomationErpAdvertisingCostRecord[];
  orders?: AdsAutomationErpOrderRecord[];
  products?: AdsAutomationErpProductRecord[];
  inventorySummaries?: AdsAutomationErpInventorySummaryRecord[];
  supplierQuotes?: AdsAutomationErpSupplierQuoteRecord[];
  supplierPayables?: AdsAutomationErpSupplierPayableRecord[];
  suppliers?: AdsAutomationErpSupplierRecord[];
  cashflowPolicy?: AdsAutomationCashflowPolicyReadRow;
  availableFundSnapshots?: AdsAutomationErpAvailableFundSnapshotRecord[];
  cashflowSummarySnapshots?: AdsAutomationErpCashflowSummarySnapshotRecord[];
  sourceWatermarks?: Partial<
    Record<AdsAutomationDecisionSourceKey, string | Date>
  >;
}

export interface AdsAutomationDecisionSourceMappingEvidence {
  orderAttribution: AdsAutomationDecisionOrderAttributionEvidence[];
  spendReconciliation: AdsAutomationDecisionSpendReconciliationEvidence[];
  productMappings: AdsAutomationDecisionProductMappingEvidence[];
}

export interface AdsAutomationDecisionOrderAttributionEvidence {
  orderId: string;
  adGroupId: string | null;
  productIds: string[];
  orderDate: string | null;
  status: string | null;
  includedInProfit: boolean;
  includedInReportWindow: boolean;
  revenueVnd: number;
  grossProfitVnd: number;
  advertisingCostVnd: number;
  blockers: string[];
}

export interface AdsAutomationDecisionSpendReconciliationEvidence {
  adGroupId: string;
  platformSpendVnd: number | null;
  orderAdvertisingCostVnd: number;
  mismatchVnd: number | null;
  mismatchPercent: number | null;
  sourceOfTruth: "platform_spend";
  status:
    | "matched"
    | "mismatch"
    | "missing_platform_spend"
    | "missing_order_attribution";
  blockers: string[];
}

export interface AdsAutomationDecisionProductMappingEvidence {
  productId: string;
  mappedAdGroupIds: string[];
  orderIds: string[];
  supplierIds: string[];
  blockers: string[];
}

export interface AdsAutomationSourceStampedRow {
  lastSyncAt?: string | Date;
  lastSyncedAt?: string | Date;
  sourceUpdatedAt?: string | Date;
  updatedAt?: string | Date;
  createdAt?: string | Date;
}

export interface AdsAutomationAdGroupReadRow extends AdsAutomationSourceStampedRow {
  platform?: string;
  accountId?: string;
  customerId?: string;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  adGroupName?: string;
  resourceName?: string;
  campaignBudgetId?: string;
  campaignBudgetResourceName?: string;
  currentStatus?: string;
  status?: string;
  currentBudgetVnd?: number;
  dailyBudgetVnd?: number;
  campaignBudgetAmountVnd?: number;
  spendVnd?: number;
  costVnd?: number;
  clicks?: number;
  impressions?: number;
  conversions?: number;
  allConversions?: number;
  conversionValue?: number;
  conversionValueVnd?: number;
  costPerConversion?: number;
  costPerConversionVnd?: number;
  orders?: number;
  revenueVnd?: number;
  revenue?: number;
  grossProfitVnd?: number;
  grossProfit?: number;
  netProfitAfterAdsVnd?: number;
  netProfit?: number;
  orderAdvertisingCostVnd?: number;
  spendSourceOfTruth?: "platform_spend" | string;
  spendReconciliationStatus?:
    | "matched"
    | "mismatch"
    | "missing_platform_spend"
    | "missing_order_attribution"
    | string;
  spendMismatchVnd?: number;
  spendMismatchPercent?: number;
  attributedOrderIds?: string[];
  excludedOrderIds?: string[];
  cancelledReturnedRefundedOrders?: number;
  returnRatePercent?: number;
  dataQualityScore?: number;
  attributionConfidence?: number;
  labels?: string[];
  productIds?: string[];
  internalProductIds?: string[];
  mappedProductIds?: string[];
  bottlenecksChecked?: boolean;
}

export interface AdsAutomationProductReadRow extends AdsAutomationSourceStampedRow {
  productId?: string;
  sku?: string;
  name?: string;
  productName?: string;
  netProfitVnd?: number;
  adAttributedNetProfitAfterAdsVnd?: number;
  marginPercent?: number;
  returnCancelRefundRatePercent?: number;
  stockAvailable?: number;
  reservedQuantity?: number;
  incomingQuantity?: number;
  daysOfCover?: number;
  mediaReady?: boolean;
  landingReady?: boolean;
  offerReady?: boolean;
  mappedAdGroupIds?: string[];
  supplierIds?: string[];
}

export interface AdsAutomationSupplierReadRow extends AdsAutomationSourceStampedRow {
  productId?: string;
  supplierId?: string;
  supplierName?: string;
  quoteApproved?: boolean;
  currentQuoteVnd?: number;
  priorQuoteVnd?: number;
  marginAfterCostPercent?: number;
  leadTimeDays?: number;
  lateDeliveryRatePercent?: number;
  paymentFreshnessDays?: number;
  capacityStatus?: "available" | "constrained" | "blocked" | string;
  returnFaultRatePercent?: number;
}

export interface AdsAutomationCashflowPolicyReadRow
  extends AdsAutomationPolicyInput, AdsAutomationSourceStampedRow {}

export interface AdsAutomationErpAdGroupRecord extends AdsAutomationSourceStampedRow {
  _id?: unknown;
  platform?: string;
  adAccountId?: unknown;
  accountId?: string;
  customerId?: string;
  campaignId?: string;
  campaignName?: string;
  adGroupId?: string;
  name?: string;
  adGroupName?: string;
  resourceName?: string;
  campaignBudgetId?: string;
  campaignBudgetResourceName?: string;
  dailyBudget?: number;
  currentBudgetVnd?: number;
  remoteStatus?: string;
  effectiveStatus?: string;
  status?: string;
  isActive?: boolean;
  selectedProducts?: unknown[];
  internalProductIds?: unknown[];
  productIds?: unknown[];
  labels?: string[];
  isManualOverride?: boolean;
  notes?: string;
  bottlenecksChecked?: boolean;
}

export interface AdsAutomationErpAdvertisingCostRecord extends AdsAutomationSourceStampedRow {
  _id?: unknown;
  channel?: string;
  platform?: string;
  date?: string | Date;
  adGroupId?: string;
  customerId?: string;
  accountId?: string;
  spentAmount?: number;
  spendVnd?: number;
  costVnd?: number;
  clicks?: number;
  impressions?: number;
  conversions?: number;
  allConversions?: number;
  conversionValue?: number;
  conversionValueVnd?: number;
}

export interface AdsAutomationErpOrderItemRecord {
  productId?: unknown;
  quantity?: number;
  revenueVnd?: number;
  revenue?: number;
  grossProfitVnd?: number;
  grossProfit?: number;
  netProfitVnd?: number;
  netProfit?: number;
}

export interface AdsAutomationErpOrderRecord extends AdsAutomationSourceStampedRow {
  _id?: unknown;
  id?: unknown;
  productId?: unknown;
  items?: AdsAutomationErpOrderItemRecord[];
  quantity?: number;
  adGroupId?: string;
  supplierId?: unknown;
  orderDate?: string | Date;
  orderStatus?: string;
  isActive?: boolean;
  depositAmount?: number;
  codAmount?: number;
  manualPayment?: number;
  revenueVnd?: number;
  revenue?: number;
  grossProfit?: number;
  grossProfitVnd?: number;
  netProfit?: number;
  netProfitVnd?: number;
  advertisingCost?: number;
}

export interface AdsAutomationErpProductRecord extends AdsAutomationSourceStampedRow {
  _id?: unknown;
  productId?: unknown;
  sku?: string;
  name?: string;
  productName?: string;
  salePrice?: number;
  price?: number;
  importPrice?: number;
  shippingCost?: number;
  packagingCost?: number;
  totalCost?: number;
  minStock?: number;
  maxStock?: number;
  estimatedDeliveryDays?: number;
  status?: string;
  assumedReturnRatePercent?: number;
  images?: unknown[];
  aiDescription?: string;
  fanpageVariations?: Array<{ customPrice?: number; isActive?: boolean }>;
  suppliers?: Array<{
    supplierId?: unknown;
    price1?: number;
    price2?: number;
    price3?: number;
    appliedPrice?: number;
    appliedAt?: string | Date;
    isDefault?: boolean;
  }>;
}

export interface AdsAutomationErpInventorySummaryRecord extends AdsAutomationSourceStampedRow {
  productId?: unknown;
  onHand?: number;
  avgCost?: number;
}

export interface AdsAutomationErpSupplierQuoteRecord extends AdsAutomationSourceStampedRow {
  productId?: unknown;
  supplierId?: unknown;
  supplierName?: string;
  price?: number;
  status?: string;
  approvalStatus?: string;
  effectiveAt?: string | Date;
  leadTimeDays?: number;
  lateDeliveryRatePercent?: number;
  returnFaultRatePercent?: number;
  capacityStatus?: string;
}

export interface AdsAutomationErpSupplierPayableRecord extends AdsAutomationSourceStampedRow {
  supplierId?: unknown;
  supplierNameSnap?: string;
  status?: string;
  dueDate?: string | Date;
  items?: Array<{ productId?: unknown; quantity?: number; amount?: number }>;
  payments?: Array<{ paidAt?: string | Date; amount?: number }>;
}

export interface AdsAutomationErpSupplierRecord extends AdsAutomationSourceStampedRow {
  _id?: unknown;
  id?: unknown;
  supplierId?: unknown;
  fullName?: string;
  name?: string;
  email?: string;
  role?: string;
}

export interface AdsAutomationErpAvailableFundSnapshotRecord extends AdsAutomationSourceStampedRow {
  capturedAt?: string | Date;
  available?: number;
}

export interface AdsAutomationErpCashflowSummarySnapshotRecord extends AdsAutomationSourceStampedRow {
  domain?: string;
  windowDays?: number;
  data?: Record<string, unknown>;
}
