import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { Conversation, ConversationDocument } from './schemas/conversation.schema';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import { UpdateChatMessageDto } from './dto/update-chat-message.dto';

@Injectable()
export class ChatMessageService implements OnModuleInit {
  private readonly logger = new Logger(ChatMessageService.name);
  private readonly hiddenRecoveryNotePrefixes = ['[AUTO-RECOVER FB]', '[DA GUI LAI RA FB]'];

  constructor(
    @InjectModel(ChatMessage.name) private model: Model<ChatMessageDocument>,
    @InjectModel(Conversation.name) private convModel: Model<ConversationDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.cleanupLegacyPlatformKeys();
      await this.alignPlatformIdempotencyIndexes();
    } catch (error: any) {
      this.logger.warn(`Failed to align chat message idempotency indexes: ${error?.message || error}`);
    }
  }

  private isHiddenRecoverySystemNote(content?: string | null): boolean {
    const text = String(content || '').trim().toUpperCase();
    return this.hiddenRecoveryNotePrefixes.some((prefix) => text.startsWith(prefix));
  }

  private hiddenRecoveryNoteFilter() {
    return {
      $nor: [
        { content: { $regex: '^\\[AUTO-RECOVER FB\\]', $options: 'i' } },
        { content: { $regex: '^\\[DA GUI LAI RA FB\\]', $options: 'i' } },
      ],
    } as any;
  }

  private normalizeFanpageRef(ref: any): any {
    if (!ref) return ref;
    if (typeof ref === 'object' && ref._id) return ref._id;
    return ref;
  }

  private normalizeOptionalPlatformString(value: any): string | undefined {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : undefined;
  }

  private sanitizePlatformUniquenessFields(payload: Record<string, any>): void {
    const platformMessageId = this.normalizeOptionalPlatformString(payload.platformMessageId);
    const platformEventKey = this.normalizeOptionalPlatformString(payload.platformEventKey);

    if (platformMessageId) {
      payload.platformMessageId = platformMessageId;
    } else {
      delete payload.platformMessageId;
    }

    if (platformEventKey) {
      payload.platformEventKey = platformEventKey;
    } else {
      delete payload.platformEventKey;
    }
  }

  private async cleanupLegacyPlatformKeys(): Promise<void> {
    await Promise.all([
      this.model.updateMany({ platformMessageId: { $in: [null, ''] } } as any, { $unset: { platformMessageId: 1 } }).exec(),
      this.model.updateMany({ platformEventKey: { $in: [null, ''] } } as any, { $unset: { platformEventKey: 1 } }).exec(),
    ]);
  }

  private async ensurePartialUniqueIndex(
    name: string,
    key: Record<string, 1>,
    partialField: 'platformMessageId' | 'platformEventKey',
  ): Promise<void> {
    const indexes = await this.model.collection.indexes();
    const existing = indexes.find((index) => index.name === name);
    const expectedPartial = (existing as any)?.partialFilterExpression?.[partialField]?.$type === 'string';
    const isExpected =
      Boolean(existing) &&
      Boolean((existing as any)?.unique) &&
      !Boolean((existing as any)?.sparse) &&
      expectedPartial;

    if (existing && !isExpected) {
      await this.model.collection.dropIndex(name);
    }

    const refreshedIndexes = existing && !isExpected ? await this.model.collection.indexes() : indexes;
    const stillExists = refreshedIndexes.some((index) => index.name === name);
    if (!stillExists) {
      await this.model.collection.createIndex(key, {
        name,
        unique: true,
        partialFilterExpression: { [partialField]: { $type: 'string' } } as any,
      });
    }
  }

  private async alignPlatformIdempotencyIndexes(): Promise<void> {
    await this.ensurePartialUniqueIndex(
      'sourcePlatform_1_fanpageId_1_platformMessageId_1',
      { sourcePlatform: 1, fanpageId: 1, platformMessageId: 1 },
      'platformMessageId',
    );
    await this.ensurePartialUniqueIndex(
      'sourcePlatform_1_fanpageId_1_platformEventKey_1',
      { sourcePlatform: 1, fanpageId: 1, platformEventKey: 1 },
      'platformEventKey',
    );
  }

  private buildPlatformUniqueFilter(dto: CreateChatMessageDto): FilterQuery<ChatMessageDocument> | null {
    const sourcePlatform = String((dto as any)?.sourcePlatform || '').trim();
    const fanpageId = this.normalizeFanpageRef((dto as any)?.fanpageId);
    const platformMessageId = this.normalizeOptionalPlatformString((dto as any)?.platformMessageId);
    const platformEventKey = this.normalizeOptionalPlatformString((dto as any)?.platformEventKey);

    if (!sourcePlatform || !fanpageId) return null;
    if (platformMessageId) return { sourcePlatform, fanpageId, platformMessageId } as any;
    if (platformEventKey) return { sourcePlatform, fanpageId, platformEventKey } as any;
    return null;
  }

  private extractPlatformMessageId(rawResponse?: any): string | undefined {
    const candidates = [
      rawResponse?.message_id,
      rawResponse?.text?.message_id,
      rawResponse?.fb?.message_id,
      rawResponse?.recovery?.messageId,
      rawResponse?.raw?.message_id,
    ];
    for (const value of candidates) {
      const id = String(value || '').trim();
      if (id) return id;
    }
    return undefined;
  }

  private makeOutboundPlatformEventKey(fanpageId: string, senderPsid: string, content: string): string {
    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 10);
    const snippet = String(content || '').trim().slice(0, 40).replace(/\s+/g, '_');
    return `out:${fanpageId}:${senderPsid}:${stamp}:${rand}:${snippet}`;
  }

  private inferDeliveryStatus(rawResponse?: any): 'sent' | 'failed' | 'skipped' {
    if (this.extractPlatformMessageId(rawResponse)) return 'sent';

    const statusHint = String(rawResponse?.message || rawResponse?.note || '').trim().toLowerCase();
    if (
      statusHint === 'skip' ||
      statusHint === 'fb_sending_disabled' ||
      statusHint === 'blocked_outside_24h' ||
      statusHint === 'image_url_not_absolute'
    ) {
      return 'skipped';
    }

    if (
      rawResponse?.ok === false ||
      rawResponse?.error ||
      rawResponse?.text?.error ||
      rawResponse?.fb?.error
    ) {
      return 'failed';
    }

    return 'sent';
  }

  private async persistMessage(dto: CreateChatMessageDto): Promise<{ doc: ChatMessageDocument; created: boolean }> {
    const payload: any = { ...dto };
    if (dto.receivedAt) payload.receivedAt = new Date(dto.receivedAt);
    this.sanitizePlatformUniquenessFields(payload);
    const uniqueFilter = this.buildPlatformUniqueFilter(payload);

    if (!uniqueFilter) {
      const doc = await new this.model(payload).save();
      await this.upsertConversationForMessage(doc);
      return { doc, created: true };
    }

    try {
      const writeResult: any = await this.model.updateOne(
        uniqueFilter,
        { $setOnInsert: payload },
        { upsert: true },
      ).exec();
      const doc = await this.model.findOne(uniqueFilter).exec();
      if (!doc) throw new NotFoundException('KhÃ´ng thá»ƒ táº£i láº¡i chat message sau upsert');
      const created = Boolean(writeResult?.upsertedCount || writeResult?.upsertedId);
      if (created) {
        await this.upsertConversationForMessage(doc);
      }
      return { doc, created };
    } catch (error: any) {
      if (error?.code === 11000) {
        const doc = await this.model.findOne(uniqueFilter).exec();
        if (doc) return { doc, created: false };
      }
      throw error;
    }
  }

  async create(dto: CreateChatMessageDto) {
    const { doc } = await this.persistMessage(dto);
    return doc;
  }

  async createIfNotExists(dto: CreateChatMessageDto): Promise<{ doc: ChatMessageDocument; created: boolean }> {
    return this.persistMessage(dto);
  }

  // Individual message CRUD methods removed
  // Messages are now append-only via webhook/send operations
  // Use conversation-level operations for management

  // --- Conversation helpers ---
  private async upsertConversationForMessage(msg: ChatMessageDocument) {
    if (this.isHiddenRecoverySystemNote((msg as any)?.content)) return;
    const base = { fanpageId: msg.fanpageId, senderPsid: msg.senderPsid } as any;
    const inc: any = { totalMessages: 1 };
    if (msg.direction === 'in') inc.inboundCount = 1; else inc.outboundCount = 1;
    if (msg.awaitingHuman) inc.awaitingCount = 1;
    const createdAt: Date = (msg as any).createdAt || (msg as any).receivedAt || new Date();
    const set: any = { lastMessageSnippet: (msg.content||'').slice(0,120), lastDirection: msg.direction, lastMessageAt: createdAt };
    // NÃƒÂ¡Ã‚ÂºÃ‚Â¿u message cÃƒÆ’Ã‚Â³ adGroupId, cÃƒÂ¡Ã‚ÂºÃ‚Â­p nhÃƒÂ¡Ã‚ÂºÃ‚Â­t luÃƒÆ’Ã‚Â´n vÃƒÆ’Ã‚Â o conversation Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã†â€™ UI thÃƒÂ¡Ã‚ÂºÃ‚Â¥y ngay
    if ((msg as any).adGroupId) set.lastAdGroupId = (msg as any).adGroupId;
    if (msg.awaitingHuman) set.hasAwaitingHuman = true, set.needsHuman = true, set.firstAwaitingAt = set.firstAwaitingAt || new Date();
    await this.convModel.updateOne(base, { $setOnInsert: { ...base, autoAiEnabled: true }, $inc: inc, $set: set }, { upsert: true }).exec();
  }

  private async recomputeConversation(fanpageId: any, senderPsid: string) {
    const msgs = await this.model
      .find({ fanpageId, senderPsid, ...this.hiddenRecoveryNoteFilter() })
      .sort({ createdAt: 1 })
      .lean();
    if (!msgs.length) {
      await this.convModel.deleteOne({ fanpageId, senderPsid }).exec();
      return;
    }
    let inbound = 0, outbound = 0, awaiting = 0; let firstAwait: Date | undefined; let lastMsg = msgs[msgs.length-1];
    let lastAdGroupId: string | undefined; // lÃƒÂ¡Ã‚ÂºÃ‚Â¥y adGroupId MÃƒÂ¡Ã‚Â»Ã…Â¡I NHÃƒÂ¡Ã‚ÂºÃ‚Â¤T
    for (const m of msgs) {
      if (m.direction === 'in') inbound++; else outbound++;
      if (m.awaitingHuman) { awaiting++; if (!firstAwait) firstAwait = (m as any).createdAt || (m as any).receivedAt; }
      if (m.adGroupId) lastAdGroupId = m.adGroupId; // ghi Ãƒâ€žÃ¢â‚¬ËœÃƒÆ’Ã‚Â¨ Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã†â€™ giÃƒÂ¡Ã‚Â»Ã‚Â¯ giÃƒÆ’Ã‚Â¡ trÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ cuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi cÃƒÆ’Ã‚Â¹ng
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
    const [rawItems, total] = await Promise.all([
      this.convModel.find(filter).populate('fanpageId', 'pageId name').sort({ lastMessageAt: -1 }).skip(skip).limit(limit).lean(),
      this.convModel.countDocuments(filter),
    ]);
    const items = await Promise.all(
      (rawItems as any[]).map(async (item: any) => {
        if (!this.isHiddenRecoverySystemNote(item?.lastMessageSnippet)) return item;
        const latestVisible = await this.model
          .findOne({
            fanpageId: this.normalizeFanpageRef(item?.fanpageId),
            senderPsid: item?.senderPsid,
            ...this.hiddenRecoveryNoteFilter(),
          })
          .sort({ createdAt: -1 })
          .lean();
        if (!latestVisible) return item;
        return {
          ...item,
          lastMessageSnippet: String((latestVisible as any).content || '').slice(0, 120),
          lastDirection: (latestVisible as any).direction,
          lastMessageAt: (latestVisible as any).createdAt || (latestVisible as any).receivedAt || item.lastMessageAt,
        };
      }),
    );
    return { items, total, page, limit, totalPages: Math.ceil(total/limit) };
  }

  async getConversation(fanpageId: string, senderPsid: string) {
    let conv = await this.convModel.findOne({ fanpageId, senderPsid }).lean();
    const messages = await this.model
      .find({ fanpageId, senderPsid, ...this.hiddenRecoveryNoteFilter() })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    
    // NÃƒÂ¡Ã‚ÂºÃ‚Â¿u chÃƒâ€ Ã‚Â°a cÃƒÆ’Ã‚Â³ conversation nhÃƒâ€ Ã‚Â°ng cÃƒÆ’Ã‚Â³ messages, tÃƒÂ¡Ã‚ÂºÃ‚Â¡o conversation tÃƒÂ¡Ã‚Â»Ã‚Â« messages
    if (!conv && messages.length > 0) {
      await this.recomputeConversation(fanpageId, senderPsid);
      conv = await this.convModel.findOne({ fanpageId, senderPsid }).lean();
    }

    if (conv && this.isHiddenRecoverySystemNote((conv as any).lastMessageSnippet)) {
      await this.recomputeConversation(fanpageId, senderPsid);
      conv = await this.convModel.findOne({ fanpageId, senderPsid }).lean();
    }
    
    // NÃƒÂ¡Ã‚ÂºÃ‚Â¿u vÃƒÂ¡Ã‚ÂºÃ‚Â«n khÃƒÆ’Ã‚Â´ng cÃƒÆ’Ã‚Â³ conversation (khÃƒÆ’Ã‚Â´ng cÃƒÆ’Ã‚Â³ messages), tÃƒÂ¡Ã‚ÂºÃ‚Â¡o conversation trÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœng
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
    if(!res) throw new NotFoundException('Conversation khÃƒÆ’Ã‚Â´ng tÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“n tÃƒÂ¡Ã‚ÂºÃ‚Â¡i');
    return { fanpageId, senderPsid, autoAiEnabled: res.autoAiEnabled };
  }

  async extractOrderDraft(fanpageId: string, senderPsid: string) {
    // LÃƒÂ¡Ã‚ÂºÃ‚Â¥y theo thÃƒÂ¡Ã‚Â»Ã‚Âi gian tÃƒâ€žÃ†â€™ng dÃƒÂ¡Ã‚ÂºÃ‚Â§n Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã†â€™ cÃƒÆ’Ã‚Â³ thÃƒÂ¡Ã‚Â»Ã†â€™ lÃƒÂ¡Ã‚ÂºÃ‚Â¥y adGroupId cuÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœi cÃƒÆ’Ã‚Â¹ng (mÃƒÂ¡Ã‚Â»Ã¢â‚¬Âºi nhÃƒÂ¡Ã‚ÂºÃ‚Â¥t)
    const messages = await this.model
      .find({ fanpageId, senderPsid, ...this.hiddenRecoveryNoteFilter() })
      .sort({ createdAt: 1 })
      .lean();
    if(!messages.length) throw new NotFoundException('KhÃƒÆ’Ã‚Â´ng cÃƒÆ’Ã‚Â³ tin nhÃƒÂ¡Ã‚ÂºÃ‚Â¯n Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã†â€™ trÃƒÆ’Ã‚Â­ch xuÃƒÂ¡Ã‚ÂºÃ‚Â¥t');
    const textAll = messages.map(m=> m.content).join('\n');
    // Simple regex heuristics
    const phoneRegex = /(0|\+84)(3|5|7|8|9)\d{8}/g;
    const phones = Array.from(new Set((textAll.match(phoneRegex)||[])));
    const qtyRegex = /(sÃƒÂ¡Ã‚Â»Ã¢â‚¬Ëœ lÃƒâ€ Ã‚Â°ÃƒÂ¡Ã‚Â»Ã‚Â£ng|sl|lÃƒÂ¡Ã‚ÂºÃ‚Â¥y|mua|x)\s*(\d{1,4})/gi;
    let quantity: number | undefined; let m;
    while((m = qtyRegex.exec(textAll))){ const v = parseInt(m[2]); if(!quantity || v>quantity) quantity=v; }
    const addressRegex = /(Ãƒâ€žÃ¢â‚¬ËœÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹a chÃƒÂ¡Ã‚Â»Ã¢â‚¬Â°|add(?:ress)?)[^\n:]*[:\-]?\s*([^\n]{10,120})/i;
    const addrMatch = textAll.match(addressRegex);
    const address = addrMatch? addrMatch[2].trim(): undefined;
  // adGroupId: chÃƒÂ¡Ã‚Â»Ã‚Ân GIÃƒÆ’Ã‚Â TRÃƒÂ¡Ã‚Â»Ã…Â  MÃƒÂ¡Ã‚Â»Ã…Â¡I NHÃƒÂ¡Ã‚ÂºÃ‚Â¤T cÃƒÆ’Ã‚Â³ trong luÃƒÂ¡Ã‚Â»Ã¢â‚¬Å“ng tin nhÃƒÂ¡Ã‚ÂºÃ‚Â¯n
  let adGroupId: string | undefined;
  for(const m of messages){ if(m.adGroupId) adGroupId = m.adGroupId; }
    // naive customer name: if first inbound contains tÃƒÆ’Ã‚Âªn ...
    let customerName: string | undefined;
    const firstInbound = messages.find(m=> m.direction==='in');
    if(firstInbound){
      const nameRegex = /(em tÃƒÆ’Ã‚Âªn|mÃƒÆ’Ã‚Â¬nh tÃƒÆ’Ã‚Âªn|tÃƒÆ’Ã‚Â´i tÃƒÆ’Ã‚Âªn|anh tÃƒÆ’Ã‚Âªn|chÃƒÂ¡Ã‚Â»Ã¢â‚¬Â¹ tÃƒÆ’Ã‚Âªn)\s+([A-Za-zÃƒÆ’Ã¢â€šÂ¬-ÃƒÂ¡Ã‚Â»Ã‚Â¹Ãƒâ€žÃ‚ÂÃƒâ€žÃ¢â‚¬Ëœ\s]{2,40})/i;
      const nm = firstInbound.content.match(nameRegex);
      if(nm) customerName = nm[2].trim();
    }
    if(!customerName) customerName = 'KhÃƒÆ’Ã‚Â¡ch FB ' + senderPsid.slice(-4);
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
    const platformMessageId = this.extractPlatformMessageId(params.rawResponse);
    const platformEventKey = platformMessageId
      ? undefined
      : this.makeOutboundPlatformEventKey(params.fanpageId, params.senderPsid, params.text);
    const { doc, created } = await this.createIfNotExists({
      fanpageId: params.fanpageId,
      senderPsid: params.senderPsid,
      content: params.text,
      direction: 'out',
      awaitingHuman: false,
      sourcePlatform: 'facebook',
      platformMessageId,
      platformEventKey,
      deliveryStatus: this.inferDeliveryStatus(params.rawResponse),
      raw: params.rawResponse,
      receivedAt: new Date(),
    } as any);
    // Clear awaiting flags on previous inbound messages for this conversation (simple heuristic v1)
    await this.model.updateMany({ fanpageId: params.fanpageId, senderPsid: params.senderPsid, awaitingHuman: true }, { $set: { awaitingHuman: false } }).exec();
    await this.recomputeConversation(params.fanpageId as any, params.senderPsid);
    return { doc, created };
  }

  /**
   * Update an existing chat message (needed by webhook service)
   */
  async update(id: string, updateDto: Partial<UpdateChatMessageDto>) {
    const doc = await this.model.findByIdAndUpdate(id, updateDto, { new: true }).exec();
    if (!doc) {
      throw new NotFoundException(`Chat message with ID ${id} not found`);
    }
    return doc;
  }

  /**
   * Record an outbound image message (uploaded by agent in conversation UI)
   */
  async recordOutboundImage(params: { fanpageId: string; senderPsid: string; imageUrl: string; rawResponse?: any; }) {
    const platformMessageId = this.extractPlatformMessageId(params.rawResponse);
    const platformEventKey = platformMessageId
      ? undefined
      : this.makeOutboundPlatformEventKey(params.fanpageId, params.senderPsid, params.imageUrl);
    const { doc, created } = await this.createIfNotExists({
      fanpageId: params.fanpageId,
      senderPsid: params.senderPsid,
      content: params.imageUrl,
      messageType: 'image',
      direction: 'out',
      awaitingHuman: false,
      sourcePlatform: 'facebook',
      platformMessageId,
      platformEventKey,
      deliveryStatus: this.inferDeliveryStatus(params.rawResponse),
      raw: params.rawResponse,
      receivedAt: new Date(),
    } as any);
    await this.model.updateMany({ fanpageId: params.fanpageId, senderPsid: params.senderPsid, awaitingHuman: true }, { $set: { awaitingHuman: false } }).exec();
    await this.recomputeConversation(params.fanpageId as any, params.senderPsid);
    return { doc, created };
  }
}
