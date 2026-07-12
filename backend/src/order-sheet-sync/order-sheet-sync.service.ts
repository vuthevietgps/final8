/**
 * Service: OrderSheetSyncService
 * Chức năng: Đồng bộ đơn hàng từ OrderTest2 lên Google Sheets của Đại lý và Nhà cung cấp
 *
 * Features:
 * - Sync đơn hàng của Đại lý lên Google Sheet (tab "Đơn Hàng Đại Lý")
 * - Sync đơn hàng của Nhà cung cấp lên Google Sheet (tab "Đơn Hàng NCC")
 * - Tự động sync khi có biến động: create/update order, payment batch
 * - Cron job sync định kỳ mỗi 6 giờ (nếu enabled)
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { User, UserDocument } from '../user/user.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { GoogleSyncService } from '../google-sync/google-sync.service';
import { google } from 'googleapis';
import { UserRole } from '../user/user.enum';

interface AgentOrderRow {
  orderDate: string;
  customerName: string;
  productName: string;
  quantity: number;
  agentName: string;
  adGroupId: string;
  productionStatus: string;
  orderStatus: string;
  trackingNumber: string;
  submitLink: string;
  depositAmount: number;
  codAmount: number;
  shippingFee: number;
  returnFee: number;
  approvedQuotePrice: number;
  agentPaymentStatus: string;
  agentPaymentBatchId: string; // Mã phiếu thanh toán hoa hồng
}

interface SupplierOrderRow {
  orderDate: string;
  customerName: string;
  productName: string;
  quantity: number;
  supplierName: string;
  adGroupId: string;
  productionStatus: string;
  orderStatus: string;
  trackingNumber: string;
  submitLink: string;
  depositAmount: number;
  codAmount: number;
  approvedSupplierQuote: number;
  supplierPaymentStatus: string; // Trạng thái thanh toán NCC
  supplierPaymentBatchId: string; // Mã phiếu thanh toán NCC
}

@Injectable()
export class OrderSheetSyncService {
  private readonly logger = new Logger(OrderSheetSyncService.name);

  constructor(
    @InjectModel(TestOrder2.name) private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly googleSyncService: GoogleSyncService,
  ) {}

  /**
   * Đồng bộ đơn hàng lên Google Sheet của 1 đại lý
   */
  async syncAgentOrders(agentId: string): Promise<{ success: boolean; message: string; recordsSynced?: number }> {
    try {
      // 1. Lấy thông tin agent
      const agent = await this.userModel.findById(agentId).lean();
      if (!agent) {
        return { success: false, message: `Agent not found: ${agentId}` };
      }

      if (!agent.googleDriveLink) {
        return { success: false, message: `Agent ${agent.fullName} không có Google Drive link` };
      }

      // 2. Lấy đơn hàng của agent
      const agentIdFilter = this.buildIdFilter('agentId', agentId);
      const orders = await this.orderModel
        .find({ ...agentIdFilter, isActive: { $ne: false } })
        .sort({ orderDate: -1 })
        .populate('productId')
        .lean();

      // 3. Build data rows
      const rows = await this.buildAgentOrderRows(orders, agent);

      // 4. Push lên Google Sheets
      await this.writeAgentOrdersToSheet(agentId, agent.googleDriveLink, rows);

      this.logger.log(`Synced ${rows.length} orders to Google Sheet for agent ${agent.fullName}`);

      return {
        success: true,
        message: `Đồng bộ thành công ${rows.length} đơn hàng lên Google Sheet của ${agent.fullName}`,
        recordsSynced: rows.length,
      };
    } catch (error) {
      this.logger.error(`Error syncing agent orders: ${error.message}`, error.stack);
      return {
        success: false,
        message: `Lỗi đồng bộ: ${error.message}`,
      };
    }
  }

  /**
   * Đồng bộ đơn hàng lên Google Sheet của 1 nhà cung cấp
   */
  async syncSupplierOrders(supplierId: string): Promise<{ success: boolean; message: string; recordsSynced?: number }> {
    try {
      // 1. Lấy thông tin supplier
      const supplier = await this.userModel.findById(supplierId).lean();
      if (!supplier) {
        return { success: false, message: `Supplier not found: ${supplierId}` };
      }

      if (!supplier.googleDriveLink) {
        return { success: false, message: `Supplier ${supplier.fullName} không có Google Drive link` };
      }

      // 2. Lấy đơn hàng của supplier
      const supplierIdFilter = this.buildIdFilter('supplierId', supplierId);
      const orders = await this.orderModel
        .find({ ...supplierIdFilter, isActive: { $ne: false } })
        .sort({ orderDate: -1 })
        .populate('productId')
        .lean();

      // 3. Build data rows
      const rows = await this.buildSupplierOrderRows(orders, supplier);

      // 4. Push lên Google Sheets
      await this.writeSupplierOrdersToSheet(supplierId, supplier.googleDriveLink, rows);

      this.logger.log(`Synced ${rows.length} orders to Google Sheet for supplier ${supplier.fullName}`);

      return {
        success: true,
        message: `Đồng bộ thành công ${rows.length} đơn hàng lên Google Sheet của ${supplier.fullName}`,
        recordsSynced: rows.length,
      };
    } catch (error) {
      this.logger.error(`Error syncing supplier orders: ${error.message}`, error.stack);
      return {
        success: false,
        message: `Lỗi đồng bộ: ${error.message}`,
      };
    }
  }

  /**
   * Đồng bộ tất cả agents có googleDriveLink
   */
  async syncAllAgents(): Promise<{ total: number; success: number; failed: number; errors: string[] }> {
    if (process.env.GOOGLE_SYNC_DISABLED === 'true') {
      this.logger.log('Google Sync is disabled');
      return { total: 0, success: 0, failed: 0, errors: ['Google Sync is disabled'] };
    }

    const agents = await this.userModel
      .find({
        role: { $in: [UserRole.INTERNAL_AGENT, UserRole.EXTERNAL_AGENT] },
        googleDriveLink: { $exists: true, $nin: [null, ''] },
        isActive: true,
      })
      .lean();

    const result = { total: agents.length, success: 0, failed: 0, errors: [] as string[] };

    for (const agent of agents) {
      try {
        const syncResult = await this.syncAgentOrders(agent._id.toString());
        if (syncResult.success) {
          result.success++;
        } else {
          result.failed++;
          result.errors.push(`Agent ${agent.fullName}: ${syncResult.message}`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Agent ${agent.fullName}: ${error.message}`);
      }
    }

    this.logger.log(`Sync all agents completed: ${result.success}/${result.total} successful`);
    return result;
  }

  /**
   * Đồng bộ tất cả suppliers có googleDriveLink
   */
  async syncAllSuppliers(): Promise<{ total: number; success: number; failed: number; errors: string[] }> {
    if (process.env.GOOGLE_SYNC_DISABLED === 'true') {
      this.logger.log('Google Sync is disabled');
      return { total: 0, success: 0, failed: 0, errors: ['Google Sync is disabled'] };
    }

    const suppliers = await this.userModel
      .find({
        role: { $in: [UserRole.INTERNAL_SUPPLIER, UserRole.EXTERNAL_SUPPLIER] },
        googleDriveLink: { $exists: true, $nin: [null, ''] },
        isActive: true,
      })
      .lean();

    const result = { total: suppliers.length, success: 0, failed: 0, errors: [] as string[] };

    for (const supplier of suppliers) {
      try {
        const syncResult = await this.syncSupplierOrders(supplier._id.toString());
        if (syncResult.success) {
          result.success++;
        } else {
          result.failed++;
          result.errors.push(`Supplier ${supplier.fullName}: ${syncResult.message}`);
        }
      } catch (error) {
        result.failed++;
        result.errors.push(`Supplier ${supplier.fullName}: ${error.message}`);
      }
    }

    this.logger.log(`Sync all suppliers completed: ${result.success}/${result.total} successful`);
    return result;
  }

  /**
   * Cron job: Auto sync mỗi 6 giờ (nếu enabled)
   */
  @Cron('0 */6 * * *')
  async autoSyncAll() {
    if (process.env.AUTO_SYNC_ORDERS_ENABLED !== 'true') {
      return;
    }

    this.logger.log('Starting auto sync for all agents and suppliers...');

    const agentResult = await this.syncAllAgents();
    const supplierResult = await this.syncAllSuppliers();

    this.logger.log(`Auto sync completed - Agents: ${agentResult.success}/${agentResult.total}, Suppliers: ${supplierResult.success}/${supplierResult.total}`);
  }

  // ============================================
  // TRIGGER METHODS - Được gọi từ TestOrder2Service
  // ============================================

  /**
   * Trigger sync khi đơn hàng được tạo hoặc cập nhật
   * Sync cho cả agent và supplier của đơn hàng đó
   */
  async triggerSyncOnOrderChange(order: { agentId?: any; supplierId?: any }): Promise<void> {
    if (process.env.GOOGLE_SYNC_DISABLED === 'true') {
      return;
    }

    // Debounce: chờ 2 giây để batch các thay đổi liên tiếp
    const agentId = order.agentId ? String(order.agentId) : null;
    const supplierId = order.supplierId ? String(order.supplierId) : null;

    // Sync agent sheet (nếu có)
    if (agentId) {
      this.scheduleSyncAgent(agentId);
    }

    // Sync supplier sheet (nếu có)
    if (supplierId) {
      this.scheduleSyncSupplier(supplierId);
    }
  }

  /**
   * Trigger sync khi có thanh toán supplier batch
   * Sync tất cả suppliers liên quan trong batch
   */
  async triggerSyncOnSupplierPayment(supplierIds: string[]): Promise<void> {
    if (process.env.GOOGLE_SYNC_DISABLED === 'true') {
      return;
    }

    const uniqueIds = [...new Set(supplierIds)];
    for (const supplierId of uniqueIds) {
      this.scheduleSyncSupplier(supplierId);
    }
  }

  /**
   * Trigger sync khi có thanh toán agent batch
   * Sync tất cả agents liên quan trong batch
   */
  async triggerSyncOnAgentPayment(agentIds: string[]): Promise<void> {
    if (process.env.GOOGLE_SYNC_DISABLED === 'true') {
      return;
    }

    const uniqueIds = [...new Set(agentIds)];
    for (const agentId of uniqueIds) {
      this.scheduleSyncAgent(agentId);
    }
  }

  // Debounce maps để tránh sync quá nhiều lần
  private agentSyncTimers = new Map<string, NodeJS.Timeout>();
  private supplierSyncTimers = new Map<string, NodeJS.Timeout>();
  private readonly DEBOUNCE_MS = 30_000; // 30 giây - tránh vượt quota Google API

  // Global rate limiter: tối đa 5 sync đồng thời
  private readonly MAX_CONCURRENT_SYNCS = 5;
  private activeSyncCount = 0;
  private syncQueue: Array<() => Promise<void>> = [];

  /** Chạy sync task qua rate limiter, nếu đầy thì xếp hàng chờ */
  private async runWithRateLimit(task: () => Promise<void>): Promise<void> {
    if (this.activeSyncCount >= this.MAX_CONCURRENT_SYNCS) {
      // Xếp hàng chờ, không bỏ qua
      return new Promise<void>((resolve, reject) => {
        this.syncQueue.push(async () => {
          try { await task(); resolve(); } catch (e) { reject(e); }
        });
      });
    }

    this.activeSyncCount++;
    try {
      await task();
    } finally {
      this.activeSyncCount--;
      // Chạy task tiếp theo trong queue (nếu có)
      if (this.syncQueue.length > 0) {
        const next = this.syncQueue.shift()!;
        this.runWithRateLimit(next).catch(err => {
          this.logger.error(`Queued sync failed: ${err.message}`);
        });
      }
    }
  }

  // Cache googleDriveLink để tránh query DB mỗi lần trigger
  private userLinkCache = new Map<string, { link: string | null; expiry: number }>();
  private readonly CACHE_TTL_MS = 60_000; // 1 phút

  /** Kiểm tra nhanh user có googleDriveLink không (có cache) */
  private async hasGoogleDriveLink(userId: string): Promise<boolean> {
    const cached = this.userLinkCache.get(userId);
    if (cached && cached.expiry > Date.now()) {
      return !!cached.link;
    }

    const user = await this.userModel
      .findById(userId)
      .select('googleDriveLink')
      .lean();
    const link = user?.googleDriveLink || null;
    this.userLinkCache.set(userId, { link, expiry: Date.now() + this.CACHE_TTL_MS });
    return !!link;
  }

  private scheduleSyncAgent(agentId: string) {
    // Clear existing timer if any
    const existingTimer = this.agentSyncTimers.get(agentId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new sync after debounce period
    const timer = setTimeout(async () => {
      this.agentSyncTimers.delete(agentId);

      // Kiểm tra googleDriveLink trước khi sync (tránh query + API call thừa)
      const hasLink = await this.hasGoogleDriveLink(agentId);
      if (!hasLink) return;

      await this.runWithRateLimit(async () => {
        try {
          await this.syncAgentOrders(agentId);
        } catch (error) {
          this.logger.error(`Failed to sync agent ${agentId}: ${error.message}`);
        }
      });
    }, this.DEBOUNCE_MS);

    this.agentSyncTimers.set(agentId, timer);
  }

  private scheduleSyncSupplier(supplierId: string) {
    // Clear existing timer if any
    const existingTimer = this.supplierSyncTimers.get(supplierId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Schedule new sync after debounce period
    const timer = setTimeout(async () => {
      this.supplierSyncTimers.delete(supplierId);

      // Kiểm tra googleDriveLink trước khi sync (tránh query + API call thừa)
      const hasLink = await this.hasGoogleDriveLink(supplierId);
      if (!hasLink) return;

      await this.runWithRateLimit(async () => {
        try {
          await this.syncSupplierOrders(supplierId);
        } catch (error) {
          this.logger.error(`Failed to sync supplier ${supplierId}: ${error.message}`);
        }
      });
    }, this.DEBOUNCE_MS);

    this.supplierSyncTimers.set(supplierId, timer);
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private async buildAgentOrderRows(orders: any[], agent: any): Promise<AgentOrderRow[]> {
    const rows: AgentOrderRow[] = [];

    for (const order of orders) {
      const product = order.productId;
      const row: AgentOrderRow = {
        orderDate: this.formatDate(order.orderDate),
        customerName: order.customerName || '',
        productName: product?.name || order.productName || '',
        quantity: order.quantity || 1,
        agentName: agent.fullName,
        adGroupId: order.adGroupId || '',
        productionStatus: order.productionStatus || '',
        orderStatus: order.orderStatus || '',
        trackingNumber: order.trackingNumber || '',
        submitLink: order.submitLink || '',
        depositAmount: order.depositAmount || 0,
        codAmount: order.codAmount || 0,
        shippingFee: order.shippingFee || 0,
        returnFee: order.returnFee || 0,
        approvedQuotePrice: order.agentAppliedPrice || order.agentQuote || 0,
        agentPaymentStatus: order.agentPaymentStatus || 'n/a',
        agentPaymentBatchId: order.agentPaymentBatchId || '',
      };
      rows.push(row);
    }

    return rows;
  }

  private async buildSupplierOrderRows(orders: any[], supplier: any): Promise<SupplierOrderRow[]> {
    const rows: SupplierOrderRow[] = [];

    for (const order of orders) {
      const product = order.productId;
      const row: SupplierOrderRow = {
        orderDate: this.formatDate(order.orderDate),
        customerName: order.customerName || '',
        productName: product?.name || order.productName || '',
        quantity: order.quantity || 1,
        supplierName: supplier.fullName,
        adGroupId: order.adGroupId || '',
        productionStatus: order.productionStatus || '',
        orderStatus: order.orderStatus || '',
        trackingNumber: order.trackingNumber || '',
        submitLink: order.submitLink || '',
        depositAmount: order.depositAmount || 0,
        codAmount: order.codAmount || 0,
        approvedSupplierQuote: order.supplierAppliedPrice || order.supplierQuote || 0,
        supplierPaymentStatus: order.supplierPaymentStatus || 'pending',
        supplierPaymentBatchId: order.supplierPaymentBatchId || '',
      };
      rows.push(row);
    }

    return rows;
  }

  private async writeAgentOrdersToSheet(agentId: string, googleDriveLink: string, rows: AgentOrderRow[]) {
    const spreadsheetId = this.googleSyncService.extractSpreadsheetId(googleDriveLink);
    if (!spreadsheetId) {
      throw new Error(`Invalid Google Drive link: ${googleDriveLink}`);
    }

    const auth = await this.googleSyncService.getGoogleAuth();
    if (!auth) {
      throw new Error('Missing Google credentials');
    }

    const sheets = google.sheets({ version: 'v4', auth });
    const sheetName = 'Đơn Hàng Đại Lý';

    // Ensure sheet exists
    await this.googleSyncService.ensureSheetExists(sheets, spreadsheetId, sheetName);

    // Header row
    const header = [
      'Ngày đặt hàng',
      'Tên khách hàng',
      'Sản phẩm',
      'Số lượng',
      'Tên đại lý',
      'ID nhóm quảng cáo',
      'Trạng thái sản xuất',
      'Trạng thái đơn hàng',
      'Mã vận đơn',
      'Link submit',
      'Số tiền đặt cọc',
      'Số tiền COD',
      'Phí ship',
      'Phí hàng hoàn',
      'Giá báo giá được duyệt',
      'Trạng thái thanh toán',
      'Mã phiếu thanh toán',
    ];

    // Data rows
    const values = rows.map(r => [
      r.orderDate,
      r.customerName,
      r.productName,
      r.quantity,
      r.agentName,
      r.adGroupId,
      r.productionStatus,
      r.orderStatus,
      r.trackingNumber,
      r.submitLink,
      r.depositAmount,
      r.codAmount,
      r.shippingFee,
      r.returnFee,
      r.approvedQuotePrice,
      r.agentPaymentStatus,
      r.agentPaymentBatchId,
    ]);

    // Clear old data
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A2:Z`,
    });

    // Write header
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [header] },
    });

    // Write data
    if (values.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A2`,
        valueInputOption: 'RAW',
        requestBody: { values },
      });
    }

    this.logger.log(`Wrote ${values.length} agent orders to sheet ${sheetName}`);
  }

  private async writeSupplierOrdersToSheet(supplierId: string, googleDriveLink: string, rows: SupplierOrderRow[]) {
    const spreadsheetId = this.googleSyncService.extractSpreadsheetId(googleDriveLink);
    if (!spreadsheetId) {
      throw new Error(`Invalid Google Drive link: ${googleDriveLink}`);
    }

    const auth = await this.googleSyncService.getGoogleAuth();
    if (!auth) {
      throw new Error('Missing Google credentials');
    }

    const sheets = google.sheets({ version: 'v4', auth });
    const sheetName = 'Đơn Hàng NCC';

    // Ensure sheet exists
    await this.googleSyncService.ensureSheetExists(sheets, spreadsheetId, sheetName);

    // Header row
    const header = [
      'Ngày đặt hàng',
      'Tên khách hàng',
      'Sản phẩm',
      'Số lượng',
      'Tên nhà cung cấp',
      'ID nhóm quảng cáo',
      'Trạng thái sản xuất',
      'Trạng thái đơn hàng',
      'Mã vận đơn',
      'Link submit',
      'Số tiền đặt cọc',
      'Số tiền COD',
      'Giá báo giá NCC được duyệt',
      'Trạng thái thanh toán',
      'Mã phiếu thanh toán',
    ];

    // Data rows
    const values = rows.map(r => [
      r.orderDate,
      r.customerName,
      r.productName,
      r.quantity,
      r.supplierName,
      r.adGroupId,
      r.productionStatus,
      r.orderStatus,
      r.trackingNumber,
      r.submitLink,
      r.depositAmount,
      r.codAmount,
      r.approvedSupplierQuote,
      r.supplierPaymentStatus,
      r.supplierPaymentBatchId,
    ]);

    // Clear old data
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A2:Z`,
    });

    // Write header
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [header] },
    });

    // Write data
    if (values.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A2`,
        valueInputOption: 'RAW',
        requestBody: { values },
      });
    }

    this.logger.log(`Wrote ${values.length} supplier orders to sheet ${sheetName}`);
  }

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
   * Build robust ID filter for data migrated across different BSON types.
   * Some legacy records may store IDs as strings, while current schema uses ObjectId.
   */
  private buildIdFilter(field: 'agentId' | 'supplierId', id: string): Record<string, any> {
    const normalized = String(id || '').trim();
    if (!normalized) {
      return { [field]: normalized };
    }

    if (!Types.ObjectId.isValid(normalized)) {
      return { [field]: normalized };
    }

    const objectId = new Types.ObjectId(normalized);
    return {
      $or: [
        { [field]: objectId },
        { [field]: normalized },
      ],
    };
  }

  // ============================================
  // CREDENTIALS MANAGEMENT
  // ============================================

  /**
   * Lấy trạng thái đầy đủ của Google Sync
   */
  async getFullStatus(): Promise<{
    enabled: boolean;
    autoSyncEnabled: boolean;
    cronSchedule: string;
    credentialsConfigured: boolean;
    credentialsSource: string;
    lastSyncTime?: Date;
  }> {
    const hasEnvCredentials = !!process.env.GOOGLE_CREDENTIALS_JSON;
    const hasFileCredentials = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

    let credentialsSource = 'none';
    let credentialsConfigured = false;

    if (hasEnvCredentials) {
      credentialsSource = 'GOOGLE_CREDENTIALS_JSON (env)';
      credentialsConfigured = true;
    } else if (hasFileCredentials) {
      credentialsSource = 'GOOGLE_APPLICATION_CREDENTIALS (file)';
      credentialsConfigured = true;
    }

    // Test xem credentials có hoạt động không
    try {
      const authResult = await this.googleSyncService.authDebugInfo();
      if (authResult?.hasAuth) {
        credentialsConfigured = true;
      } else {
        credentialsConfigured = false;
        credentialsSource = authResult?.status || 'not configured';
      }
    } catch {
      credentialsConfigured = false;
    }

    return {
      enabled: process.env.GOOGLE_SYNC_DISABLED !== 'true',
      autoSyncEnabled: process.env.AUTO_SYNC_ORDERS_ENABLED === 'true',
      cronSchedule: '0 */6 * * *',
      credentialsConfigured,
      credentialsSource,
    };
  }

  /**
   * Lưu Google Service Account credentials (JSON string)
   * Lưu vào file và set environment variable
   */
  async saveCredentials(credentialsJson: string): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Parse và validate JSON
      const creds = JSON.parse(credentialsJson);
      if (!creds.client_email || !creds.private_key) {
        return { success: false, message: 'JSON không hợp lệ: thiếu client_email hoặc private_key' };
      }

      // 2. Test xem credentials có hoạt động không
      const testResult = await this.testCredentials(credentialsJson);
      if (!testResult.success) {
        return testResult;
      }

      // 3. Lưu vào file
      const fs = await import('fs');
      const path = await import('path');
      const credPath = path.resolve(process.cwd(), 'google-sheets-credentials.json');
      fs.writeFileSync(credPath, JSON.stringify(creds, null, 2), 'utf8');

      // 4. Set environment variable cho runtime
      process.env.GOOGLE_CREDENTIALS_JSON = credentialsJson;
      process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;

      this.logger.log(`Google credentials saved to ${credPath}`);

      return {
        success: true,
        message: `Đã lưu credentials (${creds.client_email}). Credentials sẽ được sử dụng cho Google Sheets sync.`,
      };
    } catch (error: any) {
      this.logger.error(`Error saving credentials: ${error.message}`);
      return {
        success: false,
        message: `Lỗi lưu credentials: ${error.message}`,
      };
    }
  }

  /**
   * Test credentials có hoạt động không
   */
  async testCredentials(credentialsJson: string): Promise<{ success: boolean; message: string; email?: string }> {
    try {
      const creds = JSON.parse(credentialsJson);
      if (!creds.client_email || !creds.private_key) {
        return { success: false, message: 'JSON không hợp lệ: thiếu client_email hoặc private_key' };
      }

      // Test bằng cách tạo JWT client
      const jwtClient = new google.auth.JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      await jwtClient.authorize();

      return {
        success: true,
        message: `Credentials hợp lệ! Service Account: ${creds.client_email}`,
        email: creds.client_email,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Lỗi xác thực: ${error.message}`,
      };
    }
  }

  /**
   * Lấy danh sách đại lý và NCC có cấu hình Google Sheet
   */
  async getAgentsAndSuppliersWithSheet(): Promise<{
    agents: Array<{ _id: string; fullName: string; googleDriveLink: string; orderCount: number }>;
    suppliers: Array<{ _id: string; fullName: string; googleDriveLink: string; orderCount: number }>;
  }> {
    // Lấy agents
    const agents = await this.userModel
      .find({
        role: { $in: [UserRole.INTERNAL_AGENT, UserRole.EXTERNAL_AGENT] },
        isActive: true,
      })
      .select('_id fullName googleDriveLink')
      .lean();

    // Lấy suppliers
    const suppliers = await this.userModel
      .find({
        role: { $in: [UserRole.INTERNAL_SUPPLIER, UserRole.EXTERNAL_SUPPLIER] },
        isActive: true,
      })
      .select('_id fullName googleDriveLink')
      .lean();

    // Đếm đơn hàng cho mỗi agent/supplier
    const agentOrderCounts = await this.orderModel.aggregate([
      { $match: { agentId: { $type: 'objectId' }, isActive: { $ne: false } } },
      { $group: { _id: '$agentId', count: { $sum: 1 } } },
    ]);
    const agentCountMap = new Map(
      agentOrderCounts
        .filter((a) => a?._id)
        .map((a) => [a._id.toString(), a.count]),
    );

    const supplierOrderCounts = await this.orderModel.aggregate([
      { $match: { supplierId: { $type: 'objectId' }, isActive: { $ne: false } } },
      { $group: { _id: '$supplierId', count: { $sum: 1 } } },
    ]);
    const supplierCountMap = new Map(
      supplierOrderCounts
        .filter((s) => s?._id)
        .map((s) => [s._id.toString(), s.count]),
    );

    return {
      agents: agents.map((a) => ({
        _id: (a._id as any).toString(),
        fullName: a.fullName || 'Không tên',
        googleDriveLink: a.googleDriveLink || '',
        orderCount: agentCountMap.get((a._id as any).toString()) || 0,
      })),
      suppliers: suppliers.map((s) => ({
        _id: (s._id as any).toString(),
        fullName: s.fullName || 'Không tên',
        googleDriveLink: s.googleDriveLink || '',
        orderCount: supplierCountMap.get((s._id as any).toString()) || 0,
      })),
    };
  }
}
