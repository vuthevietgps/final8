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
exports.AdAccountService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const ad_account_schema_1 = require("./schemas/ad-account.schema");
let AdAccountService = class AdAccountService {
    constructor(adAccountModel) {
        this.adAccountModel = adAccountModel;
    }
    async create(dto) {
        var _a, _b;
        const created = new this.adAccountModel(Object.assign(Object.assign({}, dto), { isActive: (_a = dto.isActive) !== null && _a !== void 0 ? _a : true }));
        try {
            return await created.save();
        }
        catch (e) {
            if ((e === null || e === void 0 ? void 0 : e.code) === 11000 && ((_b = e === null || e === void 0 ? void 0 : e.keyPattern) === null || _b === void 0 ? void 0 : _b.accountId)) {
                throw new common_1.BadRequestException('ID tài khoản quảng cáo đã tồn tại. Vui lòng nhập ID khác.');
            }
            throw e;
        }
    }
    async findAll(query) {
        const filter = {};
        if (query === null || query === void 0 ? void 0 : query.accountType)
            filter.accountType = query.accountType;
        if ((query === null || query === void 0 ? void 0 : query.isActive) !== undefined)
            filter.isActive = query.isActive === 'true';
        return this.adAccountModel.find(filter).sort({ createdAt: -1 }).exec();
    }
    async search(query) {
        const filter = {};
        if ((query === null || query === void 0 ? void 0 : query.accountType) && query.accountType !== 'all')
            filter.accountType = query.accountType;
        if ((query === null || query === void 0 ? void 0 : query.status) && query.status !== 'all')
            filter.isActive = query.status === 'active';
        if (query === null || query === void 0 ? void 0 : query.keyword) {
            const keyword = query.keyword.trim();
            if (keyword) {
                filter.$or = [
                    { name: { $regex: keyword, $options: 'i' } },
                    { accountId: { $regex: keyword, $options: 'i' } },
                ];
            }
        }
        return this.adAccountModel.find(filter).sort({ createdAt: -1 }).exec();
    }
    async findOne(id) {
        const item = await this.adAccountModel.findById(id).exec();
        if (!item) {
            throw new common_1.NotFoundException('Không tìm thấy tài khoản quảng cáo');
        }
        return item;
    }
    async update(id, dto) {
        var _a;
        try {
            const updated = await this.adAccountModel
                .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
                .exec();
            if (!updated) {
                throw new common_1.NotFoundException('Không tìm thấy tài khoản quảng cáo để cập nhật');
            }
            return updated;
        }
        catch (e) {
            if ((e === null || e === void 0 ? void 0 : e.code) === 11000 && ((_a = e === null || e === void 0 ? void 0 : e.keyPattern) === null || _a === void 0 ? void 0 : _a.accountId)) {
                throw new common_1.BadRequestException('ID tài khoản quảng cáo đã tồn tại. Vui lòng nhập ID khác.');
            }
            throw e;
        }
    }
    async remove(id) {
        const deleted = await this.adAccountModel.findByIdAndDelete(id).exec();
        if (!deleted) {
            throw new common_1.NotFoundException('Không tìm thấy tài khoản quảng cáo để xóa');
        }
    }
    async validateAccountId(accountId) {
        const account = await this.adAccountModel.findOne({ accountId }).exec();
        return {
            exists: !!account,
            account: account || undefined,
        };
    }
    async getStatsByType() {
        return this.adAccountModel.aggregate([
            {
                $group: {
                    _id: '$accountType',
                    count: { $sum: 1 },
                    active: { $sum: { $cond: ['$isActive', 1, 0] } },
                },
            },
            {
                $sort: { _id: 1 },
            },
        ]).exec();
    }
};
exports.AdAccountService = AdAccountService;
exports.AdAccountService = AdAccountService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(ad_account_schema_1.AdAccount.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], AdAccountService);
//# sourceMappingURL=ad-account.service.js.map