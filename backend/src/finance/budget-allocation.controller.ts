import { Controller, Post, Get, Query, Body, UseGuards } from '@nestjs/common';
import { BudgetAllocationService } from './budget-allocation.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';

@Controller('budget-allocation')
@UseGuards(JwtAuthGuard)
export class BudgetAllocationController {
  constructor(private readonly budgetAllocationService: BudgetAllocationService) {}

  /**
   * POST /budget-allocation/auto
   * Tự động phân bổ nguồn vốn vào ad groups
   */
  @Post('auto')
  async autoAllocate(
    @Body() body: {
      dryRun?: boolean;
      minBudget?: number;
      maxBudget?: number;
      priorityMode?: 'roi' | 'profit' | 'equal';
    }
  ) {
    return this.budgetAllocationService.autoAllocateBudget(body);
  }

  /**
   * GET /budget-allocation/status
   * Lấy trạng thái hiện tại
   */
  @Get('status')
  async getStatus() {
    return this.budgetAllocationService.getAllocationStatus();
  }

  /**
   * GET /budget-allocation/preview
   * Preview phân bổ mà không apply
   */
  @Get('preview')
  async preview(
    @Query('minBudget') minBudget?: string,
    @Query('maxBudget') maxBudget?: string,
    @Query('priorityMode') priorityMode?: 'roi' | 'profit' | 'equal'
  ) {
    return this.budgetAllocationService.autoAllocateBudget({
      dryRun: true,
      minBudget: minBudget ? +minBudget : undefined,
      maxBudget: maxBudget ? +maxBudget : undefined,
      priorityMode: priorityMode || 'roi'
    });
  }
}
