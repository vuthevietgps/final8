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
exports.FanpageController = void 0;
const common_1 = require("@nestjs/common");
const fanpage_service_1 = require("./fanpage.service");
const create_fanpage_dto_1 = require("./dto/create-fanpage.dto");
const update_fanpage_dto_1 = require("./dto/update-fanpage.dto");
const auth_guard_1 = require("../auth/guards/auth.guard");
const auth_decorator_1 = require("../auth/decorators/auth.decorator");
let FanpageController = class FanpageController {
    constructor(service) {
        this.service = service;
    }
    create(dto) { return this.service.create(dto); }
    findAll() { return this.service.findAll(); }
    findOne(id) { return this.service.findOne(id); }
    update(id, dto) { return this.service.update(id, dto); }
    remove(id) { return this.service.remove(id); }
    createAIConfig(id) { return this.service.createAIConfigForExisting(id); }
    validateToken(id) { return this.service.validateAccessToken(id); }
    refreshToken(id, dto) {
        return this.service.refreshAccessToken(id, dto.accessToken);
    }
    debugValidateToken(id) {
        return this.service.validateAccessToken(id);
    }
    debugRefreshToken(id, dto) {
        return this.service.refreshAccessToken(id, dto.accessToken);
    }
};
exports.FanpageController = FanpageController;
__decorate([
    (0, common_1.Post)(),
    (0, auth_decorator_1.RequirePermissions)('fanpages'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_fanpage_dto_1.CreateFanpageDto]),
    __metadata("design:returntype", void 0)
], FanpageController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, auth_decorator_1.RequirePermissions)('fanpages'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FanpageController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, auth_decorator_1.RequirePermissions)('fanpages'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FanpageController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, auth_decorator_1.RequirePermissions)('fanpages'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_fanpage_dto_1.UpdateFanpageDto]),
    __metadata("design:returntype", void 0)
], FanpageController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, auth_decorator_1.RequirePermissions)('fanpages'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FanpageController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/create-ai-config'),
    (0, auth_decorator_1.RequirePermissions)('fanpages'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FanpageController.prototype, "createAIConfig", null);
__decorate([
    (0, common_1.Post)(':id/validate-token'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FanpageController.prototype, "validateToken", null);
__decorate([
    (0, common_1.Post)(':id/refresh-token'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FanpageController.prototype, "refreshToken", null);
__decorate([
    (0, common_1.Post)('debug/:id/validate-token'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FanpageController.prototype, "debugValidateToken", null);
__decorate([
    (0, common_1.Post)('debug/:id/refresh-token'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FanpageController.prototype, "debugRefreshToken", null);
exports.FanpageController = FanpageController = __decorate([
    (0, common_1.Controller)('fanpages'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, auth_guard_1.RolesGuard),
    __metadata("design:paramtypes", [fanpage_service_1.FanpageService])
], FanpageController);
//# sourceMappingURL=fanpage.controller.js.map