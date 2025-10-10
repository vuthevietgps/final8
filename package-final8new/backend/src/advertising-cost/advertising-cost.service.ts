/**
 * File: advertising-cost/advertising-cost.service.ts
 * Mục đích: Xử lý nghiệp vụ CRUD cho Chi Phí Quảng Cáo.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdvertisingCost, AdvertisingCostDocument } from './schemas/advertising-cost.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import { CreateAdvertisingCostDto } from './dto/create-advertising-cost.dto';
import { UpdateAdvertisingCostDto } from './dto/update-advertising-cost.dto';

@Injectable()
export class AdvertisingCostService {
  constructor(
    @InjectModel(AdvertisingCost.name)
    private readonly model: Model<AdvertisingCostDocument>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
  ) {}

  async create(dto: CreateAdvertisingCostDto): Promise<AdvertisingCost> {
    const payload: Partial<AdvertisingCost> = {
      adGroupId: dto.adGroupId.trim(),
      frequency: dto.frequency,
      spentAmount: dto.spentAmount ?? 0,
      cpm: dto.cpm ?? 0,
      cpc: dto.cpc ?? 0,
    };
    if (dto.date) payload.date = new Date(dto.date);
    const created = new this.model(payload);
    return created.save();
  }

  async findAll(query?: any): Promise<any[]> {
    // Optional filter by adAccountId via associated adGroup
    let adGroupIdFilter: string[] | undefined;
    if (query?.adAccountId) {
      const groups = await this.adGroupModel.find({ adAccountId: query.adAccountId }).select('adGroupId').lean();
      adGroupIdFilter = groups.map(g => g.adGroupId);
      if (adGroupIdFilter.length === 0) {
        return []; // No groups => no costs
      }
    }

    const findCond: any = {};
    if (adGroupIdFilter) findCond.adGroupId = { $in: adGroupIdFilter };

    const costs = await this.model.find(findCond).sort({ date: -1, createdAt: -1 }).lean();

    // Enrich with ad account info (name + accountId) by joining through adGroup
    if (costs.length === 0) return costs as any[];
    const uniqueAdGroupIds = Array.from(new Set(costs.map(c => c.adGroupId)));
    const adGroups = await this.adGroupModel.find({ adGroupId: { $in: uniqueAdGroupIds } })
      .select('adGroupId adAccountId')
      .lean();
    const adAccountIds = Array.from(new Set(adGroups.map(g => String(g.adAccountId))));
    const adAccounts = await this.adAccountModel.find({ _id: { $in: adAccountIds } })
      .select('name accountId')
      .lean();
    const adGroupMap = new Map(adGroups.map(g => [g.adGroupId, g]));
    const adAccountMap = new Map(adAccounts.map(a => [String(a._id), a]));

    return costs.map(c => {
      const grp: any = adGroupMap.get(c.adGroupId);
      const acc: any = grp ? adAccountMap.get(String(grp.adAccountId)) : null;
      return {
        ...c,
        adAccountId: grp?.adAccountId ? String(grp.adAccountId) : undefined,
        adAccountName: acc?.name,
        adAccountAccountId: acc?.accountId,
      };
    });
  }

  async findOne(id: string): Promise<AdvertisingCost> {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Không tìm thấy chi phí quảng cáo');
    return doc as any;
  }

  async update(id: string, dto: UpdateAdvertisingCostDto): Promise<AdvertisingCost> {
    const update: Partial<AdvertisingCost> = { ...dto } as any;
    if (dto.date) (update as any).date = new Date(dto.date);
    const doc = await this.model.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!doc) throw new NotFoundException('Không tìm thấy chi phí quảng cáo');
    return doc as any;
  }

  async remove(id: string): Promise<void> {
    const res = await this.model.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Không tìm thấy chi phí quảng cáo');
  }

  async summary() {
    const agg = await this.model.aggregate([
      {
        $group: {
          _id: null,
          totalSpent: { $sum: { $ifNull: ['$spentAmount', 0] } },
          count: { $count: {} },
          avgCPM: { $avg: { $ifNull: ['$cpm', 0] } },
          avgCPC: { $avg: { $ifNull: ['$cpc', 0] } },
        },
      },
    ]);
    return agg[0] || { totalSpent: 0, count: 0, avgCPM: 0, avgCPC: 0 };
  }

  // Lấy chi phí ngày hôm qua cho advertising-cost-suggestion
  async getYesterdaySpentByAdGroups(): Promise<{ [adGroupId: string]: number }> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    console.log(`Querying advertising costs for yesterday: ${yesterday.toISOString()} to ${endOfYesterday.toISOString()}`);

    const results = await this.model
      .find({
        date: {
          $gte: yesterday,
          $lte: endOfYesterday
        }
      })
      .select('adGroupId spentAmount date')
      .lean()
      .exec();

    console.log(`Found ${results.length} advertising cost records for yesterday`);

    // Convert to map for easy lookup - default 0 if no data
    const spentMap: { [adGroupId: string]: number } = {};
    results.forEach(result => {
      const spentAmount = result.spentAmount || 0;
      spentMap[result.adGroupId] = spentAmount;
      console.log(`AdGroup ${result.adGroupId}: spent ${spentAmount} on ${result.date}`);
    });

    return spentMap;
  }
}
