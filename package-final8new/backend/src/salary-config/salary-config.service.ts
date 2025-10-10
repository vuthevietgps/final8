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
    const doc = await this.model.findOneAndUpdate(
      { userId },
      { $set: { hourlyRate: dto.hourlyRate, notes: dto.notes } },
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

  async update(id: string, dto: UpdateSalaryConfigDto): Promise<SalaryConfig> {
    const doc = await this.model.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!doc) throw new NotFoundException('Salary config not found');
    return doc;
  }

  async updateField(id: string, patch: Partial<UpdateSalaryConfigDto>): Promise<SalaryConfig> {
    const set: any = {};
    if (patch.hourlyRate !== undefined) set.hourlyRate = patch.hourlyRate;
    if (patch.notes !== undefined) set.notes = patch.notes;
    if (patch.userId !== undefined) set.userId = new Types.ObjectId(patch.userId);
    const doc = await this.model.findByIdAndUpdate(id, { $set: set }, { new: true }).exec();
    if (!doc) throw new NotFoundException('Salary config not found');
    return doc;
  }

  async remove(id: string): Promise<SalaryConfig> {
    const doc = await this.model.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Salary config not found');
    return doc;
  }
}
