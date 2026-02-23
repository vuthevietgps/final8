import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
      userId: new Types.ObjectId(userId), // Convert to ObjectId
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
    // Query cả string và ObjectId để handle cả 2 cases (dữ liệu cũ và mới)
    const userOid = new Types.ObjectId(userId);
    let last = await this.model.findOne({ userId: userOid, logoutAt: { $exists: false } }).sort({ loginAt: -1 });
    
    // Fallback: thử query với string (cho dữ liệu cũ)
    if (!last) {
      last = await this.model.findOne({ userId: userId, logoutAt: { $exists: false } }).sort({ loginAt: -1 });
    }
    
    if (last) {
      // Ghi nhận thời gian logout thực tế (không giới hạn)
      last.logoutAt = new Date();
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

  // Đóng tự động các session mở quá 12h (nếu user quên logout)
  @Cron('0 */15 * * * *')
  async autoCloseLongSessions() {
    // Session mở quá 12 tiếng coi như user quên logout
    const maxSessionHours = 12;
    const threshold = new Date(Date.now() - maxSessionHours * 60 * 60 * 1000);
    const longSessions = await this.model.find({ logoutAt: { $exists: false }, loginAt: { $lt: threshold } });
    if (!longSessions.length) return 0;

    const bulk = this.model.bulkWrite(
      longSessions.map(s => ({
        updateOne: {
          filter: { _id: s._id },
          // Set logout = login + 12 tiếng (giả định ca làm tối đa 12 tiếng)
          update: { $set: { logoutAt: new Date(s.loginAt.getTime() + maxSessionHours * 60 * 60 * 1000) } }
        }
      }))
    );

    const res = await bulk;
    this.logger.warn(`Auto-closed ${res.modifiedCount} sessions >${maxSessionHours}h`);
    return res.modifiedCount;
  }
}
