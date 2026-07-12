import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateSupplierQuoteDto } from './dto/create-supplier-quote.dto';
import { UpdateSupplierQuoteDto } from './dto/update-supplier-quote.dto';
import {
  SupplierQuote,
  SupplierQuoteApprovalStatus,
  SupplierQuoteDocument,
  SUPPLIER_QUOTE_APPROVAL_STATUSES,
} from './schemas/supplier-quote.schema';

@Injectable()
export class SupplierQuoteService {
  private readonly logger = new Logger(SupplierQuoteService.name);

  constructor(@InjectModel(SupplierQuote.name) private model: Model<SupplierQuoteDocument>) {}

  async create(dto: CreateSupplierQuoteDto, currentUser: any) {
    const actor = this.actor(currentUser);
    const effectiveAt = dto.effectiveAt ? new Date(dto.effectiveAt) : new Date();

    // Validate: Không cho phép tạo quote với effectiveAt trong quá khứ (chỉ cảnh báo)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (effectiveAt < today) {
      this.logger.warn(`Creating quote with past effectiveAt: ${effectiveAt.toISOString()}`);
    }

    const doc = await this.model.create({
      productId: new Types.ObjectId(dto.productId),
      supplierId: new Types.ObjectId(dto.supplierId),
      price: Number(dto.price),
      currency: dto.currency || 'VND',
      effectiveAt,
      note: dto.note,
      isReturnableOverride: dto.isReturnableOverride,
      shippingFee: dto.shippingFee ?? 0,
      returnFee: dto.returnFee ?? 0,
      // Never trust client input or legacy defaults for approval.
      approvalStatus: 'pending',
      createdBy: actor.id,
      lastCommercialEditedBy: actor.id,
      approvalHistory: [{
        decision: 'created',
        actorId: actor.id,
        actorLabel: actor.label,
        at: new Date(),
        reason: 'Quote created and submitted for independent approval.',
        priceSnapshot: Number(dto.price),
      }],
    });

    this.logger.log(`Created pending SupplierQuote ${String(doc._id)}`);
    return this.normalizeQuote(doc.toObject());
  }

  async update(id: string, dto: UpdateSupplierQuoteDto, currentUser: any) {
    const doc = await this.loadQuote(id);
    const approvalRelevantChanged =
      (dto.productId !== undefined && String(dto.productId) !== String(doc.productId))
      || (dto.supplierId !== undefined && String(dto.supplierId) !== String(doc.supplierId))
      || (dto.price !== undefined && Number(dto.price) !== Number(doc.price))
      || (dto.currency !== undefined && String(dto.currency).trim().toUpperCase() !== String(doc.currency).trim().toUpperCase())
      || (dto.effectiveAt !== undefined && new Date(dto.effectiveAt).getTime() !== new Date(doc.effectiveAt || 0).getTime())
      || (dto.isReturnableOverride !== undefined && dto.isReturnableOverride !== doc.isReturnableOverride)
      || (dto.shippingFee !== undefined && Number(dto.shippingFee) !== Number(doc.shippingFee || 0))
      || (dto.returnFee !== undefined && Number(dto.returnFee) !== Number(doc.returnFee || 0));

    if (dto.productId !== undefined) doc.productId = this.objectId(dto.productId, 'productId');
    if (dto.supplierId !== undefined) doc.supplierId = this.objectId(dto.supplierId, 'supplierId');
    if (dto.price !== undefined) doc.price = Number(dto.price);
    if (dto.currency !== undefined) doc.currency = String(dto.currency || 'VND').trim().toUpperCase();
    if (dto.effectiveAt !== undefined) doc.effectiveAt = new Date(dto.effectiveAt);
    if (dto.note !== undefined) doc.note = dto.note;
    if (dto.isReturnableOverride !== undefined) doc.isReturnableOverride = dto.isReturnableOverride;
    if (dto.shippingFee !== undefined) doc.shippingFee = Number(dto.shippingFee);
    if (dto.returnFee !== undefined) doc.returnFee = Number(dto.returnFee);

    if (approvalRelevantChanged) {
      const actor = this.actor(currentUser);
      // A commercial edit is also the safe legacy provenance-repair path. The
      // editor cannot decide the quote afterwards.
      if (!this.validActorId(doc.createdBy)) doc.createdBy = actor.id;
      doc.lastCommercialEditedBy = actor.id;
      this.appendAudit(doc, {
        decision: 'reset_to_pending',
        actorId: actor.id,
        actorLabel: actor.label,
        at: new Date(),
        reason: 'Quote commercial terms changed; prior approval is no longer valid.',
        priceSnapshot: Number(doc.price),
      });
      doc.approvalStatus = 'pending';
      doc.approvedBy = undefined;
      doc.approvedAt = undefined;
      doc.rejectedBy = undefined;
      doc.rejectedAt = undefined;
      doc.rejectionReason = undefined;
    }

    await this.saveWithConcurrency(doc);
    this.logger.log(`Updated SupplierQuote ${String(doc._id)}${approvalRelevantChanged ? ' and reset approval to pending' : ''}`);
    return this.normalizeQuote(doc.toObject());
  }

  async approve(id: string, currentUser: any) {
    const doc = await this.loadQuote(id);
    const actor = this.actor(currentUser);
    this.assertIndependentDecisionActor(doc, actor);
    if (this.normalizedStatus(doc.approvalStatus) === 'approved') {
      return this.normalizeQuote(doc.toObject());
    }

    const at = new Date();
    doc.approvalStatus = 'approved';
    doc.approvedBy = actor.id;
    doc.approvedAt = at;
    doc.rejectedBy = undefined;
    doc.rejectedAt = undefined;
    doc.rejectionReason = undefined;
    this.appendAudit(doc, {
      decision: 'approved',
      actorId: actor.id,
      actorLabel: actor.label,
      at,
      priceSnapshot: Number(doc.price),
    });
    await this.saveWithConcurrency(doc);
    this.logger.log(`Approved SupplierQuote ${String(doc._id)} by user ${String(actor.id)}`);
    return this.normalizeQuote(doc.toObject());
  }

  async reject(id: string, currentUser: any, reason: string) {
    const normalizedReason = String(reason || '').trim();
    if (!normalizedReason) throw new BadRequestException('Lý do từ chối là bắt buộc');

    const doc = await this.loadQuote(id);
    const actor = this.actor(currentUser);
    this.assertIndependentDecisionActor(doc, actor);
    const at = new Date();
    doc.approvalStatus = 'rejected';
    doc.rejectedBy = actor.id;
    doc.rejectedAt = at;
    doc.rejectionReason = normalizedReason;
    doc.approvedBy = undefined;
    doc.approvedAt = undefined;
    this.appendAudit(doc, {
      decision: 'rejected',
      actorId: actor.id,
      actorLabel: actor.label,
      at,
      reason: normalizedReason,
      priceSnapshot: Number(doc.price),
    });
    await this.saveWithConcurrency(doc);
    this.logger.log(`Rejected SupplierQuote ${String(doc._id)} by user ${String(actor.id)}`);
    return this.normalizeQuote(doc.toObject());
  }

  async claimProvenance(id: string, currentUser: any) {
    const doc = await this.loadQuote(id);
    const hasCreator = this.validActorId(doc.createdBy);
    const hasEditor = this.validActorId(doc.lastCommercialEditedBy);
    if (hasCreator && hasEditor) {
      throw new ConflictException('Quote provenance is already complete');
    }

    const actor = this.actor(currentUser);
    if (!hasCreator) doc.createdBy = actor.id;
    if (!hasEditor) doc.lastCommercialEditedBy = actor.id;
    doc.approvalStatus = 'pending';
    doc.approvedBy = undefined;
    doc.approvedAt = undefined;
    doc.rejectedBy = undefined;
    doc.rejectedAt = undefined;
    doc.rejectionReason = undefined;
    this.appendAudit(doc, {
      decision: 'provenance_claimed',
      actorId: actor.id,
      actorLabel: actor.label,
      at: new Date(),
      reason: 'Legacy quote provenance claimed; an independent actor must approve or reject.',
      priceSnapshot: Number(doc.price),
    });
    await this.saveWithConcurrency(doc);
    this.logger.log(`Claimed SupplierQuote provenance ${String(doc._id)} by user ${String(actor.id)}`);
    return this.normalizeQuote(doc.toObject());
  }

  async findAll(params: {
    productId?: string;
    supplierId?: string;
    approvalStatus?: SupplierQuoteApprovalStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(params.limit) || 50));
    const query: any = {};
    if (params.productId) query.productId = new Types.ObjectId(params.productId);
    if (params.supplierId) query.supplierId = new Types.ObjectId(params.supplierId);
    if (params.approvalStatus) {
      if (!SUPPLIER_QUOTE_APPROVAL_STATUSES.includes(params.approvalStatus)) {
        throw new BadRequestException('approvalStatus không hợp lệ');
      }
      if (params.approvalStatus === 'pending') {
        query.$or = [
          { approvalStatus: 'pending' },
          { approvalStatus: { $exists: false } },
        ];
      } else {
        query.approvalStatus = params.approvalStatus;
      }
    }

    const [total, data] = await Promise.all([
      this.model.countDocuments(query),
      this.model.find(query).sort({ effectiveAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);

    return {
      data: data.map((row) => this.normalizeQuote(row)),
      pagination: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 },
    };
  }

  async getLatest(productId: string, supplierId: string) {
    const doc = await this.model
      .findOne({ productId: new Types.ObjectId(productId), supplierId: new Types.ObjectId(supplierId) })
      .sort({ effectiveAt: -1, createdAt: -1 })
      .lean();
    if (!doc) throw new NotFoundException('Chưa có báo giá');
    return this.normalizeQuote(doc);
  }

  /**
   * Get effective quote at a specific date
   * Tìm quote có effectiveAt <= targetDate, mới nhất
   */
  async getEffectiveAt(productId: string, supplierId: string, targetDate: Date) {
    const doc = await this.model
      .findOne({
        productId: new Types.ObjectId(productId),
        supplierId: new Types.ObjectId(supplierId),
        // Legacy rows without approvalStatus are intentionally excluded.
        approvalStatus: 'approved',
        $or: [
          { effectiveAt: { $lte: targetDate } },
          { effectiveAt: { $exists: false } },
        ],
      })
      .sort({ effectiveAt: -1, createdAt: -1 })
      .lean();
    return doc ? this.normalizeQuote(doc) : null; // Có thể null nếu chưa có quote đã duyệt
  }

  /**
   * Get price history for a product-supplier pair
   * Trả về danh sách các quote theo thời gian
   */
  async getPriceHistory(productId: string, supplierId: string): Promise<{
    history: Array<{
      _id: string;
      price: number;
      effectiveAt: Date;
      createdAt: Date;
      note?: string;
      approvalStatus: SupplierQuoteApprovalStatus;
    }>;
    stats: {
      minPrice: number;
      maxPrice: number;
      avgPrice: number;
      currentPrice: number;
      quoteCount: number;
    };
  }> {
    const quotes = await this.model
      .find({
        productId: new Types.ObjectId(productId),
        supplierId: new Types.ObjectId(supplierId)
      })
      .sort({ effectiveAt: -1, createdAt: -1 })
      .lean();

    if (quotes.length === 0) {
      return {
        history: [],
        stats: {
          minPrice: 0,
          maxPrice: 0,
          avgPrice: 0,
          currentPrice: 0,
          quoteCount: 0,
        },
      };
    }

    const prices = quotes.map(q => q.price);
    const currentPrice = quotes[0].price;

    return {
      history: quotes.map(q => ({
        _id: q._id.toString(),
        price: q.price,
        effectiveAt: q.effectiveAt || (q as any).createdAt,
        createdAt: (q as any).createdAt,
        note: q.note,
        approvalStatus: this.normalizedStatus(q.approvalStatus),
      })),
      stats: {
        minPrice: Math.min(...prices),
        maxPrice: Math.max(...prices),
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        currentPrice,
        quoteCount: quotes.length,
      },
    };
  }

  /**
   * Get all active quotes for a supplier
   * Để xem tổng quan báo giá của 1 NCC
   */
  async getSupplierQuotes(supplierId: string): Promise<{
    quotes: Array<{
      productId: string;
      productName?: string;
      currentPrice: number;
      effectiveAt: Date;
      quoteCount: number;
      approvalStatus: SupplierQuoteApprovalStatus;
    }>;
    totalProducts: number;
  }> {
    // Aggregate để lấy quote mới nhất cho mỗi sản phẩm
    const result = await this.model.aggregate([
      { $match: { supplierId: new Types.ObjectId(supplierId) } },
      { $sort: { productId: 1, effectiveAt: -1, createdAt: -1 } },
      {
        $group: {
          _id: '$productId',
          latestQuote: { $first: '$$ROOT' },
          quoteCount: { $sum: 1 },
        },
      },
      {
        $project: {
          productId: '$_id',
          currentPrice: '$latestQuote.price',
          effectiveAt: '$latestQuote.effectiveAt',
          approvalStatus: { $ifNull: ['$latestQuote.approvalStatus', 'pending'] },
          quoteCount: 1,
        },
      },
    ]);

    return {
      quotes: result.map(r => ({
        productId: r.productId.toString(),
        currentPrice: r.currentPrice,
        effectiveAt: r.effectiveAt,
        approvalStatus: this.normalizedStatus(r.approvalStatus),
        quoteCount: r.quoteCount,
      })),
      totalProducts: result.length,
    };
  }

  private async loadQuote(id: string): Promise<SupplierQuoteDocument> {
    const objectId = this.objectId(id, 'id');
    const doc = await this.model.findById(objectId);
    if (!doc) throw new NotFoundException('Không tìm thấy báo giá nhà cung cấp');
    return doc;
  }

  private objectId(value: string, field: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`${field} không hợp lệ`);
    }
    return new Types.ObjectId(value);
  }

  private actor(currentUser: any): { id: Types.ObjectId; label?: string } {
    const rawId = String(currentUser?.id || currentUser?._id || '').trim();
    if (!Types.ObjectId.isValid(rawId)) {
      throw new BadRequestException('Không xác định được người thực hiện');
    }
    const label = String(currentUser?.fullName || currentUser?.email || '').trim().slice(0, 200) || undefined;
    return { id: new Types.ObjectId(rawId), label };
  }

  private validActorId(value: unknown): boolean {
    return Types.ObjectId.isValid(String(value || ''));
  }

  private assertIndependentDecisionActor(
    doc: SupplierQuoteDocument,
    actor: { id: Types.ObjectId },
  ): void {
    if (!this.validActorId(doc.createdBy) || !this.validActorId(doc.lastCommercialEditedBy)) {
      throw new ConflictException(
        'Quote lacks trusted provenance. A purchase-costs user must claim provenance or update commercial terms before another user decides it.',
      );
    }
    const actorId = String(actor.id);
    if (actorId === String(doc.createdBy) || actorId === String(doc.lastCommercialEditedBy)) {
      throw new ForbiddenException(
        'Separation of duties requires a different user to approve or reject this quote',
      );
    }
  }

  private appendAudit(doc: SupplierQuoteDocument, entry: Record<string, unknown>): void {
    doc.approvalHistory = [
      ...(doc.approvalHistory || []),
      entry,
    ].slice(-100) as any;
    doc.markModified('approvalHistory');
  }

  private async saveWithConcurrency(doc: SupplierQuoteDocument): Promise<void> {
    try {
      await doc.save();
    } catch (error: any) {
      if (error?.name === 'VersionError') {
        throw new ConflictException(
          'Supplier quote changed concurrently. Reload it and retry the action.',
        );
      }
      throw error;
    }
  }

  private normalizedStatus(value: unknown): SupplierQuoteApprovalStatus {
    return ['approved', 'rejected'].includes(String(value || '').toLowerCase())
      ? String(value).toLowerCase() as SupplierQuoteApprovalStatus
      : 'pending';
  }

  private normalizeQuote(row: any): any {
    return {
      ...row,
      approvalStatus: this.normalizedStatus(row.approvalStatus),
      approvalHistory: Array.isArray(row.approvalHistory) ? row.approvalHistory : [],
      provenanceComplete: this.validActorId(row.createdBy)
        && this.validActorId(row.lastCommercialEditedBy),
    };
  }
}
