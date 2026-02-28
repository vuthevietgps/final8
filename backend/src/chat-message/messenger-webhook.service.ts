import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatMessageService } from './chat-message.service';
import { Fanpage, FanpageDocument } from '../fanpage/schemas/fanpage.schema';
import { OpenAIConfigService } from '../openai-config/openai-config.service';
import { VisionAIService } from '../product/vision-ai.service';
import { ProductService } from '../product/product.service';
import { MediaService } from '../media/media.service';
import { ChatEventsService } from './chat-events.service';

import fetch from 'node-fetch';

interface WebhookParams {
  fanpage: any;
  pageId: string;
  senderPsid: string;
  lastUserMessage: string;
  savedInboundId?: string;
  hasProductIntent?: boolean;
  hasPhoneNumber?: boolean;
}

interface ReferralData {
  ref?: string;
  ad_id?: string;
  source?: string; // 'ADS' | 'SHORTLINK' | 'MESSENGER_CODE' | etc.
  type?: string; // 'OPEN_THREAD'
  ads_context_data?: {
    ad_title?: string;
    photo_url?: string;
    video_url?: string;
    post_id?: string;
    product_id?: string;
  };
}

interface MessagingEvent {
  sender?: { id: string };
  recipient?: { id: string };
  timestamp?: number;
  // Present when conversation is initiated from a Click-to-Messenger Ad
  ad_id?: string;
  // messaging_referrals event - when existing thread user comes back from ad
  referral?: ReferralData;
  message?: {
    mid?: string;
    text?: string;
    attachments?: any[];
    to?: { id: string };
    referral?: ReferralData;
    quick_reply?: { payload?: string };
  };
  postback?: {
    payload?: string;
    // Postback can also contain referral when initiated from ad
    referral?: ReferralData;
  };
}

@Injectable()
export class MessengerWebhookService {
  private readonly logger = new Logger(MessengerWebhookService.name);
  private readonly isDebugMode = process.env.CHAT_WEBHOOK_DEBUG === '1' || process.env.NODE_ENV !== 'production';

  constructor(
    private readonly chatService: ChatMessageService,
    @InjectModel(Fanpage.name) private fanpageModel: Model<FanpageDocument>,
    private readonly openaiConfig: OpenAIConfigService,
    private readonly visionAIService: VisionAIService,
    private readonly productService: ProductService,
    private readonly mediaService: MediaService,
    private readonly chatEvents: ChatEventsService,
  ) {}

  async handle(body: any): Promise<void> {
    if (body.object !== 'page') {
      throw new Error('Unsupported object type');
    }
    await this.processWebhookEntries(body.entry || []);
  }

  private async processWebhookEntries(entries: any[]): Promise<void> {
    for (const entry of entries) {
      const pageId = entry.id;
      const fanpage = await this.getFanpage(pageId);
      for (const messagingEvent of entry.messaging || []) {
        await this.processMessagingEvent(messagingEvent, fanpage, pageId);
      }
    }
  }

  private async getFanpage(pageId: string): Promise<any> {
    let fanpage = await this.fanpageModel.findOne({ pageId }).lean();
    if (fanpage && !fanpage.subscribedWebhook) {
      await this.fanpageModel.updateOne(
        { _id: fanpage._id },
        {
          $set: {
            subscribedWebhook: true,
            connectedAt: fanpage.connectedAt || new Date(),
          },
        },
      );
      fanpage = await this.fanpageModel.findOne({ pageId }).lean();
    }
    return fanpage;
  }

  private async processMessagingEvent(
    messagingEvent: MessagingEvent,
    fanpage: any,
    pageId: string,
  ): Promise<void> {
    const senderPsid = messagingEvent.sender?.id;
    const recipientId = messagingEvent.recipient?.id;
    const timestamp = messagingEvent.timestamp ? new Date(messagingEvent.timestamp) : new Date();
    if (!senderPsid || !recipientId) return;

    // Resolve ad_id from multiple possible sources (priority order)
    const adId = 
      (messagingEvent as any)?.ad_id || // Direct ad_id on messaging event
      messagingEvent.referral?.ad_id || // messaging_referrals event
      messagingEvent.message?.referral?.ad_id || // Message with referral
      messagingEvent.postback?.referral?.ad_id || // Postback with referral (Get Started from ad)
      undefined;

    if (messagingEvent.message) {
      await this.handleTextMessage(messagingEvent.message, fanpage, pageId, senderPsid, timestamp, adId, messagingEvent.referral);
    } else if (messagingEvent.postback) {
      await this.handlePostback(messagingEvent.postback, fanpage, pageId, senderPsid, timestamp, adId, messagingEvent.referral);
    } else if (messagingEvent.referral) {
      // Handle standalone messaging_referrals event (user with existing thread comes back from ad)
      await this.handleReferralEvent(messagingEvent.referral, fanpage, pageId, senderPsid, timestamp);
    }
  }

  private async handleTextMessage(
    message: any,
    fanpage: any,
    pageId: string,
    senderPsid: string,
    timestamp: Date,
    adId?: string,
    eventReferral?: ReferralData,
  ): Promise<void> {
    const isInbound = senderPsid !== pageId;
    const content = message.text || (message.attachments ? '[Attachment]' : '[Empty]');

    // Resolve adGroupId from multiple sources (priority order)
    let adGroupId: string | undefined;

    // 1. Try to extract from message.referral.ref (custom ref parameter with adgroup embedded)
    if (message.referral?.ref) {
      const ref = message.referral.ref;
      const adGroupMatch = ref.match(/(?:ad_|adset_|adgroup_)(\d+)/i);
      if (adGroupMatch) adGroupId = adGroupMatch[1];
    }

    // 2. Try to extract from eventReferral.ref (messaging_referrals event)
    if (!adGroupId && eventReferral?.ref) {
      const adGroupMatch = eventReferral.ref.match(/(?:ad_|adset_|adgroup_)(\d+)/i);
      if (adGroupMatch) adGroupId = adGroupMatch[1];
    }

    // 3. Try quick_reply payload
    if (!adGroupId && message.quick_reply?.payload) {
      const payload = message.quick_reply.payload;
      const adGroupMatch = payload.match(/adgroup[_:](\d+)/i);
      if (adGroupMatch) adGroupId = adGroupMatch[1];
    }

    // Fallback: if we have an ad_id from Messenger webhook, resolve true Ad Set (adgroup) via Graph API
    if (!adGroupId && adId) {
      try {
        const resolvedAdset = await this.resolveAdSetIdFromAdId(adId, fanpage);
        if (resolvedAdset) adGroupId = resolvedAdset;
      } catch (e) {
        if (this.isDebugMode) this.logger.warn(`Failed to resolve adset from ad_id=${adId}: ${(e as any)?.message}`);
      }
    }

    const savedMessage = await this.chatService.create({
      fanpageId: fanpage?._id?.toString() || pageId,
      senderPsid: isInbound ? senderPsid : (message.to?.id || senderPsid),
      content,
      direction: isInbound ? 'in' : 'out',
      raw: message,
      receivedAt: timestamp as any,
      awaitingHuman: isInbound,
      adGroupId: adGroupId || undefined,
    });

    // emit SSE new-message event
    try {
      const fanId = String(fanpage?._id?.toString() || pageId);
      this.chatEvents.emit({ type: 'new-message', fanpageId: fanId, senderPsid, direction: isInbound ? 'in' : 'out', snippet: String(content||'').slice(0,120), createdAt: timestamp });
    } catch (e) {
      this.logger.warn('Failed to emit chat event: ' + (e as any)?.message);
    }

    if (this.isDebugMode) {
      this.logger.debug('Message processed', {
        pageId,
        isInbound,
        senderPsid,
        contentSnippet: content.slice(0, 80),
      });
    }

    if (isInbound) {
  const productKeywords = ['sản phẩm', 'hàng', 'mua', 'bán', 'giá', 'ảnh', 'hình', 'catalog', 'danh sách'];
  const hasProductIntent = productKeywords.some((keyword) => (content || '').toLowerCase().includes(keyword));

      const phonePattern = /(0|\+84)[0-9]{8,10}|([0-9]{10,11})/g;
      const hasPhoneNumber = phonePattern.test(content);

      if (hasPhoneNumber) {
        await this.chatService.create({
          fanpageId: fanpage?._id?.toString() || pageId,
          senderPsid,
          content: '[LEAD_CAPTURED] Số điện thoại đã được cung cấp - Ưu tiên gọi lại',
          direction: 'system',
          raw: { phoneNumber: content.match(phonePattern), capturedAt: new Date() },
          receivedAt: timestamp as any,
          awaitingHuman: true,
        } as any);
      }

      this.triggerAutoAiReply({
        fanpage,
        pageId,
        senderPsid,
        lastUserMessage: content,
        savedInboundId: (savedMessage as any)._id?.toString(),
        hasProductIntent,
        hasPhoneNumber,
      });
    }
  }

  /**
   * Resolve Ad Set ID (adgroup) from an Ad ID using Facebook Graph API
   * Requires a Marketing API token with ads_read permission. Token precedence:
   *   1) process.env.FB_ADS_ACCESS_TOKEN
   *   2) fanpage.adAccessToken (if present)
   *   3) fanpage.accessToken (fallback; may lack ads_read and fail)
   */
  private async resolveAdSetIdFromAdId(adId: string, fanpage: any): Promise<string | undefined> {
    const token = process.env.FB_ADS_ACCESS_TOKEN || (fanpage && (fanpage as any).adAccessToken) || fanpage?.accessToken;
    if (!token) return undefined;
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(adId)}?fields=adset_id,adset{name},campaign_id&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { method: 'GET' });
    const data: any = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      throw new Error(`Graph error: ${msg}`);
    }
    const adsetId = data?.adset_id || data?.adset?.id;
    if (this.isDebugMode) this.logger.debug(`[Graph] ad_id=${adId} -> adset_id=${adsetId || 'N/A'}`);
    return adsetId || undefined;
  }

  private async handlePostback(
    postback: any,
    fanpage: any,
    pageId: string,
    senderPsid: string,
    timestamp: Date,
    adId?: string,
    eventReferral?: ReferralData,
  ): Promise<void> {
    const payload = postback.payload || '[Postback]';

    // Resolve adGroupId from postback referral or event referral
    let adGroupId: string | undefined;
    const referral = postback.referral || eventReferral;

    // 1. Try to extract from referral.ref (custom ref parameter with adgroup embedded)
    if (referral?.ref) {
      const adGroupMatch = referral.ref.match(/(?:ad_|adset_|adgroup_)(\d+)/i);
      if (adGroupMatch) adGroupId = adGroupMatch[1];
    }

    // 2. Fallback: resolve adset_id from ad_id via Graph API
    if (!adGroupId && adId) {
      try {
        const resolvedAdset = await this.resolveAdSetIdFromAdId(adId, fanpage);
        if (resolvedAdset) adGroupId = resolvedAdset;
      } catch (e) {
        if (this.isDebugMode) this.logger.warn(`[Postback] Failed to resolve adset from ad_id=${adId}: ${(e as any)?.message}`);
      }
    }

    // Log referral info for debugging
    if (this.isDebugMode && (adId || referral)) {
      this.logger.debug('[Postback] Ad context detected', {
        ad_id: adId,
        adGroupId,
        source: referral?.source,
        ads_context_data: referral?.ads_context_data,
      });
    }

    await this.chatService.create({
      fanpageId: fanpage?._id?.toString() || pageId,
      senderPsid,
      content: '[POSTBACK] ' + payload,
      direction: 'in',
      raw: { ...postback, resolved_adGroupId: adGroupId, resolved_ad_id: adId },
      receivedAt: timestamp as any,
      awaitingHuman: true,
      adGroupId: adGroupId || undefined,
    });

    if (this.isDebugMode) {
      this.logger.debug('Postback processed', { pageId, senderPsid, payload, adGroupId });
    }

    this.triggerAutoAiReply({ fanpage, pageId, senderPsid, lastUserMessage: payload });
  }

  /**
   * Handle standalone messaging_referrals event
   * This event is triggered when a user with an existing thread comes back via an ad link
   * (different from postback which creates a new thread)
   */
  private async handleReferralEvent(
    referral: ReferralData,
    fanpage: any,
    pageId: string,
    senderPsid: string,
    timestamp: Date,
  ): Promise<void> {
    const adId = referral.ad_id;
    let adGroupId: string | undefined;

    // 1. Try to extract from referral.ref (custom ref parameter with adgroup embedded)
    if (referral.ref) {
      const adGroupMatch = referral.ref.match(/(?:ad_|adset_|adgroup_)(\d+)/i);
      if (adGroupMatch) adGroupId = adGroupMatch[1];
    }

    // 2. Fallback: resolve adset_id from ad_id via Graph API
    if (!adGroupId && adId) {
      try {
        const resolvedAdset = await this.resolveAdSetIdFromAdId(adId, fanpage);
        if (resolvedAdset) adGroupId = resolvedAdset;
      } catch (e) {
        if (this.isDebugMode) this.logger.warn(`[Referral] Failed to resolve adset from ad_id=${adId}: ${(e as any)?.message}`);
      }
    }

    // Log referral info for debugging
    if (this.isDebugMode) {
      this.logger.debug('[Referral] User returned from ad', {
        ad_id: adId,
        adGroupId,
        source: referral.source,
        ref: referral.ref,
        ads_context_data: referral.ads_context_data,
      });
    }

    // Create a system message to record the referral event
    await this.chatService.create({
      fanpageId: fanpage?._id?.toString() || pageId,
      senderPsid,
      content: `[REFERRAL] User returned from ${referral.source === 'ADS' ? 'Ad' : 'Link'}${referral.ads_context_data?.ad_title ? `: ${referral.ads_context_data.ad_title}` : ''}`,
      direction: 'system' as any, // System event, not in/out
      raw: { referral, resolved_adGroupId: adGroupId, resolved_ad_id: adId },
      receivedAt: timestamp as any,
      awaitingHuman: false, // Referral event doesn't need human attention by default
      adGroupId: adGroupId || undefined,
    } as any);

    // Update conversation's lastAdGroupId directly if we have one
    if (adGroupId && fanpage?._id) {
      try {
        const Conversation = this.chatService['convModel'];
        await Conversation.updateOne(
          { fanpageId: fanpage._id, senderPsid },
          { $set: { lastAdGroupId: adGroupId } }
        );
      } catch (e) {
        if (this.isDebugMode) this.logger.warn(`[Referral] Failed to update conversation lastAdGroupId: ${(e as any)?.message}`);
      }
    }
  }

  private triggerAutoAiReply(params: WebhookParams): void {
    this.autoAiReplySafe(params).catch((error) => {
      if (this.isDebugMode) this.logger.error('Auto AI reply failed', error.message);
    });
  }

  private async autoAiReplySafe(params: WebhookParams): Promise<void> {
    try {
      const { fanpage, pageId, senderPsid, lastUserMessage, hasProductIntent } = params;
      if (this.isDebugMode) {
        this.logger.debug('Auto AI reply started', {
          pageId,
          senderPsid,
          messageSnippet: lastUserMessage.slice(0, 50),
        });
      }

      const fp = fanpage || (await this.fanpageModel.findOne({ pageId }).lean());
      if (!fp || !fp.aiEnabled) {
        if (this.isDebugMode) this.logger.debug('AI disabled or fanpage not found', { pageId });
        return;
      }

      const convData = await this.chatService.getConversation(fp._id.toString(), senderPsid);
      const recentMessages = convData.messages.slice(0, 10);
      const lastInbound = recentMessages.find((m) => m.direction === 'in');
      const hasAiReplyToLastInbound =
        lastInbound &&
        recentMessages.some(
          (m) =>
            m.direction === 'out' &&
            m.isAI &&
            (m as any).createdAt &&
            (lastInbound as any).createdAt &&
            new Date((m as any).createdAt).getTime() > new Date((lastInbound as any).createdAt).getTime(),
        );
      if (hasAiReplyToLastInbound) {
        if (this.isDebugMode) this.logger.debug('AI already replied to latest inbound');
        return;
      }

      const conversation = await this.chatService.listConversations({ fanpageId: fp._id.toString(), senderPsid });
      const convItem = Array.isArray(conversation.items) ? conversation.items.find((c) => c.senderPsid === senderPsid) : null;
      if (convItem && convItem.autoAiEnabled === false) return;

  // Không còn sử dụng Generic Script; tiếp tục ngay cả khi description trống (sẽ có fallback)

      let config: any = null;
      if (fp.openAIConfigId) {
        try {
          config = await this.openaiConfig.findOne(fp.openAIConfigId.toString());
        } catch (error) {
          this.logger.warn('OpenAI config not found for fanpage', fp.openAIConfigId);
        }
      }
      if (!config) {
        config = await this.openaiConfig.pickConfig({ fanpageId: fp._id.toString() });
      }
      if (!config || !config.apiKey || config.apiKey === 'placeholder-key') {
        if (this.isDebugMode) this.logger.debug('No valid OpenAI config found');
        return;
      }
      if (this.isDebugMode) {
        this.logger.debug('OpenAI config loaded', { configName: config.name, model: config.model });
      }

      // BỎ rule theo catalog – dùng mô tả + ảnh media. Chọn ảnh theo ALT/TAG khớp ý định khách.
      const sanitize = (t: string) => (t || '')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu, '') // Only emojis
        .replace(/\s{2,}/g, ' ')
        .trim();

      const stripDiacritics = (s: string) => s? s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g,'d').replace(/Đ/g,'D') : '';
      const keywordSource = [lastUserMessage, ...((convData?.messages||[]).slice(0,5).map((m:any)=> m.content||''))].join(' ');
      const keywords = Array.from(new Set(keywordSource
        .split(/[^A-Za-zÀ-ỹĐđ0-9]+/)
        .filter(w=>w && w.length>=2)
        .map(w=> stripDiacritics(w.toLowerCase())))).slice(0,12);

      let topMediaImages: string[] = [];
      let hasIntentMatchedImages = false;
      try {
        const media = await this.mediaService.list({ fanpageId: fp._id.toString(), page: 1, limit: 50 });
        const items: any[] = (media.items || []);
        const scored = items.map(m=>{
          const alt = stripDiacritics(String(m.alt||'').toLowerCase());
          const tags: string[] = Array.isArray(m.tags)? m.tags.map((t:string)=> stripDiacritics(String(t).toLowerCase())): [];
          let score = 0;
          for(const k of keywords){ if(alt.includes(k)) score += 2; if(tags.includes(k)) score += 1; }
          return { m, score };
        });
        const matched = scored.filter(x=> x.score>0)
          .sort((a,b)=> b.score - a.score || new Date(b.m.createdAt||0).getTime() - new Date(a.m.createdAt||0).getTime())
          .slice(0,3)
          .map(x=> x.m.url)
          .filter(Boolean);
        if(matched.length){ topMediaImages = matched; hasIntentMatchedImages = true; }
        else { topMediaImages = items.slice(0,3).map(x=> x.url).filter(Boolean); hasIntentMatchedImages = false; }
      } catch {}

      const aiResponse = await this.generateAiResponse(
        fp,
        senderPsid,
        lastUserMessage,
        config,
        topMediaImages,
        params.hasPhoneNumber,
      );
      if (!aiResponse) {
        if (this.isDebugMode) this.logger.debug('AI response generation failed');
        return;
      }

  // Chỉ gửi ảnh khi có khớp theo intent (alt/tags) để phù hợp ngữ cảnh
  const attachImages: string[] | undefined = hasIntentMatchedImages && topMediaImages.length ? topMediaImages : undefined;

  const success = await this.sendFacebookMessage(fp, senderPsid, aiResponse, config.model, attachImages);
      if (success && params.savedInboundId) {
        try {
          await (this.chatService as any).update(params.savedInboundId, { awaitingHuman: false });
        } catch (error) {
          this.logger.warn('Failed to update inbound message', (error as any).message);
        }
      }

      if (this.isDebugMode) {
        this.logger.debug('AI response sent successfully', { senderPsid, responseSnippet: aiResponse.slice(0, 60) });
      }
    } catch (error) {
      this.logger.error('Auto AI reply error', (error as any).stack);
    }
  }

  private async generateAiResponse(
    fanpage: any,
    senderPsid: string,
    lastUserMessage: string,
    config: any,
    mediaImages: string[] = [],
    hasPhoneNumber: boolean = false,
  ): Promise<string | null> {
    try {
      const convData = await this.chatService.getConversation(fanpage._id.toString(), senderPsid);
      const recentMessages = convData.messages.slice(0, 10).reverse();

      const customerIntent = this.analyzeCustomerIntent(lastUserMessage, recentMessages);

      // Tập trung vào mô tả fanpage và ảnh media
      let systemPrompt = `Bạn là trợ lý bán hàng AI của fanpage "${fanpage.name}". `;
      if (fanpage.description) systemPrompt += `Thông tin mô tả/lĩnh vực & sản phẩm: ${fanpage.description.slice(0, 1200)}. `;
      if (Array.isArray(mediaImages) && mediaImages.length) {
        systemPrompt += `\n\nẢNH THAM CHIẾU LIÊN QUAN: ${mediaImages.slice(0,3).join(', ')}\n`;
      }

      // Không còn block gợi ý sản phẩm theo catalog

      systemPrompt += `\nCHIẾN LƯỢC BÁN HÀNG:\n`;
      if (customerIntent.isHighIntent) {
        systemPrompt += `- Khách có ý định cao: tập trung chốt đơn và xin số điện thoại ngay.\n`;
        systemPrompt += `- Tạo cảm giác cấp bách hợp lý (hàng bán chạy, nên đặt sớm).\n`;
      } else if (customerIntent.isPriceInquiry) {
        systemPrompt += `- Khách hỏi giá: báo giá rõ ràng, kèm ưu đãi (nếu có), rồi xin số điện thoại để tư vấn chi tiết.\n`;
      } else if (customerIntent.isHesitant) {
        systemPrompt += `- Khách do dự: đưa bằng chứng tin cậy (đánh giá, bảo hành, cam kết), và xin số điện thoại để giải đáp nhanh.\n`;
      } else {
        systemPrompt += `- Luôn hướng đến xin số điện thoại để tư vấn phù hợp và chốt đơn.\n`;
      }

      systemPrompt += `\n**CÁC CHIẾN THUẬT CHUNG:**\n`;
      systemPrompt += `1. **TẠO CẢM GIÁC KHAN HIẾM**: "Hàng này đang hot, số lượng có hạn"\n`;
      systemPrompt += `2. **ƯU ĐÃI GIỚI HẠN**: "Hôm nay có chương trình đặc biệt"\n`;
      systemPrompt += `3. **CHỐT ĐON NHANH**: "Bạn đặt luôn không? Giao ngay hôm nay"\n`;
      systemPrompt += `4. **XỬ LÝ PHẢN ĐỐI**: Do dự → hỏi lý do → giải quyết\n`;
      systemPrompt += `5. **TẠO LÒNG TIN**: Chia sẻ review khách, cam kết chất lượng\n\n`;

      if (hasPhoneNumber) {
        systemPrompt += `\n🎉 **KHÁCH ĐÃ CUNG CẤP SỐ ĐIỆN THOẠI!**\n`;
        systemPrompt += `- Cảm ơn khách và xác nhận sẽ gọi lại sớm\n`;
        systemPrompt += `- Hỏi thời gian thuận tiện để gọi\n`;
        systemPrompt += `- Tạo cảm giác an tâm: "Shop sẽ gọi tư vấn kỹ và báo giá tốt nhất"\n`;
        systemPrompt += `- Khuyến khích đặt trước: "Bạn có muốn đặt trước để được ưu đãi không?"\n`;
        systemPrompt += `- Tập trung CHỐT ĐƠN ngay lập tức\n\n`;
      }

      systemPrompt += `**QUY TẮC PHẢN HỒI:**\n`;
      if (hasPhoneNumber) {
        systemPrompt += `- ƯU TIÊN CHỐT ĐƠN! Khách đã tin tưởng đưa số điện thoại\n`;
        systemPrompt += `- Tạo cảm giác cấp bách: "Để đảm bảo có hàng, bạn đặt trước nhé"\n`;
        systemPrompt += `- Hỏi thời gian gọi lại: "Khoảng mấy giờ shop gọi cho bạn?"\n`;
      } else {
        systemPrompt += `- Luôn hướng đến mục tiêu XIN SỐ ĐIỆN THOẠI và CHỐT ĐƠN\n`;
        systemPrompt += `- Nếu khách hỏi giá, báo giá rồi ngay lập tức xin số điện thoại\n`;
      }
  systemPrompt += `- Trả lời ngắn gọn (1-3 câu), rõ ràng, bám sát mô tả fanpage.\n`;
      systemPrompt += `- Tuyệt đối không dùng emoji/icon/ký tự trang trí. Chỉ văn bản thuần.\n`;
      systemPrompt += `- Không bịa thông tin không có, nhưng tạo cảm giác sản phẩm hấp dẫn\n`;
      systemPrompt += `- Nếu cần hỗ trợ phức tạp: "Để tư vấn chi tiết, cho shop số điện thoại nhé!"\n\n`;

      systemPrompt += `**GỢI Ý CÂU TRẢ LỜI:**\n`;
      if (customerIntent.isHighIntent) {
        systemPrompt += `- "Bạn quyết định luôn nhé. Để đảm bảo có hàng, bạn cho shop xin số điện thoại để đặt trước."\n`;
      } else if (customerIntent.isPriceInquiry) {
        systemPrompt += `- "Giá hiện tại là ... Nếu bạn cho shop số điện thoại, shop sẽ tư vấn chi tiết và giữ ưu đãi cho bạn."\n`;
      } else {
        systemPrompt += `- "Để shop tư vấn phù hợp nhất, bạn cho số điện thoại được không?"\n`;
        systemPrompt += `- "Shop sẽ gọi báo giá chi tiết, bạn để lại số điện thoại giúp shop nhé."\n`;
      }
      systemPrompt += `\nLƯU Ý: Luôn kết thúc bằng call-to-action rõ ràng (xin SĐT hoặc chốt đơn)!`;

      const promptMessages = [
        { role: 'system', content: systemPrompt },
        ...recentMessages.map((m: any) => ({ role: m.direction === 'in' ? 'user' : 'assistant', content: m.content })),
        { role: 'user', content: lastUserMessage },
      ];

      const model = config.model || 'gpt-4o-mini';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model, messages: promptMessages, temperature: config.temperature ?? 0.7, max_tokens: Math.min(160, config.maxTokens || 200) }),
      });
  const responseData: any = await response.json();
  if (!response.ok) throw new Error(responseData.error?.message || 'OpenAI API error');

  let aiText = (responseData.choices?.[0]?.message?.content || '').trim();
  
  // Log the raw AI response for debugging
  if (this.isDebugMode) {
    this.logger.debug('Raw AI response:', aiText);
  }
  
  // Remove emojis/icons to keep professional tone but preserve Vietnamese text
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu;
  aiText = aiText.replace(emojiRegex, '').replace(/\s{2,}/g, ' ').trim();
  
  // Check if response is empty or just dots
  if (!aiText || /^[.\s]*$/.test(aiText) || aiText.length < 3) {
    if (this.isDebugMode) {
      this.logger.warn('AI response empty or invalid, using fallback. Original:', responseData.choices?.[0]?.message?.content);
    }
    const fallback = fanpage.description ? `Shop đang hỗ trợ lĩnh vực: ${fanpage.description.slice(0,180)}. Bạn cần tư vấn sản phẩm/dịch vụ nào? Cho shop xin số điện thoại để gọi tư vấn nhanh nhé.`
      : 'Shop đang sẵn sàng hỗ trợ. Bạn cần tư vấn sản phẩm/dịch vụ nào? Cho shop xin số điện thoại để gọi tư vấn nhanh nhé.';
    aiText = fallback;
  }
  
  if (this.isDebugMode) {
    this.logger.debug('Final AI response:', aiText);
  }
  return aiText || null;
    } catch (error) {
      if (this.isDebugMode) this.logger.error('AI response generation failed', (error as any).message);
      return null;
    }
  }

  private async sendFacebookMessage(
    fanpage: any,
    senderPsid: string,
    message: string,
    aiModel: string,
    images?: string[],
  ): Promise<boolean> {
    try {
      // Only remove specific problematic Unicode ranges, preserve Vietnamese text
      const sanitized = (message || '')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu, '') // Only emojis
        .replace(/\s{2,}/g, ' ')
        .trim();

      // AI auto-reply can be controlled independently from manual operator sends.
      // Default is enabled; set AI_FB_SENDING_ENABLED=0 to disable only AI auto-send.
      const FB_ENABLED = process.env.AI_FB_SENDING_ENABLED !== '0';
      const PUBLIC_ORIGIN = process.env.MEDIA_ABSOLUTE_BASE || process.env.PUBLIC_ORIGIN || process.env.APP_PUBLIC_ORIGIN || '';
      
      if (this.isDebugMode) {
        this.logger.debug(`[FB Send] FB_ENABLED=${FB_ENABLED}, AI_FB_SENDING_ENABLED=${process.env.AI_FB_SENDING_ENABLED}, FB_SENDING_ENABLED=${process.env.FB_SENDING_ENABLED}, PUBLIC_ORIGIN=${PUBLIC_ORIGIN}, fanpage.accessToken=${!!fanpage?.accessToken}`);
      }
      
      // Determine 24h window eligibility based on last inbound message
      let within24h = false;
      try {
        const convData = await this.chatService.getConversation(String(fanpage._id || fanpage.id || ''), senderPsid).catch(() => null as any);
        const latestInbound = convData?.messages?.find((m: any) => m?.direction === 'in');
        const lastInboundAtMs = latestInbound ? new Date((latestInbound as any).createdAt || (latestInbound as any).receivedAt || Date.now()).getTime() : 0;
        within24h = lastInboundAtMs > 0 ? (Date.now() - lastInboundAtMs) < (24 * 60 * 60 * 1000) : false;
        
        if (this.isDebugMode) {
          this.logger.debug(`[FB Send] 24h check: lastInboundAtMs=${lastInboundAtMs}, within24h=${within24h}, hoursAgo=${lastInboundAtMs > 0 ? ((Date.now() - lastInboundAtMs) / (1000 * 60 * 60)).toFixed(2) : 'N/A'}`);
        }
      } catch (e) {
        within24h = false;
        if (this.isDebugMode) {
          this.logger.error('[FB Send] Error checking 24h window:', e.message);
        }
      }
      const ensureAbsolute = (url: string) => {
        if(!url) return url;
        if(/^https?:\/\//i.test(url)) return url;
        if(!PUBLIC_ORIGIN) return url; // cannot make absolute; will skip FB image send
        return (PUBLIC_ORIGIN.replace(/\/$/, '') + url).replace(/\s/g,'');
      };

      let responseData: any = { ok: false, message: 'skip' };
      let deliveryNote: string | null = null; // track reason if not delivered to Graph
      if (FB_ENABLED && fanpage?.accessToken) {
        try {
          if (!within24h) {
            // Outside 24h window -> don't attempt a RESPONSE send (will be rejected by Graph)
            // Record reason for diagnostics
            responseData = { ok: false, message: 'blocked_outside_24h', note: 'Skipping Graph send for AI auto-reply (outside 24h window).' };
            deliveryNote = 'Bị chặn do quá 24h kể từ tin nhắn cuối của khách (Messenger 24h window).';
            if (this.isDebugMode) this.logger.warn(`[AI Send] Blocked: outside 24h window. fanpageId=${fanpage._id} senderPsid=${senderPsid}`);
          } else {
            // Send text message first
            if (this.isDebugMode) {
              this.logger.debug(`[FB Send] Sending text message: "${sanitized.slice(0, 100)}..."`);
            }
            
            const payload = {
              recipient: { id: senderPsid },
              messaging_type: 'RESPONSE',
              message: { text: sanitized }
            };
            
            const textRes = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(fanpage.accessToken)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            }).then(r=> r.json()).catch(e=> ({ ok:false, error: e?.message||String(e) }));
            
            if (this.isDebugMode) {
              this.logger.debug(`[FB Send] Graph API response:`, JSON.stringify(textRes, null, 2));
            }
            
            responseData = { text: textRes };
            
            // Check if the send was successful
            if (textRes.message_id) {
              if (this.isDebugMode) {
                this.logger.log(`[FB Send] SUCCESS: Message sent with ID ${textRes.message_id}`);
              }
              deliveryNote = null;
            } else if (textRes.error) {
              this.logger.error(`[FB Send] FAILED: ${JSON.stringify(textRes.error)}`);
              const err = textRes.error || {};
              deliveryNote = `Gửi FB thất bại: code ${err.code || '?'} subcode ${err.error_subcode || '?'} - ${err.message || 'Không rõ lỗi'}`;
            }
          }

          // Send images if provided and we can build absolute URLs (only if within 24h)
          if (within24h && Array.isArray(images) && images.length && PUBLIC_ORIGIN) {
            const imgPayloads = images.map(u => ensureAbsolute(u)).filter(u=> /^https?:\/\//i.test(u));
            for (const imgUrl of imgPayloads) {
              const imgRes = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(fanpage.accessToken)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  recipient: { id: senderPsid },
                  messaging_type: 'RESPONSE',
                  message: {
                    attachment: { type: 'image', payload: { is_reusable: true, url: imgUrl } }
                  }
                }),
              }).then(r=> r.json()).catch(e=> ({ ok:false, error: e?.message||String(e) }));
              // Record image message internally as well
              const savedImage = await this.chatService.create({
                fanpageId: fanpage._id.toString(),
                senderPsid,
                content: imgUrl,
                messageType: 'image',
                direction: 'out',
                isAI: true,
                aiModelUsed: aiModel,
                raw: { fb: imgRes },
                receivedAt: new Date() as any,
                awaitingHuman: false,
              } as any);
              try {
                this.chatEvents.emit({
                  type: 'new-message',
                  fanpageId: String(fanpage._id),
                  senderPsid,
                  direction: 'out',
                  snippet: '[image]',
                  createdAt: (savedImage as any)?.createdAt || new Date(),
                });
              } catch {}
            }
          }
        } catch (err) {
          if (this.isDebugMode) this.logger.error('Graph send failed', (err as any).message);
          deliveryNote = `Lỗi gửi tới Facebook: ${(err as any)?.message || String(err)}`;
        }
      } else {
        if (!FB_ENABLED) {
          deliveryNote = 'AI_FB_SENDING_ENABLED=0 (đang tắt AI gửi ra Facebook).';
          this.logger.warn(`[AI Send] Disabled by env on pid=${process.pid}: AI_FB_SENDING_ENABLED=${process.env.AI_FB_SENDING_ENABLED ?? '<unset>'}, FB_SENDING_ENABLED=${process.env.FB_SENDING_ENABLED ?? '<unset>'}`);
        }
        else if (!fanpage?.accessToken) deliveryNote = 'Thiếu Access Token của fanpage.';
      }

      // Always record the text reply internally
      const savedAiText = await this.chatService.create({
        fanpageId: fanpage._id.toString(),
        senderPsid,
        content: sanitized,
        direction: 'out',
        isAI: true,
        aiModelUsed: aiModel,
        raw: responseData,
        receivedAt: new Date() as any,
        awaitingHuman: false,
      } as any);
      try {
        this.chatEvents.emit({
          type: 'new-message',
          fanpageId: String(fanpage._id),
          senderPsid,
          direction: 'out',
          snippet: String(sanitized || '').slice(0, 120),
          createdAt: (savedAiText as any)?.createdAt || new Date(),
        });
      } catch {}

      // If not delivered to Facebook, append a small system diagnostic message for operators
      if (deliveryNote) {
        try {
          const savedSystem = await this.chatService.create({
            fanpageId: fanpage._id.toString(),
            senderPsid,
            content: `[KHÔNG GỬI RA FB] ${deliveryNote}`,
            direction: 'system',
            isAI: false,
            raw: { note: deliveryNote },
            receivedAt: new Date() as any,
            awaitingHuman: false,
          } as any);
          this.chatEvents.emit({
            type: 'new-message',
            fanpageId: String(fanpage._id),
            senderPsid,
            direction: 'system',
            snippet: `[KHÔNG GỬI RA FB] ${deliveryNote}`.slice(0, 120),
            createdAt: (savedSystem as any)?.createdAt || new Date(),
          });
        } catch (e) {
          if (this.isDebugMode) this.logger.warn('Failed to record non-delivery note: ' + (e as any)?.message);
        }
      }
      return true;
    } catch (error) {
      if (this.isDebugMode) this.logger.error('Facebook message send failed', (error as any).message);
      return false;
    }
  }

  private analyzeCustomerIntent(message: string, recentMessages: any[]): any {
    const msgLower = message.toLowerCase();
    const allMessages = recentMessages.map((m: any) => m.content.toLowerCase()).join(' ');
    return {
      isHighIntent: /(\b(mua|đặt|order|cần|muốn|tìm|quan tâm)\b)/.test(msgLower),
      isPriceInquiry: /(\b(giá|bao nhiêu|chi phí|tiền|cost|price)\b)/.test(msgLower),
      isUrgent: /(\b(gấp|nhanh|ngay|hôm nay|urgent|asap)\b)/.test(msgLower),
      isComparing: /(\b(so sánh|khác|compare|khác gì|tương tự)\b)/.test(msgLower),
      isHesitant: /(\b(nghĩ|xem|cân nhắc|chưa chắc|maybe|perhaps)\b)/.test(msgLower),
      isPriceObjection: /(\b(đắt|rẻ|expensive|cheap|giảm giá|discount)\b)/.test(msgLower),
      isTrustConcern: /(\b(tin|uy tín|chất lượng|fake|hàng thật|trust)\b)/.test(msgLower),
      needsDetails: /(\b(thông tin|detail|mô tả|tính năng|spec|specification)\b)/.test(msgLower),
      needsProof: /(\b(review|đánh giá|feedback|chứng minh|proof)\b)/.test(msgLower),
      conversationLength: recentMessages.length,
      hasAskedPrice: allMessages.includes('giá') || allMessages.includes('price'),
      hasShownInterest: allMessages.includes('thích') || allMessages.includes('quan tâm'),
      isReturnCustomer: recentMessages.length > 5,
    };
  }
}
