import { Controller, Get, UseGuards } from '@nestjs/common';
import { OpsActionService } from './ops-action.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('ops-actions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OpsActionController {
  constructor(private readonly service: OpsActionService) {}

  @Get('suggestions')
  @RequirePermissions('purchase-costs')
  async getActionSuggestions() {
    return this.service.getActionSuggestions();
  }
}
