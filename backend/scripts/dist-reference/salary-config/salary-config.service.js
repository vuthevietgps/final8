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
exports.SalaryConfigService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const salary_config_schema_1 = require("./schemas/salary-config.schema");
let SalaryConfigService = class SalaryConfigService {
    constructor(model) {
        this.model = model;
    }
    async createOrUpdate(dto) {
        const userId = new mongoose_2.Types.ObjectId(dto.userId);
        const doc = await this.model.findOneAndUpdate({ userId }, { $set: { hourlyRate: dto.hourlyRate, notes: dto.notes } }, { upsert: true, new: true, setDefaultsOnInsert: true }).exec();
        return doc;
    }
    async findAll() {
        return this.model.find().populate('userId', 'fullName email role').sort({ updatedAt: -1 }).exec();
    }
    async findOne(id) {
        const doc = await this.model.findById(id).exec();
        if (!doc)
            throw new common_1.NotFoundException('Salary config not found');
        return doc;
    }
    async update(id, dto) {
        const doc = await this.model.findByIdAndUpdate(id, dto, { new: true }).exec();
        if (!doc)
            throw new common_1.NotFoundException('Salary config not found');
        return doc;
    }
    async updateField(id, patch) {
        const set = {};
        if (patch.hourlyRate !== undefined)
            set.hourlyRate = patch.hourlyRate;
        if (patch.notes !== undefined)
            set.notes = patch.notes;
        if (patch.userId !== undefined)
            set.userId = new mongoose_2.Types.ObjectId(patch.userId);
        const doc = await this.model.findByIdAndUpdate(id, { $set: set }, { new: true }).exec();
        if (!doc)
            throw new common_1.NotFoundException('Salary config not found');
        return doc;
    }
    async remove(id) {
        const doc = await this.model.findByIdAndDelete(id).exec();
        if (!doc)
            throw new common_1.NotFoundException('Salary config not found');
        return doc;
    }
};
exports.SalaryConfigService = SalaryConfigService;
exports.SalaryConfigService = SalaryConfigService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(salary_config_schema_1.SalaryConfig.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], SalaryConfigService);
//# sourceMappingURL=salary-config.service.js.map