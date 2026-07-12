import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DeliveryStatusService } from '../delivery-status/delivery-status.service';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
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
  private readonly logger = new Logger(ReturnReportService.name);
  private readonly returnRegex = /hoan|return/i;
  private readonly legacyFinalStatuses = [
    'Giao thanh cong',
    'Hang hoan',
    'Hoan hang',
    '\u0110a doi soat',
    'Hoan thanh',
    'Giao th\u00e0nh c\u00f4ng',
    'H\u00e0ng ho\u00e0n',
    'Ho\u00e0n h\u00e0ng',
    '\u0110\u00e3 \u0111\u1ed1i so\u00e1t',
    'Ho\u00e0n th\u00e0nh',
  ];
  private readonly legacyReturnStatuses = [
    'Hang hoan',
    'Hoan hang',
    'H\u00e0ng ho\u00e0n',
    'Ho\u00e0n h\u00e0ng',
  ];

  constructor(
    @InjectModel(TestOrder2.name) private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    private readonly deliveryStatusService: DeliveryStatusService,
  ) {}

  private startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private endOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  async byAdGroup(filter: ReturnReportFilterDto) {
    const { fromDate, toDate, adGroupId } = filter;
    const match = this.buildBaseMatch(fromDate, toDate, adGroupId);
    const rows = this.mergeRows(await this.aggregateReport(match, 'adGroupId'));
    const adGroupIds = rows.map((row) => row.key).filter((key) => key !== 'unknown');
    const adGroups = await this.adGroupModel.find({ adGroupId: { $in: adGroupIds } }).lean();
    const nameMap = new Map<string, string>();
    adGroups.forEach((adGroup) => nameMap.set(adGroup.adGroupId, adGroup.name));

    return rows.map((row) => ({
      ...row,
      name: nameMap.get(row.key) || row.key,
    }));
  }

  async byProduct(filter: ReturnReportFilterDto) {
    const { fromDate, toDate, productId } = filter;
    const match: any = this.buildBaseMatch(fromDate, toDate);
    if (productId) {
      match.productId = Types.ObjectId.isValid(productId)
        ? new Types.ObjectId(productId)
        : productId;
    }
    const rows = this.mergeRows(await this.aggregateReport(match, 'productId'));
    const productIds = rows.map((row) => row.key).filter((key) => key !== 'unknown');
    const validIds = productIds
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    const products = await this.productModel.find({ _id: { $in: validIds } }).lean();
    const nameMap = new Map<string, string>();
    products.forEach((product) => nameMap.set(String(product._id), product.name));

    return rows.map((row) => ({
      ...row,
      name: nameMap.get(row.key) || row.key,
    }));
  }

  private buildBaseMatch(fromDate?: string, toDate?: string, adGroupId?: string) {
    const match: any = { orderDate: { $type: 'date' } };
    if (fromDate) match.orderDate.$gte = this.startOfDay(new Date(fromDate));
    if (toDate) match.orderDate.$lte = this.endOfDay(new Date(toDate));
    if (adGroupId) match.adGroupId = adGroupId;
    return match;
  }

  private async aggregateReport(match: any, field: 'adGroupId' | 'productId') {
    const finalStatuses = await this.getFinalStatusNames();
    const returnStatuses = await this.getReturnStatusNames();
    const returnRegex = this.returnRegex.source;

    return this.orderModel
      .aggregate([
        {
          $match: {
            ...match,
            orderStatus: { $in: finalStatuses },
          },
        },
        {
          $group: {
            _id: `$${field}`,
            totalOrders: { $sum: 1 },
            returnOrders: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $in: ['$orderStatus', returnStatuses] },
                      {
                        $regexMatch: {
                          input: { $ifNull: ['$orderStatus', ''] },
                          regex: returnRegex,
                          options: 'i',
                        },
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            totalQty: { $sum: { $ifNull: ['$quantity', 0] } },
            returnQty: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $in: ['$orderStatus', returnStatuses] },
                      {
                        $regexMatch: {
                          input: { $ifNull: ['$orderStatus', ''] },
                          regex: returnRegex,
                          options: 'i',
                        },
                      },
                    ],
                  },
                  { $ifNull: ['$quantity', 0] },
                  0,
                ],
              },
            },
            revenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
            returnRevenue: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $in: ['$orderStatus', returnStatuses] },
                      {
                        $regexMatch: {
                          input: { $ifNull: ['$orderStatus', ''] },
                          regex: returnRegex,
                          options: 'i',
                        },
                      },
                    ],
                  },
                  { $ifNull: ['$paidToCompanyAmount', 0] },
                  0,
                ],
              },
            },
            cost: { $sum: { $ifNull: ['$productCostTotal', 0] } },
            returnCost: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $in: ['$orderStatus', returnStatuses] },
                      {
                        $regexMatch: {
                          input: { $ifNull: ['$orderStatus', ''] },
                          regex: returnRegex,
                          options: 'i',
                        },
                      },
                    ],
                  },
                  { $ifNull: ['$productCostTotal', 0] },
                  0,
                ],
              },
            },
            cod: { $sum: { $ifNull: ['$codAmount', 0] } },
            returnCod: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $in: ['$orderStatus', returnStatuses] },
                      {
                        $regexMatch: {
                          input: { $ifNull: ['$orderStatus', ''] },
                          regex: returnRegex,
                          options: 'i',
                        },
                      },
                    ],
                  },
                  { $ifNull: ['$codAmount', 0] },
                  0,
                ],
              },
            },
          },
        },
      ])
      .exec();
  }

  private async getFinalStatusNames(): Promise<string[]> {
    const names = new Set(this.legacyFinalStatuses);
    try {
      const statuses = await this.deliveryStatusService.getFinalStatuses();
      statuses.forEach((status) => {
        if (status?.name) names.add(status.name);
      });
    } catch (error: any) {
      this.logger.warn(`Failed to resolve final delivery statuses: ${error?.message || error}`);
    }
    return Array.from(names);
  }

  private async getReturnStatusNames(): Promise<string[]> {
    const names = new Set(this.legacyReturnStatuses);
    try {
      const statusNames = await this.deliveryStatusService.getReturnStatusNames();
      statusNames.forEach((name) => {
        if (name) names.add(name);
      });
    } catch (error: any) {
      this.logger.warn(`Failed to resolve return delivery statuses: ${error?.message || error}`);
    }
    return Array.from(names);
  }

  private mergeRows(rows: any[]): ReturnRow[] {
    return rows
      .map((row) => {
        const key = String(row._id || 'unknown');
        const returnOrders = row.returnOrders || 0;
        const totalOrders = row.totalOrders || 0;
        return {
          key,
          totalOrders,
          returnOrders,
          returnRate: totalOrders > 0 ? +(returnOrders / totalOrders).toFixed(4) : 0,
          totalQty: row.totalQty || 0,
          returnQty: row.returnQty || 0,
          revenue: row.revenue || 0,
          returnRevenue: row.returnRevenue || 0,
          cost: row.cost || 0,
          returnCost: row.returnCost || 0,
          cod: row.cod || 0,
          returnCod: row.returnCod || 0,
        };
      })
      .sort((left, right) => right.returnOrders - left.returnOrders);
  }
}
