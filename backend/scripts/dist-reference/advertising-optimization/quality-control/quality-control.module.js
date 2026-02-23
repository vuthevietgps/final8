"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityControlModule = void 0;
const common_1 = require("@nestjs/common");
const quality_control_service_1 = require("./quality-control.service");
const delivery_status_module_1 = require("../../delivery-status/delivery-status.module");
const ad_group_profit_module_1 = require("../../ad-group-profit/ad-group-profit.module");
let QualityControlModule = class QualityControlModule {
};
exports.QualityControlModule = QualityControlModule;
exports.QualityControlModule = QualityControlModule = __decorate([
    (0, common_1.Module)({
        imports: [
            delivery_status_module_1.DeliveryStatusModule,
            ad_group_profit_module_1.AdGroupProfitModule
        ],
        providers: [quality_control_service_1.QualityControlService],
        exports: [quality_control_service_1.QualityControlService]
    })
], QualityControlModule);
//# sourceMappingURL=quality-control.module.js.map