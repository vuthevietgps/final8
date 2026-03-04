/**
 * File: delivery-status.controller.ts
 * Mục đích: REST API cho trạng thái giao hàng.
 */
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete,
  HttpCode,
  HttpStatus,
  ForbiddenException
} from '@nestjs/common';
import { DeliveryStatusService } from './delivery-status.service';
import { CreateDeliveryStatusDto } from './dto/create-delivery-status.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { FeatureModule } from '../plan/feature-module.decorator';

@FeatureModule('delivery-status')
@Controller('delivery-status')
export class DeliveryStatusController {
  constructor(private readonly deliveryStatusService: DeliveryStatusService) {}

  @Post()
  create(@Body() createDeliveryStatusDto: CreateDeliveryStatusDto) {
    return this.deliveryStatusService.create(createDeliveryStatusDto);
  }

  @Get()
  findAll() {
    return this.deliveryStatusService.findAll();
  }

  @Get('active')
  getActiveStatuses() {
    return this.deliveryStatusService.getActiveStatuses();
  }

  @Get('final')
  getFinalStatuses() {
    return this.deliveryStatusService.getFinalStatuses();
  }

  @Get('payment-trigger')
  getPaymentTriggerStatuses() {
    return this.deliveryStatusService.getPaymentTriggerStatuses();
  }

  @Get('payment-trigger/names')
  getPaymentTriggerStatusNames() {
    return this.deliveryStatusService.getPaymentTriggerStatusNames();
  }

  @Get('return')
  getReturnStatuses() {
    return this.deliveryStatusService.getReturnStatuses();
  }

  @Get('return/names')
  getReturnStatusNames() {
    return this.deliveryStatusService.getReturnStatusNames();
  }

  @Get('stats/summary')
  getStatsSummary() {
    return this.deliveryStatusService.getStatsSummary();
  }

  @Post('seed')
  @HttpCode(HttpStatus.CREATED)
  seedSampleData() {
    if (String(process.env.ALLOW_DANGEROUS_SEED || '').toLowerCase() !== 'true') {
      throw new ForbiddenException('Seed endpoint is disabled. Set ALLOW_DANGEROUS_SEED=true to enable.');
    }
    return this.deliveryStatusService.seedSampleData();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deliveryStatusService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDeliveryStatusDto: UpdateDeliveryStatusDto) {
    return this.deliveryStatusService.update(id, updateDeliveryStatusDto);
  }

  @Patch(':id/order')
  updateOrder(@Param('id') id: string, @Body('order') order: number) {
    return this.deliveryStatusService.updateOrder(id, order);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.deliveryStatusService.remove(id);
  }
}
