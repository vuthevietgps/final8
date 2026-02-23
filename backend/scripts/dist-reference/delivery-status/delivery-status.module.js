"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryStatusModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const delivery_status_controller_1 = require("./delivery-status.controller");
const delivery_status_service_1 = require("./delivery-status.service");
const delivery_status_schema_1 = require("./schemas/delivery-status.schema");
let DeliveryStatusModule = class DeliveryStatusModule {
};
exports.DeliveryStatusModule = DeliveryStatusModule;
exports.DeliveryStatusModule = DeliveryStatusModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: delivery_status_schema_1.DeliveryStatus.name, schema: delivery_status_schema_1.DeliveryStatusSchema }
            ])
        ],
        controllers: [delivery_status_controller_1.DeliveryStatusController],
        providers: [delivery_status_service_1.DeliveryStatusService],
        exports: [delivery_status_service_1.DeliveryStatusService],
    })
], DeliveryStatusModule);
//# sourceMappingURL=delivery-status.module.js.map