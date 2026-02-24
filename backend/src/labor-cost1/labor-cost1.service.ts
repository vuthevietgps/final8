import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { LaborCost1, LaborCost1Document } from './schemas/labor-cost1.schema';
import { CreateLaborCost1Dto } from './dto/create-labor-cost1.dto';
import { UpdateLaborCost1Dto } from './dto/update-labor-cost1.dto';
import { SalaryConfig, SalaryConfigDocument } from '../salary-config/schemas/salary-config.schema';
import { SessionLog, SessionLogDocument } from '../session-log/session-log.schema';
import { FinanceService } from '../finance/finance.service';
import { TestOrder2Service } from '../test-order2/test-order2.service';

@Injectable()
export class LaborCost1Service {
  private readonly logger = new Logger(LaborCost1Service.name);

  private formatDayIso(date: Date, useUtc: boolean): string {
    const year = useUtc ? date.getUTCFullYear() : date.getFullYear();
    const month = String((useUtc ? date.getUTCMonth() : date.getMonth()) + 1).padStart(2, '0');
    const day = String(useUtc ? date.getUTCDate() : date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Generate day keys in both local and UTC calendars to avoid timezone drift
   * when a stored Date was normalized by a different timezone convention.
   */
  private collectDayIsoCandidates(value?: Date | string | null): string[] {
    if (!value) return [];

    const candidates = new Set<string>();
    if (typeof value === 'string') {
      const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) candidates.add(m[1]);
    }

    const date = new Date(value);
    if (isNaN(date.getTime())) return Array.from(candidates);

    candidates.add(this.formatDayIso(date, false));
    candidates.add(this.formatDayIso(date, true));
    return Array.from(candidates);
  }

  private async triggerRecalculateForDates(values: Array<Date | string | null | undefined>): Promise<void> {
    const daySet = new Set<string>();
    for (const value of values) {
      for (const dayIso of this.collectDayIsoCandidates(value ?? null)) {
        daySet.add(dayIso);
      }
    }

    for (const dayIso of daySet) {
      try {
        await this.testOrder2Service.recalculateOrdersForDate(dayIso);
      } catch (error: any) {
        this.logger.error(`Failed to recalculate orders after labor-cost1 change for ${dayIso}`, error);
      }
    }
  }

  constructor(
    @InjectModel(LaborCost1.name) private model: Model<LaborCost1Document>,
    @InjectModel(SalaryConfig.name) private salaryModel: Model<SalaryConfigDocument>,
    @InjectModel(SessionLog.name) private sessionLogModel: Model<SessionLogDocument>,
    private financeService: FinanceService,
    @Inject(forwardRef(() => TestOrder2Service))
    private testOrder2Service: TestOrder2Service,
  ) {}

  private parseTimeToHours(time: string): number {
    const m = time.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) throw new BadRequestException('Sai Ä‘á»‹nh dáº¡ng giá». DÃ¹ng HH:mm');
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) throw new BadRequestException('Giá»/phÃºt khÃ´ng há»£p lá»‡');
    return h + min / 60;
  }

  private calcWorkHours(start: string, end: string): number {
    const s = this.parseTimeToHours(start);
    const e = this.parseTimeToHours(end);
    let diff = e - s;
    if (diff < 0) diff += 24; // qua ngÃ y
    return Math.max(0, Number(diff.toFixed(2)));
  }

  /**
   * Parse date input safely for both:
   * - yyyy-MM-dd (treated as local date)
   * - full ISO datetime
   */
  private parseDateInput(input: string | Date): Date {
    if (input instanceof Date) {
      if (Number.isNaN(input.getTime())) {
        throw new BadRequestException('Invalid date');
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
        throw new BadRequestException('Invalid date');
      }
      return localDate;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    return parsed;
  }

  private startOfDay(input: string | Date): Date {
    const x = this.parseDateInput(input);
    x.setHours(0,0,0,0);
    return x;
  }

  async create(dto: CreateLaborCost1Dto): Promise<LaborCost1> {
    const userId = new Types.ObjectId(dto.userId);
    const date = this.startOfDay(dto.date);
    const workHours = this.calcWorkHours(dto.startTime, dto.endTime);
    const salary = await this.salaryModel.findOne({ userId }).exec();
    const hourlyRate = salary?.hourlyRate ?? 0;
    const cost = Number((workHours * hourlyRate).toFixed(2));
    const doc = await this.model.create({
      date,
      userId,
      startTime: dto.startTime,
      endTime: dto.endTime,
      workHours,
      hourlyRate,
      cost,
      notes: dto.notes,
      sessionCount: 1,
    });
    await this.triggerRecalculateForDates([doc.date as any]);
    return doc;
  }

  async findAll(): Promise<any[]> {
    return this.model
      .find()
      .populate('userId', 'fullName email role managerId')
      .sort({ date: -1, createdAt: -1 })
      .lean();
  }

  async update(id: string, dto: UpdateLaborCost1Dto): Promise<LaborCost1> {
    const existing = await this.model.findById(id).exec();
    if (!existing) throw new NotFoundException('Báº£n ghi khÃ´ng tá»“n táº¡i');

    const patch: any = {};
    if (dto.date) patch.date = this.startOfDay(dto.date);
    if (dto.userId) patch.userId = new Types.ObjectId(dto.userId);
    if (dto.startTime !== undefined) patch.startTime = dto.startTime;
    if (dto.endTime !== undefined) patch.endTime = dto.endTime;
    if (dto.notes !== undefined) patch.notes = dto.notes;

    const newStart = patch.startTime ?? existing.startTime;
    const newEnd = patch.endTime ?? existing.endTime;
    const newUser = patch.userId ?? existing.userId;
    const workHours = this.calcWorkHours(newStart, newEnd);
    const salary = await this.salaryModel.findOne({ userId: newUser }).exec();
    const hourlyRate = salary?.hourlyRate ?? existing.hourlyRate;
    const cost = Number((workHours * hourlyRate).toFixed(2));
    patch.workHours = workHours;
    patch.hourlyRate = hourlyRate;
    patch.cost = cost;

    const doc = await this.model.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec();
    await this.triggerRecalculateForDates([existing.date as any, doc?.date as any]);
    return doc as LaborCost1;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.model.findById(id).exec();
    if (!existing) throw new NotFoundException('Labor cost record not found');

    await this.model.findByIdAndDelete(id).exec();
    await this.triggerRecalculateForDates([existing.date as any]);
  }

  /**
   * Táº¡o labor-cost1 records tá»« session logs
   * Má»—i phiÃªn Ä‘Äƒng nháº­p/Ä‘Äƒng xuáº¥t táº¡o 1 báº£n ghi riÃªng
   */
  async generateFromSessionLogs(userId?: string, date?: string): Promise<any> {
    const filter: any = {};
    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    } else {
      // Bá» qua session logs khÃ´ng gáº¯n user
      filter.userId = { $exists: true, $ne: null } as any;
    }
    
    // Lá»c theo ngÃ y náº¿u cÃ³
    if (date) {
      const targetDate = this.startOfDay(date);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.loginAt = { $gte: targetDate, $lt: nextDay };
    }

    // Láº¥y táº¥t cáº£ session logs cÃ³ logout
    const sessions = await this.sessionLogModel
      .find({ ...filter, logoutAt: { $exists: true, $ne: null } })
      .populate('userId', 'fullName email role')
      .sort({ loginAt: 1 })
      .exec();

    if (sessions.length === 0) {
      return { message: 'KhÃ´ng tÃ¬m tháº¥y session logs hoÃ n chÃ¬nh Ä‘á»ƒ táº¡o labor cost', created: 0 };
    }

    const results = [];
    let created = 0;
    const affectedDates = new Set<string>();

    // Táº¡o 1 báº£n ghi cho má»—i session
    for (const session of sessions) {
      const userInfo = session.userId as any;
      if (!userInfo?._id) {
        results.push({ 
          status: 'skipped', 
          reason: 'Session thiáº¿u userId', 
          sessionId: session._id 
        });
        continue;
      }

      const userId = new Types.ObjectId(userInfo._id);
      const loginDate = this.startOfDay(session.loginAt);
      const startTime = this.formatTime(session.loginAt);
      const endTime = this.formatTime(session.logoutAt);
      
      // TÃ­nh workHours tá»« thá»i gian thá»±c táº¿ cá»§a session
      const workHours = Number(
        ((session.logoutAt.getTime() - session.loginAt.getTime()) / (1000 * 60 * 60)).toFixed(2)
      );

      // Kiá»ƒm tra Ä‘Ã£ tá»“n táº¡i labor-cost1 cho session nÃ y chÆ°a
      // TrÃ¡nh táº¡o trÃ¹ng báº±ng cÃ¡ch check theo loginAt vÃ  userId
      const existing = await this.model.findOne({
        userId,
        date: loginDate,
        startTime,
        endTime
      }).exec();

      if (existing) {
        results.push({
          sessionId: session._id,
          userId: userInfo._id,
          userName: userInfo.fullName,
          date: loginDate,
          startTime,
          endTime,
          status: 'skipped',
          reason: 'ÄÃ£ tá»“n táº¡i labor-cost1 cho phiÃªn nÃ y'
        });
        continue;
      }

      // Láº¥y hourly rate tá»« salary config
      const salary = await this.salaryModel.findOne({ userId }).exec();
      const hourlyRate = salary?.hourlyRate ?? 0;
      const cost = Number((workHours * hourlyRate).toFixed(2));

      // Táº¡o labor-cost1 record cho phiÃªn nÃ y
      try {
        const laborCost = await this.model.create({
          date: loginDate,
          userId,
          startTime,
          endTime,
          workHours,
          hourlyRate,
          cost,
          notes: `Tá»± Ä‘á»™ng tá»« session ${session._id}`,
          sessionCount: 1,
        });

        results.push({
          sessionId: session._id,
          userId: userInfo._id,
          userName: userInfo.fullName,
          date: loginDate,
          startTime,
          endTime,
          workHours,
          hourlyRate,
          cost,
          status: 'created',
          id: laborCost._id
        });
        created++;
        affectedDates.add(loginDate.toISOString().slice(0, 10));
      } catch (error) {
        results.push({
          sessionId: session._id,
          userId: userInfo._id,
          date: loginDate,
          status: 'error',
          error: error.message
        });
      }
    }

    await this.triggerRecalculateForDates(Array.from(affectedDates));

    return {
      message: `ÄÃ£ táº¡o ${created}/${sessions.length} labor-cost1 records tá»« session logs`,
      created,
      total: sessions.length,
      results
    };
  }

  async markPaid(id: string) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Báº£n ghi khÃ´ng tá»“n táº¡i');
    if (doc.paid) return doc;

    // Ghi nháº­n chi ra quá»¹ lÆ°Æ¡ng
    await this.financeService.createCashflow({
      direction: 'out',
      sourceType: 'other',
      amount: doc.cost,
      category: 'salary',
      referenceId: String(doc._id),
      description: `Thanh toÃ¡n lÆ°Æ¡ng ${doc.workHours}h`,
    } as any);

    doc.paid = true;
    doc.paidAt = new Date();
    await doc.save();
    return doc.toObject();
  }

  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Cron job: Tá»± Ä‘á»™ng táº¡o labor-cost1 tá»« session logs má»—i ngÃ y lÃºc 00:30
   * Táº¡o cho ngÃ y hÃ´m trÆ°á»›c (cÃ¡c session Ä‘Ã£ Ä‘Ã³ng)
   */
  @Cron('0 30 0 * * *')
  async autoGenerateLaborCostFromSessions() {
    this.logger.log('ðŸ• Starting auto-generate labor costs from session logs...');
    
    // TÃ­nh ngÃ y hÃ´m qua
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    
    try {
      const result = await this.generateFromSessionLogs(undefined, dateStr);
      this.logger.log(`âœ… Auto-generated labor costs: ${result.created}/${result.total} records for ${dateStr}`);
      return result;
    } catch (error) {
      this.logger.error(`âŒ Auto-generate labor costs failed:`, error);
      throw error;
    }
  }

  /**
   * GET /labor-cost1/summary/cards
   * Tá»•ng quan 4 cards: Unassigned / In Statement / Paid / Overdue+Due14d
   */
  async getSummaryCards() {
    const now = new Date();
    const in14Days = new Date(now);
    in14Days.setDate(in14Days.getDate() + 14);

    // 1. ChÆ°a vÃ o phiáº¿u (Unassigned)
    const unassigned = await this.model.aggregate([
      {
        $match: {
          statementId: { $exists: false },
          paid: { $ne: true }
        }
      },
      {
        $group: {
          _id: null,
          amount: { $sum: '$cost' },
          sessionCount: { $sum: 1 }
        }
      }
    ]).exec();

    // 2. Äang trong phiáº¿u (In Statement - Open)
    const inStatement = await this.model.aggregate([
      {
        $match: {
          statementId: { $exists: true },
          paymentStatus: { $in: ['in_statement', 'unpaid'] },
          paid: { $ne: true }
        }
      },
      {
        $group: {
          _id: null,
          amount: { $sum: '$cost' },
          sessionCount: { $sum: 1 }
        }
      }
    ]).exec();

    // 3. ÄÃ£ chi (Paid)
    const paid = await this.model.aggregate([
      {
        $match: {
          paid: true
        }
      },
      {
        $group: {
          _id: null,
          amount: { $sum: '$cost' },
          sessionCount: { $sum: 1 }
        }
      }
    ]).exec();

    // 4. Overdue & Due in 14 days (dá»±a vÃ o statements)
    const LaborStatementModel = this.model.db.model('LaborStatement');
    const overdueStatements = await LaborStatementModel.aggregate([
      {
        $match: {
          status: 'open',
          periodTo: { $lt: now },
          closingBalance: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          overdueAmount: { $sum: '$closingBalance' },
          overdueCount: { $sum: 1 }
        }
      }
    ]).exec();

    const due14dStatements = await LaborStatementModel.aggregate([
      {
        $match: {
          status: 'open',
          periodTo: { $gte: now, $lte: in14Days },
          closingBalance: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          due14dAmount: { $sum: '$closingBalance' },
          due14dCount: { $sum: 1 }
        }
      }
    ]).exec();

    return {
      unassigned: {
        amount: unassigned[0]?.amount || 0,
        sessionCount: unassigned[0]?.sessionCount || 0
      },
      inStatement: {
        amount: inStatement[0]?.amount || 0,
        sessionCount: inStatement[0]?.sessionCount || 0
      },
      paid: {
        amount: paid[0]?.amount || 0,
        sessionCount: paid[0]?.sessionCount || 0
      },
      overdue: {
        amount: overdueStatements[0]?.overdueAmount || 0,
        statementCount: overdueStatements[0]?.overdueCount || 0
      },
      due14d: {
        amount: due14dStatements[0]?.due14dAmount || 0,
        statementCount: due14dStatements[0]?.due14dCount || 0
      }
    };
  }
}


