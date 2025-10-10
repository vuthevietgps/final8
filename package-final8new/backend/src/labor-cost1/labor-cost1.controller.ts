import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LaborCost1Service } from './labor-cost1.service';
import { CreateLaborCost1Dto } from './dto/create-labor-cost1.dto';
import { UpdateLaborCost1Dto } from './dto/update-labor-cost1.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('labor-cost1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LaborCost1Controller {
  constructor(private readonly service: LaborCost1Service) {}

  @Get()
  @RequirePermissions('labor-costs')
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @RequirePermissions('labor-costs')
  create(@Body() dto: CreateLaborCost1Dto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('labor-costs')
  update(@Param('id') id: string, @Body() dto: UpdateLaborCost1Dto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('labor-costs')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('generate-from-sessions')
  @RequirePermissions('labor-costs')
  generateFromSessionLogs(
    @Query('userId') userId?: string,
    @Query('date') date?: string
  ) {
    return this.service.generateFromSessionLogs(userId, date);
  }
}
