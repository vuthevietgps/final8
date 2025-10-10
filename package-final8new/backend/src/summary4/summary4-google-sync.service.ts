/**
 * Summary4 Google Sync Service
 * Đồng bộ dữ liệu Summary4 lên Google Sheets theo từng đại lý
 * Thay thế cho Summary1 sync với dữ liệu đầy đủ hơn
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Summary4, Summary4Document } from './schemas/summary4.schema';
import { User, UserDocument } from '../user/user.schema';
import { GoogleSyncService } from '../google-sync/google-sync.service';
import { google } from 'googleapis';

@Injectable()
export class Summary4GoogleSyncService {
  private readonly logger = new Logger(Summary4GoogleSyncService.name);
  // Debounce map để tránh sync quá nhiều lần
  private readonly pendingByAgent = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectModel(Summary4.name) private readonly summary4Model: Model<Summary4Document>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly googleSyncService: GoogleSyncService,
  ) {}

  /**
   * Schedule sync với debounce (delay 2 giây để gộp các thay đổi liên tiếp)
   */
  scheduleSyncAgent(agentId: string, delayMs: number = 2000): void {
    // Check if Google Sync is disabled
    if (process.env.GOOGLE_SYNC_DISABLED === 'true') {
      this.logger.log(`Google Sync is disabled, skipping schedule for agent ${agentId}`);
      return;
    }

    // Clear existing timeout
    if (this.pendingByAgent.has(agentId)) {
      clearTimeout(this.pendingByAgent.get(agentId)!);
    }

    // Set new timeout
    const timeoutId = setTimeout(async () => {
      try {
        await this.syncAgentSummary4(agentId);
        this.pendingByAgent.delete(agentId);
      } catch (error) {
        this.logger.error(`Summary4 sync failed for agent ${agentId}:`, error);
        this.pendingByAgent.delete(agentId);
      }
    }, delayMs);

    this.pendingByAgent.set(agentId, timeoutId);
    this.logger.log(`Scheduled Summary4 sync for agent ${agentId} in ${delayMs}ms`);
  }

  /**
   * Đồng bộ Summary4 của một agent lên Google Sheet
   */
  async syncAgentSummary4(agentId: string): Promise<void> {
    // Check if Google Sync is disabled
    if (process.env.GOOGLE_SYNC_DISABLED === 'true') {
      this.logger.log(`Google Sync is disabled, skipping sync for agent ${agentId}`);
      return;
    }

    this.logger.log(`Starting Summary4 sync for agent ${agentId}...`);
    
    const data = await this.buildSummary4ForAgent(agentId);
    await this.writeSummary4ToGoogleSheet(agentId, data);
    
    this.logger.log(`Summary4 sync completed for agent ${agentId}, rows: ${data.length}`);
  }

  /**
   * Build dữ liệu Summary4 thành format Google Sheet
   */
  async buildSummary4ForAgent(agentId: string): Promise<any[]> {
    const agentObjectId = new Types.ObjectId(agentId);
    
    const summary4Records = await this.summary4Model
      .find({ agentId: agentObjectId, isActive: true })
      .populate('productId', 'name sku')
      .populate('agentId', 'fullName email')
      .sort({ orderDate: -1 })
      .lean();

    this.logger.log(`Found ${summary4Records.length} Summary4 records for agent ${agentId}`);

    const rows = summary4Records.map((record: any) => ({
      orderDate: record.orderDate,
      customerName: record.customerName || '',
      product: record.product || record.productId?.name || '',
      quantity: record.quantity || 0,
      agentName: record.agentName || record.agentId?.fullName || '',
      adGroupId: record.adGroupId || '0',
      productionStatus: record.productionStatus || '',
      orderStatus: record.orderStatus || '',
      trackingNumber: record.trackingNumber || '',
      submitLink: record.submitLink || '',
      depositAmount: record.depositAmount || 0,
      codAmount: record.codAmount || 0,
      approvedQuotePrice: record.approvedQuotePrice || 0,
      mustPayToCompany: record.mustPayToCompany || 0,
      paidToCompany: record.paidToCompany || 0,
      manualPayment: record.manualPayment || 0,
      needToPay: record.needToPay || 0,
      // Additional fields for tracking
      testOrder2Id: record.testOrder2Id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));

    return rows;
  }

  /**
   * Ghi dữ liệu Summary4 lên Google Sheet
   */
  async writeSummary4ToGoogleSheet(agentId: string, data: any[]): Promise<void> {
    // Get user info
    const user = await this.userModel.findById(agentId).lean();
    if (!user) {
      this.logger.warn(`User not found: ${agentId}`);
      return;
    }

    const googleDriveLink = (user as any).googleDriveLink;
    if (!googleDriveLink) {
      this.logger.warn(`User ${agentId} doesn't have Google Drive link`);
      return;
    }

    try {
      // Extract spreadsheet ID
      const spreadsheetId = this.extractSpreadsheetId(googleDriveLink);
      if (!spreadsheetId) {
        this.logger.warn(`Cannot extract spreadsheetId from link: ${googleDriveLink}`);
        return;
      }

      // Get Google Auth (reuse from GoogleSyncService)
      const auth = await this.getGoogleAuth();
      if (!auth) {
        this.logger.warn('Missing Google credentials for authentication');
        return;
      }

      const sheets = google.sheets({ version: 'v4', auth });
      const sheetName = 'Summary4';
      
      // Ensure sheet exists
      await this.ensureSheetExists(sheets, spreadsheetId, sheetName);

      // Prepare data for Google Sheets
      const header = [
        'Ngày đặt hàng', 'Tên khách hàng', 'Sản phẩm', 'Số lượng', 'Đại lý',
        'Ad Group ID', 'Trạng thái sản xuất', 'Trạng thái đơn hàng', 'Mã vận đơn',
        'Link nộp', 'Tiền cọc', 'Tiền COD', 'Giá báo giá', 'Phải trả công ty',
        'Đã trả công ty', 'Thanh toán thủ công', 'Cần thanh toán'
      ];

      const values = data.map(record => [
        this.formatDate(record.orderDate),
        record.customerName,
        record.product,
        record.quantity,
        record.agentName,
        record.adGroupId,
        record.productionStatus,
        record.orderStatus,
        record.trackingNumber,
        record.submitLink,
        record.depositAmount,
        record.codAmount,
        record.approvedQuotePrice,
        record.mustPayToCompany,
        record.paidToCompany,
        record.manualPayment,
        record.needToPay,
      ]);

      // Clear existing data (keep header)
      const clearRange = `${sheetName}!A2:Z`;
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: clearRange,
      });

      // Write header if no data exists
      if (data.length > 0) {
        // Write header
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'RAW',
          requestBody: { values: [header] },
        });

        // Write data
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${sheetName}!A2`,
          valueInputOption: 'RAW',
          requestBody: { values },
        });
      }

      this.logger.log(`Successfully wrote ${values.length} rows to Google Sheet ${sheetName}: ${spreadsheetId}`);
      
    } catch (error) {
      const errorDetail = (error as any)?.response?.data?.error || (error as any)?.message || error;
      this.logger.error(`Error writing Summary4 to Google Sheet:`, errorDetail);
      throw error;
    }
  }

  /**
   * Format date to DD/MM/YYYY
   */
  private formatDate(date: any): string {
    try {
      const d = date instanceof Date ? date : (date ? new Date(date) : null);
      if (!d || isNaN(d.getTime())) return '';
      
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch {
      return '';
    }
  }

  /**
   * Extract spreadsheet ID from Google Drive/Sheets URL (delegate to GoogleSyncService)
   */
  private extractSpreadsheetId(url: string): string | null {
    return this.googleSyncService.extractSpreadsheetId(url);
  }

  /**
   * Get Google Auth (delegate to GoogleSyncService)
   */
  private async getGoogleAuth(): Promise<any> {
    return this.googleSyncService.getGoogleAuth();
  }

  /**
   * Ensure sheet exists (delegate to GoogleSyncService)
   */
  private async ensureSheetExists(sheets: any, spreadsheetId: string, sheetName: string): Promise<void> {
    return this.googleSyncService.ensureSheetExists(sheets, spreadsheetId, sheetName);
  }

  /**
   * Sync all agents that have Google Drive links
   */
  async syncAllAgents(): Promise<{ total: number; success: number; failed: number; errors: string[] }> {
    // Check if Google Sync is disabled
    if (process.env.GOOGLE_SYNC_DISABLED === 'true') {
      this.logger.log('Google Sync is disabled, skipping sync all agents');
      return {
        total: 0,
        success: 0,
        failed: 0,
        errors: ['Google Sync is disabled via GOOGLE_SYNC_DISABLED environment variable'],
      };
    }

    const users = await this.userModel
      .find({ 
        googleDriveLink: { 
          $exists: true, 
          $nin: [null, ''] 
        } 
      })
      .lean();

    const result = {
      total: users.length,
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const user of users) {
      try {
        await this.syncAgentSummary4(user._id.toString());
        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Agent ${user._id}: ${(error as any)?.message || error}`);
        this.logger.error(`Failed to sync agent ${user._id}:`, error);
      }
    }

    this.logger.log(`Summary4 sync all completed: ${result.success}/${result.total} successful`);
    return result;
  }


}