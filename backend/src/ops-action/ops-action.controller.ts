import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OpsActionService } from './ops-action.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FeatureModule } from '../plan/feature-module.decorator';
import { ApproveOpsTaskDto, CreateOpsActionPlanFromSuggestionsDto, ListOpsActionPlansQueryDto, ListOpsTasksQueryDto, RejectOpsTaskDto } from './dto/ops-action-plan.dto';

@FeatureModule('ops-action')
@Controller('ops-actions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OpsActionController {
  constructor(private readonly service: OpsActionService) {}

  @Get('suggestions')
  @RequirePermissions('purchase-costs')
  async getActionSuggestions() {
    return this.service.getActionSuggestions();
  }

  @Post('plans/from-suggestions')
  @RequirePermissions('purchase-costs')
  async createPlanFromSuggestions(@CurrentUser() currentUser: any, @Body() body: CreateOpsActionPlanFromSuggestionsDto) {
    return this.service.createPlanFromSuggestions(currentUser, body);
  }

  @Get('plans')
  @RequirePermissions('purchase-costs')
  async listPlans(@Query() query: ListOpsActionPlansQueryDto) {
    return this.service.listPlans(query);
  }

  @Get('plans/:planId')
  @RequirePermissions('purchase-costs')
  async getPlan(@Param('planId') planId: string) {
    return this.service.getPlan(planId);
  }

  @Get('tasks')
  @RequirePermissions('purchase-costs')
  async listTasks(@Query() query: ListOpsTasksQueryDto) {
    return this.service.listTasks(query);
  }

  @Patch('plans/:planId/tasks/:taskId/approve')
  @RequirePermissions('purchase-costs')
  async approveTask(@CurrentUser() currentUser: any, @Param('planId') planId: string, @Param('taskId') taskId: string, @Body() body: ApproveOpsTaskDto) {
    return this.service.approveTask(currentUser, planId, taskId, body);
  }

  @Patch('plans/:planId/tasks/:taskId/reject')
  @RequirePermissions('purchase-costs')
  async rejectTask(@CurrentUser() currentUser: any, @Param('planId') planId: string, @Param('taskId') taskId: string, @Body() body: RejectOpsTaskDto) {
    return this.service.rejectTask(currentUser, planId, taskId, body);
  }
}
