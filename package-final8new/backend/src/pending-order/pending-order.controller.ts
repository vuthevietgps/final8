import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, Req } from '@nestjs/common';
import { PendingOrderService } from './pending-order.service';
import { CreatePendingOrderDto } from './dto/create-pending-order.dto';
import { UpdatePendingOrderDto } from './dto/update-pending-order.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('pending-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PendingOrderController {
  constructor(private service: PendingOrderService) {}

  @Post() @RequirePermissions('pending-orders') create(@Body() dto: CreatePendingOrderDto) { return this.service.create(dto); }
  @Get() @RequirePermissions('pending-orders') findAll(@Query() q?: any) { return this.service.findAll(q||{}); }
  @Get('agents') @RequirePermissions('pending-orders') agents() { return this.service.getAgents(); }
  @Get(':id') @RequirePermissions('pending-orders') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Patch(':id') @RequirePermissions('pending-orders') update(@Param('id') id: string, @Body() dto: UpdatePendingOrderDto) { return this.service.update(id, dto); }
  @Delete(':id') @RequirePermissions('pending-orders') remove(@Param('id') id: string) { return this.service.remove(id); }
  @Post(':id/approve') @RequirePermissions('pending-orders') approve(@Param('id') id: string, @Req() req: any){ const userId = req.user?.id || req.user?._id; return this.service.approve(id, userId); }
}
