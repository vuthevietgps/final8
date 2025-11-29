import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, Res } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { TestOrder2Service } from './test-order2.service';
import { CreateTestOrder2Dto } from './dto/create-test-order2.dto';
import { UpdateTestOrder2Dto } from './dto/update-test-order2.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { TestOrder2ExportService } from './test-order2-export.service';
import { TestOrder2ExportJsonService } from './test-order2-export-json.service';
import { TestOrder2ImportService } from './test-order2-import.service';
import { Response } from 'express';

@Controller('test-order2')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TestOrder2Controller {
  constructor(
    private readonly service: TestOrder2Service,
    private readonly exportService: TestOrder2ExportService,
    private readonly exportJsonService: TestOrder2ExportJsonService,
    private readonly importService: TestOrder2ImportService,
  ) {}

  @Get()
  async findAll(
    @Query('q') q?: string,
    @Query('productId') productId?: string,
    @Query('agentId') agentId?: string,
    @Query('adGroupId') adGroupId?: string,
    @Query('isActive') isActive?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('productionStatus') productionStatus?: string,
    @Query('orderStatus') orderStatus?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.service.findAll({
      q,
      productId,
      agentId,
      adGroupId,
      isActive,
      from,
      to,
      productionStatus,
      orderStatus,
      page,
      limit,
      sortBy,
      sortOrder,
    });
  }

  @Post()
  async create(@Body() dto: CreateTestOrder2Dto) {
    // Hỗ trợ tạo mới (đã có service.create)
    return this.service.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateTestOrder2Dto) {
    return this.service.update(id, dto as any);
  }

  // Patch only delivery/order status (to mirror docker v10.0 DTO)
  @Patch(':id/delivery-status')
  async updateDeliveryStatus(@Param('id') id: string, @Body() dto: UpdateDeliveryStatusDto) {
    return this.service.update(id, dto as any);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('seed')
  async seed(@Query('count') count?: string) {
    const c = Math.max(1, Math.min(100, Number(count) || 10));
    return this.service.seed(c);
  }

  // Export JSON
  @Get('export/json')
  async exportJson() {
    const { items, count } = await this.exportJsonService.exportJson();
    return { items, count };
  }

  // Export CSV (response as text/csv)
  @Get('export/csv')
  async exportCsv(@Res() res: Response) {
    const { csv, count } = await this.exportService.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="test-order2-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  }

  // Import JSON
  @Post('import')
  async importJson(@Body() body: { items: any[] }) {
    return this.importService.importJson(body);
  }
}
