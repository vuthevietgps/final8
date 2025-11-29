import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdvertisingCost, AdvertisingCostDocument } from '../advertising-cost/schemas/advertising-cost.schema';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';

interface CostPerOrderParams {
  from?: string;
  to?: string;
  adGroupId?: string;
}

@Injectable()
export class AdReportService {
  constructor(
    @InjectModel(AdvertisingCost.name)
    private readonly costModel: Model<AdvertisingCostDocument>,
    @InjectModel(TestOrder2.name)
    private readonly orderModel: Model<TestOrder2Document>,
  ) {}

  async costPerOrderByAdGroup(params: CostPerOrderParams) {
    const { from, to, adGroupId } = params;

    const dateMatch: any = {};
    if (from) {
      dateMatch.$gte = new Date(from);
    }
    if (to) {
      dateMatch.$lte = new Date(to);
    }

    const matchStage: any = { platform: 'facebook' };
    if (adGroupId) {
      matchStage.adGroupId = adGroupId;
    }
    if (Object.keys(dateMatch).length) {
      matchStage.date = dateMatch;
    }

    const costDocs = await this.costModel
      .aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              adGroupId: '$adGroupId',
              date: '$date',
            },
            totalSpent: { $sum: '$spend' },
            impressions: { $sum: '$impressions' },
            clicks: { $sum: '$clicks' },
          },
        },
      ])
      .exec();

    if (!costDocs.length) return [];

    const orConditions = costDocs.map((c) => {
      const d: Date = c._id.date instanceof Date ? c._id.date : new Date(c._id.date);
      const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      return {
        adGroupId: c._id.adGroupId,
        createdAt: { $gte: start, $lt: end },
      };
    });

    const orders = await this.orderModel
      .aggregate([
        { $match: { isActive: true, adGroupId: { $ne: null } } },
        { $match: { $or: orConditions } },
        {
          $project: {
            adGroupId: 1,
            day: {
              $dateToString: {
                date: '$createdAt',
                format: '%Y-%m-%d',
                timezone: 'Asia/Ho_Chi_Minh',
              },
            },
          },
        },
        {
          $group: {
            _id: { adGroupId: '$adGroupId', day: '$day' },
            ordersCount: { $sum: 1 },
          },
        },
      ])
      .exec();

    const orderMap = new Map<string, number>();
    for (const o of orders) {
      const key = `${o._id.adGroupId}|${o._id.day}`;
      orderMap.set(key, o.ordersCount);
    }

    return costDocs.map((c) => {
      const d: Date = c._id.date instanceof Date ? c._id.date : new Date(c._id.date);
      const dayStr = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
        .toISOString()
        .slice(0, 10);
      const key = `${c._id.adGroupId}|${dayStr}`;
      const ordersCount = orderMap.get(key) || 0;
      const costPerOrder = ordersCount > 0 ? c.totalSpent / ordersCount : null;

      return {
        adGroupId: c._id.adGroupId,
        date: dayStr,
        totalSpent: c.totalSpent,
        ordersCount,
        costPerOrder,
        impressions: c.impressions,
        clicks: c.clicks,
      };
    });
  }
}
