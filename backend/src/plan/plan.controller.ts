import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { getCurrentPlan, PLAN_CONFIG } from './plan-config';
import { PlanService } from './plan.service';

@Controller('plan')
@UseGuards(JwtAuthGuard)
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get('info')
  async getPlanInfo() {
    const plan = getCurrentPlan();
    const config = PLAN_CONFIG[plan];
    const currentUsers = await this.planService.countActiveUsers();

    return {
      plan,
      maxUsers: config.maxUsers === Infinity ? 'unlimited' : config.maxUsers,
      currentUsers,
      modules: config.modules,
    };
  }
}
