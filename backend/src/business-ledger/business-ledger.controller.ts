import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { JwtAuthGuard, RolesGuard } from "../auth/guards/auth.guard";
import { RequirePermissions } from "../auth/decorators/auth.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { FeatureModule } from "../plan/feature-module.decorator";
import { BusinessLedgerService } from "./business-ledger.service";
import { CounterpartyLedgerService } from './counterparty-ledger.service';
import { SettlementService } from './settlement.service';
import { CreateSettlementDto, ConfirmSettlementDto, SettlementOperationDto, ReverseSettlementDto } from './settlement.dto';
import { BankReconciliationService } from './bank-reconciliation.service';
import {
  CreateBankStatementDto,
  MatchBankStatementLineDto,
  UnmatchBankStatementLineDto,
} from './bank-reconciliation.dto';
import { AdGroupManagementService } from './ad-group-management.service';
import { DebtScheduleService } from './debt-schedule.service';
import { SaveDebtScheduleDto } from './debt-schedule.dto';
import { AdGroupManagementQuery, CreateAdGroupManagementReviewDto } from './ad-group-management.dto';
import {
  CreateLedgerAccountDto,
  CreateLedgerEntryDto,
  CreateLedgerProfileDto,
  LedgerReportQuery,
  RejectLedgerEntryDto,
} from "./business-ledger.dto";

const validate = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
@FeatureModule("finance")
@Controller("finance/business-ledger")
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions("finance", "finance.cashflow.manage")
export class BusinessLedgerController {
  constructor(
    private readonly service: BusinessLedgerService,
    private counterparties: CounterpartyLedgerService,
    private settlements: SettlementService,
    private bankReconciliation: BankReconciliationService,
    private adGroupManagement: AdGroupManagementService,
    private debtSchedules: DebtScheduleService,
  ) {}
  @Get('ad-group-management') adGroupManagementSummary(@Query(validate) query: AdGroupManagementQuery) {
    return this.adGroupManagement.summary(query);
  }
  @Post('ad-group-management/:adGroupId/reviews') createAdGroupManagementReview(
    @Param('adGroupId') adGroupId: string,
    @Body(validate) dto: CreateAdGroupManagementReviewDto,
    @CurrentUser() user: any,
  ) { return this.adGroupManagement.createReview(adGroupId, dto, this.actor(user)); }
  @Get('bank-statements') bankStatements(@Query('accountId') accountId?: string) {
    return this.bankReconciliation.list(accountId);
  }
  @Post('bank-statements') createBankStatement(
    @Body(validate) dto: CreateBankStatementDto,
    @CurrentUser() user: any,
  ) { return this.bankReconciliation.create(dto, this.actor(user)); }
  @Get('bank-statements/:id/reconciliation') bankStatementReconciliation(@Param('id') id: string) {
    return this.bankReconciliation.reconciliation(id);
  }
  @Post('bank-statement-lines/:id/match') matchBankStatementLine(
    @Param('id') id: string,
    @Body(validate) dto: MatchBankStatementLineDto,
    @CurrentUser() user: any,
  ) { return this.bankReconciliation.match(id, dto, this.actor(user)); }
  @Post('bank-statement-lines/:id/unmatch') unmatchBankStatementLine(
    @Param('id') id: string,
    @Body(validate) dto: UnmatchBankStatementLineDto,
    @CurrentUser() user: any,
  ) { return this.bankReconciliation.unmatch(id, dto, this.actor(user)); }
  @Get('counterparties') counterpartiesSummary(@Query('kind') kind:string){
    return this.counterparties.summary((kind||'supplier') as 'agent'|'supplier');
  }
  @Get('counterparties/:partyKey') counterparty(@Param('partyKey') key:string){return this.counterparties.snapshot(key);}
  @Post('debt-schedules') saveDebtSchedule(@Body(validate) dto: SaveDebtScheduleDto, @CurrentUser() user: any) {
    return this.debtSchedules.save(dto, this.actor(user));
  }
  @Get('capital-evidence') capitalEvidence() { return this.counterparties.snapshot(); }
  @Get('settlements') settlementList(@Query('partyKey') key?:string){return this.settlements.list(key);}
  @Get('settlements/:id') settlementDetail(@Param('id') id:string){return this.settlements.detail(id);}
  @Post('settlements') settlementCreate(@Body(validate) dto:CreateSettlementDto,@CurrentUser() user:any){return this.settlements.create(dto,this.actor(user));}
  @Post('settlements/:id/confirm') settlementConfirm(@Param('id') id:string,@Body(validate) dto:ConfirmSettlementDto,@CurrentUser() user:any){return this.settlements.confirm(id,dto.evidence,this.actor(user));}
  @Post('settlements/:id/operations') settlementOperation(@Param('id') id:string,@Body(validate) dto:SettlementOperationDto,@CurrentUser() user:any){return this.settlements.operate(id,dto,this.actor(user));}
  @Post('settlements/:id/reverse') settlementReverse(@Param('id') id:string,@Body(validate) dto:ReverseSettlementDto,@CurrentUser() user:any){return this.settlements.reverse(id,dto,this.actor(user));}
  private actor(user: any) {
    return String(user?.id || user?._id || user?.sub || "");
  }
  @Get("accounts") accounts() {
    return this.service.listAccounts();
  }
  @Get('purchases') purchases() { return this.service.purchaseOptions(); }
  @Post("accounts") createAccount(
    @Body(validate) dto: CreateLedgerAccountDto,
    @CurrentUser() user: any,
  ) {
    return this.service.createAccount(dto, this.actor(user));
  }
  @Post("profiles") createProfile(
    @Body(validate) dto: CreateLedgerProfileDto,
    @CurrentUser() user: any,
  ) {
    return this.service.createProfile(dto, this.actor(user));
  }
  @Get("orders/:id") detail(@Param("id") id: string) {
    return this.service.orderDetail(id);
  }
  @Post("entries") create(
    @Body(validate) dto: CreateLedgerEntryDto,
    @CurrentUser() user: any,
  ) {
    return this.service.createEntry(dto, this.actor(user));
  }
  @Post("entries/:id/confirm") confirm(
    @Param("id") id: string,
    @CurrentUser() user: any,
  ) {
    return this.service.confirmEntry(id, this.actor(user));
  }
  @Post("entries/:id/reject") reject(
    @Param("id") id: string,
    @Body(validate) dto: RejectLedgerEntryDto,
    @CurrentUser() user: any,
  ) {
    return this.service.rejectEntry(id, dto.reason, this.actor(user));
  }
  @Get("pending") pending() {
    return this.service.listPending();
  }
  @Get("report") report(@Query(validate) query: LedgerReportQuery) {
    return this.service.report(query.from, query.to);
  }
}
