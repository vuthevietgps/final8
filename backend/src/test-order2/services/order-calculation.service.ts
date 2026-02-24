import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TestOrder2, TestOrder2Document } from '../schemas/test-order2.schema';
import { Product, ProductDocument } from '../../product/schemas/product.schema';
import { Quote, QuoteDocument } from '../../quote/schemas/quote.schema';
import { SupplierQuote, SupplierQuoteDocument } from '../../supplier-quote/schemas/supplier-quote.schema';
import { DeliveryStatusService } from '../../delivery-status/delivery-status.service';
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

  // Cache for payment trigger statuses (refreshed on first use or when needed)
  private paymentTriggerStatusesCache: string[] | null = null;
  private returnStatusesCache: string[] | null = null;

  constructor(
    @InjectModel(TestOrder2.name) private model: Model<TestOrder2Document>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(SupplierQuote.name) private supplierQuoteModel: Model<SupplierQuoteDocument>,
    private readonly deliveryStatusService: DeliveryStatusService,
  ) {}

  // ============ STATUS CACHE METHODS ============

  /**
   * Lấy danh sách tên các trạng thái trigger thanh toán (cached)
   * Fallback về COMPLETED_ORDER_STATUSES nếu chưa có data trong DB
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
   * Lấy danh sách tên các trạng thái hoàn hàng (cached)
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
   * Kiểm tra xem trạng thái có phải là payment trigger không
   */
  async isPaymentTriggerStatus(status: string | undefined | null): Promise<boolean> {
    if (!status) return false;
    const triggerStatuses = await this.getPaymentTriggerStatuses();
    return triggerStatuses.includes(status);
  }

  /**
   * Kiểm tra xem trạng thái có phải là hoàn hàng không
   */
  async isReturnStatus(status: string | undefined | null): Promise<boolean> {
    if (!status) return false;
    const returnStatuses = await this.getReturnStatuses();
    return returnStatuses.includes(status);
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
   * - Nếu đã có supplierQuoteId (đã snapshot) → KHÔNG BAO GIỜ thay đổi
   * - Chỉ fetch quote mới khi:
   *   1. Chưa có snapshot (đơn hàng mới)
   *   2. Snapshot đã bị clear (do đổi NCC/sản phẩm)
   *
   * Priority: supplierQuoteId (snapshot) > supplierAppliedPrice > SupplierQuote DB > Product.importPrice
   */
  private async calculateSupplierQuote(doc: OrderCalculationContext): Promise<void> {
    // RULE 1: Đã có snapshot → KHÔNG tính lại
    if (doc.supplierQuoteId) {
      if (doc.supplierAppliedPrice && doc.supplierAppliedPrice > 0) {
        doc.supplierQuote = doc.supplierAppliedPrice;
      }
      this.logger.debug(`Order has existing quote snapshot ${doc.supplierQuoteId} - keeping price ${doc.supplierAppliedPrice}`);
      return;
    }

    // RULE 2: Có giá manual (không qua quote) → giữ nguyên
    if (doc.supplierAppliedPrice && doc.supplierAppliedPrice > 0 && !doc.supplierId) {
      doc.supplierQuote = doc.supplierAppliedPrice;
      return;
    }

    if (!doc.productId) return;

    // RULE 3: Chưa có snapshot → Fetch từ SupplierQuote
    if (doc.supplierId) {
      const orderDate = doc.orderDate || new Date();

      const supplierQuote = await this.supplierQuoteModel.findOne({
        productId: doc.productId,
        supplierId: doc.supplierId,
        $or: [
          { effectiveAt: { $lte: orderDate } },
          { effectiveAt: { $exists: false } },
        ],
      }).sort({ effectiveAt: -1, createdAt: -1 }).lean<SupplierQuoteResult>();

      if (supplierQuote) {
        // Lưu snapshot - SAU ĐÓ KHÔNG BAO GIỜ THAY ĐỔI
        doc.supplierQuoteId = supplierQuote._id;
        doc.supplierAppliedPrice = supplierQuote.price || 0;
        doc.supplierQuoteSnapshotAt = new Date();
        doc.supplierShippingFeeSnapshot = supplierQuote.shippingFee;
        doc.supplierReturnFeeSnapshot = supplierQuote.returnFee;
        // Snapshot chính sách hoàn: ưu tiên isReturnableOverride từ quote NCC, fallback true
        doc.supplierIsReturnableSnapshot = supplierQuote.isReturnableOverride ?? true;
        doc.supplierQuote = doc.supplierAppliedPrice;

        this.logger.log(`SNAPSHOT: Order applied SupplierQuote ${supplierQuote._id} with price ${doc.supplierAppliedPrice} at ${doc.supplierQuoteSnapshotAt}`);
        return;
      }
    }

    // RULE 4: Fallback từ Product (không có quote)
    const product = await this.productModel.findById(doc.productId).lean<ProductWithCategory>();
    if (product) {
      doc.supplierQuote = (product.importPrice || 0) + (product.shippingCost || 0);
      this.logger.debug(`Fallback to Product importPrice: ${doc.supplierQuote}`);
    }
  }

  /**
   * Calculate shipping and return fees with fallback chain
   * Priority: Snapshot từ supplierQuote > SupplierQuote DB > Product costs
   */
  private async calculateShippingAndReturnFees(doc: OrderCalculationContext): Promise<void> {
    if (!doc.productId) return;

    // Ưu tiên 1: Dùng snapshot từ supplierQuote nếu đã có
    if (doc.supplierShippingFeeSnapshot !== undefined && (!doc.shippingFee || doc.shippingFee === 0)) {
      doc.shippingFee = doc.supplierShippingFeeSnapshot || DEFAULT_VALUES.SHIPPING_FEE;
    }
    if (doc.supplierReturnFeeSnapshot !== undefined && (!doc.returnFee || doc.returnFee === 0)) {
      doc.returnFee = doc.supplierReturnFeeSnapshot || DEFAULT_VALUES.RETURN_FEE;
    }

    // Ưu tiên 2: Fetch từ SupplierQuote nếu chưa có snapshot
    if ((!doc.shippingFee || doc.shippingFee === 0) && doc.supplierId && !doc.supplierQuoteId) {
      const supplierQuote = await this.supplierQuoteModel.findOne({
        productId: doc.productId,
        supplierId: doc.supplierId,
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

    // Ưu tiên 3: Fallback to Product costs if still not set
    if (!doc.shippingFee || !doc.returnFee || doc.supplierIsReturnableSnapshot === undefined) {
      const product = await this.productModel.findById(doc.productId).lean<ProductWithCategory>();
      if (product) {
        if (!doc.shippingFee || doc.shippingFee === 0) {
          doc.shippingFee = product.shippingCost || DEFAULT_VALUES.SHIPPING_FEE;
        }
        if (!doc.returnFee || doc.returnFee === 0) {
          doc.returnFee = product.packagingCost || DEFAULT_VALUES.RETURN_FEE;
        }
        // Fallback chính sách hoàn từ sản phẩm nếu chưa được set từ supplierQuote
        if (doc.supplierIsReturnableSnapshot === undefined) {
          doc.supplierIsReturnableSnapshot = product.isReturnable ?? true;
        }
      }
    }
  }

  /**
   * Calculate agent quote from Quote table
   *
   * SNAPSHOT IMMUTABILITY RULE (tương tự supplierQuote):
   * - Nếu đã có agentQuoteId (đã snapshot) → KHÔNG BAO GIỜ thay đổi
   * - Chỉ fetch quote mới khi chưa có snapshot hoặc đã bị clear
   *
   * Priority: agentQuoteId (snapshot) > agentAppliedPrice > Quote DB
   */
  private async calculateAgentQuote(doc: OrderCalculationContext): Promise<void> {
    // RULE 1: Đã có snapshot → KHÔNG tính lại
    if (doc.agentQuoteId && doc.agentAppliedPrice && doc.agentAppliedPrice > 0) {
      doc.agentQuote = doc.agentAppliedPrice;
      this.logger.debug(`Order has existing agent quote snapshot ${doc.agentQuoteId} - keeping price ${doc.agentAppliedPrice}`);
      return;
    }

    // RULE 2: Có giá manual (không qua quote) → giữ nguyên
    if (doc.agentAppliedPrice && doc.agentAppliedPrice > 0 && !doc.agentId) {
      doc.agentQuote = doc.agentAppliedPrice;
      return;
    }

    if (!doc.productId || !doc.agentId) return;

    // RULE 3: Chưa có snapshot → Fetch từ Quote DB
    const orderDate = doc.orderDate || new Date();

    const quote = await this.quoteModel.findOne({
      productId: doc.productId,
      agentId: doc.agentId,
      status: 'active',
      validFrom: { $lte: orderDate },
      validUntil: { $gte: orderDate },
    }).sort({ createdAt: -1 }).lean<AgentQuoteResult>();

    if (quote?.unitPrice) {
      // Lưu snapshot - SAU ĐÓ KHÔNG BAO GIỜ THAY ĐỔI
      doc.agentQuoteId = quote._id?.toString();
      doc.agentAppliedPrice = quote.unitPrice;
      doc.agentQuoteSnapshotAt = new Date();
      doc.agentQuote = quote.unitPrice;

      // P1 FIX: BIWEEKLY PAYMENT DUE DATE
      const payDays = [1, 15];
      const MIN_BUFFER_DAYS = 7;

      const d = new Date(orderDate);
      const currentMonth = d.getMonth();
      const currentYear = d.getFullYear();

      const minDueDate = new Date(d);
      minDueDate.setDate(minDueDate.getDate() + MIN_BUFFER_DAYS);

      let dueDate: Date | null = null;

      // Tìm trong tháng hiện tại
      for (const payDay of payDays) {
        const candidateDate = new Date(currentYear, currentMonth, payDay);
        if (candidateDate >= minDueDate) {
          dueDate = candidateDate;
          break;
        }
      }

      // Nếu không tìm thấy trong tháng này, tìm tháng sau
      if (!dueDate) {
        for (const payDay of payDays) {
          const candidateDate = new Date(currentYear, currentMonth + 1, payDay);
          if (candidateDate >= minDueDate) {
            dueDate = candidateDate;
            break;
          }
        }
      }

      // Fallback: tháng sau + 1 nếu vẫn không tìm thấy
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
   * 1. Advertising Cost = (Total ad cost for adGroupId on date / Total quantity for adGroupId on date) × order quantity
   * 2. Labor Cost = (Total labor cost on date / Total quantity of all orders on date) × order quantity
   * 3. Other Cost = (Total other cost on date / Total quantity of all orders on date) × order quantity
   * 4. Net Profit = Gross Profit - Advertising Cost - Labor Cost - Other Cost
   */
  async calculateCostAllocations(doc: OrderCalculationContext): Promise<void> {
    try {
      if (!doc.orderDate || !doc.quantity || doc.quantity <= 0) {
        doc.advertisingCost = 0;
        doc.laborCostAllocation = 0;
        doc.otherCostAllocation = 0;
        doc.netProfit = doc.grossProfit || 0;
        return;
      }

      const orderDate = new Date(doc.orderDate);
      const startOfDay = new Date(orderDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(orderDate);
      endOfDay.setHours(23, 59, 59, 999);

      const quantity = Number(doc.quantity || 0);

      // 1. Tính chi phí quảng cáo
      let advertisingCost = 0;
      if (doc.adGroupId && doc.adGroupId !== '0') {
        try {
          const adCostResult = await this.model.db.collection('advertisingcosts').aggregate([
            {
              $match: {
                adGroupId: doc.adGroupId,
                date: { $gte: startOfDay, $lte: endOfDay }
              }
            },
            {
              $group: {
                _id: null,
                totalCost: { $sum: '$spentAmount' }
              }
            }
          ]).toArray();

          const totalAdCost = adCostResult.length > 0 ? adCostResult[0].totalCost : 0;

          const adGroupQuantityResult = await this.model.aggregate([
            {
              $match: {
                adGroupId: doc.adGroupId,
                orderDate: { $gte: startOfDay, $lte: endOfDay },
                isActive: { $ne: false },
              }
            },
            {
              $group: {
                _id: null,
                totalQuantity: { $sum: '$quantity' }
              }
            }
          ]).exec();

          const totalAdGroupQuantity = adGroupQuantityResult.length > 0 ? adGroupQuantityResult[0].totalQuantity : 0;

          if (totalAdGroupQuantity > 0) {
            advertisingCost = (totalAdCost / totalAdGroupQuantity) * quantity;
          }
        } catch (error) {
          this.logger.error('Failed to calculate advertising cost', { orderId: doc._id, error: error.message });
        }
      }

      // 2. Tính chi phí nhân công và chi phí khác
      let laborCost = 0;
      let otherCost = 0;

      try {
        const totalQuantityResult = await this.model.aggregate([
          {
            $match: {
              orderDate: { $gte: startOfDay, $lte: endOfDay },
              isActive: { $ne: false },
            }
          },
          {
            $group: {
              _id: null,
              totalQuantity: { $sum: '$quantity' }
            }
          }
        ]).exec();

        const totalDailyQuantity = totalQuantityResult.length > 0 ? totalQuantityResult[0].totalQuantity : 0;

        if (totalDailyQuantity > 0) {
          const laborCostResult = await this.model.db.collection('laborcost1').aggregate([
            {
              $match: {
                date: { $gte: startOfDay, $lte: endOfDay }
              }
            },
            {
              $group: {
                _id: null,
                totalCost: { $sum: '$cost' }
              }
            }
          ]).toArray();

          const totalLaborCost = laborCostResult.length > 0 ? laborCostResult[0].totalCost : 0;

          const otherCostResult = await this.model.db.collection('othercosts').aggregate([
            {
              $match: {
                date: { $gte: startOfDay, $lte: endOfDay }
              }
            },
            {
              $group: {
                _id: null,
                totalCost: { $sum: '$amount' }
              }
            }
          ]).toArray();

          const totalOtherCost = otherCostResult.length > 0 ? otherCostResult[0].totalCost : 0;

          laborCost = (totalLaborCost / totalDailyQuantity) * quantity;
          otherCost = (totalOtherCost / totalDailyQuantity) * quantity;
        }
      } catch (error) {
        this.logger.error('Failed to calculate daily cost allocations', { orderId: doc._id, error: error.message });
      }

      doc.advertisingCost = advertisingCost;
      doc.laborCostAllocation = laborCost;
      doc.otherCostAllocation = otherCost;

      const grossProfit = Number(doc.grossProfit || 0);
      doc.netProfit = grossProfit - advertisingCost - laborCost - otherCost;

      this.logger.log(`Calculated cost allocations for order ${doc._id}: Ad=${advertisingCost.toFixed(0)}, Labor=${laborCost.toFixed(0)}, Other=${otherCost.toFixed(0)}, Net=${doc.netProfit.toFixed(0)}`);

    } catch (error) {
      this.logger.error('Failed to calculate cost allocations', {
        orderId: doc._id,
        error: error.message
      });
      doc.advertisingCost = 0;
      doc.laborCostAllocation = 0;
      doc.otherCostAllocation = 0;
      doc.netProfit = doc.grossProfit || 0;
    }
  }

  // ============ PROFIT CALCULATION METHODS ============

  /**
   * Calculate gross profit for an order
   *
   * Đại lý ngoài (External Agent):
   * Gross Profit = COD - (agentQuote × SL) - Fees - (supplierQuote × SL)
   *
   * Đại lý nội bộ (Internal Agent) / Không có đại lý:
   * Gross Profit = COD - (supplierQuote × SL) - Fees
   * Hàng hoàn: COD = 0 (không thu được tiền COD)
   * (Chỉ tính khi orderStatus là payment trigger, còn lại = 0)
   */
  async calculateGrossProfit(order: TestOrder2Document): Promise<number> {
    const quantity = order.quantity || 1;
    const shippingFee = order.shippingFee || 0;
    const returnFee = order.returnFee || 0;
    const supplierQuote = order.supplierQuote || 0;
    const agentQuote = order.agentQuote || 0;

    const isCompleted = await this.isPaymentTriggerStatus(order.orderStatus);
    if (!isCompleted) {
      return 0;
    }

    // For returned orders, COD is not collected (use 0 instead of codAmount)
    const isReturn = await this.isReturnStatus(order.orderStatus);
    const effectiveCod = isReturn ? 0 : (order.codAmount || 0);

    // Chính sách hoàn hàng từ snapshot (true = NCC nhận lại hàng & hoàn tiền hàng)
    // Nếu isReturnable=true: không mất giá hàng (NCC hoàn); nếu false: mất toàn bộ giá hàng
    const isReturnable = order.supplierIsReturnableSnapshot ?? true;
    const supplierCost = (isReturn && isReturnable) ? 0 : (supplierQuote * quantity);

    let isExternalAgent = false;
    if (order.agentId) {
      const agent = await this.model.db.collection('users').findOne({ _id: order.agentId });
      isExternalAgent = agent?.role === AgentRole.EXTERNAL;
    }

    if (isExternalAgent) {
      return effectiveCod - (agentQuote * quantity) - shippingFee - returnFee - supplierCost;
    } else {
      return effectiveCod - supplierCost - shippingFee - returnFee;
    }
  }

  /**
   * Calculate net profit for an order
   * Công thức: Gross Profit - Chi phí QC - Chi phí nhân công - Chi phí khác
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
  async recalculateOrdersForDate(orderDate: Date | string): Promise<{ date: string; updated: number }> {
    try {
      const dateObj = typeof orderDate === 'string' ? new Date(orderDate) : orderDate;
      const startOfDay = new Date(dateObj);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(dateObj);
      endOfDay.setHours(23, 59, 59, 999);

      const dateStr = dateObj.toISOString().split('T')[0];

      const orders = await this.model.find({
        orderDate: { $gte: startOfDay, $lte: endOfDay }
      });

      if (orders.length === 0) {
        this.logger.log(`No orders to recalculate for date ${dateStr}`);
        return { date: dateStr, updated: 0 };
      }

      this.logger.log(`Recalculating ${orders.length} orders for date ${dateStr}`);

      let updated = 0;
      for (const order of orders) {
        try {
          await this.calculateCostAllocations(order as any);
          await order.save();
          updated++;
        } catch (error) {
          this.logger.error(`Failed to recalculate order ${order._id}`, error);
        }
      }

      this.logger.log(`Successfully recalculated ${updated} orders for date ${dateStr}`);
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
}
