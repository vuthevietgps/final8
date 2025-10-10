import { Controller, Get, Post, Patch, Delete, Param, Body, Query, ValidationPipe, ForbiddenException, Res, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Summary4Service } from './summary4.service';
import { Summary4GoogleSyncService } from './summary4-google-sync.service';
import { Summary4FilterDto } from './dto/summary4-filter.dto';
import { UpdateManualPaymentDto } from './dto/update-manual-payment.dto';

@Controller('summary4')
export class Summary4Controller {
  constructor(
    private readonly summary4Service: Summary4Service,
    private readonly summary4GoogleSyncService: Summary4GoogleSyncService,
  ) {}

  @Get()
  findAll(@Query(new ValidationPipe({ transform: true, whitelist: true })) filter: Summary4FilterDto) {
    return this.summary4Service.findAll(filter);
  }

  @Get('stats')
  getStats() {
    return this.summary4Service.getStats();
  }

  @Get('agents')
  getAgents() {
    return this.summary4Service.getAgents();
  }

  // Agents endpoint removed with filter/search cleanup

  @Get('export-unpaid')
  async exportUnpaidToExcel(@Query() filter: Summary4FilterDto, @Res() res: Response) {
    try {
      const excelBuffer = await this.summary4Service.exportUnpaidToExcel(filter);
      
      // Tạo tên file với timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `summary4-chua-thanh-toan-${timestamp}.xlsx`;
      
      // Set headers cho file Excel
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);
      
      // Gửi file
      res.send(excelBuffer);
    } catch (error) {
      res.status(500).json({ 
        message: 'Lỗi khi xuất file Excel', 
        error: error.message 
      });
    }
  }

  @Get('export-manual-payment-template')
  async exportManualPaymentTemplate(@Query() filter: Summary4FilterDto, @Res() res: Response) {
    try {
      const excelBuffer = await this.summary4Service.exportManualPaymentTemplate(filter);
      
      // Tạo tên file với timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `summary4-manual-payment-template-${timestamp}.xlsx`;
      
      // Set headers cho file Excel
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);
      
      // Gửi file
      res.send(excelBuffer);
    } catch (error) {
      res.status(500).json({ 
        message: 'Lỗi khi xuất template thanh toán tay', 
        error: error.message 
      });
    }
  }

  @Post('import-manual-payment')
  @UseInterceptors(FileInterceptor('file'))
  async importManualPayment(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Không tìm thấy file upload');
    }

    if (!file.originalname.match(/\.(xlsx|xls)$/)) {
      throw new BadRequestException('File phải có định dạng Excel (.xlsx hoặc .xls)');
    }

    return this.summary4Service.importManualPaymentFromExcel(file.buffer);
  }

  @Post('sync')
  syncFromTestOrder2() {
    return this.summary4Service.syncFromTestOrder2();
  }

  @Post('sync-single/:orderId')
  syncSingleOrder(@Param('orderId') orderId: string) {
    return this.summary4Service.syncSingleOrder(orderId);
  }

  @Post('sync-google/:agentId')
  async syncToGoogle(@Param('agentId') agentId: string) {
    try {
      await this.summary4GoogleSyncService.syncAgentSummary4(agentId);
      return { 
        success: true, 
        message: 'Summary4 đã được đồng bộ lên Google Sheet', 
        agentId 
      };
    } catch (error) {
      return { 
        success: false, 
        message: 'Lỗi khi đồng bộ lên Google Sheet', 
        error: (error as any)?.message || error,
        agentId 
      };
    }
  }

  @Post('sync-google-all')
  async syncAllToGoogle() {
    try {
      const result = await this.summary4GoogleSyncService.syncAllAgents();
      return {
        success: true,
        message: 'Đồng bộ tất cả đại lý hoàn thành',
        ...result
      };
    } catch (error) {
      return {
        success: false,
        message: 'Lỗi khi đồng bộ tất cả đại lý',
        error: (error as any)?.message || error
      };
    }
  }

  // Maintenance: chẩn đoán trùng lặp
  @Get('diagnostics')
  diagnostics() {
    if (process.env.ENABLE_SUMMARY4_MAINTENANCE !== 'true') {
      throw new ForbiddenException('Summary4 maintenance endpoints are disabled. Set ENABLE_SUMMARY4_MAINTENANCE=true to enable.');
    }
    return this.summary4Service.diagnostics();
  }

  // Maintenance: xoá trùng lặp
  @Post('fix-duplicates')
  fixDuplicates() {
    if (process.env.ENABLE_SUMMARY4_MAINTENANCE !== 'true') {
      throw new ForbiddenException('Summary4 maintenance endpoints are disabled. Set ENABLE_SUMMARY4_MAINTENANCE=true to enable.');
    }
    return this.summary4Service.fixDuplicates();
  }

  @Post('cleanup-orphaned')
  cleanupOrphanedRecords(@Body() options?: { dryRun?: boolean; preserveManualPayment?: boolean }) {
    if (process.env.ENABLE_SUMMARY4_MAINTENANCE !== 'true') {
      throw new ForbiddenException('Summary4 maintenance endpoints are disabled. Set ENABLE_SUMMARY4_MAINTENANCE=true to enable.');
    }
    return this.summary4Service.cleanupOrphanedRecords(options);
  }

  @Post('emergency-cleanup')
  emergencyCleanupOrphanedRecords(@Body() options?: { dryRun?: boolean; preserveManualPayment?: boolean }) {
    // Temporary endpoint for emergency cleanup without maintenance check
    return this.summary4Service.cleanupOrphanedRecords(options);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.summary4Service.findOne(id);
  }

  @Patch(':id/manual-payment')
  async updateManualPayment(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true })) updateDto: UpdateManualPaymentDto,
  ) {
    const updatedSummary = await this.summary4Service.updateManualPayment(id, updateDto);
    
    // Trigger Google Sync for the agent
    try {
      const agentId = updatedSummary.agentId.toString();
      this.summary4GoogleSyncService.scheduleSyncAgent(agentId, 2000);
    } catch (error) {
      // Log error but don't fail the main operation
      console.warn('Failed to schedule Google sync after manual payment update:', error);
    }
    
    return updatedSummary;
  }

  @Delete('clear-all')
  clearAll() {
    return this.summary4Service.clearAll();
  }
}