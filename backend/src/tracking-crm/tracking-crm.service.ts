import { trackingListQuery } from './tracking-list.query';
import { conversionTypesFromEvidence } from './tracking-conversion';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { TrackingLead, TrackingVisit, TrackingEvent, TrackingOrderLink, TrackingSource } from './schemas/tracking-crm.schema';
import { SaveTrackingLeadDto, LinkTrackingOrderDto } from './tracking-crm.dto';
import { User } from '../user/user.schema';
import { Product } from '../product/schemas/product.schema';
import { TestOrder2Service } from '../test-order2/test-order2.service';
import { AdsAttributionOptionsService } from '../test-order2/services/ads-attribution-options.service';
import { OrderCalculationService } from '../test-order2/services/order-calculation.service';

@Injectable()
export class TrackingCrmService {
  constructor(
    @InjectModel(TrackingLead.name) private leads: Model<TrackingLead>,
    @InjectModel(TrackingVisit.name) private visits: Model<TrackingVisit>,
    @InjectModel(TrackingEvent.name) private events: Model<TrackingEvent>,
    @InjectModel(TrackingOrderLink.name) private links: Model<TrackingOrderLink>,
    @InjectModel(TrackingSource.name) private sources: Model<TrackingSource>,
    @InjectModel(User.name) private users: Model<User>,
    @InjectModel(Product.name) private products: Model<Product>,
    private orders: TestOrder2Service,
    private ads: AdsAttributionOptionsService,
    private calculation: OrderCalculationService,
  ) {}

  async options() {
    const [agents, suppliers, products, ads, sources] = await Promise.all([
      this.users.find({ role: { $in: ['internal_agent', 'external_agent'] }, isActive: true }).select('_id fullName role').lean(),
      this.users.find({ role: { $in: ['internal_supplier', 'external_supplier'] }, isActive: true }).select('_id fullName').lean(),
      this.products.find({}).select('_id name categoryId').populate('categoryId', 'name').lean(), this.ads.list(),
      this.sources.find({}).select('_id name enabled').lean(),
    ]);
    return { agents, suppliers, products, ads: ads.items, sources };
  }

  async list(query: Record<string, string> = {}) {
    const { pipeline, page, pageSize } = trackingListQuery(query);
    const [result] = await this.visits.aggregate(pipeline).option({ maxTimeMS: 15000 });
    const items = (result?.items || []).map((row: any) => {
      const { lead, conversionTypes, lastConversionAt, product, categoryRows, linkRows, ...visit } = row;
      return { ...lead, _id: lead?._id || visit._id, leadId: lead?._id || null,
        visitId: visit._id, visit, status: lead?.status || 'new', __v: lead?.__v ?? 0,
        conversionTypes, lastConversionAt, interactionKind: conversionTypes.length ? 'conversion' : 'click',
        productName: product?.name, productGroupName: categoryRows?.[0]?.name || 'Chưa xác định',
        link: linkRows?.[0] || null };
    });
    return { items, total: result?.total?.[0]?.value || 0, page, pageSize };
  }

  async history(visitId: string) {
    const visit = await this.visits.findById(visitId).lean();
    if (!visit) throw new NotFoundException('Không tìm thấy lượt truy cập');
    return this.events.find({ sourceId: visit.sourceId, externalVisitId: visit.externalVisitId })
      .select('eventType occurredAt value').sort({ occurredAt: -1 }).limit(100).lean();
  }

  async saveVisit(visitId: string, dto: SaveTrackingLeadDto, actor: string) {
    if (!await this.visits.exists({ _id: visitId })) throw new NotFoundException('Không tìm thấy lượt truy cập');
    if (dto.version !== 0 || await this.leads.exists({ visitId })) throw new ConflictException('Lượt truy cập đã có hồ sơ. Hãy tải lại.');
    const draft = new this.leads({ visitId, createdBy: actor, updatedBy: actor, __v: 0 });
    return this.save(String(draft._id), dto, actor, draft);
  }

  private async lead(id: string) {
    const lead = await this.leads.findById(id).select('+operationLock');
    if (!lead) throw new NotFoundException('Không tìm thấy hồ sơ CRM');
    return lead;
  }

  async detail(id: string) {
    const lead = await this.lead(id);
    const visit = await this.visits.findById(lead.visitId).select('+ipAddress').lean();
    const [types, link] = await Promise.all([
      visit ? this.events.distinct('eventType', { sourceId: visit.sourceId, externalVisitId: visit.externalVisitId,
        eventType: { $in: ['phone', 'zalo', 'inbox', 'contact', 'form_submit'] } }) : [],
      this.links.findOne({ leadId: lead._id }).lean(),
    ]);
    const { operationLock, ...data } = lead.toObject();
    const conversionTypes = conversionTypesFromEvidence(types, visit?.engagement);
    return { ...data, leadId: data._id, visit, link, conversionTypes,
      interactionKind: conversionTypes.length ? 'conversion' : 'click' };
  }

  async save(id: string, dto: SaveTrackingLeadDto, actor: string, draft?: any) {
    const lead = draft || await this.lead(id);
    if (lead.__v !== dto.version || lead.operationLock) throw new ConflictException('Hồ sơ đang xử lý hoặc đã thay đổi. Hãy tải lại.');
    if (await this.links.exists({ leadId: lead._id })) {
      if (dto.status !== lead.status) throw new BadRequestException('Đơn đã chính thức: xử lý trạng thái đơn tại OrderTest2');
      for (const key of ['agentId', 'supplierId', 'productId', 'adSelectionKey', 'orderDate', 'quantity', ...(dto.matchedEventId !== undefined ? ['matchedEventId'] : [])]) {
        const oldValue = key === 'orderDate' ? lead.orderDate?.toISOString() : String(lead.get(key) ?? '');
        const value = key === 'orderDate' ? (dto.orderDate ? new Date(dto.orderDate).toISOString() : undefined) : String(dto[key] ?? '');
        if (oldValue !== value) throw new BadRequestException('Đơn đã liên kết: thay đổi đại lý, sản phẩm hoặc nguồn ads phải xử lý tại OrderTest2.');
      }
    }
    if (dto.matchedEventId) {
      const visit = await this.visits.findById(lead.visitId).lean();
      const event = visit && await this.events.exists({ _id: dto.matchedEventId, sourceId: visit.sourceId,
        externalVisitId: visit.externalVisitId, eventType: { $in: ['phone', 'zalo', 'inbox', 'contact', 'form_submit'] } });
      if (!event) throw new BadRequestException('Chuyển đổi không thuộc lượt truy cập này');
      if (!dto.contactedAt || !dto.contactChannel || !dto.matchEvidence?.trim()) throw new BadRequestException('Nhập thời gian, kênh liên hệ và bằng chứng đối chiếu');
    }
    if (dto.matchConfidence && dto.matchConfidence !== 'unknown' && !dto.matchEvidence?.trim()) throw new BadRequestException('Ghi bằng chứng trước khi đánh giá mức đối chiếu');
    const selected = dto.adSelectionKey ? (await this.ads.list()).items.find(item => item.selectionKey === dto.adSelectionKey) : undefined;
    if (dto.adSelectionKey && !selected) throw new BadRequestException('Nhóm quảng cáo không còn trong danh sách ERP');
    const agent = dto.agentId ? await this.users.findOne({ _id: dto.agentId, role: { $in: ['internal_agent', 'external_agent'] }, isActive: true }).select('fullName role').lean() : null;
    if (dto.agentId && !agent) throw new BadRequestException('Tài khoản đại lý không hợp lệ');
    if (dto.supplierId && !await this.users.exists({ _id: dto.supplierId, role: { $in: ['internal_supplier', 'external_supplier'] }, isActive: true })) throw new BadRequestException('NCC không hợp lệ');
    if (dto.productId && !await this.products.exists({ _id: dto.productId })) throw new BadRequestException('Sản phẩm không tồn tại');
    const { version, ...fields } = dto;
    lead.set(fields);
    lead.productId = dto.productId ? new Types.ObjectId(dto.productId) : undefined;
    lead.supplierId = dto.supplierId ? new Types.ObjectId(dto.supplierId) : undefined;
    lead.orderDate = dto.orderDate ? new Date(dto.orderDate) : undefined;
    // Empty selection explicitly clears the resolved identity; raw visit evidence is untouched.
    lead.agentId = agent?._id;
    lead.agentNameSnapshot = agent?.fullName;
    lead.agentRoleSnapshot = agent?.role;
    lead.adsProvider = selected?.provider;
    lead.adAccountProviderId = selected?.accountId;
    lead.adCampaignId = selected?.campaignId;
    lead.adGroupId = selected?.adGroupId;
    lead.adGroupNameSnapshot = selected?.adGroupName;
    lead.updatedBy = new Types.ObjectId(actor);
    lead.matchMethod = dto.matchEvidence?.trim() ? 'manual' : 'unverified';
    lead.matchedBy = dto.matchEvidence?.trim() ? new Types.ObjectId(actor) : undefined;
    lead.matchedAt = dto.matchEvidence?.trim() ? new Date() : undefined;
    if (dto.status === 'confirmed' && (!agent || !selected)) throw new BadRequestException('Chọn nhóm quảng cáo và tài khoản đại lý trước khi xác nhận');
    await lead.save().catch(error => {
      if (error.code === 11000) throw new ConflictException('Lượt truy cập đã có hồ sơ. Hãy tải lại.');
      if (error.name === 'VersionError') throw new ConflictException('Hồ sơ vừa được người khác sửa');
      if (error.name === 'ValidationError') throw new BadRequestException('Kiểm tra thông tin hồ sơ và bằng chứng đối chiếu');
      throw error;
    });
    return this.detail(id);
  }

  async preview(id: string) {
    const lead = await this.lead(id);
    const missing: string[] = [];
    for (const [key, label] of [['agentId', 'tài khoản đại lý'], ['productId', 'sản phẩm'], ['supplierId', 'NCC'], ['adSelectionKey', 'nhóm quảng cáo'], ['orderDate', 'ngày đơn']]) {
      if (!lead.get(key)) missing.push(label);
    }
    if (missing.length) return { ready: false, reasons: missing.map(label => `Chưa chọn ${label}`) };
    const agent = await this.users.findOne({ _id: lead.agentId, isActive: true, role: { $in: ['internal_agent', 'external_agent'] } }).select('role').lean();
    if (!agent) throw new BadRequestException('Đại lý không còn hoạt động');
    await this.ads.resolve({ adGroupId: lead.adGroupId, adsProvider: lead.adsProvider as any, adAccountProviderId: lead.adAccountProviderId, adCampaignId: lead.adCampaignId });
    const context: any = {
      productId: lead.productId, supplierId: lead.supplierId, agentId: lead.agentId,
      quantity: lead.quantity || 1, orderDate: lead.orderDate, productSource: 'supplier',
      adGroupId: lead.adGroupId, retailSaleAmount: lead.saleTotal,
      orderStatus: 'Chưa có mã vận đơn', productionStatus: 'Chưa làm',
    };
    await this.calculation.autoCalculateQuoteFields(context);
    const reasons: string[] = [];
    if (!context.supplierQuoteId) reasons.push('Chưa có báo giá NCC được duyệt cho sản phẩm/ngày đơn');
    if (agent.role === 'external_agent' && !context.agentQuoteId) reasons.push('Chưa có báo giá đại lý được duyệt và còn hiệu lực');
    if (agent.role === 'internal_agent' && lead.saleTotal == null) reasons.push('Chưa nhập tổng tiền hàng đã chốt với khách');
    if (lead.status !== 'confirmed') reasons.push('Khách chưa chốt đơn');
    const revenue = agent.role === 'external_agent' ? (context.agentQuoteId ? context.agentAppliedPrice * context.quantity : null) : (lead.saleTotal ?? null);
    const cost = context.supplierQuoteId ? context.supplierAppliedPrice * context.quantity : null;
    return { ready: !reasons.length, reasons, saleMode: context.saleMode, agentQuoteId: context.agentQuoteId,
      agentUnitPrice: context.agentQuoteId ? context.agentAppliedPrice : null,
      supplierQuoteId: context.supplierQuoteId, supplierUnitPrice: context.supplierQuoteId ? context.supplierAppliedPrice : null,
      expectedRevenue: revenue, expectedGoodsCost: cost,
      goodsMargin: revenue != null && cost != null ? revenue - cost : null };
  }

  private assertOrderIdentity(lead: any, order: any) {
    if (!order) throw new NotFoundException('Không tìm thấy đơn');
    for (const key of ['agentId', 'productId', 'supplierId', 'adGroupId']) {
      if (!lead[key] || String(order[key]?._id || order[key] || '') !== String(lead[key])) throw new BadRequestException(`Đơn không khớp ${key}; không thể liên kết hoặc ghi đè`);
    }
    for (const key of ['adsProvider', 'adAccountProviderId', 'adCampaignId']) {
      if (String(order[key] || '') !== String(lead[key] || '')) throw new BadRequestException('Nguồn ads trên đơn không khớp hồ sơ');
    }
  }

  async promote(id: string, version: number, actor: string, user: any) {
    return this.locked(id, version, async lead => {
      if (lead.status !== 'confirmed') throw new BadRequestException('Chỉ chuyển sang OrderTest2 khi khách đã chốt đơn');
      const existing = await this.links.findOne({ leadId: lead._id });
      if (existing) return { orderId: String(existing.orderId), created: false };
      if (!lead.customerName?.trim() || !lead.phone?.trim()) throw new BadRequestException('Bổ sung tên và số điện thoại khách trước khi chuyển đơn');
      const preview = await this.preview(id);
      if (!preview.ready) throw new BadRequestException(preview.reasons);
      // The ERP order service owns pricing, quote snapshots and financial side effects.
      // A unique internal CRM key recovers an order saved before a failed link request.
      const order = await this.orders.create({
        customerName: lead.customerName, receiverName: lead.recipientName, receiverPhone: lead.phone,
        receiverAddress: lead.shippingAddress, serviceDetails: lead.notes,
        productId: String(lead.productId), supplierId: String(lead.supplierId), agentId: String(lead.agentId),
        quantity: lead.quantity || 1, orderDate: lead.orderDate.toISOString(), productSource: 'supplier',
        customerAcquisitionSource: 'ads', adsProvider: lead.adsProvider,
        adAccountProviderId: lead.adAccountProviderId, adCampaignId: lead.adCampaignId, adGroupId: lead.adGroupId,
        retailSaleAmount: lead.saleTotal, depositAmount: lead.deposit, codAmount: lead.codAmount,
      }, user, String(lead._id));
      this.assertOrderIdentity(lead, order);
      await this.links.updateOne({ leadId: lead._id, orderId: order._id }, { $setOnInsert: {
        linkedBy: new Types.ObjectId(actor), linkedAt: new Date(), lastSyncedLeadVersion: lead.__v,
      } }, { upsert: true });
      return { orderId: String(order._id), created: true };
    });
  }

  private async locked<T>(id: string, version: number, work: (lead: any) => Promise<T>) {
    const key = randomUUID();
    const lead = await this.leads.findOneAndUpdate({ _id: id, __v: version, operationLock: { $exists: false } },
      { $set: { operationLock: key }, $inc: { __v: 1 } }, { new: true });
    if (!lead) throw new ConflictException('Hồ sơ đang xử lý hoặc đã thay đổi. Hãy tải lại.');
    try { return await work(lead); }
    finally { await this.leads.updateOne({ _id: id, operationLock: key }, { $unset: { operationLock: 1 } }); }
  }

  async link(id: string, dto: LinkTrackingOrderDto, actor: string, user: any) {
    return this.locked(id, dto.version, async lead => {
      if (lead.status !== 'confirmed') throw new BadRequestException('Xác nhận hồ sơ trước khi liên kết');
      this.assertOrderIdentity(lead, await this.orders.findById(dto.orderId, user));
      try {
        await this.links.updateOne({ leadId: lead._id, orderId: new Types.ObjectId(dto.orderId) }, { $setOnInsert: {
          linkedBy: new Types.ObjectId(actor), linkedAt: new Date(), lastSyncedLeadVersion: -1,
        } }, { upsert: true });
      } catch (error) {
        if (error.code === 11000) throw new ConflictException('Hồ sơ hoặc đơn đã có liên kết khác');
        throw error;
      }
      return { linked: true };
    });
  }

  async sync(id: string, version: number, actor: string, user: any) {
    return this.locked(id, version, async lead => {
      if (lead.status !== 'confirmed') throw new BadRequestException('Hồ sơ chưa xác nhận');
      const link = await this.links.findOne({ leadId: lead._id });
      if (!link) throw new BadRequestException('Liên kết đơn OrderTest2 trước');
      const order = await this.orders.findById(String(link.orderId), user);
      this.assertOrderIdentity(lead, order);
      // Contact-only update: ERP owns all commercial snapshots and financial amounts.
      await this.orders.update(String(link.orderId), {
        customerName: lead.customerName, receiverName: lead.recipientName,
        receiverPhone: lead.phone, receiverAddress: lead.shippingAddress,
        serviceDetails: lead.notes,
      }, user, order.__v);
      link.lastSyncedLeadVersion = lead.__v;
      link.lastSyncedAt = new Date(); link.lastSyncedBy = new Types.ObjectId(actor);
      await link.save();
      return { orderId: String(link.orderId), synced: true };
    });
  }
}
