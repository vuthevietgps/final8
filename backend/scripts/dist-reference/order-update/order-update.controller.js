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
exports.OrderUpdateController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const order_update_service_1 = require("./order-update.service");
let OrderUpdateController = class OrderUpdateController {
    constructor(orderUpdateService) {
        this.orderUpdateService = orderUpdateService;
    }
    async updateOrdersFromExcel(file) {
        if (!file) {
            throw new common_1.BadRequestException('Vui lòng chọn file Excel để tải lên');
        }
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel'
        ];
        if (!allowedMimes.includes(file.mimetype)) {
            throw new common_1.BadRequestException('Chỉ chấp nhận file Excel (.xlsx hoặc .xls)');
        }
        if (file.size > 10 * 1024 * 1024) {
            throw new common_1.BadRequestException('File không được vượt quá 10MB');
        }
        try {
            const result = await this.orderUpdateService.processExcelFile(file);
            return result;
        }
        catch (error) {
            throw new common_1.BadRequestException(`Lỗi xử lý file Excel: ${error.message}`);
        }
    }
    async checkUpdateableOrders(file) {
        if (!file) {
            throw new common_1.BadRequestException('Vui lòng chọn file Excel để kiểm tra');
        }
        try {
            return await this.orderUpdateService.checkUpdateableStatus(file);
        }
        catch (error) {
            throw new common_1.BadRequestException(`Lỗi kiểm tra trạng thái: ${error.message}`);
        }
    }
    async previewExcelData(file) {
        if (!file) {
            throw new common_1.BadRequestException('Vui lòng chọn file Excel để preview');
        }
        try {
            return await this.orderUpdateService.previewExcelData(file);
        }
        catch (error) {
            throw new common_1.BadRequestException(`Lỗi preview Excel: ${error.message}`);
        }
    }
};
exports.OrderUpdateController = OrderUpdateController;
__decorate([
    (0, common_1.Post)('excel'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrderUpdateController.prototype, "updateOrdersFromExcel", null);
__decorate([
    (0, common_1.Post)('check-status'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrderUpdateController.prototype, "checkUpdateableOrders", null);
__decorate([
    (0, common_1.Post)('preview'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], OrderUpdateController.prototype, "previewExcelData", null);
exports.OrderUpdateController = OrderUpdateController = __decorate([
    (0, common_1.Controller)('order-update'),
    __metadata("design:paramtypes", [order_update_service_1.OrderUpdateService])
], OrderUpdateController);
//# sourceMappingURL=order-update.controller.js.map