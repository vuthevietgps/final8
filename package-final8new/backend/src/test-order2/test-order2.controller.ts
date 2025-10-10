/**
 * File: test-order2/test-order2.controller.ts
 * REST Controller cho Đơn Hàng Thử Nghiệm 2
 */
import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateTestOrder2Dto } from './dto/create-test-order2.dto';
import { UpdateTestOrder2Dto } from './dto/update-test-order2.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { TestOrder2Service } from './test-order2.service';

@Controller('test-order2')
export class TestOrder2Controller {
  constructor(private readonly service: TestOrder2Service) { }

  @Post()
  create(@Body() dto: CreateTestOrder2Dto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
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
    @Query('sortOrder') sortOrder?: string,
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    return this.service.findAll({ 
      q, productId, agentId, adGroupId, isActive, from, to,
      productionStatus, orderStatus,
      page: pageNum, limit: limitNum, sortBy, sortOrder 
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTestOrder2Dto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importFromFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Không có file được tải lên');
    }

    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Chỉ hỗ trợ file CSV và Excel (.xls, .xlsx)');
    }

    return this.service.importFromFile(file);
  }

  @Get('export/template')
  async exportTemplate() {
    return this.service.exportTemplate();
  }

  @Get('export/delivery-template')
  async exportDeliveryTemplate() {
    return this.service.exportDeliveryTemplate();
  }

  @Get('export/pending-delivery')
  async exportPendingDelivery() {
    return this.service.exportPendingDelivery();
  }

  @Post('import/delivery-status')
  @UseInterceptors(FileInterceptor('file'))
  async importDeliveryStatus(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Không có file được tải lên');
    }

    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Chỉ hỗ trợ file CSV và Excel (.xls, .xlsx)');
    }

    return this.service.importDeliveryStatus(file);
  }
}
