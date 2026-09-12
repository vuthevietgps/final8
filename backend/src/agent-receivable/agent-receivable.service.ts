import { businessDay, businessDayRange } from '../common/business-day';
import { Injectable, Logger, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { CounterpartyLedgerService } from '../business-ledger/counterparty-ledger.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as dayjs from 'dayjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentStatement, AgentStatementDocument } from './schemas/agent-statement.schema';
import { TestOrder2 } from '../test-order2/schemas/test-order2.schema';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { FinanceEvents } from '../finance/events/finance-events.constants';

// Import constants from test-order2
import {
  PaymentStatus,
  AgentRole,
  COMPLETED_ORDER_STATUSES,
  RETURN_ORDER_STATUSES,
} from '../test-order2/constants/test-order2.constants';

@Injectable()
export class AgentReceivableService {
  private readonly logger = new Logger(AgentReceivableService.name);

  constructor(
    @InjectModel(AgentStatement.name) private readonly statementModel: Model<AgentStatementDocument>,
    @InjectModel(TestOrder2.name) private readonly orderModel: Model<TestOrder2>,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly counterparties?: CounterpartyLedgerService,
  ) {}

  /**
   * Tính công nợ đại lý trực tiếp từ đơn TestOrder2 (không phụ thuộc Summary4).
   * Dùng giá và phí đã chụp; chỉ giao dịch sổ đã xác nhận làm giảm công nợ.
   */
  async getAgentReceivableSummary(filter: { agentId?: string; from?: string; to?: string }) {
    if (!this.counterparties) throw new BadRequestException('Nguồn công nợ chung chưa được cấu hình.');
    const canonical=await this.counterparties.summary('agent',{partyId:filter.agentId,from:filter.from,to:filter.to});
    const data=canonical.data.map(g=>({_id:g.partyId,agentName:g.name,totalOrders:g.orders.length,
      totalQuoteAmount:g.orders.reduce((n,r)=>n+r.obligation,0),contractualAmount:g.orders.reduce((n,r)=>n+r.obligation,0),
      adjustmentAmount:g.orders.reduce((n,r)=>n+r.adjustments,0),collectedAmount:-g.orders.reduce((n,r)=>n+r.paymentMovement,0),
      receivableAmount:g.net,needsReviewCount:g.reviewCount,receivable:g.receivable,payable:g.payable}));
    return {data,totals:data.reduce((t,r)=>{for(const k of Object.keys(t))t[k]+=r[k]||0;return t;},
      {totalOrders:0,totalQuoteAmount:0,contractualAmount:0,adjustmentAmount:0,collectedAmount:0,receivableAmount:0,needsReviewCount:0}),accountingBasis:canonical.basis};
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
    const statements=await this.statementModel.find(filter).sort({ periodFrom: -1, createdAt: -1 }).lean();
    return statements.map(s=>({...s,accountingBasis:'legacy_agent_commission_statement',settlementEligible:false}));
  }

  async calculateBalances(agentId: Types.ObjectId, periodFrom: Date, periodTo: Date) {
    if(!Number.isFinite(+periodFrom)||!Number.isFinite(+periodTo)||+periodFrom>+periodTo)throw new BadRequestException('Khoảng ngày không hợp lệ.');
    const result=await this.getAgentReceivableSummary({agentId:String(agentId),from:businessDay(periodFrom),to:businessDay(periodTo)});
    return {periodReceivables:result.totals.contractualAmount,periodCollected:result.totals.collectedAmount,
      adjustments:result.totals.adjustmentAmount,closingBalance:result.totals.receivableAmount,
      needsReviewCount:result.totals.needsReviewCount,accountingBasis:'current_balance_of_order_cohort'};
  }

  async upsertStatement(agentId: string, periodFrom: string, periodTo: string, notes?: string) {
    throw new BadRequestException('Lập bảng đối soát tại Công nợ đối tác. Kỳ hoa hồng cũ chỉ dùng tra cứu.');
  }

  async addPayment(_statementId: string, _dto: CreatePaymentDto, _createdBy?: string) {
    throw new BadRequestException('Ghi thu tiền từng đơn trong Công nợ & tiền thực nhận. Phiếu hoa hồng cũ không được dùng để tất toán tiền hàng đại lý.');
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
    throw new BadRequestException('Bảng công nợ cũ chỉ để tra cứu. Xác nhận và tất toán tại Công nợ đối tác.');
  }

  async reopenStatement(id: string) {
    throw new BadRequestException('Bảng công nợ cũ chỉ để tra cứu. Điều chỉnh bằng chứng từ tại Công nợ đối tác.');
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
    paymentSchedule?:any;
    companyReceivable?:number;
    companyPayable?:number;
    netCompanyPosition?:number;
    accountingBasis?:string;
    scheduleConfigured?:boolean;
    legacyFieldsUnavailable?:boolean;
    needsReviewCount?:number;
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
    if(this.counterparties){
      const canonical=await this.counterparties.summary('agent');
      const companyReceivable=canonical.data.reduce((n,g)=>n+g.receivable,0),companyPayable=canonical.data.reduce((n,g)=>n+g.payable,0);
      return {companyReceivable,companyPayable,netCompanyPosition:companyReceivable-companyPayable,needsReviewCount:canonical.data.reduce((n,g)=>n+g.reviewCount,0),accountingBasis:canonical.basis,
        scheduleConfigured:canonical.paymentSchedule?.scheduleConfigured ?? false,paymentSchedule:canonical.paymentSchedule,legacyFieldsUnavailable:true,
        totalAgentCommissionIncurred:null,totalAgentAdjustments:null,totalAgentClawback:null,totalAgentNetPayable:companyPayable,
        totalAgentPaid:null,totalAgentUnpaid:companyPayable,totalAgentDue14d:null,
        byAgent:canonical.data.map(g=>({agentId:g.partyId,agentName:g.name,unpaid:g.payable,due14d:null,clawback:null})),
        paymentPolicy:'on_demand',asOfDate:new Date(Date.now()+7*3600000).toISOString().slice(0,10),timezone:'Asia/Ho_Chi_Minh',windowDays,
        generatedAt:canonical.generatedAt,totalStatements:null,openStatements:null,clawbackByAgentIncomplete:false,
        alerts:['Lịch công nợ hợp nhất nằm trong paymentSchedule; các trường hoa hồng cũ không áp dụng cho công nợ mua bán. Khoản thiếu hạn vẫn được đánh dấu chưa rõ.']};
    }
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
          orderStatus: { $in: COMPLETED_ORDER_STATUSES },
          agentPaidAmount: { $gt: 0 },
          agentId: { $exists: true, $ne: null },
          isActive: { $ne: false },
        },
      },
      {
        $group: {
          _id: null,
          totalIncurred: { $sum: '$agentPaidAmount' },
        },
      },
    ]);
    const totalAgentCommissionIncurred = incurredAgg[0]?.totalIncurred || 0;

    // === 2. TÍNH ADJUSTMENTS TỪ HOÀN/BOOM CHƯA TRẢ ===
    // Rule CFO: Hoàn trước khi trả → giảm payable (adjustment âm)
    const adjustmentAgg = await this.orderModel.aggregate([
      {
        $match: {
          orderStatus: { $in: [...RETURN_ORDER_STATUSES, 'Boom'] },
          agentPaidAmount: { $lt: 0 },
          agentId: { $exists: true, $ne: null },
          // Chỉ tính đơn chưa trả agent
          agentPaymentStatus: { $ne: PaymentStatus.PAID },
          isActive: { $ne: false },
        },
      },
      {
        $group: {
          _id: null,
          totalAdjustments: { $sum: '$agentPaidAmount' },
        },
      },
    ]);
    const totalAgentAdjustments = adjustmentAgg[0]?.totalAdjustments || 0;

    // === 2b. TÍNH CLAWBACK TỪ HOÀN/BOOM ĐÃ TRẢ ===
    // Rule CFO: Hoàn sau khi đã trả → agent nợ lại (clawback dương)
    const clawbackAgg = await this.orderModel.aggregate([
      {
        $match: {
          orderStatus: { $in: [...RETURN_ORDER_STATUSES, 'Boom'] },
          agentPaidAmount: { $lt: 0 },
          agentId: { $exists: true, $ne: null },
          // Chỉ tính đơn đã trả agent rồi mới hoàn
          agentPaymentStatus: PaymentStatus.PAID,
          isActive: { $ne: false },
        },
      },
      {
        $group: {
          _id: null,
          totalClawback: { $sum: { $multiply: [-1, '$agentPaidAmount'] } }, // Dương = agent nợ mình
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
          orderStatus: { $in: COMPLETED_ORDER_STATUSES },
          agentPaymentStatus: { $ne: PaymentStatus.PAID },
          agentPaidAmount: { $gt: 0 },
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
          calculatedCommission: { $ifNull: ['$agentPaidAmount', 0] }
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
          orderStatus: { $in: COMPLETED_ORDER_STATUSES },
          agentPaymentStatus: { $ne: PaymentStatus.PAID },
          agentPaidAmount: { $gt: 0 },
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
          calculatedCommission: { $ifNull: ['$agentPaidAmount', 0] }
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
          orderStatus: { $in: [...RETURN_ORDER_STATUSES, 'Boom'] },
          agentPaidAmount: { $lt: 0 },
          agentId: { $exists: true, $ne: null },
          agentPaymentStatus: PaymentStatus.PAID,
          isActive: { $ne: false },
        },
      },
      {
        $group: {
          _id: '$agentId',
          clawback: { $sum: { $multiply: [-1, '$agentPaidAmount'] } },
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
