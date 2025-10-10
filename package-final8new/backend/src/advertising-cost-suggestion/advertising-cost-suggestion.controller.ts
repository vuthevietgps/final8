/**
 * File: advertising-cost-suggestion.controller.ts
 * Mục đích: REST API controller cho quản lý đề xuất chi phí quảng cáo
 * Endpoints: CRUD operations và thống kê
 */
import { Controller, Get, Post, Body, Patch, Param, Delete, HttpStatus } from '@nestjs/common';
import { AdvertisingCostSuggestionService } from './advertising-cost-suggestion.service';
import { CreateAdvertisingCostSuggestionDto } from './dto/create-advertising-cost-suggestion.dto';
import { UpdateAdvertisingCostSuggestionDto } from './dto/update-advertising-cost-suggestion.dto';

@Controller('advertising-cost-suggestion')
export class AdvertisingCostSuggestionController {
  constructor(private readonly suggestionService: AdvertisingCostSuggestionService) {}

  @Post()
  async create(@Body() createDto: CreateAdvertisingCostSuggestionDto) {
    const suggestion = await this.suggestionService.create(createDto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Tạo đề xuất chi phí thành công',
      data: suggestion
    };
  }

  @Get()
  async findAll() {
    const suggestions = await this.suggestionService.findAll();
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy danh sách đề xuất chi phí thành công',
      data: suggestions
    };
  }

  @Get('statistics')
  async getStatistics() {
    const stats = await this.suggestionService.getStatistics();
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy thống kê thành công',
      data: stats
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const suggestion = await this.suggestionService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy thông tin đề xuất chi phí thành công',
      data: suggestion
    };
  }

  @Get('ad-group/:adGroupId')
  async findByAdGroupId(@Param('adGroupId') adGroupId: string) {
    const suggestion = await this.suggestionService.findByAdGroupId(adGroupId);
    return {
      statusCode: HttpStatus.OK,
      message: suggestion ? 'Tìm thấy đề xuất chi phí' : 'Không tìm thấy đề xuất chi phí',
      data: suggestion
    };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateAdvertisingCostSuggestionDto) {
    const suggestion = await this.suggestionService.update(id, updateDto);
    return {
      statusCode: HttpStatus.OK,
      message: 'Cập nhật đề xuất chi phí thành công',
      data: suggestion
    };
  }

  @Patch('daily-cost/:adGroupId')
  async updateDailyCost(@Param('adGroupId') adGroupId: string, @Body('dailyCost') dailyCost: number) {
    const suggestion = await this.suggestionService.updateDailyCost(adGroupId, dailyCost);
    return {
      statusCode: HttpStatus.OK,
      message: suggestion ? 'Cập nhật chi phí hàng ngày thành công' : 'Không tìm thấy đề xuất chi phí',
      data: suggestion
    };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.suggestionService.remove(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Xóa đề xuất chi phí thành công'
    };
  }
}