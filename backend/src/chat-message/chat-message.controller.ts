import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, BadRequestException, UploadedFile, UseInterceptors, Sse, MessageEvent } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatMessageService } from './chat-message.service';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { UpdateChatMessageDto } from './dto/update-chat-message.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { InjectModel } from '@nestjs/mongoose';
import { Fanpage, FanpageDocument } from '../fanpage/schemas/fanpage.schema';
import { ProductService } from '../product/product.service';
import { MediaService } from '../media/media.service';
import { OpenAIConfigService } from '../openai-config/openai-config.service';
import { ApiTokenService } from '../api-token/api-token.service';

import { Model } from 'mongoose';
import { map } from 'rxjs/operators';
import { ChatEventsService } from './chat-events.service';
import { FeatureModule } from '../plan/feature-module.decorator';
import { getMetaGraphApiVersion } from '../common/ads-api-version';
import { buildAiAssistantQualityDirectives } from '../common/ai-assistant-quality';

@FeatureModule('chat-message')
@Controller('chat-messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatMessageController {
  constructor(
    private service: ChatMessageService,
    @InjectModel(Fanpage.name) private fanpageModel: Model<FanpageDocument>,
    private productService: ProductService,
    private openAIService: OpenAIConfigService,
    private mediaService: MediaService,
    private chatEvents: ChatEventsService,
    private apiTokenService: ApiTokenService,
  ) {}

  // Ensure media URL is absolute by prefixing configured public origin if needed
  private ensureAbsolute(url: string) {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    const origin = process.env.MEDIA_ABSOLUTE_BASE || process.env.PUBLIC_ORIGIN || process.env.APP_PUBLIC_ORIGIN || '';
    if (!origin) return url;
    return (origin.replace(/\/$/, '') + url).replace(/\s/g, '');
  }

  private normalizeForSafety(text: string): string {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private enforceSalesResponseSafety(aiText: string, lastUserMessage: string, evidence: { hasPrice?: boolean; hasStock?: boolean; hasPromotion?: boolean } = {}): string {
    const normalized = this.normalizeForSafety(aiText);
    const userText = this.normalizeForSafety(lastUserMessage);
    const mentionsPrice = /\b(gia|bao gia|vnd|vnđ|dong|k)\b|(\d[\d.,]{2,}\s?(vnd|vnđ|dong|d|k))/i.test(normalized);
    const mentionsStock = /\b(con hang|het hang|co san|khan hiem|so luong co han|hang hot|dat som|giu hang)\b/i.test(normalized);
    const mentionsPromo = /\b(khuyen mai|uu dai|giam gia|hom nay|giao ngay|giao trong ngay|mien phi)\b/i.test(normalized);

    if ((!mentionsPrice || evidence.hasPrice) && (!mentionsStock || evidence.hasStock) && (!mentionsPromo || evidence.hasPromotion)) {
      return aiText;
    }

    if (/\b(gia|bao nhieu|price|cost)\b/i.test(userText)) {
      return 'Shop se kiem tra gia hien tai va tinh trang hang truoc khi bao chinh xac. Anh/chi cho shop xin so dien thoai hoac san pham/mau can xem de tu van nhanh.';
    }
    if (/\b(con hang|het hang|giao|nhan hang|khuyen mai|uu dai|giam gia)\b/i.test(userText)) {
      return 'Shop se kiem tra ton kho, thoi gian giao va chuong trinh hien tai truoc khi xac nhan. Anh/chi cho shop xin so dien thoai hoac mau san pham can xem de tu van nhanh.';
    }
    return 'Shop da nhan thong tin. De tu van dung san pham, gia va tinh trang hang hien tai, anh/chi cho shop xin so dien thoai hoac mau san pham can xem.';
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

  private guessMimeType(filename: string): string {
    const name = String(filename || '').toLowerCase();
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.gif')) return 'image/gif';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.bmp')) return 'image/bmp';
    if (name.endsWith('.heic')) return 'image/heic';
    if (name.endsWith('.heif')) return 'image/heif';
    return 'image/jpeg';
  }

  private async isWithin24hWindow(fanpageId: string, senderPsid: string): Promise<boolean> {
    const convData = await this.service.getConversation(fanpageId, senderPsid).catch(()=> null as any);
    const latestInbound = convData?.messages?.find((m: any) => m?.direction === 'in');
    const lastInboundAtMs = latestInbound
      ? new Date((latestInbound as any).createdAt || (latestInbound as any).receivedAt || Date.now()).getTime()
      : 0;
    return lastInboundAtMs > 0 ? (Date.now() - lastInboundAtMs) < (24 * 60 * 60 * 1000) : false;
  }

  private async ensureWithin24hWindowOrThrow(fanpageId: string, senderPsid: string): Promise<void> {
    const within24h = await this.isWithin24hWindow(fanpageId, senderPsid);
    if (!within24h) {
      console.warn('[Messenger] Blocked image send outside 24h. fanpageId=%s senderPsid=%s', fanpageId, senderPsid);
      throw new BadRequestException('HÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚ÂºÃƒâ€šÃ‚Â¿t cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â­a sÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ 24h cÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â§a Messenger. KhÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â´ng thÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€ Ã¢â‚¬â„¢ gÃƒÆ’Ã‚Â¡Ãƒâ€šÃ‚Â»Ãƒâ€šÃ‚Â­i áº£nh khi Ä‘Ã£ ngoÃ i cÆ°a sá»• 24h.');
    }
  }

  private async sendFacebookImageByUrl(accessToken: string, senderPsid: string, imageUrl: string): Promise<any> {
    const url = `https://graph.facebook.com/${getMetaGraphApiVersion()}/me/messages?access_token=${encodeURIComponent(accessToken)}`;
    const payload = {
      recipient: { id: senderPsid },
      messaging_type: 'RESPONSE',
      message: { attachment: { type: 'image', payload: { is_reusable: true, url: imageUrl } } }
    };
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r=> r.json()).catch(e=> ({ ok:false, error: e?.message||String(e) }));
  }

  private async sendFacebookImageByBuffer(
    accessToken: string,
    senderPsid: string,
    imageBuffer: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<any> {
    const boundary = '----fbFormBoundary' + Math.random().toString(16).slice(2);
    const pushField = (name: string, value: string) => Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      'utf8'
    );
    const fileHeader = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="filedata"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
      'utf8'
    );
    const fileFooter = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');

    const body = Buffer.concat([
      pushField('recipient', JSON.stringify({ id: senderPsid })),
      pushField('messaging_type', 'RESPONSE'),
      pushField('message', JSON.stringify({ attachment: { type: 'image', payload: { is_reusable: true } } })),
      fileHeader,
      imageBuffer,
      fileFooter,
    ]);

    const url = `https://graph.facebook.com/${getMetaGraphApiVersion()}/me/messages?access_token=${encodeURIComponent(accessToken)}`;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: body as any
    }).then(r=> r.json()).catch(e=> ({ ok:false, error: e?.message||String(e) }));
  }

  private readLocalMediaFromUrl(imageUrl: string): { buffer: Buffer; mimeType: string; filename: string } | null {
    if (!imageUrl) return null;
    const fs = require('fs');
    const path = require('path');
    let pathname = imageUrl;
    if (/^https?:\/\//i.test(imageUrl)) {
      try { pathname = new URL(imageUrl).pathname; } catch { return null; }
    }
    const cleanPath = String(pathname).split('?')[0].split('#')[0];
    if (!cleanPath.startsWith('/media/')) return null;
    const relRaw = decodeURIComponent(cleanPath.replace(/^\/media\/+/, ''));
    const relNorm = path.normalize(relRaw).replace(/^([/\\])+/, '');
    if (!relNorm || relNorm.startsWith('..')) return null;

    const candidates = [
      process.env.MEDIA_DIR,
      path.join(process.cwd(), 'uploads', 'media'),
      path.join(process.cwd(), '..', 'media'),
      path.join(process.cwd(), '..', 'uploads', 'media'),
    ].filter(Boolean);

    for (const base of candidates) {
      try {
        const root = path.resolve(base);
        const abs = path.resolve(root, relNorm);
        if (!abs.startsWith(root)) continue;
        if (!fs.existsSync(abs)) continue;
        const stat = fs.statSync(abs);
        if (!stat.isFile()) continue;
        return {
          buffer: fs.readFileSync(abs),
          mimeType: this.guessMimeType(abs),
          filename: path.basename(abs),
        };
      } catch {}
    }
    return null;
  }

  private async sendFacebookImageSmart(opts: {
    accessToken: string;
    senderPsid: string;
    imageUrl?: string;
    fallbackBuffer?: Buffer;
    fallbackMimeType?: string;
    fallbackFilename?: string;
  }): Promise<any> {
    const absoluteUrl = this.ensureAbsolute(opts.imageUrl || '');
    let fromUrlRes: any = null;
    if (absoluteUrl && /^https?:\/\//i.test(absoluteUrl)) {
      fromUrlRes = await this.sendFacebookImageByUrl(opts.accessToken, opts.senderPsid, absoluteUrl);
      if (fromUrlRes?.message_id) return fromUrlRes;
    }

    if (opts.fallbackBuffer && opts.fallbackBuffer.length > 0) {
      return this.sendFacebookImageByBuffer(
        opts.accessToken,
        opts.senderPsid,
        opts.fallbackBuffer,
        opts.fallbackMimeType || 'image/jpeg',
        opts.fallbackFilename || 'upload.jpg',
      );
    }

    if (opts.imageUrl) {
      const local = this.readLocalMediaFromUrl(opts.imageUrl);
      if (local?.buffer?.length) {
        return this.sendFacebookImageByBuffer(
          opts.accessToken,
          opts.senderPsid,
          local.buffer,
          local.mimeType,
          local.filename,
        );
      }
    }

    if (fromUrlRes) return fromUrlRes;
    return { ok: false, message: 'image_url_not_absolute' };
  }

  // Individual message CRUD removed - use conversation-level operations instead

  // Conversation endpoints
  @Get('conversations/list/all') @RequirePermissions('chat-messages') conversations(@Query() q?: any) { return this.service.listConversations(q||{}); }
  @Get('conversations/:fanpageId/:senderPsid') @RequirePermissions('chat-messages') conversation(@Param('fanpageId') fanpageId: string, @Param('senderPsid') senderPsid: string) { return this.service.getConversation(fanpageId, senderPsid); }
  @Patch('conversations/:fanpageId/:senderPsid/resolve') @RequirePermissions('chat-messages') resolve(@Param('fanpageId') fanpageId: string, @Param('senderPsid') senderPsid: string) { return this.service.resolveConversation(fanpageId, senderPsid); }
  @Patch('conversations/:fanpageId/:senderPsid/auto-ai') @RequirePermissions('chat-messages') toggleAutoAi(@Param('fanpageId') fanpageId: string, @Param('senderPsid') senderPsid: string, @Body() body: { enabled: boolean }) { return this.service.toggleAutoAI(fanpageId, senderPsid, body.enabled); }
  @Get('conversations/:fanpageId/:senderPsid/extract-order') @RequirePermissions('chat-messages') extract(@Param('fanpageId') fanpageId: string, @Param('senderPsid') senderPsid: string){ return this.service.extractOrderDraft(fanpageId, senderPsid); }

  // --- Server-Sent Events: push notifications for new messages ---
  @Get('events')
  @Sse()
  @RequirePermissions('chat-messages')
  events(): any {
    return this.chatEvents.stream().pipe(map((e) => ({ data: e }) as MessageEvent));
  }



  // --- Outbound send (reply to user) ---
  @Post('send') @RequirePermissions('chat-messages')
  async sendMessage(
    @Body() body: { 
      fanpageId: string; 
      senderPsid: string; 
      text?: string; 
      content?: string;
      // Optional advanced controls
      messagingType?: 'RESPONSE' | 'MESSAGE_TAG';
      tag?: 'ACCOUNT_UPDATE' | 'CONFIRMED_EVENT_UPDATE' | 'POST_PURCHASE_UPDATE';
      allowTaggedFallback?: boolean; // if outside 24h and a valid tag provided, allow sending with MESSAGE_TAG
    }
  ) {
    console.log('ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ‚Â SendMessage request body:', JSON.stringify(body, null, 2));
    const messageText = body.text || body.content;
    if(!body.fanpageId || !body.senderPsid || !messageText) {
      console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ Validation failed:', { fanpageId: !!body.fanpageId, senderPsid: !!body.senderPsid, messageText: !!messageText });
      throw new BadRequestException('ThiÃƒÂ¡Ã‚ÂºÃ‚Â¿u fanpageId / senderPsid / text hoÃƒÂ¡Ã‚ÂºÃ‚Â·c content');
    }
    // fanpageId cÃƒÆ’Ã‚Â³ thÃƒÂ¡Ã‚Â»Ã†â€™ lÃƒÆ’Ã‚Â  _id hoÃƒÂ¡Ã‚ÂºÃ‚Â·c pageId Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã†â€™ tiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n dÃƒÂ¡Ã‚Â»Ã‚Â¥ng
    let fanpage = await this.fanpageModel.findById(body.fanpageId).lean();
    if(!fanpage) {
      fanpage = await this.fanpageModel.findOne({ pageId: body.fanpageId }).lean();
    }
    if(!fanpage) {
      console.log('ÃƒÂ¢Ã‚ÂÃ…â€™ Fanpage not found:', { fanpageId: body.fanpageId });
      throw new BadRequestException('Fanpage khÃƒÆ’Ã‚Â´ng tÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“n tÃƒÂ¡Ã‚ÂºÃ‚Â¡i (fanpageId cÃƒÆ’Ã‚Â³ thÃƒÂ¡Ã‚Â»Ã†â€™ lÃƒÆ’Ã‚Â  _id hoÃƒÂ¡Ã‚ÂºÃ‚Â·c pageId)');
    }
    console.log('ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Fanpage found:', { _id: fanpage._id, pageId: fanpage.pageId, name: fanpage.name });

    // Note: Social media integration disabled
    // Find latest inbound message time for this conversation
    const convData = await this.service.getConversation(fanpage._id.toString(), body.senderPsid).catch(() => null as any);
    const latestInbound = convData?.messages?.find((m: any) => m?.direction === 'in'); // messages sorted desc
    const lastInboundAtMs = latestInbound ? new Date((latestInbound as any).createdAt || (latestInbound as any).receivedAt || Date.now()).getTime() : 0;
    const within24h = lastInboundAtMs > 0 ? (Date.now() - lastInboundAtMs) < (24 * 60 * 60 * 1000) : false;

    const allowedTags = new Set(['ACCOUNT_UPDATE', 'CONFIRMED_EVENT_UPDATE', 'POST_PURCHASE_UPDATE']);
    let messagingType: 'RESPONSE' | 'MESSAGE_TAG' = body.messagingType || 'RESPONSE';
    let tag: any = body.tag;

    if (!within24h) {
      // If outside 24h and no valid tag is provided (or not allowed to fallback), block with friendly error
      const canTag = body.allowTaggedFallback && messagingType === 'MESSAGE_TAG' && tag && allowedTags.has(tag);
      if (!canTag) {
        console.warn('[Messenger] Blocked send: outside 24h, no valid MESSAGE_TAG. fanpageId=%s senderPsid=%s', fanpage._id, body.senderPsid);
        throw new BadRequestException('HÃƒÂ¡Ã‚ÂºÃ‚Â¿t cÃƒÂ¡Ã‚Â»Ã‚Â­a sÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢ 24h cÃƒÂ¡Ã‚Â»Ã‚Â§a Messenger. Vui lÃƒÆ’Ã‚Â²ng yÃƒÆ’Ã‚Âªu cÃƒÂ¡Ã‚ÂºÃ‚Â§u khÃƒÆ’Ã‚Â¡ch nhÃƒÂ¡Ã‚ÂºÃ‚Â¯n lÃƒÂ¡Ã‚ÂºÃ‚Â¡i mÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢t tin hoÃƒÂ¡Ã‚ÂºÃ‚Â·c gÃƒÂ¡Ã‚Â»Ã‚Â­i theo MESSAGE_TAG hÃƒÂ¡Ã‚Â»Ã‚Â£p lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡ (ACCOUNT_UPDATE/POST_PURCHASE_UPDATE/CONFIRMED_EVENT_UPDATE).');
      }
    }

    // When using MESSAGE_TAG ensure tag is valid
    if (messagingType === 'MESSAGE_TAG') {
      if (!tag || !allowedTags.has(tag)) {
        throw new BadRequestException('ThiÃƒÂ¡Ã‚ÂºÃ‚Â¿u hoÃƒÂ¡Ã‚ÂºÃ‚Â·c tag khÃƒÆ’Ã‚Â´ng hÃƒÂ¡Ã‚Â»Ã‚Â£p lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡. Tag hÃƒÂ¡Ã‚Â»Ã‚Â£p lÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡: ACCOUNT_UPDATE, POST_PURCHASE_UPDATE, CONFIRMED_EVENT_UPDATE');
      }
    } else {
      // For RESPONSE, ensure we are within 24h
      if (!within24h) {
        console.warn('[Messenger] Blocked RESPONSE send outside 24h. fanpageId=%s senderPsid=%s', fanpage._id, body.senderPsid);
        throw new BadRequestException('HÃƒÂ¡Ã‚ÂºÃ‚Â¿t cÃƒÂ¡Ã‚Â»Ã‚Â­a sÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¢ 24h cÃƒÂ¡Ã‚Â»Ã‚Â§a Messenger. KhÃƒÆ’Ã‚Â´ng thÃƒÂ¡Ã‚Â»Ã†â€™ gÃƒÂ¡Ã‚Â»Ã‚Â­i vÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi messaging_type=RESPONSE.');
      }
    }

    // Send to Facebook if enabled, otherwise only record internally
    let responseJson: any = { ok: false, message: 'fb_sending_disabled' };
    let deliveryNote: string | null = null;
    const FB_ENABLED = process.env.FB_SENDING_ENABLED !== '0';
    const pageAccessToken = await this.resolveFanpageAccessToken(fanpage);
    if (FB_ENABLED && pageAccessToken) {
      try {
        const payload: any = {
          recipient: { id: body.senderPsid },
          messaging_type: (messagingType === 'MESSAGE_TAG') ? 'MESSAGE_TAG' : 'RESPONSE',
          message: { text: messageText }
        };
        if (messagingType === 'MESSAGE_TAG' && tag) payload.tag = tag;
        const url = `https://graph.facebook.com/${getMetaGraphApiVersion()}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`;
        const fbRes = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(r => r.json()).catch(e => ({ ok: false, error: (e?.message || String(e)) }));
        responseJson = fbRes;
        if (!fbRes?.message_id) {
          const err = fbRes?.error || {};
          deliveryNote = `GÃƒÂ¡Ã‚Â»Ã‚Â­i FB thÃƒÂ¡Ã‚ÂºÃ‚Â¥t bÃƒÂ¡Ã‚ÂºÃ‚Â¡i: code ${err.code || '?'} subcode ${err.error_subcode || '?'} - ${err.message || 'KhÃƒÆ’Ã‚Â´ng rÃƒÆ’Ã‚Âµ lÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i'}`;
        }
      } catch (err: any) {
        responseJson = { ok: false, error: err?.message || String(err) };
        deliveryNote = `LÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i gÃƒÂ¡Ã‚Â»Ã‚Â­i tÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi Facebook: ${responseJson.error}`;
      }
    } else {
      if (!FB_ENABLED) deliveryNote = 'FB_SENDING_ENABLED=0 (Ãƒâ€žÃ¢â‚¬Ëœang tÃƒÂ¡Ã‚ÂºÃ‚Â¯t gÃƒÂ¡Ã‚Â»Ã‚Â­i ra Facebook).';
      else if (!pageAccessToken) deliveryNote = 'ThiÃƒÂ¡Ã‚ÂºÃ‚Â¿u Access Token cÃƒÂ¡Ã‚Â»Ã‚Â§a fanpage.';
    }
    const { doc: saved, created } = await this.service.recordOutboundMessage({ fanpageId: fanpage._id.toString(), senderPsid: body.senderPsid, text: messageText, rawResponse: responseJson });
    // If not delivered, record a system note so operators can see why
    if (deliveryNote) {
      try {
        await this.service.create({
          fanpageId: fanpage._id.toString(),
          senderPsid: body.senderPsid,
          content: `[KHÃƒÆ’Ã¢â‚¬ÂNG GÃƒÂ¡Ã‚Â»Ã‚Â¬I RA FB] ${deliveryNote}`,
          direction: 'system',
          awaitingHuman: false,
          receivedAt: new Date() as any,
          raw: { note: deliveryNote }
        } as any);
      } catch {}
    }
    // notify listeners
    if (created) {
      this.chatEvents.emit({ type: 'new-message', fanpageId: String(fanpage._id), senderPsid: body.senderPsid, direction: 'out', snippet: messageText.slice(0,120), createdAt: new Date() });
    }
    return { message: deliveryNote ? 'Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ ghi nhÃƒÂ¡Ã‚ÂºÃ‚Â­n nhÆ°ng chÆ°a gÃƒÂ¡Ã‚Â»Ã‚Â­i Ä‘Æ°á»£c ra Facebook' : 'Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ gÃƒÂ¡Ã‚Â»Ã‚Â­i', fb: responseJson, saved };
  }

  // --- AI generate & send (server -> FB) ---
  @Post('send/ai') @RequirePermissions('chat-messages')
  async sendAiMessage(
    @Body() body: { fanpageId: string; senderPsid: string; previewOnly?: boolean }
  ) {
    if(!body.fanpageId || !body.senderPsid) throw new BadRequestException('ThiÃƒÂ¡Ã‚ÂºÃ‚Â¿u fanpageId / senderPsid');
    // LÃƒÂ¡Ã‚ÂºÃ‚Â¥y messages Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã†â€™ build context
    const conv = await this.service.getConversation(body.fanpageId, body.senderPsid).catch(()=> null);
    const recent = conv?.messages.slice(0, 10).reverse() || []; // lÃƒÂ¡Ã‚ÂºÃ‚Â¥y tÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi Ãƒâ€žÃ¢â‚¬Ëœa 10 message gÃƒÂ¡Ã‚ÂºÃ‚Â§n nhÃƒÂ¡Ã‚ÂºÃ‚Â¥t (Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ sort desc)
  // Ãƒâ€ Ã‚Â¯u tiÃƒÆ’Ã‚Âªn config explicit
    let fanpage = await this.fanpageModel.findById(body.fanpageId).lean();
    if(!fanpage) fanpage = await this.fanpageModel.findOne({ pageId: body.fanpageId }).lean();
    let config = null;
    if (fanpage?.openAIConfigId) {
      try {
        config = await this.openAIService.findOne(fanpage.openAIConfigId.toString());
      } catch (error) {
        console.warn('Config not found for fanpage:', fanpage.openAIConfigId);
      }
    }
    if (config?.purpose !== 'customer-chatbot') config = null;
    if(!config) config = await this.openAIService.pickConfig({ purpose: 'customer-chatbot', fanpageId: body.fanpageId });
    if(!config) throw new BadRequestException('ChÃƒâ€ Ã‚Â°a cÃƒÆ’Ã‚Â³ cÃƒÂ¡Ã‚ÂºÃ‚Â¥u hÃƒÆ’Ã‚Â¬nh OpenAI khÃƒÂ¡Ã‚ÂºÃ‚Â£ dÃƒÂ¡Ã‚Â»Ã‚Â¥ng');
    if(config.status !== 'active' || !config.apiKey || config.apiKey === 'placeholder-key') throw new BadRequestException('Config OpenAI khong kha dung hoac thieu API key hop le');

    // Helper: strip emojis/icons from text
    const stripEmojis = (text: string) => {
      // Remove typical emoji ranges only; keep Vietnamese characters intact
      const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu;
      return (text || '').replace(emojiRegex, '').replace(/\s{2,}/g, ' ').trim();
    };

    const formatVnd = (n?: number) => {
      if (typeof n !== 'number' || isNaN(n)) return undefined as any;
      return n.toLocaleString('vi-VN');
    };

    // Try to detect product intent from the latest inbound message
    const lastInbound = conv?.messages?.find((m: any) => m.direction === 'in');
    let immediateHandled = false;
    if (lastInbound && typeof lastInbound.content === 'string' && lastInbound.content.trim().length > 0) {
      const raw = lastInbound.content.trim();
      // Build relaxed regex from content words (2+ chars)
      const keywords = raw.split(/[^A-Za-zÃƒÆ’Ã¢â€šÂ¬-ÃƒÂ¡Ã‚Â»Ã‚Â¹Ãƒâ€žÃ‚ÂÃƒâ€žÃ¢â‚¬Ëœ0-9]+/).filter(w => w && w.length >= 2).slice(0, 6);
      if (keywords.length) {
        // Use ProductService search (by first keyword), then refine by all keywords if possible
        const initial = await this.productService.findAll({ search: keywords[0] });
        // Ãƒâ€ Ã‚Â¯u tiÃƒÆ’Ã‚Âªn sÃƒÂ¡Ã‚ÂºÃ‚Â£n phÃƒÂ¡Ã‚ÂºÃ‚Â©m Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â£ Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Â£c gÃƒÆ’Ã‚Â¡n variation cho fanpage hiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n tÃƒÂ¡Ã‚ÂºÃ‚Â¡i
        const fanpageIdStr = fanpage?._id ? String(fanpage._id) : '';
        const products = (initial || [])
          .filter((p: any) => {
            const name = (p?.name || '').toLowerCase();
            return keywords.some(k => name.includes(k.toLowerCase()));
          })
          .sort((a: any, b: any) => {
            const aHasVar = (a?.fanpageVariations || []).some((v: any) => String(v.fanpageId) === fanpageIdStr && v.isActive !== false);
            const bHasVar = (b?.fanpageVariations || []).some((v: any) => String(v.fanpageId) === fanpageIdStr && v.isActive !== false);
            if (aHasVar === bHasVar) return 0;
            return aHasVar ? -1 : 1; // Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â°a sÃƒÂ¡Ã‚ÂºÃ‚Â£n phÃƒÂ¡Ã‚ÂºÃ‚Â©m cÃƒÆ’Ã‚Â³ variation cÃƒÂ¡Ã‚Â»Ã‚Â§a fanpage lÃƒÆ’Ã‚Âªn trÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºc
          })
          .slice(0, 3);
        if (products?.length) {
          const p = products[0];
          // Try fanpage-specific price first
          let price: number | undefined;
          const fpVar = (p.fanpageVariations || []).find((v: any) => String(v.fanpageId) === String(fanpage?._id) && v.isActive !== false);
          if (fpVar?.customPrice && typeof fpVar.customPrice === 'number') {
            price = fpVar.customPrice;
          }
          // Fallback: show cost hint only if price not set
          const priceText = price ? `${formatVnd(price)} VND` : 'Shop can xac nhan gia ban hien tai truoc khi bao chinh xac';
          const delivery = (p as any).estimatedDeliveryDays || 0;
          const deliveryText = delivery <= 0 ? 'giao trong ngÃƒÆ’Ã‚Â y (nÃƒÂ¡Ã‚ÂºÃ‚Â¿u cÃƒÆ’Ã‚Â²n hÃƒÆ’Ã‚Â ng)' : `dÃƒÂ¡Ã‚Â»Ã‚Â± kiÃƒÂ¡Ã‚ÂºÃ‚Â¿n nhÃƒÂ¡Ã‚ÂºÃ‚Â­n hÃƒÆ’Ã‚Â ng trong khoÃƒÂ¡Ã‚ÂºÃ‚Â£ng ${delivery} ngÃƒÆ’Ã‚Â y`;
          const notes = (p as any).notes ? `\n- Ghi chÃƒÆ’Ã‚Âº: ${(p as any).notes}` : '';
          const resource = (p as any).resourceLink ? `\n- Tham khÃƒÂ¡Ã‚ÂºÃ‚Â£o thÃƒÆ’Ã‚Âªm: ${(p as any).resourceLink}` : '';

          let reply = `Anh/chÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ Ãƒâ€žÃ¢â‚¬Ëœang quan tÃƒÆ’Ã‚Â¢m: ${p.name}.\n- GiÃƒÆ’Ã‚Â¡ hiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n tÃƒÂ¡Ã‚ÂºÃ‚Â¡i: ${priceText}.\n- ThÃƒÂ¡Ã‚Â»Ã‚Âi gian giao/nhÃƒÂ¡Ã‚ÂºÃ‚Â­n: ${deliveryText}.${notes}${resource}\n\nÃƒâ€žÃ‚ÂÃƒÂ¡Ã‚Â»Ã†â€™ tÃƒâ€ Ã‚Â° vÃƒÂ¡Ã‚ÂºÃ‚Â¥n vÃƒÆ’Ã‚Â  chÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœt giÃƒÆ’Ã‚Â¡ nhanh nhÃƒÂ¡Ã‚ÂºÃ‚Â¥t, anh/chÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ cho em xin sÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœ Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n thoÃƒÂ¡Ã‚ÂºÃ‚Â¡i liÃƒÆ’Ã‚Âªn hÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡ Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Â£c khÃƒÆ’Ã‚Â´ng ÃƒÂ¡Ã‚ÂºÃ‚Â¡?`;
          reply = stripEmojis(reply);
          reply = this.enforceSalesResponseSafety(reply, raw, { hasPrice: !!price });

          // GÃƒÂ¡Ã‚Â»Ã‚Â­i kÃƒÆ’Ã‚Â¨m nhiÃƒÂ¡Ã‚Â»Ã‚Âu ÃƒÂ¡Ã‚ÂºÃ‚Â£nh: lÃƒÂ¡Ã‚ÂºÃ‚Â¥y ÃƒÂ¡Ã‚ÂºÃ‚Â£nh chung cÃƒÂ¡Ã‚Â»Ã‚Â§a sÃƒÂ¡Ã‚ÂºÃ‚Â£n phÃƒÂ¡Ã‚ÂºÃ‚Â©m trÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºc, sau Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â³ Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚ÂºÃ‚Â¿n customImages cÃƒÂ¡Ã‚Â»Ã‚Â§a fanpage (khÃƒÆ’Ã‚Â´ng Ãƒâ€ Ã‚Â°u tiÃƒÆ’Ã‚Âªn variation nÃƒÂ¡Ã‚Â»Ã‚Â¯a)
          const pickImages = (): string[] => {
            const seen = new Set<string>();
            const out: string[] = [];
            const pushList = (arr?: string[]) => {
              for (const url of arr || []) {
                if (!url || seen.has(url)) continue;
                seen.add(url);
                out.push(url);
              }
            };
            // 1) ÃƒÂ¡Ã‚ÂºÃ‚Â¢nh chung cÃƒÂ¡Ã‚Â»Ã‚Â§a sÃƒÂ¡Ã‚ÂºÃ‚Â£n phÃƒÂ¡Ã‚ÂºÃ‚Â©m
            if ((p as any).images?.length) pushList((p as any).images.map((img: any) => img?.url || img).filter(Boolean));
            // 2) ÃƒÂ¡Ã‚ÂºÃ‚Â¢nh custom cÃƒÂ¡Ã‚Â»Ã‚Â§a fanpage (nÃƒÂ¡Ã‚ÂºÃ‚Â¿u cÃƒÆ’Ã‚Â³)
            if (fpVar?.customImages?.length) pushList(fpVar.customImages);
            return out;
          };
          const imageList = pickImages()
            .map(u => this.ensureAbsolute(u))
            .filter(u => /^https?:\/\//i.test(u))
            .slice(0, 5); // gÃƒÂ¡Ã‚Â»Ã‚Â­i tÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi Ãƒâ€žÃ¢â‚¬Ëœa 5 ÃƒÂ¡Ã‚ÂºÃ‚Â£nh Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã†â€™ trÃƒÆ’Ã‚Â¡nh spam
          for (const img of imageList) {
            try {
              await this.sendImageByUrl({ fanpageId: body.fanpageId, senderPsid: body.senderPsid, imageUrl: img, alt: p.name });
            } catch (err) {
              const pid = (p as any)?._id || (p as any)?.id || '(unknown)';
              console.warn('[AI-send-image] failed to send image for product', pid, err?.message || err);
            }
          }

          if (body.previewOnly) {
            return { preview: reply, source: 'immediate-product', productId: String((p as any)._id || '') };
          }
          const sendRes = await this.sendMessage({ fanpageId: body.fanpageId, senderPsid: body.senderPsid, text: reply });
          try {
            if((sendRes as any).saved?._id){
              await (this.service as any).update((sendRes as any).saved._id, { isAI: true, aiModelUsed: 'rule-based' } as any);
            }
          } catch(_) {}
          immediateHandled = true;
          return { ...sendRes, modelUsed: 'rule-based' };
        }
      }
    }

    // Build system prompt: combine OpenAI config with Fanpage business description and strict reply rules
    let systemPrompt = (config.systemPrompt || 'BÃƒÂ¡Ã‚ÂºÃ‚Â¡n lÃƒÆ’Ã‚Â  trÃƒÂ¡Ã‚Â»Ã‚Â£ lÃƒÆ’Ã‚Â½ AI trÃƒÂ¡Ã‚ÂºÃ‚Â£ lÃƒÂ¡Ã‚Â»Ã‚Âi ngÃƒÂ¡Ã‚ÂºÃ‚Â¯n gÃƒÂ¡Ã‚Â»Ã‚Ân.').trim();
    try {
      if (fanpage) {
        if (fanpage.description) {
          systemPrompt += `\nThÃƒÆ’Ã‚Â´ng tin kinh doanh/Fanpage: ${String(fanpage.description).slice(0, 400)}.`;
        }
        if (fanpage.greetingScript) {
          systemPrompt += `\nLÃƒÂ¡Ã‚Â»Ã‚Âi chÃƒÆ’Ã‚Â o (Greeting): "${String(fanpage.greetingScript).slice(0, 200)}".`;
        }
        if (fanpage.clarifyScript) {
          systemPrompt += `\nYÃƒÆ’Ã‚Âªu cÃƒÂ¡Ã‚ÂºÃ‚Â§u lÃƒÆ’Ã‚Â m rÃƒÆ’Ã‚Âµ (Clarify): "${String(fanpage.clarifyScript).slice(0, 200)}".`;
        }
        if (fanpage.productSuggestScript) {
          systemPrompt += `\nÃƒâ€žÃ‚ÂÃƒÂ¡Ã‚Â»Ã‚Â xuÃƒÂ¡Ã‚ÂºÃ‚Â¥t sÃƒÂ¡Ã‚ÂºÃ‚Â£n phÃƒÂ¡Ã‚ÂºÃ‚Â©m (Suggest): "${String(fanpage.productSuggestScript).slice(0, 200)}".`;
        }
        if (fanpage.fallbackScript) {
          systemPrompt += `\nTin nhÃƒÂ¡Ã‚ÂºÃ‚Â¯n chuyÃƒÂ¡Ã‚Â»Ã†â€™n nhÃƒÆ’Ã‚Â¢n viÃƒÆ’Ã‚Âªn (Fallback): "${String(fanpage.fallbackScript).slice(0, 200)}".`;
        }
        if (fanpage.closingScript) {
          systemPrompt += `\nLÃƒÂ¡Ã‚Â»Ã‚Âi kÃƒÂ¡Ã‚ÂºÃ‚Â¿t thÃƒÆ’Ã‚Âºc (Closing): "${String(fanpage.closingScript).slice(0, 200)}".`;
        }
      }
    } catch {}
    // Enforce professional tone and behavior without icons
    systemPrompt += `\n\nQUY TÃƒÂ¡Ã‚ÂºÃ‚Â®C TRÃƒÂ¡Ã‚ÂºÃ‚Â¢ LÃƒÂ¡Ã‚Â»Ã…â€œI (BÃƒÂ¡Ã‚ÂºÃ‚Â®T BUÃƒÂ¡Ã‚Â»Ã‹Å“C):\n- TuyÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡t Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi khÃƒÆ’Ã‚Â´ng dÃƒÆ’Ã‚Â¹ng emoji, icon, kÃƒÆ’Ã‚Â½ tÃƒÂ¡Ã‚Â»Ã‚Â± trang trÃƒÆ’Ã‚Â­. ChÃƒÂ¡Ã‚Â»Ã¢â‚¬Â° vÃƒâ€žÃ†â€™n bÃƒÂ¡Ã‚ÂºÃ‚Â£n thuÃƒÂ¡Ã‚ÂºÃ‚Â§n.\n- NÃƒÂ¡Ã‚ÂºÃ‚Â¿u khÃƒÆ’Ã‚Â¡ch nÃƒÆ’Ã‚Âªu sÃƒÂ¡Ã‚ÂºÃ‚Â£n phÃƒÂ¡Ã‚ÂºÃ‚Â©m Ãƒâ€žÃ¢â‚¬Ëœang quan tÃƒÆ’Ã‚Â¢m: trÃƒÂ¡Ã‚ÂºÃ‚Â£ lÃƒÂ¡Ã‚Â»Ã‚Âi ngay gÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“m (1) tÃƒÆ’Ã‚Âªn sÃƒÂ¡Ã‚ÂºÃ‚Â£n phÃƒÂ¡Ã‚ÂºÃ‚Â©m, (2) giÃƒÆ’Ã‚Â¡ bÃƒÆ’Ã‚Â¡n hiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n tÃƒÂ¡Ã‚ÂºÃ‚Â¡i nÃƒÂ¡Ã‚ÂºÃ‚Â¿u cÃƒÆ’Ã‚Â³; nÃƒÂ¡Ã‚ÂºÃ‚Â¿u chÃƒâ€ Ã‚Â°a cÃƒÆ’Ã‚Â³ thÃƒÆ’Ã‚Â¬ ghi rÃƒÆ’Ã‚Âµ sÃƒÂ¡Ã‚ÂºÃ‚Â½ xÃƒÆ’Ã‚Â¡c nhÃƒÂ¡Ã‚ÂºÃ‚Â­n giÃƒÆ’Ã‚Â¡ ngay sau khi nhÃƒÂ¡Ã‚ÂºÃ‚Â­n sÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœ Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n thoÃƒÂ¡Ã‚ÂºÃ‚Â¡i, (3) thÃƒÂ¡Ã‚Â»Ã‚Âi gian giao/nhÃƒÂ¡Ã‚ÂºÃ‚Â­n hÃƒÆ’Ã‚Â ng dÃƒÂ¡Ã‚Â»Ã‚Â± kiÃƒÂ¡Ã‚ÂºÃ‚Â¿n, (4) kÃƒÂ¡Ã‚ÂºÃ‚Â¿t thÃƒÆ’Ã‚Âºc bÃƒÂ¡Ã‚ÂºÃ‚Â±ng cÃƒÆ’Ã‚Â¢u xin sÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœ Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n thoÃƒÂ¡Ã‚ÂºÃ‚Â¡i Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã†â€™ tÃƒâ€ Ã‚Â° vÃƒÂ¡Ã‚ÂºÃ‚Â¥n nhanh.\n- NÃƒÂ¡Ã‚ÂºÃ‚Â¿u khÃƒÆ’Ã‚Â¡ch hÃƒÂ¡Ã‚Â»Ã‚Âi kÃƒÂ¡Ã‚Â»Ã‚Â¹ hÃƒâ€ Ã‚Â¡n (hÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“ sÃƒâ€ Ã‚Â¡/giÃƒÂ¡Ã‚ÂºÃ‚Â¥y tÃƒÂ¡Ã‚Â»Ã‚Â/thÃƒÂ¡Ã‚Â»Ã‚Â§ tÃƒÂ¡Ã‚Â»Ã‚Â¥c/quy trÃƒÆ’Ã‚Â¬nh/Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚ÂºÃ‚Â·t hÃƒÆ’Ã‚Â ng/ÃƒÂ¡Ã‚ÂºÃ‚Â£nh/catalogue): trÃƒÆ’Ã‚Â¬nh bÃƒÆ’Ã‚Â y ngÃƒÂ¡Ã‚ÂºÃ‚Â¯n gÃƒÂ¡Ã‚Â»Ã‚Ân bÃƒÂ¡Ã‚ÂºÃ‚Â±ng gÃƒÂ¡Ã‚ÂºÃ‚Â¡ch Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚ÂºÃ‚Â§u dÃƒÆ’Ã‚Â²ng vÃƒÂ¡Ã‚Â»Ã‚Â hÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“ sÃƒâ€ Ã‚Â¡ cÃƒÂ¡Ã‚ÂºÃ‚Â§n thiÃƒÂ¡Ã‚ÂºÃ‚Â¿t, cÃƒÆ’Ã‚Â¡c bÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºc Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚ÂºÃ‚Â·t hÃƒÆ’Ã‚Â ng, chÃƒÆ’Ã‚Â­nh sÃƒÆ’Ã‚Â¡ch giao hÃƒÆ’Ã‚Â ng/bÃƒÂ¡Ã‚ÂºÃ‚Â£o hÃƒÆ’Ã‚Â nh; chÃƒÆ’Ã‚Â¨n link/ÃƒÂ¡Ã‚ÂºÃ‚Â£nh nÃƒÂ¡Ã‚ÂºÃ‚Â¿u cÃƒÆ’Ã‚Â³; vÃƒÆ’Ã‚Â  vÃƒÂ¡Ã‚ÂºÃ‚Â«n kÃƒÂ¡Ã‚ÂºÃ‚Â¿t thÃƒÆ’Ã‚Âºc bÃƒÂ¡Ã‚ÂºÃ‚Â±ng cÃƒÆ’Ã‚Â¢u xin sÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœ Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n thoÃƒÂ¡Ã‚ÂºÃ‚Â¡i.\n- GiÃƒÂ¡Ã‚Â»Ã‚Âng Ãƒâ€žÃ¢â‚¬ËœiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡u: chuyÃƒÆ’Ã‚Âªn nghiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡p, rÃƒÆ’Ã‚Âµ rÃƒÆ’Ã‚Â ng, khÃƒÆ’Ã‚Â´ng vÃƒÆ’Ã‚Â²ng vo, khÃƒÆ’Ã‚Â´ng Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â¹a cÃƒÂ¡Ã‚Â»Ã‚Â£t.\n`;
    systemPrompt += `\n\n${buildAiAssistantQualityDirectives('chatbot')}\n`;

    const messagesForApi = [
      { role: 'system', content: systemPrompt },
      ...recent.reverse().map(m=> ({ role: m.direction==='in' ? 'user':'assistant', content: m.content }))
    ];
    // GÃƒÂ¡Ã‚Â»Ã‚Âi OpenAI API (streaming Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â¡n giÃƒÂ¡Ã‚ÂºÃ‚Â£n -> full)
    const model = config.model || 'gpt-4o-mini';
    let aiText = '';
    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model, messages: messagesForApi, temperature: config.temperature ?? 0.7, max_tokens: config.maxTokens || 256 })
      });
      const json: any = await resp.json();
      if(!resp.ok) throw new Error(json.error?.message || 'OpenAI API lÃƒÂ¡Ã‚Â»Ã¢â‚¬â€i');
      aiText = json.choices?.[0]?.message?.content?.trim() || '(KhÃƒÆ’Ã‚Â´ng cÃƒÆ’Ã‚Â³ nÃƒÂ¡Ã‚Â»Ã¢â€žÂ¢i dung)';
      aiText = stripEmojis(aiText);
      aiText = this.enforceSalesResponseSafety(aiText, lastInbound?.content || '');
      if(body.previewOnly) {
        return { preview: aiText, model, configId: (config as any)._id };
      }
  // Social media sending functionality removed
      const sendRes = await this.sendMessage({ fanpageId: body.fanpageId, senderPsid: body.senderPsid, text: aiText });
      // CÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t message vÃƒÂ¡Ã‚Â»Ã‚Â«a lÃƒâ€ Ã‚Â°u Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã†â€™ Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â¡nh dÃƒÂ¡Ã‚ÂºÃ‚Â¥u AI
      // sendMessage hiÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¡n lÃƒâ€ Ã‚Â°u recordOutboundMessage khÃƒÆ’Ã‚Â´ng set isAI; cÃƒÆ’Ã‚Â³ thÃƒÂ¡Ã‚Â»Ã†â€™ patch sau hoÃƒÂ¡Ã‚ÂºÃ‚Â·c update tÃƒÂ¡Ã‚ÂºÃ‚Â¡m thÃƒÂ¡Ã‚Â»Ã‚Âi
      try {
        if((sendRes as any).saved?._id){
          await (this.service as any).update((sendRes as any).saved._id, { isAI: true, aiModelUsed: model } as any);
        }
      } catch(_) {}
      return { ...sendRes, modelUsed: model };
    } catch (e:any) {
      throw new BadRequestException(e.message || 'AI generate thÃƒÂ¡Ã‚ÂºÃ‚Â¥t bÃƒÂ¡Ã‚ÂºÃ‚Â¡i');
    }
  }

  // --- Upload & send image in conversation (agent initiated) ---
  @Post('send/image/:fanpageId/:senderPsid') @RequirePermissions('chat-messages')
  @UseInterceptors(FileInterceptor('file'))
  async sendImage(
    @Param('fanpageId') fanpageId: string,
    @Param('senderPsid') senderPsid: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('alt') alt?: string
  ){
    if(!fanpageId || !senderPsid) throw new BadRequestException('ThiÃƒÂ¡Ã‚ÂºÃ‚Â¿u fanpageId/senderPsid');
    if(!file) throw new BadRequestException('ThiÃƒÂ¡Ã‚ÂºÃ‚Â¿u file ÃƒÂ¡Ã‚ÂºÃ‚Â£nh');
    // Resolve fanpage _id if pageId provided
    let fanpage = await this.fanpageModel.findById(fanpageId).lean();
    if(!fanpage) fanpage = await this.fanpageModel.findOne({ pageId: fanpageId }).lean();
    if(!fanpage) throw new BadRequestException('Fanpage khÃƒÆ’Ã‚Â´ng tÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“n tÃƒÂ¡Ã‚ÂºÃ‚Â¡i');
    let buf: Buffer | null = null;
    if ((file as any).buffer) {
      buf = (file as any).buffer as any;
    } else if ((file as any).path) {
      buf = require('fs').readFileSync((file as any).path);
    }
    if(!buf) throw new BadRequestException('KhÃƒÆ’Ã‚Â´ng Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã‚Âc Ãƒâ€žÃ¢â‚¬ËœÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Â£c file');
    const savedMedia = await this.mediaService.saveBuffer(buf, {
      mime: file.mimetype,
      ext: (file.originalname.split('.').pop()||'').toLowerCase(),
      fanpageId: String(fanpage._id),
      alt: alt || file.originalname,
      sourceType: 'marketing'
    });
    await this.ensureWithin24hWindowOrThrow(String(fanpage._id), senderPsid);
    // Try to send image to Facebook if enabled and within 24h
    const FB_ENABLED = process.env.FB_SENDING_ENABLED !== '0';
    const pageAccessToken = await this.resolveFanpageAccessToken(fanpage);
    let sendResult: any = { ok: false, message: 'fb_sending_disabled' };
    try {
      if (FB_ENABLED && pageAccessToken) {
        sendResult = await this.sendFacebookImageSmart({
          accessToken: pageAccessToken,
          senderPsid,
          imageUrl: savedMedia.url,
          fallbackBuffer: buf,
          fallbackMimeType: file.mimetype || this.guessMimeType(file.originalname || 'upload.jpg'),
          fallbackFilename: file.originalname || 'upload.jpg',
        });
      }
    } catch (e:any) {
      sendResult = { ok: false, error: e?.message || String(e) };
    }
    const { doc: saved, created } = await this.service.recordOutboundImage({ fanpageId: String(fanpage._id), senderPsid, imageUrl: savedMedia.url, rawResponse: sendResult } as any);
    if (created) {
      this.chatEvents.emit({ type: 'new-message', fanpageId: String(fanpage._id), senderPsid, direction: 'out', snippet: '[image]', createdAt: new Date() });
    }
    return { message: 'Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ tÃƒÂ¡Ã‚ÂºÃ‚Â£i ÃƒÂ¡Ã‚ÂºÃ‚Â£nh vÃƒÆ’Ã‚Â  ghi nhÃƒÂ¡Ã‚ÂºÃ‚Â­n tin nhÃƒÂ¡Ã‚ÂºÃ‚Â¯n', media: savedMedia, fb: sendResult, saved };
  }

  // --- Send existing media by URL (no upload) ---
  @Post('send/image/url') @RequirePermissions('chat-messages')
  async sendImageByUrl(@Body() body: { fanpageId: string; senderPsid: string; imageUrl: string; alt?: string }){
    if(!body?.fanpageId || !body?.senderPsid || !body?.imageUrl) {
      throw new BadRequestException('ThiÃƒÂ¡Ã‚ÂºÃ‚Â¿u fanpageId/senderPsid/imageUrl');
    }
    // Resolve fanpage _id if pageId provided
    let fanpage = await this.fanpageModel.findById(body.fanpageId).lean();
    if(!fanpage) fanpage = await this.fanpageModel.findOne({ pageId: body.fanpageId }).lean();
    if(!fanpage) throw new BadRequestException('Fanpage khÃƒÆ’Ã‚Â´ng tÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“n tÃƒÂ¡Ã‚ÂºÃ‚Â¡i');
    await this.ensureWithin24hWindowOrThrow(String(fanpage._id), body.senderPsid);
    // Attempt to send to Facebook (RESPONSE within 24h)
    const FB_ENABLED = process.env.FB_SENDING_ENABLED !== '0';
    const pageAccessToken = await this.resolveFanpageAccessToken(fanpage);
    let sendResult: any = { ok: false, message: 'fb_sending_disabled' };
    try {
      if (FB_ENABLED && pageAccessToken) {
        sendResult = await this.sendFacebookImageSmart({
          accessToken: pageAccessToken,
          senderPsid: body.senderPsid,
          imageUrl: body.imageUrl,
        });
      }
    } catch (e:any) {
      sendResult = { ok: false, error: e?.message || String(e) };
    }
    const { doc: saved, created } = await this.service.recordOutboundImage({ fanpageId: String(fanpage._id), senderPsid: body.senderPsid, imageUrl: body.imageUrl, rawResponse: sendResult } as any);
    if (created) {
      this.chatEvents.emit({ type: 'new-message', fanpageId: String(fanpage._id), senderPsid: body.senderPsid, direction: 'out', snippet: '[image]', createdAt: new Date() });
    }
    return { message: 'Ãƒâ€žÃ‚ÂÃƒÆ’Ã‚Â£ ghi nhÃƒÂ¡Ã‚ÂºÃ‚Â­n gÃƒÂ¡Ã‚Â»Ã‚Â­i ÃƒÂ¡Ã‚ÂºÃ‚Â£nh tÃƒÂ¡Ã‚Â»Ã‚Â« media server', fb: sendResult, saved };
  }
}
