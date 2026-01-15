import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Summary5, Summary5Document } from '../summary5/schemas/summary5.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';

@Injectable()
export class ProductProfitReportService {
  constructor(
    @InjectModel(Summary5.name) private readonly summary5Model: Model<Summary5Document>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
  ) {}

  private startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
  private endOfDay(d: Date): Date { const x = new Date(d); x.setHours(23,59,59,999); return x; }

  async getProductProfitReport(params: { 
    from?: string; 
    to?: string; 
    productName?: string;
  }) {
    try {
      const match: any = {};
      if (params.from) match.orderDate = { ...(match.orderDate || {}), $gte: this.startOfDay(new Date(params.from)) };
      if (params.to) match.orderDate = { ...(match.orderDate || {}), $lte: this.endOfDay(new Date(params.to)) };
      if (params.productName) {
        match.product = { $regex: new RegExp(params.productName, 'i') };
      }

      const agg = await this.summary5Model.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              product: { $ifNull: ['$product', { $toString: '$productId' }] },
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
            productName: { $ifNull: ['$_id.product', 'Unknown'] },
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

      if (!agg || !agg.length) return this.getEmptyReport();

      // Create simplified structure without product lookup
      const dates = [...new Set(agg.map((x: any) => x.date))].sort();
      const productGroups = new Map<string, any>();

      for (const row of agg) {
        const productName = row.productName || 'Sản phẩm không xác định';
        if (!productGroups.has(productName)) {
          productGroups.set(productName, {
            productId: productName, // Use product name as ID for simplicity
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
        products: [], // Empty since we don't need product lookup anymore
        data: products,
        summary,
        dateRange: {
          from: params.from || null,
          to: params.to || null
        }
      };
    } catch (error) {
      console.error('Error in getProductProfitReport:', error);
      return this.getEmptyReport();
    }
  }

  async getAvailableYears(): Promise<number[]> {
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

  private getEmptyReport() {
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

  /**
   * Báo cáo tuần theo sản phẩm (ISO week)
   */
  async getProductProfitWeekly(params: { from?: string; to?: string; productName?: string; }): Promise<any> {
    const { from, to, match } = this.buildMatch(params);

    const weekly = await this.summary5Model.aggregate([
      { $match: match },
      {
        $addFields: {
          isoWeek: { $isoWeek: '$orderDate' },
          isoYear: { $isoWeekYear: '$orderDate' },
        },
      },
      {
        $group: {
          _id: {
            product: { $ifNull: ['$product', { $toString: '$productId' }] },
            isoWeek: '$isoWeek',
            isoYear: '$isoYear',
          },
          revenue: { $sum: { $ifNull: ['$revenue', 0] } },
          adCost: { $sum: { $ifNull: ['$adCost', 0] } },
          profit: { $sum: { $ifNull: ['$profit', 0] } },
          orders: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          productName: { $ifNull: ['$_id.product', 'Unknown'] },
          weekKey: { $concat: [{ $toString: '$_id.isoYear' }, '-', { $toString: '$_id.isoWeek' }] },
          weekStart: { $dateFromParts: { isoWeekYear: '$_id.isoYear', isoWeek: '$_id.isoWeek', isoDayOfWeek: 1 } },
          weekEnd: { $dateFromParts: { isoWeekYear: '$_id.isoYear', isoWeek: '$_id.isoWeek', isoDayOfWeek: 7 } },
          revenue: 1,
          adCost: 1,
          profit: 1,
          orders: 1,
        },
      },
      { $sort: { weekStart: 1, productName: 1 } },
    ]).exec();

    return this.buildPeriodicalResponse(weekly, from, to, 'week');
  }

  /**
   * Báo cáo tháng theo sản phẩm
   */
  async getProductProfitMonthly(params: { from?: string; to?: string; productName?: string; }): Promise<any> {
    const { from, to, match } = this.buildMatch(params);

    const monthly = await this.summary5Model.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            product: { $ifNull: ['$product', { $toString: '$productId' }] },
            year: { $year: '$orderDate' },
            month: { $month: '$orderDate' },
          },
          revenue: { $sum: { $ifNull: ['$revenue', 0] } },
          adCost: { $sum: { $ifNull: ['$adCost', 0] } },
          profit: { $sum: { $ifNull: ['$profit', 0] } },
          orders: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          productName: { $ifNull: ['$_id.product', 'Unknown'] },
          monthKey: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              { $cond: [{ $lt: ['$_id.month', 10] }, { $concat: ['0', { $toString: '$_id.month' }] }, { $toString: '$_id.month' }] },
            ],
          },
          year: '$_id.year',
          month: '$_id.month',
          revenue: 1,
          adCost: 1,
          profit: 1,
          orders: 1,
        },
      },
      { $sort: { year: 1, month: 1, productName: 1 } },
    ]).exec();

    return this.buildPeriodicalResponse(monthly, from, to, 'month');
  }

  private buildMatch(params: { from?: string; to?: string; productName?: string; }) {
    const match: any = {};
    if (params.from) match.orderDate = { ...(match.orderDate || {}), $gte: this.startOfDay(new Date(params.from)) };
    if (params.to) match.orderDate = { ...(match.orderDate || {}), $lte: this.endOfDay(new Date(params.to)) };
    if (params.productName) match.product = { $regex: new RegExp(params.productName, 'i') };
    return { from: params.from, to: params.to, match };
  }

  private buildPeriodicalResponse(rows: any[], from?: string, to?: string, granularity: 'week' | 'month' = 'week') {
    if (!rows || !rows.length) {
      return {
        period: { from: from || null, to: to || null },
        summary: { revenue: 0, adCost: 0, profit: 0, netCash: 0, orders: 0 },
        items: [],
      };
    }

    const items = rows.map(r => ({
      productName: r.productName || 'N/A',
      periodKey: granularity === 'week' ? r.weekKey : r.monthKey,
      periodLabel: granularity === 'week'
        ? `${r.weekKey} (${this.toDateOnly(r.weekStart)} - ${this.toDateOnly(r.weekEnd)})`
        : `${r.monthKey}`,
      revenue: Number(r.revenue || 0),
      adCost: Number(r.adCost || 0),
      profit: Number(r.profit || 0),
      orders: Number(r.orders || 0),
      netCash: Number(r.revenue || 0) - Number(r.adCost || 0),
      weekStart: r.weekStart ? this.toDateOnly(r.weekStart) : undefined,
      weekEnd: r.weekEnd ? this.toDateOnly(r.weekEnd) : undefined,
      year: r.year,
      month: r.month,
    }));

    const summary = items.reduce((acc, cur) => {
      acc.revenue += cur.revenue;
      acc.adCost += cur.adCost;
      acc.profit += cur.profit;
      acc.netCash += cur.netCash;
      acc.orders += cur.orders;
      return acc;
    }, { revenue: 0, adCost: 0, profit: 0, netCash: 0, orders: 0 });

    return {
      period: { from: from || null, to: to || null },
      summary,
      items,
    };
  }

  private toDateOnly(d: Date) {
    return new Date(d).toISOString().split('T')[0];
  }
}