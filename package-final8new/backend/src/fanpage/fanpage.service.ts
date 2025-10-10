/**
 * File: fanpage.service.ts
 * Mục đích: Service xử lý business logic cho Fanpage
 * Chức năng: CRUD fanpage, mask access token, tự động tạo cấu hình OpenAI
 */
import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Fanpage, FanpageDocument } from './schemas/fanpage.schema';
import { CreateFanpageDto } from './dto/create-fanpage.dto';
import { UpdateFanpageDto } from './dto/update-fanpage.dto';
import { OpenAIConfigService } from '../openai-config/openai-config.service';

@Injectable()
export class FanpageService {
  constructor(
    @InjectModel(Fanpage.name) private model: Model<FanpageDocument>,
    @Inject(OpenAIConfigService) private openaiConfigService: OpenAIConfigService
  ) {}

  /**
   * Tạo fanpage mới và tự động tạo cấu hình OpenAI mặc định
   */
  async create(dto: CreateFanpageDto): Promise<Fanpage> {
    // Kiểm tra pageId đã tồn tại
    const exists = await this.model.exists({ pageId: dto.pageId });
    if (exists) throw new BadRequestException('Page ID đã tồn tại');
    
    // Tạo fanpage
    const fanpage = new this.model({ 
      ...dto, 
      connectedAt: dto.connectedAt ? new Date(dto.connectedAt) : new Date(),
      messageQuota: dto.messageQuota || 10000, // Mặc định 10k tin/tháng
      aiEnabled: dto.openAIConfigId ? true : (dto as any).aiEnabled || false,
    });
    const savedFanpage = await fanpage.save();

    // LUÔN tạo config AI mới cho fanpage (trừ khi đã chọn sẵn config có sẵn)
    if (!dto.openAIConfigId) {
      try {
        // Xây dựng system prompt dựa trên thông tin fanpage
        const description = dto.description || 'fanpage kinh doanh';
        const greetingScript = dto.greetingScript || '';
        const productSuggestScript = dto.productSuggestScript || '';
        
        let systemPrompt = `Bạn là trợ lý AI thân thiện của fanpage "${dto.name}". `;
        systemPrompt += `Lĩnh vực kinh doanh: ${description}. `;
        
        if (greetingScript) {
          systemPrompt += `Lời chào mẫu: "${greetingScript}". `;
        }
        
        if (productSuggestScript) {
          systemPrompt += `Hướng dẫn tư vấn: "${productSuggestScript}". `;
        }
        
        systemPrompt += `Hãy trả lời ngắn gọn (1-2 câu), thân thiện bằng tiếng Việt. `;
        systemPrompt += `Nếu khách hỏi chi tiết cần tư vấn thêm, hãy nói: "Mình đã ghi nhận, nhân viên sẽ hỗ trợ chi tiết sớm nhất!". `;
        systemPrompt += `Không bịa đặt thông tin không có trong mô tả.`;

        const newConfig = await this.openaiConfigService.create({
          name: `AI Config - ${dto.name}`,
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 256,
          isDefault: true,
          scopeType: 'fanpage',
          scopeRef: savedFanpage._id.toString(),
          systemPrompt,
          apiKey: 'placeholder-key'
        });

        // Gắn config vừa tạo vào fanpage
        await this.model.findByIdAndUpdate(savedFanpage._id, {
          openAIConfigId: newConfig._id,
          aiEnabled: true
        });
        
        // Cập nhật object trả về
        (savedFanpage as any).openAIConfigId = newConfig._id;
        (savedFanpage as any).aiEnabled = true;
        
      } catch (error) {
        console.warn('Không thể tạo cấu hình OpenAI mặc định:', error.message);
      }
    }

    return savedFanpage;
  }

  /**
   * Lấy danh sách fanpage với access token được mask
   */
  async findAll(): Promise<Fanpage[]> {
    const fanpages = await this.model.find().sort({ createdAt: -1 }).lean();
    
    // Mask access token để bảo mật và auto-fix aiEnabled cho fanpage cũ
    return fanpages.map(fanpage => ({
      ...fanpage,
      accessToken: this.maskAccessToken(fanpage.accessToken),
      // Auto-fix: nếu có openAIConfigId mà aiEnabled = false thì set true
      aiEnabled: fanpage.openAIConfigId ? true : (fanpage.aiEnabled || false),
    }));
  }

  async findOne(id: string): Promise<Fanpage> {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Fanpage không tồn tại');
    return {
      ...doc,
      accessToken: this.maskAccessToken(doc.accessToken),
      // Auto-fix: nếu có openAIConfigId mà aiEnabled = false thì set true
      aiEnabled: doc.openAIConfigId ? true : (doc.aiEnabled || false),
    } as any;
  }

  async update(id: string, dto: UpdateFanpageDto): Promise<Fanpage> {
    const update: any = { ...dto };
    if (dto.connectedAt) update.connectedAt = new Date(dto.connectedAt);
    if (dto.lastRefreshAt) update.lastRefreshAt = new Date(dto.lastRefreshAt);
    if (dto.openAIConfigId && update.aiEnabled === undefined) {
      update.aiEnabled = true; // nếu chọn config AI thì tự bật AI
    }
    
    const doc = await this.model.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!doc) throw new NotFoundException('Fanpage không tồn tại');
    
    return {
      ...doc,
      accessToken: this.maskAccessToken(doc.accessToken),
      aiEnabled: doc.openAIConfigId ? true : (doc.aiEnabled || false),
    } as any;
  }

  async remove(id: string): Promise<void> {
    const res = await this.model.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Fanpage không tồn tại');
  }

  /**
   * Tạo config AI cho fanpage đã tồn tại
   */
  async createAIConfigForExisting(id: string) {
    const fanpage = await this.model.findById(id);
    if (!fanpage) throw new NotFoundException('Fanpage không tồn tại');
    
    if (fanpage.openAIConfigId) {
      throw new BadRequestException('Fanpage đã có config AI');
    }

    try {
      // Xây dựng system prompt
      const description = fanpage.description || 'fanpage kinh doanh';
      const greetingScript = fanpage.greetingScript || '';
      const productSuggestScript = fanpage.productSuggestScript || '';
      
      let systemPrompt = `Bạn là trợ lý AI thân thiện của fanpage "${fanpage.name}". `;
      systemPrompt += `Lĩnh vực kinh doanh: ${description}. `;
      
      if (greetingScript) {
        systemPrompt += `Lời chào mẫu: "${greetingScript}". `;
      }
      
      if (productSuggestScript) {
        systemPrompt += `Hướng dẫn tư vấn: "${productSuggestScript}". `;
      }
      
      systemPrompt += `Hãy trả lời ngắn gọn (1-2 câu), thân thiện bằng tiếng Việt. `;
      systemPrompt += `Nếu khách hỏi chi tiết cần tư vấn thêm, hãy nói: "Mình đã ghi nhận, nhân viên sẽ hỗ trợ chi tiết sớm nhất!". `;
      systemPrompt += `Không bịa đặt thông tin không có trong mô tả.`;

      const config = await this.openaiConfigService.create({
        name: `AI Config - ${fanpage.name}`,
        model: 'gpt-4o-mini',  
        temperature: 0.7,
        maxTokens: 256,
        isDefault: true,
        scopeType: 'fanpage',
        scopeRef: fanpage._id.toString(),
        systemPrompt,
        apiKey: 'placeholder-key'
      });

      // Cập nhật fanpage
      await this.model.findByIdAndUpdate(id, {
        openAIConfigId: config._id,
        aiEnabled: true
      });

      return config;
    } catch (error) {
      throw new BadRequestException('Không thể tạo config AI: ' + error.message);
    }
  }

  /**
   * Mask access token để ẩn thông tin nhạy cảm
   */
  private maskAccessToken(token: string): string {
    if (!token || token.length < 8) return '****';
    return '*'.repeat(token.length - 4) + token.slice(-4);
  }
}
