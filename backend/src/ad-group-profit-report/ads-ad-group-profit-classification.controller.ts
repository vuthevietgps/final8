import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { FeatureModule } from '../plan/feature-module.decorator';
import { AdGroupProfitReportService } from './ad-group-profit-report.service';

@FeatureModule('ad-group-profit-report')
@Controller('ads/ad-groups')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('ads-budget')
export class AdsAdGroupProfitClassificationController {
  constructor(private readonly profitReportService: AdGroupProfitReportService) {}

  @Get('profit-classification')
  getProfitClassification(@Query('days') days?: string) {
    return this.profitReportService.getAdGroupProfitClassification({
      days: days ? Number(days) : 7,
    });
  }
}
