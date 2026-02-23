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
exports.ChatMessageService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const chat_message_schema_1 = require("./schemas/chat-message.schema");
const conversation_schema_1 = require("./schemas/conversation.schema");
let ChatMessageService = class ChatMessageService {
    constructor(model, convModel) {
        this.model = model;
        this.convModel = convModel;
    }
    async create(dto) {
        const payload = Object.assign({}, dto);
        if (dto.receivedAt)
            payload.receivedAt = new Date(dto.receivedAt);
        const doc = await new this.model(payload).save();
        await this.upsertConversationForMessage(doc);
        return doc;
    }
    async upsertConversationForMessage(msg) {
        const base = { fanpageId: msg.fanpageId, senderPsid: msg.senderPsid };
        const inc = { totalMessages: 1 };
        if (msg.direction === 'in')
            inc.inboundCount = 1;
        else
            inc.outboundCount = 1;
        if (msg.awaitingHuman)
            inc.awaitingCount = 1;
        const createdAt = msg.createdAt || msg.receivedAt || new Date();
        const set = { lastMessageSnippet: (msg.content || '').slice(0, 120), lastDirection: msg.direction, lastMessageAt: createdAt };
        if (msg.adGroupId)
            set.lastAdGroupId = msg.adGroupId;
        if (msg.awaitingHuman)
            set.hasAwaitingHuman = true, set.needsHuman = true, set.firstAwaitingAt = set.firstAwaitingAt || new Date();
        await this.convModel.updateOne(base, { $setOnInsert: Object.assign(Object.assign({}, base), { autoAiEnabled: true }), $inc: inc, $set: set }, { upsert: true }).exec();
    }
    async recomputeConversation(fanpageId, senderPsid) {
        const msgs = await this.model.find({ fanpageId, senderPsid }).sort({ createdAt: 1 }).lean();
        if (!msgs.length) {
            await this.convModel.deleteOne({ fanpageId, senderPsid }).exec();
            return;
        }
        let inbound = 0, outbound = 0, awaiting = 0;
        let firstAwait;
        let lastMsg = msgs[msgs.length - 1];
        let lastAdGroupId;
        for (const m of msgs) {
            if (m.direction === 'in')
                inbound++;
            else
                outbound++;
            if (m.awaitingHuman) {
                awaiting++;
                if (!firstAwait)
                    firstAwait = m.createdAt || m.receivedAt;
            }
            if (m.adGroupId)
                lastAdGroupId = m.adGroupId;
        }
        const lastCreatedAt = lastMsg.createdAt || lastMsg.receivedAt || new Date();
        await this.convModel.updateOne({ fanpageId, senderPsid }, {
            $set: {
                lastMessageSnippet: (lastMsg.content || '').slice(0, 120),
                lastDirection: lastMsg.direction,
                lastMessageAt: lastCreatedAt,
                totalMessages: msgs.length,
                inboundCount: inbound,
                outboundCount: outbound,
                awaitingCount: awaiting,
                hasAwaitingHuman: awaiting > 0,
                needsHuman: awaiting > 0,
                firstAwaitingAt: firstAwait || null,
                lastAdGroupId: lastAdGroupId || null,
            },
        }, { upsert: true }).exec();
    }
    async listConversations(query = {}) {
        const filter = {};
        if (query.fanpageId)
            filter.fanpageId = query.fanpageId;
        if (query.senderPsid)
            filter.senderPsid = query.senderPsid;
        if (query.orderPhone)
            filter.orderPhone = query.orderPhone;
        if (query.orderCustomerName) {
            filter.$text = { $search: query.orderCustomerName };
        }
        if (query.needsHuman === 'true')
            filter.needsHuman = true;
        if (query.needsHuman === 'false')
            filter.needsHuman = false;
        if (query.archived === 'true')
            filter.archived = true;
        if (query.archived === 'false')
            filter.archived = false;
        const page = Math.max(1, parseInt(query.page) || 1);
        const limit = Math.min(100, parseInt(query.limit) || 20);
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.convModel.find(filter).populate('fanpageId', 'pageId name').sort({ lastMessageAt: -1 }).skip(skip).limit(limit).lean(),
            this.convModel.countDocuments(filter),
        ]);
        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    async getConversation(fanpageId, senderPsid) {
        let conv = await this.convModel.findOne({ fanpageId, senderPsid }).lean();
        const messages = await this.model.find({ fanpageId, senderPsid }).sort({ createdAt: -1 }).limit(500).lean();
        if (!conv && messages.length > 0) {
            await this.recomputeConversation(fanpageId, senderPsid);
            conv = await this.convModel.findOne({ fanpageId, senderPsid }).lean();
        }
        if (!conv) {
            const newConv = {
                fanpageId,
                senderPsid,
                totalMessages: 0,
                inboundCount: 0,
                outboundCount: 0,
                awaitingCount: 0,
                autoAiEnabled: true,
                needsHuman: false,
                hasAwaitingHuman: false,
            };
            await this.convModel.create(newConv);
            conv = await this.convModel.findOne({ fanpageId, senderPsid }).lean();
        }
        return { conversation: conv, messages };
    }
    async resolveConversation(fanpageId, senderPsid) {
        await this.model.updateMany({ fanpageId, senderPsid, awaitingHuman: true }, { $set: { awaitingHuman: false } }).exec();
        const now = new Date();
        await this.convModel.updateOne({ fanpageId, senderPsid }, { $set: { awaitingCount: 0, hasAwaitingHuman: false, needsHuman: false, lastResolvedAt: now } }).exec();
        return this.getConversation(fanpageId, senderPsid);
    }
    async toggleAutoAI(fanpageId, senderPsid, enabled) {
        const res = await this.convModel.findOneAndUpdate({ fanpageId, senderPsid }, { $set: { autoAiEnabled: enabled } }, { new: true });
        if (!res)
            throw new common_1.NotFoundException('Conversation không tồn tại');
        return { fanpageId, senderPsid, autoAiEnabled: res.autoAiEnabled };
    }
    async extractOrderDraft(fanpageId, senderPsid) {
        const messages = await this.model.find({ fanpageId, senderPsid }).sort({ createdAt: 1 }).lean();
        if (!messages.length)
            throw new common_1.NotFoundException('Không có tin nhắn để trích xuất');
        const textAll = messages.map(m => m.content).join('\n');
        const phoneRegex = /(0|\+84)(3|5|7|8|9)\d{8}/g;
        const phones = Array.from(new Set((textAll.match(phoneRegex) || [])));
        const qtyRegex = /(số lượng|sl|lấy|mua|x)\s*(\d{1,4})/gi;
        let quantity;
        let m;
        while ((m = qtyRegex.exec(textAll))) {
            const v = parseInt(m[2]);
            if (!quantity || v > quantity)
                quantity = v;
        }
        const addressRegex = /(địa chỉ|add(?:ress)?)[^\n:]*[:\-]?\s*([^\n]{10,120})/i;
        const addrMatch = textAll.match(addressRegex);
        const address = addrMatch ? addrMatch[2].trim() : undefined;
        let adGroupId;
        for (const m of messages) {
            if (m.adGroupId)
                adGroupId = m.adGroupId;
        }
        let customerName;
        const firstInbound = messages.find(m => m.direction === 'in');
        if (firstInbound) {
            const nameRegex = /(em tên|mình tên|tôi tên|anh tên|chị tên)\s+([A-Za-zÀ-ỹĐđ\s]{2,40})/i;
            const nm = firstInbound.content.match(nameRegex);
            if (nm)
                customerName = nm[2].trim();
        }
        if (!customerName)
            customerName = 'Khách FB ' + senderPsid.slice(-4);
        return {
            suggestions: {
                customerName,
                phone: phones[0],
                address,
                quantity,
                adGroupId,
            },
            confidence: {
                phone: phones[0] ? 0.9 : 0,
                address: address ? 0.6 : 0,
                quantity: quantity ? 0.5 : 0,
                adGroupId: adGroupId ? 0.8 : 0,
                customerName: customerName ? 0.4 : 0,
            },
            rawMatches: { phones, addressCandidate: address }
        };
    }
    async recordOutboundMessage(params) {
        const doc = await new this.model({
            fanpageId: params.fanpageId,
            senderPsid: params.senderPsid,
            content: params.text,
            direction: 'out',
            awaitingHuman: false,
            raw: params.rawResponse,
            receivedAt: new Date(),
        }).save();
        await this.upsertConversationForMessage(doc);
        await this.model.updateMany({ fanpageId: params.fanpageId, senderPsid: params.senderPsid, awaitingHuman: true }, { $set: { awaitingHuman: false } }).exec();
        await this.recomputeConversation(params.fanpageId, params.senderPsid);
        return doc;
    }
    async update(id, updateDto) {
        const doc = await this.model.findByIdAndUpdate(id, updateDto, { new: true }).exec();
        if (!doc) {
            throw new common_1.NotFoundException(`Chat message with ID ${id} not found`);
        }
        return doc;
    }
    async recordOutboundImage(params) {
        const doc = await new this.model({
            fanpageId: params.fanpageId,
            senderPsid: params.senderPsid,
            content: params.imageUrl,
            messageType: 'image',
            direction: 'out',
            awaitingHuman: false,
            raw: params.rawResponse,
            receivedAt: new Date(),
        }).save();
        await this.upsertConversationForMessage(doc);
        await this.model.updateMany({ fanpageId: params.fanpageId, senderPsid: params.senderPsid, awaitingHuman: true }, { $set: { awaitingHuman: false } }).exec();
        await this.recomputeConversation(params.fanpageId, params.senderPsid);
        return doc;
    }
};
exports.ChatMessageService = ChatMessageService;
exports.ChatMessageService = ChatMessageService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(chat_message_schema_1.ChatMessage.name)),
    __param(1, (0, mongoose_1.InjectModel)(conversation_schema_1.Conversation.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], ChatMessageService);
//# sourceMappingURL=chat-message.service.js.map