/**
 * File: cashflow-control/controllers/alerts.controller.ts
 * Purpose: REST API for cashflow alerts
 * 
 * Endpoint: GET /cashflow/alerts
 * 
 * Alerts are proactive warnings that help Owner/CFO
 * take action BEFORE problems become critical.
 */

import { Controller, Get } from '@nestjs/common';
import { AlertsService } from '../services/alerts.service';
import { AlertsResponseDto } from '../dto/alert.dto';
import { FeatureModule } from '../../plan/feature-module.decorator';

@FeatureModule('cashflow-control')
@Controller('cashflow/alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  /**
   * GET /cashflow/alerts
   * 
   * Returns all active alerts with:
   * - Alert type and severity
   * - Message and suggested action
   * - Whether immediate action is required
   * - Summary by severity level
   */
  @Get()
  getAlerts(): AlertsResponseDto {
    return this.alertsService.getAlerts();
  }
}
