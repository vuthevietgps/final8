import { Inject, Injectable, Logger } from '@nestjs/common';
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
    isPaymentTrigger: boolean,
    isReturn: boolean,
    agentRole?: string,
  ): number {
    if (!isPaymentTrigger) {
      return 0;
    }

    const quantity = order.quantity || 1;
    const shippingFee = order.shippingFee || 0;
    const returnFee = order.returnFee || 0;
    const supplierQuote = order.supplierQuote || 0;
    const agentQuote = order.agentQuote || 0;
    const isReturnable = order.supplierIsReturnableSnapshot ?? true;
    const supplierCost = (isReturn && isReturnable) ? 0 : (supplierQuote * quantity);
    const isExternalAgent = agentRole === AgentRole.EXTERNAL;
    const effectiveCod = isReturn ? 0 : (order.codAmount || 0);

    let agentCommission = 0;
    if (isExternalAgent) {
      agentCommission = order.agentCommissionAmount ?? (effectiveCod - (agentQuote * quantity));
    }

    return effectiveCod - supplierCost - shippingFee - returnFee - agentCommission;
  }

  async applyCompletedStatusFinancials(order: TestOrder2Document): Promise<void> {
    const currentStatus = order.orderStatus;
    const isPaymentTrigger = await this.isPaymentTriggerStatus(currentStatus);
    if (!isPaymentTrigger) {
      return;
    }

    const isReturn = await this.isReturnStatus(currentStatus);

    if (isReturn) {
      order.codCollectedBySupplier = 0;
    } else {
      const currentCollected = Number(order.codCollectedBySupplier);
      if (!Number.isFinite(currentCollected) || currentCollected <= 0) {
        order.codCollectedBySupplier = Number(order.codAmount || DEFAULT_VALUES.COD_AMOUNT);
      }
    }

    if (order.supplierId) {
      const codAmount = order.codAmount || 0;
      const supplierQuote = order.supplierQuote || 0;
      const quantity = order.quantity || 1;
      const shippingFee = order.shippingFee || 0;
      const returnFee = order.returnFee || 0;
      const isReturnable = order.supplierIsReturnableSnapshot ?? true;

      if (isReturn) {
        const supplierCostOnReturn = isReturnable ? 0 : (supplierQuote * quantity);
        order.supplierPaidAmount = 0 - supplierCostOnReturn - shippingFee - returnFee;
      } else {
        order.supplierPaidAmount = codAmount - (supplierQuote * quantity) - shippingFee;
      }

      if (order.supplierPaymentStatus !== PaymentStatus.PAID) {
        order.supplierPaymentStatus = PaymentStatus.PENDING;
      }
    }

    const agentRole = order.agentId ? await this.resolveAgentRole(order.agentId) : undefined;

    if (order.agentId) {
      const isExternalAgent = agentRole === AgentRole.EXTERNAL;

      if (isExternalAgent) {
        const codAmount = order.codAmount || 0;
        const agentQuote = order.agentQuote || 0;
        const quantity = order.quantity || 1;
        const commission = isReturn
          ? 0 - (agentQuote * quantity)
          : codAmount - (agentQuote * quantity);

        order.agentCommissionAmount = commission;
        order.agentPaidAmount = commission;

        if (order.agentPaymentStatus !== PaymentStatus.PAID) {
          order.agentPaymentStatus = PaymentStatus.PENDING;
        }

        if (!order.agentEligibleAt) {
          order.agentEligibleAt = new Date();
          order.agentCommissionFinal = order.agentPaidAmount;
        }
      } else {
        order.agentCommissionAmount = 0;
        order.agentPaidAmount = 0;
        order.agentPaymentStatus = PaymentStatus.NOT_APPLICABLE;
      }
    } else {
      order.agentCommissionAmount = 0;
      order.agentPaidAmount = 0;
      order.agentPaymentStatus = PaymentStatus.NOT_APPLICABLE;
    }

    order.grossProfit = this.calculateGrossProfitWithResolvedState(order, isPaymentTrigger, isReturn, agentRole);
    order.netProfit = order.grossProfit - (order.advertisingCost || 0) - (order.laborCostAllocation || 0) - (order.otherCostAllocation || 0);
    this.syncRealizedProfitSnapshot(order);
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
    }
  }

  /**
   * Calculate product type from Product.category.name
   */
  private async calculateProductType(doc: OrderCalculationContext): Promise<void> {
    if (!doc.productId) return;

    const product = await this.productModel.findById(doc.productId)
      .populate('categoryId', 'name')
      .lean<ProductWithCategory>();

    if (product?.categoryId?.name) {
      doc.productType = product.categoryId.name;
    }
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
  private async calculateSupplierQuote(doc: OrderCalculationContext): Promise<void> {
    // RULE 1: ÄÃ£ cÃ³ snapshot â†’ KHÃ”NG tÃ­nh láº¡i
    if (doc.supplierQuoteId) {
      if (doc.supplierAppliedPrice && doc.supplierAppliedPrice > 0) {
        doc.supplierQuote = doc.supplierAppliedPrice;
      }
      this.logger.debug(`Order has existing quote snapshot ${doc.supplierQuoteId} - keeping price ${doc.supplierAppliedPrice}`);
      return;
    }

    // RULE 2: CÃ³ giÃ¡ manual (khÃ´ng qua quote) â†’ giá»¯ nguyÃªn
    if (doc.supplierAppliedPrice && doc.supplierAppliedPrice > 0 && !doc.supplierId) {
      doc.supplierQuote = doc.supplierAppliedPrice;
      return;
    }

    if (!doc.productId) return;

    // RULE 3: ChÆ°a cÃ³ snapshot â†’ Fetch tá»« SupplierQuote
    if (doc.supplierId) {
      const orderDate = doc.orderDate || new Date();

      const supplierQuote = await this.supplierQuoteModel.findOne({
        productId: doc.productId,
        supplierId: doc.supplierId,
        approvalStatus: 'approved',
        $or: [
          { effectiveAt: { $lte: orderDate } },
          { effectiveAt: { $exists: false } },
        ],
      }).sort({ effectiveAt: -1, createdAt: -1 }).lean<SupplierQuoteResult>();

      if (supplierQuote) {
        // LÆ°u snapshot - SAU ÄÃ“ KHÃ”NG BAO GIá»œ THAY Äá»”I
        doc.supplierQuoteId = supplierQuote._id;
        doc.supplierAppliedPrice = supplierQuote.price || 0;
        doc.supplierQuoteSnapshotAt = new Date();
        doc.supplierShippingFeeSnapshot = supplierQuote.shippingFee;
        doc.supplierReturnFeeSnapshot = supplierQuote.returnFee;
        // Snapshot chÃ­nh sÃ¡ch hoÃ n: Æ°u tiÃªn isReturnableOverride tá»« quote NCC, fallback true
        doc.supplierIsReturnableSnapshot = supplierQuote.isReturnableOverride ?? true;
        doc.supplierQuote = doc.supplierAppliedPrice;

        this.logger.log(`SNAPSHOT: Order applied SupplierQuote ${supplierQuote._id} with price ${doc.supplierAppliedPrice} at ${doc.supplierQuoteSnapshotAt}`);
        return;
      }
    }

    // RULE 4: Fallback tá»« Product (khÃ´ng cÃ³ quote)
    const product = await this.productModel.findById(doc.productId).lean<ProductWithCategory>();
    if (product) {
      doc.supplierQuote = (product.importPrice || 0) + (product.shippingCost || 0);
      this.logger.debug(`Fallback to Product importPrice: ${doc.supplierQuote}`);
    }
  }

  /**
   * Calculate shipping and return fees with fallback chain
   * Priority: Snapshot tá»« supplierQuote > SupplierQuote DB > Product costs
   */
  private async calculateShippingAndReturnFees(doc: OrderCalculationContext): Promise<void> {
    if (!doc.productId) return;

    // Æ¯u tiÃªn 1: DÃ¹ng snapshot tá»« supplierQuote náº¿u Ä‘Ã£ cÃ³
    if (doc.supplierShippingFeeSnapshot !== undefined && (!doc.shippingFee || doc.shippingFee === 0)) {
      doc.shippingFee = doc.supplierShippingFeeSnapshot || DEFAULT_VALUES.SHIPPING_FEE;
    }
    if (doc.supplierReturnFeeSnapshot !== undefined && (!doc.returnFee || doc.returnFee === 0)) {
      doc.returnFee = doc.supplierReturnFeeSnapshot || DEFAULT_VALUES.RETURN_FEE;
    }

    // Æ¯u tiÃªn 2: Fetch tá»« SupplierQuote náº¿u chÆ°a cÃ³ snapshot
    if ((!doc.shippingFee || doc.shippingFee === 0) && doc.supplierId && !doc.supplierQuoteId) {
      const orderDate = doc.orderDate || new Date();
      const supplierQuote = await this.supplierQuoteModel.findOne({
        productId: doc.productId,
        supplierId: doc.supplierId,
        approvalStatus: 'approved',
        $or: [
          { effectiveAt: { $lte: orderDate } },
          { effectiveAt: { $exists: false } },
        ],
      }).sort({ effectiveAt: -1, createdAt: -1 }).lean<SupplierQuoteResult>();

      if (supplierQuote) {
        if (!doc.supplierQuoteId) {
          doc.supplierQuoteId = supplierQuote._id;
          doc.supplierQuoteSnapshotAt = new Date();
        }
        if (!doc.shippingFee || doc.shippingFee === 0) {
          doc.shippingFee = supplierQuote.shippingFee || DEFAULT_VALUES.SHIPPING_FEE;
          doc.supplierShippingFeeSnapshot = doc.shippingFee;
        }
        if (!doc.returnFee || doc.returnFee === 0) {
          doc.returnFee = supplierQuote.returnFee || DEFAULT_VALUES.RETURN_FEE;
          doc.supplierReturnFeeSnapshot = doc.returnFee;
        }
      }
    }

    // Æ¯u tiÃªn 3: Fallback to Product costs if still not set
    if (!doc.shippingFee || !doc.returnFee || doc.supplierIsReturnableSnapshot === undefined) {
      const product = await this.productModel.findById(doc.productId).lean<ProductWithCategory>();
      if (product) {
        if (!doc.shippingFee || doc.shippingFee === 0) {
          doc.shippingFee = product.shippingCost || DEFAULT_VALUES.SHIPPING_FEE;
        }
        if (!doc.returnFee || doc.returnFee === 0) {
          doc.returnFee = product.packagingCost || DEFAULT_VALUES.RETURN_FEE;
        }
        // Fallback chÃ­nh sÃ¡ch hoÃ n tá»« sáº£n pháº©m náº¿u chÆ°a Ä‘Æ°á»£c set tá»« supplierQuote
        if (doc.supplierIsReturnableSnapshot === undefined) {
          doc.supplierIsReturnableSnapshot = product.isReturnable ?? true;
        }
      }
    }
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
    // RULE 1: ÄÃ£ cÃ³ snapshot â†’ KHÃ”NG tÃ­nh láº¡i
    if (doc.agentQuoteId && doc.agentAppliedPrice && doc.agentAppliedPrice > 0) {
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
        productId,
        agentId,
        // Quote module stores Vietnamese approval states, not an English "active" flag.
        status: QuoteStatus.APPROVED,
        validFrom: { $lte: orderDate },
        validUntil: { $gte: orderDate },
        isActive: { $ne: false },
      })
      .sort({ createdAt: -1 })
      .lean<AgentQuoteResult>();

    const fallbackQuote = quote || await this.quoteModel
      .findOne({
        productId,
        agentId,
        // If the current date window misses by a small margin, use the latest active approved quote.
        status: QuoteStatus.APPROVED,
        isActive: { $ne: false },
      })
      .sort({ validFrom: -1, createdAt: -1 })
      .lean<AgentQuoteResult>();

    if (fallbackQuote?.unitPrice) {
      // LÆ°u snapshot - SAU ÄÃ“ KHÃ”NG BAO GIá»œ THAY Äá»”I
      doc.agentQuoteId = fallbackQuote._id?.toString();
      doc.agentAppliedPrice = fallbackQuote.unitPrice;
      doc.agentQuoteSnapshotAt = new Date();
      doc.agentQuote = fallbackQuote.unitPrice;

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
    try {
      // âš ï¸ LÆ¯U Ã NGHIá»†P Vá»¤:
      // Trong ngÃ y (real-time), KHÃ”NG cháº¡y aggregate chi phÃ­ phÃ¢n bá»• Ä‘á»ƒ trÃ¡nh sáº­p DB khi Bulk Update.
      // Chi phÃ­ phÃ¢n bá»• thá»±c táº¿ sáº½ Ä‘Æ°á»£c update ngáº§m qua Cronjob lÃºc 1:00 AM
      // (hÃ m recalculateOrdersForDate) báº±ng cÆ¡ cháº¿ BulkWrite.

      // Táº¡m tÃ­nh trong ngÃ y: ads cost láº¥y tá»« CPR cache cá»§a ngÃ y trÆ°á»›c Ä‘Ã³.
      const estimatedAdsCost = await this.resolveEstimatedAdvertisingCost(doc.adGroupId);
      doc.advertisingCost = estimatedAdsCost;
      doc.laborCostAllocation = 0;
      doc.otherCostAllocation = 0;

      // netProfit táº¡m thá»i dÃ¹ng ads estimate; labor/other sáº½ Ä‘Æ°á»£c batch hÃ´m sau ghi Ä‘Ã¨.
      const grossProfit = Number(doc.grossProfit || 0);
      doc.netProfit = grossProfit - estimatedAdsCost;

      this.logger.debug(
        `Calculated real-time cost allocations for order ${doc._id}: ` +
        `Ad=${estimatedAdsCost.toFixed(0)}, Labor=0, Other=0, Net=${doc.netProfit.toFixed(0)} (estimated until batch finalize).`,
      );

    } catch (error) {
      this.logger.error('Failed to calculate cost allocations', {
        orderId: doc._id,
        error: error.message
      });
      doc.advertisingCost = OrderCalculationService.DEFAULT_ESTIMATED_ADS_COST;
      doc.laborCostAllocation = 0;
      doc.otherCostAllocation = 0;
      doc.netProfit = Number(doc.grossProfit || 0) - doc.advertisingCost;
    }
  }

  // ============ PROFIT CALCULATION METHODS ============

/**
   * Calculate gross profit for an order
   *
   * âœ… CÃ´ng thá»©c Ä‘Ã£ Ä‘Æ°á»£c Product Owner xÃ¡c nháº­n (15/03/2026):
   *
   * Äáº¡i lÃ½ ngoÃ i (External Agent) â€” MÃ´ hÃ¬nh dropship:
   *   Doanh thu cÃ´ng ty = agentQuote Ã— SL (khÃ´ng pháº£i COD)
   *   Gross Profit = (agentQuote Ã— SL) - (supplierQuote Ã— SL) - PhÃ­ ship - PhÃ­ hoÃ n
   *   Hoa há»“ng Ä‘áº¡i lÃ½ (tÃ¡ch biá»‡t) = COD - (agentQuote Ã— SL)  [xem calculateAgentCommission()]
   *   HÃ ng hoÃ n: Doanh thu = 0 (Ä‘Æ¡n khÃ´ng thÃ nh cÃ´ng)
   *
   * Äáº¡i lÃ½ ná»™i bá»™ (Internal Agent) / KhÃ´ng cÃ³ Ä‘áº¡i lÃ½:
   *   Gross Profit = COD - (supplierQuote Ã— SL) - PhÃ­ ship - PhÃ­ hoÃ n
   *
   * (Chá»‰ tÃ­nh khi orderStatus lÃ  payment trigger, cÃ²n láº¡i = 0)
   */
  async calculateGrossProfit(order: TestOrder2Document): Promise<number> {
    const isCompleted = await this.isPaymentTriggerStatus(order.orderStatus);
    if (!isCompleted) {
      return 0;
    }

    const isReturn = await this.isReturnStatus(order.orderStatus);
    const agentRole = order.agentId ? await this.resolveAgentRole(order.agentId) : undefined;
    return this.calculateGrossProfitWithResolvedState(order, isCompleted, isReturn, agentRole);
  }

  /**
   * TÃ­nh hoa há»“ng cá»§a Äáº¡i lÃ½ NgoÃ i (Agent Commission)
   *
   * âœ… CÃ´ng thá»©c Ä‘Ã£ Ä‘Æ°á»£c Product Owner xÃ¡c nháº­n (15/03/2026):
   *   Agent Commission = COD - (agentQuote Ã— SL)
   *
   * ÄÃ¢y lÃ  sá»‘ tiá»n cÃ´ng ty TRáº¢ CHO Äáº I LÃ (cash outflow).
   * HÃ ng hoÃ n: commission Ã¢m = Ä‘áº¡i lÃ½ Ná»¢ Láº I cÃ´ng ty (clawback).
   * Äáº¡i lÃ½ ná»™i bá»™: khÃ´ng cÃ³ hoa há»“ng theo cÃ´ng thá»©c nÃ y â†’ tráº£ vá» 0.
   */
  async calculateAgentCommission(order: TestOrder2Document): Promise<number> {
    if (!order.agentId) return 0;

    const agent = await this.model.db.collection('users').findOne(
      { _id: order.agentId },
      { projection: { role: 1 } },
    );
    const isExternalAgent = agent?.role === AgentRole.EXTERNAL;
    if (!isExternalAgent) return 0;

    const isReturn = await this.isReturnStatus(order.orderStatus);
    const codAmount = order.codAmount || 0;
    const agentQuote = order.agentQuote || 0;
    const quantity = order.quantity || 1;

    if (isReturn) {
      // ÄÆ¡n hoÃ n: Ä‘áº¡i lÃ½ khÃ´ng thu Ä‘Æ°á»£c COD â†’ hoa há»“ng Ã¢m (ná»£ láº¡i)
      return 0 - (agentQuote * quantity);
    } else {
      return codAmount - (agentQuote * quantity);
    }
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
  async calculateRealizedProfitIfReady(order: TestOrder2Document): Promise<void> {
    const supplierPaid = order.supplierPaymentStatus === PaymentStatus.PAID;
    const agentPaidOrNA = order.agentPaymentStatus === PaymentStatus.PAID || order.agentPaymentStatus === PaymentStatus.NOT_APPLICABLE;

    if (supplierPaid && agentPaidOrNA && !order.realizedAt) {
      const supplierPaidAmount = order.supplierPaidAmount || 0;
      const agentPaidAmount = order.agentPaidAmount || 0;
      const advertisingCost = order.advertisingCost || 0;
      const laborCost = order.laborCostAllocation || 0;
      const otherCost = order.otherCostAllocation || 0;

      // realizedGrossProfit báº£n cháº¥t chÃ­nh lÃ :
      // (COD - supplierCost - ship - returnFee) - agentCommission
      // Do Ä‘Ã³ nÃ³ giá» Ä‘Ã¢y Ä‘Ã£ khá»›p 100% vá»›i grossProfit.
      order.realizedGrossProfit = supplierPaidAmount - agentPaidAmount;
      order.realizedNetProfit = order.realizedGrossProfit - advertisingCost - laborCost - otherCost;
      order.realizedAt = new Date();

      this.logger.log(`Order ${order._id} realized profit calculated: Gross=${order.realizedGrossProfit}, Net=${order.realizedNetProfit}`);
    }
  }

  // ============ RECALCULATION METHODS ============

  /**
   * Recalculate cost allocations for all orders on a specific date
   * Called when advertising cost data is updated to ensure accurate cost distribution
   */
  private async executeRecalculateOrdersForDate(orderDate: Date | string): Promise<{ date: string; updated: number }> {
    try {
      const dateObj = typeof orderDate === 'string' ? new Date(orderDate) : orderDate;
      const startOfDay = new Date(dateObj);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(dateObj);
      endOfDay.setHours(23, 59, 59, 999);

      const dateStr = dateObj.toISOString().split('T')[0];

      // Chá»‰ láº¥y cÃ¡c field cáº§n thiáº¿t, dÃ¹ng lean() Ä‘á»ƒ giáº£m memory (khÃ´ng cáº§n .save())
      const orders = await this.model
        .find({ orderDate: { $gte: startOfDay, $lte: endOfDay } })
        .select('_id quantity adGroupId grossProfit')
        .lean();

      if (orders.length === 0) {
        this.logger.log(`No orders to recalculate for date ${dateStr}`);
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
            { $group: { _id: null, totalCost: { $sum: '$cost' } } },
          ])
          .toArray();
        dailyLaborCostPerItem =
          (laborCostResult.length > 0 ? laborCostResult[0].totalCost : 0) / totalDailyQuantity;

        const otherCostResult = await this.model.db
          .collection('othercosts')
          .aggregate([
            { $match: { date: { $gte: startOfDay, $lte: endOfDay } } },
            { $group: { _id: null, totalCost: { $sum: '$amount' } } },
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
          { $group: { _id: '$adGroupId', totalCost: { $sum: '$spentAmount' } } },
        ])
        .toArray();
      const adCostMap = new Map<string, number>(
        adCostsResult.map((item) => [String(item._id), item.totalCost]),
      );

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
      const totalOrphanAdsCost = Array.from(adCostMap.entries()).reduce((sum, [adGroupId, totalCost]) => {
        const totalAdGroupQty = adGroupQuantityMap.get(adGroupId) || 0;
        return totalAdGroupQty > 0 ? sum : sum + totalCost;
      }, 0);

      const orphanOrdersCount = orders.filter(
        (order) => this.normalizeAdGroupKey(order.adGroupId) === null,
      ).length;
      const orphanCostPerOrder = orphanOrdersCount > 0 ? totalOrphanAdsCost / orphanOrdersCount : 0;

      const bulkOps: any[] = [];
      const groupCprStats = new Map<string, { totalCost: number; orderCount: number }>();
      const overallCprStats = { totalCost: 0, orderCount: 0 };

      for (const order of orders) {
        const quantity = Number(order.quantity || 0);

        let advertisingCost = 0;
        const adGroupKey = this.normalizeAdGroupKey(order.adGroupId);
        if (adGroupKey) {
          const totalAdCost = adCostMap.get(adGroupKey) || 0;
          const totalAdGroupQty = adGroupQuantityMap.get(adGroupKey) || 0;
          if (totalAdGroupQty > 0) {
            advertisingCost = (totalAdCost / totalAdGroupQty) * quantity;
          }
        } else if (orphanCostPerOrder > 0) {
          advertisingCost = orphanCostPerOrder;
        }

        const laborCostAllocation = dailyLaborCostPerItem * quantity;
        const otherCostAllocation = dailyOtherCostPerItem * quantity;
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
            update: { $set: { advertisingCost, laborCostAllocation, otherCostAllocation, netProfit } },
          },
        });
      }

      if (bulkOps.length > 0) {
        await this.model.bulkWrite(bulkOps);
        await this.cacheCprEstimates(dateStr, groupCprStats, overallCprStats);
      }

      const updated = bulkOps.length;
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
      const dateStr = typeof orderDate === 'string' ? orderDate : orderDate.toISOString().split('T')[0];
      return { date: dateStr, updated: 0 };
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
