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

@Injectable()
export class PendingOrderService {
  constructor(
    @InjectModel(PendingOrder.name) private model: Model<PendingOrderDocument>,
    private testOrder2Service: TestOrder2Service,
    @InjectConnection() private readonly conn: Connection,
  ) {}

  async create(dto: CreatePendingOrderDto) {
    const rawFanpageId = dto.fanpageId;
    const normalizedFanpageId = await this.normalizeFanpageId(dto.fanpageId);
    if (normalizedFanpageId) dto.fanpageId = normalizedFanpageId;

    const normalizedAdGroup = dto.adGroupId?.trim();
    if (!normalizedAdGroup) {
      const fallback = await this.lookupConversationAdGroup(dto.fanpageId, dto.senderPsid, rawFanpageId);
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

  async getSuppliers() {
    const roles = ['internal_supplier', 'external_supplier'];
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
    const rawFanpageId = dto.fanpageId;
    if (dto.fanpageId !== undefined) {
      const normalizedFanpageId = await this.normalizeFanpageId(dto.fanpageId);
      if (normalizedFanpageId) dto.fanpageId = normalizedFanpageId;
      else delete (dto as any).fanpageId;
    }

    if (dto.adGroupId) {
      dto.adGroupId = dto.adGroupId.trim();
    } else if (!dto.adGroupId && dto.fanpageId && dto.senderPsid) {
      const fallback = await this.lookupConversationAdGroup(dto.fanpageId, dto.senderPsid, rawFanpageId);
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
      supplierId: (pending.supplierId ? pending.supplierId.toString() : undefined),
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
      const conversationFilter = await this.buildConversationFilter(pending.fanpageId, pending.senderPsid);
      await this.conn.collection('conversations').updateOne(
        conversationFilter,
        { $set: update }
      );
    } catch {}
    return { order, pending };
  }

  private async lookupConversationAdGroup(
    fanpageId?: string,
    senderPsid?: string,
    rawFanpageId?: string,
  ): Promise<string | undefined> {
    if ((!fanpageId && !rawFanpageId) || !senderPsid) return undefined;
    const collection = this.conn.collection('conversations');
    let conv: any = null;
    const fanpageCandidates = Array.from(
      new Set([fanpageId, rawFanpageId].filter(Boolean).map(v => String(v).trim()).filter(Boolean))
    );

    for (const fpCandidate of fanpageCandidates) {
      if (Types.ObjectId.isValid(fpCandidate)) {
        conv = await collection.findOne(
          { fanpageId: new Types.ObjectId(fpCandidate), senderPsid },
          { projection: { lastAdGroupId: 1 } }
        );
        if (conv) break;
      }
      conv = await collection.findOne(
        { fanpageId: fpCandidate, senderPsid },
        { projection: { lastAdGroupId: 1 } }
      );
      if (conv) break;
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
      const conversationFilter = await this.buildConversationFilter((pending as any).fanpageId, (pending as any).senderPsid);

      await this.conn.collection('conversations').updateOne(
        conversationFilter,
        { $set: update }
      );
    } catch {}
  }

  private async buildConversationFilter(fanpageId: any, senderPsid?: string): Promise<Record<string, any>> {
    const filter: Record<string, any> = {};
    if (senderPsid) filter.senderPsid = senderPsid;
    if (!fanpageId) return filter;

    const asString = String(fanpageId).trim();
    if (!asString) return filter;

    const candidateSet = new Set<string>([asString]);
    if (Types.ObjectId.isValid(asString)) {
      const fanpage = await this.conn.collection('fanpages').findOne(
        { _id: new Types.ObjectId(asString) },
        { projection: { pageId: 1 } }
      );
      if (fanpage?.pageId) candidateSet.add(String(fanpage.pageId).trim());
    } else {
      const fanpage = await this.conn.collection('fanpages').findOne(
        { pageId: asString },
        { projection: { _id: 1 } }
      );
      if (fanpage?._id) candidateSet.add(fanpage._id.toString());
    }

    const candidates = Array.from(candidateSet)
      .filter(Boolean)
      .map(v => (Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : v));
    if (candidates.length === 1) {
      filter.fanpageId = candidates[0];
    } else if (candidates.length > 1) {
      filter.fanpageId = { $in: candidates };
    }
    return filter;
  }

  private async normalizeFanpageId(fanpageId?: string): Promise<string | undefined> {
    if (!fanpageId) return undefined;
    const value = fanpageId.trim();
    if (!value) return undefined;
    if (Types.ObjectId.isValid(value)) return value;

    const fanpage = await this.conn.collection('fanpages').findOne(
      { pageId: value },
      { projection: { _id: 1 } }
    );
    if (!fanpage?._id) {
      throw new BadRequestException('fanpageId is invalid (must be Mongo _id or an existing fanpage pageId)');
    }
    return fanpage._id.toString();
  }
}
