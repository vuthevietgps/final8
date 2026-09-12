import { businessDayRange } from '../../common/business-day';
import { allocateVnd } from '../../common/allocate-vnd';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ORDER_COST_ALLOCATED } from '../../advertising-cost/advertising-cost-refresh.module';
import { saleModeForAgentRole } from '../order-sale-mode';
import { dealerSaleAmounts } from '../dealer-sale';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TestOrder2, TestOrder2Document } from '../schemas/test-order2.schema';
import { Product, ProductDocument } from '../../product/schemas/product.schema';
import { Quote, QuoteDocument } from '../../quote/schemas/quote.schema';
import { SupplierQuote, SupplierQuoteDocument } from '../../supplier-quote/schemas/supplier-quote.schema';
import { DeliveryStatusService } from '../../delivery-status/delivery-status.service';
import { QuoteStatus } from '../../quote/quote.enum';
import {
  OrderStatus,
  PaymentStatus,
  AgentRole,
  COMPLETED_ORDER_STATUSES,
  DEFAULT_VALUES,
} from '../constants/test-order2.constants';
import {
  OrderCalculationContext,
  ProductWithCategory,
  SupplierQuoteResult,
  AgentQuoteResult,
} from '../interfaces/order-calculation.interface';

@Injectable()
export class OrderCalculationService {
  private readonly logger = new Logger(OrderCalculationService.name);
  private static readonly DEFAULT_ESTIMATED_ADS_COST = 50_000;
  private static readonly CPR_CACHE_TTL_MS = 86_400_000;

  // Cache for payment trigger statuses (refreshed on first use or when needed)
  private paymentTriggerStatusesCache: string[] | null = null;
  private returnStatusesCache: string[] | null = null;
  private readonly recalculationStates = new Map<string, {
    pending: boolean;
    promise: Promise<{ date: string; updated: number }>;
  }>();

  constructor(
    @InjectModel(TestOrder2.name) private model: Model<TestOrder2Document>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(SupplierQuote.name) private supplierQuoteModel: Model<SupplierQuoteDocument>,
    private readonly deliveryStatusService: DeliveryStatusService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly events?: EventEmitter2,
  ) {}

  private normalizeAdGroupKey(adGroupId: unknown): string | null {
    if (adGroupId === null || adGroupId === undefined) {
      return null;
    }

    const value = String(adGroupId).trim();
    if (!value || value === '0') {
      return null;
    }

    return value;
  }

  clearStatusCaches(): void {
    this.paymentTriggerStatusesCache = null;
    this.returnStatusesCache = null;
  }

  private async resolveEstimatedAdvertisingCost(adGroupId: unknown): Promise<number> {
    const adGroupKey = this.normalizeAdGroupKey(adGroupId);

    if (adGroupKey) {
      const groupEstimate = await this.cacheManager.get<number>(`cpr_estimate:${adGroupKey}`);
      if (Number(groupEstimate) > 0) {
        return Number(groupEstimate);
      }
    }

    const fallbackEstimate = await this.cacheManager.get<number>('cpr_estimate:ALL');
    if (Number(fallbackEstimate) > 0) {
      return Number(fallbackEstimate);
    }

    return OrderCalculationService.DEFAULT_ESTIMATED_ADS_COST;
  }

  private async cacheCprEstimates(
    dateStr: string,
    groupStats: Map<string, { totalCost: number; orderCount: number }>,
    overallStats: { totalCost: number; orderCount: number },
  ): Promise<void> {
    const cacheOps: Array<Promise<unknown>> = [];

    if (overallStats.orderCount > 0 && overallStats.totalCost > 0) {
      cacheOps.push(
        this.cacheManager.set(
          'cpr_estimate:ALL',
          overallStats.totalCost / overallStats.orderCount,
          OrderCalculationService.CPR_CACHE_TTL_MS,
        ),
      );
    }

    for (const [adGroupId, stats] of groupStats.entries()) {
      if (stats.orderCount <= 0 || stats.totalCost <= 0) {
        continue;
      }

      cacheOps.push(
        this.cacheManager.set(
          `cpr_estimate:${adGroupId}`,
          stats.totalCost / stats.orderCount,
          OrderCalculationService.CPR_CACHE_TTL_MS,
        ),
      );
    }

    if (cacheOps.length === 0) {
      return;
    }

    await Promise.all(cacheOps);
    this.logger.log(
      `Cached CPR estimates for ${dateStr}: ${groupStats.size} ad groups, overall orders=${overallStats.orderCount}.`,
    );
  }

  // ============ STATUS CACHE METHODS ============

  /**
   * Láº¥y danh sÃ¡ch tÃªn cÃ¡c tráº¡ng thÃ¡i trigger thanh toÃ¡n (cached)
   * Fallback vá» COMPLETED_ORDER_STATUSES náº¿u chÆ°a cÃ³ data trong DB
   */
  async getPaymentTriggerStatuses(): Promise<string[]> {
    if (this.paymentTriggerStatusesCache === null) {
      try {
        const statuses = await this.deliveryStatusService.getPaymentTriggerStatusNames();
        this.paymentTriggerStatusesCache = statuses.length > 0 ? statuses : [...COMPLETED_ORDER_STATUSES];
        this.logger.log(`Payment trigger statuses loaded: ${this.paymentTriggerStatusesCache.join(', ')}`);
      } catch (error) {
        this.logger.warn('Failed to load payment trigger statuses from DB, using fallback constants');
        this.paymentTriggerStatusesCache = [...COMPLETED_ORDER_STATUSES];
      }
    }
    return this.paymentTriggerStatusesCache;
  }

  /**
   * Láº¥y danh sÃ¡ch tÃªn cÃ¡c tráº¡ng thÃ¡i hoÃ n hÃ ng (cached)
   */
  async getReturnStatuses(): Promise<string[]> {
    if (this.returnStatusesCache === null) {
      try {
        const statuses = await this.deliveryStatusService.getReturnStatusNames();
        this.returnStatusesCache = statuses.length > 0 ? statuses : [OrderStatus.RETURNED];
        this.logger.log(`Return statuses loaded: ${this.returnStatusesCache.join(', ')}`);
      } catch (error) {
        this.logger.warn('Failed to load return statuses from DB, using fallback constants');
        this.returnStatusesCache = [OrderStatus.RETURNED];
      }
    }
    return this.returnStatusesCache;
  }

  /**
   * Kiá»ƒm tra xem tráº¡ng thÃ¡i cÃ³ pháº£i lÃ  payment trigger khÃ´ng
   */
  async isPaymentTriggerStatus(status: string | undefined | null): Promise<boolean> {
    if (!status) return false;
    const triggerStatuses = await this.getPaymentTriggerStatuses();
    return triggerStatuses.includes(status);
  }

  /**
   * Kiá»ƒm tra xem tráº¡ng thÃ¡i cÃ³ pháº£i lÃ  hoÃ n hÃ ng khÃ´ng
   */
  async isReturnStatus(status: string | undefined | null): Promise<boolean> {
    if (!status) return false;
    const returnStatuses = await this.getReturnStatuses();
    return returnStatuses.includes(status);
  }

  async resolveCanonicalReturnStatus(): Promise<string> {
    const returnStatuses = await this.getReturnStatuses();
    return returnStatuses.find((name) => name === OrderStatus.RETURNED) ?? returnStatuses[0] ?? OrderStatus.RETURNED;
  }

  private async resolveAgentRole(agentId: unknown): Promise<string | undefined> {
    if (!agentId) return undefined;

    let normalizedId: Types.ObjectId;
    if (agentId instanceof Types.ObjectId) {
      normalizedId = agentId;
    } else {
      const raw = String(agentId);
      if (!Types.ObjectId.isValid(raw)) {
        return undefined;
      }
      normalizedId = new Types.ObjectId(raw);
    }

    const agent = await this.model.db.collection('users').findOne(
      { _id: normalizedId },
      { projection: { role: 1 } },
    );

    return typeof agent?.role === 'string' ? agent.role : undefined;
  }

  async classifySaleMode(order: OrderCalculationContext): Promise<'retail' | 'dealer'> {
    if (!order.agentId) {
      order.saleMode = 'retail';
      order.agentRoleSnapshot = undefined;
      return 'retail';
    }
    if (order.saleMode && order.agentRoleSnapshot) return order.saleMode;
    // Small isolated unit tests and old compiled callers may not provide a
    // Mongoose connection. Production paths must resolve a real agent role.
    const canResolveRole = Boolean((this.model as any)?.db?.collection);
    const role = canResolveRole ? await this.resolveAgentRole(order.agentId) : undefined;
    if (canResolveRole && role !== AgentRole.INTERNAL && role !== AgentRole.EXTERNAL) {
      throw new BadRequestException('Đơn chỉ được gắn nhân sự nội bộ hoặc đại lý ngoài hợp lệ.');
    }
    if (role === AgentRole.INTERNAL || role === AgentRole.EXTERNAL) {
      order.agentRoleSnapshot = role;
    }
    order.saleMode = saleModeForAgentRole(order.agentId, role);
    return order.saleMode;
  }

  private syncRealizedProfitSnapshot(order: TestOrder2Document): void {
    const supplierPaid = order.supplierPaymentStatus === PaymentStatus.PAID;
    const agentPaidOrNA =
      order.agentPaymentStatus === PaymentStatus.PAID ||
      order.agentPaymentStatus === PaymentStatus.NOT_APPLICABLE;

    if (!supplierPaid || !agentPaidOrNA) {
      order.realizedGrossProfit = undefined;
      order.realizedNetProfit = undefined;
      order.realizedAt = undefined;
      return;
    }

    const advertisingCost = order.advertisingCost || 0;
    const laborCost = order.laborCostAllocation || 0;
    const otherCost = order.otherCostAllocation || 0;

    order.realizedGrossProfit = (order.supplierPaidAmount || 0) - (order.agentPaidAmount || 0);
    order.realizedNetProfit = order.realizedGrossProfit - advertisingCost - laborCost - otherCost;
    order.realizedAt = order.realizedAt || new Date();
  }

  private calculateGrossProfitWithResolvedState(
    order: TestOrder2Document,
    isCompleted: boolean,
    isReturn: boolean,
  ): number {
    const quantity = order.quantity || 1;
    const shippingFee = order.shippingFee || 0;
    const returnFee = order.shipments?.length ? (order.returnFee || 0) : isReturn ? (order.returnFee || 0) : 0;
    const stockSource = ['inventory', 'dealer_custody'].includes(order.productSource || '');
    const supplierPrice = stockSource ? Number(order.inventoryUnitCostSnapshot || 0) : (order.supplierQuoteId || order.supplierQuoteSnapshotAt)
      ? (order.supplierAppliedPrice ?? order.supplierQuote ?? 0) : (order.supplierQuote ?? 0);
    // The company owes the supplier the goods price even on a failed retail delivery.
    const supplierCost = Math.round(supplierPrice * quantity);
    order.supplierContractAmount = (stockSource || order.productionStatus !== 'Đã trả kết quả' ? 0 : supplierCost)
      + Number(order.supplierFreightObligation ?? (stockSource || !order.trackingNumber ? 0 : shippingFee + returnFee));
    if (!isCompleted) {
      order.recognizedRevenue = 0;
      order.recognizedGoodsCost = 0;
      order.retailProfitState = 'awaiting_delivery';
      // Dispatch incurs freight/packaging before the retail sale is recognized.
      // Quoted fees on an unshipped draft are not incurred expenses.
      const dispatched = order.shipments?.some(s => s.status !== 'preparing');
      return dispatched ? -shippingFee - returnFee - (order.packagingCostSnapshot || 0) * quantity : 0;
    }
    const deliveredQuantity = order.deliveredQuantity ?? (isReturn ? 0 : quantity);
    order.recognizedRevenue = Math.round((order.retailSaleAmount ?? 0) * deliveredQuantity / quantity);
    // A confirmed receipt of company-owned stock recovers an asset, not the supplier debt.
    const recovery = Math.min(supplierCost, Number(order.recoveredInventoryValue || 0));
    order.recognizedGoodsCost = Math.round(supplierCost - recovery);
    // A completed legacy delivery also proves that the supplier fulfilled the goods.
    order.supplierContractAmount = (stockSource ? 0 : supplierCost)
      + Number(order.supplierFreightObligation ?? (stockSource ? 0 : shippingFee + returnFee));
    order.retailProfitState = !(stockSource ? order.inventoryUnitCostSnapshot != null : order.supplierQuoteId)
      ? 'missing_quotes' : !isReturn && order.retailSaleAmount == null ? 'missing_sale_price' : 'recognized';
    return order.recognizedRevenue - order.recognizedGoodsCost - shippingFee - returnFee
      - (order.packagingCostSnapshot || 0) * quantity;
  }

  async applyCompletedStatusFinancials(order: TestOrder2Document): Promise<void> {
    // Operational events calculate obligations/profit only. Receipts and payments
    // remain immutable evidence in the business ledger, regardless of delivery.
    order.grossProfit = await this.calculateGrossProfit(order);
    await this.calculateCostAllocations(order);
  }

  // ============ QUOTE CALCULATION METHODS ============

  /**
   * Auto-calculate quote-related fields from various sources
   * Orchestrates calculation of: productType, supplierQuote, shippingFee, returnFee, agentQuote
   */
  async autoCalculateQuoteFields(doc: OrderCalculationContext): Promise<void> {
    try {
      await this.calculateProductType(doc);
      await this.calculateSupplierQuote(doc);
      await this.calculateShippingAndReturnFees(doc);
      await this.calculateAgentQuote(doc);

      // âœ… FIX BUG: Äá»©t gÃ£y Auto-Trigger
      // PHáº¢I tÃ­nh Lá»£i nhuáº­n gá»™p (grossProfit) trÆ°á»›c khi phÃ¢n bá»• chi phÃ­,
      // vÃ¬ hÃ m calculateCostAllocations cáº§n grossProfit Ä‘á»ƒ tÃ­nh toÃ¡n Net Profit.
      doc.grossProfit = await this.calculateGrossProfit(doc as any);

      await this.calculateCostAllocations(doc);
    } catch (error) {
      this.logger.error('Failed to auto-calculate quote fields', {
        orderId: doc._id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate product type from Product.category.name
   */
  private async calculateProductType(doc: OrderCalculationContext): Promise<void> {
    if (!doc.productId) return;

    const product = await this.productModel.findById(doc.productId)
      .populate('categoryId', 'name code')
      .lean<ProductWithCategory>();

    const category = product?.categoryId;
    if (!doc.productCategoryIdSnapshot && category?._id)
      doc.productCategoryIdSnapshot = category._id;
    if (!doc.productCategoryNameSnapshot && category?.name)
      doc.productCategoryNameSnapshot = category.name;
    if (!doc.productCategoryCodeSnapshot && category?.code)
      doc.productCategoryCodeSnapshot = category.code;
    if (doc.productCategoryNameSnapshot)
      doc.productType = doc.productCategoryNameSnapshot;
  }

  /**
   * Calculate supplier quote from supplierAppliedPrice or Product data
   *
   * SNAPSHOT IMMUTABILITY RULE:
   * - Náº¿u Ä‘Ã£ cÃ³ supplierQuoteId (Ä‘Ã£ snapshot) â†’ KHÃ”NG BAO GIá»œ thay Ä‘á»•i
   * - Chá»‰ fetch quote má»›i khi:
   *   1. ChÆ°a cÃ³ snapshot (Ä‘Æ¡n hÃ ng má»›i)
   *   2. Snapshot Ä‘Ã£ bá»‹ clear (do Ä‘á»•i NCC/sáº£n pháº©m)
   *
   * Priority: supplierQuoteId (snapshot) > supplierAppliedPrice > SupplierQuote DB > Product.importPrice
   */
  private quoteReference(value: unknown): { $in: unknown[] } {
    const id = String(value);
    return { $in: Types.ObjectId.isValid(id) ? [id, new Types.ObjectId(id)] : [id] };
  }

  private async calculateSupplierQuote(doc: OrderCalculationContext): Promise<void> {
    if (doc.productSource === 'inventory' || doc.productSource === 'dealer_custody') {
      doc.supplierQuote = doc.inventoryUnitCostSnapshot ?? 0;
      doc.supplierPriceSource = 'inventory';
      return;
    }
    // A timestamp also identifies a product-cost snapshot without a quote ID.
    const committed = Boolean(doc.realizedAt || (doc as any).trackingNumber || (doc as any).shipments?.length)
      || await this.isPaymentTriggerStatus(doc.orderStatus) || await this.isReturnStatus(doc.orderStatus);
    if (doc.supplierQuoteId || (doc.supplierQuoteSnapshotAt && (doc.supplierPriceSource !== 'product_fallback' || committed))) {
      doc.supplierQuote = doc.supplierAppliedPrice ?? doc.supplierQuote ?? 0;
      return;
    }
    if (!doc.productId) return;
    const product = await this.productModel.findById(doc.productId).lean<ProductWithCategory>();
    const at = doc.orderDate || new Date();
    const quote = doc.supplierId ? await this.supplierQuoteModel.findOne({
      productId: this.quoteReference(doc.productId),
      supplierId: this.quoteReference(doc.supplierId),
      approvalStatus: 'approved',
      $or: [{ effectiveAt: { $lte: at } }, { effectiveAt: { $exists: false }, createdAt: { $lte: at } }],
    }).sort({ effectiveAt: -1, createdAt: -1, _id: -1 }).lean<SupplierQuoteResult>() : null;
    if (quote && (quote.currency || 'VND').toUpperCase() !== 'VND') {
      throw new BadRequestException('Supplier quote currency must be VND before applying to this order');
    }
    if (!quote && !product) return;
    doc.supplierQuoteId = quote?._id;
    doc.supplierAppliedPrice = quote ? (quote.price ?? 0) : (product?.importPrice ?? 0);
    doc.supplierQuote = doc.supplierAppliedPrice;
    doc.supplierQuoteSnapshotAt = new Date();
    doc.supplierQuoteEffectiveAt = quote?.effectiveAt;
    doc.supplierPriceSource = quote ? 'supplier_quote' : 'product_fallback';
    doc.supplierShippingFeeSnapshot = quote?.shippingFee ?? product?.shippingCost ?? 0;
    // Packaging is not a return fee. Keep its own unit-cost snapshot.
    doc.packagingCostSnapshot = product?.packagingCost ?? 0;
    doc.resalePolicySnapshot = product?.resalePolicy || 'inspect';
    doc.supplierReturnFeeSnapshot = quote?.returnFee ?? 0;
    doc.supplierIsReturnableSnapshot = quote?.isReturnableOverride ?? product?.isReturnable ?? true;
  }

  /**
   * Calculate shipping and return fees with fallback chain
   * Priority: Snapshot tá»« supplierQuote > SupplierQuote DB > Product costs
   */
  private async calculateShippingAndReturnFees(doc: OrderCalculationContext): Promise<void> {
    // Zero is an explicit amount, never a signal to consult a newer price list.
    doc.shippingFee ??= doc.supplierShippingFeeSnapshot ?? 0;
    doc.returnFee ??= doc.supplierReturnFeeSnapshot ?? 0;
  }

  /**
   * Calculate agent quote from Quote table
   *
   * SNAPSHOT IMMUTABILITY RULE (tÆ°Æ¡ng tá»± supplierQuote):
   * - Náº¿u Ä‘Ã£ cÃ³ agentQuoteId (Ä‘Ã£ snapshot) â†’ KHÃ”NG BAO GIá»œ thay Ä‘á»•i
   * - Chá»‰ fetch quote má»›i khi chÆ°a cÃ³ snapshot hoáº·c Ä‘Ã£ bá»‹ clear
   *
   * Priority: agentQuoteId (snapshot) > agentAppliedPrice > Quote DB
   */
  private async calculateAgentQuote(doc: OrderCalculationContext): Promise<void> {
    if ((await this.classifySaleMode(doc)) !== 'dealer') return;
    // RULE 1: ÄÃ£ cÃ³ snapshot â†’ KHÃ”NG tÃ­nh láº¡i
    if ((doc.agentQuoteId || doc.agentQuoteSnapshotAt) && doc.agentAppliedPrice != null) {
      doc.agentQuote = doc.agentAppliedPrice;
      this.logger.debug(`Order has existing agent quote snapshot ${doc.agentQuoteId} - keeping price ${doc.agentAppliedPrice}`);
      return;
    }

    // RULE 2: CÃ³ giÃ¡ manual (khÃ´ng qua quote) â†’ giá»¯ nguyÃªn
    if (doc.agentAppliedPrice && doc.agentAppliedPrice > 0 && !doc.agentId) {
      doc.agentQuote = doc.agentAppliedPrice;
      return;
    }

    if (!doc.productId || !doc.agentId) return;

    // RULE 3: ChÆ°a cÃ³ snapshot â†’ Fetch tá»« Quote DB
    const orderDate = doc.orderDate || new Date();
    const productId = String(doc.productId);
    const agentId = String(doc.agentId);

    const quote = await this.quoteModel
      .findOne({
        productId: this.quoteReference(productId),
        agentId: this.quoteReference(agentId),
        // Quote module stores Vietnamese approval states, not an English "active" flag.
        status: QuoteStatus.APPROVED,
        validFrom: { $lte: orderDate },
        validUntil: { $gte: orderDate },
        isActive: { $ne: false },
      })
      .sort({ validFrom: -1, createdAt: -1, _id: -1 })
      .lean<AgentQuoteResult>();

    if (quote && quote.unitPrice != null) {
      doc.agentQuoteId = quote._id?.toString();
      doc.agentAppliedPrice = quote.unitPrice;
      doc.agentQuoteSnapshotAt = new Date();
      doc.agentQuoteEffectiveAt = quote.validFrom;
      doc.agentQuote = quote.unitPrice;
      doc.dealerShippingFeeSnapshot = quote.shippingFee;
      doc.dealerReturnFeeSnapshot = quote.returnFee;

      // P1 FIX: BIWEEKLY PAYMENT DUE DATE
      const payDays = [1, 15];
      const MIN_BUFFER_DAYS = 7;

      const d = new Date(orderDate);
      const currentMonth = d.getMonth();
      const currentYear = d.getFullYear();

      const minDueDate = new Date(d);
      minDueDate.setDate(minDueDate.getDate() + MIN_BUFFER_DAYS);

      let dueDate: Date | null = null;

      // TÃ¬m trong thÃ¡ng hiá»‡n táº¡i
      for (const payDay of payDays) {
        const candidateDate = new Date(currentYear, currentMonth, payDay);
        if (candidateDate >= minDueDate) {
          dueDate = candidateDate;
          break;
        }
      }

      // Náº¿u khÃ´ng tÃ¬m tháº¥y trong thÃ¡ng nÃ y, tÃ¬m thÃ¡ng sau
      if (!dueDate) {
        for (const payDay of payDays) {
          const candidateDate = new Date(currentYear, currentMonth + 1, payDay);
          if (candidateDate >= minDueDate) {
            dueDate = candidateDate;
            break;
          }
        }
      }

      // Fallback: thÃ¡ng sau + 1 náº¿u váº«n khÃ´ng tÃ¬m tháº¥y
      if (!dueDate) {
        dueDate = new Date(currentYear, currentMonth + 2, payDays[0]);
      }

      doc.agentPaymentDueDate = dueDate;

      this.logger.log(`SNAPSHOT: Order applied AgentQuote ${doc.agentQuoteId} with price ${doc.agentAppliedPrice} at ${doc.agentQuoteSnapshotAt}, due ${doc.agentPaymentDueDate.toISOString()}`);
    }
  }

  // ============ COST ALLOCATION METHODS ============

  /**
   * Calculate cost allocations and net profit for the order
   *
   * Cost allocations:
   * 1. Advertising Cost = (Total ad cost for adGroupId on date / Total quantity for adGroupId on date) Ã— order quantity
   * 2. Labor Cost = (Total labor cost on date / Total quantity of all orders on date) Ã— order quantity
   * 3. Other Cost = (Total other cost on date / Total quantity of all orders on date) Ã— order quantity
   * 4. Net Profit = Gross Profit - Advertising Cost - Labor Cost - Other Cost
   */
  async calculateCostAllocations(doc: OrderCalculationContext): Promise<void> {
    // Ordinary edits retain the latest allocation already recorded on the order.
    // Only the dated allocation service may replace it from source cost records.
    doc.advertisingCost ??= await this.resolveEstimatedAdvertisingCost(doc.adGroupId);
    doc.laborCostAllocation ??= 0;
    doc.otherCostAllocation ??= 0;
    doc.netProfit = Number(doc.grossProfit || 0) - doc.advertisingCost
      - doc.laborCostAllocation - doc.otherCostAllocation;
  }

  // ============ PROFIT CALCULATION METHODS ============

  /** Retail follows delivery; dealer sales persist after dispatch and customer return. */
  async calculateGrossProfit(order: TestOrder2Document): Promise<number> {
    if ((await this.classifySaleMode(order)) === 'dealer') {
      const isReturn = await this.isReturnStatus(order.orderStatus);
      order.retailProfitState = undefined;
      const amounts = dealerSaleAmounts(order, isReturn);
      if (amounts.dispatched) order.dealerSaleRecognizedAt ??= new Date();
      if (amounts.dispatched && isReturn) order.dealerReturnedAt ??= new Date();
      order.dealerProfitState = amounts.state;
      order.agentCommissionAmount = 0;
      order.goodsOwner = amounts.dispatched ? 'dealer' : undefined;
      order.returnDisposition = amounts.dispatched && isReturn ? 'dealer_custody' : undefined;
      order.recognizedRevenue = amounts.revenue;
      order.recognizedGoodsCost = amounts.goodsCost;
      order.dealerRecoverableFees = amounts.recoverableFees;
      order.dealerReturnFeeReceivable = amounts.returnFeeReceivable;
      order.dealerContractAmount = amounts.contractAmount;
      order.supplierContractAmount = amounts.supplierContractAmount;
      return amounts.grossProfit;
    }

    order.dealerProfitState = undefined;
    order.goodsOwner = undefined;
    order.returnDisposition = undefined;
    order.dealerRecoverableFees = undefined;
    order.dealerReturnFeeReceivable = undefined;
    order.dealerContractAmount = undefined;

    const isReturn = await this.isReturnStatus(order.orderStatus);
    const isCompleted = isReturn || order.orderStatus === OrderStatus.DELIVERED || order.orderStatus === 'Giao một phần';
    return this.calculateGrossProfitWithResolvedState(order, isCompleted, isReturn);
  }

  /** Dealers buy goods from us; their resale margin is not a commission expense. */
  async calculateAgentCommission(order: TestOrder2Document): Promise<number> {
    // Dealer resale margin belongs to the dealer; it is not our commission cost.
    return 0;
  }

  /**
   * Calculate net profit for an order
   * CÃ´ng thá»©c: Gross Profit - Chi phÃ­ QC - Chi phÃ­ nhÃ¢n cÃ´ng - Chi phÃ­ khÃ¡c
   */
  async calculateNetProfit(order: TestOrder2Document): Promise<number> {
    const grossProfit = await this.calculateGrossProfit(order);
    const advertisingCost = order.advertisingCost || 0;
    const laborCost = order.laborCostAllocation || 0;
    const otherCost = order.otherCostAllocation || 0;

    return grossProfit - advertisingCost - laborCost - otherCost;
  }

  /**
   * Calculate realized profit when both supplier and agent payments are confirmed
   */
  async calculateRealizedProfitIfReady(_order: TestOrder2Document): Promise<void> {
    // Legacy paid flags cannot establish cash or realized profit. Confirmed
    // account transactions are reported by the business ledger.
  }

  // ============ RECALCULATION METHODS ============

  /**
   * Recalculate cost allocations for all orders on a specific date
   * Called when advertising cost data is updated to ensure accurate cost distribution
   */
  private async executeRecalculateOrdersForDate(orderDate: Date | string): Promise<{ date: string; updated: number }> {
    try {
      const dateObj = typeof orderDate === 'string' ? new Date(orderDate) : orderDate;
      const { start: startOfDay, end: endOfDay, day: dateStr } = businessDayRange(dateObj);

      // Chá»‰ láº¥y cÃ¡c field cáº§n thiáº¿t, dÃ¹ng lean() Ä‘á»ƒ giáº£m memory (khÃ´ng cáº§n .save())
      const orders = await this.model
        .find({ orderDate: { $gte: startOfDay, $lte: endOfDay }, isActive: { $ne: false } })
        .select('_id quantity adGroupId grossProfit realizedGrossProfit realizedNetProfit')
        .lean();

      if (orders.length === 0) {
        this.logger.log(`No orders to recalculate for date ${dateStr}`);
        await this.events?.emitAsync(ORDER_COST_ALLOCATED, { day: dateStr });
        return { date: dateStr, updated: 0 };
      }

      this.logger.log(`Recalculating ${orders.length} orders for date ${dateStr}`);

      // =====================================================
      // BÆ¯á»šC 1: Tá»•ng sá»‘ lÆ°á»£ng toÃ n ngÃ y (1 aggregate duy nháº¥t)
      // =====================================================
      const totalQuantityResult = await this.model.aggregate([
        {
          $match: {
            orderDate: { $gte: startOfDay, $lte: endOfDay },
            isActive: { $ne: false },
          },
        },
        { $group: { _id: null, totalQuantity: { $sum: '$quantity' } } },
      ]).exec();
      const totalDailyQuantity =
        totalQuantityResult.length > 0 ? totalQuantityResult[0].totalQuantity : 0;

      // =====================================================
      // BÆ¯á»šC 2: Chi phÃ­ nhÃ¢n cÃ´ng & váº­n hÃ nh / item (2 aggregates)
      // =====================================================
      let dailyLaborCostPerItem = 0;
      let dailyOtherCostPerItem = 0;

      if (totalDailyQuantity > 0) {
        const laborCostResult = await this.model.db
          .collection('laborcost1')
          .aggregate([
            { $match: { date: { $gte: startOfDay, $lte: endOfDay } } },
            // Match the ledger: round each nonnegative source row to VND before summing.
            { $group: { _id: null, totalCost: { $sum: { $floor: { $add: ['$cost', 0.5] } } } } },
          ])
          .toArray();
        dailyLaborCostPerItem =
          (laborCostResult.length > 0 ? laborCostResult[0].totalCost : 0) / totalDailyQuantity;

        const otherCostResult = await this.model.db
          .collection('othercosts')
          .aggregate([
            { $match: { date: { $gte: startOfDay, $lte: endOfDay } } },
            { $group: { _id: null, totalCost: { $sum: { $floor: { $add: ['$amount', 0.5] } } } } },
          ])
          .toArray();
        dailyOtherCostPerItem =
          (otherCostResult.length > 0 ? otherCostResult[0].totalCost : 0) / totalDailyQuantity;
      }

      // =====================================================
      // BÆ¯á»šC 3: Chi phÃ­ Ads & sá»‘ lÆ°á»£ng theo adGroup (2 aggregates)
      // =====================================================
      const adCostsResult = await this.model.db
        .collection('advertisingcosts')
        .aggregate([
          { $match: { date: { $gte: startOfDay, $lte: endOfDay } } },
          { $group: { _id: '$adGroupId', totalCost: { $sum: '$spentAmount' },
            estimatedRows: { $sum: { $cond: ['$isEstimated', 1, 0] } },
            identities: { $addToSet: { channel: '$channel', customerId: '$customerId' } },
          } },
        ])
        .toArray();
      const adCostMap = new Map<string, number>(
        adCostsResult.map((item) => [String(item._id), item.totalCost]),
      );
      if (adCostsResult.some(item => item.identities?.length > 1)) {
        throw new BadRequestException('Trùng adGroupId giữa nhiều tài khoản; cần chuẩn hóa trước khi phân bổ.');
      }
      const estimatedGroups = new Set(adCostsResult.filter(item => item.estimatedRows > 0).map(item => String(item._id)));

      const adGroupQuantityResult = await this.model
        .aggregate([
          {
            $match: {
              orderDate: { $gte: startOfDay, $lte: endOfDay },
              isActive: { $ne: false },
            },
          },
          { $group: { _id: '$adGroupId', totalQuantity: { $sum: '$quantity' } } },
        ])
        .exec();
      const adGroupQuantityMap = new Map<string, number>(
        adGroupQuantityResult.map((item) => [String(item._id), item.totalQuantity]),
      );

      // =====================================================
      // BÆ¯á»šC 4: PhÃ¢n bá»• chi phÃ­ & BulkWrite 1 láº§n duy nháº¥t
      // =====================================================
      orders.sort((a,b) => String(a._id).localeCompare(String(b._id)));
      const laborAmounts = allocateVnd(Math.round(dailyLaborCostPerItem * totalDailyQuantity), orders.map(o => Number(o.quantity || 0)));
      const otherAmounts = allocateVnd(Math.round(dailyOtherCostPerItem * totalDailyQuantity), orders.map(o => Number(o.quantity || 0)));
      const advertisingAmounts = new Map<string, number>();
      for (const [key, cost] of adCostMap) {
        const targets = orders.filter(o => this.normalizeAdGroupKey(o.adGroupId) === key);
        const amounts = allocateVnd(Math.round(cost), targets.map(o => Number(o.quantity || 0)));
        targets.forEach((o,i) => advertisingAmounts.set(String(o._id), amounts[i]));
      }
      // Spend without matching orders remains visible on the ad group; never charge unrelated orders.
      const orphanCostPerOrder = 0;

      const bulkOps: any[] = [];
      const groupCprStats = new Map<string, { totalCost: number; orderCount: number }>();
      const overallCprStats = { totalCost: 0, orderCount: 0 };

      for (const order of orders) {
        const quantity = Number(order.quantity || 0);

        const advertisingCost = advertisingAmounts.get(String(order._id)) || 0;
        const adGroupKey = this.normalizeAdGroupKey(order.adGroupId);
        const index = orders.indexOf(order);
        const laborCostAllocation = laborAmounts[index];
        const otherCostAllocation = otherAmounts[index];
        const grossProfit = Number(order.grossProfit || 0);
        const netProfit = grossProfit - advertisingCost - laborCostAllocation - otherCostAllocation;

        if (advertisingCost > 0) {
          overallCprStats.totalCost += advertisingCost;
          overallCprStats.orderCount += 1;

          if (adGroupKey) {
            const stats = groupCprStats.get(adGroupKey) || { totalCost: 0, orderCount: 0 };
            stats.totalCost += advertisingCost;
            stats.orderCount += 1;
            groupCprStats.set(adGroupKey, stats);
          }
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: order._id },
            update: { $set: { advertisingCost, laborCostAllocation, otherCostAllocation, netProfit,
              advertisingCostEstimated: estimatedGroups.has(String(order.adGroupId)),
              ...(typeof order.realizedGrossProfit === 'number' ? {
                realizedNetProfit: order.realizedGrossProfit - advertisingCost - laborCostAllocation - otherCostAllocation,
              } : {}),
              costAllocatedAt: new Date(), costAllocationDate: startOfDay } },
          },
        });
      }

      if (bulkOps.length > 0) {
        await this.model.bulkWrite(bulkOps);
        await this.cacheCprEstimates(dateStr, groupCprStats, overallCprStats);
      }

      const updated = bulkOps.length;
      await this.events?.emitAsync(ORDER_COST_ALLOCATED, { day: dateStr });
      this.logger.log(
        `âœ… Bulk updated ${updated} orders for date ${dateStr}` +
        ` (Labor/item=${dailyLaborCostPerItem.toFixed(0)}, Other/item=${dailyOtherCostPerItem.toFixed(0)}, Orphan/order=${orphanCostPerOrder.toFixed(0)})`,
      );
      return { date: dateStr, updated };
    } catch (error) {
      this.logger.error('Failed to recalculate orders for date', {
        date: orderDate,
        error: error.message
      });
      throw error;
    }
  }

  async recalculateOrdersForDate(orderDate: Date | string): Promise<{ date: string; updated: number }> {
    const normalizedDate = typeof orderDate === 'string' ? new Date(orderDate) : orderDate;
    const dateKey =
      typeof orderDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(orderDate)
        ? orderDate.slice(0, 10)
        : normalizedDate.toISOString().split('T')[0];

    const existing = this.recalculationStates.get(dateKey);
    if (existing) {
      existing.pending = true;
      this.logger.debug(`Joined in-flight order recalculation for ${dateKey}`);
      return existing.promise;
    }

    const state = {
      pending: false,
      promise: Promise.resolve({ date: dateKey, updated: 0 }),
    };

    state.promise = (async () => {
      let latestResult = { date: dateKey, updated: 0 };
      try {
        do {
          state.pending = false;
          latestResult = await this.executeRecalculateOrdersForDate(dateKey);
        } while (state.pending);
        return latestResult;
      } finally {
        this.recalculationStates.delete(dateKey);
      }
    })();

    this.recalculationStates.set(dateKey, state);
    return state.promise;
  }
}
