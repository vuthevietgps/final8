/**
 * File: facebook-ads-sync/facebook-ads-sync.controller.ts
 * Mục đích: API endpoints để sync chi phí Facebook Ads
 */
import { Controller, Post, Body, Get, Query, Logger } from '@nestjs/common';
import { FacebookAdsSyncService, FacebookSyncResult } from './facebook-ads-sync.service';

export interface SyncRequest {
  accessToken: string;
  accountId?: string;
  since?: string;
  until?: string;
}

export interface SyncAllRequest {
  accessToken: string;
  since?: string;
  until?: string;
}

@Controller('facebook-ads-sync')
export class FacebookAdsSyncController {
  private readonly logger = new Logger(FacebookAdsSyncController.name);

  constructor(
    private readonly facebookAdsSyncService: FacebookAdsSyncService,
  ) {}

  /**
   * Sync với default token từ database
   * POST /facebook-ads-sync/sync-default
   */
  @Post('sync-default')
  async syncDefault(@Body() request?: { since?: string; until?: string }): Promise<FacebookSyncResult> {
    this.logger.log('Received sync default request');
    
    const dateRange = request?.since && request?.until 
      ? { since: request.since, until: request.until }
      : undefined;

    return this.facebookAdsSyncService.syncWithDefaultToken(dateRange);
  }

  /**
   * Sync tất cả ad accounts với custom token
   * POST /facebook-ads-sync/sync-all
   */
  @Post('sync-all')
  async syncAll(@Body() request: SyncAllRequest): Promise<FacebookSyncResult> {
    this.logger.log('Received sync all request');
    
    if (!request.accessToken) {
      throw new Error('Access token is required');
    }

    const dateRange = request.since && request.until 
      ? { since: request.since, until: request.until }
      : undefined;

    return this.facebookAdsSyncService.syncAllAdAccounts(request.accessToken, dateRange);
  }

  /**
   * Sync một ad account cụ thể
   * POST /facebook-ads-sync/sync-account
   */
  @Post('sync-account')
  async syncAccount(@Body() request: SyncRequest): Promise<FacebookSyncResult> {
    this.logger.log(`Received sync account request for: ${request.accountId}`);
    
    if (!request.accessToken) {
      throw new Error('Access token is required');
    }

    if (!request.accountId) {
      throw new Error('Account ID is required');
    }

    const dateRange = request.since && request.until 
      ? { since: request.since, until: request.until }
      : undefined;

    return this.facebookAdsSyncService.syncAdAccount(
      request.accountId, 
      request.accessToken, 
      dateRange
    );
  }

  /**
   * Sync ngày hôm qua (thường dùng cho cron job)
   * POST /facebook-ads-sync/sync-yesterday
   */
  @Post('sync-yesterday')
  async syncYesterday(@Body() request: { accessToken: string }): Promise<FacebookSyncResult> {
    this.logger.log('Received sync yesterday request');
    
    if (!request.accessToken) {
      throw new Error('Access token is required');
    }

    return this.facebookAdsSyncService.syncYesterday(request.accessToken);
  }

  /**
   * Sync tuần trước
   * POST /facebook-ads-sync/sync-last-week
   */
  @Post('sync-last-week')
  async syncLastWeek(@Body() request: { accessToken: string }): Promise<FacebookSyncResult> {
    this.logger.log('Received sync last week request');
    
    if (!request.accessToken) {
      throw new Error('Access token is required');
    }

    return this.facebookAdsSyncService.syncLastWeek(request.accessToken);
  }

  /**
   * Sync theo khoảng thời gian tùy chỉnh
   * POST /facebook-ads-sync/sync-range
   */
  @Post('sync-range')
  async syncRange(@Body() request: SyncRequest): Promise<FacebookSyncResult> {
    this.logger.log(`Received sync range request: ${request.since} to ${request.until}`);
    
    if (!request.accessToken) {
      throw new Error('Access token is required');
    }

    if (!request.since || !request.until) {
      throw new Error('Both since and until dates are required');
    }

    return this.facebookAdsSyncService.syncDateRange(
      request.accessToken, 
      request.since, 
      request.until
    );
  }

  /**
   * Test endpoint để kiểm tra kết nối Facebook API
   * GET /facebook-ads-sync/test?accessToken=xxx&accountId=xxx
   */
  @Get('test')
  async test(
    @Query('accessToken') accessToken: string,
    @Query('accountId') accountId: string,
  ): Promise<{ status: string; message: string; data?: any }> {
    this.logger.log(`Testing Facebook API connection for account: ${accountId}`);
    
    if (!accessToken || !accountId) {
      return {
        status: 'error',
        message: 'Both accessToken and accountId are required'
      };
    }

    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const result = await this.facebookAdsSyncService.syncAdAccount(
        accountId, 
        accessToken, 
        { since: dateStr, until: dateStr }
      );

      return {
        status: 'success',
        message: `Successfully tested Facebook API for account ${accountId}`,
        data: result
      };

    } catch (error) {
      this.logger.error('Facebook API test failed:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}