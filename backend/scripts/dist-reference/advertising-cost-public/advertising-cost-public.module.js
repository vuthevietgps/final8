"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvertisingCostPublicModule = void 0;
const common_1 = require("@nestjs/common");
const advertising_cost_public_controller_1 = require("./advertising-cost-public.controller");
const advertising_cost_module_1 = require("../advertising-cost/advertising-cost.module");
let AdvertisingCostPublicModule = class AdvertisingCostPublicModule {
};
exports.AdvertisingCostPublicModule = AdvertisingCostPublicModule;
exports.AdvertisingCostPublicModule = AdvertisingCostPublicModule = __decorate([
    (0, common_1.Module)({
        imports: [advertising_cost_module_1.AdvertisingCostModule],
        controllers: [advertising_cost_public_controller_1.AdvertisingCostPublicController]
    })
], AdvertisingCostPublicModule);
//# sourceMappingURL=advertising-cost-public.module.js.map