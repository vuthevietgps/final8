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
exports.LaborCost1Controller = void 0;
const common_1 = require("@nestjs/common");
const labor_cost1_service_1 = require("./labor-cost1.service");
const create_labor_cost1_dto_1 = require("./dto/create-labor-cost1.dto");
const update_labor_cost1_dto_1 = require("./dto/update-labor-cost1.dto");
const auth_guard_1 = require("../auth/guards/auth.guard");
const auth_decorator_1 = require("../auth/decorators/auth.decorator");
let LaborCost1Controller = class LaborCost1Controller {
    constructor(service) {
        this.service = service;
    }
    findAll() {
        return this.service.findAll();
    }
    create(dto) {
        return this.service.create(dto);
    }
    update(id, dto) {
        return this.service.update(id, dto);
    }
    remove(id) {
        return this.service.remove(id);
    }
    generateFromSessionLogs(userId, date) {
        return this.service.generateFromSessionLogs(userId, date);
    }
};
exports.LaborCost1Controller = LaborCost1Controller;
__decorate([
    (0, common_1.Get)(),
    (0, auth_decorator_1.RequirePermissions)('labor-costs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], LaborCost1Controller.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, auth_decorator_1.RequirePermissions)('labor-costs'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_labor_cost1_dto_1.CreateLaborCost1Dto]),
    __metadata("design:returntype", void 0)
], LaborCost1Controller.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, auth_decorator_1.RequirePermissions)('labor-costs'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_labor_cost1_dto_1.UpdateLaborCost1Dto]),
    __metadata("design:returntype", void 0)
], LaborCost1Controller.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, auth_decorator_1.RequirePermissions)('labor-costs'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], LaborCost1Controller.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('generate-from-sessions'),
    (0, auth_decorator_1.RequirePermissions)('labor-costs'),
    __param(0, (0, common_1.Query)('userId')),
    __param(1, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LaborCost1Controller.prototype, "generateFromSessionLogs", null);
exports.LaborCost1Controller = LaborCost1Controller = __decorate([
    (0, common_1.Controller)('labor-cost1'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, auth_guard_1.RolesGuard),
    __metadata("design:paramtypes", [labor_cost1_service_1.LaborCost1Service])
], LaborCost1Controller);
//# sourceMappingURL=labor-cost1.controller.js.map