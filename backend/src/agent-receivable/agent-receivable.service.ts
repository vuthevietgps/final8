import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as dayjs from 'dayjs';
import { AgentStatement, AgentStatementDocument } from './schemas/agent-statement.schema';
import { TestOrder2 } from '../test-order2/schemas/test-order2.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';

// Import constants from test-order2
import { 
  PaymentStatus, 
  AgentRole,
  COMPLETED_ORDER_STATUSES 
} from '../test-order2/constants/test-order2.constants';

@Injectable()
export class AgentReceivableService {
  private readonly logger = new Logger(AgentReceivableService.name);

  constructor(
    @InjectModel(AgentStatement.name) private readonly statementModel: Model<AgentStatementDocument>,
    @InjectModel(TestOrder2.name) private readonly orderModel: Model<TestOrder2>,
  ) {}

  /**
   * Tính công nợ đại lý trực tiếp từ đơn TestOrder2 (không phụ thuộc Summary4).
   * Quy ước: dùng agentQuote nhân quantity; nếu không có, fallback codAmount.
   * Giao thành công => coi như đã thu đủ giá trị kỳ vọng.
   */
  async getAgentReceivableSummary(filter: { agentId?: string; from?: string; to?: string }) {
    const match: any = {
      isActive: { $ne: false },
      productionStatus: 'Đã trả kết quả',
    };

    if (filter?.agentId) {
      match.agentId = new Types.ObjectId(filter.agentId);
    }

    if (filter?.from || filter?.to) {
      match.orderDate = {} as any;
      if (filter.from) match.orderDate.$gte = new Date(filter.from);
      if (filter.to) match.orderDate.$lte = new Date(filter.to);
    }

    const pipeline: any[] = [
      { $match: match },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          _qty: { $ifNull: ['$quantity', 1] },
          _price: { $ifNull: ['$agentQuote', 0] },
          _cod: { $ifNull: ['$codAmount', 0] },
          // Sử dụng trực tiếp từ ordertest2 (đã được tính sẵn)
          _shippingFee: { $ifNull: ['$shippingFee', 0] },
          _returnFee: { $ifNull: ['$returnFee', 0] },
          _isReturnable: { $ifNull: ['$product.isReturnable', true] },
          _isReturnStatus: {
            $regexMatch: {
              input: { $ifNull: ['$orderStatus', ''] },
              regex: /hoàn/i,
            },
          },
        },
      },
      {
        $addFields: {
          quoteAmount: {
            $cond: [
              { $gt: ['$_price', 0] },
              { $multiply: ['$_price', '$_qty'] },
              '$_cod',
            ],
          },
        },
      },
      {
        $addFields: {
          collected: {
            $cond: [
              { $eq: ['$orderStatus', 'Giao thành công'] },
              '$quoteAmount',
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          receivableBase: {
            $cond: [
              '$_isReturnStatus',
              { $cond: ['$_isReturnable', 0, '$quoteAmount'] },
              { $max: [{ $subtract: ['$quoteAmount', '$collected'] }, 0] },
            ],
          },
        },
      },
      {
        $addFields: {
          receivable: {
            $max: [
              { $add: ['$receivableBase', '$_shippingFee', '$_returnFee'] },
              0,
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'agentId',
          foreignField: '_id',
          as: 'agent',
        },
      },
      { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$agentId',
          agentName: { $first: '$agent.fullName' },
          agentEmail: { $first: '$agent.email' },
          role: { $first: '$agent.role' },
          totalOrders: { $sum: 1 },
          totalQuoteAmount: { $sum: '$quoteAmount' },
          collectedAmount: { $sum: '$collected' },
          receivableAmount: { $sum: '$receivable' },
        },
      },
      { $sort: { receivableAmount: -1, totalQuoteAmount: -1 } },
    ];

    const [rows, totalsAgg] = await Promise.all([
      this.orderModel.aggregate(pipeline),
      this.orderModel.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            _qty: { $ifNull: ['$quantity', 1] },
            _price: { $ifNull: ['$agentQuote', 0] },
            _cod: { $ifNull: ['$codAmount', 0] },
            // Sử dụng trực tiếp từ ordertest2 (đã được tính sẵn)
            _shippingFee: { $ifNull: ['$shippingFee', 0] },
            _returnFee: { $ifNull: ['$returnFee', 0] },
            _isReturnable: { $ifNull: ['$product.isReturnable', true] },
            _isReturnStatus: {
              $regexMatch: {
                input: { $ifNull: ['$orderStatus', ''] },
                regex: /hoàn/i,
              },
            },
          },
        },
        {
          $addFields: {
            quoteAmount: {
              $cond: [
                { $gt: ['$_price', 0] },
                { $multiply: ['$_price', '$_qty'] },
                '$_cod',
              ],
            },
            collected: {
              $cond: [
                { $eq: ['$orderStatus', 'Giao thành công'] },
                {
                  $cond: [
                    { $gt: ['$_price', 0] },
                    { $multiply: ['$_price', '$_qty'] },
                    '$_cod',
                  ],
                },
                0,
              ],
            },
          },
        },
        {
          $addFields: {
            receivableBase: {
              $cond: [
                '$_isReturnStatus',
                { $cond: ['$_isReturnable', 0, '$quoteAmount'] },
                { $max: [{ $subtract: ['$quoteAmount', '$collected'] }, 0] },
              ],
            },
          },
        },
        {
          $addFields: {
            receivable: {
              $max: [
                { $add: ['$receivableBase', '$_shippingFee', '$_returnFee'] },
                0,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalQuoteAmount: { $sum: '$quoteAmount' },
            collectedAmount: { $sum: '$collected' },
            receivableAmount: { $sum: '$receivable' },
            totalOrders: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totals = totalsAgg[0] || { totalQuoteAmount: 0, collectedAmount: 0, receivableAmount: 0, totalOrders: 0 };
    return { data: rows, totals };
  }

  async listStatements(agentId?: string, from?: string, to?: string, status?: string) {
    const filter: Record<string, any> = {};
    if (agentId) {
      filter.agentId = new Types.ObjectId(agentId);
    }
    if (status) {
      filter.status = status;
    }
    if (from || to) {
      filter.$or = [];
      if (from) {
        filter.$or.push({ periodFrom: { $gte: new Date(from) } });
      }
      if (to) {
        filter.$or.push({ periodTo: { $lte: new Date(to) } });
      }
      // If both from and to, use AND logic
      if (from && to) {
        delete filter.$or;
        filter.periodFrom = { $gte: new Date(from) };
        filter.periodTo = { $lte: new Date(to) };
      }
    }
    return this.statementModel.find(filter).sort({ periodFrom: -1, createdAt: -1 }).lean();
  }

  async calculateBalances(agentId: Types.ObjectId, periodFrom: Date, periodTo: Date) {
    if (dayjs(periodFrom).isAfter(periodTo)) {
      throw new BadRequestException('periodFrom must be before periodTo');
    }

    const summaryMatch = {
      agentId,
      productionStatus: 'Đã trả kết quả',
      orderDate: { $gte: periodFrom, $lte: periodTo },
    } as any;

    const receivablesAgg = await this.orderModel.aggregate([
      { $match: summaryMatch },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          _qty: { $ifNull: ['$quantity', 1] },
          _price: { $ifNull: ['$agentQuote', 0] },
          _cod: { $ifNull: ['$codAmount', 0] },
          // Sử dụng trực tiếp từ ordertest2 (đã được tính sẵn)
          _shippingFee: { $ifNull: ['$shippingFee', 0] },
          _returnFee: { $ifNull: ['$returnFee', 0] },
          _isReturnable: { $ifNull: ['$product.isReturnable', true] },
          _isReturnStatus: {
            $regexMatch: {
              input: { $ifNull: ['$orderStatus', ''] },
              regex: /hoàn/i,
            },
          },
        },
      },
      {
        $addFields: {
          quoteAmount: {
            $cond: [
              { $gt: ['$_price', 0] },
              { $multiply: ['$_price', '$_qty'] },
              '$_cod',
            ],
          },
          collected: {
            $cond: [
              { $eq: ['$orderStatus', 'Giao thành công'] },
              {
                $cond: [
                  { $gt: ['$_price', 0] },
                  { $multiply: ['$_price', '$_qty'] },
                  '$_cod',
                ],
              },
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          receivableBase: {
            $cond: [
              '$_isReturnStatus',
              { $cond: ['$_isReturnable', 0, '$quoteAmount'] },
              { $max: [{ $subtract: ['$quoteAmount', '$collected'] }, 0] },
            ],
          },
        },
      },
      {
        $addFields: {
          receivable: {
            $max: [
              { $add: ['$receivableBase', '$_shippingFee', '$_returnFee'] },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: '$agentId',
          periodReceivables: { $sum: '$receivable' },
          periodCollected: { $sum: '$collected' },
        },
      },
    ]);

    const periodReceivables = receivablesAgg[0]?.periodReceivables || 0;
    const periodCollected = receivablesAgg[0]?.periodCollected || 0;

    const previousStatement = await this.statementModel
      .findOne({ agentId, status: 'closed' })
      .sort({ periodTo: -1 })
      .lean();
    const openingBalance = previousStatement?.closingBalance || 0;

    const statementPaymentTotal = await this.statementModel
      .aggregate([
        {
          $match: {
            agentId,
            periodFrom: { $gte: periodFrom },
            periodTo: { $lte: periodTo },
          },
        },
        { $unwind: '$payments' },
        { $group: { _id: null, total: { $sum: '$payments.amount' } } },
      ])
      .then((res) => res[0]?.total || 0);

    // periodReceivables đã trừ phần thu được và cộng phí, nên net chính là periodReceivables
    const netAfterDelivery = periodReceivables;
    const closingBalance = openingBalance + netAfterDelivery - statementPaymentTotal;

    return { openingBalance, periodReceivables, periodCollected, statementPaymentTotal, netAfterDelivery, closingBalance };
  }

  async upsertStatement(agentId: string, periodFrom: string, periodTo: string, notes?: string) {
    const agentObjectId = new Types.ObjectId(agentId);
    const from = dayjs(periodFrom).startOf('day').toDate();
    const to = dayjs(periodTo).endOf('day').toDate();

    const balances = await this.calculateBalances(agentObjectId, from, to);

    const statement = await this.statementModel.findOneAndUpdate(
      { agentId: agentObjectId, periodFrom: from, periodTo: to },
      {
        $set: {
          periodFrom: from,
          periodTo: to,
          notes: notes || '',
          status: 'open',
          ...balances,
        },
      },
      { upsert: true, new: true },
    );

    return statement;
  }

  async addPayment(statementId: string, dto: CreatePaymentDto, createdBy?: string) {
    const statement = await this.statementModel.findById(statementId);
    if (!statement) throw new NotFoundException('Statement not found');

    if (statement.status === 'closed') {
      throw new BadRequestException('Statement is closed');
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt as any) : new Date();
    const payment = {
      amount: dto.amount,
      paidAt,
      method: dto.method,
      reference: dto.reference,
      notes: dto.notes,
      createdBy,
      documents: dto.documents || [],
    };

    statement.payments.push(payment);
    statement.statementPaymentTotal = (statement.statementPaymentTotal || 0) + dto.amount;
    statement.closingBalance = (statement.closingBalance || 0) - dto.amount;
    await statement.save();

    // ============ SYNC TO TESTORDER2 (Option B) ============
    // Generate batch ID for this statement payment
    const batchId = this.generateStatementBatchId(statementId);
    const paymentNote = dto.notes || `Thanh toán hoa hồng theo kỳ ${batchId}`;

    // Sync payment to orders in this period
    const syncResult = await this.syncAgentPaymentToOrders({
      agentId: statement.agentId.toString(),
      periodFrom: statement.periodFrom,
      periodTo: statement.periodTo,
      batchId,
      paidAt,
      paymentNote,
    });

    this.logger.log(`Agent Statement ${statementId}: Payment added and synced ${syncResult.updated} orders`);

    return statement;
  }

  /**
   * Sync agent payment to TestOrder2 documents
   * Updates agentPaymentStatus to 'paid' for orders in the statement period
   * CHỈ áp dụng cho EXTERNAL AGENT
   */
  private async syncAgentPaymentToOrders(params: {
    agentId: string;
    periodFrom: Date;
    periodTo: Date;
    batchId: string;
    paidAt: Date;
    paymentNote?: string;
  }): Promise<{ updated: number }> {
    const { agentId, periodFrom, periodTo, batchId, paidAt, paymentNote } = params;

    // Kiểm tra xem agent có phải external agent không
    const agent = await this.orderModel.db.collection('users').findOne({
      _id: new Types.ObjectId(agentId),
      role: AgentRole.EXTERNAL,
    });

    if (!agent) {
      this.logger.warn(`Agent ${agentId} is not external agent, skipping sync`);
      return { updated: 0 };
    }

    // Tìm các đơn hàng thuộc kỳ đối soát này và chưa thanh toán
    const result = await this.orderModel.updateMany(
      {
        agentId: new Types.ObjectId(agentId),
        orderDate: { $gte: periodFrom, $lte: periodTo },
        orderStatus: { $in: COMPLETED_ORDER_STATUSES },
        agentPaymentStatus: PaymentStatus.PENDING,
      },
      {
        $set: {
          agentPaymentStatus: PaymentStatus.PAID,
          agentPaymentBatchId: batchId,
          agentPaidAt: paidAt,
          agentPaymentNote: paymentNote,
        },
      }
    );

    const updated = (result as any).modifiedCount || 0;

    // Tính realized profit cho các đơn đã cập nhật
    if (updated > 0) {
      await this.calculateRealizedProfitForOrders({
        agentId,
        periodFrom,
        periodTo,
      });
    }

    return { updated };
  }

  /**
   * Calculate realized profit for orders that have both supplier and agent paid.
   * Fix #4: Use atomic updateOne to prevent race conditions when supplier
   * and agent payments are processed near-simultaneously.
   */
  private async calculateRealizedProfitForOrders(params: {
    agentId: string;
    periodFrom: Date;
    periodTo: Date;
  }): Promise<void> {
    const { agentId, periodFrom, periodTo } = params;
    const now = new Date();

    // Find eligible orders (both payments settled, not yet realized)
    const orders = await this.orderModel.find({
      agentId: new Types.ObjectId(agentId),
      orderDate: { $gte: periodFrom, $lte: periodTo },
      supplierPaymentStatus: PaymentStatus.PAID,
      agentPaymentStatus: PaymentStatus.PAID,
      realizedAt: { $exists: false },
    }).lean();

    let updated = 0;
    for (const order of orders) {
      const supplierPaidAmount = (order as any).supplierPaidAmount || 0;
      const agentPaidAmount = (order as any).agentPaidAmount || 0;
      const advertisingCost = (order as any).advertisingCost || 0;
      const laborCost = (order as any).laborCostAllocation || 0;
      const otherCost = (order as any).otherCostAllocation || 0;

      const realizedGrossProfit = supplierPaidAmount - agentPaidAmount;
      const realizedNetProfit = realizedGrossProfit - advertisingCost - laborCost - otherCost;

      // Atomic update with realizedAt guard to prevent race conditions
      const result = await this.orderModel.updateOne(
        { _id: order._id, realizedAt: { $exists: false } },
        { $set: { realizedGrossProfit, realizedNetProfit, realizedAt: now } },
      );
      if (result.modifiedCount > 0) updated++;
    }

    this.logger.log(`Calculated realized profit for ${updated}/${orders.length} agent orders (agent path)`);
  }

  /**
   * Generate batch ID for statement payment
   */
  private generateStatementBatchId(statementId: string): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `STMT-AGENT-${date}-${statementId.slice(-6)}`;
  }

  async closeStatement(id: string) {
    const statement = await this.statementModel.findById(id);
    if (!statement) throw new NotFoundException('Statement not found');
    statement.status = 'closed';
    return statement.save();
  }

  async reopenStatement(id: string) {
    const statement = await this.statementModel.findById(id);
    if (!statement) throw new NotFoundException('Statement not found');
    if (statement.status !== 'closed') {
      throw new BadRequestException('Statement is not closed');
    }
    statement.status = 'open';
    return statement.save();
  }

  // ============ Summary for Financial Control ============
  // NOTE: Đây là tiền mình trả đại lý (Account Payable - AP)

  /**
   * Tổng hợp hoa hồng đại lý (Agent Commission Payables)
   * - Mình phải trả hoa hồng cho đại lý sau khi đơn giao thành công
   * - Đây là Cash Outflow (AP), không phải Cash Inflow
   * 
   * CFO Sign-off v3.1:
   * 1. Endpoint nên là /api/agent-payables/ (từ góc nhìn công ty)
   * 2. Tách totalAgentAdjustments riêng (Hoàn/Boom)
   * 3. byAgent có nextDueDate để CFO nhìn nhanh
   * 4. Payment schedule: weekly/biweekly/monthly với dueDate logic
   * 5. Clawback handling: hoàn sau khi trả → carryForwardAdjustment
   */
  async getCashflowSummary(windowDays: number = 14): Promise<{
    // === TỔNG HỢP GROSS ===
    totalAgentCommissionIncurred: number; // Tổng commission đã phát sinh (gross)
    totalAgentAdjustments: number;        // Điều chỉnh từ Hoàn/Boom chưa trả (âm)
    totalAgentClawback: number;           // Hoàn sau khi đã trả → agent nợ lại (dương = agent nợ mình)
    
    // === TỔNG HỢP NET ===
    totalAgentNetPayable: number;         // = incurred + adjustments - clawback
    totalAgentPaid: number;               // Đã trả đại lý
    totalAgentUnpaid: number;             // Còn nợ = netPayable - paid
    totalAgentDue14d: number;             // Đến hạn trong 14 ngày (Committed)
    
    // === CHI TIẾT THEO ĐẠI LÝ ===
    byAgent: {
      agentId: string;
      agentName: string;
      unpaid: number;
      due14d: number;
      clawback: number;                   // Agent nợ lại từ hoàn sau trả
      nextDueDate?: string;               // Ngày thanh toán tiếp theo
      lastPaymentDate?: string;           // Lần trả gần nhất
    }[];
    
    // === SCHEDULE ===
    paymentPolicy: 'weekly' | 'biweekly' | 'monthly' | 'on_demand';
    defaultPayDaysOfMonth?: number[];     // [1, 15] hoặc [5]
    defaultPayWeekdays?: number[];        // [1, 5] = Mon, Fri
    
    // === METADATA ===
    asOfDate: string;
    timezone: string;
    windowDays: number;
    generatedAt: string;
    totalStatements: number;
    openStatements: number;
    
    // === WARNINGS (v1 partial implementation) ===
    clawbackByAgentIncomplete: boolean; // true nếu có clawback nhưng byAgent chưa chính xác 100%
    alerts: string[];                   // Cảnh báo cho FC dashboard
  }> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + windowDays);

    // Config mặc định - có thể lấy từ DB sau này
    const paymentPolicy = 'biweekly' as const;
    const defaultPayDaysOfMonth = [1, 15]; // Ngày 1 và 15 hàng tháng

    // === 1. TỔNG HỢP COMMISSION INCURRED (đơn giao thành công) ===
    // Note: Schema không có field 'agentCommission', dùng agentQuote * quantity
    const incurredAgg = await this.orderModel.aggregate([
      {
        $match: {
          orderStatus: 'Giao thành công',
          agentQuote: { $gt: 0 },
          agentId: { $exists: true, $ne: null },
          isActive: { $ne: false },
        },
      },
      {
        $group: {
          _id: null,
          totalIncurred: { $sum: { $multiply: ['$agentQuote', { $ifNull: ['$quantity', 1] }] } },
        },
      },
    ]);
    const totalAgentCommissionIncurred = incurredAgg[0]?.totalIncurred || 0;

    // === 2. TÍNH ADJUSTMENTS TỪ HOÀN/BOOM CHƯA TRẢ ===
    // Rule CFO: Hoàn trước khi trả → giảm payable (adjustment âm)
    const adjustmentAgg = await this.orderModel.aggregate([
      {
        $match: {
          orderStatus: { $in: ['Hoàn', 'Boom'] },
          agentQuote: { $gt: 0 },
          agentId: { $exists: true, $ne: null },
          // Chỉ tính đơn chưa trả agent
          agentPaymentStatus: { $ne: 'paid' },
          isActive: { $ne: false },
        },
      },
      {
        $group: {
          _id: null,
          totalAdjustments: { $sum: { $multiply: [-1, { $multiply: ['$agentQuote', { $ifNull: ['$quantity', 1] }] }] } },
        },
      },
    ]);
    const totalAgentAdjustments = adjustmentAgg[0]?.totalAdjustments || 0;

    // === 2b. TÍNH CLAWBACK TỪ HOÀN/BOOM ĐÃ TRẢ ===
    // Rule CFO: Hoàn sau khi đã trả → agent nợ lại (clawback dương)
    const clawbackAgg = await this.orderModel.aggregate([
      {
        $match: {
          orderStatus: { $in: ['Hoàn', 'Boom'] },
          agentQuote: { $gt: 0 },
          agentId: { $exists: true, $ne: null },
          // Chỉ tính đơn đã trả agent rồi mới hoàn
          agentPaymentStatus: 'paid',
          isActive: { $ne: false },
        },
      },
      {
        $group: {
          _id: null,
          totalClawback: { $sum: { $multiply: ['$agentQuote', { $ifNull: ['$quantity', 1] }] } }, // Dương = agent nợ mình
        },
      },
    ]);
    const totalAgentClawback = clawbackAgg[0]?.totalClawback || 0;

    // === 3. TỔNG HỢP TỪ STATEMENTS ===
    const statementAgg = await this.statementModel.aggregate([
      {
        $group: {
          _id: null,
          totalStatements: { $sum: 1 },
          openStatements: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
          },
          totalPaid: { $sum: { $ifNull: ['$statementPaymentTotal', 0] } },
          totalClosingBalance: { $sum: { $ifNull: ['$closingBalance', 0] } },
          // Carry forward adjustments từ statements (nếu có)
          totalCarryForward: { $sum: { $ifNull: ['$carryForwardAdjustment', 0] } },
        }
      }
    ]);

    const stats = statementAgg[0] || {
      totalStatements: 0,
      openStatements: 0,
      totalPaid: 0,
      totalClosingBalance: 0,
      totalCarryForward: 0,
    };

    // Tính net và unpaid (CFO: netPayable = incurred + adjustments - clawback)
    // Clawback được trừ vì đó là số agent nợ lại mình
    const totalAgentNetPayable = totalAgentCommissionIncurred + totalAgentAdjustments - totalAgentClawback;
    const totalAgentPaid = stats.totalPaid;
    const totalAgentUnpaid = Math.max(0, totalAgentNetPayable - totalAgentPaid);

    // === 4. TÍNH DUE TRONG 14 NGÀY ===
    // Helper: tính nextDueDate dựa trên payDaysOfMonth
    const getNextDueDate = (orderDate: Date): Date => {
      const d = new Date(orderDate);
      const currentDay = d.getDate();
      const currentMonth = d.getMonth();
      const currentYear = d.getFullYear();
      
      // Tìm ngày thanh toán gần nhất >= orderDate
      for (const payDay of defaultPayDaysOfMonth) {
        if (payDay >= currentDay) {
          return new Date(currentYear, currentMonth, payDay);
        }
      }
      // Nếu không tìm thấy trong tháng này, lấy ngày đầu tiên của tháng sau
      return new Date(currentYear, currentMonth + 1, defaultPayDaysOfMonth[0]);
    };

    const dueAgg = await this.orderModel.aggregate([
      {
        $match: {
          orderStatus: 'Giao thành công',
          agentPaymentStatus: { $ne: 'paid' },
          agentQuote: { $gt: 0 },
          agentId: { $exists: true, $ne: null },
          isActive: { $ne: false },
        },
      },
      {
        $addFields: {
          // Tính dueDate: nếu có field sẵn thì dùng, không thì dùng orderDate + 14
          calculatedDueDate: {
            $ifNull: [
              '$agentPaymentDueDate',
              { $add: ['$orderDate', 14 * 24 * 60 * 60 * 1000] } // +14 days
            ]
          },
          calculatedCommission: { $multiply: ['$agentQuote', { $ifNull: ['$quantity', 1] }] }
        }
      },
      {
        $match: {
          calculatedDueDate: { $lte: windowEnd }
        }
      },
      {
        $group: {
          _id: null,
          totalDue: { $sum: '$calculatedCommission' },
        },
      },
    ]);

    const totalAgentDue14d = dueAgg[0]?.totalDue || 0;

    // === 5. CHI TIẾT THEO ĐẠI LÝ ===
    const byAgentAgg = await this.orderModel.aggregate([
      {
        $match: {
          orderStatus: 'Giao thành công',
          agentPaymentStatus: { $ne: 'paid' },
          agentQuote: { $gt: 0 },
          agentId: { $exists: true, $ne: null },
          isActive: { $ne: false },
        },
      },
      {
        $addFields: {
          calculatedDueDate: {
            $ifNull: [
              '$agentPaymentDueDate',
              { $add: ['$orderDate', 14 * 24 * 60 * 60 * 1000] }
            ]
          },
          calculatedCommission: { $multiply: ['$agentQuote', { $ifNull: ['$quantity', 1] }] }
        }
      },
      {
        $group: {
          _id: '$agentId',
          unpaid: { $sum: '$calculatedCommission' },
          due14d: {
            $sum: {
              $cond: [
                { $lte: ['$calculatedDueDate', windowEnd] },
                '$calculatedCommission',
                0,
              ],
            },
          },
          minDueDate: { $min: '$calculatedDueDate' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agent',
        },
      },
      {
        $unwind: { path: '$agent', preserveNullAndEmptyArrays: true },
      },
      // Lookup last payment from statements
      {
        $lookup: {
          from: 'agentstatements',
          let: { agentId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$agentId', '$$agentId'] } } },
            { $unwind: { path: '$payments', preserveNullAndEmptyArrays: true } },
            { $sort: { 'payments.paymentDate': -1 } },
            { $limit: 1 },
            { $project: { lastPaymentDate: '$payments.paymentDate' } }
          ],
          as: 'lastPayment',
        },
      },
      {
        $project: {
          agentId: { $toString: '$_id' },
          agentName: { $ifNull: ['$agent.fullName', 'Unknown'] },
          unpaid: 1,
          due14d: 1,
          clawback: { $literal: 0 }, // TODO: Tính clawback per agent từ đơn hoàn đã trả
          nextDueDate: {
            $dateToString: { format: '%Y-%m-%d', date: '$minDueDate' }
          },
          lastPaymentDate: {
            $cond: [
              { $gt: [{ $size: '$lastPayment' }, 0] },
              { $dateToString: { format: '%Y-%m-%d', date: { $arrayElemAt: ['$lastPayment.lastPaymentDate', 0] } } },
              null
            ]
          },
        },
      },
      { $sort: { due14d: -1, unpaid: -1 } },
    ]);

    // Enrich byAgent với clawback per agent
    const clawbackByAgentAgg = await this.orderModel.aggregate([
      {
        $match: {
          orderStatus: { $in: ['Hoàn', 'Boom'] },
          agentQuote: { $gt: 0 },
          agentId: { $exists: true, $ne: null },
          agentPaymentStatus: 'paid',
          isActive: { $ne: false },
        },
      },
      {
        $group: {
          _id: '$agentId',
          clawback: { $sum: { $multiply: ['$agentQuote', { $ifNull: ['$quantity', 1] }] } },
        },
      },
    ]);
    
    const clawbackMap = new Map(
      clawbackByAgentAgg.map(c => [c._id?.toString(), c.clawback])
    );
    
    // Merge clawback vào byAgent
    const byAgentWithClawback = byAgentAgg.map(agent => ({
      ...agent,
      clawback: clawbackMap.get(agent.agentId) || 0,
    }));

    // === CFO v1 WARNINGS ===
    // Flag incomplete khi có clawback nhưng aggregate byAgent chưa match 100% với total
    const sumClawbackByAgent = byAgentWithClawback.reduce((sum, a) => sum + a.clawback, 0);
    const clawbackByAgentIncomplete = totalAgentClawback > 0 && Math.abs(sumClawbackByAgent - totalAgentClawback) > 1;
    
    // Log warning nếu có clawback phát sinh
    const alerts: string[] = [];
    if (totalAgentClawback > 0) {
      const warningMsg = `[Agent Payables] Có clawback phát sinh: ${totalAgentClawback.toLocaleString('vi-VN')} VNĐ`;
      this.logger.warn(warningMsg);
      alerts.push(warningMsg);
      
      if (clawbackByAgentIncomplete) {
        const incompleteMsg = `[Agent Payables] Clawback chưa phân bổ chính xác theo agent (diff: ${Math.abs(sumClawbackByAgent - totalAgentClawback).toLocaleString('vi-VN')} VNĐ)`;
        this.logger.warn(incompleteMsg);
        alerts.push(incompleteMsg);
      }
    }

    return {
      // Gross
      totalAgentCommissionIncurred,
      totalAgentAdjustments,
      totalAgentClawback,
      // Net
      totalAgentNetPayable,
      totalAgentPaid,
      totalAgentUnpaid,
      totalAgentDue14d,
      // By Agent
      byAgent: byAgentWithClawback,
      // Schedule
      paymentPolicy,
      defaultPayDaysOfMonth,
      // Metadata
      asOfDate: today,
      timezone: 'Asia/Bangkok',
      windowDays,
      generatedAt: now.toISOString(),
      totalStatements: stats.totalStatements,
      openStatements: stats.openStatements,
      // Warnings (v1)
      clawbackByAgentIncomplete,
      alerts,
    };
  }

  /**
   * @deprecated Use getCashflowSummary() instead
   * Kept for backward compatibility
   */
  async getPaymentSummary() {
    const summary = await this.getCashflowSummary();
    return {
      totalPaid: summary.totalAgentPaid,
      totalUnpaid: summary.totalAgentUnpaid,
      totalStatements: summary.totalStatements,
      openStatements: summary.openStatements,
    };
  }
}
