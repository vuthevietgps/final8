/**
 * Controller: ApiTokenController
 * Nhiệm vụ: Expose REST endpoints CRUD + các thao tác vòng đời token (validate / set-primary / rotate)
 * Bảo vệ bằng JwtAuthGuard + RolesGuard và kiểm soát quyền qua @RequirePermissions('api-tokens').
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTokenService } from './api-token.service';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { UpdateApiTokenDto } from './dto/update-api-token.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { ValidateTokenDto, RotateTokenDto, SetPrimaryTokenDto } from './dto/token-actions.dto';
import { FeatureModule } from '../plan/feature-module.decorator';
import { SecretRedactionInterceptor } from '../common/interceptors/secret-redaction.interceptor';

@FeatureModule('api-token')
@Controller('api-tokens')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(SecretRedactionInterceptor)
export class ApiTokenController {
  constructor(private service: ApiTokenService) {}

  /**
   * Lấy settings hiện tại (masked) - PHẢI ĐẶT TRƯỚC /:id
   */
  @Get('settings')
  @RequirePermissions('google-ads.credentials.read')
  async getSettings() {
    return this.service.getAdsSettings();
  }

  // Sync fanpages/page tokens from 1 Facebook System User token (auto-run flow).
  @Post('system-user/sync')
  @RequirePermissions('google-ads.credentials.write')
  syncFromSystemUser(@Body() body?: { businessId?: string; upsertApiTokens?: boolean; syncAdAccounts?: boolean }) {
    return this.service.syncFanpagesFromSystemUserToken({
      businessId: body?.businessId,
      upsertApiTokens: body?.upsertApiTokens !== false,
      syncAdAccounts: body?.syncAdAccounts !== false,
    });
  }

  @Post() @RequirePermissions('google-ads.credentials.write') create(@Body() dto: CreateApiTokenDto) { return this.service.create(dto); }
  @Get() @RequirePermissions('google-ads.credentials.read') findAll(@Query() q?: any) { return this.service.findAll(q||{}); }
  @Get(':id') @RequirePermissions('google-ads.credentials.read') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Patch(':id') @RequirePermissions('google-ads.credentials.write') update(@Param('id') id: string, @Body() dto: UpdateApiTokenDto) { return this.service.update(id, dto); }
  @Delete(':id') @RequirePermissions('google-ads.credentials.write') remove(@Param('id') id: string) { return this.service.remove(id); }

  // Validate token
  @Post(':id/validate') @RequirePermissions('google-ads.credentials.write') validate(@Param('id') id: string, @Body() dto: ValidateTokenDto) { return this.service.validate(id, dto); }
  // Set primary
  @Post(':id/set-primary') @RequirePermissions('google-ads.credentials.write') setPrimary(@Param('id') id: string, @Body() dto: SetPrimaryTokenDto) { return this.service.setPrimary(id, dto); }
  // Rotate token
  @Post(':id/rotate') @RequirePermissions('google-ads.credentials.write') rotate(@Param('id') id: string, @Body() dto: RotateTokenDto) { return this.service.rotate(id, dto); }

  // Đồng bộ token từ fanpages (import accessToken -> api-tokens)
  @Post('sync/from-fanpages') @RequirePermissions('google-ads.credentials.write') syncFromFanpages(){
    return this.service.syncFromFanpages();
  }

  // Test token với 1 tài khoản quảng cáo Facebook
  @Post(':id/test-adaccount')
  @RequirePermissions('google-ads.credentials.read')
  testAdAccount(
    @Param('id') id: string,
    @Body() body: { adAccountId: string }
  ){
    if(!body?.adAccountId) return { ok: false, error: 'Thiếu adAccountId' } as any;
    return this.service.testAdAccountAccess(id, body.adAccountId);
  }

  /**
   * Test Google Ads connection với credentials
   * Body: { clientId, clientSecret, refreshToken, developerToken, customerId }
   */
  @Post('test/google')
  @RequirePermissions('google-ads.credentials.write')
  async testGoogleAds(@Body() body: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    developerToken: string;
    customerId: string;
    loginCustomerId?: string;
    apiVersion?: string;
  }) {
    return this.service.testGoogleAdsConnection(body);
  }

  @Post('tiktok/oauth/exchange')
  @RequirePermissions('google-ads.credentials.write')
  async exchangeTikTokAuthCode(@Body() body: {
    appId: string;
    appSecret: string;
    authCode: string;
    businessCenterId?: string;
    businessCenterName?: string;
    testAdvertiserId?: string;
    advertiserIds?: string[];
    save?: boolean;
  }) {
    return this.service.exchangeTikTokAuthCode(body);
  }

  /**
   * Test TikTok Ads connection với access token
   * Body: { accessToken, advertiserId }
   */
  @Post('test/tiktok')
  @RequirePermissions('google-ads.credentials.write')
  async testTikTokAds(@Body() body: {
    accessToken?: string;
    advertiserId: string;
    businessCenterId?: string;
    appId?: string;
    appSecret?: string;
  }) {
    return this.service.testTikTokConnection(body);
  }

  /**
   * Lưu Google Ads credentials vào system settings hoặc env
   */
  @Post('settings/google')
  @RequirePermissions('google-ads.credentials.write')
  async saveGoogleSettings(@Body() body: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    developerToken: string;
    loginCustomerId?: string;
    apiVersion?: string;
  }) {
    return this.service.saveGoogleAdsSettings(body);
  }

  /**
   * Lưu TikTok credentials
   */
  @Post('settings/tiktok')
  @RequirePermissions('google-ads.credentials.write')
  async saveTikTokSettings(@Body() body: {
    accessToken?: string;
    refreshToken?: string;
    appId?: string;
    appSecret?: string;
    authCode?: string;
    redirectUri?: string;
    businessCenterId?: string;
    businessCenterName?: string;
    testAdvertiserId?: string;
    advertiserIds?: string[];
    grantedAdvertiserIds?: string[];
    scopes?: string[];
    accessTokenExpiresAt?: string;
    refreshTokenExpiresAt?: string;
  }) {
    return this.service.saveTikTokSettings(body);
  }
}
