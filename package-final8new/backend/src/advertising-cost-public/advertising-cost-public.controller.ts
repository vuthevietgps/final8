/**
 * File: advertising-cost-public/advertising-cost-public.controller.ts
 * Mục đích: Public API endpoints cho advertising cost (không cần authentication)
 */
import { Controller, Get } from '@nestjs/common';
import { AdvertisingCostService } from '../advertising-cost/advertising-cost.service';

@Controller('advertising-cost-public')
export class AdvertisingCostPublicController {
  constructor(private readonly advertisingCostService: AdvertisingCostService) {}

  @Get('yesterday-spent')
  async getYesterdaySpent() {
    const spentMap = await this.advertisingCostService.getYesterdaySpentByAdGroups();
    return {
      statusCode: 200,
      message: 'Lấy chi phí ngày hôm qua thành công',
      data: spentMap
    };
  }
}