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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summary4Controller = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const summary4_service_1 = require("./summary4.service");
const summary4_google_sync_service_1 = require("./summary4-google-sync.service");
const summary4_filter_dto_1 = require("./dto/summary4-filter.dto");
const update_manual_payment_dto_1 = require("./dto/update-manual-payment.dto");
let Summary4Controller = class Summary4Controller {
    constructor(summary4Service, summary4GoogleSyncService) {
        this.summary4Service = summary4Service;
        this.summary4GoogleSyncService = summary4GoogleSyncService;
    }
    findAll(filter) {
        var _a, _b;
        const disabled = process.env.ENABLE_SUMMARY4_LISTING === 'false';
        if (disabled) {
            return {
                data: [],
                total: 0,
                page: (_a = filter === null || filter === void 0 ? void 0 : filter.page) !== null && _a !== void 0 ? _a : 1,
                totalPages: 0,
                requestedPage: (_b = filter === null || filter === void 0 ? void 0 : filter.page) !== null && _b !== void 0 ? _b : 1,
                disabled: true,
                message: 'Summary4 listing is disabled',
            };
        }
        return this.summary4Service.findAll(filter);
    }
    async exportExcel(res, filter) {
        const buf = await this.summary4Service.exportExcel(filter);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        const filename = `summary4-${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.end(buf);
    }
    getStats() {
        return this.summary4Service.getStats();
    }
    getAgents() {
        return this.summary4Service.getAgents();
    }
    async exportUnpaidToExcel(filter, res) {
        throw new common_1.NotFoundException('Summary4 Excel export has been disabled');
    }
    async exportManualPaymentTemplate(filter, res) {
        const buf = await this.summary4Service.exportManualPaymentTemplate(filter);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        const filename = `summary4-manual-template-${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.end(buf);
    }
    async importManualPayment(file) {
        if (!file) {
            throw new common_1.BadRequestException('Không tìm thấy file upload');
        }
        if (!file.originalname.match(/\.(xlsx|xls)$/)) {
            throw new common_1.BadRequestException('File phải có định dạng Excel (.xlsx hoặc .xls)');
        }
        return this.summary4Service.importManualPaymentFromExcel(file.buffer);
    }
    syncFromTestOrder2() {
        return this.summary4Service.syncFromTestOrder2();
    }
    syncSingleOrder(orderId) {
        return this.summary4Service.syncSingleOrder(orderId);
    }
    async syncToGoogle(agentId) {
        try {
            await this.summary4GoogleSyncService.syncAgentSummary4(agentId);
            return {
                success: true,
                message: 'Summary4 đã được đồng bộ lên Google Sheet',
                agentId
            };
        }
        catch (error) {
            return {
                success: false,
                message: 'Lỗi khi đồng bộ lên Google Sheet',
                error: (error === null || error === void 0 ? void 0 : error.message) || error,
                agentId
            };
        }
    }
    async syncAllToGoogle() {
        try {
            const result = await this.summary4GoogleSyncService.syncAllAgents();
            return Object.assign({ success: true, message: 'Đồng bộ tất cả đại lý hoàn thành' }, result);
        }
        catch (error) {
            return {
                success: false,
                message: 'Lỗi khi đồng bộ tất cả đại lý',
                error: (error === null || error === void 0 ? void 0 : error.message) || error
            };
        }
    }
    diagnostics() {
        if (process.env.ENABLE_SUMMARY4_MAINTENANCE !== 'true') {
            throw new common_1.ForbiddenException('Summary4 maintenance endpoints are disabled. Set ENABLE_SUMMARY4_MAINTENANCE=true to enable.');
        }
        return this.summary4Service.diagnostics();
    }
    fixDuplicates() {
        if (process.env.ENABLE_SUMMARY4_MAINTENANCE !== 'true') {
            throw new common_1.ForbiddenException('Summary4 maintenance endpoints are disabled. Set ENABLE_SUMMARY4_MAINTENANCE=true to enable.');
        }
        return this.summary4Service.fixDuplicates();
    }
    cleanupOrphanedRecords(options) {
        if (process.env.ENABLE_SUMMARY4_MAINTENANCE !== 'true') {
            throw new common_1.ForbiddenException('Summary4 maintenance endpoints are disabled. Set ENABLE_SUMMARY4_MAINTENANCE=true to enable.');
        }
        return this.summary4Service.cleanupOrphanedRecords(options);
    }
    emergencyCleanupOrphanedRecords(options) {
        return this.summary4Service.cleanupOrphanedRecords(options);
    }
    findOne(id) {
        return this.summary4Service.findOne(id);
    }
    async updateManualPayment(id, updateDto) {
        const updatedSummary = await this.summary4Service.updateManualPayment(id, updateDto);
        try {
            const agentId = updatedSummary.agentId.toString();
            this.summary4GoogleSyncService.scheduleSyncAgent(agentId, 2000);
        }
        catch (error) {
            console.warn('Failed to schedule Google sync after manual payment update:', error);
        }
        return updatedSummary;
    }
    clearAll() {
        return this.summary4Service.clearAll();
    }
};
exports.Summary4Controller = Summary4Controller;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)(new common_1.ValidationPipe({ transform: true, whitelist: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [summary4_filter_dto_1.Summary4FilterDto]),
    __metadata("design:returntype", void 0)
], Summary4Controller.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('export'),
    __param(0, (0, common_1.Res)()),
    __param(1, (0, common_1.Query)(new common_1.ValidationPipe({ transform: true, whitelist: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, summary4_filter_dto_1.Summary4FilterDto]),
    __metadata("design:returntype", Promise)
], Summary4Controller.prototype, "exportExcel", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Summary4Controller.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('agents'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Summary4Controller.prototype, "getAgents", null);
__decorate([
    (0, common_1.Get)('export-unpaid'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [summary4_filter_dto_1.Summary4FilterDto, Object]),
    __metadata("design:returntype", Promise)
], Summary4Controller.prototype, "exportUnpaidToExcel", null);
__decorate([
    (0, common_1.Get)('export-manual-payment-template'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [summary4_filter_dto_1.Summary4FilterDto, Object]),
    __metadata("design:returntype", Promise)
], Summary4Controller.prototype, "exportManualPaymentTemplate", null);
__decorate([
    (0, common_1.Post)('import-manual-payment'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], Summary4Controller.prototype, "importManualPayment", null);
__decorate([
    (0, common_1.Post)('sync'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Summary4Controller.prototype, "syncFromTestOrder2", null);
__decorate([
    (0, common_1.Post)('sync-single/:orderId'),
    __param(0, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], Summary4Controller.prototype, "syncSingleOrder", null);
__decorate([
    (0, common_1.Post)('sync-google/:agentId'),
    __param(0, (0, common_1.Param)('agentId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], Summary4Controller.prototype, "syncToGoogle", null);
__decorate([
    (0, common_1.Post)('sync-google-all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], Summary4Controller.prototype, "syncAllToGoogle", null);
__decorate([
    (0, common_1.Get)('diagnostics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Summary4Controller.prototype, "diagnostics", null);
__decorate([
    (0, common_1.Post)('fix-duplicates'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Summary4Controller.prototype, "fixDuplicates", null);
__decorate([
    (0, common_1.Post)('cleanup-orphaned'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], Summary4Controller.prototype, "cleanupOrphanedRecords", null);
__decorate([
    (0, common_1.Post)('emergency-cleanup'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], Summary4Controller.prototype, "emergencyCleanupOrphanedRecords", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], Summary4Controller.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/manual-payment'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(new common_1.ValidationPipe({ transform: true, whitelist: true }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_manual_payment_dto_1.UpdateManualPaymentDto]),
    __metadata("design:returntype", Promise)
], Summary4Controller.prototype, "updateManualPayment", null);
__decorate([
    (0, common_1.Delete)('clear-all'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Summary4Controller.prototype, "clearAll", null);
exports.Summary4Controller = Summary4Controller = __decorate([
    (0, common_1.Controller)('summary4'),
    __metadata("design:paramtypes", [summary4_service_1.Summary4Service,
        summary4_google_sync_service_1.Summary4GoogleSyncService])
], Summary4Controller);
//# sourceMappingURL=summary4.controller.js.map