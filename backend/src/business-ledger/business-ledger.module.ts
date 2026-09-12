import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  TestOrder2,
  TestOrder2Schema,
} from "../test-order2/schemas/test-order2.schema";
import { Product, ProductSchema } from "../product/schemas/product.schema";
import {
  LedgerAccount,
  LedgerAccountSchema,
  LedgerEntry,
  LedgerEntrySchema,
  LedgerOrderProfile,
  LedgerOrderProfileSchema,
} from "./business-ledger.schema";
import { BusinessLedgerService } from "./business-ledger.service";
import { BusinessLedgerController } from "./business-ledger.controller";
import { CounterpartyLedgerService } from './counterparty-ledger.service';
import { LedgerSettlement, LedgerSettlementSchema } from './settlement.schema';
import { SettlementService } from './settlement.service';
import {
  BankStatement,
  BankStatementLine,
  BankStatementLineSchema,
  BankStatementSchema,
} from './bank-reconciliation.schema';
import { BankReconciliationService } from './bank-reconciliation.service';
import { AdGroupManagementReview, AdGroupManagementReviewSchema } from './ad-group-management.schema';
import { AdGroupManagementService } from './ad-group-management.service';
import { DebtScheduleRevision, DebtScheduleRevisionSchema } from './debt-schedule.schema';
import { DebtScheduleService } from './debt-schedule.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DebtScheduleRevision.name, schema: DebtScheduleRevisionSchema },
      { name: LedgerSettlement.name, schema: LedgerSettlementSchema },
      { name: LedgerEntry.name, schema: LedgerEntrySchema },
      { name: LedgerAccount.name, schema: LedgerAccountSchema },
      { name: LedgerOrderProfile.name, schema: LedgerOrderProfileSchema },
      { name: BankStatement.name, schema: BankStatementSchema },
      { name: BankStatementLine.name, schema: BankStatementLineSchema },
      { name: AdGroupManagementReview.name, schema: AdGroupManagementReviewSchema },
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [BusinessLedgerController],
  providers: [BusinessLedgerService, CounterpartyLedgerService, SettlementService, BankReconciliationService, AdGroupManagementService, DebtScheduleService],
  exports: [BusinessLedgerService, CounterpartyLedgerService],
})
export class BusinessLedgerModule {}
