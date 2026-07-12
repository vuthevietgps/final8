/**
 * File: openai-config/openai-config.service.ts
 * Mục đích: Service xử lý business logic cho cấu hình OpenAI
 * Chức năng: CRUD cấu hình OpenAI, validation và error handling
 */
import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OpenAIConfig, OpenAIConfigDocument, OpenAIConfigPurpose } from './schemas/openai-config.schema';
import { CreateOpenAIConfigDto } from './dto/create-openai-config.dto';
import { UpdateOpenAIConfigDto } from './dto/update-openai-config.dto';
import { TestOpenAIKeyDto } from './dto/test-openai-key.dto';
import { decryptToken, encryptToken } from '../api-token/crypto.util';

@Injectable()
export class OpenAIConfigService implements OnModuleInit {
  private readonly logger = new Logger(OpenAIConfigService.name);

  constructor(@InjectModel(OpenAIConfig.name) private model: Model<OpenAIConfigDocument>) {}

  async onModuleInit(): Promise<void> {
    const migrated = await this.migrateLegacyPlaintextApiKeys();
    if (migrated) {
      this.logger.log(`Migrated legacy OpenAI API key storage: configs=${migrated}`);
    }
  }

  async migrateLegacyPlaintextApiKeys(batchSize = 100): Promise<number> {
    const safeBatchSize = Math.max(1, Math.min(1000, Math.trunc(batchSize) || 100));
    let migrated = 0;

    while (true) {
      const configs = await this.model
        .find({ apiKey: { $exists: true } })
        .select('+apiKey _id apiKeyEnc')
        .limit(safeBatchSize)
        .lean();
      if (!configs.length) break;

      let migratedThisBatch = 0;
      for (const config of configs) {
        const modified = await this.rewriteLegacyApiKey(config);
        if (modified) {
          migrated += 1;
          migratedThisBatch += 1;
        }
      }
      if (!migratedThisBatch) break;
    }

    return migrated;
  }

  toPublicConfig(config: any) {
    if (!config) return config;
    const plain = this.toPlainObject(config);
    const apiKey = this.resolveApiKey(plain);
    const publicConfig = {
      ...plain,
      purpose: plain.purpose || this.inferPurpose(plain),
      apiKey: this.isUsableApiKey(apiKey) ? this.maskSecret(apiKey as string) : undefined,
    };
    delete publicConfig.apiKeyEnc;
    return publicConfig;
  }

  toPublicConfigs(configs: any[] = []) {
    return configs.map((config) => this.toPublicConfig(config));
  }

  create(dto: CreateOpenAIConfigDto) {
    const payload = this.toStoredPayload(dto);
    payload.purpose = payload.purpose || this.inferPurpose(payload);
    const doc = new this.model(payload);
    return doc.save();
  }

  findAll(filter: any = {}) {
    return this.model.find(filter).sort({ createdAt: -1 }).lean();
  }

  async findOne(id: string) {
    try {
      const doc = await this.model.findById(id).select('+apiKey').lean();
      if (!doc) return null;
      return this.withUsableApiKey(doc);
    } catch (error) {
      return null;
    }
  }

  async update(id: string, dto: UpdateOpenAIConfigDto) {
    const existing = await this.model.findById(id).select('+apiKey').lean();
    if (!existing) throw new NotFoundException('Config khong ton tai');

    const { set, unset } = this.toStoredUpdate(dto, existing);
    const update: any = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;

    const doc = Object.keys(update).length
      ? await this.model.findByIdAndUpdate(id, update, { new: true }).lean()
      : existing;
    if (!doc) throw new NotFoundException('Config không tồn tại');
    return this.withUsableApiKey(doc);
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
  async pickConfig(opts: { fanpageId?: string; adGroupId?: string; purpose?: OpenAIConfigPurpose; }) {
    const { fanpageId, adGroupId } = opts;
    const purpose = opts.purpose || 'customer-chatbot';
    const purposeFilter = this.purposeFilter(purpose);
    if (fanpageId) {
      const fp = await this.findUsableConfig({ ...purposeFilter, scopeType: 'fanpage', scopeRef: fanpageId });
      if (fp) return fp;
    }
    if (adGroupId) {
      const ag = await this.findUsableConfig({ ...purposeFilter, scopeType: 'adgroup', scopeRef: adGroupId });
      if (ag) return ag;
    }
    const def = await this.findUsableConfig({ ...purposeFilter, scopeType: 'global', isDefault: true });
    if (def) return def;
    return this.findUsableConfig({ ...purposeFilter, scopeType: 'global' });
  }

  /**
   * Test nhanh API Key (mock): Không gọi ra OpenAI thực để tránh lộ key hay tốn quota.
   * Có thể mở rộng: gọi endpoint models.list với fetch nếu muốn xác thực thực.
   */
  async testKey(dto: TestOpenAIKeyDto) {
    const apiKey = dto.apiKey?.trim();
    const { model } = dto;
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

  private maskSecret(value: string) {
    if (!value) return '';
    if (value.length <= 12) return '********';
    return `${value.slice(0, 7)}...${value.slice(-4)}`;
  }

  private toPlainObject(config: any) {
    return typeof config?.toObject === 'function' ? config.toObject() : { ...config };
  }

  private toStoredPayload(dto: Partial<CreateOpenAIConfigDto>) {
    const payload: any = { ...dto };

    if (Object.prototype.hasOwnProperty.call(payload, 'apiKey')) {
      const apiKey = this.normalizeApiKey(payload.apiKey);
      delete payload.apiKey;

      if (apiKey && !this.isMaskedSecret(apiKey)) {
        if (!this.isPlaceholderKey(apiKey)) {
          payload.apiKeyEnc = encryptToken(apiKey);
        }
      }
    }

    return payload;
  }

  private toStoredUpdate(dto: UpdateOpenAIConfigDto, existing: any) {
    const set = this.toStoredPayload(dto);
    const unset: Record<string, 1> = {};
    const hasApiKeyInput = Object.prototype.hasOwnProperty.call(dto as any, 'apiKey');

    if (hasApiKeyInput) {
      const apiKey = this.normalizeApiKey((dto as any).apiKey);
      if (!apiKey || this.isMaskedSecret(apiKey)) {
        delete set.apiKey;
        delete set.apiKeyEnc;
        const existingPlainApiKey = this.normalizeApiKey(existing?.apiKey);
        if (existingPlainApiKey && !this.isPlaceholderKey(existingPlainApiKey)) {
          if (!existing?.apiKeyEnc) {
            set.apiKeyEnc = encryptToken(existingPlainApiKey);
          }
          unset.apiKey = 1;
        }
      } else if (this.isPlaceholderKey(apiKey)) {
        unset.apiKey = 1;
        unset.apiKeyEnc = 1;
      } else {
        unset.apiKey = 1;
      }
    } else {
      const existingPlainApiKey = this.normalizeApiKey(existing?.apiKey);
      if (existingPlainApiKey && !this.isPlaceholderKey(existingPlainApiKey)) {
        if (!existing?.apiKeyEnc) {
          set.apiKeyEnc = encryptToken(existingPlainApiKey);
        }
        unset.apiKey = 1;
      }
    }

    return { set, unset };
  }

  private async findUsableConfig(filter: any) {
    const docs = await this.model
      .find({ $and: [filter, this.usableConfigFilter()] })
      .select('+apiKey')
      .sort({ updatedAt: -1 })
      .lean();

    for (const doc of docs) {
      const config = await this.withUsableApiKey(doc);
      if (this.isUsableApiKey(config?.apiKey)) return config;
    }

    return null;
  }

  private purposeFilter(purpose: OpenAIConfigPurpose) {
    if (purpose === 'customer-chatbot') {
      return { $or: [{ purpose }, { purpose: { $exists: false } }] };
    }
    return { purpose };
  }

  private inferPurpose(config: any): OpenAIConfigPurpose {
    if (config?.purpose) return config.purpose;
    if (['fanpage', 'adgroup', 'messageScope'].includes(config?.scopeType)) return 'customer-chatbot';
    return 'customer-chatbot';
  }

  private usableConfigFilter() {
    return {
      status: 'active',
      $or: [
        { apiKeyEnc: { $exists: true, $nin: ['', null] } },
        { apiKey: { $exists: true, $nin: ['', 'placeholder-key', null] } },
      ],
    };
  }

  private async withUsableApiKey(config: any) {
    if (!config) return config;
    const plain = this.toPlainObject(config);
    let apiKey = this.resolveApiKey(plain);
    if (Object.prototype.hasOwnProperty.call(plain, 'apiKey')) {
      const legacyApiKey = this.normalizeApiKey(plain.apiKey);
      await this.rewriteLegacyApiKey(plain);
      if (this.isUsableApiKey(legacyApiKey)) {
        apiKey = legacyApiKey;
      } else if (this.isPlaceholderKey(legacyApiKey)) {
        apiKey = undefined;
      }
    }
    delete plain.apiKey;
    delete plain.apiKeyEnc;
    plain.purpose = plain.purpose || this.inferPurpose(plain);

    if (this.isUsableApiKey(apiKey)) plain.apiKey = apiKey;

    return plain as any;
  }

  private async rewriteLegacyApiKey(config: any): Promise<boolean> {
    if (!config?._id || !Object.prototype.hasOwnProperty.call(config, 'apiKey')) return false;

    const rawValue = config.apiKey;
    const legacyApiKey = this.normalizeApiKey(rawValue);
    const update: Record<string, any> = { $unset: { apiKey: 1 } };

    if (this.isUsableApiKey(legacyApiKey)) {
      const existingDecrypted = config.apiKeyEnc ? decryptToken(config.apiKeyEnc) : undefined;
      update.$set = {
        apiKeyEnc: existingDecrypted === legacyApiKey
          ? config.apiKeyEnc
          : encryptToken(legacyApiKey),
      };
    } else if (this.isPlaceholderKey(legacyApiKey)) {
      update.$unset.apiKeyEnc = 1;
    }

    const result = await this.model.updateOne(
      { _id: config._id, apiKey: rawValue },
      update,
    );
    return Number((result as any)?.modifiedCount ?? (result as any)?.nModified ?? 0) > 0;
  }

  private resolveApiKey(config: any): string | undefined {
    if (!config) return undefined;

    if (config.apiKeyEnc) {
      const decrypted = decryptToken(config.apiKeyEnc);
      if (decrypted) return decrypted;
    }

    return typeof config.apiKey === 'string' ? config.apiKey : undefined;
  }

  private normalizeApiKey(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
  }

  private isPlaceholderKey(value: string) {
    return value === 'placeholder-key';
  }

  private isMaskedSecret(value: string) {
    return value.includes('...') || /^\*+$/.test(value);
  }

  private isUsableApiKey(value?: string) {
    const apiKey = this.normalizeApiKey(value);
    return Boolean(apiKey && !this.isPlaceholderKey(apiKey) && !this.isMaskedSecret(apiKey));
  }
}
