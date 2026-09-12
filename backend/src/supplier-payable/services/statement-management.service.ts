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
    throw new BadRequestException('Lập bảng đối soát mới tại Công nợ đối tác. Kỳ cũ chỉ dùng tra cứu lịch sử.');
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
    return docs.map(doc=>({...doc,accountingBasis:'legacy_supplier_cod_statement',settlementEligible:false}));
  }

  async getStatementById(id: string) {
    const doc = await this.statementModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Không tìm thấy đối soát');
    return {...doc,accountingBasis:'legacy_supplier_cod_statement',settlementEligible:false};
  }

  async addPaymentToStatement(statementId: string, payment: { amount: number; method?: string; reference?: string; notes?: string; paidAt?: string }) {
    throw new BadRequestException('Ghi thanh toán và phân bổ theo từng đơn tại Công nợ đối tác; không tất toán cả kỳ cũ.');
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
    throw new BadRequestException('Chốt bảng đối soát mới tại Công nợ đối tác; không dùng kỳ cũ để tất toán.');
  }

  /**
   * Reopen closed statement (Director only)
   * Cho phép Giám đốc mở lại kỳ đã chốt để điều chỉnh
   */
  async reopenStatement(id: string) {
    throw new BadRequestException('Kỳ cũ giữ nguyên lịch sử; điều chỉnh bằng chứng từ Sổ kinh doanh.');
  }
}
