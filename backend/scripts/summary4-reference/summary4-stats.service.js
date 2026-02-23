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
exports.Summary4StatsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const summary4_schema_1 = require("./schemas/summary4.schema");
let Summary4StatsService = class Summary4StatsService {
    constructor(summary4Model) {
        this.summary4Model = summary4Model;
    }
    async getStats() {
        const [totalRecords, totalMustPay, totalPaidToCompany, totalManualPayment, totalNeedToPay] = await Promise.all([
            this.summary4Model.countDocuments({ isActive: true }),
            this.sumField('mustPayToCompany'),
            this.sumField('paidToCompany'),
            this.sumField('manualPayment'),
            this.sumField('needToPay'),
        ]);
        return {
            totalRecords,
            totalMustPay,
            totalPaidToCompany,
            totalManualPayment,
            totalNeedToPay,
            timestamp: new Date(),
        };
    }
    async sumField(field) {
        var _a;
        const rows = await this.summary4Model.aggregate([{ $match: { isActive: true } }, { $group: { _id: null, total: { $sum: `$${field}` } } }]);
        return ((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
    }
    async getAgents() {
        const agents = await this.summary4Model
            .aggregate([
            { $match: { isActive: true } },
            { $group: { _id: '$agentId', agentName: { $first: '$agentName' }, orderCount: { $sum: 1 }, totalMustPay: { $sum: '$mustPayToCompany' }, totalPaidToCompany: { $sum: '$paidToCompany' }, totalManualPayment: { $sum: '$manualPayment' }, totalNeedToPay: { $sum: '$needToPay' }, lastOrderDate: { $max: '$orderDate' } } },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userInfo' } },
            { $project: { _id: 1, agentId: '$_id', agentName: 1, fullName: { $arrayElemAt: ['$userInfo.fullName', 0] }, email: { $arrayElemAt: ['$userInfo.email', 0] }, role: { $arrayElemAt: ['$userInfo.role', 0] }, orderCount: 1, totalMustPay: 1, totalPaidToCompany: 1, totalManualPayment: 1, totalNeedToPay: 1, lastOrderDate: 1 } },
            { $sort: { orderCount: -1, agentName: 1 } },
        ])
            .exec();
        return agents;
    }
};
exports.Summary4StatsService = Summary4StatsService;
exports.Summary4StatsService = Summary4StatsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(summary4_schema_1.Summary4.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], Summary4StatsService);
//# sourceMappingURL=summary4-stats.service.js.map