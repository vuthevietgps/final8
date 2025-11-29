"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MessengerWebhookService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessengerWebhookService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const chat_message_service_1 = require("./chat-message.service");
const fanpage_schema_1 = require("../fanpage/schemas/fanpage.schema");
const openai_config_service_1 = require("../openai-config/openai-config.service");
const vision_ai_service_1 = require("../product/vision-ai.service");
const product_service_1 = require("../product/product.service");
const media_service_1 = require("../media/media.service");
const chat_events_service_1 = require("./chat-events.service");
const node_fetch_1 = require("node-fetch");
let MessengerWebhookService = MessengerWebhookService_1 = class MessengerWebhookService {
    constructor(chatService, fanpageModel, openaiConfig, visionAIService, productService, mediaService, chatEvents) {
        this.chatService = chatService;
        this.fanpageModel = fanpageModel;
        this.openaiConfig = openaiConfig;
        this.visionAIService = visionAIService;
        this.productService = productService;
        this.mediaService = mediaService;
        this.chatEvents = chatEvents;
        this.logger = new common_1.Logger(MessengerWebhookService_1.name);
        this.isDebugMode = process.env.CHAT_WEBHOOK_DEBUG === '1' || process.env.NODE_ENV !== 'production';
    }
    async handle(body) {
        if (body.object !== 'page') {
            throw new Error('Unsupported object type');
        }
        await this.processWebhookEntries(body.entry || []);
    }
    async processWebhookEntries(entries) {
        for (const entry of entries) {
            const pageId = entry.id;
            const fanpage = await this.getFanpage(pageId);
            for (const messagingEvent of entry.messaging || []) {
                await this.processMessagingEvent(messagingEvent, fanpage, pageId);
            }
        }
    }
    async getFanpage(pageId) {
        let fanpage = await this.fanpageModel.findOne({ pageId }).lean();
        if (fanpage && !fanpage.subscribedWebhook) {
            await this.fanpageModel.updateOne({ _id: fanpage._id }, {
                $set: {
                    subscribedWebhook: true,
                    connectedAt: fanpage.connectedAt || new Date(),
                },
            });
            fanpage = await this.fanpageModel.findOne({ pageId }).lean();
        }
        return fanpage;
    }
    async processMessagingEvent(messagingEvent, fanpage, pageId) {
        var _a, _b, _c, _d;
        const senderPsid = (_a = messagingEvent.sender) === null || _a === void 0 ? void 0 : _a.id;
        const recipientId = (_b = messagingEvent.recipient) === null || _b === void 0 ? void 0 : _b.id;
        const timestamp = messagingEvent.timestamp ? new Date(messagingEvent.timestamp) : new Date();
        if (!senderPsid || !recipientId)
            return;
        if (messagingEvent.message) {
            const adId = (messagingEvent === null || messagingEvent === void 0 ? void 0 : messagingEvent.ad_id) || ((_d = (_c = messagingEvent.message) === null || _c === void 0 ? void 0 : _c.referral) === null || _d === void 0 ? void 0 : _d.ad_id) || undefined;
            await this.handleTextMessage(messagingEvent.message, fanpage, pageId, senderPsid, timestamp, adId);
        }
        else if (messagingEvent.postback) {
            await this.handlePostback(messagingEvent.postback, fanpage, pageId, senderPsid, timestamp);
        }
    }
    async handleTextMessage(message, fanpage, pageId, senderPsid, timestamp, adId) {
        var _a, _b, _c, _d, _e, _f, _g;
        const isInbound = senderPsid !== pageId;
        const content = message.text || (message.attachments ? '[Attachment]' : '[Empty]');
        let adGroupId;
        if ((_a = message.referral) === null || _a === void 0 ? void 0 : _a.ref) {
            const ref = message.referral.ref;
            const adGroupMatch = ref.match(/(?:ad_|adset_|adgroup_)(\d+)/i);
            if (adGroupMatch)
                adGroupId = adGroupMatch[1];
        }
        if (!adGroupId && ((_b = message.quick_reply) === null || _b === void 0 ? void 0 : _b.payload)) {
            const payload = message.quick_reply.payload;
            const adGroupMatch = payload.match(/adgroup[_:](\d+)/i);
            if (adGroupMatch)
                adGroupId = adGroupMatch[1];
        }
        if (!adGroupId && adId) {
            try {
                const resolvedAdset = await this.resolveAdSetIdFromAdId(adId, fanpage);
                if (resolvedAdset)
                    adGroupId = resolvedAdset;
            }
            catch (e) {
                if (this.isDebugMode)
                    this.logger.warn(`Failed to resolve adset from ad_id=${adId}: ${e === null || e === void 0 ? void 0 : e.message}`);
            }
        }
        const savedMessage = await this.chatService.create({
            fanpageId: ((_c = fanpage === null || fanpage === void 0 ? void 0 : fanpage._id) === null || _c === void 0 ? void 0 : _c.toString()) || pageId,
            senderPsid: isInbound ? senderPsid : (((_d = message.to) === null || _d === void 0 ? void 0 : _d.id) || senderPsid),
            content,
            direction: isInbound ? 'in' : 'out',
            raw: message,
            receivedAt: timestamp,
            awaitingHuman: isInbound,
            adGroupId: adGroupId || undefined,
        });
        try {
            const fanId = String(((_e = fanpage === null || fanpage === void 0 ? void 0 : fanpage._id) === null || _e === void 0 ? void 0 : _e.toString()) || pageId);
            this.chatEvents.emit({ type: 'new-message', fanpageId: fanId, senderPsid, direction: isInbound ? 'in' : 'out', snippet: String(content || '').slice(0, 120), createdAt: timestamp });
        }
        catch (e) {
            this.logger.warn('Failed to emit chat event: ' + (e === null || e === void 0 ? void 0 : e.message));
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
                    fanpageId: ((_f = fanpage === null || fanpage === void 0 ? void 0 : fanpage._id) === null || _f === void 0 ? void 0 : _f.toString()) || pageId,
                    senderPsid,
                    content: '[LEAD_CAPTURED] Số điện thoại đã được cung cấp - Ưu tiên gọi lại',
                    direction: 'system',
                    raw: { phoneNumber: content.match(phonePattern), capturedAt: new Date() },
                    receivedAt: timestamp,
                    awaitingHuman: true,
                });
            }
            this.triggerAutoAiReply({
                fanpage,
                pageId,
                senderPsid,
                lastUserMessage: content,
                savedInboundId: (_g = savedMessage._id) === null || _g === void 0 ? void 0 : _g.toString(),
                hasProductIntent,
                hasPhoneNumber,
            });
        }
    }
    async resolveAdSetIdFromAdId(adId, fanpage) {
        var _a, _b;
        const token = process.env.FB_ADS_ACCESS_TOKEN || (fanpage && fanpage.adAccessToken) || (fanpage === null || fanpage === void 0 ? void 0 : fanpage.accessToken);
        if (!token)
            return undefined;
        const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(adId)}?fields=adset_id,adset{name},campaign_id&access_token=${encodeURIComponent(token)}`;
        const res = await (0, node_fetch_1.default)(url, { method: 'GET' });
        const data = await res.json();
        if (!res.ok) {
            const msg = ((_a = data === null || data === void 0 ? void 0 : data.error) === null || _a === void 0 ? void 0 : _a.message) || JSON.stringify(data);
            throw new Error(`Graph error: ${msg}`);
        }
        const adsetId = (data === null || data === void 0 ? void 0 : data.adset_id) || ((_b = data === null || data === void 0 ? void 0 : data.adset) === null || _b === void 0 ? void 0 : _b.id);
        if (this.isDebugMode)
            this.logger.debug(`[Graph] ad_id=${adId} -> adset_id=${adsetId || 'N/A'}`);
        return adsetId || undefined;
    }
    async handlePostback(postback, fanpage, pageId, senderPsid, timestamp) {
        var _a;
        const payload = postback.payload || '[Postback]';
        await this.chatService.create({
            fanpageId: ((_a = fanpage === null || fanpage === void 0 ? void 0 : fanpage._id) === null || _a === void 0 ? void 0 : _a.toString()) || pageId,
            senderPsid,
            content: '[POSTBACK] ' + payload,
            direction: 'in',
            raw: postback,
            receivedAt: timestamp,
            awaitingHuman: true,
        });
        if (this.isDebugMode) {
            this.logger.debug('Postback processed', { pageId, senderPsid, payload });
        }
        this.triggerAutoAiReply({ fanpage, pageId, senderPsid, lastUserMessage: payload });
    }
    triggerAutoAiReply(params) {
        this.autoAiReplySafe(params).catch((error) => {
            if (this.isDebugMode)
                this.logger.error('Auto AI reply failed', error.message);
        });
    }
    async autoAiReplySafe(params) {
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
                if (this.isDebugMode)
                    this.logger.debug('AI disabled or fanpage not found', { pageId });
                return;
            }
            const convData = await this.chatService.getConversation(fp._id.toString(), senderPsid);
            const recentMessages = convData.messages.slice(0, 10);
            const lastInbound = recentMessages.find((m) => m.direction === 'in');
            const hasAiReplyToLastInbound = lastInbound &&
                recentMessages.some((m) => m.direction === 'out' &&
                    m.isAI &&
                    m.createdAt &&
                    lastInbound.createdAt &&
                    new Date(m.createdAt).getTime() > new Date(lastInbound.createdAt).getTime());
            if (hasAiReplyToLastInbound) {
                if (this.isDebugMode)
                    this.logger.debug('AI already replied to latest inbound');
                return;
            }
            const conversation = await this.chatService.listConversations({ fanpageId: fp._id.toString(), senderPsid });
            const convItem = Array.isArray(conversation.items) ? conversation.items.find((c) => c.senderPsid === senderPsid) : null;
            if (convItem && convItem.autoAiEnabled === false)
                return;
            let config = null;
            if (fp.openAIConfigId) {
                try {
                    config = await this.openaiConfig.findOne(fp.openAIConfigId.toString());
                }
                catch (error) {
                    this.logger.warn('OpenAI config not found for fanpage', fp.openAIConfigId);
                }
            }
            if (!config) {
                config = await this.openaiConfig.pickConfig({ fanpageId: fp._id.toString() });
            }
            if (!config || !config.apiKey || config.apiKey === 'placeholder-key') {
                if (this.isDebugMode)
                    this.logger.debug('No valid OpenAI config found');
                return;
            }
            if (this.isDebugMode) {
                this.logger.debug('OpenAI config loaded', { configName: config.name, model: config.model });
            }
            const sanitize = (t) => (t || '')
                .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
                .replace(/\s{2,}/g, ' ')
                .trim();
            const stripDiacritics = (s) => s ? s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D') : '';
            const keywordSource = [lastUserMessage, ...(((convData === null || convData === void 0 ? void 0 : convData.messages) || []).slice(0, 5).map((m) => m.content || ''))].join(' ');
            const keywords = Array.from(new Set(keywordSource
                .split(/[^A-Za-zÀ-ỹĐđ0-9]+/)
                .filter(w => w && w.length >= 2)
                .map(w => stripDiacritics(w.toLowerCase())))).slice(0, 12);
            let topMediaImages = [];
            let hasIntentMatchedImages = false;
            try {
                const media = await this.mediaService.list({ fanpageId: fp._id.toString(), page: 1, limit: 50 });
                const items = (media.items || []);
                const scored = items.map(m => {
                    const alt = stripDiacritics(String(m.alt || '').toLowerCase());
                    const tags = Array.isArray(m.tags) ? m.tags.map((t) => stripDiacritics(String(t).toLowerCase())) : [];
                    let score = 0;
                    for (const k of keywords) {
                        if (alt.includes(k))
                            score += 2;
                        if (tags.includes(k))
                            score += 1;
                    }
                    return { m, score };
                });
                const matched = scored.filter(x => x.score > 0)
                    .sort((a, b) => b.score - a.score || new Date(b.m.createdAt || 0).getTime() - new Date(a.m.createdAt || 0).getTime())
                    .slice(0, 3)
                    .map(x => x.m.url)
                    .filter(Boolean);
                if (matched.length) {
                    topMediaImages = matched;
                    hasIntentMatchedImages = true;
                }
                else {
                    topMediaImages = items.slice(0, 3).map(x => x.url).filter(Boolean);
                    hasIntentMatchedImages = false;
                }
            }
            catch (_a) { }
            const aiResponse = await this.generateAiResponse(fp, senderPsid, lastUserMessage, config, topMediaImages, params.hasPhoneNumber);
            if (!aiResponse) {
                if (this.isDebugMode)
                    this.logger.debug('AI response generation failed');
                return;
            }
            const attachImages = hasIntentMatchedImages && topMediaImages.length ? topMediaImages : undefined;
            const success = await this.sendFacebookMessage(fp, senderPsid, aiResponse, config.model, attachImages);
            if (success && params.savedInboundId) {
                try {
                    await this.chatService.update(params.savedInboundId, { awaitingHuman: false });
                }
                catch (error) {
                    this.logger.warn('Failed to update inbound message', error.message);
                }
            }
            if (this.isDebugMode) {
                this.logger.debug('AI response sent successfully', { senderPsid, responseSnippet: aiResponse.slice(0, 60) });
            }
        }
        catch (error) {
            this.logger.error('Auto AI reply error', error.stack);
        }
    }
    async generateAiResponse(fanpage, senderPsid, lastUserMessage, config, mediaImages = [], hasPhoneNumber = false) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        try {
            const convData = await this.chatService.getConversation(fanpage._id.toString(), senderPsid);
            const recentMessages = convData.messages.slice(0, 10).reverse();
            const customerIntent = this.analyzeCustomerIntent(lastUserMessage, recentMessages);
            let systemPrompt = `Bạn là trợ lý bán hàng AI của fanpage "${fanpage.name}". `;
            if (fanpage.description)
                systemPrompt += `Thông tin mô tả/lĩnh vực & sản phẩm: ${fanpage.description.slice(0, 1200)}. `;
            if (Array.isArray(mediaImages) && mediaImages.length) {
                systemPrompt += `\n\nẢNH THAM CHIẾU LIÊN QUAN: ${mediaImages.slice(0, 3).join(', ')}\n`;
            }
            systemPrompt += `\nCHIẾN LƯỢC BÁN HÀNG:\n`;
            if (customerIntent.isHighIntent) {
                systemPrompt += `- Khách có ý định cao: tập trung chốt đơn và xin số điện thoại ngay.\n`;
                systemPrompt += `- Tạo cảm giác cấp bách hợp lý (hàng bán chạy, nên đặt sớm).\n`;
            }
            else if (customerIntent.isPriceInquiry) {
                systemPrompt += `- Khách hỏi giá: báo giá rõ ràng, kèm ưu đãi (nếu có), rồi xin số điện thoại để tư vấn chi tiết.\n`;
            }
            else if (customerIntent.isHesitant) {
                systemPrompt += `- Khách do dự: đưa bằng chứng tin cậy (đánh giá, bảo hành, cam kết), và xin số điện thoại để giải đáp nhanh.\n`;
            }
            else {
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
            }
            else {
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
            }
            else if (customerIntent.isPriceInquiry) {
                systemPrompt += `- "Giá hiện tại là ... Nếu bạn cho shop số điện thoại, shop sẽ tư vấn chi tiết và giữ ưu đãi cho bạn."\n`;
            }
            else {
                systemPrompt += `- "Để shop tư vấn phù hợp nhất, bạn cho số điện thoại được không?"\n`;
                systemPrompt += `- "Shop sẽ gọi báo giá chi tiết, bạn để lại số điện thoại giúp shop nhé."\n`;
            }
            systemPrompt += `\nLƯU Ý: Luôn kết thúc bằng call-to-action rõ ràng (xin SĐT hoặc chốt đơn)!`;
            const promptMessages = [
                { role: 'system', content: systemPrompt },
                ...recentMessages.map((m) => ({ role: m.direction === 'in' ? 'user' : 'assistant', content: m.content })),
                { role: 'user', content: lastUserMessage },
            ];
            const model = config.model || 'gpt-4o-mini';
            const response = await (0, node_fetch_1.default)('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
                body: JSON.stringify({ model, messages: promptMessages, temperature: (_a = config.temperature) !== null && _a !== void 0 ? _a : 0.7, max_tokens: Math.min(160, config.maxTokens || 200) }),
            });
            const responseData = await response.json();
            if (!response.ok)
                throw new Error(((_b = responseData.error) === null || _b === void 0 ? void 0 : _b.message) || 'OpenAI API error');
            let aiText = (((_e = (_d = (_c = responseData.choices) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.message) === null || _e === void 0 ? void 0 : _e.content) || '').trim();
            if (this.isDebugMode) {
                this.logger.debug('Raw AI response:', aiText);
            }
            const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu;
            aiText = aiText.replace(emojiRegex, '').replace(/\s{2,}/g, ' ').trim();
            if (!aiText || /^[.\s]*$/.test(aiText) || aiText.length < 3) {
                if (this.isDebugMode) {
                    this.logger.warn('AI response empty or invalid, using fallback. Original:', (_h = (_g = (_f = responseData.choices) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.message) === null || _h === void 0 ? void 0 : _h.content);
                }
                const fallback = fanpage.description ? `Shop đang hỗ trợ lĩnh vực: ${fanpage.description.slice(0, 180)}. Bạn cần tư vấn sản phẩm/dịch vụ nào? Cho shop xin số điện thoại để gọi tư vấn nhanh nhé.`
                    : 'Shop đang sẵn sàng hỗ trợ. Bạn cần tư vấn sản phẩm/dịch vụ nào? Cho shop xin số điện thoại để gọi tư vấn nhanh nhé.';
                aiText = fallback;
            }
            if (this.isDebugMode) {
                this.logger.debug('Final AI response:', aiText);
            }
            return aiText || null;
        }
        catch (error) {
            if (this.isDebugMode)
                this.logger.error('AI response generation failed', error.message);
            return null;
        }
    }
    async sendFacebookMessage(fanpage, senderPsid, message, aiModel, images) {
        var _a;
        try {
            const sanitized = (message || '')
                .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
                .replace(/\s{2,}/g, ' ')
                .trim();
            const FB_ENABLED = process.env.FB_SENDING_ENABLED === '1';
            const PUBLIC_ORIGIN = process.env.MEDIA_ABSOLUTE_BASE || process.env.PUBLIC_ORIGIN || process.env.APP_PUBLIC_ORIGIN || '';
            if (this.isDebugMode) {
                this.logger.debug(`[FB Send] FB_ENABLED=${FB_ENABLED}, PUBLIC_ORIGIN=${PUBLIC_ORIGIN}, fanpage.accessToken=${!!(fanpage === null || fanpage === void 0 ? void 0 : fanpage.accessToken)}`);
            }
            let within24h = false;
            try {
                const convData = await this.chatService.getConversation(String(fanpage._id || fanpage.id || ''), senderPsid).catch(() => null);
                const latestInbound = (_a = convData === null || convData === void 0 ? void 0 : convData.messages) === null || _a === void 0 ? void 0 : _a.find((m) => (m === null || m === void 0 ? void 0 : m.direction) === 'in');
                const lastInboundAtMs = latestInbound ? new Date(latestInbound.createdAt || latestInbound.receivedAt || Date.now()).getTime() : 0;
                within24h = lastInboundAtMs > 0 ? (Date.now() - lastInboundAtMs) < (24 * 60 * 60 * 1000) : false;
                if (this.isDebugMode) {
                    this.logger.debug(`[FB Send] 24h check: lastInboundAtMs=${lastInboundAtMs}, within24h=${within24h}, hoursAgo=${lastInboundAtMs > 0 ? ((Date.now() - lastInboundAtMs) / (1000 * 60 * 60)).toFixed(2) : 'N/A'}`);
                }
            }
            catch (e) {
                within24h = false;
                if (this.isDebugMode) {
                    this.logger.error('[FB Send] Error checking 24h window:', e.message);
                }
            }
            const ensureAbsolute = (url) => {
                if (!url)
                    return url;
                if (/^https?:\/\//i.test(url))
                    return url;
                if (!PUBLIC_ORIGIN)
                    return url;
                return (PUBLIC_ORIGIN.replace(/\/$/, '') + url).replace(/\s/g, '');
            };
            let responseData = { ok: false, message: 'skip' };
            let deliveryNote = null;
            if (FB_ENABLED && (fanpage === null || fanpage === void 0 ? void 0 : fanpage.accessToken)) {
                try {
                    if (!within24h) {
                        responseData = { ok: false, message: 'blocked_outside_24h', note: 'Skipping Graph send for AI auto-reply (outside 24h window).' };
                        deliveryNote = 'Bị chặn do quá 24h kể từ tin nhắn cuối của khách (Messenger 24h window).';
                        if (this.isDebugMode)
                            this.logger.warn(`[AI Send] Blocked: outside 24h window. fanpageId=${fanpage._id} senderPsid=${senderPsid}`);
                    }
                    else {
                        if (this.isDebugMode) {
                            this.logger.debug(`[FB Send] Sending text message: "${sanitized.slice(0, 100)}..."`);
                        }
                        const payload = {
                            recipient: { id: senderPsid },
                            messaging_type: 'RESPONSE',
                            message: { text: sanitized }
                        };
                        const textRes = await (0, node_fetch_1.default)(`https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(fanpage.accessToken)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                        }).then(r => r.json()).catch(e => ({ ok: false, error: (e === null || e === void 0 ? void 0 : e.message) || String(e) }));
                        if (this.isDebugMode) {
                            this.logger.debug(`[FB Send] Graph API response:`, JSON.stringify(textRes, null, 2));
                        }
                        responseData = { text: textRes };
                        if (textRes.message_id) {
                            if (this.isDebugMode) {
                                this.logger.log(`[FB Send] SUCCESS: Message sent with ID ${textRes.message_id}`);
                            }
                            deliveryNote = null;
                        }
                        else if (textRes.error) {
                            this.logger.error(`[FB Send] FAILED: ${JSON.stringify(textRes.error)}`);
                            const err = textRes.error || {};
                            deliveryNote = `Gửi FB thất bại: code ${err.code || '?'} subcode ${err.error_subcode || '?'} - ${err.message || 'Không rõ lỗi'}`;
                        }
                    }
                    if (within24h && Array.isArray(images) && images.length && PUBLIC_ORIGIN) {
                        const imgPayloads = images.map(u => ensureAbsolute(u)).filter(u => /^https?:\/\//i.test(u));
                        for (const imgUrl of imgPayloads) {
                            const imgRes = await (0, node_fetch_1.default)(`https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(fanpage.accessToken)}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    recipient: { id: senderPsid },
                                    messaging_type: 'RESPONSE',
                                    message: {
                                        attachment: { type: 'image', payload: { is_reusable: true, url: imgUrl } }
                                    }
                                }),
                            }).then(r => r.json()).catch(e => ({ ok: false, error: (e === null || e === void 0 ? void 0 : e.message) || String(e) }));
                            await this.chatService.create({
                                fanpageId: fanpage._id.toString(),
                                senderPsid,
                                content: imgUrl,
                                messageType: 'image',
                                direction: 'out',
                                isAI: true,
                                aiModelUsed: aiModel,
                                raw: { fb: imgRes },
                                receivedAt: new Date(),
                                awaitingHuman: false,
                            });
                        }
                    }
                }
                catch (err) {
                    if (this.isDebugMode)
                        this.logger.error('Graph send failed', err.message);
                    deliveryNote = `Lỗi gửi tới Facebook: ${(err === null || err === void 0 ? void 0 : err.message) || String(err)}`;
                }
            }
            else {
                if (!FB_ENABLED)
                    deliveryNote = 'FB_SENDING_ENABLED=0 (đang tắt gửi ra Facebook).';
                else if (!(fanpage === null || fanpage === void 0 ? void 0 : fanpage.accessToken))
                    deliveryNote = 'Thiếu Access Token của fanpage.';
            }
            await this.chatService.create({
                fanpageId: fanpage._id.toString(),
                senderPsid,
                content: sanitized,
                direction: 'out',
                isAI: true,
                aiModelUsed: aiModel,
                raw: responseData,
                receivedAt: new Date(),
                awaitingHuman: false,
            });
            if (deliveryNote) {
                try {
                    await this.chatService.create({
                        fanpageId: fanpage._id.toString(),
                        senderPsid,
                        content: `[KHÔNG GỬI RA FB] ${deliveryNote}`,
                        direction: 'system',
                        isAI: false,
                        raw: { note: deliveryNote },
                        receivedAt: new Date(),
                        awaitingHuman: false,
                    });
                }
                catch (e) {
                    if (this.isDebugMode)
                        this.logger.warn('Failed to record non-delivery note: ' + (e === null || e === void 0 ? void 0 : e.message));
                }
            }
            return true;
        }
        catch (error) {
            if (this.isDebugMode)
                this.logger.error('Facebook message send failed', error.message);
            return false;
        }
    }
    analyzeCustomerIntent(message, recentMessages) {
        const msgLower = message.toLowerCase();
        const allMessages = recentMessages.map((m) => m.content.toLowerCase()).join(' ');
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
};
exports.MessengerWebhookService = MessengerWebhookService;
exports.MessengerWebhookService = MessengerWebhookService = MessengerWebhookService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, mongoose_1.InjectModel)(fanpage_schema_1.Fanpage.name)),
    __metadata("design:paramtypes", [chat_message_service_1.ChatMessageService,
        mongoose_2.Model,
        openai_config_service_1.OpenAIConfigService,
        vision_ai_service_1.VisionAIService,
        product_service_1.ProductService,
        media_service_1.MediaService,
        chat_events_service_1.ChatEventsService])
], MessengerWebhookService);
//# sourceMappingURL=messenger-webhook.service.js.map