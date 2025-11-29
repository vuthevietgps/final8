import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { TestOrder2, TestOrder2Document } from './schemas/test-order2.schema';
import { CreateTestOrder2Dto } from './dto/create-test-order2.dto';
import { Summary4SyncService } from '../summary4/summary4-sync.service';

@Injectable()
export class TestOrder2Service {
  constructor(
    @InjectModel(TestOrder2.name) private model: Model<TestOrder2Document>,
    private readonly summary4SyncService: Summary4SyncService,
  ) {}

  async create(dto: CreateTestOrder2Dto) {
    const doc: Partial<TestOrder2> = {
      productId: dto.productId ? new Types.ObjectId(dto.productId) : undefined,
      customerName: dto.customerName,
      quantity: dto.quantity ?? 1,
      agentId: dto.agentId ? new Types.ObjectId(dto.agentId) : undefined,
      adGroupId: dto.adGroupId,
      isActive: dto.isActive ?? true,
      productionStatus: dto.productionStatus ?? 'Chưa làm',
      orderStatus: dto.orderStatus ?? 'Chưa có mã vận đơn',
      serviceDetails: dto.serviceDetails,
      submitLink: dto.submitLink,
      trackingNumber: dto.trackingNumber,
      depositAmount: dto.depositAmount ?? 0,
      codAmount: dto.codAmount ?? 0,
      manualPayment: dto.manualPayment ?? 0,
      receiverName: dto.receiverName,
      receiverPhone: dto.receiverPhone,
      receiverAddress: dto.receiverAddress,
      orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
    };
    const created = new this.model(doc);
    const saved = await created.save();
    // Trigger per-order Summary4 sync + schedule Sheets sync
    try {
      await this.summary4SyncService.syncOneOrder(String(saved._id));
    } catch {}
    return saved;
  }

  async update(id: string, payload: Partial<TestOrder2>) {
    const updates: any = { ...payload };
    if (typeof updates.productId === 'string') {
      updates.productId = new Types.ObjectId(updates.productId);
    }
    if (typeof updates.agentId === 'string') {
      updates.agentId = new Types.ObjectId(updates.agentId);
    }
    if (typeof updates.orderDate === 'string') {
      updates.orderDate = new Date(updates.orderDate);
    }
    // Normalize booleans/numbers if passed as strings
    if (typeof updates.isActive === 'string') {
      updates.isActive = updates.isActive === 'true' || updates.isActive === '1';
    }
    ['quantity', 'depositAmount', 'codAmount', 'manualPayment'].forEach((k) => {
      const key = k as keyof TestOrder2;
      const v: any = (updates as any)[key];
      if (typeof v === 'string') (updates as any)[key] = parseFloat(v) || 0;
    });

    const updated = await this.model.findByIdAndUpdate(id, updates, { new: true });
    if (updated) {
      try { await this.summary4SyncService.syncOneOrder(String(updated._id)); } catch {}
    }
    return updated;
  }

  async remove(id: string) {
    // Soft delete related Summary4 then delete order
    try { await this.summary4SyncService.softDeleteByOrderId(id); } catch {}
    await this.model.findByIdAndDelete(id);
    return { message: 'Deleted' };
  }

  async seed(count = 10) {
    const docs: Partial<TestOrder2>[] = [];
    for (let i = 0; i < count; i++) {
      docs.push({
        customerName: `Khách hàng #${i + 1}`,
        quantity: 1 + (i % 3),
        adGroupId: i % 2 === 0 ? '0' : `ADG_${1000 + i}`,
        isActive: true,
        productionStatus: 'Chưa làm',
        orderStatus: 'Chưa có mã vận đơn',
        depositAmount: 0,
        codAmount: 0,
        manualPayment: 0,
        orderDate: new Date(),
      });
    }
    const res = await this.model.insertMany(docs);
    return { inserted: res.length };
  }

  async findAll(params: {
    q?: string;
    productId?: string;
    agentId?: string;
    adGroupId?: string;
    isActive?: string;
    from?: string;
    to?: string;
    productionStatus?: string;
    orderStatus?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(params.limit) || 50));

    const query: FilterQuery<TestOrder2Document> = {};

    if (params.q) {
      const regex = new RegExp(params.q, 'i');
      Object.assign(query, {
        $or: [
          { customerName: regex },
          { receiverPhone: regex },
          { trackingNumber: regex },
        ],
      });
    }
    if (params.productId) query.productId = new Types.ObjectId(params.productId);
    if (params.agentId) query.agentId = new Types.ObjectId(params.agentId);
    if (params.adGroupId) query.adGroupId = params.adGroupId;
    if (params.isActive !== undefined) {
      if (params.isActive === 'true' || params.isActive === '1') query.isActive = true;
      if (params.isActive === 'false' || params.isActive === '0') query.isActive = false;
    }
    if (params.productionStatus) query.productionStatus = params.productionStatus;
    if (params.orderStatus) query.orderStatus = params.orderStatus;
    if (params.from || params.to) {
      query.orderDate = {} as any;
      if (params.from) (query.orderDate as any).$gte = new Date(params.from);
      if (params.to) (query.orderDate as any).$lte = new Date(params.to);
    }

    const sort: Record<string, 1 | -1> = {};
    if (params.sortBy) sort[params.sortBy] = params.sortOrder === 'asc' ? 1 : -1;
    else sort['createdAt'] = -1;

    const [total, items] = await Promise.all([
      this.model.countDocuments(query),
      this.model
        .find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return {
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: total ? Math.ceil(total / limit) : 0,
      },
    };
  }
}
