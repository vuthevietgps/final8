import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SupplierPayable, SupplierPayableDocument } from '../schemas/supplier-payable.schema';
import { SupplierStatement, SupplierStatementDocument } from '../schemas/supplier-statement.schema';
import { TestOrder2 } from '../../test-order2/schemas/test-order2.schema';
import { CreateStatementDto } from '../dto/create-statement.dto';
import { buildPeriodFilter } from '../helpers/payable.helpers';
import { recalcStatementTotals } from '../helpers/statement.helpers';

// Import constants from test-order2
import { 
  PaymentStatus, 
  COMPLETED_ORDER_STATUSES 
} from '../../test-order2/constants/test-order2.constants';

/**
 * Service responsible for supplier statement management:
 * - Creating/updating statements
 * - Listing statements
 * - Adding payments to statements
 * - Closing statements
 * - SYNC payments to TestOrder2 (Option B)
 */
@Injectable()
export class StatementManagementService {
  private readonly logger = new Logger(StatementManagementService.name);

  constructor(
    @InjectModel(SupplierPayable.name) private payableModel: Model<SupplierPayableDocument>,
    @InjectModel(SupplierStatement.name) private statementModel: Model<SupplierStatementDocument>,
    @InjectModel(TestOrder2.name) private orderModel: Model<any>,
  ) {}

  async upsertStatement(params: CreateStatementDto) {
    const supplierObjId = new Types.ObjectId(params.supplierId);
    const from = new Date(params.from);
    const to = new Date(params.to);
    to.setHours(23, 59, 59, 999);

    const payableBeforeMatch: any = { supplierId: supplierObjId, createdAt: { $lt: from } };
    const payablePeriodMatch: any = { supplierId: supplierObjId, createdAt: buildPeriodFilter(from, to) };

    const [payablesBefore, payablesInPeriod, paymentsBefore, paymentsInPeriod, codInPeriod] = await Promise.all([
      this.payableModel.aggregate([
        { $match: payableBeforeMatch },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      this.payableModel.aggregate([
        { $match: payablePeriodMatch },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      this.payableModel.aggregate([
        { $match: { supplierId: supplierObjId } },
        { $unwind: '$payments' },
        { $match: { 'payments.paidAt': { $lt: from } } },
        { $group: { _id: null, total: { $sum: '$payments.amount' } } },
      ]),
      this.payableModel.aggregate([
        { $match: { supplierId: supplierObjId } },
        { $unwind: '$payments' },
        { $match: { 'payments.paidAt': buildPeriodFilter(from, to) } },
        { $group: { _id: null, total: { $sum: '$payments.amount' } } },
      ]),
      this.orderModel.aggregate([
        { $match: { supplierId: supplierObjId, orderStatus: 'Giao thành công', updatedAt: buildPeriodFilter(from, to) } },
        { $project: {
          codCollected: {
            $cond: [ { $gt: ['$codCollectedBySupplier', 0] }, '$codCollectedBySupplier', '$codAmount' ],
          },
        } },
        { $group: { _id: null, total: { $sum: '$codCollected' } } },
      ]),
    ]);

    const openingBalance = Number(payablesBefore?.[0]?.total || 0) - Number(paymentsBefore?.[0]?.total || 0);
    const periodPayables = Number(payablesInPeriod?.[0]?.total || 0);
    const periodPayments = Number(paymentsInPeriod?.[0]?.total || 0);
    const periodCodCollected = Number(codInPeriod?.[0]?.total || 0);

    let doc = await this.statementModel.findOne({ supplierId: supplierObjId, periodFrom: from, periodTo: to });
    if (!doc) {
      doc = new this.statementModel({
        supplierId: supplierObjId,
        periodFrom: from,
        periodTo: to,
        status: 'open',
        openingBalance,
        periodPayables,
        periodPayments,
        periodCodCollected,
        payments: [],
        statementPaymentTotal: 0,
      } as any);
    } else {
      if (doc.status === 'closed') throw new BadRequestException('Kỳ đã chốt, không thể cập nhật');
      doc.openingBalance = openingBalance;
      doc.periodPayables = periodPayables;
      doc.periodPayments = periodPayments;
      doc.periodCodCollected = periodCodCollected;
      if (params.notes !== undefined) doc.notes = params.notes;
    }

    recalcStatementTotals(doc);
    await doc.save();
    return doc.toObject();
  }

  async listStatements(params: { supplierId?: string; from?: string; to?: string; status?: string }) {
    const query: any = {};
    if (params.supplierId) query.supplierId = new Types.ObjectId(params.supplierId);
    if (params.status) query.status = params.status;
    if (params.from) query.periodFrom = { $gte: new Date(params.from) };
    if (params.to) {
      const to = new Date(params.to);
      to.setHours(23, 59, 59, 999);
      query.periodTo = query.periodTo || {};
      query.periodTo.$lte = to;
    }
    const docs = await this.statementModel.find(query).sort({ periodFrom: -1 }).lean();
    return docs;
  }

  async getStatementById(id: string) {
    const doc = await this.statementModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Không tìm thấy đối soát');
    return doc;
  }

  async addPaymentToStatement(statementId: string, payment: { amount: number; method?: string; reference?: string; notes?: string; paidAt?: string }) {
    const doc = await this.statementModel.findById(statementId);
    if (!doc) throw new NotFoundException('Không tìm thấy kỳ đối soát');
    if (doc.status === 'closed') throw new BadRequestException('Kỳ đã chốt, không thể thêm thanh toán');

    const paidAt = payment.paidAt ? new Date(payment.paidAt) : new Date();
    const paymentRecord = {
      amount: Number(payment.amount || 0),
      method: payment.method,
      reference: payment.reference,
      notes: payment.notes,
      paidAt,
    };

    if (!doc.payments) doc.payments = [];
    doc.payments.push(paymentRecord as any);
    
    recalcStatementTotals(doc);
    await doc.save();

    // ============ SYNC TO TESTORDER2 (Option B) ============
    // Generate batch ID for this statement payment
    const batchId = this.generateStatementBatchId(statementId);
    const paymentNote = payment.notes || `Thanh toán theo kỳ đối soát ${batchId}`;

    // Sync payment to orders in this period
    const syncResult = await this.syncSupplierPaymentToOrders({
      supplierId: doc.supplierId.toString(),
      periodFrom: doc.periodFrom,
      periodTo: doc.periodTo,
      batchId,
      paidAt,
      paymentNote,
    });

    this.logger.log(`Statement ${statementId}: Payment added and synced ${syncResult.updated} orders`);

    return doc.toObject();
  }

  /**
   * Sync supplier payment to TestOrder2 documents
   * Updates supplierPaymentStatus to 'paid' for orders in the statement period
   */
  private async syncSupplierPaymentToOrders(params: {
    supplierId: string;
    periodFrom: Date;
    periodTo: Date;
    batchId: string;
    paidAt: Date;
    paymentNote?: string;
  }): Promise<{ updated: number }> {
    const { supplierId, periodFrom, periodTo, batchId, paidAt, paymentNote } = params;

    // Tìm các đơn hàng thuộc kỳ đối soát này và chưa thanh toán
    const result = await this.orderModel.updateMany(
      {
        supplierId: new Types.ObjectId(supplierId),
        orderDate: { $gte: periodFrom, $lte: periodTo },
        orderStatus: { $in: COMPLETED_ORDER_STATUSES },
        supplierPaymentStatus: { $ne: PaymentStatus.PAID },
      },
      {
        $set: {
          supplierPaymentStatus: PaymentStatus.PAID,
          supplierPaymentBatchId: batchId,
          supplierPaidAt: paidAt,
          supplierPaymentNote: paymentNote,
        },
      }
    );

    const updated = result.modifiedCount || 0;

    // Tính realized profit cho các đơn đã cập nhật
    if (updated > 0) {
      await this.calculateRealizedProfitForOrders({
        supplierId,
        periodFrom,
        periodTo,
      });
    }

    return { updated };
  }

  /**
   * Calculate realized profit for orders that have both supplier and agent paid.
   * Fix #4: Use atomic updateMany to prevent race conditions when supplier
   * and agent payments are processed near-simultaneously.
   */
  private async calculateRealizedProfitForOrders(params: {
    supplierId: string;
    periodFrom: Date;
    periodTo: Date;
  }): Promise<void> {
    const { supplierId, periodFrom, periodTo } = params;
    const now = new Date();

    // Find eligible orders (both payments settled, not yet realized)
    const orders = await this.orderModel.find({
      supplierId: new Types.ObjectId(supplierId),
      orderDate: { $gte: periodFrom, $lte: periodTo },
      supplierPaymentStatus: PaymentStatus.PAID,
      $or: [
        { agentPaymentStatus: PaymentStatus.PAID },
        { agentPaymentStatus: PaymentStatus.NOT_APPLICABLE },
      ],
      realizedAt: { $exists: false },
    }).lean();

    let updated = 0;
    for (const order of orders) {
      const supplierPaidAmount = order.supplierPaidAmount || 0;
      const agentPaidAmount = order.agentPaidAmount || 0;
      const advertisingCost = order.advertisingCost || 0;
      const laborCost = order.laborCostAllocation || 0;
      const otherCost = order.otherCostAllocation || 0;

      const realizedGrossProfit = supplierPaidAmount - agentPaidAmount;
      const realizedNetProfit = realizedGrossProfit - advertisingCost - laborCost - otherCost;

      // Atomic update with realizedAt guard to prevent race conditions
      const result = await this.orderModel.updateOne(
        { _id: order._id, realizedAt: { $exists: false } },
        { $set: { realizedGrossProfit, realizedNetProfit, realizedAt: now } },
      );
      if (result.modifiedCount > 0) updated++;
    }

    this.logger.log(`Calculated realized profit for ${updated}/${orders.length} orders (supplier path)`);
  }

  /**
   * Generate batch ID for statement payment
   */
  private generateStatementBatchId(statementId: string): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `STMT-NCC-${date}-${statementId.slice(-6)}`;
  }

  async closeStatement(id: string) {
    const doc = await this.statementModel.findById(id);
    if (!doc) throw new NotFoundException('Không tìm thấy đối soát');
    doc.status = 'closed';
    await doc.save();
    return doc.toObject();
  }

  /**
   * Reopen closed statement (Director only)
   * Cho phép Giám đốc mở lại kỳ đã chốt để điều chỉnh
   */
  async reopenStatement(id: string) {
    const doc = await this.statementModel.findById(id);
    if (!doc) throw new NotFoundException('Không tìm thấy đối soát');
    if (doc.status !== 'closed') throw new BadRequestException('Kỳ chưa chốt, không cần mở lại');
    doc.status = 'open';
    await doc.save();
    return doc.toObject();
  }
}
