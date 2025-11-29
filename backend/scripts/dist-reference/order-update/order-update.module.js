"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderUpdateModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const order_update_controller_1 = require("./order-update.controller");
const order_update_service_1 = require("./order-update.service");
const test_order2_schema_1 = require("../test-order2/schemas/test-order2.schema");
let OrderUpdateModule = class OrderUpdateModule {
};
exports.OrderUpdateModule = OrderUpdateModule;
exports.OrderUpdateModule = OrderUpdateModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: test_order2_schema_1.TestOrder2.name, schema: test_order2_schema_1.TestOrder2Schema },
            ]),
        ],
        controllers: [order_update_controller_1.OrderUpdateController],
        providers: [order_update_service_1.OrderUpdateService],
        exports: [order_update_service_1.OrderUpdateService],
    })
], OrderUpdateModule);
//# sourceMappingURL=order-update.module.js.map