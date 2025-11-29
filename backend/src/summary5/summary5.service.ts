import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Summary5, Summary5Document } from './schemas/summary5.schema';

export interface Summary5Filter {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class Summary5Service {
  constructor(
    @InjectModel(Summary5.name) private readonly model: Model<Summary5Document>,
  ) {}

  async findAll(filter: Summary5Filter = {}) {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(200, filter.limit || 50));
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filter.startDate || filter.endDate) {
      query.orderDate = {};
      if (filter.startDate) query.orderDate.$gte = new Date(filter.startDate);
      if (filter.endDate) query.orderDate.$lte = new Date(filter.endDate);
    }

    const sort: any = {};
    if (filter.sortBy) sort[filter.sortBy] = filter.sortOrder === 'asc' ? 1 : -1;
    else sort.orderDate = -1;

    const [data, total] = await Promise.all([
      this.model.find(query).sort(sort).skip(skip).limit(limit).lean().exec(),
      this.model.countDocuments(query).exec(),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats(startDate?: string, endDate?: string) {
    const match: any = {};
    if (startDate || endDate) {
      match.orderDate = {};
      if (startDate) match.orderDate.$gte = new Date(startDate);
      if (endDate) match.orderDate.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalAdCost: { $sum: { $ifNull: ['$adCost', 0] } },
          totalRevenue: { $sum: { $ifNull: ['$revenue', 0] } },
          totalProfit: { $sum: { $ifNull: ['$profit', 0] } },
          // Placeholders for fields not in schema
          totalLaborCost: { $sum: 0 },
          totalOtherCost: { $sum: 0 },
          totalCostOfGoods: { $sum: 0 },
        },
      },
    ];

    const res = await this.model.aggregate(pipeline);
    const s = res[0] || {
      totalRecords: 0,
      totalAdCost: 0,
      totalRevenue: 0,
      totalProfit: 0,
      totalLaborCost: 0,
      totalOtherCost: 0,
      totalCostOfGoods: 0,
    };
    return s;
  }

  // Minimal sync to avoid 404 and allow UI to operate
  async sync(startDate?: string, endDate?: string) {
    // For now, this is a no-op that ensures endpoint is present.
    // Later we can fill data from Summary4/TestOrder2/Ad costs.
    return { synced: 0 };
  }
}
