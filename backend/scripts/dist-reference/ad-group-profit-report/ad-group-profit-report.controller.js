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
exports.AdGroupProfitReportController = void 0;
const common_1 = require("@nestjs/common");
const ad_group_profit_report_service_1 = require("./ad-group-profit-report.service");
const ad_group_profit_filter_dto_1 = require("./dto/ad-group-profit-filter.dto");
const auth_guard_1 = require("../auth/guards/auth.guard");
const auth_decorator_1 = require("../auth/decorators/auth.decorator");
let AdGroupProfitReportController = class AdGroupProfitReportController {
    constructor(adGroupProfitReportService) {
        this.adGroupProfitReportService = adGroupProfitReportService;
    }
    async getAdGroupProfitReport(filterDto) {
        return this.adGroupProfitReportService.getAdGroupProfitReport(filterDto);
    }
    async getAvailableYears() {
        const years = await this.adGroupProfitReportService.getAvailableYears();
        return { years };
    }
    async getSummary(filterDto) {
        const report = await this.adGroupProfitReportService.getAdGroupProfitReport(filterDto);
        return {
            summary: report.summary,
            adGroupCount: report.adGroups.length,
            dateRange: {
                from: report.dates[0] || null,
                to: report.dates[report.dates.length - 1] || null,
                totalDays: report.dates.length
            }
        };
    }
};
exports.AdGroupProfitReportController = AdGroupProfitReportController;
__decorate([
    (0, common_1.Get)(),
    (0, auth_decorator_1.RequirePermissions)('reports'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ad_group_profit_filter_dto_1.AdGroupProfitFilterDto]),
    __metadata("design:returntype", Promise)
], AdGroupProfitReportController.prototype, "getAdGroupProfitReport", null);
__decorate([
    (0, common_1.Get)('years'),
    (0, auth_decorator_1.RequirePermissions)('reports'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdGroupProfitReportController.prototype, "getAvailableYears", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, auth_decorator_1.RequirePermissions)('reports'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ad_group_profit_filter_dto_1.AdGroupProfitFilterDto]),
    __metadata("design:returntype", Promise)
], AdGroupProfitReportController.prototype, "getSummary", null);
exports.AdGroupProfitReportController = AdGroupProfitReportController = __decorate([
    (0, common_1.Controller)('ad-group-profit-report'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, auth_guard_1.RolesGuard),
    __metadata("design:paramtypes", [ad_group_profit_report_service_1.AdGroupProfitReportService])
], AdGroupProfitReportController);
//# sourceMappingURL=ad-group-profit-report.controller.js.map