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

import { Model } from 'mongoose';
import { map } from 'rxjs/operators';
import { ChatEventsService } from './chat-events.service';
import { FeatureModule } from '../plan/feature-module.decorator';

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
  ) {}

  // Ensure media URL is absolute by prefixing configured public origin if needed
  private ensureAbsolute(url: string) {
    if (!url) return url;
    if (/^https?:\/\//i.test(url)) return url;
    const origin = process.env.MEDIA_ABSOLUTE_BASE || process.env.PUBLIC_ORIGIN || process.env.APP_PUBLIC_ORIGIN || '';
    if (!origin) return url;
    return (origin.replace(/\/$/, '') + url).replace(/\s/g, '');
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

  private async sendFacebookImageByUrl(accessToken: string, senderPsid: string, imageUrl: string): Promise<any> {
    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(accessToken)}`;
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

    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(accessToken)}`;
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
    console.log('🔍 SendMessage request body:', JSON.stringify(body, null, 2));
    const messageText = body.text || body.content;
    if(!body.fanpageId || !body.senderPsid || !messageText) {
      console.log('❌ Validation failed:', { fanpageId: !!body.fanpageId, senderPsid: !!body.senderPsid, messageText: !!messageText });
      throw new BadRequestException('Thiếu fanpageId / senderPsid / text hoặc content');
    }
    // fanpageId có thể là _id hoặc pageId để tiện dụng
    let fanpage = await this.fanpageModel.findById(body.fanpageId).lean();
    if(!fanpage) {
      fanpage = await this.fanpageModel.findOne({ pageId: body.fanpageId }).lean();
    }
    if(!fanpage) {
      console.log('❌ Fanpage not found:', { fanpageId: body.fanpageId });
      throw new BadRequestException('Fanpage không tồn tại (fanpageId có thể là _id hoặc pageId)');
    }
    console.log('✅ Fanpage found:', { _id: fanpage._id, pageId: fanpage.pageId, name: fanpage.name });

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
        throw new BadRequestException('Hết cửa sổ 24h của Messenger. Vui lòng yêu cầu khách nhắn lại một tin hoặc gửi theo MESSAGE_TAG hợp lệ (ACCOUNT_UPDATE/POST_PURCHASE_UPDATE/CONFIRMED_EVENT_UPDATE).');
      }
    }

    // When using MESSAGE_TAG ensure tag is valid
    if (messagingType === 'MESSAGE_TAG') {
      if (!tag || !allowedTags.has(tag)) {
        throw new BadRequestException('Thiếu hoặc tag không hợp lệ. Tag hợp lệ: ACCOUNT_UPDATE, POST_PURCHASE_UPDATE, CONFIRMED_EVENT_UPDATE');
      }
    } else {
      // For RESPONSE, ensure we are within 24h
      if (!within24h) {
        console.warn('[Messenger] Blocked RESPONSE send outside 24h. fanpageId=%s senderPsid=%s', fanpage._id, body.senderPsid);
        throw new BadRequestException('Hết cửa sổ 24h của Messenger. Không thể gửi với messaging_type=RESPONSE.');
      }
    }

    // Send to Facebook if enabled, otherwise only record internally
    let responseJson: any = { ok: false, message: 'fb_sending_disabled' };
    let deliveryNote: string | null = null;
    const FB_ENABLED = process.env.FB_SENDING_ENABLED !== '0';
    if (FB_ENABLED && (fanpage as any).accessToken) {
      try {
        const payload: any = {
          recipient: { id: body.senderPsid },
          messaging_type: (messagingType === 'MESSAGE_TAG') ? 'MESSAGE_TAG' : 'RESPONSE',
          message: { text: messageText }
        };
        if (messagingType === 'MESSAGE_TAG' && tag) payload.tag = tag;
        const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent((fanpage as any).accessToken)}`;
        const fbRes = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          .then(r => r.json()).catch(e => ({ ok: false, error: (e?.message || String(e)) }));
        responseJson = fbRes;
        if (!fbRes?.message_id) {
          const err = fbRes?.error || {};
          deliveryNote = `Gửi FB thất bại: code ${err.code || '?'} subcode ${err.error_subcode || '?'} - ${err.message || 'Không rõ lỗi'}`;
        }
      } catch (err: any) {
        responseJson = { ok: false, error: err?.message || String(err) };
        deliveryNote = `Lỗi gửi tới Facebook: ${responseJson.error}`;
      }
    } else {
      if (!FB_ENABLED) deliveryNote = 'FB_SENDING_ENABLED=0 (đang tắt gửi ra Facebook).';
      else if (!(fanpage as any).accessToken) deliveryNote = 'Thiếu Access Token của fanpage.';
    }
    const saved = await this.service.recordOutboundMessage({ fanpageId: fanpage._id.toString(), senderPsid: body.senderPsid, text: messageText, rawResponse: responseJson });
    // If not delivered, record a system note so operators can see why
    if (deliveryNote) {
      try {
        await this.service.create({
          fanpageId: fanpage._id.toString(),
          senderPsid: body.senderPsid,
          content: `[KHÔNG GỬI RA FB] ${deliveryNote}`,
          direction: 'system',
          awaitingHuman: false,
          receivedAt: new Date() as any,
          raw: { note: deliveryNote }
        } as any);
      } catch {}
    }
    // notify listeners
    this.chatEvents.emit({ type: 'new-message', fanpageId: String(fanpage._id), senderPsid: body.senderPsid, direction: 'out', snippet: messageText.slice(0,120), createdAt: new Date() });
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
        config = await this.openAIService.findOne(fanpage.openAIConfigId.toString());
      } catch (error) {
        console.warn('Config not found for fanpage:', fanpage.openAIConfigId);
      }
    }
    if(!config) config = await this.openAIService.pickConfig({ fanpageId: body.fanpageId });
    if(!config) throw new BadRequestException('Chưa có cấu hình OpenAI khả dụng');
    if(!config.apiKey) throw new BadRequestException('Config thiếu apiKey');

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
      const keywords = raw.split(/[^A-Za-zÀ-ỹĐđ0-9]+/).filter(w => w && w.length >= 2).slice(0, 6);
      if (keywords.length) {
        // Use ProductService search (by first keyword), then refine by all keywords if possible
        const initial = await this.productService.findAll({ search: keywords[0] });
        // Ưu tiên sản phẩm đã được gán variation cho fanpage hiện tại
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
            return aHasVar ? -1 : 1; // đưa sản phẩm có variation của fanpage lên trước
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
          const totalCost = (p as any).totalCost as number | undefined;
          const priceText = price ? `${formatVnd(price)}đ` : (typeof totalCost === 'number' ? `Chi phí đầu vào ước tính ~ ${formatVnd(totalCost)}đ (giá bán xác nhận theo thời điểm)` : 'Giá sẽ được xác nhận theo thời điểm');
          const delivery = (p as any).estimatedDeliveryDays || 0;
          const deliveryText = delivery <= 0 ? 'giao trong ngày (nếu còn hàng)' : `dự kiến nhận hàng trong khoảng ${delivery} ngày`;
          const notes = (p as any).notes ? `\n- Ghi chú: ${(p as any).notes}` : '';
          const resource = (p as any).resourceLink ? `\n- Tham khảo thêm: ${(p as any).resourceLink}` : '';

          let reply = `Anh/chị đang quan tâm: ${p.name}.\n- Giá hiện tại: ${priceText}.\n- Thời gian giao/nhận: ${deliveryText}.${notes}${resource}\n\nĐể tư vấn và chốt giá nhanh nhất, anh/chị cho em xin số điện thoại liên hệ được không ạ?`;
          reply = stripEmojis(reply);

          // Gửi kèm nhiều ảnh: lấy ảnh chung của sản phẩm trước, sau đó đến customImages của fanpage (không ưu tiên variation nữa)
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
            // 1) Ảnh chung của sản phẩm
            if ((p as any).images?.length) pushList((p as any).images.map((img: any) => img?.url || img).filter(Boolean));
            // 2) Ảnh custom của fanpage (nếu có)
            if (fpVar?.customImages?.length) pushList(fpVar.customImages);
            return out;
          };
          const imageList = pickImages()
            .map(u => this.ensureAbsolute(u))
            .filter(u => /^https?:\/\//i.test(u))
            .slice(0, 5); // gửi tối đa 5 ảnh để tránh spam
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
    let systemPrompt = (config.systemPrompt || 'Bạn là trợ lý AI trả lời ngắn gọn.').trim();
    try {
      if (fanpage) {
        if (fanpage.description) {
          systemPrompt += `\nThông tin kinh doanh/Fanpage: ${String(fanpage.description).slice(0, 400)}.`;
        }
        if (fanpage.greetingScript) {
          systemPrompt += `\nLời chào (Greeting): "${String(fanpage.greetingScript).slice(0, 200)}".`;
        }
        if (fanpage.clarifyScript) {
          systemPrompt += `\nYêu cầu làm rõ (Clarify): "${String(fanpage.clarifyScript).slice(0, 200)}".`;
        }
        if (fanpage.productSuggestScript) {
          systemPrompt += `\nĐề xuất sản phẩm (Suggest): "${String(fanpage.productSuggestScript).slice(0, 200)}".`;
        }
        if (fanpage.fallbackScript) {
          systemPrompt += `\nTin nhắn chuyển nhân viên (Fallback): "${String(fanpage.fallbackScript).slice(0, 200)}".`;
        }
        if (fanpage.closingScript) {
          systemPrompt += `\nLời kết thúc (Closing): "${String(fanpage.closingScript).slice(0, 200)}".`;
        }
      }
    } catch {}
    // Enforce professional tone and behavior without icons
    systemPrompt += `\n\nQUY TẮC TRẢ LỜI (BẮT BUỘC):\n- Tuyệt đối không dùng emoji, icon, ký tự trang trí. Chỉ văn bản thuần.\n- Nếu khách nêu sản phẩm đang quan tâm: trả lời ngay gồm (1) tên sản phẩm, (2) giá bán hiện tại nếu có; nếu chưa có thì ghi rõ sẽ xác nhận giá ngay sau khi nhận số điện thoại, (3) thời gian giao/nhận hàng dự kiến, (4) kết thúc bằng câu xin số điện thoại để tư vấn nhanh.\n- Nếu khách hỏi kỹ hơn (hồ sơ/giấy tờ/thủ tục/quy trình/đặt hàng/ảnh/catalogue): trình bày ngắn gọn bằng gạch đầu dòng về hồ sơ cần thiết, các bước đặt hàng, chính sách giao hàng/bảo hành; chèn link/ảnh nếu có; và vẫn kết thúc bằng câu xin số điện thoại.\n- Giọng điệu: chuyên nghiệp, rõ ràng, không vòng vo, không đùa cợt.\n`;
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
      aiText = stripEmojis(aiText);
      if(body.previewOnly) {
        return { preview: aiText, model, configId: (config as any)._id };
      }
  // Social media sending functionality removed
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

  // --- Upload & send image in conversation (agent initiated) ---
  @Post('send/image/:fanpageId/:senderPsid') @RequirePermissions('chat-messages')
  @UseInterceptors(FileInterceptor('file'))
  async sendImage(
    @Param('fanpageId') fanpageId: string,
    @Param('senderPsid') senderPsid: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('alt') alt?: string
  ){
    if(!fanpageId || !senderPsid) throw new BadRequestException('Thiếu fanpageId/senderPsid');
    if(!file) throw new BadRequestException('Thiếu file ảnh');
    // Resolve fanpage _id if pageId provided
    let fanpage = await this.fanpageModel.findById(fanpageId).lean();
    if(!fanpage) fanpage = await this.fanpageModel.findOne({ pageId: fanpageId }).lean();
    if(!fanpage) throw new BadRequestException('Fanpage không tồn tại');
    let buf: Buffer | null = null;
    if ((file as any).buffer) {
      buf = (file as any).buffer as any;
    } else if ((file as any).path) {
      buf = require('fs').readFileSync((file as any).path);
    }
    if(!buf) throw new BadRequestException('Không đọc được file');
    const savedMedia = await this.mediaService.saveBuffer(buf, {
      mime: file.mimetype,
      ext: (file.originalname.split('.').pop()||'').toLowerCase(),
      fanpageId: String(fanpage._id),
      alt: alt || file.originalname,
      sourceType: 'marketing'
    });
    // Try to send image to Facebook if enabled and within 24h
    const FB_ENABLED = process.env.FB_SENDING_ENABLED !== '0';
    let sendResult: any = { ok: false, message: 'fb_sending_disabled' };
    try {
      if (FB_ENABLED && (fanpage as any).accessToken) {
        const within24h = await this.isWithin24hWindow(String(fanpage._id), senderPsid);
        if (within24h) {
          sendResult = await this.sendFacebookImageSmart({
            accessToken: (fanpage as any).accessToken,
            senderPsid,
            imageUrl: savedMedia.url,
            fallbackBuffer: buf,
            fallbackMimeType: file.mimetype || this.guessMimeType(file.originalname || 'upload.jpg'),
            fallbackFilename: file.originalname || 'upload.jpg',
          });
        } else {
          sendResult = { ok: false, message: 'blocked_outside_24h' };
        }
      }
    } catch (e:any) {
      sendResult = { ok: false, error: e?.message || String(e) };
    }
    const saved = await this.service.recordOutboundImage({ fanpageId: String(fanpage._id), senderPsid, imageUrl: savedMedia.url, rawResponse: sendResult } as any);
    this.chatEvents.emit({ type: 'new-message', fanpageId: String(fanpage._id), senderPsid, direction: 'out', snippet: '[image]', createdAt: new Date() });
    return { message: 'Đã tải ảnh và ghi nhận tin nhắn', media: savedMedia, fb: sendResult, saved };
  }

  // --- Send existing media by URL (no upload) ---
  @Post('send/image/url') @RequirePermissions('chat-messages')
  async sendImageByUrl(@Body() body: { fanpageId: string; senderPsid: string; imageUrl: string; alt?: string }){
    if(!body?.fanpageId || !body?.senderPsid || !body?.imageUrl) {
      throw new BadRequestException('Thiếu fanpageId/senderPsid/imageUrl');
    }
    // Resolve fanpage _id if pageId provided
    let fanpage = await this.fanpageModel.findById(body.fanpageId).lean();
    if(!fanpage) fanpage = await this.fanpageModel.findOne({ pageId: body.fanpageId }).lean();
    if(!fanpage) throw new BadRequestException('Fanpage không tồn tại');
    // Attempt to send to Facebook (RESPONSE within 24h)
    const FB_ENABLED = process.env.FB_SENDING_ENABLED !== '0';
    let sendResult: any = { ok: false, message: 'fb_sending_disabled' };
    try {
      if (FB_ENABLED && (fanpage as any).accessToken) {
        const within24h = await this.isWithin24hWindow(String(fanpage._id), body.senderPsid);
        if (within24h) {
          sendResult = await this.sendFacebookImageSmart({
            accessToken: (fanpage as any).accessToken,
            senderPsid: body.senderPsid,
            imageUrl: body.imageUrl,
          });
        } else {
          sendResult = { ok: false, message: 'blocked_outside_24h' };
        }
      }
    } catch (e:any) {
      sendResult = { ok: false, error: e?.message || String(e) };
    }
    const saved = await this.service.recordOutboundImage({ fanpageId: String(fanpage._id), senderPsid: body.senderPsid, imageUrl: body.imageUrl, rawResponse: sendResult } as any);
    this.chatEvents.emit({ type: 'new-message', fanpageId: String(fanpage._id), senderPsid: body.senderPsid, direction: 'out', snippet: '[image]', createdAt: new Date() });
    return { message: 'Đã ghi nhận gửi ảnh từ media server', fb: sendResult, saved };
  }
}
