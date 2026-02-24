/**
 * File: advertising-cost/advertising-cost.service.ts
 * Má»¥c Ä‘Ã­ch: Xá»­ lÃ½ nghiá»‡p vá»¥ CRUD cho Chi PhÃ­ Quáº£ng CÃ¡o.
 */
import { Injectable, NotFoundException, BadRequestException, Inject, Logger, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { AdvertisingCost, AdvertisingCostDocument } from './schemas/advertising-cost.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import { CreateAdvertisingCostDto } from './dto/create-advertising-cost.dto';
import { UpdateAdvertisingCostDto } from './dto/update-advertising-cost.dto';
import { ChatMessage, ChatMessageDocument } from '../chat-message/schemas/chat-message.schema';
import { TestOrder2Service } from '../test-order2/test-order2.service';

@Injectable()
export class AdvertisingCostService {
  private readonly logger = new Logger(AdvertisingCostService.name);

  // Chuáº©n hoÃ¡ vá» Ä‘áº§u ngÃ y theo UTC (00:00:00.000Z)
  private toUtcStartOfDay(d: Date | string): Date {
    const date = typeof d === 'string' ? new Date(d) : new Date(d);
    if (isNaN(date.getTime())) return date;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  // XÃ¡c Ä‘á»‹nh kÃªnh tá»« adGroup náº¿u chÆ°a cÃ³ (fallback facebook)
  private async inferChannel(adGroupId?: string, incoming?: string): Promise<'facebook' | 'google' | 'tiktok' | 'zalo' | 'other'> {
    if (incoming) return incoming as any;
    if (adGroupId) {
      const grp = await this.adGroupModel.findOne({ adGroupId }).select('platform').lean();
      if (grp?.platform) return grp.platform as any;
    }
    return 'facebook';
  }

  private toDayIso(value?: Date | string | null): string | null {
    if (!value) return null;
    const day = this.toUtcStartOfDay(value);
    if (isNaN(day.getTime())) return null;
    return day.toISOString().slice(0, 10);
  }

  private async triggerRecalculateForDates(values: Array<Date | string | null | undefined>): Promise<void> {
    const daySet = new Set<string>();
    for (const value of values) {
      const iso = this.toDayIso(value ?? null);
      if (iso) daySet.add(iso);
    }

    for (const dayIso of daySet) {
      try {
        await this.testOrder2Service.recalculateOrdersForDate(dayIso);
      } catch (error: any) {
        this.logger.error(`Failed to recalculate orders after advertising cost change for ${dayIso}`, error);
      }
    }
  }

  constructor(
    @InjectModel(AdvertisingCost.name)
    private readonly model: Model<AdvertisingCostDocument>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(ChatMessage.name)
    private readonly chatMessageModel: Model<ChatMessageDocument>,
    @Inject(forwardRef(() => TestOrder2Service))
    private readonly testOrder2Service: TestOrder2Service,
  ) {}

  async create(dto: CreateAdvertisingCostDto): Promise<AdvertisingCost> {
    const channel = await this.inferChannel(dto.adGroupId, dto.channel as any);
    const payload: Partial<AdvertisingCost> = {
      adGroupId: dto.adGroupId.trim(),
      channel,
      frequency: dto.frequency,
      spentAmount: dto.spentAmount ?? 0,
      cpm: dto.cpm ?? 0,
      cpc: dto.cpc ?? 0,
      impressions: dto.impressions ?? 0,
      clicks: dto.clicks ?? 0,
      reach: dto.reach ?? 0,
      messagingConversationStarted7d: dto.messagingConversationStarted7d ?? 0,
      costPerMessagingConversation: dto.costPerMessagingConversation ?? 0,
      messagingFirstReply: dto.messagingFirstReply ?? 0,
    };
    if (dto.date) payload.date = this.toUtcStartOfDay(dto.date);
    const created = new this.model(payload);
    const saved = await created.save();
    await this.triggerRecalculateForDates([saved.date as any]);
    return saved;
  }

  async findAll(query?: any): Promise<any[]> {
    // Optional filter by adAccountId via associated adGroup
    let adGroupIdFilter: string[] | undefined;
    if (query?.adAccountId) {
      const groups = await this.adGroupModel.find({ adAccountId: query.adAccountId }).select('adGroupId').lean();
      adGroupIdFilter = groups.map(g => g.adGroupId);
      if (adGroupIdFilter.length === 0) {
        return []; // No groups => no costs
      }
    }

    const findCond: any = {};
    if (adGroupIdFilter) findCond.adGroupId = { $in: adGroupIdFilter };
    if (query?.channel && query.channel !== 'all') findCond.channel = query.channel;

    const costs = await this.model.find(findCond).sort({ date: -1, createdAt: -1 }).lean();

    // Enrich with ad account info (name + accountId) by joining through adGroup
    if (costs.length === 0) return costs as any[];
    const uniqueAdGroupIds = Array.from(new Set(costs.map(c => c.adGroupId)));
    const adGroups = await this.adGroupModel.find({ adGroupId: { $in: uniqueAdGroupIds } })
      .select('adGroupId adAccountId')
      .lean();
    const adAccountIds = Array.from(new Set(adGroups.map(g => String(g.adAccountId))));
    const adAccounts = await this.adAccountModel.find({ _id: { $in: adAccountIds } })
      .select('name accountId')
      .lean();
    const adGroupMap = new Map(adGroups.map(g => [g.adGroupId, g]));
    const adAccountMap = new Map(adAccounts.map(a => [String(a._id), a]));

    return costs.map(c => {
      const grp: any = adGroupMap.get(c.adGroupId);
      const acc: any = grp ? adAccountMap.get(String(grp.adAccountId)) : null;
      return {
        ...c,
        channel: c.channel || (grp?.platform as any) || 'facebook',
        adAccountId: grp?.adAccountId ? String(grp.adAccountId) : undefined,
        adAccountName: acc?.name,
        adAccountAccountId: acc?.accountId,
      };
    });
  }

  async findOne(id: string): Promise<AdvertisingCost> {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y chi phÃ­ quáº£ng cÃ¡o');
    return doc as any;
  }

  async update(id: string, dto: UpdateAdvertisingCostDto): Promise<AdvertisingCost> {
    const existing = await this.model.findById(id).lean();
    if (!existing) throw new NotFoundException('Advertising cost not found');

    const update: Partial<AdvertisingCost> = { ...dto } as any;
    if (dto.channel) (update as any).channel = dto.channel;
    if (dto.date) (update as any).date = this.toUtcStartOfDay(dto.date);
    const doc = await this.model.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!doc) throw new NotFoundException('Advertising cost not found');
    await this.triggerRecalculateForDates([existing.date as any, (doc as any).date as any]);
    return doc as any;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.model.findById(id).lean();
    if (!existing) throw new NotFoundException('Advertising cost not found');

    const res = await this.model.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Advertising cost not found');
    await this.triggerRecalculateForDates([existing.date as any]);
  }

  async summary(filter?: { channel?: string }) {
    const match: any = {};
    if (filter?.channel && filter.channel !== 'all') match.channel = filter.channel;

    const pipeline: any[] = [];
    if (Object.keys(match).length) pipeline.push({ $match: match });
    pipeline.push({
      $group: {
        _id: null,
        totalSpent: { $sum: { $ifNull: ['$spentAmount', 0] } },
        count: { $count: {} },
        avgCPM: { $avg: { $ifNull: ['$cpm', 0] } },
        avgCPC: { $avg: { $ifNull: ['$cpc', 0] } },
      },
    });

    const agg = await this.model.aggregate(pipeline);
    return agg[0] || { totalSpent: 0, count: 0, avgCPM: 0, avgCPC: 0 };
  }

  // Láº¥y chi phÃ­ ngÃ y hÃ´m qua cho advertising-cost-suggestion
  async getYesterdaySpentByAdGroups(): Promise<{ [adGroupId: string]: number }> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    console.log(`Querying advertising costs for yesterday: ${yesterday.toISOString()} to ${endOfYesterday.toISOString()}`);

    const results = await this.model
      .find({
        date: {
          $gte: yesterday,
          $lte: endOfYesterday
        }
      })
      .select('adGroupId spentAmount date')
      .lean()
      .exec();

    console.log(`Found ${results.length} advertising cost records for yesterday`);

    // Convert to map for easy lookup - default 0 if no data
    const spentMap: { [adGroupId: string]: number } = {};
    results.forEach(result => {
      const spentAmount = result.spentAmount || 0;
      spentMap[result.adGroupId] = spentAmount;
      console.log(`AdGroup ${result.adGroupId}: spent ${spentAmount} on ${result.date}`);
    });

    return spentMap;
  }

  // Láº¥y tá»•ng chi phÃ­ theo adGroupId
  async getTotalSpentByAdGroup(adGroupId: string): Promise<{ totalSpent: number }> {
    const agg = await this.model.aggregate([
      { $match: { adGroupId: adGroupId } },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: { $ifNull: ['$spentAmount', 0] } }
        }
      }
    ]);
    return { totalSpent: agg[0]?.totalSpent || 0 };
  }

  // Láº¥y chi phÃ­ trÃªn má»—i há»™i thoáº¡i theo adGroupId - chá»‰ tá»« database trÆ°á»›c
  async getConversationCostByAdGroup(adGroupId: string): Promise<{ 
    totalSpent: number; 
    conversationCount: number; 
    costPerConversation: number 
  }> {
    try {
      // Láº¥y tá»•ng chi phÃ­ tá»« database
      const costResult = await this.getTotalSpentByAdGroup(adGroupId);
      const totalSpent = costResult.totalSpent;

      // Äáº¿m sá»‘ lÆ°á»£ng cuá»™c há»™i thoáº¡i tá»« ChatMessage collection
      const conversationCount = await this.chatMessageModel.aggregate([
        { $match: { adGroupId: adGroupId, direction: 'in' } },
        {
          $group: {
            _id: { fanpageId: '$fanpageId', senderPsid: '$senderPsid' },
            firstMessage: { $min: '$createdAt' }
          }
        },
        { $count: 'total' }
      ]);

      const count = conversationCount[0]?.total || 0;
      const costPerConversation = count > 0 ? Math.round(totalSpent / count) : 0;

      return {
        totalSpent,
        conversationCount: count,
        costPerConversation
      };
    } catch (error) {
      console.error('Error calculating conversation cost:', error);
      // Fallback to basic data
      const costResult = await this.getTotalSpentByAdGroup(adGroupId);
      return {
        totalSpent: costResult.totalSpent,
        conversationCount: 0,
        costPerConversation: 0
      };
    }
  }

  // TÃ­nh chi phÃ­ trÃªn má»—i cuá»™c há»™i thoáº¡i theo NGÃ€Y cho má»™t adGroupId
  async getDailyConversationCost(params: { adGroupId: string; date: string }): Promise<{
    date: string;
    adGroupId: string;
    spentAmount: number;
    conversationCount: number;
    costPerConversation: number;
  }> {
    const { adGroupId, date } = params;
    if (!adGroupId) throw new BadRequestException('Thiáº¿u adGroupId');
    if (!date) throw new BadRequestException('Thiáº¿u date (YYYY-MM-DD)');

    // Chuáº©n hoÃ¡ má»‘c ngÃ y
    const day = new Date(date);
    if (isNaN(day.getTime())) throw new BadRequestException('NgÃ y khÃ´ng há»£p lá»‡');
    const start = new Date(day); start.setHours(0,0,0,0);
    const end = new Date(day); end.setHours(23,59,59,999);

    // 1) Láº¥y chi phÃ­ Ä‘Ã£ chi trong ngÃ y tá»« AdvertisingCost
    const costDoc = await this.model.findOne({ adGroupId, date: { $gte: start, $lte: end } }).select('spentAmount').lean();
    const spentAmount = Number(costDoc?.spentAmount || 0);

    // 2) Äáº¿m sá»‘ cuá»™c há»™i thoáº¡i báº¯t Ä‘áº§u trong ngÃ y (first inbound) cho adGroupId
    const firstInbound = await this.chatMessageModel.aggregate([
      { $match: { adGroupId, direction: 'in' as any } },
      {
        $group: {
          _id: { fanpageId: '$fanpageId', senderPsid: '$senderPsid' },
          firstIn: { $min: '$createdAt' },
        },
      },
      { $match: { firstIn: { $gte: start, $lte: end } } },
      { $count: 'total' },
    ]);
    const conversationCount = Number(firstInbound?.[0]?.total || 0);

    const costPerConversation = conversationCount > 0 ? Math.round(spentAmount / conversationCount) : 0;

    return {
      date: date,
      adGroupId,
      spentAmount,
      conversationCount,
      costPerConversation,
    };
  }

  /**
   * Xá»­ lÃ½ upload file Excel Facebook vÃ  cáº­p nháº­t chi phÃ­ quáº£ng cÃ¡o
   * Cáº¥u trÃºc file Excel:
   * - Cá»™t A: ID NhÃ³m quáº£ng cÃ¡o
   * - Cá»™t B: NgÃ y (Ä‘á»‹nh dáº¡ng YYYY-MM-DD cáº§n chuyá»ƒn thÃ nh DD/MM/YYYY)
   * - Cá»™t D: Táº§n suáº¥t
   * - Cá»™t F: ÄÃ£ Chi (spentAmount)
   * - Cá»™t G: CPC
   * - Cá»™t H: CPM
   */
  async processFacebookExcelUpload(file: Express.Multer.File): Promise<any> {
    if (!file) {
      throw new BadRequestException('KhÃ´ng tÃ¬m tháº¥y file Excel');
    }

    // Helper: Ä‘á»c buffer tá»« memory hoáº·c path
    const readUploadedFile = (): Buffer => {
      if ((file as any).buffer && (file as any).buffer.length) return file.buffer as Buffer;
      if ((file as any).path) return fs.readFileSync((file as any).path);
      throw new BadRequestException('KhÃ´ng Ä‘á»c Ä‘Æ°á»£c ná»™i dung file (thiáº¿u buffer/path)');
    };

    // Helper: Excel serial -> JS Date
    const excelSerialToDate = (serial: number): Date => {
      const utcDays = Math.floor(serial - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      const fractionalDay = serial - Math.floor(serial);
      const totalSeconds = Math.round(fractionalDay * 86400);
      dateInfo.setSeconds(totalSeconds);
      dateInfo.setMilliseconds(0);
      return dateInfo;
    };

    // Helper: parse ngÃ y tá»« nhiá»u Ä‘á»‹nh dáº¡ng
    const parseDate = (v: any): Date | null => {
      if (v === null || v === undefined || v === '') return null;
      if (v instanceof Date) return v;
      if (typeof v === 'number' && !Number.isNaN(v)) return excelSerialToDate(v);
      if (typeof v === 'string') {
        const sv = v.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(sv)) return new Date(sv);
        // dd/MM/yyyy or MM/DD/YYYY
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(sv)) return new Date(sv);
        const d = new Date(sv);
        if (!isNaN(d.getTime())) return d;
      }
      return null;
    };

    // Káº¿t quáº£ tráº£ vá»
    const results = { processed: 0, skipped: 0, created: 0, updated: 0, errors: [] as string[] };
    const affectedDates = new Set<string>();

    try {
      const buffer = readUploadedFile();
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellNF: false, cellText: false });
      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) throw new BadRequestException('File Excel khÃ´ng cÃ³ sheet nÃ o');
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) throw new BadRequestException('KhÃ´ng thá»ƒ Ä‘á»c sheet Ä‘áº§u tiÃªn cá»§a file Excel');

      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false }) as any[];
      if (!rows || rows.length < 2) throw new BadRequestException('File Excel rá»—ng hoáº·c thiáº¿u dá»¯ liá»‡u (cáº§n header + Ã­t nháº¥t 1 dÃ²ng dá»¯ liá»‡u)');

      // Duyá»‡t dá»¯ liá»‡u, bá» qua header
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as any[];
        if (!row || row.length === 0 || !row.some(c => c !== null && c !== undefined && c !== '')) { results.skipped++; continue; }

        try {
          const get = (idx: number) => (idx < row.length && row[idx] !== '' && row[idx] !== null && row[idx] !== undefined) ? row[idx] : '';
          const adGroupId = String(get(0)).trim();
          const rawDate = get(1);
          const frequency = get(3) !== '' ? Number(get(3)) : undefined;
          const spentAmount = get(5) !== '' ? Number(get(5)) : 0;
          const cpc = get(6) !== '' ? Number(get(6)) : 0;
          const cpm = get(7) !== '' ? Number(get(7)) : 0;

          if (!adGroupId || rawDate === '') { results.skipped++; results.errors.push(`DÃ²ng ${i + 1}: thiáº¿u ID NhÃ³m QC hoáº·c NgÃ y`); continue; }

          const dateParsed = parseDate(rawDate);
          if (!dateParsed || isNaN(dateParsed.getTime())) { results.skipped++; results.errors.push(`DÃ²ng ${i + 1}: ngÃ y khÃ´ng há»£p lá»‡ (${rawDate})`); continue; }

          // Chuáº©n hoÃ¡ ngÃ y vá» UTC 00:00 Ä‘á»ƒ trÃ¡nh trÃ¹ng láº·p theo mÃºi giá»
          const date = this.toUtcStartOfDay(dateParsed);
          affectedDates.add(date.toISOString().slice(0, 10));
          const updateDoc = { adGroupId, date, frequency, spentAmount, cpc, cpm, channel: 'facebook' } as Partial<AdvertisingCost>;
          const res = await this.model.updateOne(
            { adGroupId, date },
            { $set: updateDoc },
            { upsert: true }
          );
          if ((res as any).upserted || (res as any).matchedCount === 0) results.created++; else results.updated++;
          results.processed++;
        } catch (rowErr: any) {
          results.skipped++; results.errors.push(`DÃ²ng ${i + 1}: ${rowErr?.message || rowErr}`);
        }
      }

      await this.triggerRecalculateForDates(Array.from(affectedDates));
      return results;
    } finally {
      // XoÃ¡ file táº¡m náº¿u cÃ³
      try { if ((file as any).path && fs.existsSync((file as any).path)) fs.unlinkSync((file as any).path); } catch {}
    }
  }

  // ============ Summary for Financial Control ============

  /**
   * Tá»•ng há»£p chi phÃ­ quáº£ng cÃ¡o theo khoáº£ng thá»i gian
   * - Tráº£ vá» tá»•ng chi phÃ­ theo ngÃ y/tuáº§n/thÃ¡ng
   */
  async getDailySummary(dateFrom?: string, dateTo?: string): Promise<{
    totalSpent: number;
    totalImpressions: number;
    totalClicks: number;
    totalReach: number;
    totalMessages: number;
    avgCpm: number;
    avgCpc: number;
    recordCount: number;
    dateRange: { from: string | null; to: string | null };
  }> {
    const matchStage: any = {};
    
    if (dateFrom || dateTo) {
      matchStage.date = {};
      if (dateFrom) matchStage.date.$gte = this.toUtcStartOfDay(dateFrom);
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setDate(toDate.getDate() + 1);
        matchStage.date.$lt = this.toUtcStartOfDay(toDate);
      }
    }

    const agg = await this.model.aggregate([
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$spentAmount' },
          totalImpressions: { $sum: '$impressions' },
          totalClicks: { $sum: '$clicks' },
          totalReach: { $sum: '$reach' },
          totalMessages: { $sum: '$messagingConversationStarted7d' },
          recordCount: { $sum: 1 },
        }
      }
    ]);

    const stats = agg[0] || {
      totalSpent: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalReach: 0,
      totalMessages: 0,
      recordCount: 0,
    };

    return {
      totalSpent: stats.totalSpent,
      totalImpressions: stats.totalImpressions,
      totalClicks: stats.totalClicks,
      totalReach: stats.totalReach,
      totalMessages: stats.totalMessages,
      avgCpm: stats.totalImpressions > 0 ? (stats.totalSpent / stats.totalImpressions) * 1000 : 0,
      avgCpc: stats.totalClicks > 0 ? stats.totalSpent / stats.totalClicks : 0,
      recordCount: stats.recordCount,
      dateRange: {
        from: dateFrom || null,
        to: dateTo || null,
      },
    };
  }

  /**
   * Tá»•ng há»£p chi phÃ­ Ads cho Financial Control
   * - Ads lÃ  cash-out theo ngÃ y
   * - Cáº§n tracking spend theo ngÃ y vÃ  theo ad group Ä‘á»ƒ cap 20%
   * 
   * CFO Sign-off v3.1:
   * 1. ThÃªm lastSyncAt, syncStatus Ä‘á»ƒ biáº¿t data cÃ³ fresh khÃ´ng
   * 2. ThÃªm spendByPlatform Ä‘á»ƒ breakdown FB/Google/TikTok
   * 3. ÄÃ¡nh dáº¥u cashOutProxy náº¿u chÆ°a cÃ³ Ads Payment module
   * 4. ThÃªm avgDailySpend7d
   */
  async getCashflowSummary(): Promise<{
    // === Tá»”NG Há»¢P ===
    totalAdsSpentAllTime: number;     // Tá»•ng chi tá»« trÆ°á»›c Ä‘áº¿n nay
    totalAdsSpent7d: number;          // Tá»•ng 7 ngÃ y gáº§n nháº¥t
    totalAdsSpentYesterday: number;   // Chi ngÃ y hÃ´m qua
    avgDailySpend7d: number;          // Trung bÃ¬nh ngÃ y (7d)
    
    // === THEO NGÃ€Y (cho baseline) ===
    spendByDay: {
      date: string;
      totalSpent: number;
      adGroupCount: number;
    }[];
    
    // === THEO PLATFORM (CFO yÃªu cáº§u) ===
    spendByPlatform: {
      platform: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'other';
      spent7d: number;
      spentYesterday: number;
    }[];
    
    // === THEO AD GROUP (cho cap 20%) ===
    spendByAdGroup: {
      adGroupId: string;
      adGroupName: string;
      platform: string;
      spentYesterday: number;
      avgSpent3d: number;
      baseline: number;
      upperCap: number;               // = baseline * 1.20
      lowerCap: number;               // = baseline * 0.70
    }[];
    
    // === SYNC STATUS (CFO yÃªu cáº§u) ===
    lastSyncAt?: string;              // Láº§n sync gáº§n nháº¥t
    syncStatus: 'ok' | 'delayed' | 'failed';
    dataFreshnessHours: number;       // Sá»‘ giá» tá»« láº§n sync gáº§n nháº¥t
    
    // === CASH-OUT PROXY FLAG ===
    cashOutProxy: boolean;            // true = chÆ°a cÃ³ Ads Payment, dÃ¹ng spend lÃ m proxy
    
    // === METADATA ===
    asOfDate: string;
    timezone: string;
    platforms: string[];
    generatedAt: string;
  }> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // NgÃ y hÃ´m qua
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = this.toUtcStartOfDay(yesterday);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);
    
    // 7 ngÃ y trÆ°á»›c
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // 3 ngÃ y trÆ°á»›c (cho avg)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Tá»•ng táº¥t cáº£
    const allTimeAgg = await this.model.aggregate([
      { $group: { _id: null, total: { $sum: '$spentAmount' } } },
    ]);
    const totalAdsSpentAllTime = allTimeAgg[0]?.total || 0;

    // Tá»•ng 7 ngÃ y
    const week7Agg = await this.model.aggregate([
      { $match: { date: { $gte: this.toUtcStartOfDay(sevenDaysAgo) } } },
      { $group: { _id: null, total: { $sum: '$spentAmount' } } },
    ]);
    const totalAdsSpent7d = week7Agg[0]?.total || 0;

    // Tá»•ng hÃ´m qua
    const yesterdayAgg = await this.model.aggregate([
      { $match: { date: { $gte: yesterdayStart, $lt: yesterdayEnd } } },
      { $group: { _id: null, total: { $sum: '$spentAmount' } } },
    ]);
    const totalAdsSpentYesterday = yesterdayAgg[0]?.total || 0;
    
    // Average daily spend
    const avgDailySpend7d = totalAdsSpent7d / 7;

    // Spend theo ngÃ y (7 ngÃ y) - thÃªm adGroupCount
    const spendByDayAgg = await this.model.aggregate([
      { $match: { date: { $gte: this.toUtcStartOfDay(sevenDaysAgo) } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          totalSpent: { $sum: '$spentAmount' },
          adGroupCount: { $addToSet: '$adGroupId' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const spendByDay = spendByDayAgg.map((d) => ({
      date: d._id,
      totalSpent: d.totalSpent,
      adGroupCount: d.adGroupCount?.length || 0,
    }));

    // Spend theo platform (CFO yÃªu cáº§u)
    const spendByPlatformAgg = await this.model.aggregate([
      { $match: { date: { $gte: this.toUtcStartOfDay(sevenDaysAgo) } } },
      {
        $group: {
          _id: { $ifNull: ['$channel', 'facebook'] },
          spent7d: { $sum: '$spentAmount' },
          spentYesterday: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ['$date', yesterdayStart] }, { $lt: ['$date', yesterdayEnd] }] },
                '$spentAmount',
                0,
              ],
            },
          },
        },
      },
    ]);
    const spendByPlatform = spendByPlatformAgg.map((p) => ({
      platform: p._id as 'facebook' | 'google' | 'tiktok' | 'zalo' | 'other',
      spent7d: p.spent7d,
      spentYesterday: p.spentYesterday,
    }));

    // Spend theo ad group (cho cap 20%) - thÃªm platform
    const minStartBudget = 200000; // 200k VND
    const spendByAdGroupAgg = await this.model.aggregate([
      { $match: { date: { $gte: this.toUtcStartOfDay(threeDaysAgo) } } },
      {
        $group: {
          _id: '$adGroupId',
          totalSpent3d: { $sum: '$spentAmount' },
          countDays: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } },
          platform: { $first: { $ifNull: ['$channel', 'facebook'] } },
          spentYesterday: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ['$date', yesterdayStart] }, { $lt: ['$date', yesterdayEnd] }] },
                '$spentAmount',
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'adgroups',
          localField: '_id',
          foreignField: 'adGroupId',
          as: 'adGroup',
        },
      },
      {
        $unwind: { path: '$adGroup', preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          adGroupId: '$_id',
          adGroupName: { $ifNull: ['$adGroup.name', '$_id'] },
          platform: 1,
          spentYesterday: 1,
          avgSpent3d: { $divide: ['$totalSpent3d', { $max: [{ $size: '$countDays' }, 1] }] },
        },
      },
    ]);

    const spendByAdGroup = spendByAdGroupAgg.map((ag) => {
      const baseline = Math.max(ag.spentYesterday, ag.avgSpent3d, minStartBudget);
      return {
        adGroupId: ag.adGroupId,
        adGroupName: ag.adGroupName,
        platform: ag.platform || 'facebook',
        spentYesterday: ag.spentYesterday,
        avgSpent3d: ag.avgSpent3d,
        baseline,
        upperCap: baseline * 1.20,
        lowerCap: baseline * 0.70,
      };
    });

    // Láº¥y lastSyncAt tá»« record gáº§n nháº¥t (timestamps: true tá»± thÃªm updatedAt)
    const latestRecord = await this.model.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean() as any;
    const lastSyncAt = latestRecord?.updatedAt ? new Date(latestRecord.updatedAt).toISOString() : undefined;
    
    // TÃ­nh dataFreshnessHours vÃ  syncStatus
    let dataFreshnessHours = 999;
    let syncStatus: 'ok' | 'delayed' | 'failed' = 'failed';
    if (lastSyncAt) {
      dataFreshnessHours = Math.round((now.getTime() - new Date(lastSyncAt).getTime()) / (1000 * 60 * 60));
      if (dataFreshnessHours <= 12) {
        syncStatus = 'ok';
      } else if (dataFreshnessHours <= 24) {
        syncStatus = 'delayed';
      } else {
        syncStatus = 'failed';
      }
    }

    // Collect platforms
    const platforms = [...new Set(spendByPlatform.map(p => p.platform))];

    return {
      totalAdsSpentAllTime,
      totalAdsSpent7d,
      totalAdsSpentYesterday,
      avgDailySpend7d: Math.round(avgDailySpend7d),
      spendByDay,
      spendByPlatform,
      spendByAdGroup,
      // Sync status
      lastSyncAt,
      syncStatus,
      dataFreshnessHours,
      // Cash-out proxy (TODO: set false khi cÃ³ Ads Payment module)
      cashOutProxy: true,
      // Metadata
      asOfDate: today,
      timezone: 'Asia/Bangkok',
      platforms,
      generatedAt: now.toISOString(),
    };
  }
}

