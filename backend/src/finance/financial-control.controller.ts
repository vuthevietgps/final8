/**
 * FINANCIAL CONTROL CONTROLLER - CFO Spec v3.0
 * =============================================
 * REST API for Financial Control Dashboard
 */

import { Controller, Get, Patch, Body, Logger, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { FinancialControlService } from './financial-control.service';
import {
  FinancialControlDashboard,
  FinancialControlFull,
  Forecast7DResult,
  OptimalAdsSuggestionResult,
  FinancialControlConfig,
} from './interfaces/financial-control.interface';

@Controller('financial-control')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('finance')
export class FinancialControlController {
  private readonly logger = new Logger(FinancialControlController.name);

  constructor(private readonly service: FinancialControlService) {}

  /**
   * GET /api/financial-control/dashboard
   * Dashboard 8 số chính cho CEO/CFO
   */
  @Get('dashboard')
  async getDashboard(): Promise<FinancialControlDashboard> {
    this.logger.log('GET /api/financial-control/dashboard');
    return this.service.getDashboard();
  }

  /**
   * GET /api/financial-control/full
   * Chi tiết đầy đủ Financial Control
   */
  @Get('full')
  async getFullMetrics(): Promise<FinancialControlFull> {
    this.logger.log('GET /api/financial-control/full');
    return this.service.getFullMetrics();
  }

  /**
   * GET /api/financial-control/forecast
   * Forecast 7 ngày chi tiết
   */
  @Get('forecast')
  async getForecast(): Promise<Forecast7DResult> {
    this.logger.log('GET /api/financial-control/forecast');
    return this.service.getForecast7D();
  }

  /**
   * GET /api/financial-control/optimal-ads
   * Optimal Ads Suggestion với Rule 20%
   */
  @Get('optimal-ads')
  async getOptimalAds(): Promise<OptimalAdsSuggestionResult> {
    this.logger.log('GET /api/financial-control/optimal-ads');
    return this.service.getOptimalAdsSuggestion();
  }

  /**
   * GET /api/financial-control/config
   * Get current config
   */
  @Get('config')
  getConfig(): FinancialControlConfig {
    this.logger.log('GET /api/financial-control/config');
    return this.service.getConfig();
  }

  /**
   * PATCH /api/financial-control/config
   * Update config
   */
  @Patch('config')
  updateConfig(@Body() config: Partial<FinancialControlConfig>): FinancialControlConfig {
    this.logger.log('PATCH /api/financial-control/config');
    this.service.updateConfig(config);
    return this.service.getConfig();
  }

  /**
   * GET /api/financial-control/debug/deprecation-stats
   * CFO Checklist #5: Monitor deprecated fallback usage
   */
  @Get('debug/deprecation-stats')
  getDeprecationStats() {
    this.logger.log('GET /api/financial-control/debug/deprecation-stats');
    return this.service.getDeprecationStats();
  }

  /**
   * GET /api/financial-control/module-health
   * CFO v3.2: Get health status of all modules
   */
  @Get('module-health')
  async getModuleHealth() {
    this.logger.log('GET /api/financial-control/module-health');
    return this.service.getModuleHealth();
  }

  /**
   * GET /api/financial-control/actions
   * CFO v3.2: Get suggested actions based on current status
   */
  @Get('actions')
  async getActionSuggestions() {
    this.logger.log('GET /api/financial-control/actions');
    return this.service.getActionSuggestions();
  }
}
