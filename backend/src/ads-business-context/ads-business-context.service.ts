import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CreateBusinessDailyNoteDto,
  CreateLandingPageDto,
  UpdateBusinessDailyNoteDto,
  UpdateLandingPageDto,
} from './dto/ads-business-context.dto';
import { BusinessDailyNote, BusinessDailyNoteDocument } from './schemas/business-daily-note.schema';
import { LandingPage, LandingPageApprovalStatus, LandingPageDocument } from './schemas/landing-page.schema';

type ListQuery = { page?: number; limit?: number };

@Injectable()
export class AdsBusinessContextService {
  constructor(
    @InjectModel(LandingPage.name)
    private readonly landingPageModel: Model<LandingPageDocument>,
    @InjectModel(BusinessDailyNote.name)
    private readonly businessDailyNoteModel: Model<BusinessDailyNoteDocument>,
  ) {}

  async createLandingPage(dto: CreateLandingPageDto, currentUser: any) {
    const actor = this.actor(currentUser);
    const normalized = this.normalizeLandingUrl(dto.url);
    try {
      return await this.landingPageModel.create({
        url: normalized.url,
        domain: normalized.domain,
        productId: new Types.ObjectId(dto.productId),
        title: clean(dto.title),
        mainCta: clean(dto.mainCta),
        notes: clean(dto.notes),
        lastCheckedAt: dto.lastCheckedAt ? new Date(dto.lastCheckedAt) : undefined,
        approvalStatus: 'pending',
        status: 'pending',
        approvedForAds: false,
        createdByUserId: actor.id,
        createdBy: actor.label,
        updatedByUserId: actor.id,
        updatedBy: actor.label,
        approvalHistory: [],
      });
    } catch (error: any) {
      if (error?.code === 11000) throw new ConflictException('Landing page URL already exists.');
      throw error;
    }
  }

  async listLandingPages(query: ListQuery & {
    approvalStatus?: LandingPageApprovalStatus;
    productId?: string;
    domain?: string;
  }) {
    const { page, limit, skip } = this.pagination(query);
    const filter: Record<string, any> = {};
    if (query.approvalStatus) {
      if (!['pending', 'approved', 'rejected'].includes(query.approvalStatus)) {
        throw new BadRequestException('Invalid landing page approvalStatus.');
      }
      filter.approvalStatus = query.approvalStatus;
    }
    if (query.productId) filter.productId = this.objectId(query.productId, 'productId');
    if (query.domain) filter.domain = String(query.domain).trim().toLowerCase();
    const [data, total] = await Promise.all([
      this.landingPageModel.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.landingPageModel.countDocuments(filter).exec(),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getLandingPage(id: string) {
    const row = await this.landingPageModel.findById(this.objectId(id, 'id')).lean().exec();
    if (!row) throw new NotFoundException('Landing page not found.');
    return row;
  }

  async updateLandingPage(id: string, dto: UpdateLandingPageDto, currentUser: any) {
    const page: any = await this.landingPageModel.findById(this.objectId(id, 'id'));
    if (!page) throw new NotFoundException('Landing page not found.');
    const actor = this.actor(currentUser);
    let commercialChanged = false;

    if (dto.url !== undefined) {
      const normalized = this.normalizeLandingUrl(dto.url);
      commercialChanged ||= normalized.url !== page.url || normalized.domain !== page.domain;
      page.url = normalized.url;
      page.domain = normalized.domain;
    }
    if (dto.productId !== undefined) {
      commercialChanged ||= String(page.productId) !== dto.productId;
      page.productId = new Types.ObjectId(dto.productId);
    }
    for (const field of ['title', 'mainCta'] as const) {
      if (dto[field] === undefined) continue;
      const value = clean(dto[field]);
      commercialChanged ||= String(page[field] || '') !== String(value || '');
      page[field] = value;
    }
    if (dto.notes !== undefined) page.notes = clean(dto.notes);
    if (dto.lastCheckedAt !== undefined) page.lastCheckedAt = new Date(dto.lastCheckedAt);

    if (commercialChanged && page.approvalStatus !== 'pending') {
      this.resetLandingApproval(page, actor, 'Commercial landing page fields changed.');
    }
    page.updatedByUserId = actor.id;
    page.updatedBy = actor.label;
    try {
      return await page.save();
    } catch (error: any) {
      if (error?.code === 11000) throw new ConflictException('Landing page URL already exists.');
      throw error;
    }
  }

  async approveLandingPage(id: string, currentUser: any) {
    const page: any = await this.landingPageModel.findById(this.objectId(id, 'id'));
    if (!page) throw new NotFoundException('Landing page not found.');
    this.assertAllowedLandingDomain(page.domain);
    const actor = this.actor(currentUser);
    const at = new Date();
    page.approvalStatus = 'approved';
    page.status = 'approved';
    page.approvedForAds = true;
    page.approvedByUserId = actor.id;
    page.approvedBy = actor.label;
    page.approvedAt = at;
    page.rejectedByUserId = undefined;
    page.rejectedBy = undefined;
    page.rejectedAt = undefined;
    page.rejectionReason = undefined;
    page.updatedByUserId = actor.id;
    page.updatedBy = actor.label;
    page.approvalHistory = [
      ...(page.approvalHistory || []),
      { decision: 'approved', actorId: actor.id, actorLabel: actor.label, at },
    ];
    return page.save();
  }

  async rejectLandingPage(id: string, reason: string, currentUser: any) {
    const page: any = await this.landingPageModel.findById(this.objectId(id, 'id'));
    if (!page) throw new NotFoundException('Landing page not found.');
    const normalizedReason = clean(reason);
    if (!normalizedReason) throw new BadRequestException('Landing page rejection reason is required.');
    const actor = this.actor(currentUser);
    const at = new Date();
    page.approvalStatus = 'rejected';
    page.status = 'rejected';
    page.approvedForAds = false;
    page.approvedByUserId = undefined;
    page.approvedBy = undefined;
    page.approvedAt = undefined;
    page.rejectedByUserId = actor.id;
    page.rejectedBy = actor.label;
    page.rejectedAt = at;
    page.rejectionReason = normalizedReason;
    page.updatedByUserId = actor.id;
    page.updatedBy = actor.label;
    page.approvalHistory = [
      ...(page.approvalHistory || []),
      { decision: 'rejected', actorId: actor.id, actorLabel: actor.label, at, reason: normalizedReason },
    ];
    return page.save();
  }

  async createDailyNote(dto: CreateBusinessDailyNoteDto, currentUser: any) {
    this.assertBusinessDate(dto.date);
    const actor = this.actor(currentUser);
    return this.businessDailyNoteModel.create({
      date: dto.date,
      summary: clean(dto.summary),
      notes: clean(dto.notes),
      anomalies: uniqueClean(dto.anomalies || []),
      source: dto.source || 'manual',
      affectedCustomerId: clean(dto.affectedCustomerId),
      affectedCampaignId: clean(dto.affectedCampaignId),
      affectedAdGroupId: clean(dto.affectedAdGroupId),
      affectedProductId: dto.affectedProductId ? new Types.ObjectId(dto.affectedProductId) : undefined,
      severity: dto.severity || 'info',
      createdByUserId: actor.id,
      createdBy: actor.label,
      updatedByUserId: actor.id,
      updatedBy: actor.label,
    });
  }

  async listDailyNotes(query: ListQuery & { dateFrom?: string; dateTo?: string; source?: string }) {
    const { page, limit, skip } = this.pagination(query);
    const filter: Record<string, any> = {};
    if (query.dateFrom || query.dateTo) {
      filter.date = {};
      if (query.dateFrom) {
        this.assertBusinessDate(query.dateFrom);
        filter.date.$gte = query.dateFrom;
      }
      if (query.dateTo) {
        this.assertBusinessDate(query.dateTo);
        filter.date.$lte = query.dateTo;
      }
      if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
        throw new BadRequestException('Daily note date range is invalid.');
      }
    }
    if (query.source) filter.source = query.source;
    const [data, total] = await Promise.all([
      this.businessDailyNoteModel.find(filter).sort({ date: -1, updatedAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.businessDailyNoteModel.countDocuments(filter).exec(),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getDailyNote(id: string) {
    const row = await this.businessDailyNoteModel.findById(this.objectId(id, 'id')).lean().exec();
    if (!row) throw new NotFoundException('Business daily note not found.');
    return row;
  }

  async updateDailyNote(id: string, dto: UpdateBusinessDailyNoteDto, currentUser: any) {
    const note: any = await this.businessDailyNoteModel.findById(this.objectId(id, 'id'));
    if (!note) throw new NotFoundException('Business daily note not found.');
    if (dto.date !== undefined) {
      this.assertBusinessDate(dto.date);
      note.date = dto.date;
    }
    for (const field of [
      'summary', 'notes', 'affectedCustomerId', 'affectedCampaignId', 'affectedAdGroupId',
    ] as const) {
      if (dto[field] !== undefined) note[field] = clean(dto[field]);
    }
    if (dto.anomalies !== undefined) note.anomalies = uniqueClean(dto.anomalies);
    if (dto.source !== undefined) note.source = dto.source;
    if (dto.severity !== undefined) note.severity = dto.severity;
    if (dto.affectedProductId !== undefined) {
      note.affectedProductId = new Types.ObjectId(dto.affectedProductId);
    }
    const actor = this.actor(currentUser);
    note.updatedByUserId = actor.id;
    note.updatedBy = actor.label;
    return note.save();
  }

  private resetLandingApproval(page: any, actor: { id?: string; label?: string }, reason: string) {
    const at = new Date();
    page.approvalStatus = 'pending';
    page.status = 'pending';
    page.approvedForAds = false;
    page.approvedByUserId = undefined;
    page.approvedBy = undefined;
    page.approvedAt = undefined;
    page.rejectedByUserId = undefined;
    page.rejectedBy = undefined;
    page.rejectedAt = undefined;
    page.rejectionReason = undefined;
    page.approvalResetAt = at;
    page.approvalHistory = [
      ...(page.approvalHistory || []),
      { decision: 'reset_to_pending', actorId: actor.id, actorLabel: actor.label, at, reason },
    ];
  }

  private assertAllowedLandingDomain(domain: string) {
    const allowed = String(
      process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST
      || process.env.AI_MARKETING_LANDING_PAGE_ALLOWLIST
      || '',
    ).split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
    if (!allowed.length) {
      throw new BadRequestException('Landing page allowlist is not configured; approval is blocked.');
    }
    const normalized = String(domain || '').toLowerCase();
    if (!allowed.some((item) => normalized === item || normalized.endsWith(`.${item}`))) {
      throw new BadRequestException('Landing page domain is not in the configured ads allowlist.');
    }
  }

  private normalizeLandingUrl(value: string) {
    try {
      const url = new URL(String(value || '').trim());
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
      url.search = '';
      url.hash = '';
      return { url: url.toString(), domain: url.hostname.toLowerCase() };
    } catch {
      throw new BadRequestException('Landing page URL must be a safe HTTP(S) URL.');
    }
  }

  private assertBusinessDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Business note date must use YYYY-MM-DD.');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('Business note date is invalid.');
    }
  }

  private objectId(value: string, field: string) {
    if (!Types.ObjectId.isValid(value)) throw new BadRequestException(`${field} is invalid.`);
    return new Types.ObjectId(value);
  }

  private pagination(query: ListQuery) {
    const page = Math.max(1, Number.isFinite(Number(query.page)) ? Math.floor(Number(query.page)) : 1);
    const limit = Math.max(1, Math.min(200, Number.isFinite(Number(query.limit)) ? Math.floor(Number(query.limit)) : 50));
    return { page, limit, skip: (page - 1) * limit };
  }

  private actor(currentUser: any): { id?: string; label?: string } {
    const id = clean(currentUser?.id || currentUser?._id || currentUser?.userId || currentUser?.sub);
    const label = clean(currentUser?.fullName || currentUser?.email || currentUser?.username || id);
    return { id, label };
  }
}

function clean(value: unknown): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized || undefined;
}

function uniqueClean(values: unknown[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean) as string[]));
}
