"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderStatusModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const order_status_controller_1 = require("./order-status.controller");
const order_status_service_1 = require("./order-status.service");
const order_status_schema_1 = require("./schemas/order-status.schema");
let OrderStatusModule = class OrderStatusModule {
};
exports.OrderStatusModule = OrderStatusModule;
exports.OrderStatusModule = OrderStatusModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: order_status_schema_1.OrderStatus.name, schema: order_status_schema_1.OrderStatusSchema },
            ]),
        ],
        controllers: [order_status_controller_1.OrderStatusController],
        providers: [order_status_service_1.OrderStatusService],
        exports: [order_status_service_1.OrderStatusService],
    })
], OrderStatusModule);
//# sourceMappingURL=order-status.module.js.map