import { ConflictException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import {
  GoogleAdsFinancialExecutionLease,
  GoogleAdsFinancialExecutionLeaseDocument,
} from './schemas/google-ads-financial-execution-lease.schema';

const GOOGLE_ADS_VND_SPEND_SCOPE = 'google-ads:vnd:spend-increase';

@Injectable()
export class GoogleAdsFinancialExecutionLeaseService implements OnModuleInit {
  private readonly logger = new Logger(GoogleAdsFinancialExecutionLeaseService.name);
  private uniqueIndexReady = false;
  private uniqueIndexPromise: Promise<void> | null = null;

  constructor(
    @InjectModel(GoogleAdsFinancialExecutionLease.name)
    private readonly leaseModel: Model<GoogleAdsFinancialExecutionLeaseDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureUniqueScopeIndex();
  }

  async acquire(): Promise<string> {
    await this.ensureUniqueScopeIndex();
    const ownerToken = randomUUID();
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + this.leaseDurationMs());

    try {
      const lease = await this.leaseModel.findOneAndUpdate(
        {
          scope: GOOGLE_ADS_VND_SPEND_SCOPE,
          $or: [
            { status: 'released' },
            { leaseExpiresAt: { $lte: now } },
            { leaseExpiresAt: { $exists: false } },
          ],
        },
        {
          $set: {
            status: 'held',
            ownerToken,
            acquiredAt: now,
            leaseExpiresAt,
          },
          $unset: { releasedAt: 1 },
          $setOnInsert: { scope: GOOGLE_ADS_VND_SPEND_SCOPE },
        },
        { upsert: true, new: true },
      ).lean();

      if (!lease || lease.ownerToken !== ownerToken) {
        throw new ConflictException(
          'Another spend-increasing Google Ads execution is in progress; retry after it finishes.',
        );
      }
      return ownerToken;
    } catch (error: any) {
      // With the unique scope index, a concurrent upsert against an unexpired
      // lease fails with E11000. Treat that as a held lease, not as a server error.
      if (error instanceof ConflictException || error?.code === 11000) {
        throw new ConflictException(
          'Another spend-increasing Google Ads execution is in progress; retry after it finishes.',
        );
      }
      throw error;
    }
  }

  async renew(ownerToken: string): Promise<void> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + this.leaseDurationMs());
    const lease = await this.leaseModel.findOneAndUpdate(
      {
        scope: GOOGLE_ADS_VND_SPEND_SCOPE,
        status: 'held',
        ownerToken,
        leaseExpiresAt: { $gt: now },
      },
      { $set: { leaseExpiresAt } },
      { new: true },
    ).lean();
    if (!lease) {
      throw new ConflictException(
        'Google Ads financial execution lease was lost; no further provider mutation was attempted.',
      );
    }
  }

  async release(ownerToken: string): Promise<void> {
    const now = new Date();
    try {
      await this.leaseModel.updateOne(
        {
          scope: GOOGLE_ADS_VND_SPEND_SCOPE,
          status: 'held',
          ownerToken,
        },
        {
          $set: {
            status: 'released',
            releasedAt: now,
            leaseExpiresAt: now,
          },
          $unset: { ownerToken: 1 },
        },
      );
    } catch (error: any) {
      // A failed release remains fail-closed until lease expiry. Do not replace
      // an already persisted provider result with a cleanup-only error.
      this.logger.error(`Failed to release Google Ads financial execution lease: ${error?.message || 'unknown error'}`);
    }
  }

  private leaseDurationMs(): number {
    const configured = Number(process.env.GOOGLE_ADS_FINANCIAL_LEASE_MS);
    if (!Number.isFinite(configured)) return 5 * 60 * 1000;
    return Math.min(30 * 60 * 1000, Math.max(60 * 1000, Math.floor(configured)));
  }

  private async ensureUniqueScopeIndex(): Promise<void> {
    if (this.uniqueIndexReady) return;
    if (this.uniqueIndexPromise) return this.uniqueIndexPromise;
    this.uniqueIndexPromise = (async () => {
      const indexes = await this.leaseModel.collection.indexes();
      const hasUniqueScope = indexes.some((index: any) =>
        index?.unique === true
        && index?.key?.scope === 1
        && Object.keys(index.key).length === 1,
      );
      if (!hasUniqueScope) {
        await this.leaseModel.collection.createIndex(
          { scope: 1 },
          { unique: true, name: 'uniq_google_ads_financial_execution_lease_scope' },
        );
      }
      this.uniqueIndexReady = true;
    })();
    try {
      await this.uniqueIndexPromise;
    } catch (error: any) {
      this.logger.error(`Google Ads financial lease unique index is unavailable: ${error?.message || 'unknown error'}`);
      throw new ConflictException(
        'Google Ads financial execution serialization is unavailable; spend-increasing actions are blocked.',
      );
    } finally {
      this.uniqueIndexPromise = null;
    }
  }
}
