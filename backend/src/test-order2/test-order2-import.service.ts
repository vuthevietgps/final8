import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TestOrder2, TestOrder2Document } from './schemas/test-order2.schema';

@Injectable()
export class TestOrder2ImportService {
  constructor(
    @InjectModel(TestOrder2.name) private model: Model<TestOrder2Document>,
  ) {}

  async importJson(payload: { items: any[] }) {
    if (!payload?.items || !Array.isArray(payload.items)) {
      throw new BadRequestException('items must be an array');
    }

    const docs: Partial<TestOrder2>[] = payload.items.map((i) => ({
      productId: i.productId ? new Types.ObjectId(i.productId) : undefined,
      customerName: i.customerName,
      quantity: typeof i.quantity === 'number' ? i.quantity : undefined,
      agentId: i.agentId ? new Types.ObjectId(i.agentId) : undefined,
      adGroupId: i.adGroupId,
      isActive: typeof i.isActive === 'boolean' ? i.isActive : true,
      productionStatus: i.productionStatus,
      orderStatus: i.orderStatus,
      serviceDetails: i.serviceDetails,
      submitLink: i.submitLink,
      trackingNumber: i.trackingNumber,
      depositAmount: typeof i.depositAmount === 'number' ? i.depositAmount : 0,
      codAmount: typeof i.codAmount === 'number' ? i.codAmount : 0,
      manualPayment: typeof i.manualPayment === 'number' ? i.manualPayment : 0,
      receiverName: i.receiverName,
      receiverPhone: i.receiverPhone,
      receiverAddress: i.receiverAddress,
      orderDate: i.orderDate ? new Date(i.orderDate) : undefined,
    }));

    const res = await this.model.insertMany(docs);
    return { inserted: res.length };
  }
}
