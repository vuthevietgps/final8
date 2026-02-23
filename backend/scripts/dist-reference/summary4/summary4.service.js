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
var Summary4Service_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summary4Service = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const XLSX = require("xlsx");
const summary4_schema_1 = require("./schemas/summary4.schema");
const summary4_repository_1 = require("./summary4-repository");
const summary4_sync_service_1 = require("./summary4-sync.service");
const summary4_payment_service_1 = require("./summary4-payment.service");
const summary4_maintenance_service_1 = require("./summary4-maintenance.service");
const summary4_stats_service_1 = require("./summary4-stats.service");
const summary4_query_util_1 = require("./summary4-query.util");
let Summary4Service = Summary4Service_1 = class Summary4Service {
    constructor(summary4Model, summary4Repo, s4Sync, s4Pay, s4Maint, s4Stats) {
        this.summary4Model = summary4Model;
        this.summary4Repo = summary4Repo;
        this.s4Sync = s4Sync;
        this.s4Pay = s4Pay;
        this.s4Maint = s4Maint;
        this.s4Stats = s4Stats;
        this.logger = new common_1.Logger(Summary4Service_1.name);
        this.debugEnabled = process.env.DEBUG_SUMMARY4 === 'true';
    }
    onModuleInit() {
        this.logger.log('Summary4Service initialized with Google Sync Service');
    }
    async findAll(filter = {}) {
        var _a, _b;
        if (process.env.ENABLE_SUMMARY4_LISTING === 'false') {
            throw new common_1.NotFoundException('Summary4 search has been disabled');
        }
        const page = Math.max(1, Number((_a = filter.page) !== null && _a !== void 0 ? _a : 1));
        const limit = Math.max(1, Math.min(200, Number((_b = filter.limit) !== null && _b !== void 0 ? _b : 50)));
        const query = (0, summary4_query_util_1.buildQueryFromFilter)(filter);
        const sort = (0, summary4_query_util_1.buildSortFromFilter)(filter);
        const total = await this.summary4Model.countDocuments(query).exec();
        const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
        let currentPage = page;
        let redirectedToPage;
        if (totalPages > 0 && page > totalPages) {
            redirectedToPage = totalPages;
            currentPage = totalPages;
        }
        const skip = total === 0 ? 0 : (currentPage - 1) * limit;
        const data = total === 0
            ? []
            : await this.summary4Model
                .find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean()
                .exec();
        return Object.assign({ data,
            total, page: total === 0 ? 1 : currentPage, totalPages, requestedPage: page }, (redirectedToPage ? { redirectedToPage } : {}));
    }
    async findOne(id) {
        const summary = await this.summary4Model
            .findById(id)
            .populate('agentId', 'fullName email role')
            .populate('productId', 'name sku price')
            .exec();
        if (!summary) {
            throw new common_1.NotFoundException(`Summary4 với ID ${id} không tìm thấy`);
        }
        return summary;
    }
    async updateManualPayment(id, updateDto) {
        return this.s4Pay.updateManualPayment(id, updateDto);
    }
    async diagnostics() { return this.s4Maint.diagnostics(); }
    async fixDuplicates() { return this.s4Maint.fixDuplicates(); }
    async syncFromTestOrder2() { return this.s4Sync.syncFromTestOrder2(); }
    async syncSingleOrder(orderId) { return this.s4Sync.syncSingleOrder(orderId); }
    async getStats() { return this.s4Stats.getStats(); }
    async getAgents() { return this.s4Stats.getAgents(); }
    async exportUnpaidToExcel(_ = {}) {
        throw new common_1.NotFoundException('Summary4 Excel export has been disabled');
    }
    async exportManualPaymentTemplate(_ = {}) {
        return this.s4Pay.exportManualPaymentTemplate(_);
    }
    async exportExcel(filter = {}) {
        if (process.env.ENABLE_SUMMARY4_LISTING === 'false') {
            throw new common_1.NotFoundException('Summary4 export is disabled while listing is off');
        }
        const query = (0, summary4_query_util_1.buildQueryFromFilter)(filter);
        const sort = (0, summary4_query_util_1.buildSortFromFilter)(filter);
        const rows = await this.summary4Model
            .find(query)
            .sort(sort)
            .lean()
            .exec();
        const data = rows.map((r) => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            return ({
                'Ngày tháng': r.orderDate ? new Date(r.orderDate).toISOString().slice(0, 10) : '',
                'Tên khách hàng': r.customerName || '',
                'Sản phẩm': r.product || '',
                'Số lượng': (_a = r.quantity) !== null && _a !== void 0 ? _a : 0,
                'Tên đại lý': r.agentName || '',
                'ID nhóm QC': r.adGroupId || '',
                'Kích hoạt': r.isActive ? 'Có' : 'Không',
                'Chi tiết dịch vụ': r.serviceDetails || '',
                'Trạng thái SX': r.productionStatus || '',
                'Trạng thái vận đơn': r.orderStatus || '',
                'Link nộp': r.submitLink || '',
                'Mã vận đơn': r.trackingNumber || '',
                'Đặt cọc': (_b = r.depositAmount) !== null && _b !== void 0 ? _b : 0,
                'COD': (_c = r.codAmount) !== null && _c !== void 0 ? _c : 0,
                'Báo giá đại lý': (_d = r.approvedQuotePrice) !== null && _d !== void 0 ? _d : 0,
                'Phải Trả công ty': (_e = r.mustPayToCompany) !== null && _e !== void 0 ? _e : 0,
                'Đã Trả công ty': (_f = r.paidToCompany) !== null && _f !== void 0 ? _f : 0,
                'Thanh toán tay': (_g = r.manualPayment) !== null && _g !== void 0 ? _g : 0,
                'Cần thanh toán': (_h = r.needToPay) !== null && _h !== void 0 ? _h : 0,
            });
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Summary4');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        return buf;
    }
    async importManualPaymentFromExcel(fileBuffer) { return this.s4Pay.importManualPaymentFromExcel(fileBuffer); }
    async cleanupOrphanedRecords(options = {}) { return this.s4Maint.cleanupOrphanedRecords(options); }
    async findByTestOrder2Id(testOrder2Id) { return this.s4Maint.findByTestOrder2Id(testOrder2Id); }
    async deleteByTestOrder2Id(testOrder2Id) { return this.s4Maint.deleteByTestOrder2Id(testOrder2Id); }
    async clearAll() { return this.s4Maint.clearAll(); }
};
exports.Summary4Service = Summary4Service;
exports.Summary4Service = Summary4Service = Summary4Service_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(summary4_schema_1.Summary4.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        summary4_repository_1.Summary4Repository,
        summary4_sync_service_1.Summary4SyncService,
        summary4_payment_service_1.Summary4PaymentService,
        summary4_maintenance_service_1.Summary4MaintenanceService,
        summary4_stats_service_1.Summary4StatsService])
], Summary4Service);
//# sourceMappingURL=summary4.service.js.map