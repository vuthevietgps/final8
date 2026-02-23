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
exports.ProductProfitReportController = void 0;
const common_1 = require("@nestjs/common");
const product_profit_report_service_1 = require("./product-profit-report.service");
const auth_guard_1 = require("../auth/guards/auth.guard");
const auth_decorator_1 = require("../auth/decorators/auth.decorator");
let ProductProfitReportController = class ProductProfitReportController {
    constructor(productProfitReportService) {
        this.productProfitReportService = productProfitReportService;
    }
    async getProductProfitReport(from, to, productName) {
        return this.productProfitReportService.getProductProfitReport({ from, to, productName });
    }
    async getAvailableYears() {
        const years = await this.productProfitReportService.getAvailableYears();
        return { years };
    }
    async getSummary(from, to, productName) {
        const report = await this.productProfitReportService.getProductProfitReport({ from, to, productName });
        return {
            summary: report.summary,
            productCount: report.data.length,
            dateRange: {
                from: report.dateRange.from,
                to: report.dateRange.to,
                totalDays: report.dates.length
            }
        };
    }
};
exports.ProductProfitReportController = ProductProfitReportController;
__decorate([
    (0, common_1.Get)(),
    (0, auth_decorator_1.RequirePermissions)('reports'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('productName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ProductProfitReportController.prototype, "getProductProfitReport", null);
__decorate([
    (0, common_1.Get)('years'),
    (0, auth_decorator_1.RequirePermissions)('reports'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProductProfitReportController.prototype, "getAvailableYears", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, auth_decorator_1.RequirePermissions)('reports'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('productName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ProductProfitReportController.prototype, "getSummary", null);
exports.ProductProfitReportController = ProductProfitReportController = __decorate([
    (0, common_1.Controller)('product-profit-report'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, auth_guard_1.RolesGuard),
    __metadata("design:paramtypes", [product_profit_report_service_1.ProductProfitReportService])
], ProductProfitReportController);
//# sourceMappingURL=product-profit-report.controller.js.map