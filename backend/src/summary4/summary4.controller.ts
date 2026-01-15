import { Body, Controller, Get, Patch, Post, Query, UseGuards, Param } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Summary4Service } from './summary4.service';
import { Summary4SyncService } from './summary4-sync.service';
import { Summary4GoogleSyncService } from './summary4-google-sync.service';
import { GoogleSyncService } from '../google-sync/google-sync.service';

@Controller('summary4')
export class Summary4Controller {
  constructor(
    private readonly summary4Service: Summary4Service,
    private readonly summary4SyncService: Summary4SyncService,
    private readonly summary4GoogleSyncService: Summary4GoogleSyncService,
    private readonly googleSyncService: GoogleSyncService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('agentId') agentId?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.summary4Service.findAll({
      page: Number(page),
      limit: Number(limit),
      agentId,
      paymentStatus,
      from,
      to,
    });
  }

  @Get('stats')
  async stats() {
    return this.summary4Service.getStats();
  }

  @Get('agents')
  async agents() {
    return this.summary4Service.getAgents();
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async syncFromTestOrder2() {
    // Real sync implementation from TestOrder2 to Summary4
    return this.summary4SyncService.syncFromTestOrder2();
  }



  @Post('google-sync/agent/:agentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async syncAgentToGoogleSheets(@Param('agentId') agentId: string) {
    try {
      await this.summary4GoogleSyncService.syncAgentSummary4(agentId);
      return {
        success: true,
        message: `Summary4 data synced to Google Sheets for agent: ${agentId}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to sync Summary4 to Google Sheets'
      };
    }
  }

  @Post('google-sync/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async syncAllAgentsToGoogleSheets() {
    try {
      const result = await this.summary4GoogleSyncService.syncAllAgents();
      return {
        success: true,
        result,
        message: 'Summary4 sync completed for all agents'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to sync Summary4 for all agents'
      };
    }
  }

  // Removed temporary unguarded debug endpoint for security hardening

  @Get('google-auth/test')
  async testGoogleAuth() {
    try {
      const authInfo = await this.googleSyncService.authDebugInfo();
      return {
        success: true,
        authInfo,
        message: 'Google Auth test completed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Google Auth test failed'
      };
    }
  }

  @Patch(':id/manual-payment')
  async updateManualPayment(
    @Param('id') id: string,
    @Body('manualPayment') manualPayment: number,
  ) {
    const updatedRecord: any = await this.summary4Service.updateManualPayment(id, manualPayment);

    // Schedule a lightweight Google Sheet sync for the owning agent
    try {
      const agentId = typeof updatedRecord.agentId === 'string'
        ? updatedRecord.agentId
        : updatedRecord.agentId?._id?.toString?.();
      if (agentId) {
        this.summary4GoogleSyncService.scheduleSyncAgent(agentId, 2500);
      }
    } catch {}

    return { message: 'Manual payment updated successfully', updatedRecord };
  }

  @Patch(':id/collection')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateCollection(
    @Param('id') id: string,
    @Body('status') status?: string,
    @Body('collectedAmount') collectedAmount?: number,
    @Body('receivableAmount') receivableAmount?: number,
  ) {
    const updatedRecord: any = await this.summary4Service.updateCollection(id, {
      status,
      collectedAmount,
      receivableAmount,
    });
    return { message: 'Collection updated successfully', updatedRecord };
  }
}
