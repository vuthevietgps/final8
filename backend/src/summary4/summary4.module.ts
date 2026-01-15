import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Summary4Controller } from './summary4.controller';
import { Summary4Service } from './summary4.service';
import { Summary4SyncService } from './summary4-sync.service';
import { Summary4GoogleSyncService } from './summary4-google-sync.service';
import { Summary4, Summary4Schema } from './schemas/summary4.schema';
import { TestOrder2Module } from '../test-order2/test-order2.module';
import { QuoteModule } from '../quote/quote.module';
import { GoogleSyncModule } from '../google-sync/google-sync.module';
import { UserModule } from '../user/user.module';
import { Summary5Module } from '../summary5/summary5.module';
import { InventorySummary, InventorySummarySchema } from '../inventory/schemas/inventory-summary.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Summary4.name, schema: Summary4Schema },
      { name: InventorySummary.name, schema: InventorySummarySchema },
    ]),
    forwardRef(() => TestOrder2Module),
    QuoteModule,
    GoogleSyncModule,
    UserModule,
    Summary5Module,
  ],
  controllers: [Summary4Controller],
  providers: [Summary4Service, Summary4SyncService, Summary4GoogleSyncService],
  exports: [Summary4Service, Summary4SyncService, Summary4GoogleSyncService],
})
export class Summary4Module {}
