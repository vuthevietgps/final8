/**
 * File: advertising-cost/advertising-cost.controller.ts
 * Purpose: Expose REST APIs for advertising cost CRUD and sync.
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdvertisingCostService } from './advertising-cost.service';
import { CreateAdvertisingCostDto } from './dto/create-advertising-cost.dto';
import { UpdateAdvertisingCostDto } from './dto/update-advertising-cost.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { AdvertisingCostFacebookSyncService } from './advertising-cost.facebook-sync.service';
import { AdvertisingCostGoogleSyncService } from './advertising-cost.google-sync.service';
import { AdvertisingCostTiktokSyncService } from './advertising-cost.tiktok-sync.service';
import { FeatureModule } from '../plan/feature-module.decorator';

@FeatureModule('advertising-cost')
@Controller('advertising-cost')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdvertisingCostController {
  constructor(
    private readonly service: AdvertisingCostService,
    private readonly fbSync: AdvertisingCostFacebookSyncService,
    private readonly ggSync: AdvertisingCostGoogleSyncService,
    private readonly tkSync: AdvertisingCostTiktokSyncService,
  ) {}

  @Post()
  @RequirePermissions('advertising-costs')
  create(@Body() dto: CreateAdvertisingCostDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions('advertising-costs')
  findAll(@Query() query?: any) {
    return this.service.findAll(query);
  }

  @Get('stats/summary')
  @RequirePermissions('advertising-costs')
  stats(@Query('channel') channel?: string) {
    return this.service.summary({ channel });
  }

  /**
   * GET /advertising-cost/summary/cashflow
   * Aggregate ads spend for Financial Control (cash-out view).
   * Includes spend-by-day and spend-by-ad-group baselines.
   */
  @Get('summary/cashflow')
  @RequirePermissions('advertising-costs')
  getCashflowSummary() {
    return this.service.getCashflowSummary();
  }

  /**
   * GET /advertising-cost/stats/daily-summary
   * Aggregate daily advertising spend metrics.
   */
  @Get('stats/daily-summary')
  @RequirePermissions('advertising-costs')
  getDailySummary(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.getDailySummary(dateFrom, dateTo);
  }

  @Get('stats/by-adgroup')
  @RequirePermissions('advertising-costs')
  statsByAdGroup(@Query('adGroupId') adGroupId: string) {
    return this.service.getTotalSpentByAdGroup(adGroupId);
  }

  @Get('stats/conversation-cost')
  @RequirePermissions('advertising-costs')
  conversationCost(@Query('adGroupId') adGroupId: string) {
    return this.service.getConversationCostByAdGroup(adGroupId);
  }
  
    // GET /advertising-cost/stats/conversation-cost/daily?adGroupId=...&date=YYYY-MM-DD
    @Get('stats/conversation-cost/daily')
    @RequirePermissions('advertising-costs')
    async getDailyConversationCost(
      @Query('adGroupId') adGroupId: string,
      @Query('date') date: string,
    ) {
      return this.service.getDailyConversationCost({ adGroupId, date });
    }

  @Get(':id')
  @RequirePermissions('advertising-costs')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('advertising-costs')
  update(@Param('id') id: string, @Body() dto: UpdateAdvertisingCostDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('advertising-costs')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('upload-facebook-excel')
  @RequirePermissions('advertising-costs')
  @UseInterceptors(FileInterceptor('file'))
  uploadFacebookExcel(@UploadedFile() file: Express.Multer.File) {
    return this.service.processFacebookExcelUpload(file);
  }

  @Get('sync/health')
  @RequirePermissions('advertising-costs')
  async getSyncHealth() {
    const [facebook, google, tiktok] = await Promise.all([
      this.fbSync.getSyncHealth(),
      this.ggSync.getSyncHealth(),
      this.tkSync.getSyncHealth(),
    ]);
    return {
      checkedAt: new Date().toISOString(),
      platforms: { facebook, google, tiktok },
    };
  }

  // Manual trigger: sync Facebook advertising costs by date or day range.
  @Post('fetch/facebook')
  @RequirePermissions('advertising-costs')
  async fetchFacebook(@Query('date') date?: string, @Query('days') days?: string) {
    const n = days ? parseInt(days, 10) : undefined;
    return this.fbSync.syncRange({ date, days: n });
  }

  // Manual trigger: sync Google Ads costs by date or day range.
  @Post('fetch/google')
  @RequirePermissions('advertising-costs')
  async fetchGoogle(
    @Query('date') date?: string,
    @Query('days') days?: string,
    @Query('customerIds') customerIds?: string,
  ) {
    const n = days ? parseInt(days, 10) : undefined;
    const ids = customerIds
      ? String(customerIds)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      : undefined;
    return this.ggSync.syncRange({ date, days: n, customerIds: ids });
  }

  // Manual trigger: sync TikTok costs by date or day range.
  @Post('fetch/tiktok')
  @RequirePermissions('advertising-costs')
  async fetchTiktok(
    @Query('date') date?: string,
    @Query('days') days?: string,
    @Query('advertiserIds') advertiserIds?: string,
  ) {
    const n = days ? parseInt(days, 10) : undefined;
    const ids = advertiserIds
      ? String(advertiserIds)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      : undefined;
    return this.tkSync.syncRange({ date, days: n, advertiserIds: ids });
  }

  // Manual trigger: sync by explicit ad account list.
  // Body: { accounts: string[]; date?: string; days?: number; cleanup?: boolean }
  @Post('fetch/facebook/by-accounts')
  @RequirePermissions('advertising-costs')
  async fetchFacebookByAccounts(@Body() body: any) {
    const accounts: string[] = Array.isArray(body?.accounts) ? body.accounts : [];
    const date: string | undefined = body?.date;
    const days: number | undefined = body?.days ? parseInt(String(body.days), 10) : undefined;
    const cleanup: boolean = Boolean(body?.cleanup);
    return this.fbSync.syncRangeByAdAccounts({ accounts, date, days, cleanup });
  }
}

