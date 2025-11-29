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
exports.AdvertisingCostController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const advertising_cost_service_1 = require("./advertising-cost.service");
const create_advertising_cost_dto_1 = require("./dto/create-advertising-cost.dto");
const update_advertising_cost_dto_1 = require("./dto/update-advertising-cost.dto");
const auth_guard_1 = require("../auth/guards/auth.guard");
const auth_decorator_1 = require("../auth/decorators/auth.decorator");
let AdvertisingCostController = class AdvertisingCostController {
    constructor(service) {
        this.service = service;
    }
    create(dto) {
        return this.service.create(dto);
    }
    findAll(query) {
        return this.service.findAll(query);
    }
    stats() {
        return this.service.summary();
    }
    findOne(id) {
        return this.service.findOne(id);
    }
    update(id, dto) {
        return this.service.update(id, dto);
    }
    remove(id) {
        return this.service.remove(id);
    }
    uploadFacebookExcel(file) {
        return this.service.processFacebookExcelUpload(file);
    }
};
exports.AdvertisingCostController = AdvertisingCostController;
__decorate([
    (0, common_1.Post)(),
    (0, auth_decorator_1.RequirePermissions)('advertising-costs'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_advertising_cost_dto_1.CreateAdvertisingCostDto]),
    __metadata("design:returntype", void 0)
], AdvertisingCostController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, auth_decorator_1.RequirePermissions)('advertising-costs'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdvertisingCostController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats/summary'),
    (0, auth_decorator_1.RequirePermissions)('advertising-costs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdvertisingCostController.prototype, "stats", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, auth_decorator_1.RequirePermissions)('advertising-costs'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdvertisingCostController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, auth_decorator_1.RequirePermissions)('advertising-costs'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_advertising_cost_dto_1.UpdateAdvertisingCostDto]),
    __metadata("design:returntype", void 0)
], AdvertisingCostController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, auth_decorator_1.RequirePermissions)('advertising-costs'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdvertisingCostController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('upload-facebook-excel'),
    (0, auth_decorator_1.RequirePermissions)('advertising-costs'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdvertisingCostController.prototype, "uploadFacebookExcel", null);
exports.AdvertisingCostController = AdvertisingCostController = __decorate([
    (0, common_1.Controller)('advertising-cost'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, auth_guard_1.RolesGuard),
    __metadata("design:paramtypes", [advertising_cost_service_1.AdvertisingCostService])
], AdvertisingCostController);
//# sourceMappingURL=advertising-cost.controller.js.map