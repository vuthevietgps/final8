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
exports.AdGroupController = void 0;
const common_1 = require("@nestjs/common");
const ad_group_service_1 = require("./ad-group.service");
const create_ad_group_dto_1 = require("./dto/create-ad-group.dto");
const update_ad_group_dto_1 = require("./dto/update-ad-group.dto");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const product_schema_1 = require("../product/schemas/product.schema");
let AdGroupController = class AdGroupController {
    constructor(adGroupService, productModel) {
        this.adGroupService = adGroupService;
        this.productModel = productModel;
    }
    create(dto) {
        return this.adGroupService.create(dto);
    }
    findAll(query) {
        return this.adGroupService.findAll(query);
    }
    search(query) {
        return this.adGroupService.search(query);
    }
    async validateAdGroupId(adGroupId) {
        const exists = await this.adGroupService.existsByAdGroupId(adGroupId);
        return { exists };
    }
    findOne(id) {
        return this.adGroupService.findOne(id);
    }
    update(id, dto) {
        return this.adGroupService.update(id, dto);
    }
    remove(id) {
        return this.adGroupService.remove(id);
    }
    getCountsByProduct() {
        return this.adGroupService.getCountsByProduct();
    }
    async getProductsByCategory(categoryId) {
        try {
            const products = await this.productModel
                .find({
                productCategoryId: categoryId,
                isActive: { $ne: false }
            })
                .select('name description price image isActive')
                .sort({ name: 1 })
                .lean();
            return {
                success: true,
                data: products,
                count: products.length
            };
        }
        catch (error) {
            throw new common_1.BadRequestException(`Lỗi lấy products theo category: ${error.message}`);
        }
    }
    async getAdGroupsByFanpage(fanpageId, enableWebhook) {
        try {
            const filter = { fanpageId };
            if (enableWebhook === 'true') {
                filter.enableWebhook = true;
            }
            const adGroups = await this.adGroupService.findAll(filter);
            return {
                success: true,
                data: adGroups,
                count: adGroups.length
            };
        }
        catch (error) {
            throw new common_1.BadRequestException(`Lỗi lấy ad groups theo fanpage: ${error.message}`);
        }
    }
    async webhookLookup(adGroupId, fanpageId) {
        try {
            const adGroup = await this.adGroupService.findByAdGroupIdAndFanpage(adGroupId, fanpageId);
            if (!adGroup) {
                return {
                    success: false,
                    message: 'Không tìm thấy ad group hoặc webhook chưa được kích hoạt'
                };
            }
            return {
                success: true,
                data: adGroup
            };
        }
        catch (error) {
            throw new common_1.BadRequestException(`Lỗi webhook lookup: ${error.message}`);
        }
    }
    async updateWebhookStatus(id, body) {
        try {
            const updated = await this.adGroupService.update(id, Object.assign({ enableWebhook: body.enableWebhook }, (body.enableAIChat !== undefined && { enableAIChat: body.enableAIChat })));
            return {
                success: true,
                data: updated,
                message: `Cập nhật trạng thái webhook thành công`
            };
        }
        catch (error) {
            throw new common_1.BadRequestException(`Lỗi cập nhật webhook status: ${error.message}`);
        }
    }
    async lookupAdGroup(adGroupId) {
        var _a;
        try {
            const adGroups = await this.adGroupService.findAll({ adGroupId });
            const adGroup = adGroups.length > 0 ? adGroups[0] : null;
            if (!adGroup) {
                return { adGroupId, name: 'Unknown Ad Group', found: false };
            }
            return {
                adGroupId: adGroup.adGroupId,
                name: adGroup.name,
                found: true,
                productCount: ((_a = adGroup.selectedProducts) === null || _a === void 0 ? void 0 : _a.length) || 0
            };
        }
        catch (error) {
            return { adGroupId, name: 'Error', found: false, error: error.message };
        }
    }
};
exports.AdGroupController = AdGroupController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_ad_group_dto_1.CreateAdGroupDto]),
    __metadata("design:returntype", void 0)
], AdGroupController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdGroupController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AdGroupController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('validate/adgroupid/:adGroupId'),
    __param(0, (0, common_1.Param)('adGroupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdGroupController.prototype, "validateAdGroupId", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdGroupController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_ad_group_dto_1.UpdateAdGroupDto]),
    __metadata("design:returntype", void 0)
], AdGroupController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdGroupController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)('stats/counts-by-product'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdGroupController.prototype, "getCountsByProduct", null);
__decorate([
    (0, common_1.Get)('products-by-category/:categoryId'),
    __param(0, (0, common_1.Param)('categoryId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdGroupController.prototype, "getProductsByCategory", null);
__decorate([
    (0, common_1.Get)('by-fanpage/:fanpageId'),
    __param(0, (0, common_1.Param)('fanpageId')),
    __param(1, (0, common_1.Query)('enableWebhook')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdGroupController.prototype, "getAdGroupsByFanpage", null);
__decorate([
    (0, common_1.Get)('webhook-lookup/:adGroupId/:fanpageId'),
    __param(0, (0, common_1.Param)('adGroupId')),
    __param(1, (0, common_1.Param)('fanpageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdGroupController.prototype, "webhookLookup", null);
__decorate([
    (0, common_1.Patch)(':id/webhook-status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdGroupController.prototype, "updateWebhookStatus", null);
__decorate([
    (0, common_1.Get)('lookup/:adGroupId'),
    __param(0, (0, common_1.Param)('adGroupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdGroupController.prototype, "lookupAdGroup", null);
exports.AdGroupController = AdGroupController = __decorate([
    (0, common_1.Controller)('ad-groups'),
    __param(1, (0, mongoose_1.InjectModel)(product_schema_1.Product.name)),
    __metadata("design:paramtypes", [ad_group_service_1.AdGroupService,
        mongoose_2.Model])
], AdGroupController);
//# sourceMappingURL=ad-group.controller.js.map