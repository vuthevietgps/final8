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
exports.AdGroupProfitService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const ad_group_schema_1 = require("../ad-group/schemas/ad-group.schema");
const summary5_schema_1 = require("../summary5/schemas/summary5.schema");
let AdGroupProfitService = class AdGroupProfitService {
    constructor(adGroupModel, s5Model) {
        this.adGroupModel = adGroupModel;
        this.s5Model = s5Model;
    }
    startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
    endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
    async getAdGroupProfitReport(params) {
        try {
            const match = {};
            if (params.from)
                match.orderDate = Object.assign(Object.assign({}, (match.orderDate || {})), { $gte: this.startOfDay(new Date(params.from)) });
            if (params.to)
                match.orderDate = Object.assign(Object.assign({}, (match.orderDate || {})), { $lte: this.endOfDay(new Date(params.to)) });
            if (params.agentId) {
                try {
                    match.agentId = new mongoose_2.Types.ObjectId(params.agentId);
                }
                catch (_a) {
                    match.agentId = params.agentId;
                }
            }
            const agg = await this.s5Model.aggregate([
                { $match: match },
                {
                    $group: {
                        _id: {
                            adGroupId: '$adGroupId',
                            y: { $year: '$orderDate' },
                            m: { $month: '$orderDate' },
                            d: { $dayOfMonth: '$orderDate' },
                        },
                        sumProfit: { $sum: { $ifNull: ['$profit', 0] } },
                        sumRevenue: { $sum: { $ifNull: ['$revenue', 0] } },
                        sumAdCost: { $sum: { $ifNull: ['$adCost', 0] } },
                        sumQty: { $sum: { $ifNull: ['$quantity', 0] } },
                        orders: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        adGroupId: '$_id.adGroupId',
                        date: { $dateToString: { format: '%Y-%m-%d', date: { $dateFromParts: { year: '$_id.y', month: '$_id.m', day: '$_id.d' } } } },
                        sumProfit: 1,
                        sumRevenue: 1,
                        sumAdCost: 1,
                        sumQty: 1,
                        orders: 1,
                    }
                }
            ]).exec();
            if (!agg || !agg.length)
                return [];
            const adGroupIds = Array.from(new Set(agg.map((x) => x.adGroupId).filter(Boolean)));
            const adGroupDocs = await this.adGroupModel.find({ adGroupId: { $in: adGroupIds } }).lean();
            const nameMap = new Map();
            for (const ag of adGroupDocs)
                nameMap.set(ag.adGroupId, ag.name || `Nhóm QC ${ag.adGroupId}`);
            const reports = agg.map((row) => ({
                date: row.date,
                adGroupId: row.adGroupId || 'unknown',
                adGroupName: nameMap.get(row.adGroupId) || `Nhóm QC ${row.adGroupId}`,
                adsCost: Number(row.sumAdCost || 0),
                totalProfit: Number(row.sumProfit || 0),
                orderCount: Number(row.orders || 0),
                totalQuantity: Number(row.sumQty || 0),
                totalRevenue: Number(row.sumRevenue || 0),
            }));
            reports.sort((a, b) => {
                const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
                if (dateCompare !== 0)
                    return dateCompare;
                return a.adGroupName.localeCompare(b.adGroupName);
            });
            return reports;
        }
        catch (error) {
            console.error('Lỗi khi tạo báo cáo lợi nhuận nhóm quảng cáo:', error);
            throw new Error('Không thể tạo báo cáo lợi nhuận nhóm quảng cáo');
        }
    }
    async getSummaryStats(params) {
        try {
            const reports = await this.getAdGroupProfitReport(params);
            const totalProfit = reports.reduce((sum, r) => sum + r.totalProfit, 0);
            const totalOrders = reports.reduce((sum, r) => sum + r.orderCount, 0);
            const uniqueAdGroups = new Set(reports.map(r => r.adGroupId || r.adGroupName)).size;
            const avgProfitPerOrder = totalOrders > 0 ? totalProfit / totalOrders : 0;
            return {
                totalProfit: Number(totalProfit.toFixed(2)),
                totalOrders,
                totalAdGroups: uniqueAdGroups,
                avgProfitPerOrder: Number(avgProfitPerOrder.toFixed(2))
            };
        }
        catch (error) {
            console.error('Lỗi khi tính thống kê tổng quan:', error);
            return {
                totalProfit: 0,
                totalOrders: 0,
                totalAdGroups: 0,
                avgProfitPerOrder: 0
            };
        }
    }
};
exports.AdGroupProfitService = AdGroupProfitService;
exports.AdGroupProfitService = AdGroupProfitService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(ad_group_schema_1.AdGroup.name)),
    __param(1, (0, mongoose_1.InjectModel)(summary5_schema_1.Summary5.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], AdGroupProfitService);
//# sourceMappingURL=ad-group-profit.service.js.map