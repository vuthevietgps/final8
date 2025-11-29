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
exports.ProfitForecastController = void 0;
const common_1 = require("@nestjs/common");
const profit_forecast_service_1 = require("./profit-forecast.service");
let ProfitForecastController = class ProfitForecastController {
    constructor(service) {
        this.service = service;
    }
    async forecastAdGroup(from, to, adGroupId) {
        return this.service.forecastByAdGroup({ from, to, adGroupId });
    }
    async forecastAdGroupWithCost(from, to, adGroupId) {
        return this.service.forecastWithCost({ from, to, adGroupId });
    }
    async summary(from, to, adGroupId) { return this.service.summaryAggregate({ from, to, adGroupId }); }
    async listSnapshots(from, to, adGroupId) { return this.service.listSnapshots({ from, to, adGroupId }); }
    async runSnapshot(from, to, adGroupId) { return this.service.upsertSnapshots({ from, to, adGroupId }); }
    async recommendedBudget(from, to, adGroupId, days) { return this.service.recommendedBudget({ from, to, adGroupId, days: days ? +days : undefined }); }
};
exports.ProfitForecastController = ProfitForecastController;
__decorate([
    (0, common_1.Get)('ad-group'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('adGroupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ProfitForecastController.prototype, "forecastAdGroup", null);
__decorate([
    (0, common_1.Get)('ad-group-with-cost'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('adGroupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ProfitForecastController.prototype, "forecastAdGroupWithCost", null);
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('adGroupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ProfitForecastController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('snapshots'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('adGroupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ProfitForecastController.prototype, "listSnapshots", null);
__decorate([
    (0, common_1.Get)('snapshot/run'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('adGroupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], ProfitForecastController.prototype, "runSnapshot", null);
__decorate([
    (0, common_1.Get)('recommended-budget'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __param(2, (0, common_1.Query)('adGroupId')),
    __param(3, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String]),
    __metadata("design:returntype", Promise)
], ProfitForecastController.prototype, "recommendedBudget", null);
exports.ProfitForecastController = ProfitForecastController = __decorate([
    (0, common_1.Controller)('profit-forecast'),
    __metadata("design:paramtypes", [profit_forecast_service_1.ProfitForecastService])
], ProfitForecastController);
//# sourceMappingURL=profit-forecast.controller.js.map