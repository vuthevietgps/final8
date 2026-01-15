/**
 * File: ad-group-profit-report/ad-group-profit-report.module.ts
 * Mục đích: Module báo cáo lợi nhuận nhóm quảng cáo.
 */
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdGroupProfitReportController } from './ad-group-profit-report.controller';
import { AdGroupProfitReportService } from './ad-group-profit-report.service';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { Summary5, Summary5Schema } from '../summary5/schemas/summary5.schema';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: Summary5.name, schema: Summary5Schema },
    ]),
    forwardRef(() => FinanceModule),
  ],
  controllers: [AdGroupProfitReportController],
  providers: [AdGroupProfitReportService],
  exports: [AdGroupProfitReportService]
})
export class AdGroupProfitReportModule {}
