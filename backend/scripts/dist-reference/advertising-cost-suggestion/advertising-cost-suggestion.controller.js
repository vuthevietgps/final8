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
exports.AdvertisingCostSuggestionController = void 0;
const common_1 = require("@nestjs/common");
const advertising_cost_suggestion_service_1 = require("./advertising-cost-suggestion.service");
const create_advertising_cost_suggestion_dto_1 = require("./dto/create-advertising-cost-suggestion.dto");
const update_advertising_cost_suggestion_dto_1 = require("./dto/update-advertising-cost-suggestion.dto");
let AdvertisingCostSuggestionController = class AdvertisingCostSuggestionController {
    constructor(suggestionService) {
        this.suggestionService = suggestionService;
    }
    async create(createDto) {
        const suggestion = await this.suggestionService.create(createDto);
        return {
            statusCode: common_1.HttpStatus.CREATED,
            message: 'Tạo đề xuất chi phí thành công',
            data: suggestion
        };
    }
    async findAll() {
        const suggestions = await this.suggestionService.findAll();
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Lấy danh sách đề xuất chi phí thành công',
            data: suggestions
        };
    }
    async getStatistics() {
        const stats = await this.suggestionService.getStatistics();
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Lấy thống kê thành công',
            data: stats
        };
    }
    async getQualityOverview() {
        const overview = await this.suggestionService.getSystemQualityOverview();
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Lấy tổng quan chất lượng hệ thống thành công',
            data: overview
        };
    }
    async getAdGroupQualityReport(adGroupId) {
        const report = await this.suggestionService.getAdGroupQualityReport(adGroupId);
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Lấy báo cáo chất lượng nhóm quảng cáo thành công',
            data: report
        };
    }
    async triggerValidation() {
        await this.suggestionService.triggerValidation();
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Kích hoạt validation thành công'
        };
    }
    async manualAIOptimization() {
        await this.suggestionService.triggerAIOptimization();
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Kích hoạt AI optimization thủ công thành công'
        };
    }
    async manualAdvancedOptimization(body) {
        await this.suggestionService.triggerAdvancedOptimization(body.adGroupId);
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Kích hoạt Advanced Mathematical Optimization thành công',
            data: {
                targetAdGroup: body.adGroupId || 'all',
                algorithmsUsed: ['Non-linear Regression', 'Random Forest', 'Bayesian Optimization', 'Ensemble Methods']
            }
        };
    }
    async findOne(id) {
        const suggestion = await this.suggestionService.findOne(id);
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Lấy thông tin đề xuất chi phí thành công',
            data: suggestion
        };
    }
    async findByAdGroupId(adGroupId) {
        const suggestion = await this.suggestionService.findByAdGroupId(adGroupId);
        return {
            statusCode: common_1.HttpStatus.OK,
            message: suggestion ? 'Tìm thấy đề xuất chi phí' : 'Không tìm thấy đề xuất chi phí',
            data: suggestion
        };
    }
    async update(id, updateDto) {
        const suggestion = await this.suggestionService.update(id, updateDto);
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Cập nhật đề xuất chi phí thành công',
            data: suggestion
        };
    }
    async updateDailyCost(adGroupId, dailyCost) {
        const suggestion = await this.suggestionService.updateDailyCost(adGroupId, dailyCost);
        return {
            statusCode: common_1.HttpStatus.OK,
            message: suggestion ? 'Cập nhật chi phí hàng ngày thành công' : 'Không tìm thấy đề xuất chi phí',
            data: suggestion
        };
    }
    async remove(id) {
        await this.suggestionService.remove(id);
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Xóa đề xuất chi phí thành công'
        };
    }
    async triggerAIOptimization() {
        await this.suggestionService.triggerAIOptimization();
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'AI optimization đã được kích hoạt thành công'
        };
    }
    async toggleAutoMode(adGroupId, enabled) {
        return {
            statusCode: common_1.HttpStatus.OK,
            message: `Auto mode toggle not implemented yet for ad group ${adGroupId}`
        };
    }
    async getPendingRecommendations() {
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Pending recommendations not implemented yet',
            data: []
        };
    }
    async approveRecommendation(id) {
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'Recommendation approval not implemented yet',
            data: { success: false }
        };
    }
};
exports.AdvertisingCostSuggestionController = AdvertisingCostSuggestionController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_advertising_cost_suggestion_dto_1.CreateAdvertisingCostSuggestionDto]),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('statistics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "getStatistics", null);
__decorate([
    (0, common_1.Get)('quality-control/overview'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "getQualityOverview", null);
__decorate([
    (0, common_1.Get)('quality-control/:adGroupId'),
    __param(0, (0, common_1.Param)('adGroupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "getAdGroupQualityReport", null);
__decorate([
    (0, common_1.Post)('quality-control/validate'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "triggerValidation", null);
__decorate([
    (0, common_1.Post)('ai-optimization/manual-trigger'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "manualAIOptimization", null);
__decorate([
    (0, common_1.Post)('advanced-optimization/manual-trigger'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "manualAdvancedOptimization", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)('ad-group/:adGroupId'),
    __param(0, (0, common_1.Param)('adGroupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "findByAdGroupId", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_advertising_cost_suggestion_dto_1.UpdateAdvertisingCostSuggestionDto]),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)('daily-cost/:adGroupId'),
    __param(0, (0, common_1.Param)('adGroupId')),
    __param(1, (0, common_1.Body)('dailyCost')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number]),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "updateDailyCost", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('ai/manual-trigger'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "triggerAIOptimization", null);
__decorate([
    (0, common_1.Post)('auto-mode/:adGroupId'),
    __param(0, (0, common_1.Param)('adGroupId')),
    __param(1, (0, common_1.Body)('enabled')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Boolean]),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "toggleAutoMode", null);
__decorate([
    (0, common_1.Get)('recommendations/pending'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "getPendingRecommendations", null);
__decorate([
    (0, common_1.Post)('recommendations/:id/approve'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdvertisingCostSuggestionController.prototype, "approveRecommendation", null);
exports.AdvertisingCostSuggestionController = AdvertisingCostSuggestionController = __decorate([
    (0, common_1.Controller)('advertising-cost-suggestion'),
    __metadata("design:paramtypes", [advertising_cost_suggestion_service_1.AdvertisingCostSuggestionService])
], AdvertisingCostSuggestionController);
//# sourceMappingURL=advertising-cost-suggestion.controller.js.map