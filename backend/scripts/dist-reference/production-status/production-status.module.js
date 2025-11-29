"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductionStatusModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const production_status_controller_1 = require("./production-status.controller");
const production_status_service_1 = require("./production-status.service");
const production_status_schema_1 = require("./schemas/production-status.schema");
let ProductionStatusModule = class ProductionStatusModule {
};
exports.ProductionStatusModule = ProductionStatusModule;
exports.ProductionStatusModule = ProductionStatusModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: production_status_schema_1.ProductionStatus.name, schema: production_status_schema_1.ProductionStatusSchema },
            ]),
        ],
        controllers: [production_status_controller_1.ProductionStatusController],
        providers: [production_status_service_1.ProductionStatusService],
        exports: [production_status_service_1.ProductionStatusService],
    })
], ProductionStatusModule);
//# sourceMappingURL=production-status.module.js.map