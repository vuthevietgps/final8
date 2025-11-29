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
exports.ApiTokenController = void 0;
const common_1 = require("@nestjs/common");
const api_token_service_1 = require("./api-token.service");
const create_api_token_dto_1 = require("./dto/create-api-token.dto");
const update_api_token_dto_1 = require("./dto/update-api-token.dto");
const auth_guard_1 = require("../auth/guards/auth.guard");
const auth_decorator_1 = require("../auth/decorators/auth.decorator");
const token_actions_dto_1 = require("./dto/token-actions.dto");
let ApiTokenController = class ApiTokenController {
    constructor(service) {
        this.service = service;
    }
    create(dto) { return this.service.create(dto); }
    findAll(q) { return this.service.findAll(q || {}); }
    findOne(id) { return this.service.findOne(id); }
    update(id, dto) { return this.service.update(id, dto); }
    remove(id) { return this.service.remove(id); }
    validate(id, dto) { return this.service.validate(id, dto); }
    setPrimary(id, dto) { return this.service.setPrimary(id, dto); }
    rotate(id, dto) { return this.service.rotate(id, dto); }
    syncFromFanpages() {
        return this.service.syncFromFanpages();
    }
};
exports.ApiTokenController = ApiTokenController;
__decorate([
    (0, common_1.Post)(),
    (0, auth_decorator_1.RequirePermissions)('api-tokens'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_api_token_dto_1.CreateApiTokenDto]),
    __metadata("design:returntype", void 0)
], ApiTokenController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, auth_decorator_1.RequirePermissions)('api-tokens'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ApiTokenController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, auth_decorator_1.RequirePermissions)('api-tokens'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ApiTokenController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, auth_decorator_1.RequirePermissions)('api-tokens'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_api_token_dto_1.UpdateApiTokenDto]),
    __metadata("design:returntype", void 0)
], ApiTokenController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, auth_decorator_1.RequirePermissions)('api-tokens'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ApiTokenController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/validate'),
    (0, auth_decorator_1.RequirePermissions)('api-tokens'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, token_actions_dto_1.ValidateTokenDto]),
    __metadata("design:returntype", void 0)
], ApiTokenController.prototype, "validate", null);
__decorate([
    (0, common_1.Post)(':id/set-primary'),
    (0, auth_decorator_1.RequirePermissions)('api-tokens'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, token_actions_dto_1.SetPrimaryTokenDto]),
    __metadata("design:returntype", void 0)
], ApiTokenController.prototype, "setPrimary", null);
__decorate([
    (0, common_1.Post)(':id/rotate'),
    (0, auth_decorator_1.RequirePermissions)('api-tokens'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, token_actions_dto_1.RotateTokenDto]),
    __metadata("design:returntype", void 0)
], ApiTokenController.prototype, "rotate", null);
__decorate([
    (0, common_1.Post)('sync/from-fanpages'),
    (0, auth_decorator_1.RequirePermissions)('api-tokens'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ApiTokenController.prototype, "syncFromFanpages", null);
exports.ApiTokenController = ApiTokenController = __decorate([
    (0, common_1.Controller)('api-tokens'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, auth_guard_1.RolesGuard),
    __metadata("design:paramtypes", [api_token_service_1.ApiTokenService])
], ApiTokenController);
//# sourceMappingURL=api-token.controller.js.map