/**
 * FINANCIAL CONTROL CONTROLLER - CFO Spec v3.0
 * =============================================
 * REST API for Financial Control Dashboard
 */

import { Controller, Get, Put, Patch, Body, Logger, UseGuards, Query } from '@nestjs/common';
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
import { FeatureModule } from '../plan/feature-module.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateFinancialControlConfigDto } from './dto/update-financial-control-config.dto';
import { UpsertTaxObligationSnapshotDto } from './dto/upsert-tax-obligation-snapshot.dto';

@FeatureModule('finance')
@Controller('financial-control')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('finance')
export class FinancialControlController {
  private readonly logger = new Logger(FinancialControlController.name);

  constructor(private readonly service: FinancialControlService) {}

  /**
   * GET /api/financial-control/dashboard
   * Dashboard 8 số chính cho CEO/CFO
   * @param forceRefresh Khi true, bỏ qua cache và tính toán lại ngay lập tức (Issue 1 — Eventual Consistency)
   */
  @Get('dashboard')
  async getDashboard(
    @Query('forceRefresh') forceRefresh?: string,
  ): Promise<FinancialControlDashboard> {
    this.logger.debug(`GET /api/financial-control/dashboard forceRefresh=${forceRefresh}`);
    return this.service.getDashboard(forceRefresh === 'true');
  }

  /**
   * GET /api/financial-control/full
   * Chi tiết đầy đủ Financial Control
   */
  @Get('full')
  async getFullMetrics(): Promise<FinancialControlFull> {
    this.logger.debug('GET /api/financial-control/full');
    return this.service.getFullMetrics();
  }

  /**
   * GET /api/financial-control/forecast
   * Forecast 7 ngày chi tiết
   */
  @Get('forecast')
  async getForecast(): Promise<Forecast7DResult> {
    this.logger.debug('GET /api/financial-control/forecast');
    return this.service.getForecastForDashboard();
  }

  /**
   * GET /api/financial-control/optimal-ads
   * Optimal Ads Suggestion với Rule 20%
   */
  @Get('optimal-ads')
  async getOptimalAds(): Promise<OptimalAdsSuggestionResult> {
    this.logger.debug('GET /api/financial-control/optimal-ads');
    return this.service.getOptimalAdsSuggestion();
  }

  /**
   * GET /api/financial-control/config
   * Get current config
   */
  @Get('config')
  async getConfig(): Promise<FinancialControlConfig> {
    this.logger.debug('GET /api/financial-control/config');
    return await this.service.getConfig();
  }

  /**
   * PATCH /api/financial-control/config
   * Update config — persisted to MongoDB (survives restart / multi-pod)
   */
  @Patch('config')
  @RequirePermissions('finance', 'finance.policy.manage')
  async updateConfig(
    @CurrentUser() currentUser: any,
    @Body() config: UpdateFinancialControlConfigDto,
  ): Promise<FinancialControlConfig> {
    this.logger.debug('PATCH /api/financial-control/config');
    return this.service.updateConfig(config, currentUser);
  }

  @Get('tax-obligation')
  @RequirePermissions('finance', 'finance.policy.manage')
  async getTaxObligation() {
    return this.service.getTaxObligationSnapshot();
  }

  @Put('tax-obligation')
  @RequirePermissions('finance', 'finance.policy.manage')
  async upsertTaxObligation(
    @CurrentUser() currentUser: any,
    @Body() snapshot: UpsertTaxObligationSnapshotDto,
  ) {
    return this.service.upsertTaxObligationSnapshot(snapshot, currentUser);
  }

  /**
   * GET /api/financial-control/module-health
   * CFO v3.2: Get health status of all modules
   */
  @Get('module-health')
  async getModuleHealth() {
    this.logger.debug('GET /api/financial-control/module-health');
    return this.service.getModuleHealth();
  }

  /**
   * GET /api/financial-control/actions
   * CFO v3.2: Get suggested actions based on current status
   */
  @Get('actions')
  async getActionSuggestions() {
    this.logger.debug('GET /api/financial-control/actions');
    return this.service.getActionSuggestions();
  }
}
