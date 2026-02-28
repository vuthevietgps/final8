import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import fetch from 'node-fetch';
import { ChatMessage, ChatMessageDocument } from './schemas/chat-message.schema';
import { Fanpage, FanpageDocument } from '../fanpage/schemas/fanpage.schema';

type RecoveryStatus = 'sent' | 'failed' | 'skipped';

@Injectable()
export class AiDeliveryRecoveryService {
  private readonly logger = new Logger(AiDeliveryRecoveryService.name);
  private readonly enabled = process.env.AI_FB_DELIVERY_RECOVERY_ENABLED !== '0';
  private running = false;

  constructor(
    @InjectModel(ChatMessage.name) private readonly chatModel: Model<ChatMessageDocument>,
    @InjectModel(Fanpage.name) private readonly fanpageModel: Model<FanpageDocument>,
  ) {}

  @Cron('*/10 * * * * *')
  async recoverUndeliveredAiMessages(): Promise<void> {
    if (!this.enabled || this.running) return;
    this.running = true;
    try {
      // Only scan recent notes to avoid large, repeated backfills.
      const since = new Date(Date.now() - 30 * 60 * 1000);
      const stuckNotes = await this.chatModel
        .find({
          direction: 'system' as any,
          createdAt: { $gte: since },
          content: { $regex: '\\[KHÔNG GỬI RA FB\\] FB_SENDING_ENABLED=0' },
          'raw.recovery.status': { $exists: false },
        })
        .sort({ createdAt: 1 })
        .limit(20)
        .lean();

      for (const note of stuckNotes as any[]) {
        await this.processOne(note);
      }
    } catch (error: any) {
      this.logger.error(`Recovery scan failed: ${error?.message || String(error)}`);
    } finally {
      this.running = false;
    }
  }

  private async processOne(note: any): Promise<void> {
    const fanpageId = note?.fanpageId;
    const senderPsid = note?.senderPsid;
    if (!fanpageId || !senderPsid) {
      await this.markNote(note?._id, 'skipped', 'missing_fanpage_or_sender');
      return;
    }

    // Find nearest AI outbound right before this note.
    const noteTime = new Date(note.createdAt || Date.now()).getTime();
    const lowerBound = new Date(noteTime - 2 * 60 * 1000);
    const aiMsg = await this.chatModel
      .findOne({
        fanpageId,
        senderPsid,
        direction: 'out',
        isAI: true,
        createdAt: { $lte: new Date(noteTime), $gte: lowerBound },
      })
      .sort({ createdAt: -1 })
      .lean();

    if (!aiMsg || !aiMsg.content) {
      await this.markNote(note._id, 'skipped', 'missing_ai_message');
      return;
    }

    const alreadyDelivered = !!(
      (aiMsg as any)?.raw?.message_id ||
      (aiMsg as any)?.raw?.text?.message_id ||
      (aiMsg as any)?.raw?.fb?.message_id ||
      (aiMsg as any)?.raw?.recovery?.messageId
    );
    if (alreadyDelivered) {
      await this.markNote(note._id, 'skipped', 'already_delivered');
      return;
    }

    const fanpage = await this.fanpageModel.findById(fanpageId).lean();
    if (!fanpage?.accessToken) {
      await this.markNote(note._id, 'failed', 'missing_fanpage_access_token');
      return;
    }

    // Messenger RESPONSE must be within 24h from last inbound.
    const latestInbound = await this.chatModel
      .findOne({ fanpageId, senderPsid, direction: 'in' })
      .sort({ createdAt: -1 })
      .lean();
    const lastInboundAt = latestInbound
      ? new Date((latestInbound as any).createdAt || (latestInbound as any).receivedAt || 0).getTime()
      : 0;
    const within24h = lastInboundAt > 0 && (Date.now() - lastInboundAt) < (24 * 60 * 60 * 1000);
    if (!within24h) {
      await this.markNote(note._id, 'skipped', 'outside_24h_window');
      return;
    }

    const payload = {
      recipient: { id: senderPsid },
      messaging_type: 'RESPONSE',
      message: { text: String(aiMsg.content).trim() },
    };
    let fbRes: any = null;
    try {
      const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(fanpage.accessToken)}`;
      fbRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json());
    } catch (error: any) {
      fbRes = { ok: false, error: { message: error?.message || String(error) } };
    }

    if (fbRes?.message_id) {
      await this.chatModel.updateOne(
        { _id: aiMsg._id as any },
        {
          $set: {
            'raw.recovery.sentAt': new Date(),
            'raw.recovery.messageId': fbRes.message_id,
            'raw.recovery.recipientId': fbRes.recipient_id,
          },
        },
      );
      await this.markNote(note._id, 'sent', 'resent_ok', {
        messageId: fbRes.message_id,
        recipientId: fbRes.recipient_id,
      });
      return;
    }

    const err = fbRes?.error || {};
    await this.markNote(
      note._id,
      'failed',
      `graph_error_${err.code || 'unknown'}`,
      { message: err.message, subcode: err.error_subcode },
    );
  }

  private async markNote(
    noteId: any,
    status: RecoveryStatus,
    reason: string,
    extra?: Record<string, any>,
  ): Promise<void> {
    if (!noteId) return;
    const setPayload: Record<string, any> = {
      'raw.recovery.status': status,
      'raw.recovery.reason': reason,
      'raw.recovery.at': new Date(),
      ...(extra ? Object.fromEntries(Object.entries(extra).map(([k, v]) => [`raw.recovery.${k}`, v])) : {}),
    };
    await this.chatModel.updateOne(
      { _id: noteId },
      {
        $set: setPayload,
      },
    );
  }
}
