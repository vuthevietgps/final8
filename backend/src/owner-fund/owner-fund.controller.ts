import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { OwnerFundService } from './owner-fund.service';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ApproveWithdrawalDto } from './dto/approve-withdrawal.dto';
import { CreateFundTransactionDto } from './dto/create-fund-transaction.dto';
import { TransferToOwnerFundDto, TransferFromOwnerFundDto, OwnerWithdrawFromFundDto } from './dto/transfer.dto';
import { WithdrawalStatus } from './schemas/withdrawal.schema';
import { FundTransactionType, FundTransactionCategory } from './schemas/fund-transaction.schema';
import { FeatureModule } from '../plan/feature-module.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@FeatureModule('owner-fund')
@Controller('owner-fund')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('owner-fund')
export class OwnerFundController {
  constructor(private readonly ownerFundService: OwnerFundService) {}

  // ==================== OWNER ENDPOINTS ====================

  @Post('owners')
  async createOwner(@Body() createOwnerDto: CreateOwnerDto) {
    return this.ownerFundService.createOwner(createOwnerDto);
  }

  @Get('owners')
  async findAllOwners() {
    return this.ownerFundService.findAllOwners();
  }

  @Get('owners/:id')
  async findOwnerById(@Param('id') id: string) {
    return this.ownerFundService.findOwnerById(id);
  }

  @Patch('owners/:id')
  async updateOwner(
    @Param('id') id: string,
    @Body() updateOwnerDto: UpdateOwnerDto,
  ) {
    return this.ownerFundService.updateOwner(id, updateOwnerDto);
  }

  @Delete('owners/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOwner(@Param('id') id: string) {
    return this.ownerFundService.deleteOwner(id);
  }

  @Get('owners/:id/statistics')
  async getOwnerStatistics(@Param('id') id: string) {
    return this.ownerFundService.getOwnerStatistics(id);
  }

  // ==================== WITHDRAWAL ENDPOINTS ====================

  @Post('withdrawals')
  async createWithdrawal(@Body() createWithdrawalDto: CreateWithdrawalDto) {
    return this.ownerFundService.createWithdrawal(createWithdrawalDto);
  }

  @Get('withdrawals')
  async findAllWithdrawals(
    @Query('ownerId') ownerId?: string,
    @Query('status') status?: WithdrawalStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: any = {};
    
    if (ownerId) filters.ownerId = ownerId;
    if (status) filters.status = status;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    
    return this.ownerFundService.findAllWithdrawals(filters);
  }

  @Get('withdrawals/:id')
  async findWithdrawalById(@Param('id') id: string) {
    return this.ownerFundService.findWithdrawalById(id);
  }

  @Post('withdrawals/:id/approve')
  async approveWithdrawal(
    @Param('id') id: string,
    @Body() approveDto: ApproveWithdrawalDto,
  ) {
    return this.ownerFundService.approveWithdrawal(id, approveDto);
  }

  @Post('withdrawals/:id/reject')
  async rejectWithdrawal(
    @Param('id') id: string,
    @Body() approveDto: ApproveWithdrawalDto,
  ) {
    return this.ownerFundService.rejectWithdrawal(id, approveDto);
  }

  @Post('withdrawals/:id/complete')
  async completeWithdrawal(
    @Param('id') id: string,
    @Body() body: { transactionReference?: string },
  ) {
    return this.ownerFundService.completeWithdrawal(id, body.transactionReference);
  }

  @Post('withdrawals/:id/cancel')
  async cancelWithdrawal(@Param('id') id: string) {
    return this.ownerFundService.cancelWithdrawal(id);
  }

  // ==================== STATISTICS ====================

  @Get('statistics/system')
  async getSystemStatistics() {
    return this.ownerFundService.getSystemStatistics();
  }

  // ==================== FUND SUMMARY ====================

  @Get('fund-summary')
  async getFundSummary() {
    return this.ownerFundService.getFundSummary();
  }

  // ==================== FUND TRANSACTIONS ====================

  @Post('transactions')
  async createFundTransaction(@Body() dto: CreateFundTransactionDto) {
    return this.ownerFundService.createFundTransaction(dto);
  }

  @Get('transactions')
  async findAllFundTransactions(
    @Query('ownerId') ownerId?: string,
    @Query('type') type?: FundTransactionType,
    @Query('category') category?: FundTransactionCategory,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: any = {};
    
    if (ownerId) filters.ownerId = ownerId;
    if (type) filters.type = type;
    if (category) filters.category = category;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    
    return this.ownerFundService.findAllFundTransactions(filters);
  }

  @Get('owners/:id/transactions')
  async getOwnerTransactionHistory(@Param('id') id: string) {
    return this.ownerFundService.getOwnerTransactionHistory(id);
  }

  // ==================== BALANCE UPDATE ====================

  @Post('owners/:id/update-balance')
  async updateOwnerBalance(
    @Param('id') id: string,
    @Body() body: { profitAmount: number },
  ) {
    return this.ownerFundService.updateOwnerBalance(id, body.profitAmount);
  }

  // ==================== FUND ACCOUNT (Quỹ Owner riêng) ====================

  /**
   * Lấy thông tin tài khoản Quỹ Owner
   * GET /owner-fund/fund-account
   */
  @Get('fund-account')
  async getFundAccount() {
    return this.ownerFundService.getFundAccount();
  }

  /**
   * Chuyển tiền từ Bank Balance vào Quỹ Owner
   * POST /owner-fund/fund-account/transfer-in
   * Body: { amount: number, description?: string }
   */
  @Post('fund-account/transfer-in')
  async transferToOwnerFund(
    @Body() dto: TransferToOwnerFundDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.ownerFundService.transferToOwnerFund(dto, String(currentUser?.id || ''));
  }

  /**
   * Chuyển tiền từ Quỹ Owner về Bank Balance (trả lại công ty)
   * POST /owner-fund/fund-account/transfer-out
   * Body: { amount: number, description?: string }
   */
  @Post('fund-account/transfer-out')
  async transferFromOwnerFund(
    @Body() dto: TransferFromOwnerFundDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.ownerFundService.transferFromOwnerFund(dto, String(currentUser?.id || ''));
  }

  /**
   * Owner rút tiền từ Quỹ Owner về cá nhân
   * POST /owner-fund/fund-account/withdraw
   * Body: { amount: number, description?: string, bankAccount?: string, bankName?: string }
   */
  @Post('fund-account/withdraw')
  async ownerWithdrawFromFund(
    @Body() dto: OwnerWithdrawFromFundDto,
    @CurrentUser() currentUser: any,
  ) {
    return this.ownerFundService.ownerWithdrawFromFund(dto, String(currentUser?.id || ''));
  }

  /**
   * Cập nhật thông tin tài khoản Quỹ Owner
   * PATCH /owner-fund/fund-account
   * Body: { bankAccount?: string, bankName?: string, name?: string }
   */
  @Patch('fund-account')
  async updateFundAccount(
    @Body() updateDto: { bankAccount?: string; bankName?: string; name?: string },
  ) {
    return this.ownerFundService.updateFundAccount(updateDto);
  }
}
