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
exports.AdAccountController = void 0;
const common_1 = require("@nestjs/common");
const ad_account_service_1 = require("./ad-account.service");
const create_ad_account_dto_1 = require("./dto/create-ad-account.dto");
const update_ad_account_dto_1 = require("./dto/update-ad-account.dto");
let AdAccountController = class AdAccountController {
    constructor(adAccountService) {
        this.adAccountService = adAccountService;
    }
    create(createAdAccountDto) {
        return this.adAccountService.create(createAdAccountDto);
    }
    findAll(query) {
        return this.adAccountService.findAll(query);
    }
    search(query) {
        return this.adAccountService.search(query);
    }
    validateAccountId(accountId) {
        return this.adAccountService.validateAccountId(accountId);
    }
    getStatsByType() {
        return this.adAccountService.getStatsByType();
    }
    findOne(id) {
        return this.adAccountService.findOne(id);
    }
    update(id, updateAdAccountDto) {
        return this.adAccountService.update(id, updateAdAccountDto);
    }
    remove(id) {
        return this.adAccountService.remove(id);
    }
};
exports.AdAccountController = AdAccountController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_ad_account_dto_1.CreateAdAccountDto]),
    __metadata("design:returntype", void 0)
], AdAccountController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdAccountController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdAccountController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('validate/account-id/:accountId'),
    __param(0, (0, common_1.Param)('accountId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdAccountController.prototype, "validateAccountId", null);
__decorate([
    (0, common_1.Get)('stats/counts-by-type'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdAccountController.prototype, "getStatsByType", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdAccountController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_ad_account_dto_1.UpdateAdAccountDto]),
    __metadata("design:returntype", void 0)
], AdAccountController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdAccountController.prototype, "remove", null);
exports.AdAccountController = AdAccountController = __decorate([
    (0, common_1.Controller)('ad-accounts'),
    __metadata("design:paramtypes", [ad_account_service_1.AdAccountService])
], AdAccountController);
//# sourceMappingURL=ad-account.controller.js.map