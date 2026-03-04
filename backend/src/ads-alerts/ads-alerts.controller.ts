/**
 * File: ads-alerts/ads-alerts.controller.ts
 * Mục đích: API endpoints cho Ads Alerts
 * - GET /ads-alerts - Lấy tất cả alerts
 * - GET /ads-alerts/summary - Lấy summary
 * - GET /ads-alerts/events - SSE stream real-time
 * - POST /ads-alerts/check - Trigger manual check
 * - PATCH /ads-alerts/:id/read - Mark as read
 * - DELETE /ads-alerts/:id - Dismiss alert
 */
import { 
  Controller, Get, Post, Patch, Delete, Param, 
  UseGuards, Sse, MessageEvent, Query 
} from '@nestjs/common';
import { map } from 'rxjs/operators';
import { AdsAlertsService } from './ads-alerts.service';
import { AdsAlertsEventsService } from './ads-alerts-events.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { FeatureModule } from '../plan/feature-module.decorator';

@FeatureModule('ads-alerts')
@Controller('ads-alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdsAlertsController {
  constructor(
    private alertsService: AdsAlertsService,
    private eventsService: AdsAlertsEventsService,
  ) {}

  /**
   * GET /ads-alerts
   * Lấy tất cả alerts hiện tại
   */
  @Get()
  @RequirePermissions('ad-groups')
  getAllAlerts(@Query('type') type?: string, @Query('category') category?: string) {
    let alerts = this.alertsService.getAllAlerts();
    
    if (type) {
      alerts = alerts.filter(a => a.type === type.toUpperCase());
    }
    if (category) {
      alerts = alerts.filter(a => a.category === category.toUpperCase());
    }
    
    return {
      success: true,
      alerts,
      total: alerts.length,
      unread: alerts.filter(a => !a.isRead).length,
    };
  }

  /**
   * GET /ads-alerts/summary
   * Lấy summary của alerts
   */
  @Get('summary')
  @RequirePermissions('ad-groups')
  getSummary() {
    return {
      success: true,
      ...this.alertsService.getSummary(),
    };
  }

  /**
   * GET /ads-alerts/events
   * SSE stream cho real-time alerts
   */
  @Get('events')
  @Sse()
  @RequirePermissions('ad-groups')
  events(): any {
    return this.eventsService.stream().pipe(
      map((event) => ({ data: event }) as MessageEvent)
    );
  }

  /**
   * POST /ads-alerts/check
   * Trigger manual alert check
   */
  @Post('check')
  @RequirePermissions('ad-groups')
  async triggerCheck() {
    const result = await this.alertsService.checkAlerts();
    return {
      success: true,
      message: `Đã kiểm tra ${result.adGroupsChecked} nhóm QC, tạo ${result.alertsCreated} cảnh báo mới`,
      ...result,
    };
  }

  /**
   * PATCH /ads-alerts/:id/read
   * Mark alert as read
   */
  @Patch(':id/read')
  @RequirePermissions('ad-groups')
  markAsRead(@Param('id') id: string) {
    this.alertsService.markAsRead(id);
    return { success: true, message: 'Đã đánh dấu đã đọc' };
  }

  /**
   * POST /ads-alerts/mark-all-read
   * Mark all alerts as read
   */
  @Post('mark-all-read')
  @RequirePermissions('ad-groups')
  markAllAsRead() {
    this.alertsService.markAllAsRead();
    return { success: true, message: 'Đã đánh dấu tất cả đã đọc' };
  }

  /**
   * DELETE /ads-alerts/:id
   * Dismiss/delete an alert
   */
  @Delete(':id')
  @RequirePermissions('ad-groups')
  dismissAlert(@Param('id') id: string) {
    this.alertsService.dismissAlert(id);
    return { success: true, message: 'Đã xóa cảnh báo' };
  }

  /**
   * DELETE /ads-alerts
   * Clear all alerts
   */
  @Delete()
  @RequirePermissions('ad-groups')
  clearAll() {
    this.alertsService.clearAll();
    return { success: true, message: 'Đã xóa tất cả cảnh báo' };
  }
}
