import { Body, Controller, Get, Param, Post, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get('summary')
  @RequirePermissions('purchase-costs')
  summary(@Query('page') page?: string, @Query('limit') limit?: string, @Query('q') q?: string) {
    return this.service.listSummary({ page: Number(page || 1), limit: Number(limit || 20), q });
  }

  @Get(':productId/transactions')
  @RequirePermissions('purchase-costs')
  tx(@Param('productId') productId: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.listTransactions(productId, { page: Number(page || 1), limit: Number(limit || 20) });
  }

  @Post('adjust')
  @RequirePermissions('purchase-costs')
  adjust(@Body(new ValidationPipe({ whitelist: true, transform: true })) body: { productId: string; quantity: number; unitCost?: number; notes?: string }) {
    return this.service.adjustStock(body.productId, Number(body.quantity), body.unitCost !== undefined ? Number(body.unitCost) : undefined, body.notes);
  }

  @Post('issue')
  @RequirePermissions('purchase-costs')
  issue(@Body(new ValidationPipe({ whitelist: true, transform: true })) body: { productId: string; quantity: number; notes?: string }) {
    return this.service.issueStock(body.productId, Number(body.quantity), body.notes);
  }
}
