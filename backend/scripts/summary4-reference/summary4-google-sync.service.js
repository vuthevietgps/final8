"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var Summary4GoogleSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summary4GoogleSyncService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const summary4_schema_1 = require("./schemas/summary4.schema");
const user_schema_1 = require("../user/user.schema");
const google_sync_service_1 = require("../google-sync/google-sync.service");
const googleapis_1 = require("googleapis");
let Summary4GoogleSyncService = Summary4GoogleSyncService_1 = class Summary4GoogleSyncService {
    constructor(summary4Model, userModel, googleSyncService) {
        this.summary4Model = summary4Model;
        this.userModel = userModel;
        this.googleSyncService = googleSyncService;
        this.logger = new common_1.Logger(Summary4GoogleSyncService_1.name);
        this.pendingByAgent = new Map();
    }
    scheduleSyncAgent(agentId, delayMs = 2000) {
        if (process.env.GOOGLE_SYNC_DISABLED === 'true') {
            this.logger.log(`Google Sync is disabled, skipping schedule for agent ${agentId}`);
            return;
        }
        if (this.pendingByAgent.has(agentId)) {
            clearTimeout(this.pendingByAgent.get(agentId));
        }
        const timeoutId = setTimeout(async () => {
            try {
                await this.syncAgentSummary4(agentId);
                this.pendingByAgent.delete(agentId);
            }
            catch (error) {
                this.logger.error(`Summary4 sync failed for agent ${agentId}:`, error);
                this.pendingByAgent.delete(agentId);
            }
        }, delayMs);
        this.pendingByAgent.set(agentId, timeoutId);
        this.logger.log(`Scheduled Summary4 sync for agent ${agentId} in ${delayMs}ms`);
    }
    async syncAgentSummary4(agentId) {
        if (process.env.GOOGLE_SYNC_DISABLED === 'true') {
            this.logger.log(`Google Sync is disabled, skipping sync for agent ${agentId}`);
            return;
        }
        this.logger.log(`Starting Summary4 sync for agent ${agentId}...`);
        const data = await this.buildSummary4ForAgent(agentId);
        await this.writeSummary4ToGoogleSheet(agentId, data);
        this.logger.log(`Summary4 sync completed for agent ${agentId}, rows: ${data.length}`);
    }
    async buildSummary4ForAgent(agentId) {
        const agentObjectId = new mongoose_2.Types.ObjectId(agentId);
        const summary4Records = await this.summary4Model
            .find({ agentId: agentObjectId, isActive: true })
            .populate('productId', 'name sku')
            .populate('agentId', 'fullName email')
            .sort({ orderDate: -1 })
            .lean();
        this.logger.log(`Found ${summary4Records.length} Summary4 records for agent ${agentId}`);
        const rows = summary4Records.map((record) => this.mapRecordToRow(record));
        return rows;
    }
    async writeSummary4ToGoogleSheet(agentId, data) {
        var _a, _b;
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
            const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
            const sheetName = 'Summary4';
            await this.ensureSheetExists(sheets, spreadsheetId, sheetName);
            const header = this.getHeader();
            const values = data.map(r => this.mapRowToValues(r));
            const clearRange = `${sheetName}!A2:Z`;
            await sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: clearRange,
            });
            if (data.length > 0) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheetName}!A1`,
                    valueInputOption: 'RAW',
                    requestBody: { values: [header] },
                });
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheetName}!A2`,
                    valueInputOption: 'RAW',
                    requestBody: { values },
                });
            }
            this.logger.log(`Successfully wrote ${values.length} rows to Google Sheet ${sheetName}: ${spreadsheetId}`);
        }
        catch (error) {
            const errorDetail = ((_b = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.error) || (error === null || error === void 0 ? void 0 : error.message) || error;
            this.logger.error(`Error writing Summary4 to Google Sheet:`, errorDetail);
            throw error;
        }
    }
    getHeader() {
        return [
            'Ngày đặt hàng', 'Tên khách hàng', 'Sản phẩm', 'Số lượng', 'Đại lý',
            'Ad Group ID', 'Trạng thái sản xuất', 'Trạng thái đơn hàng', 'Mã vận đơn',
            'Link nộp', 'Tiền cọc', 'Tiền COD', 'Giá báo giá', 'Phải trả công ty',
            'Đã trả công ty', 'Thanh toán thủ công', 'Cần thanh toán'
        ];
    }
    mapRecordToRow(record) {
        var _a, _b;
        return {
            orderDate: record.orderDate,
            customerName: record.customerName || '',
            product: record.product || ((_a = record.productId) === null || _a === void 0 ? void 0 : _a.name) || '',
            quantity: record.quantity || 0,
            agentName: record.agentName || ((_b = record.agentId) === null || _b === void 0 ? void 0 : _b.fullName) || '',
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
            testOrder2Id: record.testOrder2Id,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }
    mapRowToValues(record) {
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
    formatDate(date) {
        try {
            const d = date instanceof Date ? date : (date ? new Date(date) : null);
            if (!d || isNaN(d.getTime()))
                return '';
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        }
        catch (_a) {
            return '';
        }
    }
    extractSpreadsheetId(url) {
        return this.googleSyncService.extractSpreadsheetId(url);
    }
    async getGoogleAuth() {
        return this.googleSyncService.getGoogleAuth();
    }
    async ensureSheetExists(sheets, spreadsheetId, sheetName) {
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
            errors: [],
        };
        for (const user of users) {
            try {
                await this.syncAgentSummary4(user._id.toString());
                result.success++;
            }
            catch (error) {
                result.failed++;
                result.errors.push(`Agent ${user._id}: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
                this.logger.error(`Failed to sync agent ${user._id}:`, error);
            }
        }
        this.logger.log(`Summary4 sync all completed: ${result.success}/${result.total} successful`);
        return result;
    }
};
exports.Summary4GoogleSyncService = Summary4GoogleSyncService;
exports.Summary4GoogleSyncService = Summary4GoogleSyncService = Summary4GoogleSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(summary4_schema_1.Summary4.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        google_sync_service_1.GoogleSyncService])
], Summary4GoogleSyncService);
//# sourceMappingURL=summary4-google-sync.service.js.map