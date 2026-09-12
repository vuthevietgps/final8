import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Fanpage, FanpageSchema } from '../fanpage/schemas/fanpage.schema';
import { ProviderConnection, ProviderConnectionSchema } from './provider-connection.schema';
import { ProviderConnectionsController } from './provider-connections.controller';
import { ProviderConnectionsService } from './provider-connections.service';
import { ProviderDiscoveryService } from './provider-discovery.service';
import { ProviderReadHttpService } from './provider-read-http.service';
import { WindsorAdsReadService } from './windsor-ads-read.service';
import { WindsorAdsResource, WindsorAdsResourceSchema } from './schemas/windsor-ads-resource.schema';
import { WindsorAdsDailyMetric, WindsorAdsDailyMetricSchema } from './schemas/windsor-ads-daily-metric.schema';
import { WindsorAdsSyncRun, WindsorAdsSyncRunSchema } from './schemas/windsor-ads-sync-run.schema';
import { AdvertisingCost, AdvertisingCostSchema } from '../advertising-cost/schemas/advertising-cost.schema';
import { WindsorAdsCostSyncService } from './windsor-ads-cost-sync.service';
import { AdvertisingCostRefreshModule } from '../advertising-cost/advertising-cost-refresh.module';
import { AdAccount, AdAccountSchema } from '../ad-account/schemas/ad-account.schema';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { WindsorAdsCatalogService } from './windsor-ads-catalog.service';

@Module({
  imports: [AdvertisingCostRefreshModule, MongooseModule.forFeature([
    { name: ProviderConnection.name, schema: ProviderConnectionSchema },
    { name: Fanpage.name, schema: FanpageSchema },
    { name: WindsorAdsResource.name, schema: WindsorAdsResourceSchema },
    { name: WindsorAdsDailyMetric.name, schema: WindsorAdsDailyMetricSchema },
    { name: WindsorAdsSyncRun.name, schema: WindsorAdsSyncRunSchema },
    { name: AdvertisingCost.name, schema: AdvertisingCostSchema },
    { name: AdAccount.name, schema: AdAccountSchema },
    { name: AdGroup.name, schema: AdGroupSchema },
  ])],
  controllers: [ProviderConnectionsController],
  providers: [ProviderConnectionsService, ProviderDiscoveryService, ProviderReadHttpService, WindsorAdsReadService, WindsorAdsCostSyncService, WindsorAdsCatalogService],
  exports: [WindsorAdsCostSyncService],
})
export class ProviderConnectionsModule {}
