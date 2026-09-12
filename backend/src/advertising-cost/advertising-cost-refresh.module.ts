import { Injectable, Logger, Module } from '@nestjs/common';
import { InjectModel, MongooseModule, Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { ClientSession, Model } from 'mongoose';
import { randomUUID } from 'crypto';

export const ADS_COST_REFRESH = 'advertising-cost.refresh';
export const ORDER_COST_ALLOCATED = 'order.cost-allocated';
export const FINANCIAL_INPUT_CHANGED = 'financial.input-changed';

@Schema({ collection: 'ads_cost_refresh_jobs', timestamps: true })
export class AdsCostRefreshJob {
  @Prop({ required: true }) day: string;
  @Prop({ default: 0 }) version: number;
  @Prop({ default: true }) pending: boolean;
  @Prop({ default: false }) revalue: boolean;
  @Prop() leaseUntil?: Date;
  @Prop() leaseToken?: string;
}
const schema = SchemaFactory.createForClass(AdsCostRefreshJob);
schema.index({ day: 1 }, { unique: true, name: 'uniq_ads_cost_refresh_day' });

/** Durable invalidation: register before changing costs, acknowledge only after every projection succeeds. */
@Injectable()
export class AdvertisingCostRefreshService {
  private readonly logger = new Logger(AdvertisingCostRefreshService.name);
  constructor(
    @InjectModel(AdsCostRefreshJob.name) private readonly jobs: Model<AdsCostRefreshJob>,
    private readonly events: EventEmitter2,
  ) {}

  async mark(days: string[], session?: ClientSession, revalue = false) {
    for (const day of new Set(days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid cost refresh day');
      await this.jobs.updateOne({ day }, { $inc: { version: 1 }, $set: { pending: true, ...(revalue ? { revalue: true } : {}) } }, { upsert: true, session });
    }
  }

  async flush(day: string): Promise<boolean> {
    const leaseToken = randomUUID();
    const job = await this.jobs.findOneAndUpdate({ day, pending: true,
      $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: new Date() } }],
    }, { $set: { leaseToken, leaseUntil: new Date(Date.now() + 30 * 60_000) } }, { new: true }).lean();
    if (!job) return false;
    try {
      const results = await this.events.emitAsync(ADS_COST_REFRESH, { day, revalue: job.revalue });
      if (!results.length) throw new Error('Cost refresh handler unavailable');
      const result = await this.jobs.updateOne({ day, leaseToken, version: job.version }, {
        $set: { pending: false, revalue: false }, $unset: { leaseUntil: 1, leaseToken: 1 },
      });
      return result.modifiedCount === 1;
    } finally {
      await this.jobs.updateOne({ day, leaseToken }, { $unset: { leaseUntil: 1, leaseToken: 1 } });
    }
  }

  @Cron('*/5 * * * *', { name: 'ads-cost-projection-retry', timeZone: 'Asia/Ho_Chi_Minh' })
  async retryPending() {
    const jobs = await this.jobs.find({ pending: true }).sort({ day: 1 }).limit(30).lean();
    for (const job of jobs) {
      try { await this.flush(job.day); }
      catch { this.logger.warn(`Cost projections pending for ${job.day}; will retry.`); }
    }
  }
}

@Module({
  imports: [MongooseModule.forFeature([{ name: AdsCostRefreshJob.name, schema }])],
  providers: [AdvertisingCostRefreshService], exports: [AdvertisingCostRefreshService],
})
export class AdvertisingCostRefreshModule {}
