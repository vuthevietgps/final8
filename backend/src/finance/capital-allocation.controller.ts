import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { CapitalAllocationService } from './capital-allocation.service';
import { CreateCapitalAllocationPolicyDto, UpdateCapitalAllocationPolicyDto } from './dto/create-capital-allocation-policy.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guard';

@Controller('capital-allocation')
export class CapitalAllocationController {
  constructor(private readonly service: CapitalAllocationService) {}

  // ========== POLICIES ==========
  
  @Post('policies')
  @UseGuards(JwtAuthGuard)
  createPolicy(@Body() dto: CreateCapitalAllocationPolicyDto) {
    return this.service.createPolicy(dto);
  }

  @Get('policies')
  getAllPolicies() {
    return this.service.getAllPolicies();
  }

  @Get('policies/active')
  getActivePolicy() {
    return this.service.getActivePolicy();
  }

  @Patch('policies/:id')
  @UseGuards(JwtAuthGuard)
  updatePolicy(
    @Param('id') id: string,
    @Body() dto: UpdateCapitalAllocationPolicyDto
  ) {
    return this.service.updatePolicy(id, dto);
  }

  @Delete('policies/:id')
  @UseGuards(JwtAuthGuard)
  deletePolicy(@Param('id') id: string) {
    return this.service.deletePolicy(id);
  }

  // ========== ALLOCATION COMPUTATION ==========

  @Get('compute')
  computeAllocation(@Query('policyId') policyId?: string) {
    return this.service.computeAllocation(policyId);
  }

  // ========== SNAPSHOTS ==========

  @Post('snapshots')
  @UseGuards(JwtAuthGuard)
  captureSnapshot(
    @Body() body: { note?: string; policyId?: string }
  ) {
    return this.service.captureSnapshot(body.note, body.policyId);
  }

  @Get('snapshots')
  getSnapshots(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 30;
    return this.service.getSnapshots(limitNum);
  }

  @Get('snapshots/latest')
  getLatestSnapshot() {
    return this.service.getLatestSnapshot();
  }

  @Patch('snapshots/:id/usage')
  @UseGuards(JwtAuthGuard)
  updateSnapshotUsage(
    @Param('id') id: string,
    @Body() updates: {
      reinvestmentUsed?: number;
      safetyReserveUsed?: number;
      personalIncomeWithdrawn?: number;
      longTermAssetInvested?: number;
    }
  ) {
    return this.service.updateSnapshotUsage(id, updates);
  }

  // ========== REINVESTMENT BUDGET ==========

  @Get('reinvestment-budget')
  getAvailableReinvestmentBudget() {
    return this.service.getAvailableReinvestmentBudget();
  }
}
