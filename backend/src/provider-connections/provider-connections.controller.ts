import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { FeatureModule } from '../plan/feature-module.decorator';
import { SaveProviderConnectionDto } from './provider-connection.dto';
import { ProviderConnectionsService } from './provider-connections.service';
import { WindsorAdsReadService } from './windsor-ads-read.service';
import { WindsorAdsReadSyncDto, WindsorAdsSnapshotQueryDto } from './windsor-ads-read.dto';
import { Query } from '@nestjs/common';
import { WindsorAdsCostSyncService } from './windsor-ads-cost-sync.service';
import { WindsorAdsCatalogService } from './windsor-ads-catalog.service';

@Controller('provider-connections')
@FeatureModule('api-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('google-ads.credentials.read', 'meta-ads.credentials.read')
export class ProviderConnectionsController {
  constructor(
    private readonly service: ProviderConnectionsService,
    private readonly windsorAdsRead: WindsorAdsReadService,
    private readonly windsorAdsCostSync: WindsorAdsCostSyncService,
    private readonly windsorCatalog: WindsorAdsCatalogService,
  ) {}

  @Get() list() { return this.service.list(); }
  @Get('configuration-status') status() { return this.service.configurationStatus(); }
  @Get('fanpages') pages() { return this.service.pageOptions(); }

  @Post()
  @RequirePermissions('google-ads.credentials.write', 'meta-ads.credentials.write')
  create(@Body() dto: SaveProviderConnectionDto, @CurrentUser() user: any) {
    return this.service.save(undefined, dto, String(user.id || user._id));
  }

  @Patch(':id')
  @RequirePermissions('google-ads.credentials.write', 'meta-ads.credentials.write')
  update(@Param('id') id: string, @Body() dto: SaveProviderConnectionDto, @CurrentUser() user: any) {
    return this.service.save(id, dto, String(user.id || user._id));
  }

  @Post(':id/check')
  @RequirePermissions('google-ads.credentials.write', 'meta-ads.credentials.write')
  check(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.check(id, String(user.id || user._id));
  }

  @Post(':id/ads-read-sync')
  @RequirePermissions('google-ads.read')
  syncAdsRead(@Param('id') id: string, @Body() dto: WindsorAdsReadSyncDto, @CurrentUser() user: any) {
    return this.windsorAdsCostSync.syncConnection(id, dto, String(user.id || user._id));
  }

  @Get(':id/ads-snapshot')
  @RequirePermissions('google-ads.read')
  adsSnapshot(@Param('id') id: string, @Query() query: WindsorAdsSnapshotQueryDto) {
    return this.windsorAdsCostSync.snapshot(id, query);
  }

  @Post(':id/ads-catalog-sync')
  @RequirePermissions('google-ads.read')
  syncCatalog(@Param('id') id: string) {
    return this.windsorCatalog.reconcile(id);
  }

  @Get(':id/ads-sync-runs')
  @RequirePermissions('google-ads.read')
  adsSyncRuns(@Param('id') id: string) {
    return this.windsorAdsRead.runs(id);
  }
}
