import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import { Model } from "mongoose";
import type {
  GoogleAdsReadonlyDistributedLockPort,
  GoogleAdsReadonlyLockDescriptor,
  GoogleAdsReadonlyLockLease,
} from "../provider-adapters/google-ads-readonly/google-ads-readonly-adapter.types";
import {
  AiDataPackSourceSyncLock,
  AiDataPackSourceSyncLockDocument,
} from "./source-sync-lock.schema";

@Injectable()
export class MongoSourceSyncLockService implements GoogleAdsReadonlyDistributedLockPort {
  readonly runtime = "implemented_mongo" as const;

  constructor(
    @InjectModel(AiDataPackSourceSyncLock.name)
    private readonly lockModel: Model<AiDataPackSourceSyncLockDocument>,
  ) {}

  async acquire(
    descriptor: GoogleAdsReadonlyLockDescriptor,
  ): Promise<GoogleAdsReadonlyLockLease> {
    const now = new Date();
    const ownerToken = randomUUID();

    try {
      const lock = await this.lockModel.findOneAndUpdate(
        {
          lockKey: descriptor.key,
          $or: [{ status: { $ne: "active" } }, { expiresAt: { $lte: now } }],
        },
        {
          $set: {
            owner: descriptor.owner,
            ownerToken,
            exportJobId: descriptor.exportJobId,
            sourceKey: "google_ads",
            scopeHash: descriptor.scopeHash,
            dateFrom: descriptor.dateFrom,
            dateTo: descriptor.dateTo,
            expiresAt: new Date(now.getTime() + descriptor.ttlMs),
            acquiredAt: now,
            status: "active",
          },
          $unset: { releasedAt: 1 },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      );
      return lock ? { acquired: true, ownerToken } : { acquired: false };
    } catch (error) {
      if (this.isDuplicateKey(error)) return { acquired: false };
      throw error;
    }
  }

  async release(input: {
    key: string;
    owner: string;
    ownerToken: string;
  }): Promise<void> {
    const releasedAt = new Date();
    const released = await this.lockModel.findOneAndUpdate(
      {
        lockKey: input.key,
        owner: input.owner,
        ownerToken: input.ownerToken,
        status: "active",
      },
      {
        $set: {
          status: "released",
          releasedAt,
          expiresAt: releasedAt,
        },
      },
      { new: true },
    );
    if (!released) throw new Error("Source sync lock release denied.");
  }

  private isDuplicateKey(error: unknown): boolean {
    return Number((error as { code?: unknown })?.code) === 11000;
  }
}
