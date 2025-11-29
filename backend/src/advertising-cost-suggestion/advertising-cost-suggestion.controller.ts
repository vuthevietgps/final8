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

  /**
   * 🔍 QUALITY CONTROL ENDPOINTS
   */
  @Get('quality-control/overview')
  async getQualityOverview() {
    const overview = await this.suggestionService.getSystemQualityOverview();
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy tổng quan chất lượng hệ thống thành công',
      data: overview
    };
  }

  @Get('quality-control/:adGroupId')
  async getAdGroupQualityReport(@Param('adGroupId') adGroupId: string) {
    const report = await this.suggestionService.getAdGroupQualityReport(adGroupId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Lấy báo cáo chất lượng nhóm quảng cáo thành công',
      data: report
    };
  }

  @Post('quality-control/validate')
  async triggerValidation() {
    await this.suggestionService.triggerValidation();
    return {
      statusCode: HttpStatus.OK,
      message: 'Kích hoạt validation thành công'
    };
  }

  @Post('ai-optimization/manual-trigger')
  async manualAIOptimization() {
    await this.suggestionService.triggerAIOptimization();
    return {
      statusCode: HttpStatus.OK,
      message: 'Kích hoạt AI optimization thủ công thành công'
    };
  }

  @Post('advanced-optimization/manual-trigger')
  async manualAdvancedOptimization(@Body() body: { adGroupId?: string }) {
    await this.suggestionService.triggerAdvancedOptimization(body.adGroupId);
    return {
      statusCode: HttpStatus.OK,
      message: 'Kích hoạt Advanced Mathematical Optimization thành công',
      data: {
        targetAdGroup: body.adGroupId || 'all',
        algorithmsUsed: ['Non-linear Regression', 'Random Forest', 'Bayesian Optimization', 'Ensemble Methods']
      }
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

  // 🤖 AI OPTIMIZATION ENDPOINTS

  @Post('ai/manual-trigger')
  async triggerAIOptimization() {
    await this.suggestionService.triggerAIOptimization();
    return {
      statusCode: HttpStatus.OK,
      message: 'AI optimization đã được kích hoạt thành công'
    };
  }

  @Post('auto-mode/:adGroupId')
  async toggleAutoMode(@Param('adGroupId') adGroupId: string, @Body('enabled') enabled: boolean) {
    // TODO: Implement auto mode toggle functionality
    return {
      statusCode: HttpStatus.OK,
      message: `Auto mode toggle not implemented yet for ad group ${adGroupId}`
    };
  }

  @Get('recommendations/pending')
  async getPendingRecommendations() {
    // TODO: Implement pending recommendations functionality
    return {
      statusCode: HttpStatus.OK,
      message: 'Pending recommendations not implemented yet',
      data: []
    };
  }

  @Post('recommendations/:id/approve')
  async approveRecommendation(@Param('id') id: string) {
    // TODO: Implement recommendation approval functionality
    return {
      statusCode: HttpStatus.OK,
      message: 'Recommendation approval not implemented yet',
      data: { success: false }
    };
  }
}