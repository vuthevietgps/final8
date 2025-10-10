import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { UpdateChatMessageDto } from './dto/update-chat-message.dto';

@Injectable()
export class ChatMessageService {
  constructor(
    @InjectModel(ChatMessage.name) private model: Model<ChatMessageDocument>,
    @InjectModel(Conversation.name) private convModel: Model<ConversationDocument>,
  ) {}

  async create(dto: CreateChatMessageDto) {
    const payload: any = { ...dto };
    if (dto.receivedAt) payload.receivedAt = new Date(dto.receivedAt);
    const doc = await new this.model(payload).save();
    await this.upsertConversationForMessage(doc);
    return doc;
  }

  // Individual message CRUD methods removed
  // Messages are now append-only via webhook/send operations
  // Use conversation-level operations for management

  // --- Conversation helpers ---
  private async upsertConversationForMessage(msg: ChatMessageDocument) {
    const base = { fanpageId: msg.fanpageId, senderPsid: msg.senderPsid } as any;
    const inc: any = { totalMessages: 1 };
    if (msg.direction === 'in') inc.inboundCount = 1; else inc.outboundCount = 1;
    if (msg.awaitingHuman) inc.awaitingCount = 1;
  const createdAt: Date = (msg as any).createdAt || (msg as any).receivedAt || new Date();
  const set: any = { lastMessageSnippet: (msg.content||'').slice(0,120), lastDirection: msg.direction, lastMessageAt: createdAt };
    if (msg.awaitingHuman) set.hasAwaitingHuman = true, set.needsHuman = true, set.firstAwaitingAt = set.firstAwaitingAt || new Date();
    await this.convModel.updateOne(base, { $setOnInsert: { ...base, autoAiEnabled: true }, $inc: inc, $set: set }, { upsert: true }).exec();
  }

  private async recomputeConversation(fanpageId: any, senderPsid: string) {
    const msgs = await this.model.find({ fanpageId, senderPsid }).sort({ createdAt: 1 }).lean();
    if (!msgs.length) {
      await this.convModel.deleteOne({ fanpageId, senderPsid }).exec();
      return;
    }
    let inbound = 0, outbound = 0, awaiting = 0; let firstAwait: Date | undefined; let lastMsg = msgs[msgs.length-1];
    let lastAdGroupId: string | undefined; // Find last message with adGroupId
    for (const m of msgs) {
      if (m.direction === 'in') inbound++; else outbound++;
      if (m.awaitingHuman) { awaiting++; if (!firstAwait) firstAwait = (m as any).createdAt || (m as any).receivedAt; }
      if (m.adGroupId && !lastAdGroupId) lastAdGroupId = m.adGroupId; // Get most recent adGroupId
    }
    const lastCreatedAt: Date = (lastMsg as any).createdAt || (lastMsg as any).receivedAt || new Date();
    await this.convModel.updateOne(
      { fanpageId, senderPsid },
      {
        $set: {
          lastMessageSnippet: (lastMsg.content||'').slice(0,120),
          lastDirection: lastMsg.direction,
          lastMessageAt: lastCreatedAt,
          totalMessages: msgs.length,
          inboundCount: inbound,
          outboundCount: outbound,
          awaitingCount: awaiting,
          hasAwaitingHuman: awaiting>0,
          needsHuman: awaiting>0,
          firstAwaitingAt: firstAwait || null,
          lastAdGroupId: lastAdGroupId || null,
        },
      },
      { upsert: true }
    ).exec();
  }

  async listConversations(query: any = {}) {
    const filter: any = {};
    if (query.fanpageId) filter.fanpageId = query.fanpageId;
    if (query.senderPsid) filter.senderPsid = query.senderPsid;
    if (query.orderPhone) filter.orderPhone = query.orderPhone;
    if (query.orderCustomerName) {
      // Use MongoDB text search on orderCustomerName (requires text index)
      filter.$text = { $search: query.orderCustomerName };
    }
    if (query.needsHuman === 'true') filter.needsHuman = true;
    if (query.needsHuman === 'false') filter.needsHuman = false;
    if (query.archived === 'true') filter.archived = true;
    if (query.archived === 'false') filter.archived = false;
    const page = Math.max(1, parseInt(query.page)||1);
    const limit = Math.min(100, parseInt(query.limit)||20);
    const skip = (page-1)*limit;
    const [items, total] = await Promise.all([
      this.convModel.find(filter).populate('fanpageId', 'pageId name').sort({ lastMessageAt: -1 }).skip(skip).limit(limit).lean(),
      this.convModel.countDocuments(filter),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total/limit) };
  }

  async getConversation(fanpageId: string, senderPsid: string) {
    let conv = await this.convModel.findOne({ fanpageId, senderPsid }).lean();
    const messages = await this.model.find({ fanpageId, senderPsid }).sort({ createdAt: -1 }).limit(500).lean();
    
    // Nếu chưa có conversation nhưng có messages, tạo conversation từ messages
    if (!conv && messages.length > 0) {
      await this.recomputeConversation(fanpageId, senderPsid);
      conv = await this.convModel.findOne({ fanpageId, senderPsid }).lean();
    }
    
    // Nếu vẫn không có conversation (không có messages), tạo conversation trống
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

  async resolveConversation(fanpageId: string, senderPsid: string) {
    // Set awaitingHuman false for all messages currently awaiting.
    await this.model.updateMany({ fanpageId, senderPsid, awaitingHuman: true }, { $set: { awaitingHuman: false } }).exec();
    const now = new Date();
    await this.convModel.updateOne({ fanpageId, senderPsid }, { $set: { awaitingCount: 0, hasAwaitingHuman: false, needsHuman: false, lastResolvedAt: now } }).exec();
    return this.getConversation(fanpageId, senderPsid);
  }

  async toggleAutoAI(fanpageId: string, senderPsid: string, enabled: boolean) {
    const res = await this.convModel.findOneAndUpdate({ fanpageId, senderPsid }, { $set: { autoAiEnabled: enabled } }, { new: true });
    if(!res) throw new NotFoundException('Conversation không tồn tại');
    return { fanpageId, senderPsid, autoAiEnabled: res.autoAiEnabled };
  }

  async extractOrderDraft(fanpageId: string, senderPsid: string) {
    const messages = await this.model.find({ fanpageId, senderPsid }).sort({ createdAt: 1 }).lean();
    if(!messages.length) throw new NotFoundException('Không có tin nhắn để trích xuất');
    const textAll = messages.map(m=> m.content).join('\n');
    // Simple regex heuristics
    const phoneRegex = /(0|\+84)(3|5|7|8|9)\d{8}/g;
    const phones = Array.from(new Set((textAll.match(phoneRegex)||[])));
    const qtyRegex = /(số lượng|sl|lấy|mua|x)\s*(\d{1,4})/gi;
    let quantity: number | undefined; let m;
    while((m = qtyRegex.exec(textAll))){ const v = parseInt(m[2]); if(!quantity || v>quantity) quantity=v; }
    const addressRegex = /(địa chỉ|add(?:ress)?)[^\n:]*[:\-]?\s*([^\n]{10,120})/i;
    const addrMatch = textAll.match(addressRegex);
    const address = addrMatch? addrMatch[2].trim(): undefined;
    // adGroupId: pick first message that has adGroupId field set
    const adGroupId = messages.find(m=> m.adGroupId)?.adGroupId;
    // naive customer name: if first inbound contains tên ...
    let customerName: string | undefined;
    const firstInbound = messages.find(m=> m.direction==='in');
    if(firstInbound){
      const nameRegex = /(em tên|mình tên|tôi tên|anh tên|chị tên)\s+([A-Za-zÀ-ỹĐđ\s]{2,40})/i;
      const nm = firstInbound.content.match(nameRegex);
      if(nm) customerName = nm[2].trim();
    }
    if(!customerName) customerName = 'Khách FB ' + senderPsid.slice(-4);
    return {
      suggestions: {
        customerName,
        phone: phones[0],
        address,
        quantity,
        adGroupId,
      },
      confidence: {
        phone: phones[0]?0.9:0,
        address: address?0.6:0,
        quantity: quantity?0.5:0,
        adGroupId: adGroupId?0.8:0,
        customerName: customerName?0.4:0,
      },
      rawMatches: { phones, addressCandidate: address }
    };
  }

  // --- Outbound send helper (fanpage access token lookup inject later via controller) ---
  async recordOutboundMessage(params: { fanpageId: string; senderPsid: string; text: string; rawResponse?: any; }) {
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
    // Clear awaiting flags on previous inbound messages for this conversation (simple heuristic v1)
    await this.model.updateMany({ fanpageId: params.fanpageId, senderPsid: params.senderPsid, awaitingHuman: true }, { $set: { awaitingHuman: false } }).exec();
    await this.recomputeConversation(params.fanpageId as any, params.senderPsid);
    return doc;
  }
}
