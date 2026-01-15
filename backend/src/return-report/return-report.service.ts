import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Summary4, Summary4Document } from '../summary4/schemas/summary4.schema';
import { ReturnReportFilterDto } from './dto/return-report-filter.dto';

interface ReturnRow {
  key: string;
  name?: string;
  totalOrders: number;
  returnOrders: number;
  returnRate: number;
  totalQty: number;
  returnQty: number;
  revenue: number;
  returnRevenue: number;
  cost: number;
  returnCost: number;
  cod: number;
  returnCod: number;
}

@Injectable()
export class ReturnReportService {
  private readonly returnRegex = /hoàn|hoan|hủy|huy|không thành|fail|return/i;

  constructor(
    @InjectModel(Summary4.name) private readonly s4Model: Model<Summary4Document>,
  ) {}

  private startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
  private endOfDay(d: Date) { const x = new Date(d); x.setHours(23,59,59,999); return x; }

  async byAdGroup(filter: ReturnReportFilterDto) {
    const { fromDate, toDate, adGroupId } = filter;
    const match: any = { orderDate: { $type: 'date' } };
    if (fromDate) match.orderDate.$gte = this.startOfDay(new Date(fromDate));
    if (toDate) match.orderDate.$lte = this.endOfDay(new Date(toDate));
    if (adGroupId) match.adGroupId = adGroupId;

    const [all, returned] = await Promise.all([
      this.aggregateBy(match, 'adGroupId'),
      this.aggregateBy({ ...match, orderStatus: { $regex: this.returnRegex } }, 'adGroupId'),
    ]);

    return this.mergeRows(all, returned);
  }

  async byProduct(filter: ReturnReportFilterDto) {
    const { fromDate, toDate, productId } = filter;
    const match: any = { orderDate: { $type: 'date' } };
    if (fromDate) match.orderDate.$gte = this.startOfDay(new Date(fromDate));
    if (toDate) match.orderDate.$lte = this.endOfDay(new Date(toDate));
    if (productId) match.productId = productId;

    const [all, returned] = await Promise.all([
      this.aggregateBy(match, 'productId'),
      this.aggregateBy({ ...match, orderStatus: { $regex: this.returnRegex } }, 'productId'),
    ]);

    return this.mergeRows(all, returned);
  }

  private async aggregateBy(match: any, field: 'adGroupId' | 'productId') {
    return this.s4Model.aggregate([
      { $match: match },
      {
        $group: {
          _id: `$${field}`,
          orders: { $sum: 1 },
          qty: { $sum: { $ifNull: ['$quantity', 0] } },
          revenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
          cost: { $sum: { $ifNull: ['$productCostTotal', 0] } },
          cod: { $sum: { $ifNull: ['$codAmount', 0] } },
        },
      },
    ]).exec();
  }

  private mergeRows(all: any[], returned: any[]): ReturnRow[] {
    const retMap = new Map<string, any>();
    returned.forEach(r => retMap.set(String(r._id || 'unknown'), r));

    return all.map(a => {
      const key = String(a._id || 'unknown');
      const r = retMap.get(key);
      const returnOrders = r?.orders || 0;
      const returnQty = r?.qty || 0;
      const returnRevenue = r?.revenue || 0;
      const returnCost = r?.cost || 0;
      const returnCod = r?.cod || 0;
      const totalOrders = a.orders || 0;
      const totalQty = a.qty || 0;
      return {
        key,
        totalOrders,
        returnOrders,
        returnRate: totalOrders > 0 ? +(returnOrders / totalOrders).toFixed(4) : 0,
        totalQty,
        returnQty,
        revenue: a.revenue || 0,
        returnRevenue,
        cost: a.cost || 0,
        returnCost,
        cod: a.cod || 0,
        returnCod,
      };
    }).sort((x, y) => (y.returnOrders - x.returnOrders));
  }
}
