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
exports.OpenAIConfigController = void 0;
const common_1 = require("@nestjs/common");
const create_openai_config_dto_1 = require("./dto/create-openai-config.dto");
const update_openai_config_dto_1 = require("./dto/update-openai-config.dto");
const test_openai_key_dto_1 = require("./dto/test-openai-key.dto");
const openai_config_service_1 = require("./openai-config.service");
const auth_guard_1 = require("../auth/guards/auth.guard");
const auth_decorator_1 = require("../auth/decorators/auth.decorator");
let OpenAIConfigController = class OpenAIConfigController {
    constructor(service) {
        this.service = service;
    }
    create(dto) { return this.service.create(dto); }
    findAll(q) { return this.service.findAll(q || {}); }
    findOne(id) { return this.service.findOne(id); }
    update(id, dto) { return this.service.update(id, dto); }
    remove(id) { return this.service.remove(id); }
    testKey(dto) { return this.service.testKey(dto); }
};
exports.OpenAIConfigController = OpenAIConfigController;
__decorate([
    (0, common_1.Post)(),
    (0, auth_decorator_1.RequirePermissions)('openai-configs'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_openai_config_dto_1.CreateOpenAIConfigDto]),
    __metadata("design:returntype", void 0)
], OpenAIConfigController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, auth_decorator_1.RequirePermissions)('openai-configs'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OpenAIConfigController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, auth_decorator_1.RequirePermissions)('openai-configs'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OpenAIConfigController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, auth_decorator_1.RequirePermissions)('openai-configs'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_openai_config_dto_1.UpdateOpenAIConfigDto]),
    __metadata("design:returntype", void 0)
], OpenAIConfigController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, auth_decorator_1.RequirePermissions)('openai-configs'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], OpenAIConfigController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('test-key'),
    (0, auth_decorator_1.RequirePermissions)('openai-configs'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [test_openai_key_dto_1.TestOpenAIKeyDto]),
    __metadata("design:returntype", void 0)
], OpenAIConfigController.prototype, "testKey", null);
exports.OpenAIConfigController = OpenAIConfigController = __decorate([
    (0, common_1.Controller)('openai-configs'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, auth_guard_1.RolesGuard),
    __metadata("design:paramtypes", [openai_config_service_1.OpenAIConfigService])
], OpenAIConfigController);
//# sourceMappingURL=openai-config.controller.js.map