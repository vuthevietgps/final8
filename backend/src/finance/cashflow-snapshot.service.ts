/**
 * CASHFLOW SNAPSHOT SERVICE — Phase 3
 * =====================================
 * Đọc/ghi Aggregated Summaries cho FinancialControlService.
 * Cache layer (Redis/in-memory, TTL 5 min) + DB layer (MongoDB persistent).
 *
 * FinancialControlService đọc từ đây thay vì gọi trực tiếp cross-domain services.
 * FinanceEventListenerService viết vào đây khi nhận finance events.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import {
  CashflowSummarySnapshot,
  CashflowSummarySnapshotDocument,
} from './schemas/cashflow-summary-snapshot.schema';
import {
  TaxObligationAudit,
  TaxObligationAuditDocument,
} from './schemas/tax-obligation-audit.schema';

/** Strongly-typed domain keys */
export type SnapshotDomain = 'labor' | 'ops' | 'agent' | 'debt' | 'supplier' | 'tax';

/** TTL for cached snapshots: 5 minutes */
const SNAPSHOT_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class CashflowSnapshotService {
  private readonly logger = new Logger(CashflowSnapshotService.name);

  constructor(
    @InjectModel(CashflowSummarySnapshot.name)
    private readonly model: Model<CashflowSummarySnapshotDocument>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    @Optional()
    @InjectModel(TaxObligationAudit.name)
    private readonly taxAuditModel?: Model<TaxObligationAuditDocument>,
    @Optional()
    @InjectConnection()
    private readonly connection?: Connection,
  ) {}

  // ─── Cache key ─────────────────────────────────────────────────────────────

  private cacheKey(domain: SnapshotDomain, windowDays: number): string {
    return `fc:snap:${domain}:${windowDays}`;
  }

  // ─── Write ─────────────────────────────────────────────────────────────────

  /**
   * Lưu snapshot mới. Vừa cập nhật MongoDB vừa xoá cache cũ để force re-read.
   */
  async store(domain: SnapshotDomain, windowDays: number, data: Record<string, unknown>): Promise<void> {
    const updatedAt = new Date();
    try {
      await this.model.findOneAndUpdate(
        { domain, windowDays },
        { $set: { data, updatedAt } },
        { upsert: true, new: true },
      );
    } catch (err) {
      this.logger.error(`[SNAPSHOT] Failed to store ${domain}/${windowDays}`, err);
      throw err;
    }

    // Mongo is canonical. A cache outage must not turn a durable snapshot
    // write into a false failure, but callers must not keep reading stale cache
    // silently either, so make the degraded state visible in logs.
    try {
      await this.cacheManager.del(this.cacheKey(domain, windowDays));
    } catch (err) {
      this.logger.warn(`[SNAPSHOT] Stored ${domain}/${windowDays}, but cache invalidation failed`, err);
      try {
        await this.cacheManager.set(
          this.cacheKey(domain, windowDays),
          data,
          SNAPSHOT_TTL_MS,
        );
      } catch (refreshError) {
        this.logger.warn(`[SNAPSHOT] Cache refresh also failed for ${domain}/${windowDays}`, refreshError);
      }
    }
  }

  /**
   * Atomically replaces the canonical tax snapshot and appends an immutable
   * before/after audit record. Transaction support is mandatory: if the audit
   * cannot be persisted, the canonical snapshot must not change.
   */
  async storeTaxWithAudit(data: Record<string, unknown>, actor: string): Promise<void> {
    if (!this.connection || !this.taxAuditModel) {
      throw new Error('Tax audit transaction dependencies are unavailable');
    }

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const previous = await this.model
          .findOne({ domain: 'tax', windowDays: -1 })
          .session(session)
          .lean();
        const recordedAt = new Date();
        await this.model.findOneAndUpdate(
          { domain: 'tax', windowDays: -1 },
          { $set: { data, updatedAt: recordedAt } },
          { upsert: true, new: true, session },
        );
        await this.taxAuditModel!.create([{
          previousSnapshot: previous?.data || null,
          snapshot: data,
          actor,
          recordedAt,
        }], { session });
      });
    } finally {
      await session.endSession();
    }

    const key = this.cacheKey('tax', -1);
    try {
      await this.cacheManager.del(key);
    } catch (err) {
      this.logger.warn('[SNAPSHOT] Tax update committed, but cache invalidation failed', err);
      try {
        await this.cacheManager.set(key, data, SNAPSHOT_TTL_MS);
      } catch (refreshError) {
        this.logger.warn('[SNAPSHOT] Tax cache refresh also failed', refreshError);
      }
    }
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  /**
   * Đọc snapshot. Thứ tự: Redis cache → MongoDB → null.
   * Caller phải tự xử lý null (fallback safe = trả 0 hoặc []).
   */
  async read<T = Record<string, unknown>>(domain: SnapshotDomain, windowDays: number): Promise<T | null> {
    const key = this.cacheKey(domain, windowDays);

    // 1. Cache
    try {
      const cached = await this.cacheManager.get<T>(key);
      if (cached) return cached;
    } catch (err) {
      this.logger.warn(`[SNAPSHOT] Cache read failed for ${domain}/${windowDays}; falling back to MongoDB`, err);
    }

    // 2. DB
    try {
      const doc = await this.model.findOne({ domain, windowDays }).lean();
      if (doc?.data) {
        // Warm cache from DB
        try {
          await this.cacheManager.set(key, doc.data, SNAPSHOT_TTL_MS);
        } catch (err) {
          this.logger.warn(`[SNAPSHOT] Cache warm failed for ${domain}/${windowDays}`, err);
        }
        return doc.data as T;
      }
    } catch (err) {
      this.logger.warn(`[SNAPSHOT] Failed to read ${domain}/${windowDays} from DB`, err);
    }
    return null;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Convenience: get staleness in ms, returns Infinity if no snapshot exists.
   */
  async getStaleness(domain: SnapshotDomain, windowDays: number): Promise<number> {
    try {
      const doc = await this.model.findOne({ domain, windowDays }, { updatedAt: 1 }).lean();
      if (!doc?.updatedAt) return Infinity;
      return Date.now() - new Date(doc.updatedAt).getTime();
    } catch {
      return Infinity;
    }
  }
}
