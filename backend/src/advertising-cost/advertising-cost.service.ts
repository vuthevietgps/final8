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
}
