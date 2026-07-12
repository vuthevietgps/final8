/**
 * FUNDS CONTROLLER - API cho quản lý quỹ
 */

import { Controller, Get, Logger } from '@nestjs/common';
import { FundsService, FundsOverview } from './funds.service';
import { FeatureModule } from '../plan/feature-module.decorator';

@FeatureModule('finance')
@Controller('funds')
export class FundsController {
  private readonly logger = new Logger(FundsController.name);

  constructor(private readonly fundsService: FundsService) {}

  /**
   * GET /api/funds/overview
   * Lấy tổng quan tất cả các quỹ
   */
  @Get('overview')
  async getFundsOverview(): Promise<FundsOverview> {
    this.logger.debug('GET /api/funds/overview');
    return this.fundsService.computeFundsOverview();
  }

  /**
   * GET /api/funds/committed-cash
   * Lấy chi tiết Quỹ Đặt Chỗ
   */
  @Get('committed-cash')
  async getCommittedCash() {
    const overview = await this.fundsService.computeFundsOverview();
    return overview.committedCash;
  }

  /**
   * GET /api/funds/ads
   * Lấy chi tiết Quỹ Ads
   */
  @Get('ads')
  async getAdsFund() {
    const overview = await this.fundsService.computeFundsOverview();
    return overview.adsFund;
  }

  /**
   * GET /api/funds/survival-buffer
   * Lấy chi tiết Quỹ Dự Phòng
   */
  @Get('survival-buffer')
  async getSurvivalBuffer() {
    const overview = await this.fundsService.computeFundsOverview();
    return overview.survivalBuffer;
  }

  /**
   * GET /api/funds/owner
   * Lấy chi tiết Quỹ Owner
   */
  @Get('owner')
  async getOwnerFund() {
    const overview = await this.fundsService.computeFundsOverview();
    return overview.ownerFund;
  }

  /**
   * GET /api/funds/formulas
   * Lấy công thức cốt lõi
   */
  @Get('formulas')
  async getFormulas() {
    const overview = await this.fundsService.computeFundsOverview();
    return {
      tienTuDo: overview.formulas.tienTuDo,
      adsBudgetAllowed: overview.formulas.adsBudgetAllowed,
      validation: overview.validation
    };
  }
}
