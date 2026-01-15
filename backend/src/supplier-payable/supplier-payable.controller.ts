import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { SupplierPayableService } from './supplier-payable.service';
import { CreateSupplierPayableDto } from './dto/create-supplier-payable.dto';
import { AddPaymentDto } from './dto/add-payment.dto';

@Controller('supplier-payables')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierPayableController {
  constructor(private readonly service: SupplierPayableService) {}

  @Post()
  @RequirePermissions('purchase-costs')
  @HttpCode(HttpStatus.CREATED)
  create(@Body(new ValidationPipe({ whitelist: true, transform: true })) dto: CreateSupplierPayableDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions('purchase-costs')
  list(
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({ supplierId, status, from, to, page: Number(page || 1), limit: Number(limit || 50) });
  }

  @Get(':id')
  @RequirePermissions('purchase-costs')
  get(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('purchase-costs')
  update(@Param('id') id: string, @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: Partial<CreateSupplierPayableDto>) {
    return this.service.update(id, dto);
  }

  @Post(':id/payments')
  @RequirePermissions('purchase-costs')
  addPayment(@Param('id') id: string, @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: AddPaymentDto) {
    return this.service.addPayment(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('purchase-costs')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
