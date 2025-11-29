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
var OrderUpdateService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderUpdateService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const XLSX = require("xlsx");
const test_order2_schema_1 = require("../test-order2/schemas/test-order2.schema");
let OrderUpdateService = OrderUpdateService_1 = class OrderUpdateService {
    constructor(testOrder2Model) {
        this.testOrder2Model = testOrder2Model;
    }
    async processExcelFile(file) {
        try {
            const workbook = XLSX.read(file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            const dataRows = rawData.slice(1);
            const excelData = this.parseExcelData(dataRows);
            const groupedData = this.groupByTrackingNumber(excelData);
            const result = await this.updateOrdersFromGroupedData(groupedData);
            return result;
        }
        catch (error) {
            console.error('❌ Lỗi xử lý file Excel:', error);
            throw new common_1.BadRequestException(`Lỗi đọc file Excel: ${error.message}`);
        }
    }
    async checkUpdateableStatus(file) {
        try {
            const workbook = XLSX.read(file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            const dataRows = rawData.slice(1);
            const excelData = this.parseExcelData(dataRows);
            const trackingNumbers = [...new Set(excelData.map(item => item.trackingNumber))];
            let updatable = 0;
            let completed = 0;
            let notFound = 0;
            for (const trackingNumber of trackingNumbers) {
                const digitsOnly = /^[0-9]+$/.test(trackingNumber) ? trackingNumber.replace(/^0+/, '') : null;
                const findFilter = digitsOnly
                    ? { $or: [
                            { trackingNumber },
                            { trackingNumber: { $regex: `^0*${digitsOnly}$` } }
                        ] }
                    : { trackingNumber };
                const orders = await this.testOrder2Model.find(findFilter).lean();
                if (orders.length === 0) {
                    notFound++;
                }
                else {
                    updatable++;
                }
            }
            return {
                updatable,
                completed,
                notFound,
                total: trackingNumbers.length
            };
        }
        catch (error) {
            throw new common_1.BadRequestException(`Lỗi kiểm tra trạng thái: ${error.message}`);
        }
    }
    parseExcelData(dataRows) {
        const result = [];
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            try {
                const trackingNumber = this.getCellValue(row, OrderUpdateService_1.COL.B_trackingNumber);
                const receiverName = this.getCellValue(row, OrderUpdateService_1.COL.K_receiverName);
                const receiverAddress = this.getCellValue(row, OrderUpdateService_1.COL.L_receiverAddress);
                const receiverPhone = this.getCellValue(row, OrderUpdateService_1.COL.M_receiverPhone);
                const codAmountRaw = this.getCellValue(row, OrderUpdateService_1.COL.R_codAmount);
                const orderStatus = this.getCellValue(row, OrderUpdateService_1.COL.AG_orderStatus);
                if (trackingNumber && i < 5) {
                    console.log(`🔍 Row ${i + 2}: Len=${row.length}, AG(32)="${orderStatus}", B(1)="${trackingNumber}"`);
                }
                if (!trackingNumber) {
                    continue;
                }
                let codAmount = 0;
                if (codAmountRaw) {
                    const parsed = parseFloat(String(codAmountRaw).replace(/[^0-9.-]/g, ''));
                    codAmount = isNaN(parsed) ? 0 : parsed;
                }
                const parsedItem = {
                    trackingNumber: this.normalize(String(trackingNumber)),
                    receiverName: this.normalize(receiverName),
                    receiverAddress: this.normalize(receiverAddress),
                    receiverPhone: this.normalize(receiverPhone),
                    codAmount: codAmount,
                    orderStatus: this.normalize(orderStatus)
                };
                if (parsedItem.trackingNumber) {
                }
                result.push(parsedItem);
            }
            catch (error) {
                console.warn(`⚠️ Lỗi parse dòng ${i + 2}:`, error.message);
            }
        }
        console.log(`✅ Parse thành công ${result.length} dòng dữ liệu hợp lệ`);
        return result;
    }
    getCellValue(row, index) {
        return row && row.length > index ? row[index] : null;
    }
    normalize(v) {
        if (v === null || v === undefined)
            return '';
        return String(v).trim().replace(/\s+/g, ' ');
    }
    groupByTrackingNumber(excelData) {
        const grouped = new Map();
        for (const item of excelData) {
            const key = item.trackingNumber;
            if (!grouped.has(key)) {
                grouped.set(key, []);
            }
            grouped.get(key).push(item);
        }
        const result = new Map();
        for (const [trackingNumber, items] of grouped) {
            const representative = Object.assign({}, items[0]);
            const totalCod = items.reduce((sum, item) => sum + (item.codAmount || 0), 0);
            representative.codAmount = totalCod;
            result.set(trackingNumber, representative);
        }
        return result;
    }
    async updateOrdersFromGroupedData(groupedData) {
        var _a, _b;
        const result = {
            successCount: 0,
            errorCount: 0,
            skippedCount: 0,
            totalProcessed: 0,
            successItems: [],
            errors: [],
            skippedItems: [],
            message: ''
        };
        for (const [trackingNumber, excelItem] of groupedData) {
            try {
                result.totalProcessed++;
                const digitsOnly = /^[0-9]+$/.test(trackingNumber) ? trackingNumber.replace(/^0+/, '') : null;
                const findFilter = digitsOnly
                    ? { $or: [
                            { trackingNumber },
                            { trackingNumber: { $regex: `^0*${digitsOnly}$` } }
                        ] }
                    : { trackingNumber };
                const orders = await this.testOrder2Model.find(findFilter).lean();
                if (orders.length === 0) {
                    result.errorCount++;
                    result.errors.push({
                        row: 0,
                        message: `Không tìm thấy đơn hàng với mã vận đơn: ${trackingNumber}`,
                        trackingNumber
                    });
                    continue;
                }
                const updatableOrders = orders;
                const codPerOrder = (excelItem.codAmount || 0) / orders.length;
                const updateSet = {};
                if (this.normalize(excelItem.receiverName))
                    updateSet.receiverName = this.normalize(excelItem.receiverName);
                if (this.normalize(excelItem.receiverPhone))
                    updateSet.receiverPhone = this.normalize(excelItem.receiverPhone);
                if (this.normalize(excelItem.receiverAddress))
                    updateSet.receiverAddress = this.normalize(excelItem.receiverAddress);
                const finalStatus = this.normalize(excelItem.orderStatus);
                if (finalStatus.length > 0)
                    updateSet.orderStatus = finalStatus;
                if (codPerOrder > 0)
                    updateSet.codAmount = Math.round(codPerOrder);
                if (Object.keys(updateSet).length === 0) {
                    result.skippedCount++;
                    result.skippedItems.push({
                        trackingNumber,
                        customerName: (_b = (_a = orders[0]) === null || _a === void 0 ? void 0 : _a.customerName) !== null && _b !== void 0 ? _b : '',
                        reason: 'Không có dữ liệu hợp lệ để cập nhật'
                    });
                }
                else {
                    try {
                        const updateFilter = findFilter;
                        const updateResult = await this.testOrder2Model.updateMany(updateFilter, { $set: updateSet });
                        result.successItems.push({
                            trackingNumber,
                            customerName: orders[0].customerName,
                            updatedFields: Object.keys(updateSet),
                            oldValues: {},
                            newValues: updateSet
                        });
                        result.successCount++;
                    }
                    catch (updateError) {
                        console.error(`❌ Update error for tracking ${trackingNumber}:`, updateError);
                        result.errorCount++;
                        result.errors.push({
                            row: 0,
                            message: `Lỗi cập nhật tracking ${trackingNumber}: ${updateError.message}`,
                            trackingNumber
                        });
                    }
                }
            }
            catch (error) {
                result.errorCount++;
                result.errors.push({
                    row: 0,
                    message: `Lỗi cập nhật tracking ${trackingNumber}: ${error.message}`,
                    trackingNumber
                });
                console.error(`❌ Lỗi cập nhật tracking ${trackingNumber}:`, error);
            }
        }
        result.message = this.generateSummaryMessage(result);
        return result;
    }
    async previewExcelData(file) {
        try {
            const workbook = XLSX.read(file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            const dataRows = rawData.slice(1);
            const excelData = this.parseExcelData(dataRows);
            const sampleData = excelData.slice(0, 10).map(item => ({
                trackingNumber: item.trackingNumber,
                receiverName: item.receiverName,
                receiverPhone: item.receiverPhone,
                receiverAddress: item.receiverAddress,
                codAmount: item.codAmount,
                orderStatus: item.orderStatus
            }));
            return {
                sampleData,
                totalRows: excelData.length,
                mappingInfo: {
                    'Cột B': 'Mã vận đơn (trackingNumber)',
                    'Cột K': 'Tên người nhận (receiverName)',
                    'Cột L': 'Địa chỉ (receiverAddress)',
                    'Cột M': 'Số điện thoại (receiverPhone)',
                    'Cột R': 'Số tiền COD (codAmount)',
                    'Cột AG': 'Trạng thái vận đơn (orderStatus)'
                }
            };
        }
        catch (error) {
            throw new common_1.BadRequestException(`Lỗi preview Excel: ${error.message}`);
        }
    }
    generateSummaryMessage(result) {
        const parts = [];
        if (result.successCount > 0) {
            parts.push(`${result.successCount} vận đơn cập nhật thành công`);
        }
        if (result.skippedCount > 0) {
            parts.push(`${result.skippedCount} vận đơn đã hoàn thành (bỏ qua)`);
        }
        if (result.errorCount > 0) {
            parts.push(`${result.errorCount} vận đơn có lỗi`);
        }
        return parts.length > 0
            ? parts.join(', ') + ` trong tổng ${result.totalProcessed} vận đơn.`
            : 'Không có dữ liệu để xử lý.';
    }
};
exports.OrderUpdateService = OrderUpdateService;
OrderUpdateService.COL = {
    B_trackingNumber: 1,
    K_receiverName: 10,
    L_receiverAddress: 11,
    M_receiverPhone: 12,
    R_codAmount: 17,
    AG_orderStatus: 32,
};
exports.OrderUpdateService = OrderUpdateService = OrderUpdateService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(test_order2_schema_1.TestOrder2.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], OrderUpdateService);
//# sourceMappingURL=order-update.service.js.map