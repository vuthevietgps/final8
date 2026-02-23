"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summary5Module = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const summary5_controller_1 = require("./summary5.controller");
const summary5_service_1 = require("./summary5.service");
const summary5_schema_1 = require("./schemas/summary5.schema");
const summary4_schema_1 = require("../summary4/schemas/summary4.schema");
const advertising_cost_schema_1 = require("../advertising-cost/schemas/advertising-cost.schema");
const labor_cost1_schema_1 = require("../labor-cost1/schemas/labor-cost1.schema");
const other_cost_schema_1 = require("../other-cost/schemas/other-cost.schema");
const product_schema_1 = require("../product/schemas/product.schema");
const user_schema_1 = require("../user/user.schema");
let Summary5Module = class Summary5Module {
};
exports.Summary5Module = Summary5Module;
exports.Summary5Module = Summary5Module = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: summary5_schema_1.Summary5.name, schema: summary5_schema_1.Summary5Schema },
                { name: summary4_schema_1.Summary4.name, schema: summary4_schema_1.Summary4Schema },
                { name: advertising_cost_schema_1.AdvertisingCost.name, schema: advertising_cost_schema_1.AdvertisingCostSchema },
                { name: labor_cost1_schema_1.LaborCost1.name, schema: labor_cost1_schema_1.LaborCost1Schema },
                { name: other_cost_schema_1.OtherCost.name, schema: other_cost_schema_1.OtherCostSchema },
                { name: product_schema_1.Product.name, schema: product_schema_1.ProductSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
            ]),
        ],
        controllers: [summary5_controller_1.Summary5Controller],
        providers: [summary5_service_1.Summary5Service],
        exports: [summary5_service_1.Summary5Service],
    })
], Summary5Module);
//# sourceMappingURL=summary5.module.js.map