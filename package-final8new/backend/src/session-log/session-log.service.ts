import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SessionLog, SessionLogDocument } from './session-log.schema';

@Injectable()
export class SessionLogService {
  constructor(@InjectModel(SessionLog.name) private model: Model<SessionLogDocument>) {}

  async logLogin(userId: string, loginIp?: string) {
    const log = new this.model({ userId, loginAt: new Date(), loginIp });
    return log.save();
  }

  async logLogout(userId: string) {
    // Tìm session chưa có logoutAt gần nhất và cập nhật
    const last = await this.model.findOne({ userId, logoutAt: { $exists: false } }).sort({ loginAt: -1 });
    if (last) {
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
}
