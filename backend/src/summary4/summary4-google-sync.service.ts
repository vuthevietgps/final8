import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Summary4, Summary4Document } from './schemas/summary4.schema';
import { User, UserDocument } from '../user/user.schema';
import { GoogleSyncService } from '../google-sync/google-sync.service';
import { google } from 'googleapis';

interface Summary4Row {
  orderDate: Date;
  customerName: string;
  product: string;
  quantity: number;
  agentName: string;
  adGroupId: string;
  productionStatus: string;
  orderStatus: string;
  trackingNumber: string;
  submitLink: string;
  depositAmount: number;
  codAmount: number;
  approvedQuotePrice: number;
  mustPayToCompany: number;
  paidToCompany: number;
  manualPayment: number;
  needToPay: number;
  testOrder2Id?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class Summary4GoogleSyncService {
  private readonly logger = new Logger(Summary4GoogleSyncService.name);
  private pendingByAgent = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectModel(Summary4.name) private summary4Model: Model<Summary4Document>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private googleSyncService: GoogleSyncService,
  ) {}

  scheduleSyncAgent(agentId: string, delayMs: number = 2000) {
    if (process.env.GOOGLE_SYNC_DISABLED === 'true') {
      this.logger.log(`Google Sync is disabled, skipping schedule for agent ${agentId}`);
      return;
    }

    // Clear existing timeout if any
    if (this.pendingByAgent.has(agentId)) {
      clearTimeout(this.pendingByAgent.get(agentId)!);
    }

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

  async syncAgentSummary4(agentId: string) {
    if (process.env.GOOGLE_SYNC_DISABLED === 'true') {
      this.logger.log(`Google Sync is disabled, skipping sync for agent ${agentId}`);
      return;
    }

    this.logger.log(`Starting Summary4 sync for agent ${agentId}...`);
    const data = await this.buildSummary4ForAgent(agentId);
    await this.writeSummary4ToGoogleSheet(agentId, data);
    this.logger.log(`Summary4 sync completed for agent ${agentId}, rows: ${data.length}`);
  }

  async buildSummary4ForAgent(agentId: string): Promise<Summary4Row[]> {
    const agentObjectId = new Types.ObjectId(agentId);

    const query = this.summary4Model.find({ agentId: agentObjectId, isActive: true })
      .sort({ orderDate: -1 })
      .populate({ path: 'productId', select: 'name sku' })
      .populate({ path: 'agentId', select: 'fullName email' });

    const summary4Records = await query.exec();

    this.logger.log(`Found ${summary4Records.length} Summary4 records for agent ${agentId}`);

    const rows = summary4Records.map((record) => {
      const productName = record.productId?.['name'] || '';
      const agentName = record.agentId?.['fullName'] || '';

      return {
        orderDate: record.orderDate,
        customerName: record.customerName || '',
        product: productName,
        quantity: record.quantity || 0,
        agentName: agentName,
        adGroupId: record.adGroupId || '',
        productionStatus: record.productionStatus || '',
        orderStatus: record.orderStatus || '',
        trackingNumber: record.trackingNumber || '',
        submitLink: record.submitLink || '',
        depositAmount: record.depositAmount || 0,
        codAmount: record.codAmount || 0,
        approvedQuotePrice: record.approvedQuotePrice || 0,
        mustPayToCompany: record.mustPayAmount || 0,
        paidToCompany: record.paidToCompanyAmount || 0,
        manualPayment: record.manualPaymentAmount || 0,
        needToPay: record.needToPayAmount || 0,
        testOrder2Id: record.testOrder2Id?.toString() || '',
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };
    });
    return rows;
  }

  async writeSummary4ToGoogleSheet(agentId: string, data: Summary4Row[]) {
    const user = await this.userModel.findById(agentId).lean();
    if (!user) {
      this.logger.warn(`User not found: ${agentId}`);
      return;
    }

    const googleDriveLink = user.googleDriveLink;
    if (!googleDriveLink) {
      this.logger.warn(`User ${agentId} doesn't have Google Drive link`);
      return;
    }

    try {
      const spreadsheetId = this.extractSpreadsheetId(googleDriveLink);
      if (!spreadsheetId) {
        this.logger.warn(`Cannot extract spreadsheetId from link: ${googleDriveLink}`);
        return;
      }

      const auth = await this.getGoogleAuth();
      if (!auth) {
        this.logger.warn('Missing Google credentials for authentication');
        return;
      }

      const sheets = google.sheets({ version: 'v4', auth });
      const sheetName = 'Summary4';

      // Ensure sheet exists
      await this.ensureSheetExists(sheets, spreadsheetId, sheetName);

      // Prepare data
      const header = this.getHeader();
      const values = data.map(r => this.mapRowToValues(r));

      // Clear existing data
      const clearRange = `${sheetName}!A2:Z`;
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: clearRange,
      });

      // Write new data
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
    } catch (error: any) {
      const errorDetail = error?.response?.data?.error || error?.message || error;
      this.logger.error(`Error writing Summary4 to Google Sheet:`, errorDetail);
      throw error;
    }
  }

  private getHeader(): string[] {
    return [
      'Ngày đặt hàng', 'Tên khách hàng', 'Sản phẩm', 'Số lượng', 'Đại lý',
      'Ad Group ID', 'Trạng thái sản xuất', 'Trạng thái đơn hàng', 'Mã vận đơn',
      'Link nộp', 'Tiền cọc', 'Tiền COD', 'Giá báo giá', 'Phải trả công ty',
      'Đã trả công ty', 'Thanh toán thủ công', 'Cần thanh toán'
    ];
  }

  private mapRecordToRow(record: any): Summary4Row {
    return {
      orderDate: record.orderDate,
      customerName: record.customerName || '',
  product: (record as any).product || (record as any).productId?.name || '',
      quantity: record.quantity || 0,
      agentName: record.agentName || record.agentId?.fullName || '',
      adGroupId: record.adGroupId || '0',
      productionStatus: record.productionStatus || '',
      orderStatus: record.orderStatus || '',
      trackingNumber: record.trackingNumber || '',
      submitLink: record.submitLink || '',
      depositAmount: record.depositAmount || 0,
      codAmount: record.codAmount || 0,
  approvedQuotePrice: (record as any).approvedQuotePrice || 0,
  // Map docker field names to our schema names with *Amount suffix
  mustPayToCompany: (record as any).mustPayToCompany ?? (record as any).mustPayAmount ?? 0,
  paidToCompany: (record as any).paidToCompany ?? (record as any).paidToCompanyAmount ?? 0,
  manualPayment: (record as any).manualPayment ?? (record as any).manualPaymentAmount ?? 0,
  needToPay: (record as any).needToPay ?? (record as any).needToPayAmount ?? 0,
      testOrder2Id: record.testOrder2Id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private mapRowToValues(record: Summary4Row): any[] {
    return [
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
    ];
  }

  private formatDate(date: Date | string | null): string {
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

  private extractSpreadsheetId(url: string): string | null {
    return this.googleSyncService.extractSpreadsheetId(url);
  }

  private async getGoogleAuth() {
    return this.googleSyncService.getGoogleAuth();
  }

  private async ensureSheetExists(sheets: any, spreadsheetId: string, sheetName: string) {
    return this.googleSyncService.ensureSheetExists(sheets, spreadsheetId, sheetName);
  }

  async syncAllAgents() {
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
      } catch (error: any) {
        result.failed++;
        result.errors.push(`Agent ${user._id}: ${error?.message || error}`);
        this.logger.error(`Failed to sync agent ${user._id}:`, error);
      }
    }

    this.logger.log(`Summary4 sync all completed: ${result.success}/${result.total} successful`);
    return result;
  }
}