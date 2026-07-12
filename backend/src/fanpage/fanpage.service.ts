/**
 * File: fanpage.service.ts
 * Má»¥c Ä‘Ã­ch: Service xá»­ lÃ½ business logic cho Fanpage
 * Chá»©c nÄƒng: CRUD fanpage, mask access token, tá»± Ä‘á»™ng táº¡o cáº¥u hÃ¬nh OpenAI
 */
import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Fanpage, FanpageDocument } from './schemas/fanpage.schema';
import { CreateFanpageDto } from './dto/create-fanpage.dto';
import { UpdateFanpageDto } from './dto/update-fanpage.dto';
import { OpenAIConfigService } from '../openai-config/openai-config.service';
import { ApiTokenService } from '../api-token/api-token.service';
import { getMetaGraphApiVersion } from '../common/ads-api-version';
import { redactSecretString } from '../common/utils/secret-redaction.util';

@Injectable()
export class FanpageService {
  constructor(
    @InjectModel(Fanpage.name) private model: Model<FanpageDocument>,
    @Inject(OpenAIConfigService) private openaiConfigService: OpenAIConfigService,
    private readonly apiTokenService: ApiTokenService,
  ) {}

  /**
   * Attempt to resolve Page Access Token from configured System User Token.
   * Returns undefined when token is missing or page is not accessible by that token.
   */
  private async resolvePageAccessTokenFromSystemToken(pageId: string): Promise<{ accessToken?: string; pageName?: string; avatarUrl?: string }> {
    const systemToken = await this.apiTokenService.getRawSystemUserToken();
    if (!systemToken?.trim()) return {};

    const url = `https://graph.facebook.com/${getMetaGraphApiVersion()}/${encodeURIComponent(pageId)}?fields=id,name,access_token,picture{url}&access_token=${encodeURIComponent(systemToken.trim())}`;
    try {
      const response = await fetch(url);
      const result: any = await response.json();
      if (!response.ok || result?.error) return {};

      const accessToken = String(result?.access_token || '').trim();
      return {
        accessToken: accessToken || undefined,
        pageName: typeof result?.name === 'string' ? result.name : undefined,
        avatarUrl: result?.picture?.data?.url || undefined,
      };
    } catch {
      return {};
    }
  }

  /**
   * Táº¡o fanpage má»›i vÃ  tá»± Ä‘á»™ng táº¡o cáº¥u hÃ¬nh OpenAI máº·c Ä‘á»‹nh
   */
  async create(dto: CreateFanpageDto): Promise<Fanpage> {
    const normalizedDto: any = { ...dto };
    for (const field of ['openAIConfigId', 'connectedBy', 'defaultProductGroup']) {
      if (typeof normalizedDto[field] === 'string' && !normalizedDto[field].trim()) {
        delete normalizedDto[field];
      }
    }

    const pageId = String(dto.pageId || '').trim();
    const name = String(dto.name || '').trim();
    if (!pageId) throw new BadRequestException('Page ID cannot be empty');
    if (!name) throw new BadRequestException('Fanpage name cannot be empty');

    let accessToken = String(dto.accessToken || '').trim();
    let resolvedFromSystem: { accessToken?: string; pageName?: string; avatarUrl?: string } = {};
    if (!accessToken) {
      resolvedFromSystem = await this.resolvePageAccessTokenFromSystemToken(pageId);
      accessToken = String(resolvedFromSystem.accessToken || '').trim();
    }
    if (!accessToken) {
      throw new BadRequestException(
        'Cannot auto-resolve Page Access Token. Ensure System User Token has page permission or input token manually.',
      );
    }

    const exists = await this.model.exists({ pageId });
    if (exists) throw new BadRequestException('Page ID already exists');

    const { accessToken: _plaintextAccessToken, ...safeDto } = normalizedDto;
    const fanpage = new this.model({
      ...safeDto,
      pageId,
      name,
      hasAccessToken: false,
      avatarUrl: dto.avatarUrl || resolvedFromSystem.avatarUrl,
      connectedAt: dto.connectedAt ? new Date(dto.connectedAt) : new Date(),
      messageQuota: dto.messageQuota || 10000,
      aiEnabled: normalizedDto.openAIConfigId ? true : (dto as any).aiEnabled || false,
    });
    const savedFanpage = await fanpage.save();
    try {
      await this.apiTokenService.upsertFanpageAccessToken({
        fanpageId: String(savedFanpage._id),
        name,
        status: savedFanpage.status,
        accessToken,
        notes: 'Stored during Fanpage creation',
      });
      (savedFanpage as any).hasAccessToken = true;
      (savedFanpage as any).accessToken = undefined;
    } catch (error) {
      await this.model.findByIdAndDelete(savedFanpage._id);
      throw error;
    }

    // LUÃ”N táº¡o config AI má»›i cho fanpage (trá»« khi Ä‘Ã£ chá»n sáºµn config cÃ³ sáºµn)
    if (!normalizedDto.openAIConfigId) {
      try {
        // XÃ¢y dá»±ng system prompt dá»±a trÃªn thÃ´ng tin fanpage
        const description = dto.description || 'fanpage kinh doanh';
        const greetingScript = dto.greetingScript || '';
        const productSuggestScript = dto.productSuggestScript || '';
        
        let systemPrompt = `Báº¡n lÃ  trá»£ lÃ½ AI thÃ¢n thiá»‡n cá»§a fanpage "${dto.name}". `;
        systemPrompt += `LÄ©nh vá»±c kinh doanh: ${description}. `;
        
        if (greetingScript) {
          systemPrompt += `Lá»i chÃ o máº«u: "${greetingScript}". `;
        }
        
        if (productSuggestScript) {
          systemPrompt += `HÆ°á»›ng dáº«n tÆ° váº¥n: "${productSuggestScript}". `;
        }
        
        systemPrompt += `HÃ£y tráº£ lá»i ngáº¯n gá»n (1-2 cÃ¢u), thÃ¢n thiá»‡n báº±ng tiáº¿ng Viá»‡t. `;
        systemPrompt += `Náº¿u khÃ¡ch há»i chi tiáº¿t cáº§n tÆ° váº¥n thÃªm, hÃ£y nÃ³i: "MÃ¬nh Ä‘Ã£ ghi nháº­n, nhÃ¢n viÃªn sáº½ há»— trá»£ chi tiáº¿t sá»›m nháº¥t!". `;
        systemPrompt += `KhÃ´ng bá»‹a Ä‘áº·t thÃ´ng tin khÃ´ng cÃ³ trong mÃ´ táº£.`;

        const newConfig = await this.openaiConfigService.create({
          name: `AI Config - ${dto.name}`,
          purpose: 'customer-chatbot',
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 256,
          isDefault: true,
          scopeType: 'fanpage',
          scopeRef: savedFanpage._id.toString(),
          systemPrompt,
          apiKey: 'placeholder-key'
        });

        // Gáº¯n config vá»«a táº¡o vÃ o fanpage
        await this.model.findByIdAndUpdate(savedFanpage._id, {
          openAIConfigId: newConfig._id,
          aiEnabled: true
        });
        
        // Cáº­p nháº­t object tráº£ vá»
        (savedFanpage as any).openAIConfigId = newConfig._id;
        (savedFanpage as any).aiEnabled = true;
        
      } catch (error) {
        console.warn('KhÃ´ng thá»ƒ táº¡o cáº¥u hÃ¬nh OpenAI máº·c Ä‘á»‹nh:', error.message);
      }
    }

    return savedFanpage;
  }

  /**
   * Láº¥y danh sÃ¡ch fanpage vá»›i access token Ä‘Æ°á»£c mask
   */
  async findAll(): Promise<Fanpage[]> {
    const fanpages = await this.model.find().sort({ createdAt: -1 }).lean();
    
    // Mask access token Ä‘á»ƒ báº£o máº­t vÃ  auto-fix aiEnabled cho fanpage cÅ©
    return fanpages.map(fanpage => ({
      ...fanpage,
      accessToken: fanpage.hasAccessToken ? '********' : '',
      // Auto-fix: náº¿u cÃ³ openAIConfigId mÃ  aiEnabled = false thÃ¬ set true
      aiEnabled: fanpage.openAIConfigId ? true : (fanpage.aiEnabled || false),
    }));
  }

  async findOne(id: string): Promise<Fanpage> {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Fanpage khÃ´ng tá»“n táº¡i');
    return {
      ...doc,
      accessToken: doc.hasAccessToken ? '********' : '',
      // Auto-fix: náº¿u cÃ³ openAIConfigId mÃ  aiEnabled = false thÃ¬ set true
      aiEnabled: doc.openAIConfigId ? true : (doc.aiEnabled || false),
    } as any;
  }

  async update(id: string, dto: UpdateFanpageDto): Promise<Fanpage> {
    const update: any = { ...dto };
    const accessToken = String(update.accessToken || '').trim();
    delete update.accessToken;
    for (const field of ['openAIConfigId', 'connectedBy', 'defaultProductGroup']) {
      if (typeof update[field] === 'string' && !update[field].trim()) {
        delete update[field];
      }
    }
    if (dto.connectedAt) update.connectedAt = new Date(dto.connectedAt);
    if (dto.lastRefreshAt) update.lastRefreshAt = new Date(dto.lastRefreshAt);
    if (update.openAIConfigId && update.aiEnabled === undefined) {
      update.aiEnabled = true; // nếu chọn config AI thì tự bật AI
    }
    
    let doc = await this.model.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!doc) throw new NotFoundException('Fanpage khÃ´ng tá»“n táº¡i');
    if (accessToken) {
      await this.apiTokenService.upsertFanpageAccessToken({
        fanpageId: String(doc._id),
        name: doc.name,
        status: doc.status,
        accessToken,
        notes: 'Stored during Fanpage update',
      });
      doc = { ...doc, hasAccessToken: true } as any;
    }
    
    return {
      ...doc,
      accessToken: doc.hasAccessToken ? '********' : '',
      aiEnabled: doc.openAIConfigId ? true : (doc.aiEnabled || false),
    } as any;
  }

  async remove(id: string): Promise<void> {
    const res = await this.model.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Fanpage khÃ´ng tá»“n táº¡i');
  }

  /**
   * Táº¡o config AI cho fanpage Ä‘Ã£ tá»“n táº¡i
   */
  async createAIConfigForExisting(id: string) {
    const fanpage = await this.model.findById(id);
    if (!fanpage) throw new NotFoundException('Fanpage khÃ´ng tá»“n táº¡i');
    
    if (fanpage.openAIConfigId) {
      throw new BadRequestException('Fanpage Ä‘Ã£ cÃ³ config AI');
    }

    try {
      // XÃ¢y dá»±ng system prompt
      const description = fanpage.description || 'fanpage kinh doanh';
      const greetingScript = fanpage.greetingScript || '';
      const productSuggestScript = fanpage.productSuggestScript || '';
      
      let systemPrompt = `Báº¡n lÃ  trá»£ lÃ½ AI thÃ¢n thiá»‡n cá»§a fanpage "${fanpage.name}". `;
      systemPrompt += `LÄ©nh vá»±c kinh doanh: ${description}. `;
      
      if (greetingScript) {
        systemPrompt += `Lá»i chÃ o máº«u: "${greetingScript}". `;
      }
      
      if (productSuggestScript) {
        systemPrompt += `HÆ°á»›ng dáº«n tÆ° váº¥n: "${productSuggestScript}". `;
      }
      
      systemPrompt += `HÃ£y tráº£ lá»i ngáº¯n gá»n (1-2 cÃ¢u), thÃ¢n thiá»‡n báº±ng tiáº¿ng Viá»‡t. `;
      systemPrompt += `Náº¿u khÃ¡ch há»i chi tiáº¿t cáº§n tÆ° váº¥n thÃªm, hÃ£y nÃ³i: "MÃ¬nh Ä‘Ã£ ghi nháº­n, nhÃ¢n viÃªn sáº½ há»— trá»£ chi tiáº¿t sá»›m nháº¥t!". `;
      systemPrompt += `KhÃ´ng bá»‹a Ä‘áº·t thÃ´ng tin khÃ´ng cÃ³ trong mÃ´ táº£.`;

      const config = await this.openaiConfigService.create({
        name: `AI Config - ${fanpage.name}`,
        purpose: 'customer-chatbot',
        model: 'gpt-4o-mini',  
        temperature: 0.7,
        maxTokens: 256,
        isDefault: true,
        scopeType: 'fanpage',
        scopeRef: fanpage._id.toString(),
        systemPrompt,
        apiKey: 'placeholder-key'
      });

      // Cáº­p nháº­t fanpage
      await this.model.findByIdAndUpdate(id, {
        openAIConfigId: config._id,
        aiEnabled: true
      });

      return config;
    } catch (error) {
      throw new BadRequestException('KhÃ´ng thá»ƒ táº¡o config AI: ' + error.message);
    }
  }

  /**
   * Validate access token cá»§a fanpage vá»›i Facebook Graph API
   */
  async validateAccessToken(id: string): Promise<{ valid: boolean; error?: string; pageInfo?: any }> {
    const fanpage = await this.model.findById(id).select('+accessToken').lean();
    if (!fanpage) throw new NotFoundException('Fanpage khong ton tai');
    const accessToken = await this.apiTokenService.getRawAccessTokenForFanpage(String(fanpage._id), 'facebook')
      || String(fanpage.accessToken || '').trim();
    if (!accessToken) {
      return {
        valid: false,
        error: 'Fanpage chua co Access Token. Hay chay Sync tu System Token hoac nhap token thu cong.',
      };
    }

    try {
      const response = await fetch(`https://graph.facebook.com/${getMetaGraphApiVersion()}/me?access_token=${encodeURIComponent(accessToken)}`);
      const result = await response.json();

      if (result.error) {
        return {
          valid: false,
          error: `${redactSecretString(String(result.error.message))} (Code: ${result.error.code})`
        };
      }

      return {
        valid: true,
        pageInfo: {
          id: result.id,
          name: result.name,
          category: result.category
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: redactSecretString(error?.message || String(error))
      };
    }
  }

  /**
   * Refresh/cáº­p nháº­t access token cho fanpage
   */
  async refreshAccessToken(id: string, newAccessToken: string): Promise<{ success: boolean; message: string }> {
    if (!newAccessToken?.trim()) {
      throw new BadRequestException('Access token khÃ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng');
    }

    // Validate token má»›i trÆ°á»›c khi lÆ°u
    try {
      const response = await fetch(`https://graph.facebook.com/${getMetaGraphApiVersion()}/me?access_token=${encodeURIComponent(newAccessToken)}`);
      const result = await response.json();

      if (result.error) {
        throw new BadRequestException(`Token khÃ´ng há»£p lá»‡: ${redactSecretString(String(result.error.message))}`);
      }

      // Cáº­p nháº­t token má»›i
      const fanpage = await this.model.findById(id).lean();
      if (!fanpage) throw new NotFoundException('Fanpage khÃ´ng tá»“n táº¡i');
      await this.apiTokenService.upsertFanpageAccessToken({
        fanpageId: String(fanpage._id),
        name: fanpage.name,
        status: fanpage.status,
        accessToken: newAccessToken,
        validated: true,
        notes: 'Stored during Fanpage token refresh',
      });
      await this.model.updateOne({ _id: id }, { $set: { lastRefreshAt: new Date(), hasAccessToken: true }, $unset: { accessToken: 1 } });

      return {
        success: true,
        message: `Access token Ä‘Ã£ Ä‘Æ°á»£c cáº­p nháº­t thÃ nh cÃ´ng cho page: ${result.name}`
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Lá»—i khi validate token: ${redactSecretString(error?.message || String(error))}`);
    }
  }

  async syncFanpagesFromSystemUser(): Promise<{
    success: boolean;
    message: string;
    data: {
      total: number;
      inserted: number;
      updated: number;
      tokensUpserted: number;
      webhookSubscribed: number;
      webhookFailed: number;
      adAccountsTotal: number;
      adAccountsCreated: number;
      adAccountsUpdated: number;
    };
    errors?: Array<{ pageId: string; name: string; error: string }>;
  }> {
    const result = await this.apiTokenService.syncFanpagesFromSystemUserToken({
      upsertApiTokens: true,
      syncAdAccounts: true,
    });

    return {
      success: !!result.ok,
      message: result.ok ? 'Dong bo Fanpage thanh cong' : 'Dong bo Fanpage that bai',
      data: {
        total: result.totalPages || 0,
        inserted: result.created || 0,
        updated: result.updated || 0,
        tokensUpserted: result.tokensUpserted || 0,
        webhookSubscribed: result.webhookSubscribed || 0,
        webhookFailed: result.webhookFailed || 0,
        adAccountsTotal: result.adAccountsTotal || 0,
        adAccountsCreated: result.adAccountsCreated || 0,
        adAccountsUpdated: result.adAccountsUpdated || 0,
      },
      errors: Array.isArray(result.webhookErrors) ? result.webhookErrors : [],
    };
  }
}
