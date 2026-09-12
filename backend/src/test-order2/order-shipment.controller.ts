import { Body, Controller, Param, Patch, Post, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrderShipmentService } from './services/order-shipment.service';
import { CreateOrderShipmentDto, CompleteOrderShipmentDto, AmendShipmentFeesDto } from './dto/order-shipment.dto';
import { FeatureModule } from '../plan/feature-module.decorator';

@Controller('test-order2/:orderId/shipments')
@FeatureModule('test-order2')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('orders-test2', 'finance.cashflow.manage')
export class OrderShipmentController {
  constructor(private service: OrderShipmentService) {}
  @Post(':shipmentId/resume')
  resume(@Param('orderId') id: string, @Param('shipmentId') shipmentId: string) { return this.service.resume(id, shipmentId); }
  @Patch(':shipmentId/fees')
  fees(@Param('orderId') id: string, @Param('shipmentId') shipmentId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: AmendShipmentFeesDto, @CurrentUser() user: any) {
    return this.service.amendFees(id, shipmentId, dto, String(user.id || user._id));
  }
  @Post()
  create(@Param('orderId') id: string, @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: CreateOrderShipmentDto,
    @CurrentUser() user: any) { return this.service.create(id, dto, String(user.id || user._id)); }
  @Patch(':shipmentId')
  complete(@Param('orderId') id: string, @Param('shipmentId') shipmentId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: CompleteOrderShipmentDto) {
    return this.service.complete(id, shipmentId, dto);
  }
}
