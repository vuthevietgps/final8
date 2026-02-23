"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfitForecastModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const profit_forecast_service_1 = require("./profit-forecast.service");
const profit_forecast_controller_1 = require("./profit-forecast.controller");
const profit_forecast_snapshot_schema_1 = require("./schemas/profit-forecast-snapshot.schema");
const test_order2_schema_1 = require("../test-order2/schemas/test-order2.schema");
const product_schema_1 = require("../product/schemas/product.schema");
const advertising_cost_schema_1 = require("../advertising-cost/schemas/advertising-cost.schema");
let ProfitForecastModule = class ProfitForecastModule {
};
exports.ProfitForecastModule = ProfitForecastModule;
exports.ProfitForecastModule = ProfitForecastModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: test_order2_schema_1.TestOrder2.name, schema: test_order2_schema_1.TestOrder2Schema },
                { name: product_schema_1.Product.name, schema: product_schema_1.ProductSchema },
                { name: advertising_cost_schema_1.AdvertisingCost.name, schema: advertising_cost_schema_1.AdvertisingCostSchema },
                { name: profit_forecast_snapshot_schema_1.ProfitForecastSnapshot.name, schema: profit_forecast_snapshot_schema_1.ProfitForecastSnapshotSchema },
            ])
        ],
        controllers: [profit_forecast_controller_1.ProfitForecastController],
        providers: [profit_forecast_service_1.ProfitForecastService],
        exports: [profit_forecast_service_1.ProfitForecastService]
    })
], ProfitForecastModule);
//# sourceMappingURL=profit-forecast.module.js.map