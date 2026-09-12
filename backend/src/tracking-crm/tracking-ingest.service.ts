import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { TrackingSource, TrackingVisit } from './schemas/tracking-crm.schema';
import { TrackingIngestBatchDto } from './tracking-ingest.dto';

@Injectable()
export class TrackingIngestService {
  constructor(
    @InjectModel(TrackingSource.name) private readonly sources: Model<TrackingSource>,
    @InjectModel(TrackingVisit.name) private readonly visits: Model<TrackingVisit>,
    @InjectConnection() private readonly connection: Connection,
  ) {}
  async ingest(dto: TrackingIngestBatchDto) {
    const sourceKey = process.env.TRACKING_INGEST_SOURCE_KEY;
    if (!sourceKey) throw new ForbiddenException('Tracking source is not configured');
    const source = await this.sources.findOne({ sourceKey, enabled: true }).lean();
    if (!source) throw new ForbiddenException('Tracking source is disabled');
    const ids = new Set<string>();
    for (const visit of dto.visits) {
      if (ids.has(visit.externalVisitId) || !source.allowedOrigins.includes(`https://${visit.landingHost}`)
        || !visit.ads || !visit.engagement
        || Date.parse(visit.occurredAt) > Date.now() + 300000
        || Date.parse(visit.observedAt) > Date.now() + 300000
        || Date.parse(visit.observedAt) < Date.parse(visit.occurredAt)) {
        throw new BadRequestException('Invalid tracking batch scope or timestamp');
      }
      ids.add(visit.externalVisitId);
    }
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        for (const visit of dto.visits) {
          const { engagement, observedAt, ...raw } = visit;
          const identity = { sourceId: source._id, externalVisitId: visit.externalVisitId };
          // Attribution and original evidence are immutable; no lead/order is created here.
          await this.visits.updateOne(identity, { $setOnInsert: {
            ...raw, ...identity, occurredAt: new Date(raw.occurredAt), receivedAt: new Date(),
            ipEvidenceTrust: 'collector_reported',
          } }, { upsert: true, runValidators: true, session });
          await this.visits.updateOne({ ...identity, $or: [
            { engagementObservedAt: { $exists: false } }, { engagementObservedAt: { $lt: new Date(observedAt) } },
          ] }, { $set: { engagement, engagementObservedAt: new Date(observedAt) } }, { runValidators: true, session });
        }
      });
      return { accepted: dto.visits.length };
    } finally { await session.endSession(); }
  }
}
