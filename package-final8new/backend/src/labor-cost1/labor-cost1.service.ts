import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LaborCost1, LaborCost1Document } from './schemas/labor-cost1.schema';
import { CreateLaborCost1Dto } from './dto/create-labor-cost1.dto';
import { UpdateLaborCost1Dto } from './dto/update-labor-cost1.dto';
import { SalaryConfig, SalaryConfigDocument } from '../salary-config/schemas/salary-config.schema';
import { SessionLog, SessionLogDocument } from '../session-log/session-log.schema';

@Injectable()
export class LaborCost1Service {
  constructor(
    @InjectModel(LaborCost1.name) private model: Model<LaborCost1Document>,
    @InjectModel(SalaryConfig.name) private salaryModel: Model<SalaryConfigDocument>,
    @InjectModel(SessionLog.name) private sessionLogModel: Model<SessionLogDocument>,
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
    });
    return doc;
  }

  async findAll(): Promise<any[]> {
    return this.model
      .find()
      .populate('userId', 'fullName email role')
      .sort({ date: -1, createdAt: -1 })
      .exec();
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
   * Nhóm các session trong cùng ngày để tính workHours tổng
   */
  async generateFromSessionLogs(userId?: string, date?: string): Promise<any> {
    const filter: any = {};
    if (userId) filter.userId = new Types.ObjectId(userId);
    
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

    // Nhóm sessions theo userId và ngày
    const groupedSessions = new Map<string, any[]>();
    
    for (const session of sessions) {
      const loginDate = this.startOfDay(session.loginAt);
      const userInfo = session.userId as any; // Cast vì populate
      const key = `${userInfo._id}_${loginDate.toISOString()}`;
      
      if (!groupedSessions.has(key)) {
        groupedSessions.set(key, []);
      }
      groupedSessions.get(key)!.push(session);
    }

    const results = [];
    let created = 0;

    for (const [key, dailySessions] of groupedSessions) {
      const [userIdStr, dateStr] = key.split('_');
      const workDate = new Date(dateStr);
      const userId = new Types.ObjectId(userIdStr);
      
      // Kiểm tra đã tồn tại labor-cost1 cho user này trong ngày này chưa
      const existing = await this.model.findOne({
        userId,
        date: workDate
      }).exec();

      if (existing) {
        results.push({
          userId: userIdStr,
          date: workDate,
          status: 'skipped',
          reason: 'Đã tồn tại labor-cost1 cho ngày này'
        });
        continue;
      }

      // Tính toán startTime, endTime và workHours từ tất cả sessions trong ngày
      const firstLogin = dailySessions[0].loginAt;
      const lastLogout = dailySessions[dailySessions.length - 1].logoutAt;
      
      const startTime = this.formatTime(firstLogin);
      const endTime = this.formatTime(lastLogout);
      
      // Tính tổng thời gian làm việc từ tất cả sessions
      let totalWorkHours = 0;
      for (const session of dailySessions) {
        const sessionStart = session.loginAt;
        const sessionEnd = session.logoutAt;
        const sessionHours = (sessionEnd.getTime() - sessionStart.getTime()) / (1000 * 60 * 60);
        totalWorkHours += sessionHours;
      }
      totalWorkHours = Number(totalWorkHours.toFixed(2));

      // Lấy hourly rate từ salary config
      const salary = await this.salaryModel.findOne({ userId }).exec();
      const hourlyRate = salary?.hourlyRate ?? 0;
      const cost = Number((totalWorkHours * hourlyRate).toFixed(2));

      // Tạo labor-cost1 record
      try {
        const laborCost = await this.model.create({
          date: workDate,
          userId,
          startTime,
          endTime,
          workHours: totalWorkHours,
          hourlyRate,
          cost,
          notes: `Tự động tạo từ ${dailySessions.length} session(s)`
        });

        results.push({
          userId: userIdStr,
          userName: (dailySessions[0].userId as any).fullName,
          date: workDate,
          startTime,
          endTime,
          workHours: totalWorkHours,
          hourlyRate,
          cost,
          sessionsCount: dailySessions.length,
          status: 'created',
          id: laborCost._id
        });
        created++;
      } catch (error) {
        results.push({
          userId: userIdStr,
          date: workDate,
          status: 'error',
          error: error.message
        });
      }
    }

    return {
      message: `Đã tạo ${created} labor-cost1 records từ session logs`,
      created,
      total: results.length,
      results
    };
  }

  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
