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
exports.ProductionStatusController = void 0;
const common_1 = require("@nestjs/common");
const production_status_service_1 = require("./production-status.service");
const create_production_status_dto_1 = require("./dto/create-production-status.dto");
const update_production_status_dto_1 = require("./dto/update-production-status.dto");
let ProductionStatusController = class ProductionStatusController {
    constructor(productionStatusService) {
        this.productionStatusService = productionStatusService;
    }
    create(createProductionStatusDto) {
        return this.productionStatusService.create(createProductionStatusDto);
    }
    findAll(isActive) {
        const activeFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
        return this.productionStatusService.findAll(activeFilter);
    }
    findOne(id) {
        return this.productionStatusService.findOne(id);
    }
    update(id, updateProductionStatusDto) {
        return this.productionStatusService.update(id, updateProductionStatusDto);
    }
    remove(id) {
        return this.productionStatusService.remove(id);
    }
    updateOrder(orderUpdates) {
        return this.productionStatusService.updateOrder(orderUpdates);
    }
    getStats() {
        return this.productionStatusService.getStats();
    }
};
exports.ProductionStatusController = ProductionStatusController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_production_status_dto_1.CreateProductionStatusDto]),
    __metadata("design:returntype", void 0)
], ProductionStatusController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('isActive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductionStatusController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductionStatusController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_production_status_dto_1.UpdateProductionStatusDto]),
    __metadata("design:returntype", void 0)
], ProductionStatusController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductionStatusController.prototype, "remove", null);
__decorate([
    (0, common_1.Patch)('order/update'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array]),
    __metadata("design:returntype", void 0)
], ProductionStatusController.prototype, "updateOrder", null);
__decorate([
    (0, common_1.Get)('stats/summary'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProductionStatusController.prototype, "getStats", null);
exports.ProductionStatusController = ProductionStatusController = __decorate([
    (0, common_1.Controller)('production-status'),
    __metadata("design:paramtypes", [production_status_service_1.ProductionStatusService])
], ProductionStatusController);
//# sourceMappingURL=production-status.controller.js.map