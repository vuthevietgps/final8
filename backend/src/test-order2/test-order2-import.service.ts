import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TestOrder2, TestOrder2Document } from './schemas/test-order2.schema';
import { saleModeForAgentRole } from './order-sale-mode';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FINANCIAL_INPUT_CHANGED } from '../advertising-cost/advertising-cost-refresh.module';

@Injectable()
export class TestOrder2ImportService {
  constructor(
    @InjectModel(TestOrder2.name) private model: Model<TestOrder2Document>,
    private readonly events?: EventEmitter2,
  ) {}

  async importJson(payload: { items: any[] }) {
    if (!payload?.items || !Array.isArray(payload.items)) {
      throw new BadRequestException('items must be an array');
    }

    const agentIds = [...new Set(payload.items.map(i => String(i.agentId || '').trim()).filter(Boolean))];
    if (agentIds.some(id => !Types.ObjectId.isValid(id))) {
      throw new BadRequestException('agentId nhập vào không hợp lệ.');
    }
    const agents = agentIds.length ? await this.model.db.collection('users').find({
      _id: { $in: agentIds.map(id => new Types.ObjectId(id)) },
      role: { $in: ['internal_agent', 'external_agent'] },
    }, { projection: { role: 1 } }).toArray() : [];
    const roleById = new Map(agents.map(agent => [String(agent._id), String(agent.role)]));
    const missingAgentIds = agentIds.filter(id => !roleById.has(id));
    if (missingAgentIds.length) {
      throw new BadRequestException('Đơn nhập có nhân sự nội bộ/đại lý ngoài không tồn tại hoặc sai vai trò.');
    }

    const docs: Partial<TestOrder2>[] = payload.items.map((i) => {
      const parsedUsageDuration = Number(i.productUsageDurationMonths);
      const agentId = String(i.agentId || '').trim();
      const agentRole = agentId ? roleById.get(agentId) : undefined;
      return {
        financialModelVersion: 2,
        saleMode: saleModeForAgentRole(agentId, agentRole),
        agentRoleSnapshot: agentRole as 'internal_agent' | 'external_agent' | undefined,
        retailSaleAmount: typeof i.retailSaleAmount === 'number' ? i.retailSaleAmount : undefined,
        productId: i.productId ? new Types.ObjectId(i.productId) : undefined,
        productUsageDurationMonths: Number.isFinite(parsedUsageDuration) && parsedUsageDuration > 0
          ? Math.floor(parsedUsageDuration)
          : undefined,
        customerName: i.customerName,
        quantity: typeof i.quantity === 'number' ? i.quantity : undefined,
        agentId: agentId ? new Types.ObjectId(agentId) : undefined,
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
      };
    });

    const res = await this.model.insertMany(docs);
    await this.events?.emitAsync(FINANCIAL_INPUT_CHANGED, { dates: res.map(order => order.orderDate), revalue: true });
    return { inserted: res.length };
  }
}
