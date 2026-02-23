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
exports.AdGroupService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const ad_group_schema_1 = require("./schemas/ad-group.schema");
let AdGroupService = class AdGroupService {
    constructor(adGroupModel) {
        this.adGroupModel = adGroupModel;
    }
    async create(dto) {
        var _a, _b;
        const created = new this.adGroupModel(Object.assign(Object.assign({}, dto), { isActive: (_a = dto.isActive) !== null && _a !== void 0 ? _a : true }));
        try {
            return await created.save();
        }
        catch (e) {
            if ((e === null || e === void 0 ? void 0 : e.code) === 11000 && ((_b = e === null || e === void 0 ? void 0 : e.keyPattern) === null || _b === void 0 ? void 0 : _b.adGroupId)) {
                throw new common_1.BadRequestException('ID nhóm quảng cáo đã tồn tại. Vui lòng nhập ID khác.');
            }
            throw e;
        }
    }
    async findAll(query) {
        const filter = {};
        if (query === null || query === void 0 ? void 0 : query.platform)
            filter.platform = query.platform;
        if (query === null || query === void 0 ? void 0 : query.fanpageId)
            filter.fanpageId = query.fanpageId;
        if (query === null || query === void 0 ? void 0 : query.productCategoryId)
            filter.productCategoryId = query.productCategoryId;
        if (query === null || query === void 0 ? void 0 : query.agentId)
            filter.agentId = query.agentId;
        if (query === null || query === void 0 ? void 0 : query.adAccountId)
            filter.adAccountId = query.adAccountId;
        if ((query === null || query === void 0 ? void 0 : query.isActive) !== undefined)
            filter.isActive = query.isActive === 'true';
        if ((query === null || query === void 0 ? void 0 : query.enableAIChat) !== undefined)
            filter.enableAIChat = query.enableAIChat === 'true';
        return this.adGroupModel.find(filter)
            .populate('fanpageId', 'name pageId')
            .populate('productCategoryId', 'name description color icon')
            .populate('selectedProducts', 'name description price')
            .populate('openAIConfigId', 'name model systemPrompt')
            .populate('agentId', 'fullName name')
            .populate('adAccountId', 'name accountId')
            .sort({ createdAt: -1 })
            .exec();
    }
    async search(query) {
        const filter = {};
        if ((query === null || query === void 0 ? void 0 : query.platform) && query.platform !== 'all')
            filter.platform = query.platform;
        if ((query === null || query === void 0 ? void 0 : query.fanpageId) && query.fanpageId !== 'all')
            filter.fanpageId = query.fanpageId;
        if ((query === null || query === void 0 ? void 0 : query.productCategoryId) && query.productCategoryId !== 'all')
            filter.productCategoryId = query.productCategoryId;
        if ((query === null || query === void 0 ? void 0 : query.agentId) && query.agentId !== 'all')
            filter.agentId = query.agentId;
        if ((query === null || query === void 0 ? void 0 : query.adAccountId) && query.adAccountId !== 'all')
            filter.adAccountId = query.adAccountId;
        if ((query === null || query === void 0 ? void 0 : query.status) && query.status !== 'all')
            filter.isActive = query.status === 'active';
        if (query === null || query === void 0 ? void 0 : query.q) {
            const rx = new RegExp(query.q.trim(), 'i');
            filter.$or = [{ name: rx }, { adGroupId: rx }, { description: rx }];
        }
        return this.adGroupModel.find(filter)
            .populate('fanpageId', 'name pageId')
            .populate('productCategoryId', 'name description color icon')
            .populate('selectedProducts', 'name description price')
            .populate('openAIConfigId', 'name model')
            .populate('agentId', 'fullName name')
            .populate('adAccountId', 'name accountId')
            .sort({ createdAt: -1 })
            .exec();
    }
    async existsByAdGroupId(adGroupId) {
        const count = await this.adGroupModel.countDocuments({ adGroupId }).exec();
        return count > 0;
    }
    async findOne(id) {
        const doc = await this.adGroupModel.findById(id)
            .populate('fanpageId', 'name pageId avatarUrl')
            .populate('productCategoryId', 'name description color icon')
            .populate('selectedProducts', 'name description price images')
            .populate('openAIConfigId', 'name model systemPrompt temperature maxTokens')
            .populate('agentId', 'fullName name')
            .populate('adAccountId', 'name accountId')
            .exec();
        if (!doc)
            throw new common_1.NotFoundException('Không tìm thấy nhóm quảng cáo');
        return doc;
    }
    async findByAdGroupIdAndFanpage(adGroupId, fanpageId) {
        return this.adGroupModel.findOne({
            adGroupId,
            fanpageId,
            isActive: true,
            enableAIChat: true
        })
            .populate('fanpageId', 'name pageId')
            .populate('productCategoryId', 'name description')
            .populate('selectedProducts', 'name description price images')
            .populate('openAIConfigId', 'name model systemPrompt temperature maxTokens apiKey')
            .exec();
    }
    async update(id, dto) {
        const updated = await this.adGroupModel.findByIdAndUpdate(id, dto, { new: true })
            .populate('fanpageId', 'name pageId')
            .populate('productCategoryId', 'name description color icon')
            .populate('selectedProducts', 'name description price')
            .populate('openAIConfigId', 'name model')
            .populate('agentId', 'fullName name')
            .populate('adAccountId', 'name accountId')
            .exec();
        if (!updated)
            throw new common_1.NotFoundException('Không tìm thấy nhóm quảng cáo');
        return updated;
    }
    async remove(id) {
        const res = await this.adGroupModel.findByIdAndDelete(id).exec();
        if (!res)
            throw new common_1.NotFoundException('Không tìm thấy nhóm quảng cáo');
    }
    async getCountsByProduct() {
        const rows = await this.adGroupModel.aggregate([
            {
                $group: {
                    _id: '$productCategoryId',
                    active: {
                        $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                    },
                    inactive: {
                        $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    productId: { $toString: '$_id' },
                    active: 1,
                    inactive: 1
                }
            }
        ]).exec();
        return rows;
    }
};
exports.AdGroupService = AdGroupService;
exports.AdGroupService = AdGroupService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(ad_group_schema_1.AdGroup.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], AdGroupService);
//# sourceMappingURL=ad-group.service.js.map