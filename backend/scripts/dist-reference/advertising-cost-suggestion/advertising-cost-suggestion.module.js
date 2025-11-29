"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvertisingCostSuggestionModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const advertising_cost_suggestion_service_1 = require("./advertising-cost-suggestion.service");
const advertising_cost_suggestion_controller_1 = require("./advertising-cost-suggestion.controller");
const advertising_cost_suggestion_schema_1 = require("./schemas/advertising-cost-suggestion.schema");
const openai_config_module_1 = require("../openai-config/openai-config.module");
const ad_group_profit_module_1 = require("../ad-group-profit/ad-group-profit.module");
const delivery_status_module_1 = require("../delivery-status/delivery-status.module");
const quality_control_module_1 = require("../advertising-optimization/quality-control/quality-control.module");
const ai_optimization_module_1 = require("../advertising-optimization/ai-optimization/ai-optimization.module");
let AdvertisingCostSuggestionModule = class AdvertisingCostSuggestionModule {
};
exports.AdvertisingCostSuggestionModule = AdvertisingCostSuggestionModule;
exports.AdvertisingCostSuggestionModule = AdvertisingCostSuggestionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: advertising_cost_suggestion_schema_1.AdvertisingCostSuggestion.name, schema: advertising_cost_suggestion_schema_1.AdvertisingCostSuggestionSchema }
            ]),
            openai_config_module_1.OpenAIConfigModule,
            ad_group_profit_module_1.AdGroupProfitModule,
            delivery_status_module_1.DeliveryStatusModule,
            quality_control_module_1.QualityControlModule,
            ai_optimization_module_1.AIOptimizationModule
        ],
        controllers: [advertising_cost_suggestion_controller_1.AdvertisingCostSuggestionController],
        providers: [advertising_cost_suggestion_service_1.AdvertisingCostSuggestionService],
        exports: [advertising_cost_suggestion_service_1.AdvertisingCostSuggestionService]
    })
], AdvertisingCostSuggestionModule);
//# sourceMappingURL=advertising-cost-suggestion.module.js.map