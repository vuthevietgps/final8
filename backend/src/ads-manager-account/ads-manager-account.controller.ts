import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { Roles } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { SecretRedactionInterceptor } from '../common/interceptors/secret-redaction.interceptor';
import { FeatureModule } from '../plan/feature-module.decorator';
import { AdsManagerAccountService } from './ads-manager-account.service';
import { CreateAdsManagerAccountDto } from './dto/create-ads-manager-account.dto';
import { UpdateAdsManagerAccountDto } from './dto/update-ads-manager-account.dto';
import { UserRole } from '../user/user.enum';

@FeatureModule('api-token')
@Controller('ads-manager-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(SecretRedactionInterceptor)
export class AdsManagerAccountController {
  constructor(private readonly service: AdsManagerAccountService) {}

  @Get('readiness/summary')
  @RequirePermissions('google-ads.credentials.read')
  readinessSummary() {
    return this.service.readinessSummary();
  }

  @Post()
  @RequirePermissions('google-ads.credentials.write')
  create(@Body() dto: CreateAdsManagerAccountDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions('google-ads.credentials.read')
  findAll(@Query() query: any) {
    return this.service.findAll(query || {});
  }

  @Get(':id')
  @RequirePermissions('google-ads.credentials.read')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('google-ads.credentials.write')
  update(@Param('id') id: string, @Body() dto: UpdateAdsManagerAccountDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/verify-readonly')
  @Roles(UserRole.DIRECTOR)
  @RequirePermissions('google-ads.credentials.write')
  verifyReadOnly(@CurrentUser() currentUser: any, @Param('id') id: string) {
    const userId = currentUser?._id || currentUser?.id || currentUser?.sub;
    return this.service.verifyAndImportReadOnly(id, userId ? String(userId) : undefined);
  }
}
