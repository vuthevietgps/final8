import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdGroup, AdGroupDocument } from './schemas/ad-group.schema';

export interface AdGroupRecommendation {
  adGroupId: string;
  name: string;
  platform: string;
  currentBudget: number;
  suggestedBudget: number;
  changePercent: number;
  reason: string;
}

@Injectable()
export class AdGroupRecommendationService {
  private readonly logger = new Logger(AdGroupRecommendationService.name);

  constructor(
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
  ) {}

  /**
   * Tính đề xuất chi phí cho từng ad group dựa trên dailyBudget hiện tại.
   * Ràng buộc: không đổi quá ±20% so với budget hiện tại.
   * Hiện tại dùng heuristic đơn giản (tăng 10%), có thể thay bằng thuật toán hiệu suất khi dữ liệu đủ.
   */
  async computeRecommendations(): Promise<AdGroupRecommendation[]> {
    const groups = await this.adGroupModel.find({ isActive: { $ne: false } }).select('name adGroupId platform dailyBudget').lean();
    const recs: AdGroupRecommendation[] = [];

    for (const g of groups) {
      const current = Number((g as any).dailyBudget) || 200_000; // fallback mặc định
      const target = current * 1.1; // tăng 10% mặc định
      const minBudget = current * 0.8;
      const maxBudget = current * 1.2;
      const suggested = Math.min(Math.max(target, minBudget), maxBudget);
      const changePercent = current === 0 ? 0 : ((suggested - current) / current) * 100;

      recs.push({
        adGroupId: (g as any)._id ? String((g as any)._id) : (g as any).adGroupId,
        name: (g as any).name,
        platform: (g as any).platform,
        currentBudget: current,
        suggestedBudget: Math.round(suggested),
        changePercent: Math.round(changePercent * 10) / 10,
        reason: 'Heuristic +10% với trần ±20% (sẽ tinh chỉnh theo hiệu suất khi đủ dữ liệu)',
      });
    }

    return recs;
  }

  /**
   * Áp dụng đề xuất: cập nhật dailyBudget và (tạm thời) chỉ log thay vì gọi API thật.
   * Khi có API platform, thay thế hàm applyToPlatform.
   */
  async applyRecommendations(adGroupIds: string[]): Promise<{ applied: any[]; failed: any[] }> {
    if (!Array.isArray(adGroupIds) || adGroupIds.length === 0) {
      throw new BadRequestException('Chưa chọn nhóm quảng cáo để áp dụng');
    }

    const results = await this.computeRecommendations();
    const recMap = new Map(results.map(r => [r.adGroupId, r]));

    const applied: any[] = [];
    const failed: any[] = [];

    for (const id of adGroupIds) {
      const rec = recMap.get(id);
      if (!rec) {
        failed.push({ adGroupId: id, error: 'Không tìm thấy đề xuất' });
        continue;
      }

      try {
        const mongoId = Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
        const filter = mongoId ? { _id: mongoId } : { adGroupId: id };
        await this.adGroupModel.updateOne(filter, { $set: { dailyBudget: rec.suggestedBudget } });

        // TODO: Gọi API thật của Facebook/Google/TikTok. Hiện tại chỉ log để tránh lỗi khi chưa cấu hình token.
        this.logger.log(`(Mock) Apply budget for adGroup ${id}: ${rec.suggestedBudget}`);

        applied.push({ adGroupId: id, suggestedBudget: rec.suggestedBudget });
      } catch (err: any) {
        failed.push({ adGroupId: id, error: err?.message || 'Lỗi áp dụng ngân sách' });
      }
    }

    return { applied, failed };
  }
}