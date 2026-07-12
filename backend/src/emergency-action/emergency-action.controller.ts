/**
 * API endpoints for Emergency Action Logs.
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  NotFoundException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EmergencyActionService, BulkSyncTaskDto } from './emergency-action.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { FeatureModule } from '../plan/feature-module.decorator';

@FeatureModule('emergency-action')
@Controller('emergency-actions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmergencyActionController {
  constructor(private readonly service: EmergencyActionService) {}

  @Get()
  @RequirePermissions('ad-groups')
  async getByDate(@Query('date') date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const tasks = await this.service.getByDate(targetDate);
    return { success: true, date: targetDate, tasks, total: tasks.length };
  }

  @Post('bulk-sync')
  @RequirePermissions('ad-groups')
  async bulkSync(@Body() body: { date: string; tasks: BulkSyncTaskDto[] }) {
    const date = body.date || new Date().toISOString().split('T')[0];
    const result = await this.service.bulkSync(date, body.tasks || []);
    return {
      success: true,
      message:
        `Synced ${result.upserted} moi, ${result.existing} giu nguyen, ` +
        `${result.updated} cap nhat, ${result.removed} xoa pending cu, ${result.reset} reset trang thai`,
      ...result,
    };
  }

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
      throw new NotFoundException('Task khong ton tai');
    }

    return { success: true, task };
  }

  @Get('overdue')
  @RequirePermissions('ad-groups')
  async getOverdue(@Query('date') date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const tasks = await this.service.getOverdueTasks(targetDate);
    return { success: true, date: targetDate, tasks, total: tasks.length };
  }
}
