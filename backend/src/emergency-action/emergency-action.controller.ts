/**
 * File: emergency-action/emergency-action.controller.ts
 * Mục đích: API endpoints cho Emergency Action Logs
 * - GET    /emergency-actions?date=...        Lấy tasks theo ngày
 * - POST   /emergency-actions/bulk-sync       Upsert tasks từ frontend
 * - PATCH  /emergency-actions/:taskId/toggle  Toggle done/undone + verification
 * - GET    /emergency-actions/overdue?date=... Lấy tasks quá hạn
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EmergencyActionService, BulkSyncTaskDto } from './emergency-action.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('emergency-actions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmergencyActionController {
  constructor(private readonly service: EmergencyActionService) {}

  /**
   * GET /emergency-actions?date=2026-02-26
   * Lấy tất cả task logs của 1 ngày
   */
  @Get()
  @RequirePermissions('ad-groups')
  async getByDate(@Query('date') date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const tasks = await this.service.getByDate(targetDate);
    return { success: true, date: targetDate, tasks, total: tasks.length };
  }

  /**
   * POST /emergency-actions/bulk-sync
   * Frontend gửi toàn bộ tasks sau khi buildEmergencyTasks()
   */
  @Post('bulk-sync')
  @RequirePermissions('ad-groups')
  async bulkSync(@Body() body: { date: string; tasks: BulkSyncTaskDto[] }) {
    const date = body.date || new Date().toISOString().split('T')[0];
    const result = await this.service.bulkSync(date, body.tasks || []);
    return {
      success: true,
      message: `Synced ${result.upserted} mới, ${result.existing} đã tồn tại`,
      ...result,
    };
  }

  /**
   * PATCH /emergency-actions/:taskId/toggle?date=2026-02-26
   * Toggle done/undone + trigger verification
   */
  @Patch(':taskId/toggle')
  @RequirePermissions('ad-groups')
  async toggleDone(
    @Param('taskId') taskId: string,
    @Query('date') date?: string,
    @Request() req?: any,
  ) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const userId = req?.user?.id || req?.user?._id;
    const userName = req?.user?.fullName || req?.user?.email;

    const task = await this.service.toggleDone(
      targetDate,
      decodeURIComponent(taskId),
      userId,
      userName,
    );

    if (!task) {
      return { success: false, message: 'Task không tồn tại' };
    }

    return { success: true, task };
  }

  /**
   * GET /emergency-actions/overdue?date=2026-02-26
   * Lấy tasks quá hạn chưa xử lý
   */
  @Get('overdue')
  @RequirePermissions('ad-groups')
  async getOverdue(@Query('date') date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const tasks = await this.service.getOverdueTasks(targetDate);
    return { success: true, date: targetDate, tasks, total: tasks.length };
  }
}
