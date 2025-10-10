import { Controller, Get, Query, Post, Delete } from '@nestjs/common';
import { Summary5Service } from './summary5.service';
import { Summary5FilterDto } from './dto/summary5-filter.dto';

@Controller('summary5')
export class Summary5Controller {
  constructor(private readonly service: Summary5Service) {}

  @Get()
  async findAll(@Query() q: Summary5FilterDto) {
    return this.service.findAll(q);
  }

  @Get('stats')
  async stats(@Query() q: Summary5FilterDto) {
    return this.service.stats(q);
  }

  @Post('sync')
  async sync(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.service.sync({ startDate, endDate });
  }

  @Delete('clear-all')
  async clearAll() {
    return this.service.clearAll();
  }
}
