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
import { ApiTokenService } from '../api-token/api-token.service';

import fetch from 'node-fetch';
import { createHash } from 'crypto';
import { getMetaGraphApiVersion } from '../common/ads-api-version';
import { buildAiAssistantQualityDirectives } from '../common/ai-assistant-quality';

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
    is_echo?: boolean;
    app_id?: number;
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
  private readonly warnedRuntimeKeys = new Set<string>();
  private readonly notedConversationKeys = new Set<string>();

  constructor(
    private readonly chatService: ChatMessageService,
    @InjectModel(Fanpage.name) private fanpageModel: Model<FanpageDocument>,
    private readonly openaiConfig: OpenAIConfigService,
    private readonly visionAIService: VisionAIService,
    private readonly productService: ProductService,
    private readonly mediaService: MediaService,
    private readonly chatEvents: ChatEventsService,
    private readonly apiTokenService: ApiTokenService,
  ) {}

  private warnOnce(key: string, message: string): void {
    if (this.warnedRuntimeKeys.size > 10000) this.warnedRuntimeKeys.clear();
    if (this.warnedRuntimeKeys.has(key)) return;
    this.warnedRuntimeKeys.add(key);
    this.logger.warn(message);
  }

  private async appendSystemNoteOnce(params: {
    fanpageId: string;
    senderPsid: string;
    reasonKey: string;
    note: string;
  }): Promise<void> {
    if (this.notedConversationKeys.size > 50000) this.notedConversationKeys.clear();
    const dedupeKey = `${params.fanpageId}:${params.senderPsid}:${params.reasonKey}`;
    if (this.notedConversationKeys.has(dedupeKey)) return;
    this.notedConversationKeys.add(dedupeKey);
    try {
      const saved = await this.chatService.create({
        fanpageId: params.fanpageId,
        senderPsid: params.senderPsid,
        content: `[AI SKIP] ${params.note}`,
        direction: 'system',
        isAI: false,
        raw: { note: params.note, reason: params.reasonKey },
        receivedAt: new Date() as any,
        awaitingHuman: false,
      } as any);
      this.chatEvents.emit({
        type: 'new-message',
        fanpageId: String(params.fanpageId),
        senderPsid: params.senderPsid,
        direction: 'system',
        snippet: `[AI SKIP] ${params.note}`.slice(0, 120),
        createdAt: (saved as any)?.createdAt || new Date(),
      });
    } catch (e) {
      if (this.isDebugMode) {
        this.logger.warn('Failed to append AI skip diagnostic note: ' + (e as any)?.message);
      }
    }
  }

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

    const adId =
      (messagingEvent as any)?.ad_id ||
      messagingEvent.referral?.ad_id ||
      messagingEvent.message?.referral?.ad_id ||
      messagingEvent.postback?.referral?.ad_id ||
      undefined;

    if (messagingEvent.message) {
      await this.handleTextMessage(
        messagingEvent.message,
        fanpage,
        pageId,
        senderPsid,
        recipientId,
        timestamp,
        adId,
        messagingEvent.referral,
      );
      return;
    }

    if (messagingEvent.postback) {
      await this.handlePostback(
        messagingEvent.postback,
        fanpage,
        pageId,
        senderPsid,
        timestamp,
        adId,
        messagingEvent.referral,
      );
      return;
    }

    if (messagingEvent.referral) {
      await this.handleReferralEvent(messagingEvent.referral, fanpage, pageId, senderPsid, timestamp);
    }
  }
  private async handleTextMessage(
    message: any,
    fanpage: any,
    pageId: string,
    senderPsid: string,
    recipientId: string,
    timestamp: Date,
    adId?: string,
    eventReferral?: ReferralData,
  ): Promise<void> {
    const isInbound = senderPsid !== pageId;
    const conversationPsid = isInbound ? senderPsid : (recipientId || message?.to?.id || senderPsid);
    const content = message.text || (message.attachments ? '[Attachment]' : '[Empty]');

    let adGroupId: string | undefined;

    if (message.referral?.ref) {
      const ref = message.referral.ref;
      const adGroupMatch = ref.match(/(?:ad_|adset_|adgroup_)(\d+)/i);
      if (adGroupMatch) adGroupId = adGroupMatch[1];
    }

    if (!adGroupId && eventReferral?.ref) {
      const adGroupMatch = eventReferral.ref.match(/(?:ad_|adset_|adgroup_)(\d+)/i);
      if (adGroupMatch) adGroupId = adGroupMatch[1];
    }

    if (!adGroupId && message.quick_reply?.payload) {
      const payload = message.quick_reply.payload;
      const adGroupMatch = payload.match(/adgroup[_:](\d+)/i);
      if (adGroupMatch) adGroupId = adGroupMatch[1];
    }

    if (!adGroupId && adId) {
      try {
        const resolvedAdset = await this.resolveAdSetIdFromAdId(adId, fanpage);
        if (resolvedAdset) adGroupId = resolvedAdset;
      } catch (e) {
        if (this.isDebugMode) this.logger.warn(`Failed to resolve adset from ad_id=${adId}: ${(e as any)?.message}`);
      }
    }

    const attachmentFingerprint = Array.isArray(message?.attachments)
      ? message.attachments.map((item: any) => ({
          type: item?.type,
          url: item?.payload?.url,
          title: item?.title,
        }))
      : [];
    const platformMessageId = String(message?.mid || '').trim() || undefined;
    const platformEventKey = platformMessageId
      ? undefined
      : this.hashEventKey(
          'facebook',
          isInbound ? 'message:in' : 'message:echo',
          pageId,
          conversationPsid,
          timestamp,
          {
            text: message?.text || '',
            quickReply: message?.quick_reply?.payload || '',
            attachments: attachmentFingerprint,
            isEcho: Boolean(message?.is_echo),
          },
        );

    const { doc: savedMessage, created } = await this.chatService.createIfNotExists({
      fanpageId: fanpage?._id?.toString() || pageId,
      senderPsid: conversationPsid,
      content,
      direction: isInbound ? 'in' : 'out',
      raw: message,
      receivedAt: timestamp as any,
      awaitingHuman: isInbound,
      adGroupId: adGroupId || undefined,
      sourcePlatform: 'facebook',
      platformMessageId,
      platformEventKey,
      deliveryStatus: 'sent',
    } as any);

    if (!created) {
      if (this.isDebugMode) {
        this.logger.debug('Skipping duplicate Messenger message event', {
          pageId,
          conversationPsid,
          isInbound,
          platformMessageId,
          platformEventKey,
        });
      }
      return;
    }

    try {
      const fanId = String(fanpage?._id?.toString() || pageId);
      this.chatEvents.emit({
        type: 'new-message',
        fanpageId: fanId,
        senderPsid: conversationPsid,
        direction: isInbound ? 'in' : 'out',
        snippet: String(content || '').slice(0, 120),
        createdAt: timestamp,
      });
    } catch (e) {
      this.logger.warn('Failed to emit chat event: ' + (e as any)?.message);
    }

    if (this.isDebugMode) {
      this.logger.debug('Message processed', {
        pageId,
        isInbound,
        senderPsid: conversationPsid,
        contentSnippet: content.slice(0, 80),
      });
    }

    if (isInbound) {
      const normalizedContent = String(content || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\u0111/g, 'd');
      const productKeywords = ['san pham', 'hang', 'mua', 'ban', 'gia', 'anh', 'hinh', 'catalog', 'danh sach'];
      const hasProductIntent = productKeywords.some((keyword) => normalizedContent.includes(keyword));

      const phonePattern = /(?:0|\+84)[0-9]{8,10}|(?:[0-9]{10,11})/g;
      const hasPhoneNumber = phonePattern.test(content);

      if (hasPhoneNumber) {
        await this.chatService.create({
          fanpageId: fanpage?._id?.toString() || pageId,
          senderPsid: conversationPsid,
          content: '[LEAD_CAPTURED] Phone number detected - prioritize callback',
          direction: 'system',
          raw: { phoneNumber: content.match(phonePattern), capturedAt: new Date() },
          receivedAt: timestamp as any,
          awaitingHuman: true,
        } as any);
      }

      this.triggerAutoAiReply({
        fanpage,
        pageId,
        senderPsid: conversationPsid,
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
   *   2) ApiTokenService (system/user token in DB)
   *   3) encrypted page token from ApiToken (fallback; may lack ads_read and fail)
   */
  private async resolveAdSetIdFromAdId(adId: string, fanpage: any): Promise<string | undefined> {
    const token =
      process.env.FB_ADS_ACCESS_TOKEN ||
      (await this.apiTokenService.getRawAccessTokenForAdsManagement()) ||
      (fanpage?._id
        ? await this.apiTokenService.getRawAccessTokenForFanpage(String(fanpage._id), 'facebook')
        : undefined);
    if (!token) return undefined;
    const url = `https://graph.facebook.com/${getMetaGraphApiVersion()}/${encodeURIComponent(adId)}?fields=adset_id,adset{name},campaign_id&access_token=${encodeURIComponent(token)}`;
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

  private async resolveFanpageAccessToken(fanpage: any): Promise<string | undefined> {
    if (fanpage?._id) {
      const tokenFromApi = await this.apiTokenService.getRawAccessTokenForFanpage(
        String(fanpage._id),
        'facebook',
      );
      if (tokenFromApi) return tokenFromApi;
    }
    return undefined;
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

    let adGroupId: string | undefined;
    const referral = postback.referral || eventReferral;

    if (referral?.ref) {
      const adGroupMatch = referral.ref.match(/(?:ad_|adset_|adgroup_)(\d+)/i);
      if (adGroupMatch) adGroupId = adGroupMatch[1];
    }

    if (!adGroupId && adId) {
      try {
        const resolvedAdset = await this.resolveAdSetIdFromAdId(adId, fanpage);
        if (resolvedAdset) adGroupId = resolvedAdset;
      } catch (e) {
        if (this.isDebugMode) this.logger.warn(`[Postback] Failed to resolve adset from ad_id=${adId}: ${(e as any)?.message}`);
      }
    }

    if (this.isDebugMode && (adId || referral)) {
      this.logger.debug('[Postback] Ad context detected', {
        ad_id: adId,
        adGroupId,
        source: referral?.source,
        ads_context_data: referral?.ads_context_data,
      });
    }

    const platformEventKey = this.hashEventKey('facebook', 'postback', pageId, senderPsid, timestamp, {
      payload,
      adId: adId || '',
      referralRef: referral?.ref || '',
      referralAdId: referral?.ad_id || '',
      referralSource: referral?.source || '',
    });

    const { created } = await this.chatService.createIfNotExists({
      fanpageId: fanpage?._id?.toString() || pageId,
      senderPsid,
      content: '[POSTBACK] ' + payload,
      direction: 'in',
      raw: { ...postback, resolved_adGroupId: adGroupId, resolved_ad_id: adId },
      receivedAt: timestamp as any,
      awaitingHuman: true,
      adGroupId: adGroupId || undefined,
      sourcePlatform: 'facebook',
      platformEventKey,
      deliveryStatus: 'sent',
    } as any);

    if (!created) {
      if (this.isDebugMode) this.logger.debug('Skipping duplicate Messenger postback', { pageId, senderPsid, platformEventKey });
      return;
    }

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

    if (referral.ref) {
      const adGroupMatch = referral.ref.match(/(?:ad_|adset_|adgroup_)(\d+)/i);
      if (adGroupMatch) adGroupId = adGroupMatch[1];
    }

    if (!adGroupId && adId) {
      try {
        const resolvedAdset = await this.resolveAdSetIdFromAdId(adId, fanpage);
        if (resolvedAdset) adGroupId = resolvedAdset;
      } catch (e) {
        if (this.isDebugMode) this.logger.warn(`[Referral] Failed to resolve adset from ad_id=${adId}: ${(e as any)?.message}`);
      }
    }

    if (this.isDebugMode) {
      this.logger.debug('[Referral] User returned from ad', {
        ad_id: adId,
        adGroupId,
        source: referral.source,
        ref: referral.ref,
        ads_context_data: referral.ads_context_data,
      });
    }

    const platformEventKey = this.hashEventKey('facebook', 'referral', pageId, senderPsid, timestamp, {
      adId: adId || '',
      source: referral.source || '',
      ref: referral.ref || '',
      adTitle: referral.ads_context_data?.ad_title || '',
    });

    const { created } = await this.chatService.createIfNotExists({
      fanpageId: fanpage?._id?.toString() || pageId,
      senderPsid,
      content: `[REFERRAL] User returned from ${referral.source === 'ADS' ? 'Ad' : 'Link'}${referral.ads_context_data?.ad_title ? `: ${referral.ads_context_data.ad_title}` : ''}`,
      direction: 'system' as any,
      raw: { referral, resolved_adGroupId: adGroupId, resolved_ad_id: adId },
      receivedAt: timestamp as any,
      awaitingHuman: false,
      adGroupId: adGroupId || undefined,
      sourcePlatform: 'facebook',
      platformEventKey,
      deliveryStatus: 'sent',
    } as any);

    if (!created) {
      if (this.isDebugMode) this.logger.debug('Skipping duplicate Messenger referral', { pageId, senderPsid, platformEventKey });
      return;
    }

    if (adGroupId && fanpage?._id) {
      try {
        const Conversation = this.chatService['convModel'];
        await Conversation.updateOne(
          { fanpageId: fanpage._id, senderPsid },
          { $set: { lastAdGroupId: adGroupId } },
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
      if (!fp) {
        this.warnOnce(
          `missing-fanpage:${pageId}`,
          `[AI Skip] Fanpage not found for pageId=${pageId}.`,
        );
        return;
      }
      if (!fp.aiEnabled) {
        this.warnOnce(
          `ai-disabled:${fp._id}`,
          `[AI Skip] AI is disabled on fanpageId=${fp._id}. Set aiEnabled=true to auto reply.`,
        );
        await this.appendSystemNoteOnce({
          fanpageId: fp._id.toString(),
          senderPsid,
          reasonKey: 'ai-disabled',
          note: 'AI is disabled on this fanpage (aiEnabled=false).',
        });
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

  // KhÃƒÂ´ng cÃƒÂ²n sÃ¡Â»Â­ dÃ¡Â»Â¥ng Generic Script; tiÃ¡ÂºÂ¿p tÃ¡Â»Â¥c ngay cÃ¡ÂºÂ£ khi description trÃ¡Â»â€˜ng (sÃ¡ÂºÂ½ cÃƒÂ³ fallback)

      let config: any = null;
      if (fp.openAIConfigId) {
        try {
          config = await this.openaiConfig.findOne(fp.openAIConfigId.toString());
        } catch (error) {
          this.logger.warn('OpenAI config not found for fanpage', fp.openAIConfigId);
        }
      }
      if (config?.purpose !== 'customer-chatbot') config = null;
      if (!config) {
        config = await this.openaiConfig.pickConfig({ purpose: 'customer-chatbot', fanpageId: fp._id.toString() });
      }
      if (!config) {
        this.warnOnce(
          `missing-openai-config:${fp._id}`,
          `[AI Skip] No OpenAI config found for fanpageId=${fp._id}.`,
        );
        await this.appendSystemNoteOnce({
          fanpageId: fp._id.toString(),
          senderPsid,
          reasonKey: 'missing-openai-config',
          note: 'No OpenAI config is linked to this fanpage.',
        });
        return;
      }

      const apiKey = String(config.apiKey || '').trim();
      if (!apiKey) {
        this.warnOnce(
          `missing-openai-key:${fp._id}`,
          `[AI Skip] OpenAI apiKey is empty for fanpageId=${fp._id}.`,
        );
        await this.appendSystemNoteOnce({
          fanpageId: fp._id.toString(),
          senderPsid,
          reasonKey: 'missing-openai-key',
          note: 'OpenAI apiKey is empty. Update OpenAI config before using AI auto reply.',
        });
        return;
      }

      if (apiKey === 'placeholder-key') {
        this.warnOnce(
          `placeholder-openai-key:${fp._id}`,
          `[AI Skip] OpenAI apiKey is still placeholder-key for fanpageId=${fp._id}.`,
        );
        await this.appendSystemNoteOnce({
          fanpageId: fp._id.toString(),
          senderPsid,
          reasonKey: 'placeholder-openai-key',
          note: 'OpenAI apiKey is placeholder-key. Replace with a real key to enable AI replies.',
        });
        return;
      }
      if (this.isDebugMode) {
        this.logger.debug('OpenAI config loaded', { configName: config.name, model: config.model });
      }

      // BÃ¡Â»Å½ rule theo catalog Ã¢â‚¬â€œ dÃƒÂ¹ng mÃƒÂ´ tÃ¡ÂºÂ£ + Ã¡ÂºÂ£nh media. ChÃ¡Â»Ân Ã¡ÂºÂ£nh theo ALT/TAG khÃ¡Â»â€ºp ÃƒÂ½ Ã„â€˜Ã¡Â»â€¹nh khÃƒÂ¡ch.
      const sanitize = (t: string) => (t || '')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu, '') // Only emojis
        .replace(/\s{2,}/g, ' ')
        .trim();

      const stripDiacritics = (s: string) => s? s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/Ã„â€˜/g,'d').replace(/Ã„Â/g,'D') : '';
      const keywordSource = [lastUserMessage, ...((convData?.messages||[]).slice(0,5).map((m:any)=> m.content||''))].join(' ');
      const keywords = Array.from(new Set(keywordSource
        .split(/[^\p{L}\p{N}]+/u)
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

  // ChÃ¡Â»â€° gÃ¡Â»Â­i Ã¡ÂºÂ£nh khi cÃƒÂ³ khÃ¡Â»â€ºp theo intent (alt/tags) Ã„â€˜Ã¡Â»Æ’ phÃƒÂ¹ hÃ¡Â»Â£p ngÃ¡Â»Â¯ cÃ¡ÂºÂ£nh
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

      // TÃ¡ÂºÂ­p trung vÃƒÂ o mÃƒÂ´ tÃ¡ÂºÂ£ fanpage vÃƒÂ  Ã¡ÂºÂ£nh media
      let systemPrompt = `BÃ¡ÂºÂ¡n lÃƒÂ  trÃ¡Â»Â£ lÃƒÂ½ bÃƒÂ¡n hÃƒÂ ng AI cÃ¡Â»Â§a fanpage "${fanpage.name}". `;
      if (fanpage.description) systemPrompt += `ThÃƒÂ´ng tin mÃƒÂ´ tÃ¡ÂºÂ£/lÃ„Â©nh vÃ¡Â»Â±c & sÃ¡ÂºÂ£n phÃ¡ÂºÂ©m: ${fanpage.description.slice(0, 1200)}. `;
      if (Array.isArray(mediaImages) && mediaImages.length) {
        systemPrompt += `\n\nÃ¡ÂºÂ¢NH THAM CHIÃ¡ÂºÂ¾U LIÃƒÅ N QUAN: ${mediaImages.slice(0,3).join(', ')}\n`;
      }

      // KhÃƒÂ´ng cÃƒÂ²n block gÃ¡Â»Â£i ÃƒÂ½ sÃ¡ÂºÂ£n phÃ¡ÂºÂ©m theo catalog

      systemPrompt += `\nCHIÃ¡ÂºÂ¾N LÃ†Â¯Ã¡Â»Â¢C BÃƒÂN HÃƒâ‚¬NG:\n`;
      if (customerIntent.isHighIntent) {
        systemPrompt += `- KhÃƒÂ¡ch cÃƒÂ³ ÃƒÂ½ Ã„â€˜Ã¡Â»â€¹nh cao: tÃ¡ÂºÂ­p trung chÃ¡Â»â€˜t Ã„â€˜Ã†Â¡n vÃƒÂ  xin sÃ¡Â»â€˜ Ã„â€˜iÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i ngay.\n`;
        systemPrompt += `- TÃ¡ÂºÂ¡o cÃ¡ÂºÂ£m giÃƒÂ¡c cÃ¡ÂºÂ¥p bÃƒÂ¡ch hÃ¡Â»Â£p lÃƒÂ½ (hÃƒÂ ng bÃƒÂ¡n chÃ¡ÂºÂ¡y, nÃƒÂªn Ã„â€˜Ã¡ÂºÂ·t sÃ¡Â»â€ºm).\n`;
      } else if (customerIntent.isPriceInquiry) {
        systemPrompt += `- KhÃƒÂ¡ch hÃ¡Â»Âi giÃƒÂ¡: bÃƒÂ¡o giÃƒÂ¡ rÃƒÂµ rÃƒÂ ng, kÃƒÂ¨m Ã†Â°u Ã„â€˜ÃƒÂ£i (nÃ¡ÂºÂ¿u cÃƒÂ³), rÃ¡Â»â€œi xin sÃ¡Â»â€˜ Ã„â€˜iÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i Ã„â€˜Ã¡Â»Æ’ tÃ†Â° vÃ¡ÂºÂ¥n chi tiÃ¡ÂºÂ¿t.\n`;
      } else if (customerIntent.isHesitant) {
        systemPrompt += `- KhÃƒÂ¡ch do dÃ¡Â»Â±: Ã„â€˜Ã†Â°a bÃ¡ÂºÂ±ng chÃ¡Â»Â©ng tin cÃ¡ÂºÂ­y (Ã„â€˜ÃƒÂ¡nh giÃƒÂ¡, bÃ¡ÂºÂ£o hÃƒÂ nh, cam kÃ¡ÂºÂ¿t), vÃƒÂ  xin sÃ¡Â»â€˜ Ã„â€˜iÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i Ã„â€˜Ã¡Â»Æ’ giÃ¡ÂºÂ£i Ã„â€˜ÃƒÂ¡p nhanh.\n`;
      } else {
        systemPrompt += `- LuÃƒÂ´n hÃ†Â°Ã¡Â»â€ºng Ã„â€˜Ã¡ÂºÂ¿n xin sÃ¡Â»â€˜ Ã„â€˜iÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i Ã„â€˜Ã¡Â»Æ’ tÃ†Â° vÃ¡ÂºÂ¥n phÃƒÂ¹ hÃ¡Â»Â£p vÃƒÂ  chÃ¡Â»â€˜t Ã„â€˜Ã†Â¡n.\n`;
      }

      systemPrompt += `\n**CÃƒÂC CHIÃ¡ÂºÂ¾N THUÃ¡ÂºÂ¬T CHUNG:**\n`;
      systemPrompt += `1. **TÃ¡ÂºÂ O CÃ¡ÂºÂ¢M GIÃƒÂC KHAN HIÃ¡ÂºÂ¾M**: "HÃƒÂ ng nÃƒÂ y Ã„â€˜ang hot, sÃ¡Â»â€˜ lÃ†Â°Ã¡Â»Â£ng cÃƒÂ³ hÃ¡ÂºÂ¡n"\n`;
      systemPrompt += `2. **Ã†Â¯U Ã„ÂÃƒÆ’I GIÃ¡Â»Å¡I HÃ¡ÂºÂ N**: "HÃƒÂ´m nay cÃƒÂ³ chÃ†Â°Ã†Â¡ng trÃƒÂ¬nh Ã„â€˜Ã¡ÂºÂ·c biÃ¡Â»â€¡t"\n`;
      systemPrompt += `3. **CHÃ¡Â»ÂT Ã„ÂON NHANH**: "BÃ¡ÂºÂ¡n Ã„â€˜Ã¡ÂºÂ·t luÃƒÂ´n khÃƒÂ´ng? Giao ngay hÃƒÂ´m nay"\n`;
      systemPrompt += `4. **XÃ¡Â»Â¬ LÃƒÂ PHÃ¡ÂºÂ¢N Ã„ÂÃ¡Â»ÂI**: Do dÃ¡Â»Â± Ã¢â€ â€™ hÃ¡Â»Âi lÃƒÂ½ do Ã¢â€ â€™ giÃ¡ÂºÂ£i quyÃ¡ÂºÂ¿t\n`;
      systemPrompt += `5. **TÃ¡ÂºÂ O LÃƒâ€™NG TIN**: Chia sÃ¡ÂºÂ» review khÃƒÂ¡ch, cam kÃ¡ÂºÂ¿t chÃ¡ÂºÂ¥t lÃ†Â°Ã¡Â»Â£ng\n\n`;

      if (hasPhoneNumber) {
        systemPrompt += `\nÃ°Å¸Å½â€° **KHÃƒÂCH Ã„ÂÃƒÆ’ CUNG CÃ¡ÂºÂ¤P SÃ¡Â»Â Ã„ÂIÃ¡Â»â€ N THOÃ¡ÂºÂ I!**\n`;
        systemPrompt += `- CÃ¡ÂºÂ£m Ã†Â¡n khÃƒÂ¡ch vÃƒÂ  xÃƒÂ¡c nhÃ¡ÂºÂ­n sÃ¡ÂºÂ½ gÃ¡Â»Âi lÃ¡ÂºÂ¡i sÃ¡Â»â€ºm\n`;
        systemPrompt += `- HÃ¡Â»Âi thÃ¡Â»Âi gian thuÃ¡ÂºÂ­n tiÃ¡Â»â€¡n Ã„â€˜Ã¡Â»Æ’ gÃ¡Â»Âi\n`;
        systemPrompt += `- TÃ¡ÂºÂ¡o cÃ¡ÂºÂ£m giÃƒÂ¡c an tÃƒÂ¢m: "Shop sÃ¡ÂºÂ½ gÃ¡Â»Âi tÃ†Â° vÃ¡ÂºÂ¥n kÃ¡Â»Â¹ vÃƒÂ  bÃƒÂ¡o giÃƒÂ¡ tÃ¡Â»â€˜t nhÃ¡ÂºÂ¥t"\n`;
        systemPrompt += `- KhuyÃ¡ÂºÂ¿n khÃƒÂ­ch Ã„â€˜Ã¡ÂºÂ·t trÃ†Â°Ã¡Â»â€ºc: "BÃ¡ÂºÂ¡n cÃƒÂ³ muÃ¡Â»â€˜n Ã„â€˜Ã¡ÂºÂ·t trÃ†Â°Ã¡Â»â€ºc Ã„â€˜Ã¡Â»Æ’ Ã„â€˜Ã†Â°Ã¡Â»Â£c Ã†Â°u Ã„â€˜ÃƒÂ£i khÃƒÂ´ng?"\n`;
        systemPrompt += `- TÃ¡ÂºÂ­p trung CHÃ¡Â»ÂT Ã„ÂÃ†Â N ngay lÃ¡ÂºÂ­p tÃ¡Â»Â©c\n\n`;
      }

      systemPrompt += `**QUY TÃ¡ÂºÂ®C PHÃ¡ÂºÂ¢N HÃ¡Â»â€™I:**\n`;
      if (hasPhoneNumber) {
        systemPrompt += `- Ã†Â¯U TIÃƒÅ N CHÃ¡Â»ÂT Ã„ÂÃ†Â N! KhÃƒÂ¡ch Ã„â€˜ÃƒÂ£ tin tÃ†Â°Ã¡Â»Å¸ng Ã„â€˜Ã†Â°a sÃ¡Â»â€˜ Ã„â€˜iÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i\n`;
        systemPrompt += `- TÃ¡ÂºÂ¡o cÃ¡ÂºÂ£m giÃƒÂ¡c cÃ¡ÂºÂ¥p bÃƒÂ¡ch: "Ã„ÂÃ¡Â»Æ’ Ã„â€˜Ã¡ÂºÂ£m bÃ¡ÂºÂ£o cÃƒÂ³ hÃƒÂ ng, bÃ¡ÂºÂ¡n Ã„â€˜Ã¡ÂºÂ·t trÃ†Â°Ã¡Â»â€ºc nhÃƒÂ©"\n`;
        systemPrompt += `- HÃ¡Â»Âi thÃ¡Â»Âi gian gÃ¡Â»Âi lÃ¡ÂºÂ¡i: "KhoÃ¡ÂºÂ£ng mÃ¡ÂºÂ¥y giÃ¡Â»Â shop gÃ¡Â»Âi cho bÃ¡ÂºÂ¡n?"\n`;
      } else {
        systemPrompt += `- LuÃƒÂ´n hÃ†Â°Ã¡Â»â€ºng Ã„â€˜Ã¡ÂºÂ¿n mÃ¡Â»Â¥c tiÃƒÂªu XIN SÃ¡Â»Â Ã„ÂIÃ¡Â»â€ N THOÃ¡ÂºÂ I vÃƒÂ  CHÃ¡Â»ÂT Ã„ÂÃ†Â N\n`;
        systemPrompt += `- NÃ¡ÂºÂ¿u khÃƒÂ¡ch hÃ¡Â»Âi giÃƒÂ¡, bÃƒÂ¡o giÃƒÂ¡ rÃ¡Â»â€œi ngay lÃ¡ÂºÂ­p tÃ¡Â»Â©c xin sÃ¡Â»â€˜ Ã„â€˜iÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i\n`;
      }
  systemPrompt += `- TrÃ¡ÂºÂ£ lÃ¡Â»Âi ngÃ¡ÂºÂ¯n gÃ¡Â»Ân (1-3 cÃƒÂ¢u), rÃƒÂµ rÃƒÂ ng, bÃƒÂ¡m sÃƒÂ¡t mÃƒÂ´ tÃ¡ÂºÂ£ fanpage.\n`;
      systemPrompt += `- TuyÃ¡Â»â€¡t Ã„â€˜Ã¡Â»â€˜i khÃƒÂ´ng dÃƒÂ¹ng emoji/icon/kÃƒÂ½ tÃ¡Â»Â± trang trÃƒÂ­. ChÃ¡Â»â€° vÃ„Æ’n bÃ¡ÂºÂ£n thuÃ¡ÂºÂ§n.\n`;
      systemPrompt += `- KhÃƒÂ´ng bÃ¡Â»â€¹a thÃƒÂ´ng tin khÃƒÂ´ng cÃƒÂ³, nhÃ†Â°ng tÃ¡ÂºÂ¡o cÃ¡ÂºÂ£m giÃƒÂ¡c sÃ¡ÂºÂ£n phÃ¡ÂºÂ©m hÃ¡ÂºÂ¥p dÃ¡ÂºÂ«n\n`;
      systemPrompt += `- NÃ¡ÂºÂ¿u cÃ¡ÂºÂ§n hÃ¡Â»â€” trÃ¡Â»Â£ phÃ¡Â»Â©c tÃ¡ÂºÂ¡p: "Ã„ÂÃ¡Â»Æ’ tÃ†Â° vÃ¡ÂºÂ¥n chi tiÃ¡ÂºÂ¿t, cho shop sÃ¡Â»â€˜ Ã„â€˜iÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i nhÃƒÂ©!"\n\n`;

      systemPrompt += `**GÃ¡Â»Â¢I ÃƒÂ CÃƒâ€šU TRÃ¡ÂºÂ¢ LÃ¡Â»Å“I:**\n`;
      if (customerIntent.isHighIntent) {
        systemPrompt += `- "BÃ¡ÂºÂ¡n quyÃ¡ÂºÂ¿t Ã„â€˜Ã¡Â»â€¹nh luÃƒÂ´n nhÃƒÂ©. Ã„ÂÃ¡Â»Æ’ Ã„â€˜Ã¡ÂºÂ£m bÃ¡ÂºÂ£o cÃƒÂ³ hÃƒÂ ng, bÃ¡ÂºÂ¡n cho shop xin sÃ¡Â»â€˜ Ã„â€˜iÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i Ã„â€˜Ã¡Â»Æ’ Ã„â€˜Ã¡ÂºÂ·t trÃ†Â°Ã¡Â»â€ºc."\n`;
      } else if (customerIntent.isPriceInquiry) {
        systemPrompt += `- "GiÃƒÂ¡ hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i lÃƒÂ  ... NÃ¡ÂºÂ¿u bÃ¡ÂºÂ¡n cho shop sÃ¡Â»â€˜ Ã„â€˜iÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i, shop sÃ¡ÂºÂ½ tÃ†Â° vÃ¡ÂºÂ¥n chi tiÃ¡ÂºÂ¿t vÃƒÂ  giÃ¡Â»Â¯ Ã†Â°u Ã„â€˜ÃƒÂ£i cho bÃ¡ÂºÂ¡n."\n`;
      } else {
        systemPrompt += `- "Ã„ÂÃ¡Â»Æ’ shop tÃ†Â° vÃ¡ÂºÂ¥n phÃƒÂ¹ hÃ¡Â»Â£p nhÃ¡ÂºÂ¥t, bÃ¡ÂºÂ¡n cho sÃ¡Â»â€˜ Ã„â€˜iÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i Ã„â€˜Ã†Â°Ã¡Â»Â£c khÃƒÂ´ng?"\n`;
        systemPrompt += `- "Shop sÃ¡ÂºÂ½ gÃ¡Â»Âi bÃƒÂ¡o giÃƒÂ¡ chi tiÃ¡ÂºÂ¿t, bÃ¡ÂºÂ¡n Ã„â€˜Ã¡Â»Æ’ lÃ¡ÂºÂ¡i sÃ¡Â»â€˜ Ã„â€˜iÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i giÃƒÂºp shop nhÃƒÂ©."\n`;
      }
      systemPrompt += `\nLÃ†Â¯U ÃƒÂ: LuÃƒÂ´n kÃ¡ÂºÂ¿t thÃƒÂºc bÃ¡ÂºÂ±ng call-to-action rÃƒÂµ rÃƒÂ ng (xin SÃ„ÂT hoÃ¡ÂºÂ·c chÃ¡Â»â€˜t Ã„â€˜Ã†Â¡n)!`;

      systemPrompt += `\n\n${buildAiAssistantQualityDirectives('chatbot')}\n`;

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
    const fallback = fanpage.description ? `Shop Ã„â€˜ang hÃ¡Â»â€” trÃ¡Â»Â£ lÃ„Â©nh vÃ¡Â»Â±c: ${fanpage.description.slice(0,180)}. BÃ¡ÂºÂ¡n cÃ¡ÂºÂ§n tÃ†Â° vÃ¡ÂºÂ¥n sÃ¡ÂºÂ£n phÃ¡ÂºÂ©m/dÃ¡Â»â€¹ch vÃ¡Â»Â¥ nÃƒÂ o? Cho shop xin sÃ¡Â»â€˜ Ã„â€˜iÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i Ã„â€˜Ã¡Â»Æ’ gÃ¡Â»Âi tÃ†Â° vÃ¡ÂºÂ¥n nhanh nhÃƒÂ©.`
      : 'Shop Ã„â€˜ang sÃ¡ÂºÂµn sÃƒÂ ng hÃ¡Â»â€” trÃ¡Â»Â£. BÃ¡ÂºÂ¡n cÃ¡ÂºÂ§n tÃ†Â° vÃ¡ÂºÂ¥n sÃ¡ÂºÂ£n phÃ¡ÂºÂ©m/dÃ¡Â»â€¹ch vÃ¡Â»Â¥ nÃƒÂ o? Cho shop xin sÃ¡Â»â€˜ Ã„â€˜iÃ¡Â»â€¡n thoÃ¡ÂºÂ¡i Ã„â€˜Ã¡Â»Æ’ gÃ¡Â»Âi tÃ†Â° vÃ¡ÂºÂ¥n nhanh nhÃƒÂ©.';
    aiText = fallback;
  }

  aiText = this.enforceSalesResponseSafety(aiText, lastUserMessage);
  
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
      const sanitized = (message || '')
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      const FB_ENABLED = process.env.AI_FB_SENDING_ENABLED !== '0';
      const PUBLIC_ORIGIN = process.env.MEDIA_ABSOLUTE_BASE || process.env.PUBLIC_ORIGIN || process.env.APP_PUBLIC_ORIGIN || '';
      const pageAccessToken = await this.resolveFanpageAccessToken(fanpage);

      if (this.isDebugMode) {
        this.logger.debug(
          `[FB Send] FB_ENABLED=${FB_ENABLED}, AI_FB_SENDING_ENABLED=${process.env.AI_FB_SENDING_ENABLED}, FB_SENDING_ENABLED=${process.env.FB_SENDING_ENABLED}, PUBLIC_ORIGIN=${PUBLIC_ORIGIN}, pageTokenAvailable=${!!pageAccessToken}`,
        );
      }

      let within24h = false;
      try {
        const convData = await this.chatService
          .getConversation(String(fanpage._id || fanpage.id || ''), senderPsid)
          .catch(() => null as any);
        const latestInbound = convData?.messages?.find((m: any) => m?.direction === 'in');
        const lastInboundAtMs = latestInbound
          ? new Date((latestInbound as any).createdAt || (latestInbound as any).receivedAt || Date.now()).getTime()
          : 0;
        within24h = lastInboundAtMs > 0 ? Date.now() - lastInboundAtMs < 24 * 60 * 60 * 1000 : false;

        if (this.isDebugMode) {
          this.logger.debug(
            `[FB Send] 24h check: lastInboundAtMs=${lastInboundAtMs}, within24h=${within24h}, hoursAgo=${lastInboundAtMs > 0 ? ((Date.now() - lastInboundAtMs) / (1000 * 60 * 60)).toFixed(2) : 'N/A'}`,
          );
        }
      } catch (e) {
        within24h = false;
        if (this.isDebugMode) {
          this.logger.error('[FB Send] Error checking 24h window:', (e as any)?.message);
        }
      }

      const ensureAbsolute = (url: string) => {
        if (!url) return url;
        if (/^https?:\/\//i.test(url)) return url;
        if (!PUBLIC_ORIGIN) return url;
        return (PUBLIC_ORIGIN.replace(/\/$/, '') + url).replace(/\s/g, '');
      };

      let responseData: any = { ok: false, message: 'skip' };
      let deliveryNote: string | null = null;
      let textDelivered = false;

      if (FB_ENABLED && pageAccessToken) {
        try {
          if (!within24h) {
            responseData = {
              ok: false,
              message: 'blocked_outside_24h',
              note: 'Skipping Graph send for AI auto-reply (outside 24h window).',
            };
            deliveryNote = 'Blocked outside the Messenger 24h response window.';
            if (this.isDebugMode) {
              this.logger.warn(`[AI Send] Blocked: outside 24h window. fanpageId=${fanpage._id} senderPsid=${senderPsid}`);
            }
          } else {
            const payload = {
              recipient: { id: senderPsid },
              messaging_type: 'RESPONSE',
              message: { text: sanitized },
            };

            const textRes = await fetch(
              `https://graph.facebook.com/${getMetaGraphApiVersion()}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              },
            )
              .then((r) => r.json())
              .catch((e) => ({ ok: false, error: e?.message || String(e) }));

            if (this.isDebugMode) {
              this.logger.debug('[FB Send] Graph API response:', JSON.stringify(textRes, null, 2));
            }

            responseData = { text: textRes };
            const textMessageId = this.extractGraphMessageId(textRes);
            if (textMessageId) {
              textDelivered = true;
            } else if (textRes.error) {
              const err = textRes.error || {};
              this.logger.error(`[FB Send] FAILED: ${JSON.stringify(err)}`);
              if (Number(err.code) === 190) {
                deliveryNote = 'Facebook Page Access Token is invalid or expired (code 190). Please refresh token for this fanpage.';
              } else {
                deliveryNote = `Failed to send to Facebook: code ${err.code || '?'} subcode ${err.error_subcode || '?'} - ${err.message || 'Unknown error'}`;
              }
            } else {
              deliveryNote = 'Failed to send to Facebook: missing message_id in Graph response.';
            }
          }

          if (textDelivered && Array.isArray(images) && images.length && PUBLIC_ORIGIN) {
            const imgPayloads = images.map((url) => ensureAbsolute(url)).filter((url) => /^https?:\/\//i.test(url));
            for (const imgUrl of imgPayloads) {
              const imgRes = await fetch(
                `https://graph.facebook.com/${getMetaGraphApiVersion()}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    recipient: { id: senderPsid },
                    messaging_type: 'RESPONSE',
                    message: {
                      attachment: { type: 'image', payload: { is_reusable: true, url: imgUrl } },
                    },
                  }),
                },
              )
                .then((r) => r.json())
                .catch((e) => ({ ok: false, error: e?.message || String(e) }));

              const imageMessageId = this.extractGraphMessageId(imgRes);
              const { doc: savedImage, created } = await this.chatService.createIfNotExists({
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
                sourcePlatform: 'facebook',
                platformMessageId: imageMessageId,
                deliveryStatus: imageMessageId ? 'sent' : 'failed',
              } as any);
              if (created) {
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
              if (!imageMessageId && this.isDebugMode) {
                this.logger.warn(`[FB Send] Image send did not return message_id for ${imgUrl}`);
              }
            }
          }
        } catch (err) {
          if (this.isDebugMode) this.logger.error('Graph send failed', (err as any)?.message);
          deliveryNote = `Facebook send error: ${(err as any)?.message || String(err)}`;
        }
      } else {
        if (!FB_ENABLED) {
          deliveryNote = 'AI_FB_SENDING_ENABLED=0 (AI auto-send disabled).';
          this.logger.warn(
            `[AI Send] Disabled by env on pid=${process.pid}: AI_FB_SENDING_ENABLED=${process.env.AI_FB_SENDING_ENABLED ?? '<unset>'}, FB_SENDING_ENABLED=${process.env.FB_SENDING_ENABLED ?? '<unset>'}`,
          );
        } else if (!pageAccessToken) {
          deliveryNote = 'Missing page access token for this fanpage.';
        }
      }

      const outboundMessageId = this.extractGraphMessageId(responseData?.text ?? responseData);
      const { doc: savedAiText, created: createdAiText } = await this.chatService.createIfNotExists({
        fanpageId: fanpage._id.toString(),
        senderPsid,
        content: sanitized,
        direction: 'out',
        isAI: true,
        aiModelUsed: aiModel,
        raw: responseData,
        receivedAt: new Date() as any,
        awaitingHuman: false,
        sourcePlatform: 'facebook',
        platformMessageId: outboundMessageId,
        deliveryStatus: textDelivered ? 'sent' : deliveryNote ? 'failed' : 'skipped',
      } as any);
      if (createdAiText) {
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
      }

      if (deliveryNote) {
        try {
          const savedSystem = await this.chatService.create({
            fanpageId: fanpage._id.toString(),
            senderPsid,
            content: `[KHONG GUI RA FB] ${deliveryNote}`,
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
            snippet: `[KHONG GUI RA FB] ${deliveryNote}`.slice(0, 120),
            createdAt: (savedSystem as any)?.createdAt || new Date(),
          });
        } catch (e) {
          if (this.isDebugMode) this.logger.warn('Failed to record non-delivery note: ' + (e as any)?.message);
        }
      }

      return textDelivered;
    } catch (error) {
      if (this.isDebugMode) this.logger.error('Facebook message send failed', (error as any)?.message);
      return false;
    }
  }

  private extractGraphMessageId(raw: any): string | undefined {
    const candidates = [raw?.message_id, raw?.text?.message_id, raw?.fb?.message_id];
    for (const value of candidates) {
      const id = String(value || '').trim();
      if (id) return id;
    }
    return undefined;
  }

  private hashEventKey(
    sourcePlatform: string,
    eventType: string,
    pageId: string,
    senderPsid: string,
    timestamp: Date,
    payload: Record<string, any>,
  ): string {
    const normalizedPayload = JSON.stringify(payload || {});
    const basis = [sourcePlatform, eventType, pageId, senderPsid, timestamp.getTime(), normalizedPayload].join('|');
    return createHash('sha1').update(basis).digest('hex');
  }

  private normalizeForSafety(text: string): string {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private enforceSalesResponseSafety(aiText: string, lastUserMessage: string): string {
    const normalized = this.normalizeForSafety(aiText);
    const userText = this.normalizeForSafety(lastUserMessage);
    const unsafePrice = /\b(gia|bao gia|vnd|vnđ|dong|k)\b|(\d[\d.,]{2,}\s?(vnd|vnđ|dong|d|k))/i.test(normalized);
    const unsafeStock = /\b(con hang|het hang|co san|khan hiem|so luong co han|hang hot|dat som|giu hang)\b/i.test(normalized);
    const unsafePromo = /\b(khuyen mai|uu dai|giam gia|hom nay|giao ngay|giao trong ngay|mien phi)\b/i.test(normalized);

    if (!unsafePrice && !unsafeStock && !unsafePromo) return aiText;

    if (/\b(gia|bao nhieu|price|cost)\b/i.test(userText)) {
      return 'Shop se kiem tra gia hien tai va tinh trang hang truoc khi bao chinh xac. Anh/chi cho shop xin so dien thoai hoac san pham/mau can xem de tu van nhanh.';
    }

    if (/\b(con hang|het hang|giao|nhan hang|khuyen mai|uu dai|giam gia)\b/i.test(userText)) {
      return 'Shop se kiem tra ton kho, thoi gian giao va chuong trinh hien tai truoc khi xac nhan. Anh/chi cho shop xin so dien thoai hoac mau san pham can xem de tu van nhanh.';
    }

    return 'Shop da nhan thong tin. De tu van dung san pham, gia va tinh trang hang hien tai, anh/chi cho shop xin so dien thoai hoac mau san pham can xem.';
  }

  private analyzeCustomerIntent(message: string, recentMessages: any[]): any {
    const msgLower = message.toLowerCase();
    const allMessages = recentMessages.map((m: any) => m.content.toLowerCase()).join(' ');
    return {
      isHighIntent: /(\b(mua|Ã„â€˜Ã¡ÂºÂ·t|order|cÃ¡ÂºÂ§n|muÃ¡Â»â€˜n|tÃƒÂ¬m|quan tÃƒÂ¢m)\b)/.test(msgLower),
      isPriceInquiry: /(\b(giÃƒÂ¡|bao nhiÃƒÂªu|chi phÃƒÂ­|tiÃ¡Â»Ân|cost|price)\b)/.test(msgLower),
      isUrgent: /(\b(gÃ¡ÂºÂ¥p|nhanh|ngay|hÃƒÂ´m nay|urgent|asap)\b)/.test(msgLower),
      isComparing: /(\b(so sÃƒÂ¡nh|khÃƒÂ¡c|compare|khÃƒÂ¡c gÃƒÂ¬|tÃ†Â°Ã†Â¡ng tÃ¡Â»Â±)\b)/.test(msgLower),
      isHesitant: /(\b(nghÃ„Â©|xem|cÃƒÂ¢n nhÃ¡ÂºÂ¯c|chÃ†Â°a chÃ¡ÂºÂ¯c|maybe|perhaps)\b)/.test(msgLower),
      isPriceObjection: /(\b(Ã„â€˜Ã¡ÂºÂ¯t|rÃ¡ÂºÂ»|expensive|cheap|giÃ¡ÂºÂ£m giÃƒÂ¡|discount)\b)/.test(msgLower),
      isTrustConcern: /(\b(tin|uy tÃƒÂ­n|chÃ¡ÂºÂ¥t lÃ†Â°Ã¡Â»Â£ng|fake|hÃƒÂ ng thÃ¡ÂºÂ­t|trust)\b)/.test(msgLower),
      needsDetails: /(\b(thÃƒÂ´ng tin|detail|mÃƒÂ´ tÃ¡ÂºÂ£|tÃƒÂ­nh nÃ„Æ’ng|spec|specification)\b)/.test(msgLower),
      needsProof: /(\b(review|Ã„â€˜ÃƒÂ¡nh giÃƒÂ¡|feedback|chÃ¡Â»Â©ng minh|proof)\b)/.test(msgLower),
      conversationLength: recentMessages.length,
      hasAskedPrice: allMessages.includes('giÃƒÂ¡') || allMessages.includes('price'),
      hasShownInterest: allMessages.includes('thÃƒÂ­ch') || allMessages.includes('quan tÃƒÂ¢m'),
      isReturnCustomer: recentMessages.length > 5,
    };
  }
}
