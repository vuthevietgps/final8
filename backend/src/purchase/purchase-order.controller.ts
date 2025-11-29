import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { PurchaseOrderService } from './purchase-order.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ReceivePurchaseDto } from './dto/receive-purchase.dto';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchaseOrderController {
  constructor(private readonly service: PurchaseOrderService) {}

  @Post()
  @RequirePermissions('purchase-costs')
  @HttpCode(HttpStatus.CREATED)
  create(@Body(new ValidationPipe({ whitelist: true, transform: true })) dto: CreatePurchaseOrderDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions('purchase-costs')
  findAll(
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({ supplierId, status, page: Number(page || 1), limit: Number(limit || 20) });
  }

  @Get(':id')
  @RequirePermissions('purchase-costs')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('purchase-costs')
  update(@Param('id') id: string, @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: UpdatePurchaseOrderDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('purchase-costs')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/receive')
  @RequirePermissions('purchase-costs')
  receive(@Param('id') id: string, @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: ReceivePurchaseDto) {
    return this.service.receive(id, dto);
  }
}
