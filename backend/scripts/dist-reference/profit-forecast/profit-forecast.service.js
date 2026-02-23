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
exports.ProfitForecastService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const test_order2_schema_1 = require("../test-order2/schemas/test-order2.schema");
const product_schema_1 = require("../product/schemas/product.schema");
const advertising_cost_schema_1 = require("../advertising-cost/schemas/advertising-cost.schema");
const profit_forecast_snapshot_schema_1 = require("./schemas/profit-forecast-snapshot.schema");
const schedule_1 = require("@nestjs/schedule");
let ProfitForecastService = class ProfitForecastService {
    constructor(orderModel, productModel, costModel, snapshotModel) {
        this.orderModel = orderModel;
        this.productModel = productModel;
        this.costModel = costModel;
        this.snapshotModel = snapshotModel;
        this.MATURITY_DAYS = 7;
        this.MODEL_VERSION = 1;
    }
    baseProb(status) {
        const s = (status || '').toLowerCase();
        if (s.includes('giao không') || s.includes('hủy'))
            return 0;
        if (s.includes('đã giao'))
            return 0.98;
        if (s.includes('đang vận'))
            return 0.82;
        if (s.includes('đã có mã'))
            return 0.68;
        if (s.includes('chưa có mã'))
            return 0.45;
        return 0.5;
    }
    adjustProbForAge(p, ageDays, status) {
        if (p === 0)
            return 0;
        const delivered = (status || '').toLowerCase().includes('đã giao');
        const boost = Math.min(ageDays, this.MATURITY_DAYS) * 0.015;
        const cap = delivered ? 0.995 : 0.95;
        return Math.min(p + boost, cap);
    }
    async forecastByAdGroup(params) {
        const now = new Date();
        const fromDate = params.from ? new Date(params.from) : new Date(now.getTime() - 14 * 86400000);
        const toDate = params.to ? new Date(params.to) : now;
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        const orderFilter = { createdAt: { $gte: fromDate, $lte: toDate } };
        if (params.adGroupId)
            orderFilter.adGroupId = params.adGroupId;
        const orders = await this.orderModel.find(orderFilter).lean();
        if (orders.length === 0)
            return [];
        const productIds = Array.from(new Set(orders.map(o => String(o.productId)))).map(id => new mongoose_2.Types.ObjectId(id));
        const products = await this.productModel.find({ _id: { $in: productIds } }).select('_id totalCost').lean();
        const productCostMap = new Map(products.map(p => [String(p._id), p.totalCost || 0]));
        const maturedCutoff = new Date(now.getTime() - this.MATURITY_DAYS * 86400000);
        const maturedOrders = orders.filter(o => o.createdAt && new Date(o.createdAt) <= maturedCutoff);
        const codAgg = {};
        maturedOrders.forEach(o => {
            const key = String(o.productId);
            const cod = o.codAmount || 0;
            if (!codAgg[key])
                codAgg[key] = { sum: 0, count: 0 };
            if (cod > 0) {
                codAgg[key].sum += cod;
                codAgg[key].count++;
            }
        });
        const avgCod = (pid) => {
            const e = codAgg[pid];
            if (!e || e.count === 0)
                return 0;
            return e.sum / e.count;
        };
        const byKey = new Map();
        for (const o of orders) {
            const created = new Date(o.createdAt || new Date());
            const keyDate = created.toISOString().split('T')[0];
            const key = keyDate + '::' + o.adGroupId;
            if (!byKey.has(key)) {
                byKey.set(key, {
                    date: keyDate,
                    adGroupId: o.adGroupId,
                    maturedRevenue: 0,
                    maturedProfit: 0,
                    maturedOrderCount: 0,
                    projectedRevenue: 0,
                    projectedProfit: 0,
                    projectedOrderCount: 0,
                    modelVersion: this.MODEL_VERSION,
                });
            }
            const bucket = byKey.get(key);
            const ageDays = Math.floor((now.getTime() - created.getTime()) / 86400000);
            const totalCost = (productCostMap.get(String(o.productId)) || 0) * (o.quantity || 1);
            const codAmount = o.codAmount || 0;
            const manualPayment = o.manualPayment || 0;
            const revenueObserved = codAmount + manualPayment;
            const status = o.orderStatus || '';
            const isSuccess = status.toLowerCase().includes('đã giao');
            const isFailed = status.toLowerCase().includes('không thành') || status.toLowerCase().includes('hủy');
            const matured = ageDays >= this.MATURITY_DAYS;
            if (matured) {
                if (isSuccess) {
                    bucket.maturedRevenue += revenueObserved;
                    bucket.maturedProfit += (revenueObserved - totalCost);
                }
                bucket.maturedOrderCount += 1;
                continue;
            }
            if (isFailed) {
                bucket.projectedOrderCount += 1;
                continue;
            }
            let p = this.baseProb(status);
            p = this.adjustProbForAge(p, ageDays, status);
            let expectedRevenueBase = revenueObserved;
            if (expectedRevenueBase === 0) {
                const avg = avgCod(String(o.productId));
                expectedRevenueBase = avg * (o.quantity || 1);
            }
            const expectedRevenue = expectedRevenueBase * p;
            const expectedProfit = expectedRevenue - totalCost * p;
            bucket.projectedRevenue += expectedRevenue;
            bucket.projectedProfit += expectedProfit;
            bucket.projectedOrderCount += 1;
        }
        return Array.from(byKey.values()).map(r => (Object.assign(Object.assign({}, r), { maturedRevenue: Math.round(r.maturedRevenue), maturedProfit: Math.round(r.maturedProfit), projectedRevenue: Math.round(r.projectedRevenue), projectedProfit: Math.round(r.projectedProfit) }))).sort((a, b) => a.date.localeCompare(b.date) || a.adGroupId.localeCompare(b.adGroupId));
    }
    computeConfidence(r) {
        const m = r.maturedOrderCount;
        const p = r.projectedOrderCount;
        const orderComponent = m / (m + p * 0.5 + 1);
        const revenueStability = r.maturedRevenue > 0 ? Math.min(1, r.maturedProfit / (r.maturedRevenue + 1)) : 0.3;
        const conf = 0.6 * orderComponent + 0.4 * revenueStability;
        return +Math.min(1, Math.max(0, conf)).toFixed(3);
    }
    async computeCalibration(adGroupId) {
        const now = new Date();
        const start = new Date(now.getTime() - 14 * 86400000);
        const end = new Date(now.getTime() - 7 * 86400000);
        const filter = { createdAt: { $gte: start, $lte: end } };
        if (adGroupId)
            filter.adGroupId = adGroupId;
        const orders = await this.orderModel.find(filter).select('codAmount manualPayment productId orderStatus quantity createdAt').lean();
        if (!orders.length)
            return 0.2;
        let sum = 0, count = 0;
        for (const o of orders) {
            const revenue = o.codAmount + o.manualPayment || 0;
            if (revenue <= 0)
                continue;
            const expected = revenue * 0.95;
            const err = Math.abs(revenue - expected) / (revenue + 1);
            sum += err;
            count++;
        }
        if (!count)
            return 0.25;
        const avgErr = sum / count;
        return +Math.min(1, Math.max(0, avgErr)).toFixed(3);
    }
    async forecastWithCost(params) {
        const base = await this.forecastByAdGroup(params);
        if (base.length === 0)
            return [];
        const from = base[0].date;
        const to = base[base.length - 1].date;
        const fromDate = new Date(from + 'T00:00:00.000Z');
        const toDate = new Date(to + 'T23:59:59.999Z');
        const costFilter = { date: { $gte: fromDate, $lte: toDate } };
        if (params.adGroupId)
            costFilter.adGroupId = params.adGroupId;
        const costs = await this.costModel.find(costFilter).lean();
        const costMap = new Map();
        costs.forEach(c => {
            const key = c.date.toISOString().split('T')[0] + '::' + c.adGroupId;
            costMap.set(key, (costMap.get(key) || 0) + (c.spentAmount || 0));
        });
        const calibrationError = await this.computeCalibration(params.adGroupId);
        return base.map(r => {
            const spend = costMap.get(r.date + '::' + r.adGroupId) || 0;
            const maturedROAS = spend > 0 ? r.maturedRevenue / spend : 0;
            const blendedRevenue = r.maturedRevenue + r.projectedRevenue;
            const blendedProfit = r.maturedProfit + r.projectedProfit;
            const blendedROAS = spend > 0 ? blendedRevenue / spend : 0;
            const confidence = this.computeConfidence(r);
            return Object.assign(Object.assign({}, r), { spend, maturedROAS: +maturedROAS.toFixed(3), blendedRevenue, blendedProfit, blendedROAS: +blendedROAS.toFixed(3), confidence, calibrationError });
        });
    }
    async recommendedBudget(params) {
        const days = params.days || 7;
        const now = new Date();
        const from = params.from || new Date(now.getTime() - days * 86400000).toISOString().split('T')[0];
        const to = params.to || now.toISOString().split('T')[0];
        const rows = await this.forecastWithCost({ from, to, adGroupId: params.adGroupId });
        const map = new Map();
        for (const r of rows) {
            if (!map.has(r.adGroupId))
                map.set(r.adGroupId, { adGroupId: r.adGroupId, spend: 0, blendedProfit: 0, blendedRevenue: 0, confidenceSum: 0, count: 0 });
            const agg = map.get(r.adGroupId);
            agg.spend += r.spend;
            agg.blendedProfit += r.blendedProfit;
            agg.blendedRevenue += r.blendedRevenue;
            agg.confidenceSum += r.confidence;
            agg.count++;
        }
        const result = [];
        for (const agg of map.values()) {
            const avgConfidence = agg.count ? agg.confidenceSum / agg.count : 0;
            const blendedMargin = agg.blendedRevenue > 0 ? agg.blendedProfit / agg.blendedRevenue : 0;
            const dailySpend = agg.spend / Math.max(1, days);
            let factor = 1;
            if (blendedMargin > 0.25 && avgConfidence >= 0.6)
                factor = 1.2;
            else if (blendedMargin < 0.15)
                factor = 0.85;
            const recommended = Math.round((dailySpend * factor) / 10000) * 10000;
            result.push({
                adGroupId: agg.adGroupId,
                period: { from, to },
                avgDailySpend: Math.round(dailySpend),
                blendedMargin: +blendedMargin.toFixed(3),
                avgConfidence: +avgConfidence.toFixed(3),
                recommendedDailySpend: recommended,
                adjustmentFactor: factor
            });
        }
        return result.sort((a, b) => a.adGroupId.localeCompare(b.adGroupId));
    }
    async upsertSnapshots(params) {
        const data = await this.forecastWithCost(params);
        if (!data.length)
            return { inserted: 0, updated: 0 };
        let inserted = 0, updated = 0;
        for (const row of data) {
            const existing = await this.snapshotModel.findOne({ date: row.date, adGroupId: row.adGroupId });
            const payload = {
                date: row.date,
                adGroupId: row.adGroupId,
                modelVersion: row.modelVersion,
                maturedRevenue: row.maturedRevenue,
                maturedProfit: row.maturedProfit,
                maturedOrderCount: row.maturedOrderCount,
                projectedRevenue: row.projectedRevenue,
                projectedProfit: row.projectedProfit,
                projectedOrderCount: row.projectedOrderCount,
                spend: row.spend,
                blendedRevenue: row.blendedRevenue,
                blendedProfit: row.blendedProfit,
                blendedROAS: row.blendedROAS,
                maturedROAS: row.maturedROAS,
                confidence: row.confidence,
                calibrationError: row.calibrationError,
            };
            if (existing) {
                await this.snapshotModel.updateOne({ _id: existing._id }, { $set: payload });
                updated++;
            }
            else {
                await new this.snapshotModel(payload).save();
                inserted++;
            }
        }
        return { inserted, updated };
    }
    async listSnapshots(params) {
        const now = new Date();
        const from = params.from ? new Date(params.from) : new Date(now.getTime() - 14 * 86400000);
        const to = params.to ? new Date(params.to) : now;
        const filter = { date: { $gte: from.toISOString().split('T')[0], $lte: to.toISOString().split('T')[0] } };
        if (params.adGroupId)
            filter.adGroupId = params.adGroupId;
        return this.snapshotModel.find(filter).sort({ date: 1, adGroupId: 1 }).lean();
    }
    async summaryAggregate(params) {
        const rows = await this.forecastWithCost(params);
        if (!rows.length)
            return { rows: [], summary: null };
        const map = new Map();
        for (const r of rows) {
            if (!map.has(r.date))
                map.set(r.date, { date: r.date, maturedRevenue: 0, maturedProfit: 0, projectedRevenue: 0, projectedProfit: 0, spend: 0, blendedRevenue: 0, blendedProfit: 0 });
            const agg = map.get(r.date);
            agg.maturedRevenue += r.maturedRevenue;
            agg.maturedProfit += r.maturedProfit;
            agg.projectedRevenue += r.projectedRevenue;
            agg.projectedProfit += r.projectedProfit;
            agg.spend += r.spend;
            agg.blendedRevenue += r.blendedRevenue;
            agg.blendedProfit += r.blendedProfit;
        }
        const dates = Array.from(map.values()).map(v => (Object.assign(Object.assign({}, v), { maturedROAS: v.spend > 0 ? +(v.maturedRevenue / v.spend).toFixed(3) : 0, blendedROAS: v.spend > 0 ? +(v.blendedRevenue / v.spend).toFixed(3) : 0, blendedMargin: v.blendedRevenue > 0 ? +((v.blendedProfit / v.blendedRevenue)).toFixed(3) : 0 }))).sort((a, b) => a.date.localeCompare(b.date));
        const total = dates.reduce((acc, d) => {
            acc.maturedRevenue += d.maturedRevenue;
            acc.maturedProfit += d.maturedProfit;
            acc.projectedRevenue += d.projectedRevenue;
            acc.projectedProfit += d.projectedProfit;
            acc.spend += d.spend;
            acc.blendedRevenue += d.blendedRevenue;
            acc.blendedProfit += d.blendedProfit;
            return acc;
        }, { maturedRevenue: 0, maturedProfit: 0, projectedRevenue: 0, projectedProfit: 0, spend: 0, blendedRevenue: 0, blendedProfit: 0 });
        const summary = {
            range: { from: dates[0].date, to: dates[dates.length - 1].date },
            maturedRevenue: total.maturedRevenue,
            maturedProfit: total.maturedProfit,
            projectedRevenue: total.projectedRevenue,
            projectedProfit: total.projectedProfit,
            spend: total.spend,
            blendedRevenue: total.blendedRevenue,
            blendedProfit: total.blendedProfit,
            maturedROAS: total.spend > 0 ? +(total.maturedRevenue / total.spend).toFixed(3) : 0,
            blendedROAS: total.spend > 0 ? +((total.maturedRevenue + total.projectedRevenue) / total.spend).toFixed(3) : 0,
            blendedMargin: total.blendedRevenue > 0 ? +(total.blendedProfit / total.blendedRevenue).toFixed(3) : 0
        };
        return { rows: dates, summary };
    }
    async dailySnapshotJob() {
        try {
            const from = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
            const to = new Date().toISOString().split('T')[0];
            await this.upsertSnapshots({ from, to });
        }
        catch (e) {
            console.error('[ProfitForecast] dailySnapshotJob failed', e.message);
        }
    }
};
exports.ProfitForecastService = ProfitForecastService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_6AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProfitForecastService.prototype, "dailySnapshotJob", null);
exports.ProfitForecastService = ProfitForecastService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(test_order2_schema_1.TestOrder2.name)),
    __param(1, (0, mongoose_1.InjectModel)(product_schema_1.Product.name)),
    __param(2, (0, mongoose_1.InjectModel)(advertising_cost_schema_1.AdvertisingCost.name)),
    __param(3, (0, mongoose_1.InjectModel)(profit_forecast_snapshot_schema_1.ProfitForecastSnapshot.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], ProfitForecastService);
//# sourceMappingURL=profit-forecast.service.js.map