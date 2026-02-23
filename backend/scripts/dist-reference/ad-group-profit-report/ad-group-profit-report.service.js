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
exports.AdGroupProfitReportService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const ad_group_schema_1 = require("../ad-group/schemas/ad-group.schema");
const summary5_schema_1 = require("../summary5/schemas/summary5.schema");
let AdGroupProfitReportService = class AdGroupProfitReportService {
    constructor(adGroupModel, s5Model) {
        this.adGroupModel = adGroupModel;
        this.s5Model = s5Model;
    }
    startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
    endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
    async getAdGroupProfitReport(filter) {
        const { from, to } = this.calculateDateRange(filter.year, filter.period, filter.fromDate, filter.toDate);
        const adGroups = await this.adGroupModel.find().populate('productId', 'name').populate('agentId', 'name').lean();
        const adGroupNameMap = new Map();
        adGroups.forEach(ag => {
            var _a, _b;
            adGroupNameMap.set(ag.adGroupId, {
                name: ag.name,
                productName: ((_a = ag.productId) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown',
                agentName: ((_b = ag.agentId) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown'
            });
        });
        const dates = [];
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
            dates.push(new Date(d).toISOString().split('T')[0]);
        }
        const byAdGroup = new Map();
        const match = { orderDate: { $gte: this.startOfDay(from), $lte: this.endOfDay(to) } };
        if (filter.adGroupId)
            match.adGroupId = filter.adGroupId;
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
                    orders: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    adGroupId: '$_id.adGroupId',
                    date: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: { $dateFromParts: { year: '$_id.y', month: '$_id.m', day: '$_id.d' } },
                        },
                    },
                    sumProfit: 1,
                    sumRevenue: 1,
                    sumAdCost: 1,
                    orders: 1,
                },
            },
        ]).exec();
        for (const row of agg) {
            const adGroupId = String(row.adGroupId || '');
            if (!adGroupId)
                continue;
            if (!byAdGroup.has(adGroupId))
                byAdGroup.set(adGroupId, new Map());
            const map = byAdGroup.get(adGroupId);
            const current = map.get(row.date) || { date: row.date, profit: 0, revenue: 0, adCost: 0, orders: 0 };
            current.profit += Number(row.sumProfit || 0);
            current.revenue += Number(row.sumRevenue || 0);
            current.adCost += Number(row.sumAdCost || 0);
            current.orders += Number(row.orders || 0);
            map.set(row.date, current);
        }
        const data = [];
        const adGroupsOut = [];
        const allAdGroupIds = new Set([...byAdGroup.keys()]);
        allAdGroupIds.forEach((adGroupId) => {
            const dayMap = byAdGroup.get(adGroupId) || new Map();
            const info = adGroupNameMap.get(adGroupId) || { name: 'Unknown', productName: 'Unknown', agentName: 'Unknown' };
            adGroupsOut.push({ id: adGroupId, name: info.name });
            const row = {
                adGroupId,
                adGroupName: info.name,
                productName: info.productName,
                agentName: info.agentName,
                dailyProfits: {},
                dailyCosts: {},
                totalProfit: 0,
                totalRevenue: 0,
                totalCost: 0,
                totalOrders: 0
            };
            dates.forEach(date => {
                const d = dayMap.get(date);
                row.dailyProfits[date] = (d === null || d === void 0 ? void 0 : d.profit) || 0;
                const dailyAdCost = (d === null || d === void 0 ? void 0 : d.adCost) || 0;
                row.dailyCosts[date] = dailyAdCost;
                if (d) {
                    row.totalProfit += d.profit;
                    row.totalRevenue += d.revenue;
                    row.totalCost += dailyAdCost;
                    row.totalOrders += d.orders;
                }
            });
            data.push(row);
        });
        const summary = {
            totalProfit: data.reduce((s, r) => s + r.totalProfit, 0),
            totalRevenue: data.reduce((s, r) => s + r.totalRevenue, 0),
            totalCost: data.reduce((s, r) => s + r.totalCost, 0),
            totalOrders: data.reduce((s, r) => s + (r.totalOrders || 0), 0),
        };
        return {
            adGroups: adGroupsOut,
            dates,
            data,
            summary
        };
    }
    calculateDateRange(year, period, fromDate, toDate) {
        const now = new Date();
        let from, to;
        if (period === 'custom' && fromDate && toDate) {
            from = this.startOfDay(new Date(fromDate));
            to = this.endOfDay(new Date(toDate));
        }
        else if (year) {
            from = this.startOfDay(new Date(year, 0, 1));
            to = this.endOfDay(new Date(year, 11, 31));
        }
        else {
            switch (period) {
                case 'week':
                    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    to = now;
                    break;
                case '10days':
                    from = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
                    to = now;
                    break;
                case '30days':
                    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    to = now;
                    break;
                case 'lastMonth':
                    from = this.startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
                    to = this.endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
                    break;
                case 'thisMonth':
                    from = this.startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
                    to = now;
                    break;
                default:
                    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    to = now;
            }
        }
        return { from, to };
    }
    async getAvailableYears() {
        const years = await this.s5Model.aggregate([
            { $project: { y: { $year: '$orderDate' } } },
            { $group: { _id: '$y' } },
            { $project: { _id: 0, year: '$_id' } },
            { $sort: { year: -1 } },
        ]).exec();
        return years.map((x) => x.year).filter((y) => typeof y === 'number');
    }
};
exports.AdGroupProfitReportService = AdGroupProfitReportService;
exports.AdGroupProfitReportService = AdGroupProfitReportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(ad_group_schema_1.AdGroup.name)),
    __param(1, (0, mongoose_1.InjectModel)(summary5_schema_1.Summary5.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], AdGroupProfitReportService);
//# sourceMappingURL=ad-group-profit-report.service.js.map