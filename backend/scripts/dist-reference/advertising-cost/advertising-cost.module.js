"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvertisingCostModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const platform_express_1 = require("@nestjs/platform-express");
const advertising_cost_schema_1 = require("./schemas/advertising-cost.schema");
const ad_group_schema_1 = require("../ad-group/schemas/ad-group.schema");
const ad_account_schema_1 = require("../ad-account/schemas/ad-account.schema");
const advertising_cost_service_1 = require("./advertising-cost.service");
const advertising_cost_controller_1 = require("./advertising-cost.controller");
let AdvertisingCostModule = class AdvertisingCostModule {
};
exports.AdvertisingCostModule = AdvertisingCostModule;
exports.AdvertisingCostModule = AdvertisingCostModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: advertising_cost_schema_1.AdvertisingCost.name, schema: advertising_cost_schema_1.AdvertisingCostSchema },
                { name: ad_group_schema_1.AdGroup.name, schema: ad_group_schema_1.AdGroupSchema },
                { name: ad_account_schema_1.AdAccount.name, schema: ad_account_schema_1.AdAccountSchema },
            ]),
            platform_express_1.MulterModule.register({
                dest: './uploads/temp',
            }),
        ],
        controllers: [advertising_cost_controller_1.AdvertisingCostController],
        providers: [advertising_cost_service_1.AdvertisingCostService],
        exports: [advertising_cost_service_1.AdvertisingCostService]
    })
], AdvertisingCostModule);
//# sourceMappingURL=advertising-cost.module.js.map