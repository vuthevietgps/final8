import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateFundingSourceDto } from './dto/create-funding-source.dto';
import { UpdateFundingSourceDto } from './dto/update-funding-source.dto';
import { CreateBudgetBucketDto } from './dto/create-budget-bucket.dto';
import { UpdateBudgetBucketDto } from './dto/update-budget-bucket.dto';
import { CreateCashflowEntryDto } from './dto/create-cashflow-entry.dto';
import { CreateLoanContractDto } from './dto/create-loan-contract.dto';
import { UpdateLoanContractDto } from './dto/update-loan-contract.dto';
import { CreateLoanRepaymentDto } from './dto/create-loan-repayment.dto';
import { CaptureAvailableFundDto } from './dto/capture-available-fund.dto';

@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // Funding sources (vay vốn / góp vốn / nội bộ)
  @Post('funding-sources')
  createFundingSource(@Body() dto: CreateFundingSourceDto) {
    return this.financeService.createFundingSource(dto);
  }

  @Get('funding-sources')
  listFundingSources(@Query('type') type?: string, @Query('status') status?: string) {
    return this.financeService.listFundingSources({ type, status });
  }

  @Patch('funding-sources/:id')
  updateFundingSource(@Param('id') id: string, @Body() dto: UpdateFundingSourceDto) {
    return this.financeService.updateFundingSource(id, dto);
  }

  // Budget buckets (ngân sách theo nhóm sản phẩm / kênh)
  @Post('budget-buckets')
  createBudgetBucket(@Body() dto: CreateBudgetBucketDto) {
    return this.financeService.createBudgetBucket(dto);
  }

  @Get('budget-buckets')
  listBudgetBuckets() {
    return this.financeService.listBudgetBuckets();
  }

  @Patch('budget-buckets/:id')
  updateBudgetBucket(@Param('id') id: string, @Body() dto: UpdateBudgetBucketDto) {
    return this.financeService.updateBudgetBucket(id, dto);
  }

  // Cashflow entries (tiền vào/ra)
  @Post('cashflows')
  createCashflow(@Body() dto: CreateCashflowEntryDto) {
    return this.financeService.createCashflow(dto);
  }

  @Get('cashflows')
  listCashflows(
    @Query('direction') direction?: string,
    @Query('sourceType') sourceType?: string,
    @Query('bucketId') bucketId?: string,
  ) {
    return this.financeService.listCashflows({ direction, sourceType, bucketId });
  }

  // Tổng quan ngân sách và nguồn vốn
  @Get('summary')
  summary() {
    return this.financeService.summary();
  }

  // Available funds (computed + snapshot)
  @Get('available-funds/current')
  currentAvailable(
    @Query('collectedRevenue') collectedRevenue?: string,
    @Query('loanAvailable') loanAvailable?: string,
    @Query('actualSpent') actualSpent?: string,
    @Query('reservedPayroll') reservedPayroll?: string,
    @Query('reservedInterest') reservedInterest?: string,
    @Query('reservedPayables') reservedPayables?: string,
    @Query('reservedSuppliers') reservedSuppliers?: string,
    @Query('reservedAgents') reservedAgents?: string,
    @Query('reservedOther') reservedOther?: string,
  ) {
    return this.financeService.computeAvailableFunds({
      collectedRevenue: collectedRevenue ? +collectedRevenue : undefined,
      loanAvailable: loanAvailable ? +loanAvailable : undefined,
      actualSpent: actualSpent ? +actualSpent : undefined,
      reservedPayroll: reservedPayroll ? +reservedPayroll : undefined,
      reservedInterest: reservedInterest ? +reservedInterest : undefined,
      reservedPayables: reservedPayables ? +reservedPayables : undefined,
      reservedSuppliers: reservedSuppliers ? +reservedSuppliers : undefined,
      reservedAgents: reservedAgents ? +reservedAgents : undefined,
      reservedOther: reservedOther ? +reservedOther : undefined,
    });
  }

  @Get('available-funds')
  listAvailable() {
    return this.financeService.listAvailableFundSnapshots();
  }

  @Post('available-funds/capture')
  captureAvailable(@Body() dto: CaptureAvailableFundDto) {
    return this.financeService.captureAvailableFunds(dto);
  }

  // Loan management
  @Post('loans')
  createLoan(@Body() dto: CreateLoanContractDto) {
    return this.financeService.createLoanContract(dto);
  }

  @Get('loans')
  listLoans(@Query('status') status?: string) {
    return this.financeService.listLoanContracts(status);
  }

  @Patch('loans/:id')
  updateLoan(@Param('id') id: string, @Body() dto: UpdateLoanContractDto) {
    return this.financeService.updateLoanContract(id, dto);
  }

  @Get('loans/:id')
  getLoan(@Param('id') id: string) {
    return this.financeService.getLoanContract(id);
  }

  @Post('loans/:id/repayments')
  createRepayment(@Param('id') id: string, @Body() dto: CreateLoanRepaymentDto) {
    return this.financeService.createLoanRepayment({ ...dto, loanId: id });
  }

  @Get('loans/:id/repayments')
  listRepayments(@Param('id') id: string) {
    return this.financeService.listLoanRepayments(id);
  }

  @Get('repayments/upcoming')
  listUpcoming(@Query('days') days?: string) {
    return this.financeService.listUpcomingRepayments(days ? +days : 7);
  }
}
