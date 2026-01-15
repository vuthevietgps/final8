import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { BudgetAllocationController } from './budget-allocation.controller';
import { BudgetAllocationService } from './budget-allocation.service';
import { FundingSource, FundingSourceSchema } from './schemas/funding-source.schema';
import { BudgetBucket, BudgetBucketSchema } from './schemas/budget-bucket.schema';
import { CashflowEntry, CashflowEntrySchema } from './schemas/cashflow-entry.schema';
import { LoanContract, LoanContractSchema } from './schemas/loan-contract.schema';
import { LoanRepayment, LoanRepaymentSchema } from './schemas/loan-repayment.schema';
import { AvailableFundSnapshot, AvailableFundSnapshotSchema } from './schemas/available-fund-snapshot.schema';
import { Summary5, Summary5Schema } from '../summary5/schemas/summary5.schema';
import { Summary4, Summary4Schema } from '../summary4/schemas/summary4.schema';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { AdAccount, AdAccountSchema } from '../ad-account/schemas/ad-account.schema';
import { ApiToken, ApiTokenSchema } from '../api-token/schemas/api-token.schema';
import { AdGroupProfitReportModule } from '../ad-group-profit-report/ad-group-profit-report.module';
import { AIOptimizationModule } from '../advertising-optimization/ai-optimization/ai-optimization.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FundingSource.name, schema: FundingSourceSchema },
      { name: BudgetBucket.name, schema: BudgetBucketSchema },
      { name: CashflowEntry.name, schema: CashflowEntrySchema },
      { name: LoanContract.name, schema: LoanContractSchema },
      { name: LoanRepayment.name, schema: LoanRepaymentSchema },
      { name: AvailableFundSnapshot.name, schema: AvailableFundSnapshotSchema },
      { name: Summary5.name, schema: Summary5Schema },
      { name: Summary4.name, schema: Summary4Schema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: AdAccount.name, schema: AdAccountSchema },
      { name: ApiToken.name, schema: ApiTokenSchema },
    ]),
    forwardRef(() => AdGroupProfitReportModule),
    AIOptimizationModule,
  ],
  controllers: [FinanceController, BudgetAllocationController],
  providers: [FinanceService, BudgetAllocationService],
  exports: [FinanceService, BudgetAllocationService],
})
export class FinanceModule {}
