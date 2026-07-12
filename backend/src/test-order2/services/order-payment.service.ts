import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { TestOrder2, TestOrder2Document } from '../schemas/test-order2.schema';
import { OrderCalculationService } from './order-calculation.service';
import { OrderSheetSyncService } from '../../order-sheet-sync/order-sheet-sync.service';
import {
  OrderStatus,
  PaymentStatus,
  AgentRole,
  COMPLETED_ORDER_STATUSES,
} from '../constants/test-order2.constants';

@Injectable()
export class OrderPaymentService {
  private readonly logger = new Logger(OrderPaymentService.name);

  constructor(
    @InjectModel(TestOrder2.name) private model: Model<TestOrder2Document>,
    private readonly calculationService: OrderCalculationService,
    private readonly orderSheetSyncService: OrderSheetSyncService,
  ) {}

  private async getCompletedOrderStatuses(): Promise<string[]> {
    const statuses = await this.calculationService.getPaymentTriggerStatuses();
    return statuses.length > 0 ? statuses : [...COMPLETED_ORDER_STATUSES];
  }

  private calculateSupplierUiAmount(
    order: Pick<TestOrder2, 'supplierQuote' | 'quantity'>,
  ): number {
    const supplierQuote = order.supplierQuote || 0;
    const quantity = order.quantity || 1;
    return supplierQuote * quantity;
  }

  // ============ PAYMENT BATCH METHODS ============

  /**
   * Create supplier payment batch - mark multiple orders as paid to supplier
   */
  async createSupplierPaymentBatch(dto: {
    orderIds: string[];
    batchId: string;
    paidDate: string;
    paidAmount?: number;
    note?: string;
    attachments?: string[];
  }) {
    const orderObjectIds = dto.orderIds.map(id => new Types.ObjectId(id));
    const paidAt = new Date(dto.paidDate);
    const completedStatuses = await this.getCompletedOrderStatuses();

    const existingBatch = await this.model.findOne({ supplierPaymentBatchId: dto.batchId });
    if (existingBatch) {
      throw new Error(`Batch ${dto.batchId} đã tồn tại. Vui lòng sử dụng mã khác.`);
    }

    const payableQuery: FilterQuery<TestOrder2Document> = {
      _id: { $in: orderObjectIds },
      orderStatus: { $in: completedStatuses },
      supplierPaymentStatus: PaymentStatus.PENDING,
      $or: [
        { supplierPaymentBatchId: { $exists: false } },
        { supplierPaymentBatchId: null },
      ],
    };

    const orders = await this.model.find(payableQuery);

    if (orders.length === 0) {
      throw new Error('Không tìm thấy đơn hàng hợp lệ hoặc đơn đã được thanh toán trước đó.');
    }

    if (orders.length < dto.orderIds.length) {
      this.logger.warn(`${dto.orderIds.length - orders.length} đơn hàng bị bỏ qua vì chưa hoàn thành hoặc đã được thanh toán`);
    }

    const atomicResult = await this.model.updateMany(
      payableQuery,
      {
        $set: {
          supplierPaymentStatus: PaymentStatus.PAID,
          supplierPaymentBatchId: dto.batchId,
          supplierPaidAt: paidAt,
          supplierPaymentNote: dto.note,
          supplierPaymentAttachments: dto.attachments || [],
        },
      },
    );

    const updatedCount = atomicResult.modifiedCount;
    if (updatedCount === 0) {
      throw new Error('Không tìm thấy đơn hàng hợp lệ hoặc đơn đã được thanh toán trước đó.');
    }

    const updatedOrders = await this.model.find({ supplierPaymentBatchId: dto.batchId });
    for (const order of updatedOrders) {
      await this.calculationService.calculateRealizedProfitIfReady(order);
      await order.save();
    }

    this.logger.log(`Created supplier payment batch ${dto.batchId} with ${updatedCount} orders`);

    const totalAmount = updatedOrders.reduce((sum, o) => sum + this.calculateSupplierUiAmount(o), 0);

    const supplierIds = [...new Set(updatedOrders.map(o => o.supplierId?.toString()).filter(Boolean))] as string[];
    this.orderSheetSyncService.triggerSyncOnSupplierPayment(supplierIds).catch(err => {
      this.logger.error('Failed to trigger sheet sync after supplier payment', err);
    });

    return {
      batchId: dto.batchId,
      paidDate: paidAt,
      orderCount: updatedCount,
      totalAmount,
      note: dto.note
    };
  }

  /**
   * Create agent payment batch - mark multiple orders as paid to agent
   * CHỈ cho phép thanh toán cho EXTERNAL AGENT
   */
  async createAgentPaymentBatch(dto: {
    orderIds: string[];
    batchId: string;
    paidDate: string;
    note?: string;
    attachments?: string[];
  }) {
    const orderObjectIds = dto.orderIds.map(id => new Types.ObjectId(id));
    const paidAt = new Date(dto.paidDate);
    const completedStatuses = await this.getCompletedOrderStatuses();

    const existingBatch = await this.model.findOne({ agentPaymentBatchId: dto.batchId });
    if (existingBatch) {
      throw new Error(`Batch ${dto.batchId} đã tồn tại. Vui lòng sử dụng mã khác.`);
    }

    const externalAgents = await this.model.db.collection('users').find({
      role: AgentRole.EXTERNAL
    }).toArray();
    const externalAgentIds = externalAgents.map(a => a._id);

    const payableQuery: FilterQuery<TestOrder2Document> = {
      _id: { $in: orderObjectIds },
      agentId: { $in: externalAgentIds },
      orderStatus: { $in: completedStatuses },
      agentPaymentStatus: PaymentStatus.PENDING,
      $or: [
        { agentPaymentBatchId: { $exists: false } },
        { agentPaymentBatchId: null },
      ],
    };

    const orders = await this.model.find(payableQuery);

    if (orders.length === 0) {
      throw new Error('Không tìm thấy đơn hàng hợp lệ hoặc đơn đã được thanh toán trước đó.');
    }

    if (orders.length < dto.orderIds.length) {
      this.logger.warn(`${dto.orderIds.length - orders.length} đơn hàng bị bỏ qua (không phải external agent, chưa hoàn thành, hoặc đã được thanh toán)`);
    }

    const atomicResult = await this.model.updateMany(
      payableQuery,
      {
        $set: {
          agentPaymentStatus: PaymentStatus.PAID,
          agentPaymentBatchId: dto.batchId,
          agentPaidAt: paidAt,
          agentPaymentNote: dto.note,
          agentPaymentAttachments: dto.attachments || [],
        },
      },
    );

    const updatedCount = atomicResult.modifiedCount;
    if (updatedCount === 0) {
      throw new Error('Không tìm thấy đơn hàng hợp lệ hoặc đơn đã được thanh toán trước đó.');
    }

    const updatedOrders = await this.model.find({ agentPaymentBatchId: dto.batchId });
    for (const order of updatedOrders) {
      await this.calculationService.calculateRealizedProfitIfReady(order);
      await order.save();
    }

    this.logger.log(`Created agent payment batch ${dto.batchId} with ${updatedCount} orders`);

    const agentIds = [...new Set(updatedOrders.map(o => o.agentId?.toString()).filter(Boolean))] as string[];
    this.orderSheetSyncService.triggerSyncOnAgentPayment(agentIds).catch(err => {
      this.logger.error('Failed to trigger sheet sync after agent payment', err);
    });

    return {
      batchId: dto.batchId,
      paidDate: paidAt,
      orderCount: updatedCount,
      totalAmount: updatedOrders.reduce((sum, o) => sum + (o.agentPaidAmount || 0), 0),
      note: dto.note
    };
  }

  // ============ PENDING PAYMENT QUERIES ============

  /**
   * Get orders pending supplier payment
   */
  async getOrdersPendingSupplierPayment(filters?: {
    supplierId?: string;
    from?: string;
    to?: string;
    orderStatus?: string;
  }) {
    const completedStatuses = await this.getCompletedOrderStatuses();
    const query: FilterQuery<TestOrder2Document> = {
      supplierPaymentStatus: PaymentStatus.PENDING,
      supplierId: { $exists: true, $ne: null },
      orderStatus: filters?.orderStatus || { $in: completedStatuses }
    };

    if (filters?.supplierId) {
      query.supplierId = new Types.ObjectId(filters.supplierId);
    }

    if (filters?.from || filters?.to) {
      query.orderDate = {} as any;
      if (filters.from) (query.orderDate as any).$gte = new Date(filters.from);
      if (filters.to) (query.orderDate as any).$lte = new Date(filters.to);
    }

    const orders = await this.model.find(query).sort({ orderDate: -1 });

    const totalAmount = orders.reduce((sum, o) => sum + this.calculateSupplierUiAmount(o), 0);

    return {
      orders,
      count: orders.length,
      totalAmount
    };
  }

  /**
   * Get orders pending agent payment
   * CHỈ hiển thị đơn hàng của EXTERNAL AGENT
   */
  async getOrdersPendingAgentPayment(filters?: {
    agentId?: string;
    from?: string;
    to?: string;
  }) {
    const externalAgents = await this.model.db.collection('users').find({
      role: AgentRole.EXTERNAL,
      isActive: true
    }).toArray();

    const externalAgentIds = externalAgents.map(a => a._id);

    if (externalAgentIds.length === 0) {
      return { orders: [], count: 0, totalCommission: 0 };
    }

    const query: FilterQuery<TestOrder2Document> = {
      agentPaymentStatus: PaymentStatus.PENDING,
      agentId: { $in: externalAgentIds },
      orderStatus: { $in: COMPLETED_ORDER_STATUSES }
    };

    if (filters?.agentId) {
      query.agentId = new Types.ObjectId(filters.agentId);
    }

    if (filters?.from || filters?.to) {
      query.orderDate = {} as any;
      if (filters.from) (query.orderDate as any).$gte = new Date(filters.from);
      if (filters.to) (query.orderDate as any).$lte = new Date(filters.to);
    }

    const orders = await this.model.find(query).sort({ orderDate: -1 });

    const totalCommission = orders.reduce((sum, o) => {
      const codAmount = o.codAmount || 0;
      const agentQuote = o.agentQuote || 0;
      const quantity = o.quantity || 1;

      // ✅ Agent Commission = COD - agentQuote×qty  (xác nhận PO 15/03/2026)
      // Phí vận chuyển do CÔNG TY chịu, không trừ vào hoa hồng đại lý.
      let commission: number;
      if (o.orderStatus === OrderStatus.RETURNED) {
        commission = 0 - (agentQuote * quantity);
      } else {
        commission = codAmount - (agentQuote * quantity);
      }
      return sum + commission;
    }, 0);

    return {
      orders,
      count: orders.length,
      totalCommission
    };
  }

  // ============ PAYMENT BATCH QUERIES ============

  /**
   * Get supplier payment batches summary
   */
  async getSupplierPaymentBatches(filters?: {
    supplierId?: string;
    from?: string;
    to?: string;
  }) {
    const matchStage: any = {
      supplierPaymentBatchId: { $exists: true, $ne: null }
    };

    if (filters?.supplierId) {
      matchStage.supplierId = new Types.ObjectId(filters.supplierId);
    }

    if (filters?.from || filters?.to) {
      matchStage.supplierPaidAt = {} as any;
      if (filters.from) matchStage.supplierPaidAt.$gte = new Date(filters.from);
      if (filters.to) matchStage.supplierPaidAt.$lte = new Date(filters.to);
    }

    const batches = await this.model.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$supplierPaymentBatchId',
          paidDate: { $first: '$supplierPaidAt' },
          orderCount: { $sum: 1 },
          totalAmount: {
            $sum: {
              $multiply: [
                { $ifNull: ['$supplierQuote', 0] },
                { $ifNull: ['$quantity', 1] },
              ],
            },
          },
          note: { $first: '$supplierPaymentNote' },
          attachments: { $first: '$supplierPaymentAttachments' }
        }
      },
      { $sort: { paidDate: -1 } }
    ]);

    return batches.map(b => ({
      batchId: b._id,
      paidDate: b.paidDate,
      orderCount: b.orderCount,
      totalAmount: b.totalAmount,
      note: b.note,
      attachments: b.attachments || []
    }));
  }

  /**
   * Get agent payment batches summary
   */
  async getAgentPaymentBatches(filters?: {
    agentId?: string;
    from?: string;
    to?: string;
  }) {
    const matchStage: any = {
      agentPaymentBatchId: { $exists: true, $ne: null }
    };

    if (filters?.agentId) {
      matchStage.agentId = new Types.ObjectId(filters.agentId);
    }

    if (filters?.from || filters?.to) {
      matchStage.agentPaidAt = {} as any;
      if (filters.from) matchStage.agentPaidAt.$gte = new Date(filters.from);
      if (filters.to) matchStage.agentPaidAt.$lte = new Date(filters.to);
    }

    const batches = await this.model.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$agentPaymentBatchId',
          paidDate: { $first: '$agentPaidAt' },
          orderCount: { $sum: 1 },
          totalAmount: { $sum: '$agentPaidAmount' },
          note: { $first: '$agentPaymentNote' },
          attachments: { $first: '$agentPaymentAttachments' }
        }
      },
      { $sort: { paidDate: -1 } }
    ]);

    return batches.map(b => ({
      batchId: b._id,
      paidDate: b.paidDate,
      orderCount: b.orderCount,
      totalAmount: b.totalAmount,
      note: b.note,
      attachments: b.attachments || []
    }));
  }

  /**
   * Get orders in a specific payment batch
   */
  async getOrdersInBatch(batchId: string, type: 'supplier' | 'agent') {
    const query: FilterQuery<TestOrder2Document> = type === 'supplier'
      ? { supplierPaymentBatchId: batchId }
      : { agentPaymentBatchId: batchId };

    return this.model.find(query).sort({ orderDate: -1 });
  }

  // ============ SUPPLIER PAYMENT OPS SUMMARY ============

  /**
   * Get supplier payment ops summary for dashboard
   * Includes pending/paid counts, aging buckets, and breakdown by supplier
   */
  async getSupplierPaymentOpsSummary(filters?: {
    supplierId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<{
    pending: { orderCount: number; amount: number };
    paid: { orderCount: number; amount: number };
    pendingAging: { bucket: string; orderCount: number; amount: number }[];
    bySupplier: any[];
    threshold: number;
    asOfDate: string;
    timezone: string;
    totalOrders: number;
    totalPaid: number;
    totalUnpaid: number;
  }> {
    const THRESHOLD = 5_000_000;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const completedStatuses = await this.getCompletedOrderStatuses();

    const baseQuery: FilterQuery<TestOrder2Document> = {
      supplierId: { $exists: true, $ne: null },
      orderStatus: { $in: completedStatuses }
    };

    if (filters?.supplierId) {
      baseQuery.supplierId = new Types.ObjectId(filters.supplierId);
    }

    if (filters?.fromDate || filters?.toDate) {
      baseQuery.orderDate = {} as any;
      if (filters.fromDate) (baseQuery.orderDate as any).$gte = new Date(filters.fromDate);
      if (filters.toDate) (baseQuery.orderDate as any).$lte = new Date(filters.toDate);
    }

    // 1. Get pending summary
    const pendingQuery = { ...baseQuery, supplierPaymentStatus: PaymentStatus.PENDING };
    const pendingOrders = await this.model.find(pendingQuery);

    const pendingSummary = {
      orderCount: pendingOrders.length,
      amount: pendingOrders.reduce((sum, o) => {
        return sum + this.calculateSupplierUiAmount(o);
      }, 0)
    };

    // 2. Get paid summary
    const paidQuery: FilterQuery<TestOrder2Document> = {
      ...baseQuery,
      supplierPaymentStatus: PaymentStatus.PAID
    };
    if (filters?.fromDate || filters?.toDate) {
      paidQuery.supplierPaidAt = {} as any;
      if (filters.fromDate) (paidQuery.supplierPaidAt as any).$gte = new Date(filters.fromDate);
      if (filters.toDate) (paidQuery.supplierPaidAt as any).$lte = new Date(filters.toDate);
    }
    const paidOrders = await this.model.find(paidQuery);

    const paidSummary = {
      orderCount: paidOrders.length,
      amount: paidOrders.reduce((sum, o) => sum + this.calculateSupplierUiAmount(o), 0)
    };

    // 3. Calculate aging buckets
    const agingBuckets = {
      '0_7': { orderCount: 0, amount: 0 },
      '8_14': { orderCount: 0, amount: 0 },
      '15_plus': { orderCount: 0, amount: 0 }
    };

    for (const order of pendingOrders) {
      const supplierAmount = this.calculateSupplierUiAmount(order);
      const completedDate = order.updatedAt || order.orderDate;
      const agingDays = completedDate
        ? Math.floor((today.getTime() - new Date(completedDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (agingDays <= 7) {
        agingBuckets['0_7'].orderCount++;
        agingBuckets['0_7'].amount += supplierAmount;
      } else if (agingDays <= 14) {
        agingBuckets['8_14'].orderCount++;
        agingBuckets['8_14'].amount += supplierAmount;
      } else {
        agingBuckets['15_plus'].orderCount++;
        agingBuckets['15_plus'].amount += supplierAmount;
      }
    }

    const pendingAging = [
      { bucket: '0_7', ...agingBuckets['0_7'] },
      { bucket: '8_14', ...agingBuckets['8_14'] },
      { bucket: '15_plus', ...agingBuckets['15_plus'] }
    ];

    // 4. Breakdown by supplier
    const supplierMap = new Map<string, {
      supplierId: string;
      supplierName: string;
      pendingOrderCount: number;
      pendingAmount: number;
      paidOrderCount: number;
      paidAmount: number;
      pendingAging: { bucket: string; amount: number }[];
    }>();

    const allSupplierIds = [
      ...new Set([
        ...pendingOrders.map(o => o.supplierId?.toString()),
        ...paidOrders.map(o => o.supplierId?.toString())
      ].filter(Boolean))
    ];

    const suppliersData = await this.model.db.collection('users').find({
      _id: { $in: allSupplierIds.map(id => new Types.ObjectId(id)) }
    }).toArray();

    const supplierNames = new Map<string, string>();
    for (const s of suppliersData) {
      supplierNames.set(s._id.toString(), s.fullName || s.email || 'NCC');
    }

    // Process pending orders by supplier
    for (const order of pendingOrders) {
      const supplierId = order.supplierId?.toString() || '';
      if (!supplierId) continue;

      if (!supplierMap.has(supplierId)) {
        supplierMap.set(supplierId, {
          supplierId,
          supplierName: supplierNames.get(supplierId) || supplierId,
          pendingOrderCount: 0,
          pendingAmount: 0,
          paidOrderCount: 0,
          paidAmount: 0,
          pendingAging: [
            { bucket: '0_7', amount: 0 },
            { bucket: '8_14', amount: 0 },
            { bucket: '15_plus', amount: 0 }
          ]
        });
      }

      const entry = supplierMap.get(supplierId)!;
      const supplierAmount = this.calculateSupplierUiAmount(order);
      entry.pendingOrderCount++;
      entry.pendingAmount += supplierAmount;

      const completedDate = order.updatedAt || order.orderDate;
      const agingDays = completedDate
        ? Math.floor((today.getTime() - new Date(completedDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (agingDays <= 7) {
        entry.pendingAging[0].amount += supplierAmount;
      } else if (agingDays <= 14) {
        entry.pendingAging[1].amount += supplierAmount;
      } else {
        entry.pendingAging[2].amount += supplierAmount;
      }
    }

    // Process paid orders by supplier
    for (const order of paidOrders) {
      const supplierId = order.supplierId?.toString() || '';
      if (!supplierId) continue;

      if (!supplierMap.has(supplierId)) {
        supplierMap.set(supplierId, {
          supplierId,
          supplierName: supplierNames.get(supplierId) || supplierId,
          pendingOrderCount: 0,
          pendingAmount: 0,
          paidOrderCount: 0,
          paidAmount: 0,
          pendingAging: [
            { bucket: '0_7', amount: 0 },
            { bucket: '8_14', amount: 0 },
            { bucket: '15_plus', amount: 0 }
          ]
        });
      }

      const entry = supplierMap.get(supplierId)!;
      entry.paidOrderCount++;
      entry.paidAmount += this.calculateSupplierUiAmount(order);
    }

    const bySupplier = Array.from(supplierMap.values())
      .map(s => ({
        ...s,
        isOverThreshold: s.pendingAmount > THRESHOLD
      }))
      .sort((a, b) => b.pendingAmount - a.pendingAmount)
      .slice(0, 10);

    return {
      pending: pendingSummary,
      paid: paidSummary,
      pendingAging,
      bySupplier,
      threshold: THRESHOLD,
      asOfDate: todayStr,
      timezone: 'Asia/Ho_Chi_Minh',
      // Flat summary fields for easy access
      totalOrders: pendingSummary.orderCount + paidSummary.orderCount,
      totalPaid: paidSummary.amount,
      totalUnpaid: pendingSummary.amount,
    };
  }

  // ============ AGENT PAYMENT OPS SUMMARY (CFO Spec v2.0) ============

  /**
   * Get agent payment ops summary for dashboard
   *
   * CFO Requirements:
   * - Tách rõ Payable (+) vs Clawback/Receivable (-)
   * - Tính aging buckets (0-7, 8-14, 15+)
   * - Breakdown theo từng đại lý
   * - Không trộn lẫn payable và clawback trong tổng
   */
  async getAgentPaymentOpsSummary(filters?: {
    agentId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<{
    payablePending: { orderCount: number; amount: number };
    paid: { orderCount: number; amount: number };
    clawbackOutstanding: { caseCount: number; amount: number };
    payableAging: { bucket: string; orderCount: number; amount: number }[];
    byAgent: {
      agentId: string;
      agentName: string;
      pendingPayableOrderCount: number;
      pendingPayableAmount: number;
      clawbackOutstandingAmount: number;
      paidAmount: number;
      netAmount: number;
      payableAging: { bucket: string; amount: number }[];
      isOverThreshold: boolean;
    }[];
    threshold: number;
    asOfDate: string;
    timezone: string;
    totalOrders: number;
    totalPaid: number;
    totalUnpaid: number;
  }> {
    const THRESHOLD = 5_000_000;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Bước 1: Lấy danh sách external agents
    const externalAgents = await this.model.db.collection('users').find({
      role: AgentRole.EXTERNAL,
      isActive: true
    }).toArray();

    const externalAgentIds = externalAgents.map(a => a._id);
    const agentNames = new Map<string, string>();
    for (const a of externalAgents) {
      agentNames.set(a._id.toString(), a.fullName || a.email || 'Agent');
    }

    if (externalAgentIds.length === 0) {
      return {
        payablePending: { orderCount: 0, amount: 0 },
        paid: { orderCount: 0, amount: 0 },
        clawbackOutstanding: { caseCount: 0, amount: 0 },
        payableAging: [
          { bucket: '0_7', orderCount: 0, amount: 0 },
          { bucket: '8_14', orderCount: 0, amount: 0 },
          { bucket: '15_plus', orderCount: 0, amount: 0 }
        ],
        byAgent: [],
        threshold: THRESHOLD,
        asOfDate: todayStr,
        timezone: 'Asia/Ho_Chi_Minh',
        totalOrders: 0,
        totalPaid: 0,
        totalUnpaid: 0,
      };
    }

    // Build base query
    const baseQuery: FilterQuery<TestOrder2Document> = {
      agentId: { $in: externalAgentIds },
      orderStatus: { $in: COMPLETED_ORDER_STATUSES }
    };

    if (filters?.agentId) {
      baseQuery.agentId = new Types.ObjectId(filters.agentId);
    }

    if (filters?.fromDate || filters?.toDate) {
      baseQuery.orderDate = {} as any;
      if (filters.fromDate) (baseQuery.orderDate as any).$gte = new Date(filters.fromDate);
      if (filters.toDate) (baseQuery.orderDate as any).$lte = new Date(filters.toDate);
    }

    // 1. PAYABLE PENDING
    const payablePendingQuery = {
      ...baseQuery,
      agentPaymentStatus: PaymentStatus.PENDING,
      orderStatus: OrderStatus.DELIVERED
    };
    const payablePendingOrders = await this.model.find(payablePendingQuery);

    const payablePendingSummary = {
      orderCount: payablePendingOrders.length,
      amount: payablePendingOrders.reduce((sum, o) => {
        const codAmount = o.codAmount || 0;
        const agentQuote = o.agentQuote || 0;
        const quantity = o.quantity || 1;
        const shippingFee = o.shippingFee || 0;
        const commission = codAmount - (agentQuote * quantity) - shippingFee;
        return sum + Math.max(0, commission);
      }, 0)
    };

    // 2. PAID
    const paidQuery: FilterQuery<TestOrder2Document> = {
      ...baseQuery,
      agentPaymentStatus: PaymentStatus.PAID
    };
    if (filters?.fromDate || filters?.toDate) {
      paidQuery.agentPaidAt = {} as any;
      if (filters.fromDate) (paidQuery.agentPaidAt as any).$gte = new Date(filters.fromDate);
      if (filters.toDate) (paidQuery.agentPaidAt as any).$lte = new Date(filters.toDate);
    }
    const paidOrders = await this.model.find(paidQuery);

    const paidSummary = {
      orderCount: paidOrders.length,
      amount: paidOrders.reduce((sum, o) => {
        const paidAmount = o.agentPaidAmount || 0;
        return sum + Math.max(0, paidAmount);
      }, 0)
    };

    // 3. CLAWBACK OUTSTANDING
    const clawbackQuery: FilterQuery<TestOrder2Document> = {
      ...baseQuery,
      agentPaymentStatus: PaymentStatus.PAID,
      orderStatus: OrderStatus.RETURNED
    };
    const clawbackOrders = await this.model.find(clawbackQuery);

    const clawbackSummary = {
      caseCount: clawbackOrders.length,
      amount: clawbackOrders.reduce((sum, o) => {
        const paidAmount = o.agentPaidAmount || 0;
        const agentQuote = o.agentQuote || 0;
        const quantity = o.quantity || 1;
        const shippingFee = o.shippingFee || 0;
        const returnFee = o.returnFee || 0;

        const clawback = Math.abs(paidAmount) + (agentQuote * quantity) + shippingFee + returnFee;
        return sum + clawback;
      }, 0)
    };

    // 4. Return pending orders (for reference)
    const returnPendingQuery: FilterQuery<TestOrder2Document> = {
      ...baseQuery,
      agentPaymentStatus: PaymentStatus.PENDING,
      orderStatus: OrderStatus.RETURNED
    };
    await this.model.find(returnPendingQuery);

    // 5. AGING BUCKETS
    const agingBuckets = {
      '0_7': { orderCount: 0, amount: 0 },
      '8_14': { orderCount: 0, amount: 0 },
      '15_plus': { orderCount: 0, amount: 0 }
    };

    for (const order of payablePendingOrders) {
      const codAmount = order.codAmount || 0;
      const agentQuote = order.agentQuote || 0;
      const quantity = order.quantity || 1;
      const shippingFee = order.shippingFee || 0;
      const commission = codAmount - (agentQuote * quantity) - shippingFee;

      if (commission <= 0) continue;

      const eligibleDate = order.agentEligibleAt || order.updatedAt || order.orderDate;
      const agingDays = eligibleDate
        ? Math.floor((today.getTime() - new Date(eligibleDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (agingDays <= 7) {
        agingBuckets['0_7'].orderCount++;
        agingBuckets['0_7'].amount += commission;
      } else if (agingDays <= 14) {
        agingBuckets['8_14'].orderCount++;
        agingBuckets['8_14'].amount += commission;
      } else {
        agingBuckets['15_plus'].orderCount++;
        agingBuckets['15_plus'].amount += commission;
      }
    }

    const payableAging = [
      { bucket: '0_7', ...agingBuckets['0_7'] },
      { bucket: '8_14', ...agingBuckets['8_14'] },
      { bucket: '15_plus', ...agingBuckets['15_plus'] }
    ];

    // 6. BREAKDOWN BY AGENT
    const agentMap = new Map<string, {
      agentId: string;
      agentName: string;
      pendingPayableOrderCount: number;
      pendingPayableAmount: number;
      clawbackOutstandingAmount: number;
      paidAmount: number;
      netAmount: number;
      payableAging: { bucket: string; amount: number }[];
    }>();

    for (const agent of externalAgents) {
      const agentId = agent._id.toString();
      agentMap.set(agentId, {
        agentId,
        agentName: agentNames.get(agentId) || agentId,
        pendingPayableOrderCount: 0,
        pendingPayableAmount: 0,
        clawbackOutstandingAmount: 0,
        paidAmount: 0,
        netAmount: 0,
        payableAging: [
          { bucket: '0_7', amount: 0 },
          { bucket: '8_14', amount: 0 },
          { bucket: '15_plus', amount: 0 }
        ]
      });
    }

    // Process payable pending orders
    for (const order of payablePendingOrders) {
      const agentId = order.agentId?.toString() || '';
      if (!agentId || !agentMap.has(agentId)) continue;

      const entry = agentMap.get(agentId)!;
      const codAmount = order.codAmount || 0;
      const agentQuote = order.agentQuote || 0;
      const quantity = order.quantity || 1;
      const shippingFee = order.shippingFee || 0;
      const commission = codAmount - (agentQuote * quantity) - shippingFee;

      if (commission <= 0) continue;

      entry.pendingPayableOrderCount++;
      entry.pendingPayableAmount += commission;

      const eligibleDate = order.agentEligibleAt || order.updatedAt || order.orderDate;
      const agingDays = eligibleDate
        ? Math.floor((today.getTime() - new Date(eligibleDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      if (agingDays <= 7) {
        entry.payableAging[0].amount += commission;
      } else if (agingDays <= 14) {
        entry.payableAging[1].amount += commission;
      } else {
        entry.payableAging[2].amount += commission;
      }
    }

    // Process paid orders
    for (const order of paidOrders) {
      const agentId = order.agentId?.toString() || '';
      if (!agentId || !agentMap.has(agentId)) continue;

      const entry = agentMap.get(agentId)!;
      const paidAmount = order.agentPaidAmount || 0;
      if (paidAmount > 0) {
        entry.paidAmount += paidAmount;
      }
    }

    // Process clawback orders
    for (const order of clawbackOrders) {
      const agentId = order.agentId?.toString() || '';
      if (!agentId || !agentMap.has(agentId)) continue;

      const entry = agentMap.get(agentId)!;
      const paidAmount = order.agentPaidAmount || 0;
      const agentQuote = order.agentQuote || 0;
      const quantity = order.quantity || 1;
      const shippingFee = order.shippingFee || 0;
      const returnFee = order.returnFee || 0;

      const clawback = Math.abs(paidAmount) + (agentQuote * quantity) + shippingFee + returnFee;
      entry.clawbackOutstandingAmount += clawback;
    }

    const byAgent = Array.from(agentMap.values())
      .map(a => ({
        ...a,
        netAmount: a.pendingPayableAmount - a.clawbackOutstandingAmount,
        isOverThreshold: a.pendingPayableAmount > THRESHOLD
      }))
      .filter(a => a.pendingPayableAmount > 0 || a.clawbackOutstandingAmount > 0 || a.paidAmount > 0)
      .sort((a, b) => b.pendingPayableAmount - a.pendingPayableAmount)
      .slice(0, 10);

    return {
      payablePending: payablePendingSummary,
      paid: paidSummary,
      clawbackOutstanding: clawbackSummary,
      payableAging,
      byAgent,
      threshold: THRESHOLD,
      asOfDate: todayStr,
      timezone: 'Asia/Ho_Chi_Minh',
      // Flat summary fields for easy access
      totalOrders: payablePendingSummary.orderCount + paidSummary.orderCount,
      totalPaid: paidSummary.amount,
      totalUnpaid: payablePendingSummary.amount,
    };
  }

  // ============ SYNC PAYMENT FROM STATEMENT ============

  /**
   * Sync supplier payment from SupplierStatement to TestOrder2
   */
  async syncSupplierPaymentFromStatement(params: {
    supplierId: string;
    periodFrom: Date;
    periodTo: Date;
    batchId: string;
    paidAt: Date;
    paymentNote?: string;
  }): Promise<{ updated: number }> {
    const { supplierId, periodFrom, periodTo, batchId, paidAt, paymentNote } = params;
    const completedStatuses = await this.getCompletedOrderStatuses();

    this.logger.log(`Syncing supplier payment from statement: ${batchId}`);

    const orders = await this.model.find({
      supplierId: new Types.ObjectId(supplierId),
      orderDate: { $gte: periodFrom, $lte: periodTo },
      orderStatus: { $in: completedStatuses },
      supplierPaymentStatus: { $ne: PaymentStatus.PAID },
    });

    if (orders.length === 0) {
      this.logger.log('No orders to sync for supplier statement');
      return { updated: 0 };
    }

    let updated = 0;
    for (const order of orders) {
      order.supplierPaymentStatus = PaymentStatus.PAID;
      order.supplierPaymentBatchId = batchId;
      order.supplierPaidAt = paidAt;
      order.supplierPaymentNote = paymentNote || `Thanh toán theo kỳ đối soát ${batchId}`;

      await this.calculationService.calculateRealizedProfitIfReady(order);

      await order.save();
      updated++;
    }

    this.logger.log(`Synced ${updated} orders for supplier statement ${batchId}`);
    return { updated };
  }

  /**
   * Sync agent payment from AgentStatement to TestOrder2
   * CHỈ áp dụng cho EXTERNAL AGENT
   */
  async syncAgentPaymentFromStatement(params: {
    agentId: string;
    periodFrom: Date;
    periodTo: Date;
    batchId: string;
    paidAt: Date;
    paymentNote?: string;
  }): Promise<{ updated: number }> {
    const { agentId, periodFrom, periodTo, batchId, paidAt, paymentNote } = params;

    this.logger.log(`Syncing agent payment from statement: ${batchId}`);

    const agent = await this.model.db.collection('users').findOne({
      _id: new Types.ObjectId(agentId),
      role: AgentRole.EXTERNAL,
    });

    if (!agent) {
      this.logger.warn(`Agent ${agentId} is not external agent, skipping sync`);
      return { updated: 0 };
    }

    const orders = await this.model.find({
      agentId: new Types.ObjectId(agentId),
      orderDate: { $gte: periodFrom, $lte: periodTo },
      orderStatus: { $in: COMPLETED_ORDER_STATUSES },
      agentPaymentStatus: PaymentStatus.PENDING,
    });

    if (orders.length === 0) {
      this.logger.log('No orders to sync for agent statement');
      return { updated: 0 };
    }

    let updated = 0;
    for (const order of orders) {
      order.agentPaymentStatus = PaymentStatus.PAID;
      order.agentPaymentBatchId = batchId;
      order.agentPaidAt = paidAt;
      order.agentPaymentNote = paymentNote || `Thanh toán hoa hồng theo kỳ ${batchId}`;

      await this.calculationService.calculateRealizedProfitIfReady(order);

      await order.save();
      updated++;
    }

    this.logger.log(`Synced ${updated} orders for agent statement ${batchId}`);
    return { updated };
  }

  /**
   * Generate batch ID for statement payment
   */
  generateStatementBatchId(type: 'supplier' | 'agent', statementId: string): string {
    const prefix = type === 'supplier' ? 'STMT-NCC' : 'STMT-AGENT';
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `${prefix}-${date}-${statementId.slice(-6)}`;
  }

  // ============ ATOMIC UPDATE + CHỐNG DOUBLE-PAY (CFO Spec) ============

  /**
   * Create agent payment batch with atomic update
   *
   * CFO Requirements:
   * - Atomic update: chỉ update nếu status = pending và batchId = null
   * - Chống double-pay khi 2 người tạo batch cùng lúc
   * - Idempotency: batchId phải unique
   * - Không cho tạo batch với tổng âm (clawback cần flow riêng)
   */
  async createAgentPaymentBatchAtomic(dto: {
    orderIds: string[];
    batchId: string;
    paidDate: string;
    note?: string;
    attachments?: string[];
    confirmOverThreshold?: boolean;
    confirmedBy?: string;
  }) {
    const THRESHOLD = 5_000_000;
    const orderObjectIds = dto.orderIds.map(id => new Types.ObjectId(id));
    const paidAt = new Date(dto.paidDate);

    // Bước 0: Tính tổng commission trước để check threshold
    const ordersToCheck = await this.model.find({
      _id: { $in: orderObjectIds },
      agentPaymentStatus: PaymentStatus.PENDING
    });

    let estimatedTotal = 0;
    for (const order of ordersToCheck) {
      const codAmount = order.codAmount || 0;
      const agentQuote = order.agentQuote || 0;
      const quantity = order.quantity || 1;
      const shippingFee = order.shippingFee || 0;
      const returnFee = order.returnFee || 0;

      if (order.orderStatus === OrderStatus.RETURNED) {
        const commission = 0 - (agentQuote * quantity) - shippingFee - returnFee;
        estimatedTotal += commission;
      } else {
        const commission = codAmount - (agentQuote * quantity) - shippingFee;
        estimatedTotal += commission;
      }
    }

    // CFO Spec v2.0: Validation ngưỡng 5M
    if (estimatedTotal > THRESHOLD) {
      if (!dto.confirmOverThreshold) {
        throw new Error(`Tổng thanh toán ${estimatedTotal.toLocaleString('vi-VN')}đ vượt ngưỡng ${THRESHOLD.toLocaleString('vi-VN')}đ. Vui lòng xác nhận và đính kèm chứng từ.`);
      }
      if (!dto.attachments || dto.attachments.length === 0) {
        throw new Error('Thanh toán vượt ngưỡng 5M bắt buộc phải có chứng từ đính kèm.');
      }
      if (!dto.confirmedBy) {
        throw new Error('Thiếu thông tin người xác nhận cho thanh toán vượt ngưỡng.');
      }
    }

    // Bước 1: Check idempotency
    const existingBatch = await this.model.findOne({ agentPaymentBatchId: dto.batchId });
    if (existingBatch) {
      throw new Error(`Batch ${dto.batchId} đã tồn tại. Vui lòng sử dụng mã khác.`);
    }

    // Bước 2: Tìm external agents
    const externalAgents = await this.model.db.collection('users').find({
      role: AgentRole.EXTERNAL
    }).toArray();
    const externalAgentIds = externalAgents.map(a => a._id);

    // Bước 3: Atomic find and update
    const updatePayload: any = {
      agentPaymentStatus: PaymentStatus.PAID,
      agentPaymentBatchId: dto.batchId,
      agentPaidAt: paidAt,
      agentPaymentNote: dto.note || `Thanh toán hoa hồng batch ${dto.batchId}`,
      agentPaymentAttachments: dto.attachments || []
    };

    if (estimatedTotal > THRESHOLD && dto.confirmOverThreshold) {
      updatePayload.confirmOverThreshold = true;
      updatePayload.confirmedBy = dto.confirmedBy;
      updatePayload.confirmedAt = paidAt;
    }

    const atomicResult = await this.model.updateMany(
      {
        _id: { $in: orderObjectIds },
        agentId: { $in: externalAgentIds },
        orderStatus: { $in: COMPLETED_ORDER_STATUSES },
        agentPaymentStatus: PaymentStatus.PENDING,
        agentPaymentBatchId: { $exists: false }
      },
      { $set: updatePayload }
    );

    const updatedCount = atomicResult.modifiedCount;

    if (updatedCount === 0) {
      throw new Error('Không tìm thấy đơn hàng hợp lệ hoặc đơn đã được thanh toán trước đó.');
    }

    // Bước 4: Tính commission cho các đơn đã update
    const updatedOrders = await this.model.find({ agentPaymentBatchId: dto.batchId });

    let totalPayable = 0;
    let totalClawback = 0;

    for (const order of updatedOrders) {
      const codAmount = order.codAmount || 0;
      const agentQuote = order.agentQuote || 0;
      const quantity = order.quantity || 1;

      // ✅ Agent Commission = COD - agentQuote×qty  (xác nhận PO 15/03/2026)
      // Phí vận chuyển do CÔNG TY chịu, không trừ vào hoa hồng đại lý.
      let commission: number;
      if (order.orderStatus === OrderStatus.RETURNED) {
        commission = 0 - (agentQuote * quantity);
        totalClawback += Math.abs(commission);
      } else {
        commission = codAmount - (agentQuote * quantity);
        if (commission > 0) {
          totalPayable += commission;
        } else {
          totalClawback += Math.abs(commission);
        }
      }

      order.agentPaidAmount = commission;

      await this.calculationService.calculateRealizedProfitIfReady(order);
      await order.save();
    }

    const netAmount = totalPayable - totalClawback;

    this.logger.log(`Created agent payment batch ${dto.batchId}: ${updatedCount} orders, payable=${totalPayable}, clawback=${totalClawback}, net=${netAmount}`);

    const agentIds = [...new Set(updatedOrders.map(o => o.agentId?.toString()).filter(Boolean))] as string[];
    this.orderSheetSyncService.triggerSyncOnAgentPayment(agentIds).catch(err => {
      this.logger.error('Failed to trigger sheet sync after agent payment', err);
    });

    return {
      batchId: dto.batchId,
      paidDate: paidAt,
      orderCount: updatedCount,
      skippedCount: dto.orderIds.length - updatedCount,
      totalPayable,
      totalClawback,
      netAmount,
      note: dto.note,
      warning: netAmount < 0 ? `⚠️ Tổng hoa hồng âm: ${netAmount.toLocaleString('vi-VN')}đ. Đây là khoản đại lý nợ công ty.` : null
    };
  }
}
