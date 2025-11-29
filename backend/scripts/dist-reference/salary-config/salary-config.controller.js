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
exports.SalaryConfigController = void 0;
const common_1 = require("@nestjs/common");
const salary_config_service_1 = require("./salary-config.service");
const create_salary_config_dto_1 = require("./dto/create-salary-config.dto");
const update_salary_config_dto_1 = require("./dto/update-salary-config.dto");
const auth_guard_1 = require("../auth/guards/auth.guard");
const auth_decorator_1 = require("../auth/decorators/auth.decorator");
let SalaryConfigController = class SalaryConfigController {
    constructor(service) {
        this.service = service;
    }
    findAll() {
        return this.service.findAll();
    }
    create(dto) {
        return this.service.createOrUpdate(dto);
    }
    update(id, dto) {
        return this.service.update(id, dto);
    }
    updateField(id, patch) {
        return this.service.updateField(id, patch);
    }
    remove(id) {
        return this.service.remove(id);
    }
};
exports.SalaryConfigController = SalaryConfigController;
__decorate([
    (0, common_1.Get)(),
    (0, auth_decorator_1.RequirePermissions)('salary-config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SalaryConfigController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, auth_decorator_1.RequirePermissions)('salary-config'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_salary_config_dto_1.CreateSalaryConfigDto]),
    __metadata("design:returntype", void 0)
], SalaryConfigController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, auth_decorator_1.RequirePermissions)('salary-config'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_salary_config_dto_1.UpdateSalaryConfigDto]),
    __metadata("design:returntype", void 0)
], SalaryConfigController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/field'),
    (0, auth_decorator_1.RequirePermissions)('salary-config'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SalaryConfigController.prototype, "updateField", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, auth_decorator_1.RequirePermissions)('salary-config'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SalaryConfigController.prototype, "remove", null);
exports.SalaryConfigController = SalaryConfigController = __decorate([
    (0, common_1.Controller)('salary-config'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, auth_guard_1.RolesGuard),
    __metadata("design:paramtypes", [salary_config_service_1.SalaryConfigService])
], SalaryConfigController);
//# sourceMappingURL=salary-config.controller.js.map