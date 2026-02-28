import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdReportService } from './ad-report.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('ad-report')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('ad-groups')
export class AdReportController {
  constructor(private readonly service: AdReportService) {}

  @Get('cost-per-order')
  async costPerOrder(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('adGroupId') adGroupId?: string,
  ) {
    return this.service.costPerOrderByAdGroup({ from, to, adGroupId });
  }
}
