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
exports.OtherCostService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const other_cost_schema_1 = require("./schemas/other-cost.schema");
let OtherCostService = class OtherCostService {
    constructor(otherCostModel) {
        this.otherCostModel = otherCostModel;
    }
    async create(dto) {
        var _a, _b;
        const payload = {
            date: new Date(dto.date),
            amount: dto.amount,
            notes: ((_a = dto.notes) === null || _a === void 0 ? void 0 : _a.trim()) || undefined,
            documentLink: ((_b = dto.documentLink) === null || _b === void 0 ? void 0 : _b.trim()) || undefined,
        };
        const created = new this.otherCostModel(payload);
        return created.save();
    }
    async findAll(from, to) {
        const filter = {};
        if (from || to) {
            filter.date = {};
            if (from)
                filter.date.$gte = new Date(from);
            if (to)
                filter.date.$lte = new Date(to);
        }
        return this.otherCostModel.find(filter).sort({ date: -1, createdAt: -1 }).exec();
    }
    async findOne(id) {
        const found = await this.otherCostModel.findById(id).exec();
        if (!found)
            throw new common_1.NotFoundException('Không tìm thấy chi phí');
        return found;
    }
    async update(id, dto) {
        var _a;
        const update = Object.assign({}, dto);
        if (dto.date) {
            update.date = new Date(dto.date);
        }
        if (dto.documentLink !== undefined) {
            update.documentLink = ((_a = dto.documentLink) === null || _a === void 0 ? void 0 : _a.trim()) || undefined;
        }
        const updated = await this.otherCostModel
            .findByIdAndUpdate(id, update, { new: true })
            .exec();
        if (!updated)
            throw new common_1.NotFoundException('Không tìm thấy chi phí để cập nhật');
        return updated;
    }
    async remove(id) {
        const deleted = await this.otherCostModel.findByIdAndDelete(id).exec();
        if (!deleted)
            throw new common_1.NotFoundException('Không tìm thấy chi phí để xóa');
        return { message: 'Xóa chi phí thành công' };
    }
    async getSummary(from, to) {
        const match = {};
        if (from || to) {
            match.date = {};
            if (from)
                match.date.$gte = new Date(from);
            if (to)
                match.date.$lte = new Date(to);
        }
        const [result] = await this.otherCostModel.aggregate([
            { $match: match },
            { $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $count: {} } } },
        ]).exec();
        return { totalAmount: (result === null || result === void 0 ? void 0 : result.totalAmount) || 0, count: (result === null || result === void 0 ? void 0 : result.count) || 0 };
    }
};
exports.OtherCostService = OtherCostService;
exports.OtherCostService = OtherCostService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(other_cost_schema_1.OtherCost.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], OtherCostService);
//# sourceMappingURL=other-cost.service.js.map