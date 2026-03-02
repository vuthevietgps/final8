import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { TestOrder2, TestOrder2Document } from './schemas/test-order2.schema';
import { CreateTestOrder2Dto } from './dto/create-test-order2.dto';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { SupplierPayableService } from '../supplier-payable/supplier-payable.service';
import { OrderSheetSyncService } from '../order-sheet-sync/order-sheet-sync.service';
import { OrderCalculationService } from './services/order-calculation.service';
import { OrderPaymentService } from './services/order-payment.service';
import { OrderReportService } from './services/order-report.service';
import {
  ProductionStatus,
  OrderStatus,
  PaymentStatus,
  AgentRole,
  COMPLETED_ORDER_STATUSES,
  DEFAULT_VALUES,
  SUPPLIER_PAYABLE_AUTO_NOTE,
} from './constants/test-order2.constants';

/** Fields that suppliers are allowed to update on their own orders */
const SUPPLIER_EDITABLE_FIELDS = new Set([
  'serviceDetails', 'productionStatus', 'orderStatus',
  'submitLink', 'trackingNumber', 'depositAmount',
  'codAmount', 'receiverName', 'receiverPhone', 'receiverAddress',
]);

const SUPPLIER_ROLES = new Set(['internal_supplier', 'external_supplier']);

@Injectable()
export class TestOrder2Service {
  private readonly logger = new Logger(TestOrder2Service.name);

  constructor(
    @InjectModel(TestOrder2.name) private model: Model<TestOrder2Document>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly calculationService: OrderCalculationService,
    private readonly paymentService: OrderPaymentService,
    private readonly reportService: OrderReportService,
    private readonly supplierPayableService: SupplierPayableService,
    private readonly orderSheetSyncService: OrderSheetSyncService,
  ) {}

  private normalizeUsageDurationMonths(value: unknown): number | undefined {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return undefined;
    const rounded = Math.floor(normalized);
    return rounded > 0 ? rounded : undefined;
  }

  private getCurrentUserId(currentUser?: any): string | undefined {
    const rawId = currentUser?.id ?? currentUser?._id ?? currentUser?.userId ?? currentUser?.sub;
    if (!rawId) return undefined;
    return rawId instanceof Types.ObjectId ? rawId.toString() : String(rawId);
  }

  private async getProductUsageDurationMonths(productId?: Types.ObjectId | string): Promise<number | undefined> {
    if (!productId) return undefined;
    const id = typeof productId === 'string' ? productId : productId.toString();
    if (!Types.ObjectId.isValid(id)) return undefined;

    const product = await this.productModel
      .findById(id)
      .select('usageDurationMonths')
      .lean<{ usageDurationMonths?: number }>()
      .exec();

    return this.normalizeUsageDurationMonths(product?.usageDurationMonths);
  }

  // ============ ORDER LIFECYCLE HOOKS ============

  /**
   * Create supplier payable when order production status becomes DONE
   */
  private async createSupplierPayableIfEligible(order: TestOrder2Document, prevProductionStatus: string | undefined | null) {
    const nowStatus = order.productionStatus;
    if (nowStatus !== ProductionStatus.DONE) return;
    if (prevProductionStatus === ProductionStatus.DONE) return;

    const supplierId = (order as any)?.supplierId ? String((order as any).supplierId) : '';
    const price = Number((order as any)?.supplierAppliedPrice || 0);
    const qty = Number(order.quantity || DEFAULT_VALUES.QUANTITY);
    if (!supplierId || price <= 0 || qty <= 0) return;

    const productId = (order as any)?.productId ? String((order as any).productId) : undefined;
    const cogs = price * qty;
    const codAmount = Number((order as any)?.codAmount || 0);
    const shippingFee = Number((order as any)?.shippingFee || 0);

    // Fix #1: totalAmount = commission (COD - COGS - shipping), not just COGS
    // This is the amount the supplier owes the user after deducting their costs
    const commission = codAmount - cogs - shippingFee;

    try {
      await this.supplierPayableService.upsertForOrder({
        orderId: String(order._id),
        supplierId,
        items: [{ productId, quantity: qty, unitPrice: price, amount: cogs }],
        totalAmount: Math.max(0, commission),
        currency: 'VND',
        notes: SUPPLIER_PAYABLE_AUTO_NOTE,
      });
    } catch (error) {
      this.logger.error(`Failed to create supplier payable for order ${order._id}`, {
        orderId: order._id,
        supplierId,
        totalAmount: commission,
        error: error.message
      });
    }
  }

  /**
   * Ensure COD collected amount is filled when order is delivered
   */
  private ensureCodCollectedIfDelivered(doc: TestOrder2Document, prevOrderStatus: string | undefined | null) {
    const nowStatus = doc.orderStatus;
    if (nowStatus !== OrderStatus.DELIVERED) return;
    if (prevOrderStatus === OrderStatus.DELIVERED && doc.codCollectedBySupplier !== undefined) return;

    const current = Number((doc as any).codCollectedBySupplier);
    if (Number.isFinite(current) && current > 0) return;

    const fallback = Number(doc.codAmount || DEFAULT_VALUES.COD_AMOUNT);
    (doc as any).codCollectedBySupplier = Number.isFinite(current) && current >= 0 ? current : fallback;
  }

  /**
   * Auto-trigger payment status when orderStatus changes to completed states
   */
  private async handleOrderStatusChange(doc: TestOrder2Document, prevOrderStatus: string | undefined | null) {
    const currentStatus = doc.orderStatus;

    if (currentStatus === prevOrderStatus) return;

    const isPaymentTrigger = await this.calculationService.isPaymentTriggerStatus(currentStatus);
    const isReturn = await this.calculationService.isReturnStatus(currentStatus);

    if (isPaymentTrigger) {
      this.logger.log(`Order ${doc._id} status changed to '${currentStatus}' (isPaymentTrigger=true, isReturn=${isReturn}) - triggering payment calculations`);

      // 1. Tính số tiền NCC trả công ty (supplierPaidAmount)
      if (doc.supplierId) {
        const codAmount = doc.codAmount || 0;
        const supplierQuote = doc.supplierQuote || 0;
        const quantity = doc.quantity || 1;
        const shippingFee = doc.shippingFee || 0;
        const returnFee = doc.returnFee || 0;
        // isReturnable=true: NCC nhận lại hàng & hoàn tiền hàng → không trừ giá hàng
        // isReturnable=false: NCC không nhận lại → công ty mất giá hàng
        const isReturnable = doc.supplierIsReturnableSnapshot ?? true;

        if (isReturn) {
          const supplierCostOnReturn = isReturnable ? 0 : (supplierQuote * quantity);
          doc.supplierPaidAmount = 0 - supplierCostOnReturn - shippingFee - returnFee;
        } else {
          doc.supplierPaidAmount = codAmount - (supplierQuote * quantity) - shippingFee;
        }

        if (doc.supplierPaymentStatus !== PaymentStatus.PAID) {
          doc.supplierPaymentStatus = PaymentStatus.PENDING;
        }
        this.logger.log(`  → Supplier payment amount calculated: ${doc.supplierPaidAmount}`);
      }

      // 2. Tính số tiền công ty trả đại lý (agentPaidAmount)
      if (doc.agentId) {
        const agent = await this.model.db.collection('users').findOne(
          { _id: doc.agentId },
          { projection: { role: 1 } }
        );

        const isExternalAgent = agent?.role === AgentRole.EXTERNAL;

        if (isExternalAgent) {
          const codAmount = doc.codAmount || 0;
          const agentQuote = doc.agentQuote || 0;
          const quantity = doc.quantity || 1;
          const shippingFee = doc.shippingFee || 0;
          const returnFee = doc.returnFee || 0;

          if (isReturn) {
            doc.agentPaidAmount = 0 - (agentQuote * quantity) - shippingFee - returnFee;
          } else {
            doc.agentPaidAmount = codAmount - (agentQuote * quantity) - shippingFee;
          }

          if (doc.agentPaymentStatus !== PaymentStatus.PAID) {
            doc.agentPaymentStatus = PaymentStatus.PENDING;
          }

          // CFO Spec v2.0: Set agentEligibleAt và agentCommissionFinal khi lần đầu chuyển sang COMPLETED
          if (!doc.agentEligibleAt) {
            doc.agentEligibleAt = new Date();
            doc.agentCommissionFinal = doc.agentPaidAmount;
            this.logger.log(`  → Agent eligible date set: ${doc.agentEligibleAt.toISOString()}`);
            this.logger.log(`  → Agent commission final snapshot: ${doc.agentCommissionFinal}`);
          }

          this.logger.log(`  → Agent payment amount calculated: ${doc.agentPaidAmount}`);
        } else {
          doc.agentPaidAmount = 0;
          doc.agentPaymentStatus = PaymentStatus.NOT_APPLICABLE;
          this.logger.log(`  → Agent payment status set to 'n/a' (internal agent)`);
        }
      } else {
        doc.agentPaidAmount = 0;
        doc.agentPaymentStatus = PaymentStatus.NOT_APPLICABLE;
      }

      // 3. Tính lợi nhuận ước tính (grossProfit) - dùng cùng công thức với recalculate
      doc.grossProfit = await this.calculationService.calculateGrossProfit(doc);

      this.logger.log(`  → Estimated gross profit: ${doc.grossProfit}`);
    }
  }

  // ============ CRUD OPERATIONS ============

  async create(dto: CreateTestOrder2Dto, currentUser?: any) {
    if (currentUser && SUPPLIER_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Nhà cung cấp không được phép tạo đơn hàng');
    }

    const doc: Partial<TestOrder2> = {
      productId: dto.productId ? new Types.ObjectId(dto.productId) : undefined,
      productUsageDurationMonths: this.normalizeUsageDurationMonths(dto.productUsageDurationMonths),
      customerName: dto.customerName,
      quantity: dto.quantity ?? 1,
      agentId: dto.agentId ? new Types.ObjectId(dto.agentId) : undefined,
      adGroupId: dto.adGroupId,
      isActive: dto.isActive ?? true,
      productionStatus: dto.productionStatus ?? 'Chưa làm',
      orderStatus: dto.orderStatus ?? 'Chưa có mã vận đơn',
      serviceDetails: dto.serviceDetails,
      submitLink: dto.submitLink,
      trackingNumber: dto.trackingNumber,
      depositAmount: dto.depositAmount ?? 0,
      codAmount: dto.codAmount ?? 0,
      manualPayment: dto.manualPayment ?? 0,
      shippingFee: dto.shippingFee ?? 0,
      returnFee: dto.returnFee ?? 0,
      codCollectedBySupplier: dto.codCollectedBySupplier ?? 0,
      receiverName: dto.receiverName,
      receiverPhone: dto.receiverPhone,
      receiverAddress: dto.receiverAddress,
      orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
      supplierId: dto.supplierId ? new Types.ObjectId(dto.supplierId) : undefined,
      supplierPriceLevel: dto.supplierPriceLevel,
      supplierAppliedPrice: dto.supplierAppliedPrice,
      supplierQuote: dto.supplierQuote,
      agentQuoteId: dto.agentQuoteId,
      agentAppliedPrice: dto.agentAppliedPrice,
      agentQuote: dto.agentQuote,
      productType: dto.productType,
    };

    if (!doc.productUsageDurationMonths && doc.productId) {
      doc.productUsageDurationMonths = await this.getProductUsageDurationMonths(doc.productId);
    }

    const created = new this.model(doc);
    await this.calculationService.autoCalculateQuoteFields(created);
    this.ensureCodCollectedIfDelivered(created as any, null);
    const saved = await created.save();
    await this.createSupplierPayableIfEligible(saved, null);

    if (saved.orderDate) {
      this.calculationService.recalculateOrdersForDate(saved.orderDate).catch(err => {
        this.logger.error('Failed to recalculate orders after create', err);
      });
    }

    this.orderSheetSyncService.triggerSyncOnOrderChange(saved).catch(err => {
      this.logger.error('Failed to trigger sheet sync after create', err);
    });

    return saved;
  }

  async findById(id: string, currentUser?: any) {
    const doc = await this.model.findById(id).lean();
    if (doc && currentUser && SUPPLIER_ROLES.has(currentUser.role)) {
      const currentUserId = this.getCurrentUserId(currentUser);
      if (!currentUserId || doc.supplierId?.toString() !== currentUserId) {
        throw new ForbiddenException('Bạn chỉ được phép xem đơn hàng của mình');
      }
    }
    return doc;
  }

  async update(id: string, payload: Partial<TestOrder2>, currentUser?: any) {
    const doc = await this.model.findById(id);
    if (!doc) return null;

    // --- Supplier access control ---
    if (currentUser && SUPPLIER_ROLES.has(currentUser.role)) {
      const currentUserId = this.getCurrentUserId(currentUser);
      if (!currentUserId || doc.supplierId?.toString() !== currentUserId) {
        throw new ForbiddenException('Bạn chỉ được phép chỉnh sửa đơn hàng của mình');
      }
      const filtered: any = {};
      for (const key of Object.keys(payload)) {
        if (SUPPLIER_EDITABLE_FIELDS.has(key)) {
          filtered[key] = (payload as any)[key];
        }
      }
      payload = filtered;
      if (Object.keys(payload).length === 0) return doc;
    }

    const prevProductionStatus = doc.productionStatus;
    const prevOrderStatus = doc.orderStatus;
    const prevSupplierId = doc.supplierId?.toString();
    const prevProductId = doc.productId?.toString();
    const prevAgentId = doc.agentId?.toString();

    const updates: any = { ...payload };
    if (typeof updates.productId === 'string') updates.productId = new Types.ObjectId(updates.productId);
    if (typeof updates.agentId === 'string') updates.agentId = new Types.ObjectId(updates.agentId);
    if (typeof updates.supplierId === 'string') updates.supplierId = new Types.ObjectId(updates.supplierId);
    if (typeof updates.orderDate === 'string') updates.orderDate = new Date(updates.orderDate);
    if (typeof updates.isActive === 'string') updates.isActive = updates.isActive === 'true' || updates.isActive === '1';
    if (updates.productUsageDurationMonths !== undefined) {
      updates.productUsageDurationMonths = this.normalizeUsageDurationMonths(updates.productUsageDurationMonths);
    }
    ['quantity', 'depositAmount', 'codAmount', 'manualPayment', 'shippingFee', 'returnFee'].forEach((k) => {
      const key = k as keyof TestOrder2;
      const v: any = (updates as any)[key];
      if (typeof v === 'string') (updates as any)[key] = parseFloat(v) || 0;
    });

    if (typeof (updates as any).codCollectedBySupplier === 'string') {
      (updates as any).codCollectedBySupplier = parseFloat((updates as any).codCollectedBySupplier) || 0;
    }

    // ============ SUPPLIER QUOTE SNAPSHOT IMMUTABILITY ============
    const newSupplierId = updates.supplierId?.toString();
    const newProductId = updates.productId?.toString();
    const supplierChanged = !!newSupplierId && newSupplierId !== prevSupplierId;
    const productChanged = !!newProductId && newProductId !== prevProductId;

    if (supplierChanged || productChanged) {
      updates.supplierQuoteId = undefined;
      updates.supplierAppliedPrice = undefined;
      updates.supplierQuoteSnapshotAt = undefined;
      updates.supplierShippingFeeSnapshot = undefined;
      updates.supplierReturnFeeSnapshot = undefined;
      updates.supplierQuote = undefined;

      this.logger.log(`Supplier/Product changed for order ${id} - clearing supplier quote snapshot. Old: ${prevSupplierId}/${prevProductId}, New: ${newSupplierId}/${newProductId}`);
    }

    if (productChanged || (updates.productId && updates.productUsageDurationMonths === undefined)) {
      const resolvedUsageDuration = await this.getProductUsageDurationMonths(updates.productId);
      if (resolvedUsageDuration) {
        updates.productUsageDurationMonths = resolvedUsageDuration;
      }
    }

    // ============ AGENT QUOTE SNAPSHOT IMMUTABILITY ============
    const newAgentId = updates.agentId?.toString();
    const agentChanged = !!newAgentId && newAgentId !== prevAgentId;

    if (agentChanged || productChanged) {
      updates.agentQuoteId = undefined;
      updates.agentAppliedPrice = undefined;
      updates.agentQuoteSnapshotAt = undefined;
      updates.agentPaymentDueDate = undefined;
      updates.agentQuote = undefined;

      this.logger.log(`Agent/Product changed for order ${id} - clearing agent quote snapshot. Old: ${prevAgentId}/${prevProductId}, New: ${newAgentId}/${newProductId}`);
    }

    // ============ ORDERDATE CHANGE DETECTION ============
    const prevOrderDate = doc.orderDate?.toISOString?.().split('T')[0];
    const newOrderDate = updates.orderDate instanceof Date
      ? updates.orderDate.toISOString().split('T')[0]
      : (typeof updates.orderDate === 'string' ? updates.orderDate.split('T')[0] : undefined);

    if (newOrderDate && prevOrderDate && newOrderDate !== prevOrderDate) {
      if (doc.supplierQuoteId || doc.agentQuoteId) {
        this.logger.warn(
          `Order ${id} orderDate changed from ${prevOrderDate} to ${newOrderDate} ` +
          `but quote snapshots are preserved (supplierQuoteId: ${doc.supplierQuoteId}, agentQuoteId: ${doc.agentQuoteId}). ` +
          `To recalculate quotes, change supplier/product/agent.`
        );
      }
    }

    Object.assign(doc, updates);
    await this.calculationService.autoCalculateQuoteFields(doc);
    this.ensureCodCollectedIfDelivered(doc as any, prevOrderStatus);

    await this.handleOrderStatusChange(doc, prevOrderStatus);

    const saved = await doc.save();
    await this.createSupplierPayableIfEligible(saved as any, prevProductionStatus);

    if (saved.orderDate) {
      this.calculationService.recalculateOrdersForDate(saved.orderDate).catch(err => {
        this.logger.error('Failed to recalculate orders after update', err);
      });
    }

    this.orderSheetSyncService.triggerSyncOnOrderChange(saved).catch(err => {
      this.logger.error('Failed to trigger sheet sync after update', err);
    });

    return saved;
  }

  async remove(id: string, currentUser?: any) {
    if (currentUser && SUPPLIER_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Nhà cung cấp không được phép xóa đơn hàng');
    }

    const order = await this.model.findById(id);
    const orderDate = order?.orderDate;

    await this.model.findByIdAndDelete(id);

    if (orderDate) {
      this.calculationService.recalculateOrdersForDate(orderDate).catch(err => {
        this.logger.error('Failed to recalculate orders after delete', err);
      });
    }

    return { message: 'Deleted' };
  }

  async seed(count = 10) {
    const docs: Partial<TestOrder2>[] = [];
    for (let i = 0; i < count; i++) {
      docs.push({
        customerName: `Khách hàng #${i + 1}`,
        quantity: 1 + (i % 3),
        adGroupId: i % 2 === 0 ? '0' : `ADG_${1000 + i}`,
        isActive: true,
        productionStatus: 'Chưa làm',
        orderStatus: 'Chưa có mã vận đơn',
        depositAmount: 0,
        codAmount: 0,
        manualPayment: 0,
        orderDate: new Date(),
      });
    }
    const res = await this.model.insertMany(docs);
    return { inserted: res.length };
  }

  async findAll(params: {
    currentUser?: any;
    q?: string;
    productId?: string;
    agentId?: string;
    supplierId?: string;
    adGroupId?: string;
    isActive?: string;
    from?: string;
    to?: string;
    productionStatus?: string;
    orderStatus?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(params.limit) || 50));

    const query: FilterQuery<TestOrder2Document> = {};

    const isSupplierUser = !!params.currentUser && SUPPLIER_ROLES.has(params.currentUser.role);

    if (params.currentUser) {
      const userRole = params.currentUser.role;
      const userId = this.getCurrentUserId(params.currentUser);

      if (userRole === 'internal_supplier' || userRole === 'external_supplier') {
        if (!userId || !Types.ObjectId.isValid(userId)) {
          throw new ForbiddenException('Không xác định được tài khoản nhà cung cấp');
        }
        query.supplierId = new Types.ObjectId(userId);
        this.logger.log(`Supplier ${userId} filtering orders by supplierId`);
      }
    }

    if (params.q) {
      const regex = new RegExp(params.q, 'i');
      Object.assign(query, {
        $or: [
          { customerName: regex },
          { receiverPhone: regex },
          { trackingNumber: regex },
        ],
      });
    }
    if (params.productId) query.productId = new Types.ObjectId(params.productId);
    if (params.agentId) query.agentId = new Types.ObjectId(params.agentId);
    if (params.supplierId && !isSupplierUser) query.supplierId = new Types.ObjectId(params.supplierId);
    if (params.adGroupId) query.adGroupId = params.adGroupId;
    if (params.isActive !== undefined) {
      if (params.isActive === 'true' || params.isActive === '1') query.isActive = true;
      if (params.isActive === 'false' || params.isActive === '0') query.isActive = false;
    }
    if (params.productionStatus) query.productionStatus = params.productionStatus;
    if (params.orderStatus) query.orderStatus = params.orderStatus;

    if (params.from || params.to) {
      const fromDate = params.from ? new Date(params.from) : undefined;
      const toDate = params.to ? new Date(params.to) : undefined;

      const dateConditions: any[] = [];

      const orderDateCond: any = { orderDate: { $exists: true, $ne: null } };
      if (fromDate) orderDateCond.orderDate.$gte = fromDate;
      if (toDate) orderDateCond.orderDate.$lte = toDate;
      dateConditions.push(orderDateCond);

      const createdAtCond: any = {
        $or: [
          { orderDate: { $exists: false } },
          { orderDate: null }
        ]
      };
      if (fromDate || toDate) {
        const createdRange: any = {};
        if (fromDate) createdRange.$gte = fromDate;
        if (toDate) createdRange.$lte = toDate;
        createdAtCond.createdAt = createdRange;
      }
      dateConditions.push(createdAtCond);

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: dateConditions }];
        delete query.$or;
      } else {
        query.$or = dateConditions;
      }
    }

    const sort: Record<string, 1 | -1> = {};
    if (params.sortBy) sort[params.sortBy] = params.sortOrder === 'asc' ? 1 : -1;
    else sort['createdAt'] = -1;

    const [total, items] = await Promise.all([
      this.model.countDocuments(query),
      this.model
        .find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: total ? Math.ceil(total / limit) : 0,
      },
    };
  }

  // ============ RECALCULATION (delegates to calculationService) ============

  /**
   * Recalculate cost allocations for all orders on a specific date
   * Used by external services (advertising cost sync)
   */
  async recalculateOrdersForDate(orderDate: Date | string) {
    return this.calculationService.recalculateOrdersForDate(orderDate);
  }

  /**
   * Recalculate quotes for an order - force refresh based on current orderDate
   */
  async recalculateQuotes(orderId: string) {
    const order = await this.model.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const prevSupplierQuoteId = order.supplierQuoteId?.toString();
    const prevAgentQuoteId = order.agentQuoteId;

    // Clear all quote snapshots
    order.supplierQuoteId = undefined;
    order.supplierAppliedPrice = undefined;
    order.supplierQuoteSnapshotAt = undefined;
    order.supplierShippingFeeSnapshot = undefined;
    order.supplierReturnFeeSnapshot = undefined;
    order.supplierQuote = undefined;

    order.agentQuoteId = undefined;
    order.agentAppliedPrice = undefined;
    order.agentQuoteSnapshotAt = undefined;
    order.agentPaymentDueDate = undefined;
    order.agentQuote = undefined;

    await this.calculationService.autoCalculateQuoteFields(order);
    await order.save();

    this.logger.log(
      `Recalculated quotes for order ${orderId}: ` +
      `SupplierQuote ${prevSupplierQuoteId} -> ${order.supplierQuoteId} (${order.supplierAppliedPrice}), ` +
      `AgentQuote ${prevAgentQuoteId} -> ${order.agentQuoteId} (${order.agentAppliedPrice})`
    );

    return {
      _id: order._id,
      orderDate: order.orderDate,
      supplierQuoteId: order.supplierQuoteId,
      supplierAppliedPrice: order.supplierAppliedPrice,
      supplierQuoteSnapshotAt: order.supplierQuoteSnapshotAt,
      agentQuoteId: order.agentQuoteId,
      agentAppliedPrice: order.agentAppliedPrice,
      agentQuoteSnapshotAt: order.agentQuoteSnapshotAt,
      agentPaymentDueDate: order.agentPaymentDueDate,
      message: 'Quotes recalculated successfully'
    };
  }

  /**
   * Recalculate profits for a single order
   */
  async recalculateProfits(orderId: string) {
    const order = await this.model.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    order.grossProfit = await this.calculationService.calculateGrossProfit(order);
    await this.calculationService.calculateCostAllocations(order as any);
    order.netProfit = (order.grossProfit || 0) - (order.advertisingCost || 0) - (order.laborCostAllocation || 0) - (order.otherCostAllocation || 0);

    await order.save();

    this.logger.log(`Recalculated profits for order ${orderId}: grossProfit=${order.grossProfit}, netProfit=${order.netProfit}`);

    return order;
  }

  /**
   * Recalculate profits for all orders (batch operation)
   */
  async recalculateAllProfits(filters?: { from?: string; to?: string; supplierId?: string; agentId?: string }) {
    const query: FilterQuery<TestOrder2Document> = {};

    if (filters?.from || filters?.to) {
      query.orderDate = {} as any;
      if (filters.from) (query.orderDate as any).$gte = new Date(filters.from);
      if (filters.to) (query.orderDate as any).$lte = new Date(filters.to);
    }
    if (filters?.supplierId) query.supplierId = new Types.ObjectId(filters.supplierId);
    if (filters?.agentId) query.agentId = new Types.ObjectId(filters.agentId);

    const orders = await this.model.find(query);

    let updated = 0;
    for (const order of orders) {
      // Recalculate grossProfit first (ensures correct formula)
      order.grossProfit = await this.calculationService.calculateGrossProfit(order);
      // Recalculate cost allocations (ad, labor, other) and netProfit
      await this.calculationService.calculateCostAllocations(order as any);
      // Ensure netProfit uses freshly calculated grossProfit
      order.netProfit = (order.grossProfit || 0) - (order.advertisingCost || 0) - (order.laborCostAllocation || 0) - (order.otherCostAllocation || 0);
      await order.save();
      updated++;
    }

    this.logger.log(`Recalculated profits for ${updated} orders`);

    return { updated };
  }

  // ============ PAYMENT DELEGATION ============

  async createSupplierPaymentBatch(dto: any) {
    return this.paymentService.createSupplierPaymentBatch(dto);
  }

  async createAgentPaymentBatch(dto: any) {
    return this.paymentService.createAgentPaymentBatch(dto);
  }

  async createAgentPaymentBatchAtomic(dto: any) {
    return this.paymentService.createAgentPaymentBatchAtomic(dto);
  }

  async getOrdersPendingSupplierPayment(filters?: any) {
    return this.paymentService.getOrdersPendingSupplierPayment(filters);
  }

  async getOrdersPendingAgentPayment(filters?: any) {
    return this.paymentService.getOrdersPendingAgentPayment(filters);
  }

  async getSupplierPaymentBatches(filters?: any) {
    return this.paymentService.getSupplierPaymentBatches(filters);
  }

  async getAgentPaymentBatches(filters?: any) {
    return this.paymentService.getAgentPaymentBatches(filters);
  }

  async getOrdersInBatch(batchId: string, type: 'supplier' | 'agent') {
    return this.paymentService.getOrdersInBatch(batchId, type);
  }

  async getSupplierPaymentOpsSummary(filters?: any) {
    return this.paymentService.getSupplierPaymentOpsSummary(filters);
  }

  async getAgentPaymentOpsSummary(filters?: any) {
    return this.paymentService.getAgentPaymentOpsSummary(filters);
  }

  async syncSupplierPaymentFromStatement(params: any) {
    return this.paymentService.syncSupplierPaymentFromStatement(params);
  }

  async syncAgentPaymentFromStatement(params: any) {
    return this.paymentService.syncAgentPaymentFromStatement(params);
  }

  generateStatementBatchId(type: 'supplier' | 'agent', statementId: string): string {
    return this.paymentService.generateStatementBatchId(type, statementId);
  }

  // ============ REPORT DELEGATION ============

  async getDailyProfitReport(date?: string) {
    return this.reportService.getDailyProfitReport(date);
  }

  async getProductProfitReport(params: { date?: string; from?: string; to?: string }) {
    return this.reportService.getProductProfitReport(params);
  }
}
