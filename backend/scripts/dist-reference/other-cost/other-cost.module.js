"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtherCostModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const other_cost_schema_1 = require("./schemas/other-cost.schema");
const other_cost_service_1 = require("./other-cost.service");
const other_cost_controller_1 = require("./other-cost.controller");
let OtherCostModule = class OtherCostModule {
};
exports.OtherCostModule = OtherCostModule;
exports.OtherCostModule = OtherCostModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: other_cost_schema_1.OtherCost.name, schema: other_cost_schema_1.OtherCostSchema },
            ]),
        ],
        controllers: [other_cost_controller_1.OtherCostController],
        providers: [other_cost_service_1.OtherCostService],
        exports: [other_cost_service_1.OtherCostService],
    })
], OtherCostModule);
//# sourceMappingURL=other-cost.module.js.map