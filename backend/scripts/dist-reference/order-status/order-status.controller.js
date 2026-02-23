"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderStatusController = void 0;
const common_1 = require("@nestjs/common");
const order_status_service_1 = require("./order-status.service");
const create_order_status_dto_1 = require("./dto/create-order-status.dto");
const update_order_status_dto_1 = require("./dto/update-order-status.dto");
let OrderStatusController = class OrderStatusController {
    constructor(orderStatusService) {
        this.orderStatusService = orderStatusService;
    }
    create(createOrderStatusDto) {
        return this.orderStatusService.create(createOrderStatusDto);
    }
    findAll(isActive, isFinal) {
        const activeFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
        const finalFilter = isFinal === 'true' ? true : isFinal === 'false' ? false : undefined;
        return this.orderStatusService.findAll(activeFilter, finalFilter);
    }
    findOne(id) {
        return this.orderStatusService.findOne(id);
    }
    update(id, updateOrderStatusDto) {
        return this.orderStatusService.update(id, updateOrderStatusDto);
    }
    remove(id) {
        return this.orderStatusService.remove(id);
    }
    updateOrder(orderUpdates) {
        return this.orderStatusService.updateOrder(orderUpdates);
    }
    getStats() {
        return this.orderStatusService.getStats();
    }
    getWorkflowStatuses() {
        return this.orderStatusService.getWorkflowStatuses();
    }
};
exports.OrderStatusController = OrderStatusController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_order_status_dto_1.CreateOrderStatusDto]),
    __metadata("design:returntype", void 0)
], OrderStatusController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('isActive')),
    __param(1, (0, common_1.Query)('isFinal')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], OrderStatusController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OrderStatusController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_order_status_dto_1.UpdateOrderStatusDto]),
    __metadata("design:returntype", void 0)
], OrderStatusController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OrderStatusController.prototype, "remove", null);
__decorate([
    (0, common_1.Patch)('order/update'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", void 0)
], OrderStatusController.prototype, "updateOrder", null);
__decorate([
    (0, common_1.Get)('stats/summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OrderStatusController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('workflow/statuses'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OrderStatusController.prototype, "getWorkflowStatuses", null);
exports.OrderStatusController = OrderStatusController = __decorate([
    (0, common_1.Controller)('order-status'),
    __metadata("design:paramtypes", [order_status_service_1.OrderStatusService])
], OrderStatusController);
//# sourceMappingURL=order-status.controller.js.map