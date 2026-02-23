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
var Summary4PaymentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summary4PaymentService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const XLSX = require("xlsx");
const summary4_schema_1 = require("./schemas/summary4.schema");
const summary5_service_1 = require("../summary5/summary5.service");
const summary4_google_sync_service_1 = require("./summary4-google-sync.service");
const summary4_query_util_1 = require("./summary4-query.util");
let Summary4PaymentService = Summary4PaymentService_1 = class Summary4PaymentService {
    constructor(summary4Model, summary5Service, summary4GoogleSyncService) {
        this.summary4Model = summary4Model;
        this.summary5Service = summary5Service;
        this.summary4GoogleSyncService = summary4GoogleSyncService;
        this.logger = new common_1.Logger(Summary4PaymentService_1.name);
    }
    async updateManualPayment(id, updateDto) {
        var _a;
        const summary = await this.summary4Model.findById(id).exec();
        if (!summary)
            throw new common_1.NotFoundException(`Summary4 với ID ${id} không tìm thấy`);
        if (updateDto.manualPayment !== undefined) {
            summary.manualPayment = updateDto.manualPayment;
            summary.needToPay = summary.paidToCompany - summary.mustPayToCompany - summary.manualPayment;
        }
        await summary.save();
        try {
            const d = new Date(summary.orderDate);
            const startDate = new Date(d);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(d);
            endDate.setHours(23, 59, 59, 999);
            await this.summary5Service.sync({ startDate: startDate.toISOString(), endDate: endDate.toISOString() });
        }
        catch (e) {
            this.logger.warn(`Summary5 sync failed after manualPayment update: ${(e === null || e === void 0 ? void 0 : e.message) || e}`);
        }
        try {
            const agentId = (_a = summary.agentId) === null || _a === void 0 ? void 0 : _a.toString();
            if (agentId) {
                this.summary4GoogleSyncService.scheduleSyncAgent(agentId, 2000);
            }
        }
        catch (e) {
            this.logger.warn('Failed to schedule Google sync after manual payment update:', e);
        }
        return summary;
    }
    async importManualPaymentFromExcel(fileBuffer) {
        this.logger.log('Bắt đầu import thanh toán tay từ Excel...');
        const result = { processed: 0, updated: 0, errors: [] };
        try {
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            if (rawData.length < 2)
                throw new Error('File Excel không có dữ liệu hoặc chỉ có header');
            const headerRow = rawData[0];
            const idIndex = headerRow.findIndex((h) => h === '_id');
            const manualPaymentIndex = headerRow.findIndex((h) => h === 'manualPayment');
            if (idIndex === -1)
                throw new Error('Không tìm thấy cột _id trong file Excel');
            if (manualPaymentIndex === -1)
                throw new Error('Không tìm thấy cột manualPayment trong file Excel');
            const dataRows = rawData.slice(2);
            for (let i = 0; i < dataRows.length; i++) {
                const row = dataRows[i];
                result.processed++;
                try {
                    const id = row[idIndex];
                    const manualPayment = row[manualPaymentIndex];
                    if (!id) {
                        result.errors.push(`Dòng ${i + 3}: Thiếu _id`);
                        continue;
                    }
                    if (manualPayment === undefined || manualPayment === null) {
                        result.errors.push(`Dòng ${i + 3}: Thiếu manualPayment`);
                        continue;
                    }
                    const manualPaymentValue = Number(manualPayment);
                    if (isNaN(manualPaymentValue)) {
                        result.errors.push(`Dòng ${i + 3}: manualPayment phải là số (hiện tại: ${manualPayment})`);
                        continue;
                    }
                    const summary = await this.summary4Model.findById(id).exec();
                    if (!summary) {
                        result.errors.push(`Dòng ${i + 3}: Không tìm thấy record với _id: ${id}`);
                        continue;
                    }
                    summary.manualPayment = manualPaymentValue;
                    summary.needToPay = summary.paidToCompany - summary.mustPayToCompany - manualPaymentValue;
                    await summary.save();
                    result.updated++;
                }
                catch (error) {
                    result.errors.push(`Dòng ${i + 3}: ${error.message}`);
                }
            }
            try {
                await this.summary5Service.sync({});
            }
            catch (e) {
                this.logger.warn(`Summary5 sync failed after manual payment import: ${(e === null || e === void 0 ? void 0 : e.message) || e}`);
            }
            this.logger.log(`Hoàn thành import: ${result.updated}/${result.processed} bản ghi được cập nhật`);
            return result;
        }
        catch (error) {
            this.logger.error('Lỗi import thanh toán tay:', error);
            result.errors.push(`Lỗi chung: ${error.message}`);
            return result;
        }
    }
    async exportManualPaymentTemplate(filter = {}) {
        const query = (0, summary4_query_util_1.buildQueryFromFilter)(filter);
        const sort = (0, summary4_query_util_1.buildSortFromFilter)(filter);
        const rows = await this.summary4Model.find(query).sort(sort).lean().exec();
        const header = [
            '_id',
            'manualPayment',
            'orderDate', 'customerName', 'product', 'quantity', 'agentName',
            'mustPayToCompany', 'paidToCompany', 'needToPay', 'currentManualPayment', 'note'
        ];
        const instruction = [
            'KHÔNG SỬA CỘT NÀY',
            'Nhập số tiền thanh toán tay (có thể âm, số) – để trống nếu không đổi',
            'Ngày đơn hàng', 'Tên KH', 'Sản phẩm', 'SL', 'Đại lý',
            'Phải trả CT', 'Đã trả CT', 'Cần thanh toán', 'Giá trị hiện tại', 'Ghi chú tuỳ chọn'
        ];
        const data = rows.map((r) => {
            var _a, _b, _c, _d, _e, _f, _g;
            return ([
                ((_a = r._id) === null || _a === void 0 ? void 0 : _a.toString()) || '',
                (_b = r.manualPayment) !== null && _b !== void 0 ? _b : 0,
                r.orderDate ? new Date(r.orderDate).toISOString().slice(0, 10) : '',
                r.customerName || '',
                r.product || '',
                (_c = r.quantity) !== null && _c !== void 0 ? _c : 0,
                r.agentName || '',
                (_d = r.mustPayToCompany) !== null && _d !== void 0 ? _d : 0,
                (_e = r.paidToCompany) !== null && _e !== void 0 ? _e : 0,
                (_f = r.needToPay) !== null && _f !== void 0 ? _f : 0,
                (_g = r.manualPayment) !== null && _g !== void 0 ? _g : 0,
                ''
            ]);
        });
        const sheetData = [header, instruction, ...data];
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ManualPayment');
        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
};
exports.Summary4PaymentService = Summary4PaymentService;
exports.Summary4PaymentService = Summary4PaymentService = Summary4PaymentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(summary4_schema_1.Summary4.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        summary5_service_1.Summary5Service,
        summary4_google_sync_service_1.Summary4GoogleSyncService])
], Summary4PaymentService);
//# sourceMappingURL=summary4-payment.service.js.map