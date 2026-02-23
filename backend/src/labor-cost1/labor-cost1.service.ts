import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { LaborCost1, LaborCost1Document } from './schemas/labor-cost1.schema';
import { CreateLaborCost1Dto } from './dto/create-labor-cost1.dto';
import { UpdateLaborCost1Dto } from './dto/update-labor-cost1.dto';
import { SalaryConfig, SalaryConfigDocument } from '../salary-config/schemas/salary-config.schema';
import { SessionLog, SessionLogDocument } from '../session-log/session-log.schema';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class LaborCost1Service {
  private readonly logger = new Logger(LaborCost1Service.name);

  constructor(
    @InjectModel(LaborCost1.name) private model: Model<LaborCost1Document>,
    @InjectModel(SalaryConfig.name) private salaryModel: Model<SalaryConfigDocument>,
    @InjectModel(SessionLog.name) private sessionLogModel: Model<SessionLogDocument>,
    private financeService: FinanceService,
  ) {}

  private parseTimeToHours(time: string): number {
    const m = time.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) throw new BadRequestException('Sai định dạng giờ. Dùng HH:mm');
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) throw new BadRequestException('Giờ/phút không hợp lệ');
    return h + min / 60;
  }

  private calcWorkHours(start: string, end: string): number {
    const s = this.parseTimeToHours(start);
    const e = this.parseTimeToHours(end);
    let diff = e - s;
    if (diff < 0) diff += 24; // qua ngày
    return Math.max(0, Number(diff.toFixed(2)));
  }

  private startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0,0,0,0);
    return x;
  }

  async create(dto: CreateLaborCost1Dto): Promise<LaborCost1> {
    const userId = new Types.ObjectId(dto.userId);
    const date = this.startOfDay(new Date(dto.date));
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
    if (!existing) throw new NotFoundException('Bản ghi không tồn tại');

    const patch: any = {};
    if (dto.date) patch.date = this.startOfDay(new Date(dto.date));
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
    return doc as LaborCost1;
  }

  async remove(id: string): Promise<void> {
    await this.model.findByIdAndDelete(id).exec();
  }

  /**
   * Tạo labor-cost1 records từ session logs
   * Mỗi phiên đăng nhập/đăng xuất tạo 1 bản ghi riêng
   */
  async generateFromSessionLogs(userId?: string, date?: string): Promise<any> {
    const filter: any = {};
    if (userId) {
      filter.userId = new Types.ObjectId(userId);
    } else {
      // Bỏ qua session logs không gắn user
      filter.userId = { $exists: true, $ne: null } as any;
    }
    
    // Lọc theo ngày nếu có
    if (date) {
      const targetDate = this.startOfDay(new Date(date));
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.loginAt = { $gte: targetDate, $lt: nextDay };
    }

    // Lấy tất cả session logs có logout
    const sessions = await this.sessionLogModel
      .find({ ...filter, logoutAt: { $exists: true, $ne: null } })
      .populate('userId', 'fullName email role')
      .sort({ loginAt: 1 })
      .exec();

    if (sessions.length === 0) {
      return { message: 'Không tìm thấy session logs hoàn chình để tạo labor cost', created: 0 };
    }

    const results = [];
    let created = 0;

    // Tạo 1 bản ghi cho mỗi session
    for (const session of sessions) {
      const userInfo = session.userId as any;
      if (!userInfo?._id) {
        results.push({ 
          status: 'skipped', 
          reason: 'Session thiếu userId', 
          sessionId: session._id 
        });
        continue;
      }

      const userId = new Types.ObjectId(userInfo._id);
      const loginDate = this.startOfDay(session.loginAt);
      const startTime = this.formatTime(session.loginAt);
      const endTime = this.formatTime(session.logoutAt);
      
      // Tính workHours từ thời gian thực tế của session
      const workHours = Number(
        ((session.logoutAt.getTime() - session.loginAt.getTime()) / (1000 * 60 * 60)).toFixed(2)
      );

      // Kiểm tra đã tồn tại labor-cost1 cho session này chưa
      // Tránh tạo trùng bằng cách check theo loginAt và userId
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
          reason: 'Đã tồn tại labor-cost1 cho phiên này'
        });
        continue;
      }

      // Lấy hourly rate từ salary config
      const salary = await this.salaryModel.findOne({ userId }).exec();
      const hourlyRate = salary?.hourlyRate ?? 0;
      const cost = Number((workHours * hourlyRate).toFixed(2));

      // Tạo labor-cost1 record cho phiên này
      try {
        const laborCost = await this.model.create({
          date: loginDate,
          userId,
          startTime,
          endTime,
          workHours,
          hourlyRate,
          cost,
          notes: `Tự động từ session ${session._id}`,
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

    return {
      message: `Đã tạo ${created}/${sessions.length} labor-cost1 records từ session logs`,
      created,
      total: sessions.length,
      results
    };
  }

  async markPaid(id: string) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Bản ghi không tồn tại');
    if (doc.paid) return doc;

    // Ghi nhận chi ra quỹ lương
    await this.financeService.createCashflow({
      direction: 'out',
      sourceType: 'other',
      amount: doc.cost,
      category: 'salary',
      referenceId: String(doc._id),
      description: `Thanh toán lương ${doc.workHours}h`,
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
   * Cron job: Tự động tạo labor-cost1 từ session logs mỗi ngày lúc 00:30
   * Tạo cho ngày hôm trước (các session đã đóng)
   */
  @Cron('0 30 0 * * *')
  async autoGenerateLaborCostFromSessions() {
    this.logger.log('🕐 Starting auto-generate labor costs from session logs...');
    
    // Tính ngày hôm qua
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    
    try {
      const result = await this.generateFromSessionLogs(undefined, dateStr);
      this.logger.log(`✅ Auto-generated labor costs: ${result.created}/${result.total} records for ${dateStr}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Auto-generate labor costs failed:`, error);
      throw error;
    }
  }

  /**
   * GET /labor-cost1/summary/cards
   * Tổng quan 4 cards: Unassigned / In Statement / Paid / Overdue+Due14d
   */
  async getSummaryCards() {
    const now = new Date();
    const in14Days = new Date(now);
    in14Days.setDate(in14Days.getDate() + 14);

    // 1. Chưa vào phiếu (Unassigned)
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

    // 2. Đang trong phiếu (In Statement - Open)
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

    // 3. Đã chi (Paid)
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

    // 4. Overdue & Due in 14 days (dựa vào statements)
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

