import { ConflictException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import {
  MetaAdsFinancialExecutionLease,
  MetaAdsFinancialExecutionLeaseDocument,
} from './schemas/meta-ads-financial-execution-lease.schema';

const META_ADS_VND_DELIVERY_ACTIVATION_SCOPE =
  'meta-ads:vnd:delivery-activation';

@Injectable()
export class MetaAdsFinancialExecutionLeaseService implements OnModuleInit {
  private readonly logger = new Logger(MetaAdsFinancialExecutionLeaseService.name);
  private uniqueIndexReady = false;
  private uniqueIndexPromise: Promise<void> | null = null;

  constructor(
    @InjectModel(MetaAdsFinancialExecutionLease.name)
    private readonly leaseModel: Model<MetaAdsFinancialExecutionLeaseDocument>,
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
          scope: META_ADS_VND_DELIVERY_ACTIVATION_SCOPE,
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
          $setOnInsert: { scope: META_ADS_VND_DELIVERY_ACTIVATION_SCOPE },
        },
        { upsert: true, new: true },
      ).lean();

      if (!lease || lease.ownerToken !== ownerToken) {
        throw this.leaseHeldException();
      }
      return ownerToken;
    } catch (error: any) {
      // The unique scope index converts a concurrent upsert into E11000.
      if (error instanceof ConflictException || error?.code === 11000) {
        throw this.leaseHeldException();
      }
      throw error;
    }
  }

  async renew(ownerToken: string): Promise<void> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + this.leaseDurationMs());
    const lease = await this.leaseModel.findOneAndUpdate(
      {
        scope: META_ADS_VND_DELIVERY_ACTIVATION_SCOPE,
        status: 'held',
        ownerToken,
        leaseExpiresAt: { $gt: now },
      },
      { $set: { leaseExpiresAt } },
      { new: true },
    ).lean();

    if (!lease) {
      throw new ConflictException(
        'Meta Ads financial execution lease was lost; no further provider mutation was attempted.',
      );
    }
  }

  async release(ownerToken: string): Promise<void> {
    const now = new Date();
    try {
      await this.leaseModel.updateOne(
        {
          scope: META_ADS_VND_DELIVERY_ACTIVATION_SCOPE,
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
      // A failed release remains fail-closed until lease expiry. Cleanup must
      // not replace an already persisted execution result with another error.
      this.logger.error(
        `Failed to release Meta Ads financial execution lease: ${error?.message || 'unknown error'}`,
      );
    }
  }

  private leaseHeldException(): ConflictException {
    return new ConflictException(
      'Another Meta Ads delivery-activation execution is in progress; retry after it finishes.',
    );
  }

  private leaseDurationMs(): number {
    const configured = Number(process.env.META_ADS_FINANCIAL_LEASE_MS);
    if (!Number.isFinite(configured)) return 5 * 60 * 1000;
    return Math.min(
      30 * 60 * 1000,
      Math.max(60 * 1000, Math.floor(configured)),
    );
  }

  private async ensureUniqueScopeIndex(): Promise<void> {
    if (this.uniqueIndexReady) return;
    if (this.uniqueIndexPromise) return this.uniqueIndexPromise;

    this.uniqueIndexPromise = (async () => {
      const indexes = await this.leaseModel.collection.indexes().catch((error: any) => {
        if (error?.code === 26) return [];
        throw error;
      });
      const hasUniqueScope = indexes.some((index: any) =>
        index?.unique === true
        && index?.key?.scope === 1
        && Object.keys(index.key).length === 1,
      );
      if (!hasUniqueScope) {
        await this.leaseModel.collection.createIndex(
          { scope: 1 },
          {
            unique: true,
            name: 'scope_1',
          },
        );
      }
      this.uniqueIndexReady = true;
    })();

    try {
      await this.uniqueIndexPromise;
    } catch (error: any) {
      this.logger.error(
        `Meta Ads financial lease unique index is unavailable: ${error?.message || 'unknown error'}`,
      );
      throw new ConflictException(
        'Meta Ads financial execution serialization is unavailable; delivery activation is blocked.',
      );
    } finally {
      this.uniqueIndexPromise = null;
    }
  }
}
