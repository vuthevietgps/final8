import { Controller, Get, Query } from '@nestjs/common';
import { ProfitForecastService } from './profit-forecast.service';

@Controller('profit-forecast')
export class ProfitForecastController {
  constructor(private readonly service: ProfitForecastService) {}

  @Get('ad-group')
  async forecastAdGroup(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('adGroupId') adGroupId?: string,
  ): Promise<any[]> {
    return this.service.forecastByAdGroup({ from, to, adGroupId });
  }

  @Get('ad-group-with-cost')
  async forecastAdGroupWithCost(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('adGroupId') adGroupId?: string,
  ): Promise<any[]> {
    return this.service.forecastWithCost({ from, to, adGroupId });
  }

  @Get('summary')
  async summary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('adGroupId') adGroupId?: string,
  ) { return this.service.summaryAggregate({ from, to, adGroupId }); }

  @Get('snapshots')
  async listSnapshots(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('adGroupId') adGroupId?: string,
  ){ return this.service.listSnapshots({ from, to, adGroupId }); }

  @Get('snapshot/run')
  async runSnapshot(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('adGroupId') adGroupId?: string,
  ){ return this.service.upsertSnapshots({ from, to, adGroupId }); }

  @Get('recommended-budget')
  async recommendedBudget(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('adGroupId') adGroupId?: string,
    @Query('days') days?: string,
  ){ return this.service.recommendedBudget({ from, to, adGroupId, days: days? +days: undefined }); }
}
