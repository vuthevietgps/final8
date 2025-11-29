"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIOptimizationModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const ai_optimization_service_1 = require("./ai-optimization.service");
const advertising_cost_suggestion_schema_1 = require("../../advertising-cost-suggestion/schemas/advertising-cost-suggestion.schema");
const openai_config_module_1 = require("../../openai-config/openai-config.module");
const ad_group_profit_module_1 = require("../../ad-group-profit/ad-group-profit.module");
const quality_control_module_1 = require("../quality-control/quality-control.module");
const advanced_analytics_module_1 = require("../advanced-analytics/advanced-analytics.module");
let AIOptimizationModule = class AIOptimizationModule {
};
exports.AIOptimizationModule = AIOptimizationModule;
exports.AIOptimizationModule = AIOptimizationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: advertising_cost_suggestion_schema_1.AdvertisingCostSuggestion.name, schema: advertising_cost_suggestion_schema_1.AdvertisingCostSuggestionSchema }
            ]),
            openai_config_module_1.OpenAIConfigModule,
            ad_group_profit_module_1.AdGroupProfitModule,
            quality_control_module_1.QualityControlModule,
            advanced_analytics_module_1.AdvancedAnalyticsModule
        ],
        providers: [ai_optimization_service_1.AIOptimizationService],
        exports: [ai_optimization_service_1.AIOptimizationService]
    })
], AIOptimizationModule);
//# sourceMappingURL=ai-optimization.module.js.map