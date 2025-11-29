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
var AdvertisingCostSuggestionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvertisingCostSuggestionService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const advertising_cost_suggestion_schema_1 = require("./schemas/advertising-cost-suggestion.schema");
const quality_control_service_1 = require("../advertising-optimization/quality-control/quality-control.service");
const ai_optimization_service_1 = require("../advertising-optimization/ai-optimization/ai-optimization.service");
let AdvertisingCostSuggestionService = AdvertisingCostSuggestionService_1 = class AdvertisingCostSuggestionService {
    constructor(suggestionModel, qualityControlService, aiOptimizationService) {
        this.suggestionModel = suggestionModel;
        this.qualityControlService = qualityControlService;
        this.aiOptimizationService = aiOptimizationService;
        this.logger = new common_1.Logger(AdvertisingCostSuggestionService_1.name);
    }
    async create(createDto) {
        const createdSuggestion = new this.suggestionModel(Object.assign(Object.assign({}, createDto), { dailyCost: createDto.dailyCost || 0 }));
        return createdSuggestion.save();
    }
    async findAll() {
        return this.suggestionModel
            .find({ isActive: { $ne: false } })
            .sort({ createdAt: -1 })
            .exec();
    }
    async findOne(id) {
        const suggestion = await this.suggestionModel.findById(id).exec();
        if (!suggestion) {
            throw new common_1.NotFoundException(`Không tìm thấy đề xuất chi phí với ID ${id}`);
        }
        return suggestion;
    }
    async update(id, updateDto) {
        const updatedSuggestion = await this.suggestionModel
            .findByIdAndUpdate(id, updateDto, { new: true })
            .exec();
        if (!updatedSuggestion) {
            throw new common_1.NotFoundException(`Không tìm thấy đề xuất chi phí với ID ${id}`);
        }
        return updatedSuggestion;
    }
    async remove(id) {
        const result = await this.suggestionModel.findByIdAndDelete(id).exec();
        if (!result) {
            throw new common_1.NotFoundException(`Không tìm thấy đề xuất chi phí với ID ${id}`);
        }
    }
    async updateDailyCost(adGroupId, dailyCost) {
        const suggestion = await this.suggestionModel
            .findOne({ adGroupId })
            .exec();
        if (suggestion) {
            suggestion.dailyCost = dailyCost;
            return suggestion.save();
        }
        return null;
    }
    async findByAdGroupId(adGroupId) {
        return this.suggestionModel
            .findOne({ adGroupId })
            .exec();
    }
    async getStatistics() {
        const totalSuggestions = await this.suggestionModel.countDocuments({ isActive: { $ne: false } });
        const activeSuggestions = await this.suggestionModel.countDocuments({ isActive: true });
        const pipeline = [
            { $match: { isActive: { $ne: false } } },
            {
                $group: {
                    _id: null,
                    totalSuggestedCost: { $sum: '$suggestedCost' },
                    totalDailyCost: { $sum: '$dailyCost' },
                    averageSuggestedCost: { $avg: '$suggestedCost' },
                    averageDailyCost: { $avg: '$dailyCost' },
                    totalDifference: { $sum: '$dailyDifference' }
                }
            }
        ];
        const stats = await this.suggestionModel.aggregate(pipeline);
        return Object.assign({ totalSuggestions,
            activeSuggestions }, (stats[0] || {
            totalSuggestedCost: 0,
            totalDailyCost: 0,
            averageSuggestedCost: 0,
            averageDailyCost: 0,
            totalDifference: 0
        }));
    }
    async syncAllDailyCosts(dailyCostsMap) {
        const suggestions = await this.suggestionModel.find({ isActive: { $ne: false } });
        for (const suggestion of suggestions) {
            const dailyCost = dailyCostsMap.get(suggestion.adGroupId) || 0;
            if (suggestion.dailyCost !== dailyCost) {
                suggestion.dailyCost = dailyCost;
                await suggestion.save();
            }
        }
    }
    async triggerAIOptimization() {
        await this.aiOptimizationService.runAIOptimization();
    }
    async triggerAdvancedOptimization(adGroupId) {
        await this.aiOptimizationService.runAdvancedOptimization(adGroupId);
    }
    async triggerValidation() {
        await this.qualityControlService.validatePastPredictions();
    }
    async getAdGroupQualityReport(adGroupId) {
        return this.qualityControlService.getAdGroupQualityReport(adGroupId);
    }
    async getSystemQualityOverview() {
        return this.qualityControlService.getSystemQualityOverview();
    }
};
exports.AdvertisingCostSuggestionService = AdvertisingCostSuggestionService;
exports.AdvertisingCostSuggestionService = AdvertisingCostSuggestionService = AdvertisingCostSuggestionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(advertising_cost_suggestion_schema_1.AdvertisingCostSuggestion.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        quality_control_service_1.QualityControlService,
        ai_optimization_service_1.AIOptimizationService])
], AdvertisingCostSuggestionService);
//# sourceMappingURL=advertising-cost-suggestion.service.js.map