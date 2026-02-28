/**
 * File: emergency-action/emergency-action.service.ts
 * Mục đích: Service quản lý trạng thái task khẩn cấp Ads Budget.
 * - CRUD task logs (upsert theo date+taskId)
 * - Toggle done/undone + trigger verification
 * - Cron check quá hạn → push SSE alert
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import {
  EmergencyActionLog,
  EmergencyActionLogDocument,
} from './schemas/emergency-action-log.schema';
import {
  EmergencyActionVerificationService,
} from './emergency-action-verification.service';
import { AdsAlertsEventsService } from '../ads-alerts/ads-alerts-events.service';

export interface BulkSyncTaskDto {
  taskId: string;
  taskType: string;
  priority: string;
  platform: string;
  adGroupId?: string;
  adGroupName?: string;
  actionText: string;
  reason: string;
  deadline: string;
  currentSpend?: number;
  targetSpend?: number;
}

@Injectable()
export class EmergencyActionService {
  private readonly logger = new Logger(EmergencyActionService.name);

  constructor(
    @InjectModel(EmergencyActionLog.name)
    private readonly model: Model<EmergencyActionLogDocument>,
    private readonly verificationService: EmergencyActionVerificationService,
    private readonly alertsEventsService: AdsAlertsEventsService,
  ) {}

  /**
   * Lấy tất cả tasks của 1 ngày
   */
  async getByDate(date: string) {
    return this.model.find({ date }).sort({ priority: -1 }).lean().exec();
  }

  /**
   * Bulk upsert tasks cho 1 ngày (frontend gửi toàn bộ tasks sau khi build).
   * Chỉ tạo mới nếu chưa có, giữ nguyên done/verification nếu đã có.
   */
  async bulkSync(
    date: string,
    tasks: BulkSyncTaskDto[],
  ): Promise<{ upserted: number; existing: number }> {
    let upserted = 0;
    let existing = 0;

    for (const task of tasks) {
      const result = await this.model.updateOne(
        { date, taskId: task.taskId },
        {
          $setOnInsert: {
            date,
            taskId: task.taskId,
            taskType: task.taskType,
            priority: task.priority,
            platform: task.platform,
            adGroupId: task.adGroupId,
            adGroupName: task.adGroupName,
            actionText: task.actionText,
            reason: task.reason,
            deadline: task.deadline,
            currentSpend: task.currentSpend,
            targetSpend: task.targetSpend,
            done: false,
            verificationStatus: 'pending',
          },
        },
        { upsert: true },
      );

      if (result.upsertedCount > 0) {
        upserted++;
      } else {
        existing++;
      }
    }

    return { upserted, existing };
  }

  /**
   * Toggle done/undone 1 task + trigger verification nếu done=true
   */
  async toggleDone(
    date: string,
    taskId: string,
    userId?: string,
    userName?: string,
  ): Promise<EmergencyActionLogDocument | null> {
    const task = await this.model.findOne({ date, taskId });
    if (!task) return null;

    const newDone = !task.done;
    task.done = newDone;

    if (newDone) {
      task.doneAt = new Date();
      if (userId) task.doneBy = userId as any;
      if (userName) task.doneByName = userName;

      // Trigger verification async (không block response)
      this.runVerification(task).catch((err) =>
        this.logger.warn(`Verification error for ${taskId}: ${err?.message}`),
      );
    } else {
      // Undo
      task.doneAt = undefined;
      task.doneBy = undefined;
      task.doneByName = undefined;
      task.verificationStatus = 'pending';
      task.verifiedAt = undefined;
      task.verificationDetails = undefined;
      task.actualSpendAfter = undefined;
    }

    await task.save();
    return task.toObject();
  }

  /**
   * Chạy verification trên platform sau khi user tick "Đã xong"
   */
  private async runVerification(task: EmergencyActionLogDocument): Promise<void> {
    const result = await this.verificationService.verify({
      taskType: task.taskType,
      platform: task.platform,
      adGroupId: task.adGroupId,
      targetSpend: task.targetSpend,
    });

    task.verificationStatus = result.status;
    task.verifiedAt = new Date();
    task.verificationDetails = JSON.stringify({
      details: result.details,
      actualValue: result.actualValue,
    });

    if (result.actualValue != null && task.taskType === 'change-budget') {
      task.actualSpendAfter = result.actualValue;
    }

    await task.save();

    // Nếu verification failed → emit alert
    if (result.status === 'failed') {
      this.alertsEventsService.createAlert({
        type: 'WARNING',
        category: 'BUDGET',
        title: `Xác minh thất bại: ${task.adGroupName || task.taskId}`,
        message: result.details,
        adGroupId: task.adGroupId,
        adGroupName: task.adGroupName,
        platform: task.platform,
        action: { type: 'REVIEW', label: 'Kiểm tra lại' },
      });
    }
  }

  /**
   * Lấy tasks quá hạn chưa xử lý
   */
  async getOverdueTasks(date: string) {
    const now = new Date();
    // Lấy giờ Vietnam (UTC+7)
    const vietnamHour = (now.getUTCHours() + 7) % 24;

    const allPending = await this.model.find({ date, done: false }).lean().exec();
    return allPending.filter((task: any) => {
      const deadlineHour = this.parseDeadlineHour(task.deadline);
      return vietnamHour > deadlineHour;
    });
  }

  /**
   * Cron mỗi giờ (7h-22h Vietnam): kiểm tra tasks quá hạn và push SSE alert
   */
  @Cron('0 * 7-22 * * *', {
    name: 'emergency-overdue-check',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async checkOverdueTasks(): Promise<void> {
    const now = new Date();
    // Tính ngày Vietnam (UTC+7)
    const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const today = vietnamTime.toISOString().split('T')[0];
    const vietnamHour = vietnamTime.getUTCHours();

    const pendingTasks = await this.model.find({ date: today, done: false }).lean().exec();
    let overdueCount = 0;

    for (const task of pendingTasks) {
      const deadlineHour = this.parseDeadlineHour(task.deadline);
      if (vietnamHour <= deadlineHour) continue;

      overdueCount++;

      // Tính end of day Vietnam cho expiresAt
      const endOfDay = new Date(vietnamTime);
      endOfDay.setUTCHours(16, 59, 59, 999); // 23:59 Vietnam = 16:59 UTC

      this.alertsEventsService.createAlert({
        type: 'CRITICAL',
        category: 'BUDGET',
        title: `Quá hạn: ${(task.actionText || '').substring(0, 50)}`,
        message: `Task "${task.taskType}" deadline ${task.deadline} chưa xử lý. ${task.reason}`,
        adGroupId: task.adGroupId,
        adGroupName: task.adGroupName,
        platform: task.platform,
        action: { type: 'REVIEW', label: 'Xem checklist' },
        expiresAt: endOfDay,
      });
    }

    if (overdueCount > 0) {
      this.logger.warn(
        `Found ${overdueCount} overdue emergency tasks for ${today} at ${vietnamHour}:00`,
      );
    }
  }

  /**
   * Parse deadline string → hour number
   * "Trước 09:00" → 9, "Trước 11:00" → 11, "Xử lý ngay" → 7, "Trước 14:00" → 14
   */
  private parseDeadlineHour(deadline: string): number {
    if (!deadline) return 23;
    const match = deadline.match(/(\d{1,2}):?\d{0,2}/);
    if (match) return parseInt(match[1], 10);
    if (deadline.includes('ngay')) return 7; // "Xử lý ngay" → 7:00 sáng
    return 23; // Fallback: cuối ngày
  }
}
