import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LaborStatement, LaborStatementDocument } from './schemas/labor-statement.schema';
import { LaborCost1, LaborCost1Document } from './schemas/labor-cost1.schema';
import { CreateLaborStatementDto } from './dto/create-labor-statement.dto';
import { AddLaborPaymentDto } from './dto/add-labor-payment.dto';
import { UpdateKpiDto } from './dto/update-kpi.dto';
import { SalaryConfigService } from '../salary-config/salary-config.service';
import { FinanceEvents } from '../finance/events/finance-events.constants';

@Injectable()
export class LaborStatementService {
  private readonly logger = new Logger(LaborStatementService.name);

  constructor(
    @InjectModel(LaborStatement.name)
    private readonly statementModel: Model<LaborStatementDocument>,
    @InjectModel(LaborCost1.name)
    private readonly laborCostModel: Model<LaborCost1Document>,
    private readonly salaryConfigService: SalaryConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private parseDateInput(input: string | Date, fieldName: string): Date {
    if (input instanceof Date) {
      if (Number.isNaN(input.getTime())) {
        throw new BadRequestException(`${fieldName} is invalid`);
      }
      return new Date(input);
    }

    const raw = String(input).trim();
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      const y = Number(ymd[1]);
      const m = Number(ymd[2]) - 1;
      const d = Number(ymd[3]);
      const localDate = new Date(y, m, d);
      if (
        localDate.getFullYear() !== y ||
        localDate.getMonth() !== m ||
        localDate.getDate() !== d
      ) {
        throw new BadRequestException(`${fieldName} is invalid`);
      }
      return localDate;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${fieldName} is invalid`);
    }
    return parsed;
  }

  private getDayStart(input: string | Date, fieldName: string): Date {
    const date = this.parseDateInput(input, fieldName);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private getDayEnd(input: string | Date, fieldName: string): Date {
    const date = this.parseDateInput(input, fieldName);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  /**
   * Tạo phiếu thanh toán lương mới
   * Tự động tính tổng từ các phiên làm việc chưa thanh toán trong kỳ
   * Bước 1: Tính attendance bonus, punctuality bonus
   * Bước 2: Director nhập KPI → updateKpi()
   * Bước 3: Confirm → confirmStatement()
   */
  async createStatement(dto: CreateLaborStatementDto) {
    const { employeeId, periodFrom, periodTo, openingBalance, bonus, deduction, notes } = dto;
    const employeeObjectId = new Types.ObjectId(employeeId);
    const periodStart = this.getDayStart(periodFrom, 'periodFrom');
    const periodEnd = this.getDayEnd(periodTo, 'periodTo');

    if (periodEnd < periodStart) {
      throw new BadRequestException('periodTo must be on or after periodFrom');
    }

    // 1. Kiểm tra đã có statement cho period này chưa
    const existing = await this.statementModel.findOne({
      employeeId: employeeObjectId,
      periodFrom: { $lte: periodEnd },
      periodTo: { $gte: periodStart },
    });

    if (existing) {
      throw new BadRequestException('Statement already exists for this period');
    }

    // 2. Lấy tất cả phiên làm việc chưa thanh toán trong kỳ
    const laborCosts = await this.laborCostModel.find({
      userId: employeeObjectId,
      date: {
        $gte: periodStart,
        $lte: periodEnd,
      },
      paymentStatus: 'unpaid', // Chỉ lấy phiên chưa gộp vào statement nào
    });

    // 3. Tính tổng cơ bản
    const periodCost = laborCosts.reduce((sum, cost) => sum + cost.cost, 0);
    const totalWorkHours = laborCosts.reduce((sum, cost) => sum + cost.workHours, 0);
    const sessionCount = laborCosts.length;
    const laborCostIds = laborCosts.map(cost => cost._id);

    // 4. Lấy cấu hình lương để tính bonus
    const salaryConfig = await this.salaryConfigService.findByUserId(employeeId);

    // 5. Tính attendance bonus (thưởng chuyên cần theo số giờ)
    let attendanceBonus = 0;
    if (salaryConfig?.attendanceTiers && salaryConfig.attendanceTiers.length > 0) {
      attendanceBonus = this.salaryConfigService.calculateAttendanceBonus(
        totalWorkHours,
        salaryConfig.attendanceTiers,
      );
    }

    // 6. Tính punctuality bonus (thưởng/phạt đúng giờ)
    let punctualityBonus = 0;
    let onTimeDays = 0;
    let lateDays = 0;
    if (salaryConfig?.punctualityRules) {
      // Lấy startTime từ các phiên làm việc và chuyển thành Date
      // startTime là string "HH:mm", kết hợp với date để tạo Date
      const loginTimes: Date[] = [];
      for (const cost of laborCosts) {
        if (cost.startTime && cost.date) {
          const [hours, minutes] = cost.startTime.split(':').map(Number);
          const loginDate = new Date(cost.date);
          loginDate.setHours(hours, minutes, 0, 0);
          loginTimes.push(loginDate);
        }
      }

      const punctualityResult = this.salaryConfigService.calculatePunctualityBonus(
        loginTimes,
        salaryConfig.punctualityRules,
      );
      punctualityBonus = punctualityResult.net;
      onTimeDays = punctualityResult.onTimeDays;
      lateDays = punctualityResult.lateDays;
    }

    // 7. Tính closing balance (chưa có KPI bonus)
    const totalOwed = (openingBalance || 0) + periodCost + (bonus || 0) + attendanceBonus + punctualityBonus - (deduction || 0);

    // 7.5 Tính dueDate từ periodTo + paymentDays (CFO Spec v3.2)
    const paymentDays = salaryConfig?.paymentDays || [5]; // Mặc định ngày 5
    const periodEndDate = new Date(periodEnd);

    // Tìm ngày thanh toán gần nhất SAU periodTo
    let dueDate: Date;
    const nextMonth = new Date(periodEndDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Lấy ngày thanh toán đầu tiên trong tháng sau
    const payDay = Math.min(...paymentDays);
    dueDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), payDay);

    // Nếu dueDate < periodTo (trường hợp edge), lùi thêm 1 tháng
    if (dueDate <= periodEndDate) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }

    // 8. Tạo statement
    const statement = new this.statementModel({
      employeeId: employeeObjectId,
      periodFrom: periodStart,
      periodTo: periodEnd,
      status: 'draft',
      openingBalance: openingBalance || 0,
      periodCost,
      totalWorkHours,
      sessionCount,
      // KPI fields - chưa có, Director sẽ nhập sau
      kpiPercent: undefined,
      attendanceBonus,
      kpiBonus: 0,
      punctualityBonus,
      onTimeDays,
      lateDays,
      // Other fields
      bonus: bonus || 0,
      deduction: deduction || 0,
      statementPaymentTotal: 0,
      closingBalance: totalOwed,
      notes,
      payments: [],
      laborCostIds,
      dueDate, // CFO Spec v3.2: Ngày đến hạn thanh toán
    });

    const saved = await statement.save();

    // 9. Cập nhật paymentStatus của các phiên làm việc
    await this.laborCostModel.updateMany(
      { _id: { $in: laborCostIds } },
      {
        $set: {
          paymentStatus: 'in_statement',
          statementId: saved._id
        }
      }
    );

    this.logger.log(`Created labor statement ${saved._id} for employee ${employeeId} (attendance: ${attendanceBonus}, punctuality: ${punctualityBonus})`);
    this.eventEmitter.emit(FinanceEvents.LABOR_STATEMENT_UPDATED, {
      statementId: saved._id.toString(),
      amountChanged: true,
    });
    return saved;
  }

  /**
   * Cập nhật KPI cho phiếu lương (Director/Manager nhập)
   * Bước 2 trong workflow: Tạo phiếu → Nhập KPI → Duyệt → Thanh toán
   */
  async updateKpi(statementId: string, dto: UpdateKpiDto) {
    const statement = await this.statementModel.findById(statementId);
    if (!statement) {
      throw new NotFoundException('Statement not found');
    }

    if (statement.status !== 'draft') {
      throw new BadRequestException('Chỉ có thể cập nhật KPI cho phiếu ở trạng thái draft');
    }

    // Lấy cấu hình lương để tính KPI bonus
    const salaryConfig = await this.salaryConfigService.findByUserId(statement.employeeId.toString());

    let kpiBonus = 0;
    if (salaryConfig?.kpiBonusTiers && salaryConfig.kpiBonusTiers.length > 0) {
      kpiBonus = this.salaryConfigService.calculateKpiBonus(
        dto.kpiPercent,
        salaryConfig.kpiBonusTiers,
      );
    }

    // Cập nhật KPI và tính lại closing balance
    statement.kpiPercent = dto.kpiPercent;
    statement.kpiBonus = kpiBonus;
    statement.kpiUpdatedBy = dto.updatedBy;
    statement.kpiUpdatedAt = new Date();

    // Tính lại closing balance (bao gồm KPI bonus)
    const totalOwed = statement.openingBalance + statement.periodCost
      + statement.bonus + statement.attendanceBonus + kpiBonus + statement.punctualityBonus
      - statement.deduction - statement.statementPaymentTotal;
    statement.closingBalance = totalOwed;

    const saved = await statement.save();
    this.logger.log(`Updated KPI for statement ${statementId}: ${dto.kpiPercent}% → bonus ${kpiBonus}`);
    this.eventEmitter.emit(FinanceEvents.LABOR_STATEMENT_UPDATED, {
      statementId,
      amountChanged: true,
    });
    return saved;
  }

  /**
   * Confirm statement (draft → open)
   * Yêu cầu: KPI phải được nhập trước khi confirm
   */
  async confirmStatement(statementId: string, confirmedBy?: string, skipKpiCheck = false) {
    const statement = await this.statementModel.findById(statementId);
    if (!statement) {
      throw new NotFoundException('Statement not found');
    }

    if (statement.status !== 'draft') {
      throw new BadRequestException('Only draft statements can be confirmed');
    }

    // Kiểm tra KPI đã được nhập chưa (trừ khi skip)
    if (!skipKpiCheck && statement.kpiPercent === undefined) {
      throw new BadRequestException('Vui lòng nhập KPI trước khi duyệt phiếu lương');
    }

    statement.status = 'open';
    statement.confirmedAt = new Date();
    statement.confirmedBy = confirmedBy;

    return statement.save();
  }

  /**
   * Thêm thanh toán vào statement
   */
  async addPayment(statementId: string, dto: AddLaborPaymentDto) {
    const statement = await this.statementModel.findById(statementId);
    if (!statement) {
      throw new NotFoundException('Statement not found');
    }

    if (statement.status === 'closed') {
      throw new BadRequestException('Cannot add payment to closed statement');
    }

    // Thêm payment
    statement.payments.push({
      amount: dto.amount,
      paidAt: new Date(dto.paidAt),
      method: dto.method,
      reference: dto.reference,
      notes: dto.notes,
      createdBy: dto.createdBy,
      documents: dto.documents || [],
    });

    // Tính lại tổng thanh toán
    statement.statementPaymentTotal = statement.payments.reduce((sum, p) => sum + p.amount, 0);

    // Tính lại closing balance (bao gồm tất cả bonus)
    const totalOwed = statement.openingBalance + statement.periodCost
      + statement.bonus + statement.attendanceBonus + statement.kpiBonus + statement.punctualityBonus
      - statement.deduction;
    statement.closingBalance = totalOwed - statement.statementPaymentTotal;

    // Nếu đã thanh toán đủ → tự động close
    if (statement.closingBalance <= 0) {
      statement.status = 'closed';
      statement.closedAt = new Date();
      statement.closedBy = dto.createdBy;

      // Cập nhật paymentStatus của các phiên làm việc
      await this.laborCostModel.updateMany(
        { _id: { $in: statement.laborCostIds } },
        {
          $set: {
            paymentStatus: 'paid',
            paid: true,
            paidAt: new Date(dto.paidAt)
          }
        }
      );

      this.logger.log(`Statement ${statementId} auto-closed after payment`);
    }

    const saved = await statement.save();
    this.eventEmitter.emit(FinanceEvents.LABOR_STATEMENT_UPDATED, {
      statementId,
      amountChanged: true,
    });
    return saved;
  }

  /**
   * Close statement manually (open → closed)
   */
  async closeStatement(statementId: string, closedBy?: string) {
    const statement = await this.statementModel.findById(statementId);
    if (!statement) {
      throw new NotFoundException('Statement not found');
    }

    if (statement.status !== 'open') {
      throw new BadRequestException('Only open statements can be closed');
    }

    statement.status = 'closed';
    statement.closedAt = new Date();
    statement.closedBy = closedBy;

    // Cập nhật paymentStatus của các phiên làm việc
    await this.laborCostModel.updateMany(
      { _id: { $in: statement.laborCostIds } },
      {
        $set: {
          paymentStatus: 'paid',
          paid: true,
          paidAt: new Date()
        }
      }
    );

    this.logger.log(`Closed statement ${statementId}`);
    const saved = await statement.save();
    this.eventEmitter.emit(FinanceEvents.LABOR_STATEMENT_CLOSED, {
      statementId,
      oldStatus: 'open',
      newStatus: 'closed',
      amountChanged: false,
    });
    return saved;
  }

  /**
   * Reopen statement (closed → open)
   */
  async reopenStatement(statementId: string) {
    const statement = await this.statementModel.findById(statementId);
    if (!statement) {
      throw new NotFoundException('Statement not found');
    }

    if (statement.status !== 'closed') {
      throw new BadRequestException('Only closed statements can be reopened');
    }

    statement.status = 'open';
    statement.closedAt = undefined;
    statement.closedBy = undefined;

    // Cập nhật paymentStatus của các phiên làm việc về in_statement
    await this.laborCostModel.updateMany(
      { _id: { $in: statement.laborCostIds } },
      {
        $set: {
          paymentStatus: 'in_statement',
          paid: false,
          paidAt: undefined
        }
      }
    );

    this.logger.log(`Reopened statement ${statementId}`);
    const saved = await statement.save();
    this.eventEmitter.emit(FinanceEvents.LABOR_STATEMENT_UPDATED, {
      statementId,
      amountChanged: true,
    });
    return saved;
  }

  /**
   * Delete statement (chỉ xóa được draft)
   */
  async deleteStatement(statementId: string) {
    const statement = await this.statementModel.findById(statementId);
    if (!statement) {
      throw new NotFoundException('Statement not found');
    }

    if (statement.status !== 'draft') {
      throw new BadRequestException('Only draft statements can be deleted');
    }

    // Trả paymentStatus của các phiên về unpaid
    await this.laborCostModel.updateMany(
      { _id: { $in: statement.laborCostIds } },
      { $set: { paymentStatus: 'unpaid' } }
    );

    await this.statementModel.findByIdAndDelete(statementId);
    this.logger.log(`Deleted statement ${statementId}`);

    // Issue 3: Emit event on deletion so snapshot/cache is invalidated (Deletion Events)
    this.eventEmitter.emit(FinanceEvents.LABOR_STATEMENT_UPDATED, { statementId });

    return { deleted: true, id: statementId };
  }

  /**
   * Lấy danh sách statements
   */
  async listStatements(filters?: {
    employeeId?: string;
    status?: string;
    periodFrom?: string;
    periodTo?: string;
  }) {
    const query: any = {};

    if (filters?.employeeId) {
      query.employeeId = new Types.ObjectId(filters.employeeId);
    }
    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.periodFrom || filters?.periodTo) {
      const filterStart = filters.periodFrom
        ? this.getDayStart(filters.periodFrom, 'periodFrom')
        : new Date('1970-01-01T00:00:00.000Z');
      const filterEnd = filters.periodTo
        ? this.getDayEnd(filters.periodTo, 'periodTo')
        : new Date('9999-12-31T23:59:59.999Z');

      query.periodFrom = { $lte: filterEnd };
      query.periodTo = { $gte: filterStart };
    }

    return this.statementModel
      .find(query)
      .populate('employeeId', 'fullName email')
      .sort({ periodFrom: -1 })
      .lean();
  }

  /**
   * Lấy statement theo ID
   */
  async getStatement(statementId: string) {
    const statement = await this.statementModel
      .findById(statementId)
      .populate('employeeId', 'fullName email')
      .lean();

    if (!statement) {
      throw new NotFoundException('Statement not found');
    }

    // Lấy chi tiết các phiên làm việc
    const laborCosts = await this.laborCostModel
      .find({ _id: { $in: statement.laborCostIds } })
      .sort({ date: 1, startTime: 1 })
      .lean();

    return {
      ...statement,
      laborCosts,
    };
  }

  /**
   * Tổng hợp: Tính tổng tiền lương chưa thanh toán (cho Committed Cash)
   */
  async getTotalUnpaidLabor() {
    const result = await this.statementModel.aggregate([
      {
        $match: {
          status: { $in: ['draft', 'open'] } // Chưa close
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$closingBalance' } // Tổng số tiền còn nợ
        }
      }
    ]);

    return result[0]?.total || 0;
  }

  /**
   * Tổng hợp theo nhân viên
   */
  async getSummaryByEmployee() {
    return this.statementModel.aggregate([
      {
        $group: {
          _id: '$employeeId',
          totalStatements: { $sum: 1 },
          totalPeriodCost: { $sum: '$periodCost' },
          totalPaid: { $sum: '$statementPaymentTotal' },
          totalOwed: { $sum: '$closingBalance' },
          openStatements: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
          },
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'employee'
        }
      },
      {
        $unwind: '$employee'
      },
      {
        $project: {
          employeeId: '$_id',
          employeeName: '$employee.fullName',
          totalStatements: 1,
          totalPeriodCost: 1,
          totalPaid: 1,
          totalOwed: 1,
          openStatements: 1,
        }
      },
      {
        $sort: { totalOwed: -1 }
      }
    ]);
  }

  // ============ Summary for Financial Control ============
  // NOTE: Đây là tiền mình trả lương cho nhân viên (Account Payable - AP)

  /**
   * Tổng hợp chi phí lương (Payroll Expense)
   * - Mình phải trả lương cho nhân viên theo kỳ
   * - Đây là Cash Outflow (AP)
   */
  async getCashflowSummary(windowDays: number = 14): Promise<{
    // === TỔNG HỢP GROSS ===
    totalPayrollIncurred: number;     // Lương phát sinh (gross trước khấu trừ)
    totalPayrollBonus: number;        // Thưởng thêm
    totalPayrollDeduction: number;    // Khấu trừ (BHXH, phạt, tạm ứng)

    // === TỔNG HỢP NET ===
    totalPayrollNetPayable: number;   // = incurred + bonus - deduction
    totalPayrollPaid: number;         // Lương đã trả
    totalPayrollUnpaid: number;       // Lương chưa trả = netPayable - paid
    totalPayrollDue14d: number;       // Đến hạn trong 14 ngày (Committed)

    // === CHI TIẾT THEO NHÂN VIÊN ===
    byEmployee: {
      employeeId: string;
      employeeName: string;
      grossAmount: number;            // Lương gross
      deduction: number;              // Khấu trừ
      netAmount: number;              // Net
      unpaid: number;                 // Chưa trả
      due14d: number;                 // Due trong window
      nextDueDate?: string;           // Ngày thanh toán tiếp theo
      lastPaymentDate?: string;       // Lần trả gần nhất
    }[];

    // === SCHEDULE ===
    paymentPolicy: 'biweekly' | 'monthly';
    defaultPayDaysOfMonth: number[];  // [5] hoặc [5, 20]

    // === DUE BY DAY (CFO Spec v3.2 - for Forecast 7D) ===
    dueByDay7d: { date: string; amount: number }[];

    // === METADATA ===
    asOfDate: string;
    timezone: string;
    windowDays: number;
    generatedAt: string;
    totalStatements: number;
    openStatements: number;

    // === WARNINGS ===
    alerts: string[];
  }> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const windowEnd = new Date();
    windowEnd.setDate(windowEnd.getDate() + windowDays);

    // Config mặc định - có thể lấy từ DB/Settings sau này
    const paymentPolicy = 'monthly' as const;
    const defaultPayDaysOfMonth = [5]; // Ngày 5 hàng tháng

    // Tổng hợp từ statements (tất cả trạng thái)
    const statementAgg = await this.statementModel.aggregate([
      {
        $group: {
          _id: null,
          totalStatements: { $sum: 1 },
          openStatements: {
            $sum: { $cond: [{ $in: ['$status', ['draft', 'open', 'approved']] }, 1, 0] }
          },
          totalIncurred: { $sum: '$periodCost' },
          totalBonus: { $sum: { $ifNull: ['$bonus', 0] } },
          totalDeduction: { $sum: { $ifNull: ['$deduction', 0] } },
          totalPaid: { $sum: '$statementPaymentTotal' },
          totalClosingBalance: {
            $sum: {
              $cond: [{ $in: ['$status', ['draft', 'open', 'approved']] }, '$closingBalance', 0]
            }
          },
        }
      }
    ]);

    const stats = statementAgg[0] || {
      totalStatements: 0,
      openStatements: 0,
      totalIncurred: 0,
      totalBonus: 0,
      totalDeduction: 0,
      totalPaid: 0,
      totalClosingBalance: 0,
    };

    // Tính các metrics
    const totalPayrollIncurred = stats.totalIncurred;
    const totalPayrollBonus = stats.totalBonus;
    const totalPayrollDeduction = stats.totalDeduction;
    const totalPayrollNetPayable = totalPayrollIncurred + totalPayrollBonus - totalPayrollDeduction;
    const totalPayrollPaid = stats.totalPaid;
    const totalPayrollUnpaid = Math.max(0, stats.totalClosingBalance);

    // Tính due trong 14 ngày từ statements
    const dueAgg = await this.statementModel.aggregate([
      {
        $match: {
          status: { $in: ['draft', 'open', 'approved'] },
          $or: [
            { dueDate: { $lte: windowEnd } },
            { dueDate: { $exists: false } }, // Chưa có due date -> coi như gấp
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalDue: { $sum: '$closingBalance' },
        },
      },
    ]);

    const totalPayrollDue14d = Math.max(0, dueAgg[0]?.totalDue || 0);

    // === DUE BY DAY 7D (CFO Spec v3.2 - for Forecast 7D) ===
    // Tính tổng closingBalance theo từng ngày dueDate trong 7 ngày tới
    const sevenDaysEnd = new Date();
    sevenDaysEnd.setDate(sevenDaysEnd.getDate() + 7);

    const dueByDayAgg = await this.statementModel.aggregate([
      {
        $match: {
          status: { $in: ['draft', 'open', 'approved'] },
          dueDate: { $exists: true, $gte: now, $lte: sevenDaysEnd },
          closingBalance: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$dueDate' } },
          amount: { $sum: '$closingBalance' },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          amount: 1,
        },
      },
    ]);

    const dueByDay7d: { date: string; amount: number }[] = dueByDayAgg;

    // Chi tiết theo nhân viên (có thêm gross/deduction/net)
    const byEmployeeAgg = await this.statementModel.aggregate([
      {
        $match: {
          status: { $in: ['draft', 'open', 'approved'] },
        },
      },
      {
        $group: {
          _id: '$employeeId',
          grossAmount: { $sum: { $add: ['$periodCost', { $ifNull: ['$bonus', 0] }] } },
          deduction: { $sum: { $ifNull: ['$deduction', 0] } },
          unpaid: { $sum: '$closingBalance' },
          due14d: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $lte: ['$dueDate', windowEnd] },
                    { $eq: [{ $type: '$dueDate' }, 'missing'] },
                  ],
                },
                '$closingBalance',
                0,
              ],
            },
          },
          minDueDate: { $min: '$dueDate' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'employee',
        },
      },
      {
        $unwind: { path: '$employee', preserveNullAndEmptyArrays: true },
      },
      // Lookup last payment from statements
      {
        $lookup: {
          from: 'laborstatements',
          let: { empId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$employeeId', '$$empId'] } } },
            { $unwind: { path: '$payments', preserveNullAndEmptyArrays: true } },
            { $sort: { 'payments.paidAt': -1 } },
            { $limit: 1 },
            { $project: { lastPaymentDate: '$payments.paidAt' } }
          ],
          as: 'lastPayment',
        },
      },
      {
        $project: {
          employeeId: { $toString: '$_id' },
          employeeName: { $ifNull: ['$employee.fullName', 'Unknown'] },
          grossAmount: { $max: [0, '$grossAmount'] },
          deduction: { $max: [0, '$deduction'] },
          netAmount: { $max: [0, { $subtract: ['$grossAmount', '$deduction'] }] },
          unpaid: { $max: [0, '$unpaid'] },
          due14d: { $max: [0, '$due14d'] },
          nextDueDate: {
            $cond: [
              { $gt: ['$minDueDate', null] },
              { $dateToString: { format: '%Y-%m-%d', date: '$minDueDate' } },
              null
            ]
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

    // === WARNINGS ===
    const alerts: string[] = [];

    // Cảnh báo nếu có nhân viên chưa được trả quá hạn
    const overdueEmployees = byEmployeeAgg.filter(e => {
      if (!e.nextDueDate) return false;
      return new Date(e.nextDueDate) < now && e.unpaid > 0;
    });
    if (overdueEmployees.length > 0) {
      const msg = `[Payroll] ${overdueEmployees.length} nhân viên có lương quá hạn chưa trả`;
      this.logger.warn(msg);
      alerts.push(msg);
    }

    // Cảnh báo nếu tổng unpaid lớn
    if (totalPayrollUnpaid > 50000000) { // > 50 triệu
      const msg = `[Payroll] Tổng lương chưa trả: ${totalPayrollUnpaid.toLocaleString('vi-VN')} VNĐ`;
      this.logger.warn(msg);
      alerts.push(msg);
    }

    return {
      // Gross
      totalPayrollIncurred,
      totalPayrollBonus,
      totalPayrollDeduction,
      // Net
      totalPayrollNetPayable,
      totalPayrollPaid,
      totalPayrollUnpaid,
      totalPayrollDue14d,
      // By Employee
      byEmployee: byEmployeeAgg,
      // Schedule
      paymentPolicy,
      defaultPayDaysOfMonth,
      // Due by day (CFO Spec v3.2)
      dueByDay7d,
      // Metadata
      asOfDate: today,
      timezone: 'Asia/Bangkok',
      windowDays,
      generatedAt: now.toISOString(),
      totalStatements: stats.totalStatements,
      openStatements: stats.openStatements,
      // Warnings
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
      totalPaid: summary.totalPayrollPaid,
      totalUnpaid: summary.totalPayrollUnpaid,
      totalPeriodCost: summary.totalPayrollIncurred, // Map to new field name
      totalStatements: summary.totalStatements,
      openStatements: summary.openStatements,
    };
  }
}
