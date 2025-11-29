import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Summary4, Summary4Document } from './schemas/summary4.schema';
import { Summary4SyncService } from './summary4-sync.service';

export interface Summary4Filter {
  agentId?: string;
  paymentStatus?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface Summary4Stats {
  totalRecords: number;
  totalMustPay: number;
  totalPaidToCompany: number;
  totalManualPayment: number;
  totalNeedToPay: number;
  timestamp: string;
}

@Injectable()
export class Summary4Service {
  constructor(
    @InjectModel(Summary4.name) private model: Model<Summary4Document>,
    private syncService: Summary4SyncService,
  ) {}

  async findAll(filter: Summary4Filter = {}) {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(200, filter.limit || 50));
    const skip = (page - 1) * limit;

    // Build query
    const query: any = { isActive: { $ne: false } };
    
    if (filter.agentId) {
      query.agentId = new Types.ObjectId(filter.agentId);
    }
    
    if (filter.paymentStatus) {
      query.paymentStatus = filter.paymentStatus;
    }
    
    if (filter.from || filter.to) {
      query.createdAt = {};
      if (filter.from) query.createdAt.$gte = new Date(filter.from);
      if (filter.to) query.createdAt.$lte = new Date(filter.to);
    }

    const [docs, total] = await Promise.all([
      this.model
        .find(query)
        .populate('agentId', 'fullName email role')
        .populate('productId', 'name sku')
        .populate('testOrder2Id', 'customerName quantity trackingNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments(query).exec(),
    ]);

    // Map DB docs -> DTO that UI expects
    const data = docs.map((d: any) => this.mapToClientDto(d));

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      // Top-level fields for existing frontend expectations
      total,
      page,
      totalPages,
      // Keep nested pagination for other consumers
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  private mapToClientDto(d: any) {
    return {
      _id: d._id?.toString?.() ?? d._id,
      testOrder2Id: d.testOrder2Id?.toString?.() ?? d.testOrder2Id,
      orderDate: d.orderDate,
      customerName: d.customerName || '',
      product: d.product || d.productId?.name || '',
      quantity: d.quantity ?? 0,
      agentName: d.agentName || d.agentId?.fullName || '',
      adGroupId: d.adGroupId || '',
      isActive: d.isActive !== false,
      serviceDetails: d.serviceDetails,
      productionStatus: d.productionStatus || '',
      orderStatus: d.orderStatus || '',
      submitLink: d.submitLink || '',
      trackingNumber: d.trackingNumber || '',
      depositAmount: d.depositAmount ?? 0,
      codAmount: d.codAmount ?? 0,
      agentId: d.agentId,
      productId: d.productId,
      approvedQuotePrice: d.approvedQuotePrice ?? 0,
      mustPayToCompany: d.mustPayToCompany ?? d.mustPayAmount ?? 0,
      paidToCompany: d.paidToCompany ?? d.paidToCompanyAmount ?? 0,
      manualPayment: d.manualPayment ?? d.manualPaymentAmount ?? 0,
      needToPay: d.needToPay ?? d.needToPayAmount ?? 0,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  async getStats(): Promise<Summary4Stats> {
    const pipeline = [
      { $match: { isActive: { $ne: false } } },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalMustPay: { $sum: { $ifNull: ['$mustPayAmount', 0] } },
          totalPaidToCompany: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
          totalManualPayment: { $sum: { $ifNull: ['$manualPaymentAmount', 0] } },
          totalNeedToPay: { $sum: { $ifNull: ['$needToPayAmount', 0] } },
        },
      },
    ];

    const result = await this.model.aggregate(pipeline);
    const stats = result[0] || {
      totalRecords: 0,
      totalMustPay: 0,
      totalPaidToCompany: 0,
      totalManualPayment: 0,
      totalNeedToPay: 0,
    };

    return {
      ...stats,
      timestamp: new Date().toISOString(),
    };
  }

  async getAgents() {
    const pipeline: any[] = [
      { $match: { isActive: { $ne: false } } },
      { 
        $lookup: {
          from: 'users',
          localField: 'agentId',
          foreignField: '_id',
          as: 'agent'
        }
      },
      { $unwind: '$agent' },
      {
        $group: {
          _id: '$agentId',
          agentName: { $first: '$agent.fullName' },
          agentEmail: { $first: '$agent.email' },
          totalRecords: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$mustPayAmount', 0] } }
        }
      },
      { $sort: { totalRecords: -1 } }
    ];

    return await this.model.aggregate(pipeline);
  }

  /**
   * Trigger sync from TestOrder2 - main entry point
   */
  async triggerSync(): Promise<any> {
    return this.syncService.syncFromTestOrder2();
  }

  async updateManualPayment(id: string, manualPayment: number) {
    const updatedDoc = await this.model.findByIdAndUpdate(
      id,
      { $set: { manualPaymentAmount: manualPayment } },
      { new: true }
    );
    if (!updatedDoc) {
      throw new Error('Record not found or update failed');
    }
    // Populate minimal fields needed to render row consistently
    const doc = await this.model
      .findById(updatedDoc._id)
      .populate('agentId', 'fullName email role')
      .populate('productId', 'name sku')
      .lean()
      .exec();
    return this.mapToClientDto(doc);
  }
}