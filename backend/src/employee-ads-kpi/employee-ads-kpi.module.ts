import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmployeeAdsKpiService } from './employee-ads-kpi.service';
import { EmployeeAdsKpiController } from './employee-ads-kpi.controller';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { User, UserSchema } from '../user/user.schema';
import { AdGroupDailyReport, AdGroupDailyReportSchema } from '../finance/schemas/ad-group-daily-report.schema';
import { DailyBudgetAdjustment, DailyBudgetAdjustmentSchema } from './schemas/daily-budget-adjustment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: User.name, schema: UserSchema },
      { name: AdGroupDailyReport.name, schema: AdGroupDailyReportSchema },
      { name: DailyBudgetAdjustment.name, schema: DailyBudgetAdjustmentSchema },
    ]),
  ],
  controllers: [EmployeeAdsKpiController],
  providers: [EmployeeAdsKpiService],
  exports: [EmployeeAdsKpiService],
})
export class EmployeeAdsKpiModule {}
