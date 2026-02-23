/**
 * Controller: OrderSheetSyncController
 * Chức năng: API endpoints để đồng bộ đơn hàng lên Google Sheets
 */
import { Controller, Post, Param, Get, UseGuards, Body } from '@nestjs/common';
import { OrderSheetSyncService } from './order-sheet-sync.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('order-sheet-sync')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderSheetSyncController {
  constructor(private readonly service: OrderSheetSyncService) {}

  /**
   * POST /order-sheet-sync/agent/:agentId
   * Đồng bộ đơn hàng của 1 đại lý lên Google Sheet
   */
  @Post('agent/:agentId')
  @RequirePermissions('orders')
  syncAgentOrders(@Param('agentId') agentId: string) {
    return this.service.syncAgentOrders(agentId);
  }

  /**
   * POST /order-sheet-sync/supplier/:supplierId
   * Đồng bộ đơn hàng của 1 nhà cung cấp lên Google Sheet
   */
  @Post('supplier/:supplierId')
  @RequirePermissions('orders')
  syncSupplierOrders(@Param('supplierId') supplierId: string) {
    return this.service.syncSupplierOrders(supplierId);
  }

  /**
   * POST /order-sheet-sync/agents/all
   * Đồng bộ đơn hàng của tất cả đại lý
   */
  @Post('agents/all')
  @RequirePermissions('orders')
  syncAllAgents() {
    return this.service.syncAllAgents();
  }

  /**
   * POST /order-sheet-sync/suppliers/all
   * Đồng bộ đơn hàng của tất cả nhà cung cấp
   */
  @Post('suppliers/all')
  @RequirePermissions('orders')
  syncAllSuppliers() {
    return this.service.syncAllSuppliers();
  }

  /**
   * GET /order-sheet-sync/status
   * Kiểm tra trạng thái Google Sync
   */
  @Get('status')
  @RequirePermissions('orders')
  getStatus() {
    return this.service.getFullStatus();
  }

  /**
   * POST /order-sheet-sync/credentials
   * Lưu Google Service Account credentials (JSON)
   */
  @Post('credentials')
  @RequirePermissions('orders')
  saveCredentials(@Body() body: { credentialsJson: string }) {
    return this.service.saveCredentials(body.credentialsJson);
  }

  /**
   * POST /order-sheet-sync/test-credentials
   * Test credentials có hoạt động không
   */
  @Post('test-credentials')
  @RequirePermissions('orders')
  testCredentials(@Body() body: { credentialsJson: string }) {
    return this.service.testCredentials(body.credentialsJson);
  }

  /**
   * GET /order-sheet-sync/agents-suppliers
   * Lấy danh sách đại lý và NCC có Google Sheet
   */
  @Get('agents-suppliers')
  @RequirePermissions('orders')
  getAgentsAndSuppliers() {
    return this.service.getAgentsAndSuppliersWithSheet();
  }
}
