import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ChatMessageService } from './chat-message.service';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { UpdateChatMessageDto } from './dto/update-chat-message.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { InjectModel } from '@nestjs/mongoose';
import { Fanpage, FanpageDocument } from '../fanpage/schemas/fanpage.schema';
import { OpenAIConfigService } from '../openai-config/openai-config.service';
import fetch from 'node-fetch';
import { Model } from 'mongoose';

@Controller('chat-messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatMessageController {
  constructor(
    private service: ChatMessageService,
    @InjectModel(Fanpage.name) private fanpageModel: Model<FanpageDocument>,
    private openaiConfig: OpenAIConfigService,
  ) {}

  // Individual message CRUD removed - use conversation-level operations instead

  // Conversation endpoints
  @Get('conversations/list/all') @RequirePermissions('chat-messages') conversations(@Query() q?: any) { return this.service.listConversations(q||{}); }
  @Get('conversations/:fanpageId/:senderPsid') @RequirePermissions('chat-messages') conversation(@Param('fanpageId') fanpageId: string, @Param('senderPsid') senderPsid: string) { return this.service.getConversation(fanpageId, senderPsid); }
  @Patch('conversations/:fanpageId/:senderPsid/resolve') @RequirePermissions('chat-messages') resolve(@Param('fanpageId') fanpageId: string, @Param('senderPsid') senderPsid: string) { return this.service.resolveConversation(fanpageId, senderPsid); }
  @Patch('conversations/:fanpageId/:senderPsid/auto-ai') @RequirePermissions('chat-messages') toggleAutoAi(@Param('fanpageId') fanpageId: string, @Param('senderPsid') senderPsid: string, @Body() body: { enabled: boolean }) { return this.service.toggleAutoAI(fanpageId, senderPsid, body.enabled); }
  @Get('conversations/:fanpageId/:senderPsid/extract-order') @RequirePermissions('chat-messages') extract(@Param('fanpageId') fanpageId: string, @Param('senderPsid') senderPsid: string){ return this.service.extractOrderDraft(fanpageId, senderPsid); }

  // --- Outbound send (reply to user) ---
  @Post('send') @RequirePermissions('chat-messages')
  async sendMessage(
    @Body() body: { fanpageId: string; senderPsid: string; text: string }
  ) {
    if(!body.fanpageId || !body.senderPsid || !body.text) throw new BadRequestException('Thiếu fanpageId / senderPsid / text');
    // fanpageId có thể là _id hoặc pageId để tiện dụng
    let fanpage = await this.fanpageModel.findById(body.fanpageId).lean();
    if(!fanpage) {
      fanpage = await this.fanpageModel.findOne({ pageId: body.fanpageId }).lean();
    }
    if(!fanpage) throw new BadRequestException('Fanpage không tồn tại (fanpageId có thể là _id hoặc pageId)');
    const token = fanpage.accessToken;
  // Dùng version mới hơn để khớp với cấu hình webhook (UI đang hiển thị v23.0). Có thể override bằng ENV FB_GRAPH_VERSION
  const graphVersion = process.env.FB_GRAPH_VERSION || 'v23.0';
    const url = `https://graph.facebook.com/${graphVersion}/me/messages?access_token=${encodeURIComponent(token)}`;
    let responseJson: any;
    try {
      const fetchRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: body.senderPsid }, message: { text: body.text } })
      });
      responseJson = await fetchRes.json();
      if(!fetchRes.ok) {
        throw new BadRequestException('Facebook API lỗi: ' + JSON.stringify(responseJson));
      }
    } catch (e: any) {
      throw new BadRequestException(e.message || 'Gửi tin thất bại');
    }
    const saved = await this.service.recordOutboundMessage({ fanpageId: fanpage._id.toString(), senderPsid: body.senderPsid, text: body.text, rawResponse: responseJson });
    return { message: 'Đã gửi', fb: responseJson, saved };
  }

  // --- AI generate & send (server -> FB) ---
  @Post('send/ai') @RequirePermissions('chat-messages')
  async sendAiMessage(
    @Body() body: { fanpageId: string; senderPsid: string; previewOnly?: boolean }
  ) {
    if(!body.fanpageId || !body.senderPsid) throw new BadRequestException('Thiếu fanpageId / senderPsid');
    // Lấy messages để build context
    const conv = await this.service.getConversation(body.fanpageId, body.senderPsid).catch(()=> null);
    const recent = conv?.messages.slice(0, 10).reverse() || []; // lấy tối đa 10 message gần nhất (đã sort desc)
    // Ưu tiên config explicit
    let fanpage = await this.fanpageModel.findById(body.fanpageId).lean();
    if(!fanpage) fanpage = await this.fanpageModel.findOne({ pageId: body.fanpageId }).lean();
    let config = null;
    if (fanpage?.openAIConfigId) {
      try {
        config = await this.openaiConfig.findOne(fanpage.openAIConfigId.toString());
      } catch (error) {
        console.warn('Config not found for fanpage:', fanpage.openAIConfigId);
      }
    }
    if(!config) config = await this.openaiConfig.pickConfig({ fanpageId: body.fanpageId });
    if(!config) throw new BadRequestException('Chưa có cấu hình OpenAI khả dụng');
    if(!config.apiKey) throw new BadRequestException('Config thiếu apiKey');
    const systemPrompt = config.systemPrompt || 'Bạn là trợ lý AI trả lời ngắn gọn.';
    const messagesForApi = [
      { role: 'system', content: systemPrompt },
      ...recent.reverse().map(m=> ({ role: m.direction==='in' ? 'user':'assistant', content: m.content }))
    ];
    // Gọi OpenAI API (streaming đơn giản -> full)
    const model = config.model || 'gpt-4o-mini';
    let aiText = '';
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model, messages: messagesForApi, temperature: config.temperature ?? 0.7, max_tokens: config.maxTokens || 256 })
      });
      const json: any = await resp.json();
      if(!resp.ok) throw new Error(json.error?.message || 'OpenAI API lỗi');
      aiText = json.choices?.[0]?.message?.content?.trim() || '(Không có nội dung)';
      if(body.previewOnly) {
        return { preview: aiText, model, configId: (config as any)._id };
      }
      // gửi ra Messenger
      const sendRes = await this.sendMessage({ fanpageId: body.fanpageId, senderPsid: body.senderPsid, text: aiText });
      // Cập nhật message vừa lưu để đánh dấu AI
      // sendMessage hiện lưu recordOutboundMessage không set isAI; có thể patch sau hoặc update tạm thời
      try {
        if((sendRes as any).saved?._id){
          await (this.service as any).update((sendRes as any).saved._id, { isAI: true, aiModelUsed: model } as any);
        }
      } catch(_) {}
      return { ...sendRes, modelUsed: model };
    } catch (e:any) {
      throw new BadRequestException(e.message || 'AI generate thất bại');
    }
  }
}
