import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SalaryConfig, SalaryConfigDocument } from './schemas/salary-config.schema';
import { CreateSalaryConfigDto } from './dto/create-salary-config.dto';
import { UpdateSalaryConfigDto } from './dto/update-salary-config.dto';

@Injectable()
export class SalaryConfigService {
  constructor(
    @InjectModel(SalaryConfig.name) private model: Model<SalaryConfigDocument>,
  ) {}

  async createOrUpdate(dto: CreateSalaryConfigDto): Promise<SalaryConfig> {
    const userId = new Types.ObjectId(dto.userId);
    const updateData: any = {
      hourlyRate: dto.hourlyRate,
      notes: dto.notes,
    };
    
    // Thêm các trường mới nếu có
    if (dto.payrollCycle !== undefined) updateData.payrollCycle = dto.payrollCycle;
    if (dto.paymentDays !== undefined) updateData.paymentDays = dto.paymentDays;
    if (dto.attendanceTiers !== undefined) updateData.attendanceTiers = dto.attendanceTiers;
    if (dto.kpiBonusTiers !== undefined) updateData.kpiBonusTiers = dto.kpiBonusTiers;
    if (dto.punctualityRules !== undefined) updateData.punctualityRules = dto.punctualityRules;
    
    const doc = await this.model.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();
    return doc;
  }

  async findAll(): Promise<any[]> {
    return this.model.find().populate('userId', 'fullName email role').sort({ updatedAt: -1 }).exec();
  }

  async findOne(id: string): Promise<SalaryConfig> {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Salary config not found');
    return doc;
  }

  async findByUserId(userId: string): Promise<SalaryConfig | null> {
    return this.model.findOne({ userId: new Types.ObjectId(userId) }).exec();
  }

  async update(id: string, dto: UpdateSalaryConfigDto): Promise<SalaryConfig> {
    const updateData: any = {};
    
    if (dto.hourlyRate !== undefined) updateData.hourlyRate = dto.hourlyRate;
    if (dto.notes !== undefined) updateData.notes = dto.notes;
    if (dto.payrollCycle !== undefined) updateData.payrollCycle = dto.payrollCycle;
    if (dto.paymentDays !== undefined) updateData.paymentDays = dto.paymentDays;
    if (dto.attendanceTiers !== undefined) updateData.attendanceTiers = dto.attendanceTiers;
    if (dto.kpiBonusTiers !== undefined) updateData.kpiBonusTiers = dto.kpiBonusTiers;
    if (dto.punctualityRules !== undefined) updateData.punctualityRules = dto.punctualityRules;
    if (dto.userId !== undefined) updateData.userId = new Types.ObjectId(dto.userId);
    
    const doc = await this.model.findByIdAndUpdate(id, { $set: updateData }, { new: true }).exec();
    if (!doc) throw new NotFoundException('Salary config not found');
    return doc;
  }

  async updateField(id: string, patch: Partial<UpdateSalaryConfigDto>): Promise<SalaryConfig> {
    const set: any = {};
    if (patch.hourlyRate !== undefined) set.hourlyRate = patch.hourlyRate;
    if (patch.notes !== undefined) set.notes = patch.notes;
    if (patch.userId !== undefined) set.userId = new Types.ObjectId(patch.userId);
    if (patch.payrollCycle !== undefined) set.payrollCycle = patch.payrollCycle;
    if (patch.paymentDays !== undefined) set.paymentDays = patch.paymentDays;
    if (patch.attendanceTiers !== undefined) set.attendanceTiers = patch.attendanceTiers;
    if (patch.kpiBonusTiers !== undefined) set.kpiBonusTiers = patch.kpiBonusTiers;
    if (patch.punctualityRules !== undefined) set.punctualityRules = patch.punctualityRules;
    
    const doc = await this.model.findByIdAndUpdate(id, { $set: set }, { new: true }).exec();
    if (!doc) throw new NotFoundException('Salary config not found');
    return doc;
  }

  async remove(id: string): Promise<SalaryConfig> {
    const doc = await this.model.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Salary config not found');
    return doc;
  }

  /**
   * Tính thưởng chuyên cần dựa trên tổng giờ làm việc
   */
  calculateAttendanceBonus(totalHours: number, tiers: { minHours: number; maxHours: number; bonusAmount: number }[]): number {
    if (!tiers || tiers.length === 0) return 0;
    
    // Sắp xếp theo minHours giảm dần để tìm bậc cao nhất phù hợp
    const sortedTiers = [...tiers].sort((a, b) => b.minHours - a.minHours);
    
    for (const tier of sortedTiers) {
      if (totalHours >= tier.minHours && totalHours < tier.maxHours) {
        return tier.bonusAmount;
      }
    }
    
    // Nếu vượt quá maxHours của tier cao nhất, trả về tier cao nhất
    const highestTier = sortedTiers[0];
    if (totalHours >= highestTier.maxHours) {
      return highestTier.bonusAmount;
    }
    
    return 0;
  }

  /**
   * Tính thưởng KPI dựa trên % hoàn thành
   */
  calculateKpiBonus(kpiPercent: number, tiers: { minPercent: number; maxPercent: number; bonusAmount: number }[]): number {
    if (!tiers || tiers.length === 0) return 0;
    
    // Sắp xếp theo minPercent giảm dần
    const sortedTiers = [...tiers].sort((a, b) => b.minPercent - a.minPercent);
    
    for (const tier of sortedTiers) {
      if (kpiPercent >= tier.minPercent && kpiPercent < tier.maxPercent) {
        return tier.bonusAmount;
      }
    }
    
    // Nếu vượt quá maxPercent của tier cao nhất
    const highestTier = sortedTiers[0];
    if (kpiPercent >= highestTier.maxPercent) {
      return highestTier.bonusAmount;
    }
    
    return 0;
  }

  /**
   * Tính thưởng/phạt chấm công dựa trên loginAt
   */
  calculatePunctualityBonus(
    loginTimes: Date[],
    rules: { checkInDeadline: string; onTimeBonus: number; latePenalty: number; gracePeriodMinutes: number } | null
  ): { onTimeDays: number; lateDays: number; totalBonus: number; totalPenalty: number; net: number } {
    if (!rules || loginTimes.length === 0) {
      return { onTimeDays: 0, lateDays: 0, totalBonus: 0, totalPenalty: 0, net: 0 };
    }

    const [deadlineHour, deadlineMinute] = rules.checkInDeadline.split(':').map(Number);
    const deadlineMinutes = deadlineHour * 60 + deadlineMinute + (rules.gracePeriodMinutes || 0);

    let onTimeDays = 0;
    let lateDays = 0;

    // Nhóm login theo ngày (chỉ tính login đầu tiên của mỗi ngày)
    const loginByDay = new Map<string, Date>();
    for (const loginAt of loginTimes) {
      const dayKey = loginAt.toISOString().split('T')[0];
      if (!loginByDay.has(dayKey) || loginAt < loginByDay.get(dayKey)!) {
        loginByDay.set(dayKey, loginAt);
      }
    }

    for (const [, firstLogin] of loginByDay) {
      const loginMinutes = firstLogin.getHours() * 60 + firstLogin.getMinutes();
      if (loginMinutes <= deadlineMinutes) {
        onTimeDays++;
      } else {
        lateDays++;
      }
    }

    const totalBonus = onTimeDays * rules.onTimeBonus;
    const totalPenalty = lateDays * rules.latePenalty;

    return {
      onTimeDays,
      lateDays,
      totalBonus,
      totalPenalty,
      net: totalBonus - totalPenalty,
    };
  }
}
