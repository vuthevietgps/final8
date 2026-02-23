import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { PendingOrder, PendingOrderDocument } from './schemas/pending-order.schema';
import { CreatePendingOrderDto } from './dto/create-pending-order.dto';
import { UpdatePendingOrderDto } from './dto/update-pending-order.dto';
import { TestOrder2Service } from '../test-order2/test-order2.service';
import { CreateTestOrder2Dto } from '../test-order2/dto/create-test-order2.dto';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { Conversation } from '../chat-message/schemas/conversation.schema';

@Injectable()
export class PendingOrderService {
  constructor(
    @InjectModel(PendingOrder.name) private model: Model<PendingOrderDocument>,
    private testOrder2Service: TestOrder2Service,
    @InjectConnection() private readonly conn: Connection,
  ) {}

  async create(dto: CreatePendingOrderDto) {
    const normalizedAdGroup = dto.adGroupId?.trim();
    if (!normalizedAdGroup) {
      const fallback = await this.lookupConversationAdGroup(dto.fanpageId, dto.senderPsid);
      if (fallback) {
        dto.adGroupId = fallback;
      }
    } else {
      dto.adGroupId = normalizedAdGroup;
    }

    const saved = await new this.model(dto).save();
    await this.syncConversationFromPending(saved);
    return saved;
  }

  /**
   * Lấy danh sách đại lý (user có thể gán cho đơn) – tái sử dụng logic tương tự test-order2.
   * Chỉ lấy các role có tham gia xử lý đơn hàng, loại bỏ user inactive.
   */
  async getAgents() {
    const roles = ['director','manager','employee','internal_agent','external_agent'];
    const users = await this.conn.collection('users').find(
      { role: { $in: roles }, isActive: { $ne: false } },
      { projection: { _id: 1, fullName: 1, email: 1, role: 1 } }
    ).limit(500).toArray();
    return users.map(u => ({
      _id: u._id,
      fullName: (u as any).fullName || (u as any).email,
      email: (u as any).email,
      role: (u as any).role
    }));
  }

  findAll(query: any = {}) {
    const filter: FilterQuery<PendingOrderDocument> = {};
    if (query.fanpageId) filter.fanpageId = query.fanpageId;
    if (query.status) filter.status = query.status;
    if (query.agentId) filter.agentId = query.agentId;
    return this.model.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Pending order không tồn tại');
    return doc as any;
  }

  async update(id: string, dto: UpdatePendingOrderDto) {
    if (dto.adGroupId) {
      dto.adGroupId = dto.adGroupId.trim();
    } else if (!dto.adGroupId && dto.fanpageId && dto.senderPsid) {
      const fallback = await this.lookupConversationAdGroup(dto.fanpageId, dto.senderPsid);
      if (fallback) dto.adGroupId = fallback;
    }

    const doc = await this.model.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!doc) throw new NotFoundException('Pending order không tồn tại');
    await this.syncConversationFromPending(doc as any);
    return doc as any;
  }

  async remove(id: string) { const res = await this.model.findByIdAndDelete(id); if (!res) throw new NotFoundException('Pending order không tồn tại'); }

  async approve(id: string, userId: string) {
    const pending = await this.model.findById(id);
    if(!pending) throw new NotFoundException('Pending order không tồn tại');
    if(pending.status === 'approved') throw new BadRequestException('Đơn đã được duyệt');
    // basic validation
    const required = ['customerName','phone','address','adGroupId'];
    for(const field of required){
      if(!(pending as any)[field]) throw new BadRequestException(`Thiếu trường bắt buộc: ${field}`);
    }
    if(!pending.productId) throw new BadRequestException('Chưa chọn sản phẩm (productId)');
    // map to create dto
    const dto: CreateTestOrder2Dto = {
      productId: pending.productId.toString(),
      customerName: pending.customerName!,
      quantity: pending.quantity || 1,
      agentId: (pending.agentId ? pending.agentId.toString() : userId),
      adGroupId: pending.adGroupId || '0',
      isActive: true,
      productionStatus: 'Chưa làm',
      orderStatus: 'Chưa có mã vận đơn',
      serviceDetails: pending.notes,
      submitLink: undefined,
      trackingNumber: undefined,
      depositAmount: 0,
      codAmount: 0,
      manualPayment: 0,
      receiverName: pending.customerName,
      receiverPhone: pending.phone,
      receiverAddress: pending.address,
    } as any;
    // Nếu có orderDate trong Pending, truyền xuống để tạo đơn theo ngày mong muốn
    if ((pending as any).orderDate) {
      (dto as any).orderDate = (pending as any).orderDate;
    }
    // create order
    const order = await this.testOrder2Service.create(dto);
    pending.status = 'approved';
    await pending.save();
    // update conversation (best effort)
    try {
      const update: Record<string, any> = {
        orderId: (order as any)._id,
        orderDraftStatus: 'approved',
        orderCustomerName: pending.customerName,
        orderPhone: pending.phone,
      };
      if (pending.adGroupId) {
        update.lastAdGroupId = pending.adGroupId;
      }
      await this.conn.collection('conversations').updateOne(
        { fanpageId: pending.fanpageId, senderPsid: pending.senderPsid },
        { $set: update }
      );
    } catch {}
    return { order, pending };
  }

  private async lookupConversationAdGroup(fanpageId?: string, senderPsid?: string): Promise<string | undefined> {
    if (!fanpageId || !senderPsid) return undefined;
    const collection = this.conn.collection('conversations');
    let conv: any = null;
    if (Types.ObjectId.isValid(fanpageId)) {
      conv = await collection.findOne({ fanpageId: new Types.ObjectId(fanpageId), senderPsid }, { projection: { lastAdGroupId: 1 } });
    }
    if (!conv) {
      conv = await collection.findOne({ fanpageId, senderPsid }, { projection: { lastAdGroupId: 1 } });
    }
    const candidate = conv?.lastAdGroupId;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
    return undefined;
  }

  private async syncConversationFromPending(pending: PendingOrder | PendingOrderDocument | (PendingOrder & { _id: any })) {
    if (!pending) return;
    try {
      const update: Record<string, any> = {};
      if ((pending as any).customerName) update.orderCustomerName = (pending as any).customerName;
      if ((pending as any).phone) update.orderPhone = (pending as any).phone;
      if ((pending as any).adGroupId) update.lastAdGroupId = (pending as any).adGroupId;
      if (Object.keys(update).length === 0) return;

      await this.conn.collection('conversations').updateOne(
        { fanpageId: (pending as any).fanpageId, senderPsid: (pending as any).senderPsid },
        { $set: update }
      );
    } catch {}
  }
}
