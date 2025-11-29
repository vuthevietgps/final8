"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvertisingOptimizationModule = void 0;
const common_1 = require("@nestjs/common");
const quality_control_module_1 = require("./quality-control/quality-control.module");
const ai_optimization_module_1 = require("./ai-optimization/ai-optimization.module");
const advanced_analytics_module_1 = require("./advanced-analytics/advanced-analytics.module");
let AdvertisingOptimizationModule = class AdvertisingOptimizationModule {
};
exports.AdvertisingOptimizationModule = AdvertisingOptimizationModule;
exports.AdvertisingOptimizationModule = AdvertisingOptimizationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            quality_control_module_1.QualityControlModule,
            ai_optimization_module_1.AIOptimizationModule,
            advanced_analytics_module_1.AdvancedAnalyticsModule
        ],
        exports: [
            quality_control_module_1.QualityControlModule,
            ai_optimization_module_1.AIOptimizationModule,
            advanced_analytics_module_1.AdvancedAnalyticsModule
        ]
    })
], AdvertisingOptimizationModule);
//# sourceMappingURL=advertising-optimization.module.js.map