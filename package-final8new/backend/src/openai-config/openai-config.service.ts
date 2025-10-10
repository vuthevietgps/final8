/**
 * File: openai-config/openai-config.service.ts
 * Mục đích: Service xử lý business logic cho cấu hình OpenAI
 * Chức năng: CRUD cấu hình OpenAI, validation và error handling
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OpenAIConfig, OpenAIConfigDocument } from './schemas/openai-config.schema';
import { CreateOpenAIConfigDto } from './dto/create-openai-config.dto';
import { UpdateOpenAIConfigDto } from './dto/update-openai-config.dto';
import { TestOpenAIKeyDto } from './dto/test-openai-key.dto';

@Injectable()
export class OpenAIConfigService {
  constructor(@InjectModel(OpenAIConfig.name) private model: Model<OpenAIConfigDocument>) {}

  create(dto: CreateOpenAIConfigDto) {
    const doc = new this.model(dto);
    return doc.save();
  }

  findAll(filter: any = {}) {
    return this.model.find(filter).sort({ createdAt: -1 }).lean();
  }

  async findOne(id: string) {
    try {
      const doc = await this.model.findById(id).lean();
      if (!doc) return null;
      return doc as any;
    } catch (error) {
      return null;
    }
  }

  async update(id: string, dto: UpdateOpenAIConfigDto) {
    const doc = await this.model.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!doc) throw new NotFoundException('Config không tồn tại');
    return doc as any;
  }

  async remove(id: string) {
    const res = await this.model.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Config không tồn tại');
  }

  /**
   * Chọn cấu hình thích hợp theo thứ tự ưu tiên:
   * 1. scopeType=fanpage + scopeRef khớp
   * 2. scopeType=adgroup + scopeRef khớp (tùy mở rộng sau)
   * 3. global default (isDefault=true)
   * 4. Bất kỳ global active gần nhất
   */
  async pickConfig(opts: { fanpageId?: string; adGroupId?: string; }) {
    const { fanpageId, adGroupId } = opts;
    if (fanpageId) {
      const fp = await this.model.findOne({ scopeType: 'fanpage', scopeRef: fanpageId, status: 'active' }).sort({ updatedAt: -1 }).lean();
      if (fp) return fp;
    }
    if (adGroupId) {
      const ag = await this.model.findOne({ scopeType: 'adgroup', scopeRef: adGroupId, status: 'active' }).sort({ updatedAt: -1 }).lean();
      if (ag) return ag;
    }
    const def = await this.model.findOne({ scopeType: 'global', isDefault: true, status: 'active' }).sort({ updatedAt: -1 }).lean();
    if (def) return def;
    return this.model.findOne({ scopeType: 'global', status: 'active' }).sort({ updatedAt: -1 }).lean();
  }

  /**
   * Test nhanh API Key (mock): Không gọi ra OpenAI thực để tránh lộ key hay tốn quota.
   * Có thể mở rộng: gọi endpoint models.list với fetch nếu muốn xác thực thực.
   */
  async testKey(dto: TestOpenAIKeyDto) {
    const { apiKey, model } = dto;
    if (!apiKey || !apiKey.startsWith('sk-')) {
      return { valid: false, reason: 'API Key không hợp lệ định dạng (phải bắt đầu bằng sk-)' };
    }
    // Simple heuristic checks
    if (apiKey.length < 20) {
      return { valid: false, reason: 'API Key quá ngắn' };
    }
    return {
      valid: true,
      model: model || 'gpt-4o-mini',
      message: 'API Key hợp lệ định dạng cơ bản (chưa xác thực với OpenAI thật)'
    };
  }
}
