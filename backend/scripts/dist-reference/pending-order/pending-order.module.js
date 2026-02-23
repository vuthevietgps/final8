"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PendingOrderModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const pending_order_schema_1 = require("./schemas/pending-order.schema");
const pending_order_service_1 = require("./pending-order.service");
const pending_order_controller_1 = require("./pending-order.controller");
const test_order2_module_1 = require("../test-order2/test-order2.module");
let PendingOrderModule = class PendingOrderModule {
};
exports.PendingOrderModule = PendingOrderModule;
exports.PendingOrderModule = PendingOrderModule = __decorate([
    (0, common_1.Module)({
        imports: [mongoose_1.MongooseModule.forFeature([{ name: pending_order_schema_1.PendingOrder.name, schema: pending_order_schema_1.PendingOrderSchema }]), test_order2_module_1.TestOrder2Module],
        controllers: [pending_order_controller_1.PendingOrderController],
        providers: [pending_order_service_1.PendingOrderService],
        exports: [pending_order_service_1.PendingOrderService]
    })
], PendingOrderModule);
//# sourceMappingURL=pending-order.module.js.map