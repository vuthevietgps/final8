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
exports.ProductProfitReportService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const summary5_schema_1 = require("../summary5/schemas/summary5.schema");
const product_schema_1 = require("../product/schemas/product.schema");
let ProductProfitReportService = class ProductProfitReportService {
    constructor(summary5Model, productModel) {
        this.summary5Model = summary5Model;
        this.productModel = productModel;
    }
    startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
    endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
    async getProductProfitReport(params) {
        try {
            const match = {};
            if (params.from)
                match.orderDate = Object.assign(Object.assign({}, (match.orderDate || {})), { $gte: this.startOfDay(new Date(params.from)) });
            if (params.to)
                match.orderDate = Object.assign(Object.assign({}, (match.orderDate || {})), { $lte: this.endOfDay(new Date(params.to)) });
            if (params.productName) {
                match.product = { $regex: new RegExp(params.productName, 'i') };
            }
            const agg = await this.summary5Model.aggregate([
                { $match: match },
                { $match: { product: { $exists: true, $ne: null, $nin: ["", null] } } },
                {
                    $group: {
                        _id: {
                            product: '$product',
                            y: { $year: '$orderDate' },
                            m: { $month: '$orderDate' },
                            d: { $dayOfMonth: '$orderDate' },
                        },
                        sumProfit: { $sum: { $ifNull: ['$profit', 0] } },
                        sumRevenue: { $sum: { $ifNull: ['$revenue', 0] } },
                        sumCost: {
                            $sum: {
                                $add: [
                                    { $ifNull: ['$costOfGoods', 0] },
                                    { $ifNull: ['$adCost', 0] },
                                    { $ifNull: ['$laborCost', 0] },
                                    { $ifNull: ['$otherCost', 0] }
                                ]
                            }
                        },
                        sumQty: { $sum: { $ifNull: ['$quantity', 0] } },
                        orders: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        productName: '$_id.product',
                        date: {
                            $dateToString: {
                                format: '%Y-%m-%d',
                                date: {
                                    $dateFromParts: {
                                        year: '$_id.y',
                                        month: '$_id.m',
                                        day: '$_id.d'
                                    }
                                }
                            }
                        },
                        sumProfit: 1,
                        sumRevenue: 1,
                        sumCost: 1,
                        sumQty: 1,
                        orders: 1,
                    }
                },
                { $sort: { date: 1, sumProfit: -1 } }
            ]).exec();
            if (!agg || !agg.length)
                return this.getEmptyReport();
            const dates = [...new Set(agg.map((x) => x.date))].sort();
            const productGroups = new Map();
            for (const row of agg) {
                const productName = row.productName || 'Sản phẩm không xác định';
                if (!productGroups.has(productName)) {
                    productGroups.set(productName, {
                        productId: productName,
                        productName: productName,
                        dailyProfits: {},
                        totalProfit: 0,
                        totalRevenue: 0,
                        totalCost: 0,
                        totalQuantity: 0
                    });
                }
                const productData = productGroups.get(productName);
                productData.dailyProfits[row.date] = row.sumProfit || 0;
                productData.totalProfit += row.sumProfit || 0;
                productData.totalRevenue += row.sumRevenue || 0;
                productData.totalCost += row.sumCost || 0;
                productData.totalQuantity += row.sumQty || 0;
            }
            const products = Array.from(productGroups.values()).sort((a, b) => b.totalProfit - a.totalProfit);
            const summary = {
                totalProfit: products.reduce((sum, p) => sum + p.totalProfit, 0),
                totalRevenue: products.reduce((sum, p) => sum + p.totalRevenue, 0),
                totalCost: products.reduce((sum, p) => sum + p.totalCost, 0),
                totalQuantity: products.reduce((sum, p) => sum + p.totalQuantity, 0)
            };
            return {
                dates,
                products: [],
                data: products,
                summary,
                dateRange: {
                    from: params.from || null,
                    to: params.to || null
                }
            };
        }
        catch (error) {
            console.error('Error in getProductProfitReport:', error);
            return this.getEmptyReport();
        }
    }
    async getAvailableYears() {
        const result = await this.summary5Model.aggregate([
            {
                $group: {
                    _id: { $year: '$orderDate' }
                }
            },
            { $sort: { _id: -1 } }
        ]).exec();
        return result.map(item => item._id).filter(year => year);
    }
    getEmptyReport() {
        return {
            dates: [],
            products: [],
            data: [],
            summary: {
                totalProfit: 0,
                totalRevenue: 0,
                totalCost: 0,
                totalQuantity: 0
            },
            dateRange: {
                from: null,
                to: null
            }
        };
    }
};
exports.ProductProfitReportService = ProductProfitReportService;
exports.ProductProfitReportService = ProductProfitReportService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(summary5_schema_1.Summary5.name)),
    __param(1, (0, mongoose_1.InjectModel)(product_schema_1.Product.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], ProductProfitReportService);
//# sourceMappingURL=product-profit-report.service.js.map