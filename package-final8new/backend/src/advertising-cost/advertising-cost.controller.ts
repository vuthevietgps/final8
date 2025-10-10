/**
 * File: advertising-cost/advertising-cost.controller.ts
 * Mục đích: Cung cấp REST API CRUD cho Chi Phí Quảng Cáo.
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdvertisingCostService } from './advertising-cost.service';
import { CreateAdvertisingCostDto } from './dto/create-advertising-cost.dto';
import { UpdateAdvertisingCostDto } from './dto/update-advertising-cost.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('advertising-cost')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdvertisingCostController {
  constructor(private readonly service: AdvertisingCostService) {}

  @Post()
  @RequirePermissions('advertising-costs')
  create(@Body() dto: CreateAdvertisingCostDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions('advertising-costs')
  findAll(@Query() query?: any) {
    return this.service.findAll(query);
  }

  @Get('stats/summary')
  @RequirePermissions('advertising-costs')
  stats() {
    return this.service.summary();
  }

  @Get(':id')
  @RequirePermissions('advertising-costs')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('advertising-costs')
  update(@Param('id') id: string, @Body() dto: UpdateAdvertisingCostDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('advertising-costs')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
