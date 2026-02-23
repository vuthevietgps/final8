/**
 * File: advertising-cost/advertising-cost.service.ts
 * Mục đích: Xử lý nghiệp vụ CRUD cho Chi Phí Quảng Cáo.
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

@Injectable()
export class AdvertisingCostService {
  // Chuẩn hoá về đầu ngày theo UTC (00:00:00.000Z)
  private toUtcStartOfDay(d: Date | string): Date {
    const date = typeof d === 'string' ? new Date(d) : new Date(d);
    if (isNaN(date.getTime())) return date;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  // Xác định kênh từ adGroup nếu chưa có (fallback facebook)
  private async inferChannel(adGroupId?: string, incoming?: string): Promise<'facebook' | 'google' | 'tiktok' | 'zalo' | 'other'> {
    if (incoming) return incoming as any;
    if (adGroupId) {
      const grp = await this.adGroupModel.findOne({ adGroupId }).select('platform').lean();
      if (grp?.platform) return grp.platform as any;
    }
    return 'facebook';
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
    return created.save();
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
    if (!doc) throw new NotFoundException('Không tìm thấy chi phí quảng cáo');
    return doc as any;
  }

  async update(id: string, dto: UpdateAdvertisingCostDto): Promise<AdvertisingCost> {
    const update: Partial<AdvertisingCost> = { ...dto } as any;
    if (dto.channel) (update as any).channel = dto.channel;
    if (dto.date) (update as any).date = this.toUtcStartOfDay(dto.date);
    const doc = await this.model.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!doc) throw new NotFoundException('Không tìm thấy chi phí quảng cáo');
    return doc as any;
  }

  async remove(id: string): Promise<void> {
    const res = await this.model.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Không tìm thấy chi phí quảng cáo');
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

  // Lấy chi phí ngày hôm qua cho advertising-cost-suggestion
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

  // Lấy tổng chi phí theo adGroupId
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

  // Lấy chi phí trên mỗi hội thoại theo adGroupId - chỉ từ database trước
  async getConversationCostByAdGroup(adGroupId: string): Promise<{ 
    totalSpent: number; 
    conversationCount: number; 
    costPerConversation: number 
  }> {
    try {
      // Lấy tổng chi phí từ database
      const costResult = await this.getTotalSpentByAdGroup(adGroupId);
      const totalSpent = costResult.totalSpent;

      // Đếm số lượng cuộc hội thoại từ ChatMessage collection
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

  // Tính chi phí trên mỗi cuộc hội thoại theo NGÀY cho một adGroupId
  async getDailyConversationCost(params: { adGroupId: string; date: string }): Promise<{
    date: string;
    adGroupId: string;
    spentAmount: number;
    conversationCount: number;
    costPerConversation: number;
  }> {
    const { adGroupId, date } = params;
    if (!adGroupId) throw new BadRequestException('Thiếu adGroupId');
    if (!date) throw new BadRequestException('Thiếu date (YYYY-MM-DD)');

    // Chuẩn hoá mốc ngày
    const day = new Date(date);
    if (isNaN(day.getTime())) throw new BadRequestException('Ngày không hợp lệ');
    const start = new Date(day); start.setHours(0,0,0,0);
    const end = new Date(day); end.setHours(23,59,59,999);

    // 1) Lấy chi phí đã chi trong ngày từ AdvertisingCost
    const costDoc = await this.model.findOne({ adGroupId, date: { $gte: start, $lte: end } }).select('spentAmount').lean();
    const spentAmount = Number(costDoc?.spentAmount || 0);

    // 2) Đếm số cuộc hội thoại bắt đầu trong ngày (first inbound) cho adGroupId
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
   * Xử lý upload file Excel Facebook và cập nhật chi phí quảng cáo
   * Cấu trúc file Excel:
   * - Cột A: ID Nhóm quảng cáo
   * - Cột B: Ngày (định dạng YYYY-MM-DD cần chuyển thành DD/MM/YYYY)
   * - Cột D: Tần suất
   * - Cột F: Đã Chi (spentAmount)
   * - Cột G: CPC
   * - Cột H: CPM
   */
  async processFacebookExcelUpload(file: Express.Multer.File): Promise<any> {
    if (!file) {
      throw new BadRequestException('Không tìm thấy file Excel');
    }

    // Helper: đọc buffer từ memory hoặc path
    const readUploadedFile = (): Buffer => {
      if ((file as any).buffer && (file as any).buffer.length) return file.buffer as Buffer;
      if ((file as any).path) return fs.readFileSync((file as any).path);
      throw new BadRequestException('Không đọc được nội dung file (thiếu buffer/path)');
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

    // Helper: parse ngày từ nhiều định dạng
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

    // Kết quả trả về
    const results = { processed: 0, skipped: 0, created: 0, updated: 0, errors: [] as string[] };

    try {
      const buffer = readUploadedFile();
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellNF: false, cellText: false });
      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) throw new BadRequestException('File Excel không có sheet nào');
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) throw new BadRequestException('Không thể đọc sheet đầu tiên của file Excel');

      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false }) as any[];
      if (!rows || rows.length < 2) throw new BadRequestException('File Excel rỗng hoặc thiếu dữ liệu (cần header + ít nhất 1 dòng dữ liệu)');

      // Duyệt dữ liệu, bỏ qua header
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

          if (!adGroupId || rawDate === '') { results.skipped++; results.errors.push(`Dòng ${i + 1}: thiếu ID Nhóm QC hoặc Ngày`); continue; }

          const dateParsed = parseDate(rawDate);
          if (!dateParsed || isNaN(dateParsed.getTime())) { results.skipped++; results.errors.push(`Dòng ${i + 1}: ngày không hợp lệ (${rawDate})`); continue; }

          // Chuẩn hoá ngày về UTC 00:00 để tránh trùng lặp theo múi giờ
          const date = this.toUtcStartOfDay(dateParsed);
          const updateDoc = { adGroupId, date, frequency, spentAmount, cpc, cpm, channel: 'facebook' } as Partial<AdvertisingCost>;
          const res = await this.model.updateOne(
            { adGroupId, date },
            { $set: updateDoc },
            { upsert: true }
          );
          if ((res as any).upserted || (res as any).matchedCount === 0) results.created++; else results.updated++;
          results.processed++;
        } catch (rowErr: any) {
          results.skipped++; results.errors.push(`Dòng ${i + 1}: ${rowErr?.message || rowErr}`);
        }
      }

      return results;
    } finally {
      // Xoá file tạm nếu có
      try { if ((file as any).path && fs.existsSync((file as any).path)) fs.unlinkSync((file as any).path); } catch {}
    }
  }

  // ============ Summary for Financial Control ============

  /**
   * Tổng hợp chi phí quảng cáo theo khoảng thời gian
   * - Trả về tổng chi phí theo ngày/tuần/tháng
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
   * Tổng hợp chi phí Ads cho Financial Control
   * - Ads là cash-out theo ngày
   * - Cần tracking spend theo ngày và theo ad group để cap 20%
   * 
   * CFO Sign-off v3.1:
   * 1. Thêm lastSyncAt, syncStatus để biết data có fresh không
   * 2. Thêm spendByPlatform để breakdown FB/Google/TikTok
   * 3. Đánh dấu cashOutProxy nếu chưa có Ads Payment module
   * 4. Thêm avgDailySpend7d
   */
  async getCashflowSummary(): Promise<{
    // === TỔNG HỢP ===
    totalAdsSpentAllTime: number;     // Tổng chi từ trước đến nay
    totalAdsSpent7d: number;          // Tổng 7 ngày gần nhất
    totalAdsSpentYesterday: number;   // Chi ngày hôm qua
    avgDailySpend7d: number;          // Trung bình ngày (7d)
    
    // === THEO NGÀY (cho baseline) ===
    spendByDay: {
      date: string;
      totalSpent: number;
      adGroupCount: number;
    }[];
    
    // === THEO PLATFORM (CFO yêu cầu) ===
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
    
    // === SYNC STATUS (CFO yêu cầu) ===
    lastSyncAt?: string;              // Lần sync gần nhất
    syncStatus: 'ok' | 'delayed' | 'failed';
    dataFreshnessHours: number;       // Số giờ từ lần sync gần nhất
    
    // === CASH-OUT PROXY FLAG ===
    cashOutProxy: boolean;            // true = chưa có Ads Payment, dùng spend làm proxy
    
    // === METADATA ===
    asOfDate: string;
    timezone: string;
    platforms: string[];
    generatedAt: string;
  }> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Ngày hôm qua
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = this.toUtcStartOfDay(yesterday);
    const yesterdayEnd = new Date(yesterdayStart);
    yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);
    
    // 7 ngày trước
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // 3 ngày trước (cho avg)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Tổng tất cả
    const allTimeAgg = await this.model.aggregate([
      { $group: { _id: null, total: { $sum: '$spentAmount' } } },
    ]);
    const totalAdsSpentAllTime = allTimeAgg[0]?.total || 0;

    // Tổng 7 ngày
    const week7Agg = await this.model.aggregate([
      { $match: { date: { $gte: this.toUtcStartOfDay(sevenDaysAgo) } } },
      { $group: { _id: null, total: { $sum: '$spentAmount' } } },
    ]);
    const totalAdsSpent7d = week7Agg[0]?.total || 0;

    // Tổng hôm qua
    const yesterdayAgg = await this.model.aggregate([
      { $match: { date: { $gte: yesterdayStart, $lt: yesterdayEnd } } },
      { $group: { _id: null, total: { $sum: '$spentAmount' } } },
    ]);
    const totalAdsSpentYesterday = yesterdayAgg[0]?.total || 0;
    
    // Average daily spend
    const avgDailySpend7d = totalAdsSpent7d / 7;

    // Spend theo ngày (7 ngày) - thêm adGroupCount
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

    // Spend theo platform (CFO yêu cầu)
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

    // Spend theo ad group (cho cap 20%) - thêm platform
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

    // Lấy lastSyncAt từ record gần nhất (timestamps: true tự thêm updatedAt)
    const latestRecord = await this.model.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean() as any;
    const lastSyncAt = latestRecord?.updatedAt ? new Date(latestRecord.updatedAt).toISOString() : undefined;
    
    // Tính dataFreshnessHours và syncStatus
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
      // Cash-out proxy (TODO: set false khi có Ads Payment module)
      cashOutProxy: true,
      // Metadata
      asOfDate: today,
      timezone: 'Asia/Bangkok',
      platforms,
      generatedAt: now.toISOString(),
    };
  }
}
