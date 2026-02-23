import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { BudgetAllocationController } from './budget-allocation.controller';
import { BudgetAllocationService } from './budget-allocation.service';
import { CapitalAllocationController } from './capital-allocation.controller';
import { CapitalAllocationService } from './capital-allocation.service';
import { AdGroupDailyReportController } from './ad-group-daily-report.controller';
import { AdGroupDailyReportService } from './ad-group-daily-report.service';
import { FundsService } from './funds.service';
import { FundsController } from './funds.controller';
import { FinancialControlService } from './financial-control.service';
import { FinancialControlController } from './financial-control.controller';
import { LoanManagementService } from './loan-management.service';
import { LoanManagementController } from './loan-management.controller';
// Refactored: Import from new scale-decision module
import { AutoScaleDecisionService } from './scale-decision/auto-scale-decision.service';
import { OptimalSpendCalculatorService } from './scale-decision/optimal-spend-calculator.service';
import { ScaleRulesService } from './scale-decision/scale-rules.service';
import { PhaseRulesService } from './scale-decision/phase-rules.service';
import { AutoScaleExecutionService } from './auto-scale-execution.service';
import { HorizontalScaleService } from './horizontal-scale.service';
import { CashflowSafetyService } from './cashflow-safety.service';
import { FrequencySyncService } from './frequency-sync.service';
import { ExecutiveReportService } from './executive-report.service';
import { DataCollectionService } from './data-collection.service';
import { FundingSource, FundingSourceSchema } from './schemas/funding-source.schema';
import { BudgetBucket, BudgetBucketSchema } from './schemas/budget-bucket.schema';
import { CashflowEntry, CashflowEntrySchema } from './schemas/cashflow-entry.schema';
import { LoanContract, LoanContractSchema } from './schemas/loan-contract.schema';
import { LoanRepayment, LoanRepaymentSchema } from './schemas/loan-repayment.schema';
import { LoanPayment, LoanPaymentSchema } from './schemas/loan-payment.schema';
import { AvailableFundSnapshot, AvailableFundSnapshotSchema } from './schemas/available-fund-snapshot.schema';
import { CapitalAllocationPolicy, CapitalAllocationPolicySchema } from './schemas/capital-allocation-policy.schema';
import { CapitalAllocationSnapshot, CapitalAllocationSnapshotSchema } from './schemas/capital-allocation-snapshot.schema';
import { AdGroupDailyReport, AdGroupDailyReportSchema } from './schemas/ad-group-daily-report.schema';
import { AdsDailySpending, AdsDailySpendingSchema } from './schemas/ads-daily-spending.schema';
import { SupplierPayable, SupplierPayableSchema } from '../supplier-payable/schemas/supplier-payable.schema';
import { AgentStatement, AgentStatementSchema } from '../agent-receivable/schemas/agent-statement.schema';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { AdAccount, AdAccountSchema } from '../ad-account/schemas/ad-account.schema';
import { ApiToken, ApiTokenSchema } from '../api-token/schemas/api-token.schema';
import { LaborStatement, LaborStatementSchema } from '../labor-cost1/schemas/labor-statement.schema';
import { OtherCost, OtherCostSchema } from '../other-cost/schemas/other-cost.schema';
import { AdvertisingCost, AdvertisingCostSchema } from '../advertising-cost/schemas/advertising-cost.schema';
// CFO Spec v3.1: Import modules for cashflow summary
import { SupplierPayableModule } from '../supplier-payable/supplier-payable.module';
import { AgentReceivableModule } from '../agent-receivable/agent-receivable.module';
import { LaborCost1Module } from '../labor-cost1/labor-cost1.module';
import { OtherCostModule } from '../other-cost/other-cost.module';
import { AdvertisingCostModule } from '../advertising-cost/advertising-cost.module';
import { OwnerFundModule } from '../owner-fund/owner-fund.module';
// TODO: Rebuild this module from OrderTest2
import { AdGroupProfitReportModule } from '../ad-group-profit-report/ad-group-profit-report.module';
import { AIOptimizationModule } from '../advertising-optimization/ai-optimization/ai-optimization.module';
import { QualityControlModule } from '../advertising-optimization/quality-control/quality-control.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FundingSource.name, schema: FundingSourceSchema },
      { name: BudgetBucket.name, schema: BudgetBucketSchema },
      { name: CashflowEntry.name, schema: CashflowEntrySchema },
      { name: LoanContract.name, schema: LoanContractSchema },
      { name: LoanRepayment.name, schema: LoanRepaymentSchema },
      { name: LoanPayment.name, schema: LoanPaymentSchema },
      { name: AvailableFundSnapshot.name, schema: AvailableFundSnapshotSchema },
      { name: CapitalAllocationPolicy.name, schema: CapitalAllocationPolicySchema },
      { name: CapitalAllocationSnapshot.name, schema: CapitalAllocationSnapshotSchema },
      { name: AdGroupDailyReport.name, schema: AdGroupDailyReportSchema },
      { name: AdsDailySpending.name, schema: AdsDailySpendingSchema },
      { name: SupplierPayable.name, schema: SupplierPayableSchema },
      { name: AgentStatement.name, schema: AgentStatementSchema },
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: AdAccount.name, schema: AdAccountSchema },
      { name: ApiToken.name, schema: ApiTokenSchema },
      { name: LaborStatement.name, schema: LaborStatementSchema },
      { name: OtherCost.name, schema: OtherCostSchema },
      { name: AdvertisingCost.name, schema: AdvertisingCostSchema },
    ]),
    // TODO: Rebuild from OrderTest2
    forwardRef(() => AdGroupProfitReportModule),
    AIOptimizationModule,
    QualityControlModule,
    // CFO Spec v3.1: Import modules for cashflow summary
    forwardRef(() => SupplierPayableModule),
    forwardRef(() => AgentReceivableModule),
    forwardRef(() => LaborCost1Module),
    forwardRef(() => OtherCostModule),
    forwardRef(() => AdvertisingCostModule),
    forwardRef(() => OwnerFundModule),
  ],
  controllers: [
    FinanceController, 
    BudgetAllocationController, 
    CapitalAllocationController, 
    AdGroupDailyReportController, 
    FundsController,
    FinancialControlController,
    LoanManagementController,
  ],
  providers: [
    FinanceService, 
    BudgetAllocationService,
    LoanManagementService, 
    CapitalAllocationService, 
    AdGroupDailyReportService,
    FundsService,
    FinancialControlService,
    // Scale Decision Module (Refactored)
    AutoScaleDecisionService,
    OptimalSpendCalculatorService,
    ScaleRulesService,
    PhaseRulesService,
    // Other services
    AutoScaleExecutionService,
    HorizontalScaleService,
    CashflowSafetyService,
    FrequencySyncService,
    ExecutiveReportService,
    DataCollectionService,
  ],
  exports: [
    FinanceService, 
    BudgetAllocationService,
    LoanManagementService, 
    CapitalAllocationService, 
    FundsService,
    FinancialControlService,
    AutoScaleDecisionService,
    OptimalSpendCalculatorService,
    ScaleRulesService,
    PhaseRulesService,
    AutoScaleExecutionService, 
    HorizontalScaleService, 
    CashflowSafetyService,
    FrequencySyncService,
    ExecutiveReportService,
    DataCollectionService,
  ],
})
export class FinanceModule {}

