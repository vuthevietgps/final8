/**
 * Service quan ly task khan cap cua Ads Budget.
 * - Luu task theo ngay
 * - Toggle done/undone va xac minh
 * - Kiem tra task qua han de day alert
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

export interface BulkSyncResult {
  upserted: number;
  existing: number;
  updated: number;
  removed: number;
  reset: number;
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

  async getByDate(date: string) {
    return this.model.find({ date }).sort({ priority: -1 }).lean().exec();
  }

  /**
   * Frontend gui toan bo task sau khi rebuild.
   * - Tao moi neu chua co
   * - Cap nhat task neu definition thay doi
   * - Reset done/verification khi task definition thay doi
   * - Xoa task pending da khong con trong payload moi
   */
  async bulkSync(
    date: string,
    tasks: BulkSyncTaskDto[],
  ): Promise<BulkSyncResult> {
    let upserted = 0;
    let existing = 0;
    let updated = 0;
    let removed = 0;
    let reset = 0;

    const existingTasks = await this.model.find({ date }).exec();
    const existingByTaskId = new Map(
      existingTasks.map((task) => [task.taskId, task] as const),
    );
    const incomingTaskIds = new Set(tasks.map((task) => task.taskId));

    for (const task of tasks) {
      const current = existingByTaskId.get(task.taskId);

      if (!current) {
        await this.model.create({
          ...this.toTaskDocument(date, task),
          done: false,
          verificationStatus: 'pending',
        });
        upserted++;
        continue;
      }

      if (!this.hasTaskDefinitionChanged(current, task)) {
        existing++;
        continue;
      }

      updated++;
      if (this.resetTaskExecutionState(current)) {
        reset++;
      }

      Object.assign(current, this.toTaskDocument(date, task));
      await current.save();
    }

    const stalePendingTaskIds = existingTasks
      .filter((task) => !task.done && !incomingTaskIds.has(task.taskId))
      .map((task) => task.taskId);

    if (stalePendingTaskIds.length > 0) {
      const deleteResult = await this.model.deleteMany({
        date,
        done: false,
        taskId: { $in: stalePendingTaskIds },
      });
      removed = deleteResult.deletedCount || 0;
    }

    return { upserted, existing, updated, removed, reset };
  }

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

      this.runVerification(task).catch((err) =>
        this.logger.warn(`Verification error for ${taskId}: ${err?.message}`),
      );
    } else {
      this.resetTaskExecutionState(task);
    }

    await task.save();
    return task;
  }

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

    if (result.status === 'failed') {
      this.alertsEventsService.createAlert({
        type: 'WARNING',
        category: 'BUDGET',
        title: `Xac minh that bai: ${task.adGroupName || task.taskId}`,
        message: result.details,
        dedupeKey: `emergency-verification:${task.date}:${task.taskId}`,
        adGroupId: task.adGroupId,
        adGroupName: task.adGroupName,
        platform: task.platform,
        action: { type: 'REVIEW', label: 'Kiem tra lai' },
      });
    }
  }

  async getOverdueTasks(date: string) {
    const now = new Date();
    const vietnamHour = (now.getUTCHours() + 7) % 24;

    const allPending = await this.model.find({ date, done: false }).lean().exec();
    return allPending.filter((task: any) => {
      const deadlineHour = this.parseDeadlineHour(task.deadline);
      return vietnamHour > deadlineHour;
    });
  }

  /**
   * Chay dau moi gio tu 07:00 den 22:00 gio Viet Nam.
   */
  @Cron('0 0 7-22 * * *', {
    name: 'emergency-overdue-check',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async checkOverdueTasks(): Promise<void> {
    const now = new Date();
    const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const today = vietnamTime.toISOString().split('T')[0];
    const vietnamHour = vietnamTime.getUTCHours();

    const pendingTasks = await this.model.find({ date: today, done: false }).lean().exec();
    let overdueCount = 0;

    for (const task of pendingTasks) {
      const deadlineHour = this.parseDeadlineHour(task.deadline);
      if (vietnamHour <= deadlineHour) continue;

      overdueCount++;

      const endOfDay = new Date(vietnamTime);
      endOfDay.setUTCHours(16, 59, 59, 999);

      this.alertsEventsService.createAlert({
        type: 'CRITICAL',
        category: 'BUDGET',
        title: `Qua han: ${(task.actionText || '').substring(0, 50)}`,
        message: `Task "${task.taskType}" deadline ${task.deadline} chua xu ly. ${task.reason}`,
        dedupeKey: `emergency-overdue:${today}:${task.taskId}`,
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

  private parseDeadlineHour(deadline: string): number {
    if (!deadline) return 23;
    const match = deadline.match(/(\d{1,2}):?\d{0,2}/);
    if (match) return parseInt(match[1], 10);
    if (deadline.includes('ngay')) return 7;
    return 23;
  }

  private toTaskDocument(date: string, task: BulkSyncTaskDto) {
    return {
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
    };
  }

  private hasTaskDefinitionChanged(
    current: EmergencyActionLogDocument,
    next: BulkSyncTaskDto,
  ): boolean {
    return (
      current.taskType !== next.taskType ||
      current.priority !== next.priority ||
      current.platform !== next.platform ||
      current.adGroupId !== next.adGroupId ||
      current.adGroupName !== next.adGroupName ||
      current.actionText !== next.actionText ||
      current.reason !== next.reason ||
      current.deadline !== next.deadline ||
      current.currentSpend !== next.currentSpend ||
      current.targetSpend !== next.targetSpend
    );
  }

  private resetTaskExecutionState(task: EmergencyActionLogDocument): boolean {
    const needsReset =
      task.done ||
      task.verificationStatus !== 'pending' ||
      !!task.doneAt ||
      !!task.doneBy ||
      !!task.doneByName ||
      !!task.verifiedAt ||
      !!task.verificationDetails ||
      task.actualSpendAfter != null;

    task.done = false;
    task.doneAt = undefined;
    task.doneBy = undefined;
    task.doneByName = undefined;
    task.verificationStatus = 'pending';
    task.verifiedAt = undefined;
    task.verificationDetails = undefined;
    task.actualSpendAfter = undefined;

    return needsReset;
  }
}
