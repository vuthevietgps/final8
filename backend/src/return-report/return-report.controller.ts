import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReturnReportService } from './return-report.service';
import { ReturnReportFilterDto } from './dto/return-report-filter.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('return-report')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReturnReportController {
  constructor(private readonly service: ReturnReportService) {}

  @Get('ad-group')
  @RequirePermissions('reports')
  async byAdGroup(@Query() filter: ReturnReportFilterDto) {
    return this.service.byAdGroup(filter);
  }

  @Get('product')
  @RequirePermissions('reports')
  async byProduct(@Query() filter: ReturnReportFilterDto) {
    return this.service.byProduct(filter);
  }
}
