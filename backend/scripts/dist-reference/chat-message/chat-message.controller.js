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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessageController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const chat_message_service_1 = require("./chat-message.service");
const auth_guard_1 = require("../auth/guards/auth.guard");
const auth_decorator_1 = require("../auth/decorators/auth.decorator");
const mongoose_1 = require("@nestjs/mongoose");
const fanpage_schema_1 = require("../fanpage/schemas/fanpage.schema");
const product_service_1 = require("../product/product.service");
const media_service_1 = require("../media/media.service");
const openai_config_service_1 = require("../openai-config/openai-config.service");
const mongoose_2 = require("mongoose");
const operators_1 = require("rxjs/operators");
const chat_events_service_1 = require("./chat-events.service");
let ChatMessageController = class ChatMessageController {
    constructor(service, fanpageModel, productService, openAIService, mediaService, chatEvents) {
        this.service = service;
        this.fanpageModel = fanpageModel;
        this.productService = productService;
        this.openAIService = openAIService;
        this.mediaService = mediaService;
        this.chatEvents = chatEvents;
    }
    conversations(q) { return this.service.listConversations(q || {}); }
    conversation(fanpageId, senderPsid) { return this.service.getConversation(fanpageId, senderPsid); }
    resolve(fanpageId, senderPsid) { return this.service.resolveConversation(fanpageId, senderPsid); }
    toggleAutoAi(fanpageId, senderPsid, body) { return this.service.toggleAutoAI(fanpageId, senderPsid, body.enabled); }
    extract(fanpageId, senderPsid) { return this.service.extractOrderDraft(fanpageId, senderPsid); }
    events() {
        return this.chatEvents.stream().pipe((0, operators_1.map)((e) => ({ data: e })));
    }
    async sendMessage(body) {
        var _a;
        console.log('🔍 SendMessage request body:', JSON.stringify(body, null, 2));
        const messageText = body.text || body.content;
        if (!body.fanpageId || !body.senderPsid || !messageText) {
            console.log('❌ Validation failed:', { fanpageId: !!body.fanpageId, senderPsid: !!body.senderPsid, messageText: !!messageText });
            throw new common_1.BadRequestException('Thiếu fanpageId / senderPsid / text hoặc content');
        }
        let fanpage = await this.fanpageModel.findById(body.fanpageId).lean();
        if (!fanpage) {
            fanpage = await this.fanpageModel.findOne({ pageId: body.fanpageId }).lean();
        }
        if (!fanpage) {
            console.log('❌ Fanpage not found:', { fanpageId: body.fanpageId });
            throw new common_1.BadRequestException('Fanpage không tồn tại (fanpageId có thể là _id hoặc pageId)');
        }
        console.log('✅ Fanpage found:', { _id: fanpage._id, pageId: fanpage.pageId, name: fanpage.name });
        const convData = await this.service.getConversation(fanpage._id.toString(), body.senderPsid).catch(() => null);
        const latestInbound = (_a = convData === null || convData === void 0 ? void 0 : convData.messages) === null || _a === void 0 ? void 0 : _a.find((m) => (m === null || m === void 0 ? void 0 : m.direction) === 'in');
        const lastInboundAtMs = latestInbound ? new Date(latestInbound.createdAt || latestInbound.receivedAt || Date.now()).getTime() : 0;
        const within24h = lastInboundAtMs > 0 ? (Date.now() - lastInboundAtMs) < (24 * 60 * 60 * 1000) : false;
        const allowedTags = new Set(['ACCOUNT_UPDATE', 'CONFIRMED_EVENT_UPDATE', 'POST_PURCHASE_UPDATE']);
        let messagingType = body.messagingType || 'RESPONSE';
        let tag = body.tag;
        if (!within24h) {
            const canTag = body.allowTaggedFallback && messagingType === 'MESSAGE_TAG' && tag && allowedTags.has(tag);
            if (!canTag) {
                console.warn('[Messenger] Blocked send: outside 24h, no valid MESSAGE_TAG. fanpageId=%s senderPsid=%s', fanpage._id, body.senderPsid);
                throw new common_1.BadRequestException('Hết cửa sổ 24h của Messenger. Vui lòng yêu cầu khách nhắn lại một tin hoặc gửi theo MESSAGE_TAG hợp lệ (ACCOUNT_UPDATE/POST_PURCHASE_UPDATE/CONFIRMED_EVENT_UPDATE).');
            }
        }
        if (messagingType === 'MESSAGE_TAG') {
            if (!tag || !allowedTags.has(tag)) {
                throw new common_1.BadRequestException('Thiếu hoặc tag không hợp lệ. Tag hợp lệ: ACCOUNT_UPDATE, POST_PURCHASE_UPDATE, CONFIRMED_EVENT_UPDATE');
            }
        }
        else {
            if (!within24h) {
                console.warn('[Messenger] Blocked RESPONSE send outside 24h. fanpageId=%s senderPsid=%s', fanpage._id, body.senderPsid);
                throw new common_1.BadRequestException('Hết cửa sổ 24h của Messenger. Không thể gửi với messaging_type=RESPONSE.');
            }
        }
        let responseJson = { ok: false, message: 'fb_sending_disabled' };
        let deliveryNote = null;
        const FB_ENABLED = process.env.FB_SENDING_ENABLED === '1';
        if (FB_ENABLED && fanpage.accessToken) {
            try {
                const payload = {
                    recipient: { id: body.senderPsid },
                    messaging_type: (messagingType === 'MESSAGE_TAG') ? 'MESSAGE_TAG' : 'RESPONSE',
                    message: { text: messageText }
                };
                if (messagingType === 'MESSAGE_TAG' && tag)
                    payload.tag = tag;
                const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(fanpage.accessToken)}`;
                const fbRes = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                    .then(r => r.json()).catch(e => ({ ok: false, error: ((e === null || e === void 0 ? void 0 : e.message) || String(e)) }));
                responseJson = fbRes;
                if (!(fbRes === null || fbRes === void 0 ? void 0 : fbRes.message_id)) {
                    const err = (fbRes === null || fbRes === void 0 ? void 0 : fbRes.error) || {};
                    deliveryNote = `Gửi FB thất bại: code ${err.code || '?'} subcode ${err.error_subcode || '?'} - ${err.message || 'Không rõ lỗi'}`;
                }
            }
            catch (err) {
                responseJson = { ok: false, error: (err === null || err === void 0 ? void 0 : err.message) || String(err) };
                deliveryNote = `Lỗi gửi tới Facebook: ${responseJson.error}`;
            }
        }
        else {
            if (!FB_ENABLED)
                deliveryNote = 'FB_SENDING_ENABLED=0 (đang tắt gửi ra Facebook).';
            else if (!fanpage.accessToken)
                deliveryNote = 'Thiếu Access Token của fanpage.';
        }
        const saved = await this.service.recordOutboundMessage({ fanpageId: fanpage._id.toString(), senderPsid: body.senderPsid, text: messageText, rawResponse: responseJson });
        if (deliveryNote) {
            try {
                await this.service.create({
                    fanpageId: fanpage._id.toString(),
                    senderPsid: body.senderPsid,
                    content: `[KHÔNG GỬI RA FB] ${deliveryNote}`,
                    direction: 'system',
                    awaitingHuman: false,
                    receivedAt: new Date(),
                    raw: { note: deliveryNote }
                });
            }
            catch (_b) { }
        }
        this.chatEvents.emit({ type: 'new-message', fanpageId: String(fanpage._id), senderPsid: body.senderPsid, direction: 'out', snippet: messageText.slice(0, 120), createdAt: new Date() });
        return { message: 'Đã gửi', fb: responseJson, saved };
    }
    async sendAiMessage(body) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        if (!body.fanpageId || !body.senderPsid)
            throw new common_1.BadRequestException('Thiếu fanpageId / senderPsid');
        const conv = await this.service.getConversation(body.fanpageId, body.senderPsid).catch(() => null);
        const recent = (conv === null || conv === void 0 ? void 0 : conv.messages.slice(0, 10).reverse()) || [];
        let fanpage = await this.fanpageModel.findById(body.fanpageId).lean();
        if (!fanpage)
            fanpage = await this.fanpageModel.findOne({ pageId: body.fanpageId }).lean();
        let config = null;
        if (fanpage === null || fanpage === void 0 ? void 0 : fanpage.openAIConfigId) {
            try {
                config = await this.openAIService.findOne(fanpage.openAIConfigId.toString());
            }
            catch (error) {
                console.warn('Config not found for fanpage:', fanpage.openAIConfigId);
            }
        }
        if (!config)
            config = await this.openAIService.pickConfig({ fanpageId: body.fanpageId });
        if (!config)
            throw new common_1.BadRequestException('Chưa có cấu hình OpenAI khả dụng');
        if (!config.apiKey)
            throw new common_1.BadRequestException('Config thiếu apiKey');
        const stripEmojis = (text) => {
            const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu;
            return (text || '').replace(emojiRegex, '').replace(/\s{2,}/g, ' ').trim();
        };
        const formatVnd = (n) => {
            if (typeof n !== 'number' || isNaN(n))
                return undefined;
            return n.toLocaleString('vi-VN');
        };
        const lastInbound = (_a = conv === null || conv === void 0 ? void 0 : conv.messages) === null || _a === void 0 ? void 0 : _a.find((m) => m.direction === 'in');
        let immediateHandled = false;
        if (lastInbound && typeof lastInbound.content === 'string' && lastInbound.content.trim().length > 0) {
            const raw = lastInbound.content.trim();
            const keywords = raw.split(/[^A-Za-zÀ-ỹĐđ0-9]+/).filter(w => w && w.length >= 2).slice(0, 6);
            if (keywords.length) {
                const initial = await this.productService.findAll({ search: keywords[0] });
                const products = (initial || []).filter((p) => {
                    const name = ((p === null || p === void 0 ? void 0 : p.name) || '').toLowerCase();
                    return keywords.some(k => name.includes(k.toLowerCase()));
                }).slice(0, 3);
                if (products === null || products === void 0 ? void 0 : products.length) {
                    const p = products[0];
                    let price;
                    const fpVar = (p.fanpageVariations || []).find((v) => String(v.fanpageId) === String(fanpage === null || fanpage === void 0 ? void 0 : fanpage._id) && v.isActive !== false);
                    if ((fpVar === null || fpVar === void 0 ? void 0 : fpVar.customPrice) && typeof fpVar.customPrice === 'number') {
                        price = fpVar.customPrice;
                    }
                    const totalCost = p.totalCost;
                    const priceText = price ? `${formatVnd(price)}đ` : (typeof totalCost === 'number' ? `Chi phí đầu vào ước tính ~ ${formatVnd(totalCost)}đ (giá bán xác nhận theo thời điểm)` : 'Giá sẽ được xác nhận theo thời điểm');
                    const delivery = p.estimatedDeliveryDays || 0;
                    const deliveryText = delivery <= 0 ? 'giao trong ngày (nếu còn hàng)' : `dự kiến nhận hàng trong khoảng ${delivery} ngày`;
                    const notes = p.notes ? `\n- Ghi chú: ${p.notes}` : '';
                    const resource = p.resourceLink ? `\n- Tham khảo thêm: ${p.resourceLink}` : '';
                    let reply = `Anh/chị đang quan tâm: ${p.name}.\n- Giá hiện tại: ${priceText}.\n- Thời gian giao/nhận: ${deliveryText}.${notes}${resource}\n\nĐể tư vấn và chốt giá nhanh nhất, anh/chị cho em xin số điện thoại liên hệ được không ạ?`;
                    reply = stripEmojis(reply);
                    if (body.previewOnly) {
                        return { preview: reply, source: 'immediate-product', productId: String(p._id || '') };
                    }
                    const sendRes = await this.sendMessage({ fanpageId: body.fanpageId, senderPsid: body.senderPsid, text: reply });
                    try {
                        if ((_b = sendRes.saved) === null || _b === void 0 ? void 0 : _b._id) {
                            await this.service.update(sendRes.saved._id, { isAI: true, aiModelUsed: 'rule-based' });
                        }
                    }
                    catch (_) { }
                    immediateHandled = true;
                    return Object.assign(Object.assign({}, sendRes), { modelUsed: 'rule-based' });
                }
            }
        }
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
        }
        catch (_k) { }
        systemPrompt += `\n\nQUY TẮC TRẢ LỜI (BẮT BUỘC):\n- Tuyệt đối không dùng emoji, icon, ký tự trang trí. Chỉ văn bản thuần.\n- Nếu khách nêu sản phẩm đang quan tâm: trả lời ngay gồm (1) tên sản phẩm, (2) giá bán hiện tại nếu có; nếu chưa có thì ghi rõ sẽ xác nhận giá ngay sau khi nhận số điện thoại, (3) thời gian giao/nhận hàng dự kiến, (4) kết thúc bằng câu xin số điện thoại để tư vấn nhanh.\n- Nếu khách hỏi kỹ hơn (hồ sơ/giấy tờ/thủ tục/quy trình/đặt hàng/ảnh/catalogue): trình bày ngắn gọn bằng gạch đầu dòng về hồ sơ cần thiết, các bước đặt hàng, chính sách giao hàng/bảo hành; chèn link/ảnh nếu có; và vẫn kết thúc bằng câu xin số điện thoại.\n- Giọng điệu: chuyên nghiệp, rõ ràng, không vòng vo, không đùa cợt.\n`;
        const messagesForApi = [
            { role: 'system', content: systemPrompt },
            ...recent.reverse().map(m => ({ role: m.direction === 'in' ? 'user' : 'assistant', content: m.content }))
        ];
        const model = config.model || 'gpt-4o-mini';
        let aiText = '';
        try {
            const resp = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
                body: JSON.stringify({ model, messages: messagesForApi, temperature: (_c = config.temperature) !== null && _c !== void 0 ? _c : 0.7, max_tokens: config.maxTokens || 256 })
            });
            const json = await resp.json();
            if (!resp.ok)
                throw new Error(((_d = json.error) === null || _d === void 0 ? void 0 : _d.message) || 'OpenAI API lỗi');
            aiText = ((_h = (_g = (_f = (_e = json.choices) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.message) === null || _g === void 0 ? void 0 : _g.content) === null || _h === void 0 ? void 0 : _h.trim()) || '(Không có nội dung)';
            aiText = stripEmojis(aiText);
            if (body.previewOnly) {
                return { preview: aiText, model, configId: config._id };
            }
            const sendRes = await this.sendMessage({ fanpageId: body.fanpageId, senderPsid: body.senderPsid, text: aiText });
            try {
                if ((_j = sendRes.saved) === null || _j === void 0 ? void 0 : _j._id) {
                    await this.service.update(sendRes.saved._id, { isAI: true, aiModelUsed: model });
                }
            }
            catch (_) { }
            return Object.assign(Object.assign({}, sendRes), { modelUsed: model });
        }
        catch (e) {
            throw new common_1.BadRequestException(e.message || 'AI generate thất bại');
        }
    }
    async sendImage(fanpageId, senderPsid, file, alt) {
        var _a;
        if (!fanpageId || !senderPsid)
            throw new common_1.BadRequestException('Thiếu fanpageId/senderPsid');
        if (!file)
            throw new common_1.BadRequestException('Thiếu file ảnh');
        let fanpage = await this.fanpageModel.findById(fanpageId).lean();
        if (!fanpage)
            fanpage = await this.fanpageModel.findOne({ pageId: fanpageId }).lean();
        if (!fanpage)
            throw new common_1.BadRequestException('Fanpage không tồn tại');
        let buf = null;
        if (file.buffer) {
            buf = file.buffer;
        }
        else if (file.path) {
            buf = require('fs').readFileSync(file.path);
        }
        if (!buf)
            throw new common_1.BadRequestException('Không đọc được file');
        const savedMedia = await this.mediaService.saveBuffer(buf, {
            mime: file.mimetype,
            ext: (file.originalname.split('.').pop() || '').toLowerCase(),
            fanpageId: String(fanpage._id),
            alt: alt || file.originalname,
            sourceType: 'marketing'
        });
        const FB_ENABLED = process.env.FB_SENDING_ENABLED === '1';
        let sendResult = { ok: false, message: 'fb_sending_disabled' };
        try {
            if (FB_ENABLED && fanpage.accessToken) {
                const convData = await this.service.getConversation(String(fanpage._id), senderPsid).catch(() => null);
                const latestInbound = (_a = convData === null || convData === void 0 ? void 0 : convData.messages) === null || _a === void 0 ? void 0 : _a.find((m) => (m === null || m === void 0 ? void 0 : m.direction) === 'in');
                const lastInboundAtMs = latestInbound ? new Date(latestInbound.createdAt || latestInbound.receivedAt || Date.now()).getTime() : 0;
                const within24h = lastInboundAtMs > 0 ? (Date.now() - lastInboundAtMs) < (24 * 60 * 60 * 1000) : false;
                const PUBLIC_ORIGIN = process.env.MEDIA_ABSOLUTE_BASE || process.env.PUBLIC_ORIGIN || process.env.APP_PUBLIC_ORIGIN || '';
                const ensureAbsolute = (url) => {
                    if (!url)
                        return url;
                    if (/^https?:\/\//i.test(url))
                        return url;
                    if (!PUBLIC_ORIGIN)
                        return url;
                    return (PUBLIC_ORIGIN.replace(/\/$/, '') + url).replace(/\s/g, '');
                };
                const imgUrl = ensureAbsolute(savedMedia.url);
                if (within24h && /^https?:\/\//i.test(imgUrl)) {
                    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(fanpage.accessToken)}`;
                    const payload = {
                        recipient: { id: senderPsid },
                        messaging_type: 'RESPONSE',
                        message: { attachment: { type: 'image', payload: { is_reusable: true, url: imgUrl } } }
                    };
                    sendResult = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                        .then(r => r.json()).catch(e => ({ ok: false, error: (e === null || e === void 0 ? void 0 : e.message) || String(e) }));
                }
                else {
                    sendResult = { ok: false, message: within24h ? 'image_url_not_absolute' : 'blocked_outside_24h' };
                }
            }
        }
        catch (e) {
            sendResult = { ok: false, error: (e === null || e === void 0 ? void 0 : e.message) || String(e) };
        }
        const saved = await this.service.recordOutboundImage({ fanpageId: String(fanpage._id), senderPsid, imageUrl: savedMedia.url, rawResponse: sendResult });
        this.chatEvents.emit({ type: 'new-message', fanpageId: String(fanpage._id), senderPsid, direction: 'out', snippet: '[image]', createdAt: new Date() });
        return { message: 'Đã tải ảnh và ghi nhận tin nhắn', media: savedMedia, fb: sendResult, saved };
    }
    async sendImageByUrl(body) {
        var _a;
        if (!(body === null || body === void 0 ? void 0 : body.fanpageId) || !(body === null || body === void 0 ? void 0 : body.senderPsid) || !(body === null || body === void 0 ? void 0 : body.imageUrl)) {
            throw new common_1.BadRequestException('Thiếu fanpageId/senderPsid/imageUrl');
        }
        let fanpage = await this.fanpageModel.findById(body.fanpageId).lean();
        if (!fanpage)
            fanpage = await this.fanpageModel.findOne({ pageId: body.fanpageId }).lean();
        if (!fanpage)
            throw new common_1.BadRequestException('Fanpage không tồn tại');
        const FB_ENABLED = process.env.FB_SENDING_ENABLED === '1';
        let sendResult = { ok: false, message: 'fb_sending_disabled' };
        try {
            if (FB_ENABLED && fanpage.accessToken) {
                const convData = await this.service.getConversation(String(fanpage._id), body.senderPsid).catch(() => null);
                const latestInbound = (_a = convData === null || convData === void 0 ? void 0 : convData.messages) === null || _a === void 0 ? void 0 : _a.find((m) => (m === null || m === void 0 ? void 0 : m.direction) === 'in');
                const lastInboundAtMs = latestInbound ? new Date(latestInbound.createdAt || latestInbound.receivedAt || Date.now()).getTime() : 0;
                const within24h = lastInboundAtMs > 0 ? (Date.now() - lastInboundAtMs) < (24 * 60 * 60 * 1000) : false;
                const PUBLIC_ORIGIN = process.env.MEDIA_ABSOLUTE_BASE || process.env.PUBLIC_ORIGIN || process.env.APP_PUBLIC_ORIGIN || '';
                const ensureAbsolute = (url) => {
                    if (!url)
                        return url;
                    if (/^https?:\/\//i.test(url))
                        return url;
                    if (!PUBLIC_ORIGIN)
                        return url;
                    return (PUBLIC_ORIGIN.replace(/\/$/, '') + url).replace(/\s/g, '');
                };
                const imgUrl = ensureAbsolute(body.imageUrl);
                if (within24h && /^https?:\/\//i.test(imgUrl)) {
                    const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(fanpage.accessToken)}`;
                    const payload = {
                        recipient: { id: body.senderPsid },
                        messaging_type: 'RESPONSE',
                        message: { attachment: { type: 'image', payload: { is_reusable: true, url: imgUrl } } }
                    };
                    sendResult = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                        .then(r => r.json()).catch(e => ({ ok: false, error: (e === null || e === void 0 ? void 0 : e.message) || String(e) }));
                }
                else {
                    sendResult = { ok: false, message: within24h ? 'image_url_not_absolute' : 'blocked_outside_24h' };
                }
            }
        }
        catch (e) {
            sendResult = { ok: false, error: (e === null || e === void 0 ? void 0 : e.message) || String(e) };
        }
        const saved = await this.service.recordOutboundImage({ fanpageId: String(fanpage._id), senderPsid: body.senderPsid, imageUrl: body.imageUrl, rawResponse: sendResult });
        this.chatEvents.emit({ type: 'new-message', fanpageId: String(fanpage._id), senderPsid: body.senderPsid, direction: 'out', snippet: '[image]', createdAt: new Date() });
        return { message: 'Đã ghi nhận gửi ảnh từ media server', fb: sendResult, saved };
    }
};
exports.ChatMessageController = ChatMessageController;
__decorate([
    (0, common_1.Get)('conversations/list/all'),
    (0, auth_decorator_1.RequirePermissions)('chat-messages'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatMessageController.prototype, "conversations", null);
__decorate([
    (0, common_1.Get)('conversations/:fanpageId/:senderPsid'),
    (0, auth_decorator_1.RequirePermissions)('chat-messages'),
    __param(0, (0, common_1.Param)('fanpageId')),
    __param(1, (0, common_1.Param)('senderPsid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ChatMessageController.prototype, "conversation", null);
__decorate([
    (0, common_1.Patch)('conversations/:fanpageId/:senderPsid/resolve'),
    (0, auth_decorator_1.RequirePermissions)('chat-messages'),
    __param(0, (0, common_1.Param)('fanpageId')),
    __param(1, (0, common_1.Param)('senderPsid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ChatMessageController.prototype, "resolve", null);
__decorate([
    (0, common_1.Patch)('conversations/:fanpageId/:senderPsid/auto-ai'),
    (0, auth_decorator_1.RequirePermissions)('chat-messages'),
    __param(0, (0, common_1.Param)('fanpageId')),
    __param(1, (0, common_1.Param)('senderPsid')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], ChatMessageController.prototype, "toggleAutoAi", null);
__decorate([
    (0, common_1.Get)('conversations/:fanpageId/:senderPsid/extract-order'),
    (0, auth_decorator_1.RequirePermissions)('chat-messages'),
    __param(0, (0, common_1.Param)('fanpageId')),
    __param(1, (0, common_1.Param)('senderPsid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ChatMessageController.prototype, "extract", null);
__decorate([
    (0, common_1.Get)('events'),
    (0, common_1.Sse)(),
    (0, auth_decorator_1.RequirePermissions)('chat-messages'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], ChatMessageController.prototype, "events", null);
__decorate([
    (0, common_1.Post)('send'),
    (0, auth_decorator_1.RequirePermissions)('chat-messages'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatMessageController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)('send/ai'),
    (0, auth_decorator_1.RequirePermissions)('chat-messages'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatMessageController.prototype, "sendAiMessage", null);
__decorate([
    (0, common_1.Post)('send/image/:fanpageId/:senderPsid'),
    (0, auth_decorator_1.RequirePermissions)('chat-messages'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Param)('fanpageId')),
    __param(1, (0, common_1.Param)('senderPsid')),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Body)('alt')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, String]),
    __metadata("design:returntype", Promise)
], ChatMessageController.prototype, "sendImage", null);
__decorate([
    (0, common_1.Post)('send/image/url'),
    (0, auth_decorator_1.RequirePermissions)('chat-messages'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatMessageController.prototype, "sendImageByUrl", null);
exports.ChatMessageController = ChatMessageController = __decorate([
    (0, common_1.Controller)('chat-messages'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, auth_guard_1.RolesGuard),
    __param(1, (0, mongoose_1.InjectModel)(fanpage_schema_1.Fanpage.name)),
    __metadata("design:paramtypes", [chat_message_service_1.ChatMessageService,
        mongoose_2.Model,
        product_service_1.ProductService,
        openai_config_service_1.OpenAIConfigService,
        media_service_1.MediaService,
        chat_events_service_1.ChatEventsService])
], ChatMessageController);
//# sourceMappingURL=chat-message.controller.js.map