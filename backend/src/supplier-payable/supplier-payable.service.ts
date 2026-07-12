/**
 * ⚠️ WARNING ON TERMINOLOGY ⚠️
 * Collection: `supplier-payable` (DB name: supplier_payables)
 * Accounting Logic: Account Receivable (AR) — Tiền Nhà Cung Cấp Nợ và PHẢI TRẢ cho công ty
 *   (Thu hộ COD trừ COGS = lợi nhuận NCC giữ hộ, phải truyền về cho hệ thống).
 * Trong công thức Dòng tiền: Đây là INFLOW (Dòng tiền VÀO), không phải OUTFLOW.
 * Tên collection giữ nguyên để tương thích ngược. Không đổi tên DB.
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateSupplierPayableDto } from './dto/create-supplier-payable.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { SupplierPayable, SupplierPayableDocument } from './schemas/supplier-payable.schema';
import { TestOrder2 } from '../test-order2/schemas/test-order2.schema';
import { SupplierStatement, SupplierStatementDocument } from './schemas/supplier-statement.schema';
import { CreateStatementDto } from './dto/create-statement.dto';
import { StatementPdfGenerator } from './generators/statement-pdf.generator';
import { StatementManagementService } from './services/statement-management.service';
import { CsvExportService } from './services/csv-export.service';
import { OrderIntegrationService } from './services/order-integration.service';
import { computeTotals, assertObjectId, buildPeriodFilter } from './helpers/payable.helpers';
import { FinanceEvents } from '../finance/events/finance-events.constants';
import { SystemSettings, SystemSettingsDocument } from '../finance/schemas/system-settings.schema';
import { DEFAULT_CONFIG } from '../finance/interfaces/financial-control.interface';

/**
 * Main service for supplier payables - coordinates between domain services
 *
 * Architecture:
 * - This service: Basic CRUD operations for payables
 * - StatementManagementService: Statement lifecycle management
 * - CsvExportService: Export functionality
 * - OrderIntegrationService: Sync with order system
 * - StatementPdfGenerator: PDF/HTML report generation
 */
@Injectable()
export class SupplierPayableService {
  private readonly logger = new Logger(SupplierPayableService.name);

  constructor(
    @InjectModel(SupplierPayable.name) private model: Model<SupplierPayableDocument>,
    @InjectModel(TestOrder2.name) private orderModel: Model<any>,
    @InjectModel(SupplierStatement.name) private statementModel: Model<SupplierStatementDocument>,
    @InjectModel(SystemSettings.name) private settingsModel: Model<SystemSettingsDocument>,
    private pdfGenerator: StatementPdfGenerator,
    private statementService: StatementManagementService,
    private csvExportService: CsvExportService,
    private orderIntegrationService: OrderIntegrationService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ============ Payable CRUD Operations ============

  async create(dto: CreateSupplierPayableDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Cần ít nhất 1 dòng công nợ');
    }

    const items = dto.items.map(it => ({
      productId: it.productId ? new Types.ObjectId(it.productId) : undefined,
      productNameSnap: it.productNameSnap,
      quantity: Number(it.quantity || 0),
      unitPrice: Number(it.unitPrice || 0),
      amount: it.amount !== undefined
        ? Number(it.amount)
        : Number(it.quantity || 0) * Number(it.unitPrice || 0),
    }));

    const { totalAmount } = computeTotals(items, dto.totalAmount);

    const doc = await this.model.create({
      supplierId: new Types.ObjectId(dto.supplierId),
      supplierNameSnap: dto.supplierNameSnap,
      orderId: dto.orderId ? new Types.ObjectId(dto.orderId) : undefined,
      items,
      totalAmount,
      amountPaid: 0,
      balance: totalAmount,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      notes: dto.notes,
      currency: dto.currency || 'VND',
      status: dto.status || 'unpaid',
      payments: [],
    });

    return doc.toObject();
  }

  async findAll(params: {
    supplierId?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(params.limit) || 50));

    const query: any = {};
    if (params.supplierId) {
      query.supplierId = assertObjectId(params.supplierId, 'supplierId');
    }
    if (params.status) {
      query.status = params.status;
    }
    if (params.from || params.to) {
      query.createdAt = {} as any;
      if (params.from) {
        (query.createdAt as any).$gte = new Date(params.from);
      }
      if (params.to) {
        const to = new Date(params.to);
        to.setHours(23, 59, 59, 999);
        (query.createdAt as any).$lte = to;
      }
    }

    const [total, data] = await Promise.all([
      this.model.countDocuments(query),
      this.model.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: total ? Math.ceil(total / limit) : 0
      }
    };
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) {
      throw new NotFoundException('Không tìm thấy công nợ');
    }
    return doc;
  }

  async addPayment(id: string, dto: AddPaymentDto) {
    throw new BadRequestException(
      'Vui lòng thanh toán theo kỳ đối soát, không thanh toán từng công nợ'
    );
  }

  async statement(params: { supplierId: string; from?: string; to?: string }) {
    if (!params.supplierId) {
      throw new BadRequestException('Thiếu supplierId');
    }

    const supplierObjId = assertObjectId(params.supplierId, 'supplierId');
    const from = params.from ? new Date(params.from) : undefined;
    const to = params.to ? new Date(params.to) : undefined;
    if (to) to.setHours(23, 59, 59, 999);

    const matchSupplier: any = { supplierId: supplierObjId };
    const payableBeforeMatch: any = { ...matchSupplier };
    if (from) payableBeforeMatch.createdAt = { $lt: from };

    const payablePeriodMatch: any = { ...matchSupplier };
    if (from || to) payablePeriodMatch.createdAt = buildPeriodFilter(from, to);

    const [payablesBefore, payablesInPeriod, paymentsBefore, paymentsInPeriod, codInPeriod] =
      await Promise.all([
        this.model.aggregate([
          { $match: payableBeforeMatch },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        this.model.aggregate([
          { $match: payablePeriodMatch },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } },
        ]),
        this.model.aggregate([
          { $match: matchSupplier },
          { $unwind: '$payments' },
          from ? { $match: { 'payments.paidAt': { $lt: from } } } : { $match: {} },
          { $group: { _id: null, total: { $sum: '$payments.amount' } } },
        ]),
        this.model.aggregate([
          { $match: matchSupplier },
          { $unwind: '$payments' },
          (from || to)
            ? { $match: { 'payments.paidAt': buildPeriodFilter(from, to) } }
            : { $match: {} },
          { $group: { _id: null, total: { $sum: '$payments.amount' } } },
        ]),
        this.orderModel.aggregate([
          {
            $match: {
              supplierId: supplierObjId,
              orderStatus: 'Giao thành công',
              ...(from || to ? { updatedAt: buildPeriodFilter(from, to) } : {}),
            },
          },
          {
            $project: {
              codCollected: {
                $cond: [
                  { $gt: ['$codCollectedBySupplier', 0] },
                  '$codCollectedBySupplier',
                  '$codAmount',
                ],
              },
            },
          },
          { $group: { _id: null, total: { $sum: '$codCollected' } } },
        ]),
      ]);

    const openingBalance =
      Number(payablesBefore?.[0]?.total || 0) - Number(paymentsBefore?.[0]?.total || 0);
    const periodPayables = Number(payablesInPeriod?.[0]?.total || 0);
    const periodPayments = Number(paymentsInPeriod?.[0]?.total || 0);
    const periodCodCollected = Number(codInPeriod?.[0]?.total || 0);
    const closingBalance = openingBalance + periodPayables - periodPayments;
    const netAfterCod = periodCodCollected - closingBalance;

    return {
      supplierId: params.supplierId,
      from,
      to,
      openingBalance,
      periodPayables,
      periodPayments,
      periodCodCollected,
      closingBalance,
      netAfterCod,
    };
  }

  async remove(id: string) {
    const res = await this.model.findByIdAndDelete(id).lean();
    if (!res) {
      throw new NotFoundException('Không tìm thấy công nợ');
    }
    return res;
  }

  // ============ Statement Management (delegated) ============

  async upsertStatement(params: CreateStatementDto) {
    return this.statementService.upsertStatement(params);
  }

  async listStatements(params: {
    supplierId?: string;
    from?: string;
    to?: string;
    status?: string
  }) {
    return this.statementService.listStatements(params);
  }

  async getStatement(id: string) {
    return this.statementService.getStatementById(id);
  }

  async addStatementPayment(id: string, dto: AddPaymentDto) {
    const result = await this.statementService.addPaymentToStatement(id, {
      amount: dto.amount,
      method: dto.method,
      reference: dto.reference,
      notes: dto.notes,
      paidAt: dto.paidAt,
    });
    this.eventEmitter.emit(FinanceEvents.SUPPLIER_PAYABLE_UPDATED, {
      recordId: id,
      supplierId: result?.supplierId?.toString() ?? '',
      amountChanged: true,
    });
    return result;
  }

  async closeStatement(id: string) {
    return this.statementService.closeStatement(id);
  }

  /**
   * Reopen closed statement (Director only)
   * Delegate to statement management service
   */
  async reopenStatement(id: string) {
    return this.statementService.reopenStatement(id);
  }

  // ============ CSV Export (delegated) ============

  async exportCsv(params: {
    supplierId?: string;
    from?: string;
    to?: string;
    status?: string
  }) {
    return this.csvExportService.exportCsv(params);
  }

  // ============ Order Integration (delegated) ============

  async upsertForOrder(params: {
    orderId: string;
    supplierId: string;
    items?: {
      productId?: string;
      productNameSnap?: string;
      quantity: number;
      unitPrice: number;
      amount?: number
    }[];
    totalAmount?: number;
    currency?: string;
    notes?: string;
  }) {
    return this.orderIntegrationService.upsertForOrder(params);
  }

  // ============ PDF Generation (delegated) ============

  async generateStatementPDF(id: string): Promise<Buffer> {
    return this.pdfGenerator.generate(id);
  }

  // ============ Summary for Financial Control ============
  // NOTE: Đây là NCC trả tiền cho mình (Account Receivable - AR)
  // grossCommission = codAmount - supplierCost
  // netCommission = grossCommission + adjustments (adjustments có thể âm)
  // CFO Spec v3.1: Ưu tiên adjustments từ statement, basis thống nhất (net)

  /**
   * Tổng hợp hoa hồng NCC (Supplier Settlement)
   * - NCC (Shopee/Lazada) trả tiền cho mình sau khi giao hàng thành công
   * - Đây là Cash Inflow (AR), không phải Cash Outflow
   *
   * CFO Sign-off:
   * 1. Basis thống nhất: unreceived = netEarned - received
   * 2. Adjustments ưu tiên từ statement (tránh double subtract)
   * 3. Forecast dùng netExpected với onTimeRate
   * 4. Có cả gross/net để audit
   */
  async getCashflowSummary(): Promise<{
    // === TỔNG HỢP GROSS ===
    totalCommissionGrossEarned: number; // Gross earned (trước adjustments)
    totalAdjustments: number;           // Điều chỉnh từ statement (hoàn/boom/phí) - số âm

    // === TỔNG HỢP NET ===
    totalCommissionNetEarned: number;   // = grossEarned + adjustments
    totalCommissionReceived: number;    // Hoa hồng đã thu (cash-in đã xảy ra)
    totalCommissionUnreceived: number;  // = netEarned - received

    // === FORECAST 7 NGÀY ===
    totalCommissionExpected7d: number;  // Dự kiến thu 7 ngày tới (net, sau onTimeRate)
    expectedInflowByDay: {
      date: string;
      grossAmount: number;      // Gross expected
      riskAdjustment: number;   // Return risk (âm)
      onTimeAdjustment: number; // Late payment risk (âm)
      netAmount: number;        // = gross + riskAdj + onTimeAdj
      orderCount: number;
    }[];

    // === SHORT-FORM ALIASES ===
    grossEarned: number;
    unreceived: number;
    totalPaid: number;
    netAfterCod: number;

    // === METADATA ===
    asOfDate: string;
    timezone: string;
    settlementCycleDays: number;
    returnRate: number;         // Tỷ lệ hoàn (0-1), tính động hoặc fallback
    onTimeRate: number;         // Tỷ lệ trả đúng hạn (0.7-1.0)
    settlementProfile: {
      type: 'D_PLUS_N' | 'WEEKLY' | 'FIXED_DAYS';
      cycleDays: number;
      payWeekdays?: number[];
    };
    settlementCycleSource: 'financial_control.SupplierCashCycleDays';
    dueDateFallbackCount: number;
    generatedAt: string;
    totalStatements: number;
    openStatements: number;
  }> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const settlementCycleDays = await this.getSupplierCashCycleDays();
    const defaultReturnRate = 0.05; // Fallback 5%
    const defaultOnTimeRate = 0.85; // Fallback 85% trả đúng hạn
    const minSampleSize = 50; // Số đơn tối thiểu để tính return rate động

    // === 1. TÍNH RETURN RATE ĐỘNG ===
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const returnRateAgg = await this.orderModel.aggregate([
      {
        $match: {
          updatedAt: { $gte: thirtyDaysAgo },
          isActive: { $ne: false },
          orderStatus: { $in: ['Giao thành công', 'Hoàn', 'Boom'] }
        }
      },
      {
        $group: {
          _id: null,
          totalDelivered: {
            $sum: { $cond: [{ $eq: ['$orderStatus', 'Giao thành công'] }, 1, 0] }
          },
          totalReturned: {
            $sum: { $cond: [{ $in: ['$orderStatus', ['Hoàn', 'Boom']] }, 1, 0] }
          }
        }
      }
    ]);

    const returnStats = returnRateAgg[0] || { totalDelivered: 0, totalReturned: 0 };
    const totalOrders30d = returnStats.totalDelivered + returnStats.totalReturned;
    const returnRate = totalOrders30d >= minSampleSize
      ? returnStats.totalReturned / totalOrders30d
      : defaultReturnRate;
    const onTimeRate = defaultOnTimeRate; // TODO: Tính từ historical data nếu có

    // === 2. TỔNG HỢP TỪ STATEMENTS (SOURCE OF TRUTH CHO ADJUSTMENTS) ===
    const statementAgg = await this.statementModel.aggregate([
      {
        $group: {
          _id: null,
          totalStatements: { $sum: 1 },
          openStatements: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
          },
          totalReceived: { $sum: { $ifNull: ['$statementPaymentTotal', 0] } },
          totalGrossPayables: { $sum: { $ifNull: ['$periodPayables', 0] } },
          // Adjustments từ statement (ưu tiên source of truth)
          totalStatementAdjustments: { $sum: { $ifNull: ['$adjustments', 0] } },
        }
      }
    ]);

    const stats = statementAgg[0] || {
      totalStatements: 0,
      openStatements: 0,
      totalReceived: 0,
      totalGrossPayables: 0,
      totalStatementAdjustments: 0,
    };

    // === 3. FALLBACK ADJUSTMENTS TỪ ORDERS (chỉ khi CHƯA CÓ statement nào) ===
    // FIX P1: Chỉ fallback khi chưa có statement, không phải khi adjustments = 0
    // Vì adjustments = 0 có thể là giá trị hợp lệ (đã hoàn trả đúng 0)
    let totalAdjustments = stats.totalStatementAdjustments;
    const hasStatements = stats.totalStatements > 0;

    if (!hasStatements) {
      // Chỉ tính từ orders nếu CHƯA CÓ statement nào (bootstrap mode)
      // Sau khi có statement đầu tiên, luôn dùng statement làm source of truth
      const adjustmentAgg = await this.orderModel.aggregate([
        {
          $match: {
            orderStatus: { $in: ['Hoàn', 'Boom'] },
            isActive: { $ne: false },
            supplierId: { $exists: true, $ne: null },
            // Đảm bảo đơn này đã từng được ghi nhận earned
            supplierPaymentStatus: { $exists: true }
          }
        },
        {
          $group: {
            _id: null,
            totalAdjustments: {
              $sum: {
                $multiply: [
                  -1,
                  { $subtract: [
                    { $ifNull: ['$codAmount', 0] },
                    { $multiply: [{ $ifNull: ['$supplierAppliedPrice', 0] }, { $ifNull: ['$quantity', 1] }] }
                  ]}
                ]
              }
            }
          }
        }
      ]);
      totalAdjustments = adjustmentAgg[0]?.totalAdjustments || 0;
    }

    // === 4. TÍNH GROSS EARNED TỪ ĐƠN GIAO THÀNH CÔNG ===
    const grossEarnedAgg = await this.orderModel.aggregate([
      {
        $match: {
          orderStatus: 'Giao thành công',
          isActive: { $ne: false },
          supplierId: { $exists: true, $ne: null },
        }
      },
      {
        $group: {
          _id: null,
          totalGrossEarned: {
            $sum: {
              $subtract: [
                { $ifNull: ['$codAmount', 0] },
                { $multiply: [{ $ifNull: ['$supplierAppliedPrice', 0] }, { $ifNull: ['$quantity', 1] }] }
              ]
            }
          }
        }
      }
    ]);

    const totalCommissionGrossEarned = grossEarnedAgg[0]?.totalGrossEarned || 0;
    const totalCommissionNetEarned = totalCommissionGrossEarned + totalAdjustments;
    const totalCommissionReceived = stats.totalReceived;
    const totalCommissionUnreceived = Math.max(0, totalCommissionNetEarned - totalCommissionReceived);

    // === 5. FORECAST 7 NGÀY VỚI GROSS/RISK/NET ===
    // Fix #7: Hybrid approach - use statement settlement dates when available,
    // fall back to D+N estimation for orders without statements.
    //
    // Business reality: Suppliers pay per statement period (e.g., every 10-15 days),
    // not individually per order. So we check:
    // 1. Open statements with known periodTo → payment expected ~periodTo + 2-3 days
    // 2. Unreceived commission from orders NOT covered by any statement → D+N estimate

    const expectedInflowByDay: {
      date: string;
      grossAmount: number;
      riskAdjustment: number;
      onTimeAdjustment: number;
      netAmount: number;
      orderCount: number;
    }[] = [];

    // 5a. Check open statements with upcoming settlement dates
    const openStatements = await this.statementModel.find({ status: 'open' }).lean();
    const statementInflowByDate = new Map<string, number>();
    const statementEndBySupplier = new Map<string, number>();

    for (const stmt of openStatements) {
      // Expected payment date: periodTo + 3 business days buffer
      const expectedPayDate = new Date(stmt.periodTo);
      expectedPayDate.setDate(expectedPayDate.getDate() + 3);
      const dateStr = expectedPayDate.toISOString().split('T')[0];

      const unpaid = (stmt.closingBalance || 0);
      if (unpaid > 0) {
        statementInflowByDate.set(dateStr, (statementInflowByDate.get(dateStr) || 0) + unpaid);
      }
      const supplierKey = String(stmt.supplierId || '');
      const periodEnd = new Date(stmt.periodTo).getTime();
      if (supplierKey && Number.isFinite(periodEnd)) {
        statementEndBySupplier.set(
          supplierKey,
          Math.max(statementEndBySupplier.get(supplierKey) || 0, periodEnd),
        );
      }
    }

    // Actual supplier receivable ledger is preferred over order-level D+N
    // estimates. An explicit dueDate wins; only missing/invalid due dates use
    // the canonical FinancialControlConfig.SupplierCashCycleDays fallback.
    const outstandingPayables = await this.model
      .find({ status: { $in: ['unpaid', 'partial'] }, balance: { $gt: 0 } })
      .select('supplierId orderId balance totalAmount amountPaid dueDate createdAt updatedAt items')
      .lean();
    const dedupedPayables = this.dedupePayables(outstandingPayables as any[]);
    const linkedOrderIds = Array.from(new Set(
      dedupedPayables
        .map((payable) => String(payable.orderId || ''))
        .filter((value) => Types.ObjectId.isValid(value)),
    )).map((value) => new Types.ObjectId(value));
    const linkedOrders = linkedOrderIds.length
      ? await this.orderModel.find({ _id: { $in: linkedOrderIds } })
        .select('_id supplierId orderDate updatedAt')
        .lean()
      : [];
    const linkedOrdersById = new Map(
      (linkedOrders as any[]).map((order) => [String(order._id), order]),
    );
    const payableInflowByDate = new Map<string, number>();
    const payableCountByDate = new Map<string, number>();
    const payableOrderIds: Types.ObjectId[] = [];
    let dueDateFallbackCount = 0;
    const forecastStart = new Date(now);
    forecastStart.setHours(0, 0, 0, 0);
    const forecastEnd = new Date(forecastStart);
    forecastEnd.setDate(forecastEnd.getDate() + 6);
    forecastEnd.setHours(23, 59, 59, 999);

    for (const rawPayable of dedupedPayables) {
      const payable = rawPayable as any;
      if (payable.orderId && Types.ObjectId.isValid(String(payable.orderId))) {
        payableOrderIds.push(new Types.ObjectId(String(payable.orderId)));
      }

      const createdAt = new Date(payable.createdAt || now);
      const supplierStatementEnd = statementEndBySupplier.get(String(payable.supplierId || ''));
      const linkedOrder = payable.orderId
        ? linkedOrdersById.get(String(payable.orderId))
        : undefined;
      if (supplierStatementEnd) {
        if (!linkedOrder) {
          // Without an order link there is no reliable way to prove that a
          // payable is outside the supplier's open statement. Exclude it
          // fail-closed instead of counting the same receivable twice.
          continue;
        }
        const orderOccurredAt = new Date(linkedOrder.orderDate || linkedOrder.updatedAt || '');
        if (Number.isFinite(orderOccurredAt.getTime())
          && orderOccurredAt.getTime() <= supplierStatementEnd) {
          // Use the underlying order date, not payable.createdAt. This still
          // recognizes statement coverage when the payable row was created late.
          continue;
        }
      }

      const explicitDueDate = new Date(payable.dueDate || '');
      let expectedDate: Date;
      if (payable.dueDate && Number.isFinite(explicitDueDate.getTime())) {
        expectedDate = explicitDueDate;
      } else {
        const fallbackBase = Number.isFinite(createdAt.getTime()) ? createdAt : now;
        expectedDate = new Date(fallbackBase);
        expectedDate.setDate(expectedDate.getDate() + settlementCycleDays);
        dueDateFallbackCount += 1;
      }
      // Overdue receivables are shown as expected today rather than silently
      // disappearing from the seven-day cash forecast.
      if (expectedDate < forecastStart) expectedDate = new Date(forecastStart);
      if (expectedDate > forecastEnd) continue;

      const amount = Math.max(
        0,
        Number(payable.balance ?? (Number(payable.totalAmount || 0) - Number(payable.amountPaid || 0))),
      );
      if (amount <= 0) continue;
      const dateStr = expectedDate.toISOString().split('T')[0];
      payableInflowByDate.set(dateStr, (payableInflowByDate.get(dateStr) || 0) + amount);
      payableCountByDate.set(dateStr, (payableCountByDate.get(dateStr) || 0) + 1);
    }

    // 5b. Get total unreceived commission NOT in a statement for that same
    // supplier/account. Never use one supplier's period as a global cutoff.
    const statementCoverage = Array.from(statementEndBySupplier.entries())
      .map(([supplierId, periodEnd]) => ({
        supplierId: Types.ObjectId.isValid(supplierId)
          ? new Types.ObjectId(supplierId)
          : supplierId,
        periodEnd: new Date(periodEnd),
      }));

    for (let d = 0; d < 7; d++) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + d);
      const dateStr = targetDate.toISOString().split('T')[0];

      let grossAmount = 0;
      let orderCount = 0;

      // Use statement-based inflow if available for this date
      const statementAmount = statementInflowByDate.get(dateStr) || 0;
      const payableAmount = payableInflowByDate.get(dateStr) || 0;

      // D+N fallback: orders delivered settlementCycleDays ago, not in any statement
      const deliveredDate = new Date(targetDate);
      deliveredDate.setDate(deliveredDate.getDate() - settlementCycleDays);
      const startOfDay = new Date(deliveredDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(deliveredDate);
      endOfDay.setHours(23, 59, 59, 999);

      const matchFilter: any = {
        orderStatus: 'Giao thành công',
        supplierPaymentStatus: { $ne: 'paid' },
        updatedAt: { $gte: startOfDay, $lte: endOfDay },
        isActive: { $ne: false },
      };
      // Exclude only orders covered by an open statement for the same supplier.
      if (statementCoverage.length > 0) {
        matchFilter.$nor = statementCoverage.map((coverage) => ({
          supplierId: coverage.supplierId,
          $or: [
            { orderDate: { $lte: coverage.periodEnd } },
            // Legacy orders may not have orderDate. In that case updatedAt is
            // the established settlement fallback and must use the same
            // supplier-scoped coverage boundary.
            { orderDate: null, updatedAt: { $lte: coverage.periodEnd } },
          ],
        }));
      }
      if (payableOrderIds.length > 0) {
        matchFilter._id = { $nin: payableOrderIds };
      }

      const dayAgg = await this.orderModel.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            amount: {
              $sum: {
                $subtract: [
                  { $ifNull: ['$codAmount', 0] },
                  { $multiply: [{ $ifNull: ['$supplierAppliedPrice', 0] }, { $ifNull: ['$quantity', 1] }] }
                ]
              }
            },
            orderCount: { $sum: 1 }
          }
        }
      ]);

      const estimatedOrderAmount = dayAgg[0]?.amount || 0;
      grossAmount = statementAmount + payableAmount + estimatedOrderAmount;
      orderCount = (dayAgg[0]?.orderCount || 0) + (payableCountByDate.get(dateStr) || 0);

      // Payable/statement balances are already reconciled ledger amounts. The
      // return-rate haircut applies only to the order-level estimate.
      const riskAdjustment = estimatedOrderAmount > 0
        ? -estimatedOrderAmount * returnRate
        : 0;
      const afterRisk = grossAmount + riskAdjustment;
      const onTimeAdjustment = -afterRisk * (1 - onTimeRate);
      const netAmount = afterRisk + onTimeAdjustment;

      expectedInflowByDay.push({
        date: dateStr,
        grossAmount,
        riskAdjustment: Math.round(riskAdjustment),
        onTimeAdjustment: Math.round(onTimeAdjustment),
        netAmount: Math.round(netAmount),
        orderCount,
      });
    }

    const totalCommissionExpected7d = expectedInflowByDay.reduce((sum, d) => sum + d.netAmount, 0);

    return {
      // Gross
      totalCommissionGrossEarned,
      totalAdjustments,
      // Net
      totalCommissionNetEarned,
      totalCommissionReceived,
      totalCommissionUnreceived,
      // Forecast
      totalCommissionExpected7d,
      expectedInflowByDay,
      // Short-form aliases for easy access
      grossEarned: totalCommissionGrossEarned,
      unreceived: totalCommissionUnreceived,
      totalPaid: totalCommissionReceived,
      netAfterCod: totalCommissionNetEarned,
      // Metadata
      asOfDate: today,
      timezone: 'Asia/Bangkok',
      settlementCycleDays,
      returnRate: Math.round(returnRate * 10000) / 10000, // 4 decimal places
      onTimeRate,
      settlementProfile: {
        type: 'D_PLUS_N',
        cycleDays: settlementCycleDays,
      },
      settlementCycleSource: 'financial_control.SupplierCashCycleDays',
      dueDateFallbackCount,
      generatedAt: now.toISOString(),
      totalStatements: stats.totalStatements,
      openStatements: stats.openStatements,
    };
  }

  /**
   * Tính aging buckets cho supplier pending payments.
   * Dùng bởi OpsActionService để sinh cảnh báo quá hạn.
   * Query trực tiếp TestOrder2 model (đã inject sẵn).
   */
  async getSupplierAgingSummary(): Promise<{
    aging0_7: { orderCount: number; amount: number };
    aging8_14: { orderCount: number; amount: number };
    aging15plus: { orderCount: number; amount: number };
    bySupplierOverThreshold: {
      supplierId: string;
      supplierName: string;
      pendingAmount: number;
      maxAgingDays: number;
    }[];
  }> {
    const today = new Date();
    const THRESHOLD = 5_000_000;

    const pendingOrders = await this.orderModel.find({
      supplierPaymentStatus: 'pending',
      supplierId: { $exists: true, $ne: null },
      orderStatus: { $in: ['Giao thành công', 'Hàng hoàn'] },
      isActive: { $ne: false },
    }).lean();

    const aging = {
      aging0_7: { orderCount: 0, amount: 0 },
      aging8_14: { orderCount: 0, amount: 0 },
      aging15plus: { orderCount: 0, amount: 0 },
    };

    const supplierMap = new Map<string, { amount: number; maxAgingDays: number }>();

    for (const order of pendingOrders) {
      const amount = ((order as any).supplierQuote || 0) * ((order as any).quantity || 1);
      const dateRef = (order as any).updatedAt || (order as any).orderDate || today;
      const agingDays = Math.floor((today.getTime() - new Date(dateRef).getTime()) / 86400000);
      const supplierId = (order as any).supplierId?.toString() || '';

      if (agingDays <= 7) {
        aging.aging0_7.orderCount++;
        aging.aging0_7.amount += amount;
      } else if (agingDays <= 14) {
        aging.aging8_14.orderCount++;
        aging.aging8_14.amount += amount;
      } else {
        aging.aging15plus.orderCount++;
        aging.aging15plus.amount += amount;
      }

      if (supplierId) {
        const existing = supplierMap.get(supplierId) || { amount: 0, maxAgingDays: 0 };
        supplierMap.set(supplierId, {
          amount: existing.amount + amount,
          maxAgingDays: Math.max(existing.maxAgingDays, agingDays),
        });
      }
    }

    // Lookup supplier names
    const overThresholdIds = Array.from(supplierMap.entries())
      .filter(([, v]) => v.amount > THRESHOLD)
      .map(([id]) => id);

    let supplierNames = new Map<string, string>();
    if (overThresholdIds.length > 0) {
      try {
        const suppliersData = await this.orderModel.db
          .collection('users')
          .find({ _id: { $in: overThresholdIds.map((id) => new (require('mongoose').Types.ObjectId)(id)) } })
          .toArray();
        for (const s of suppliersData) {
          supplierNames.set(s._id.toString(), s.fullName || s.email || 'NCC');
        }
      } catch {
        // Fallback: use ID as name
      }
    }

    const bySupplierOverThreshold = Array.from(supplierMap.entries())
      .filter(([, v]) => v.amount > THRESHOLD)
      .map(([id, v]) => ({
        supplierId: id,
        supplierName: supplierNames.get(id) || id,
        pendingAmount: v.amount,
        maxAgingDays: v.maxAgingDays,
      }))
      .sort((a, b) => b.pendingAmount - a.pendingAmount);

    return { ...aging, bySupplierOverThreshold };
  }

  /**
   * @deprecated Use getCashflowSummary() instead
   * Kept for backward compatibility
   */
  async getPaymentSummary() {
    const summary = await this.getCashflowSummary();
    return {
      totalPaid: summary.totalCommissionReceived,
      totalUnpaid: summary.totalCommissionUnreceived,
      totalExpected: summary.totalCommissionExpected7d,
      totalStatements: summary.totalStatements,
      openStatements: summary.openStatements,
    };
  }

  private dedupePayables(rows: any[]): any[] {
    const byIdentity = new Map<string, any>();
    for (const row of rows || []) {
      const identity = this.payableIdentity(row);
      const current = byIdentity.get(identity);
      if (!current || this.payableVersionTime(row) >= this.payableVersionTime(current)) {
        byIdentity.set(identity, row);
      }
    }
    return Array.from(byIdentity.values());
  }

  private payableIdentity(row: any): string {
    const orderId = String(row?.orderId || '').trim();
    if (Types.ObjectId.isValid(orderId)) return `order:${orderId}`;
    const payableId = String(row?._id || '').trim();
    if (Types.ObjectId.isValid(payableId)) return `payable:${payableId}`;
    // Defensive fallback for imported/legacy rows without a usable Mongo id.
    // The composite is stable and intentionally excludes updatedAt so repeat
    // reads or duplicated fixtures collapse to one logical receivable.
    const itemSignature = (row?.items || [])
      .map((item: any) => [
        String(item?.productId || ''),
        Number(item?.quantity || 0),
        Number(item?.amount ?? (Number(item?.quantity || 0) * Number(item?.unitPrice || 0))),
      ].join(':'))
      .sort()
      .join('|');
    return [
      'legacy',
      String(row?.supplierId || ''),
      this.validDateKey(row?.dueDate),
      this.validDateKey(row?.createdAt),
      Number(row?.totalAmount || 0),
      Number(row?.balance || 0),
      itemSignature,
    ].join(':');
  }

  private payableVersionTime(row: any): number {
    const timestamp = new Date(row?.updatedAt || row?.createdAt || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  private validDateKey(value: unknown): string {
    const date = new Date(value as any);
    return Number.isFinite(date.getTime()) ? date.toISOString() : '';
  }

  private async getSupplierCashCycleDays(): Promise<number> {
    try {
      const setting = await this.settingsModel
        .findOne({ key: 'financial_control' })
        .select('value.SupplierCashCycleDays')
        .lean();
      const configured = Number((setting as any)?.value?.SupplierCashCycleDays);
      if (Number.isInteger(configured) && configured >= 1 && configured <= 365) {
        return configured;
      }
      this.logger.warn(
        '[CASH_CYCLE] Canonical financial_control.SupplierCashCycleDays is missing or invalid; using canonical default',
      );
    } catch {
      this.logger.warn(
        '[CASH_CYCLE] Failed to read canonical financial control config; using canonical default',
      );
    }
    return DEFAULT_CONFIG.SupplierCashCycleDays;
  }
}
