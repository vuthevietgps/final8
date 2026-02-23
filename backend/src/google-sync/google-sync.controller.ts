/**
 * Google Sync Controller - DEPRECATED
 * REPLACED BY: Summary4GoogleSyncService
 * 
 * This controller was used for Summary1 sync functionality
 * which has been replaced by Summary4 Google Sync.
 * 
 * Keeping file for reference only.
 */
import { Controller, Get } from '@nestjs/common';
import { GoogleSyncService } from './google-sync.service';

@Controller('google-sync')
export class GoogleSyncController {
  constructor(private readonly svc: GoogleSyncService) {}

  /** Debug: xem trạng thái credentials */
  @Get('cred-check')
  credCheck() {
    return { 
      status: 'DEPRECATED', 
      message: 'GoogleSync functionality replaced by Summary4GoogleSyncService',
      replacement: {
        syncAgent: 'POST /summary4/sync-google/:agentId',
        syncAll: 'POST /summary4/sync-google-all'
      }
    };
  }

  /** Auth debug: quickly check if credentials can be loaded */
  @Get('auth-debug')
  async authDebug() {
    return this.svc.authDebugInfo();
  }
}