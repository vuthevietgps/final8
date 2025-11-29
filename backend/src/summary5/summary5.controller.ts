import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Summary5Service } from './summary5.service';

@Controller('summary5')
@UseGuards(JwtAuthGuard, RolesGuard)
export class Summary5Controller {
  constructor(private readonly service: Summary5Service) {}
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.service.findAll({
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    });
  }

  @Get('stats')
  async stats() {
    return this.service.getStats();
  }

  @Post('sync')
  async sync(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.sync(startDate, endDate);
  }
}
