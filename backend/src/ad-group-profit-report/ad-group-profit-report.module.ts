import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdGroupProfitReportService } from './ad-group-profit-report.service';
import { AdGroupProfitReportController } from './ad-group-profit-report.controller';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { OptimalSpendSnapshot, OptimalSpendSnapshotSchema } from './schemas/optimal-spend-snapshot.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: OptimalSpendSnapshot.name, schema: OptimalSpendSnapshotSchema }
    ])
  ],
  controllers: [AdGroupProfitReportController],
  providers: [AdGroupProfitReportService],
  exports: [AdGroupProfitReportService]
})
export class AdGroupProfitReportModule {}
