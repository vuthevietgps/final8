import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SessionLog, SessionLogDocument } from './session-log.schema';

@Injectable()
export class SessionLogService {
  private readonly logger = new Logger(SessionLogService.name);

  constructor(@InjectModel(SessionLog.name) private model: Model<SessionLogDocument>) {}

  async logLogin(
    userId: string,
    loginIp?: string,
    meta?: { email?: string; fullName?: string; role?: string },
  ) {
    if (!userId) {
      throw new BadRequestException('userId is required to log session');
    }

    const log = new this.model({
      userId,
      userEmail: meta?.email,
      userName: meta?.fullName,
      userRole: meta?.role,
      loginAt: new Date(),
      loginIp,
    });
    return log.save();
  }

  async logLogout(userId: string) {
    // Tìm session chưa có logoutAt gần nhất và cập nhật
    const last = await this.model.findOne({ userId, logoutAt: { $exists: false } }).sort({ loginAt: -1 });
    if (last) {
      const maxLogout = new Date(last.loginAt.getTime() + 4 * 60 * 60 * 1000);
      last.logoutAt = new Date(Math.min(Date.now(), maxLogout.getTime()));
      await last.save();
      return last;
    }
    return null;
  }

  async getUserSessions(userId: string) {
    return this.model.find({ userId }).sort({ loginAt: -1 }).exec();
  }

  async createDemoSessions() {
    // Tạo demo session logs cho test
    const demoSessions = [
      {
        userId: '68b6fc60fb9017d13093a57f', // Vũ Thế Việt
        loginAt: new Date('2025-09-07 08:00:00'),
        logoutAt: new Date('2025-09-07 12:00:00'),
        loginIp: '127.0.0.1'
      },
      {
        userId: '68b6fc60fb9017d13093a57f', // Vũ Thế Việt
        loginAt: new Date('2025-09-07 13:00:00'),
        logoutAt: new Date('2025-09-07 17:30:00'),
        loginIp: '127.0.0.1'
      },
      {
        userId: '68b78688ad578515a6615661', // Test user
        loginAt: new Date('2025-09-07 09:00:00'),
        logoutAt: new Date('2025-09-07 18:00:00'),
        loginIp: '192.168.1.100'
      }
    ];

    const created = await this.model.insertMany(demoSessions);
    return { message: `Đã tạo ${created.length} demo session logs`, created: created.length };
  }

  // Đóng tự động các session mở quá 4h
  @Cron('0 */15 * * * *')
  async autoCloseLongSessions() {
    const threshold = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const longSessions = await this.model.find({ logoutAt: { $exists: false }, loginAt: { $lt: threshold } });
    if (!longSessions.length) return 0;

    const bulk = this.model.bulkWrite(
      longSessions.map(s => ({
        updateOne: {
          filter: { _id: s._id },
          update: { $set: { logoutAt: new Date(s.loginAt.getTime() + 4 * 60 * 60 * 1000) } }
        }
      }))
    );

    const res = await bulk;
    this.logger.warn(`Auto-closed ${res.modifiedCount} sessions >4h`);
    return res.modifiedCount;
  }
}
