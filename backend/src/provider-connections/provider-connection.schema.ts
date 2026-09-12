import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConnectionKind = 'windsor-facebook' | 'windsor-google' | 'bird-messenger';
export type BirdApi = 'bird-v1' | 'messagebird-v1';
export type ProviderConnectionDocument = HydratedDocument<ProviderConnection>;

@Schema({ timestamps: true, collection: 'provider_connections' })
export class ProviderConnection {
  @Prop({ required: true, enum: ['windsor-facebook', 'windsor-google', 'bird-messenger'] }) kind: ConnectionKind;
  @Prop({ required: true }) name: string;
  // Windsor: connector. Bird: Facebook Page ID. One configuration per scope.
  @Prop({ required: true }) scope: string;
  @Prop({ required: true, select: false }) secretsEnc: string;
  @Prop({ required: true, default: 1 }) revision: number;
  @Prop({ default: 'configured', enum: ['configured', 'disabled'] }) state: 'configured' | 'disabled';
  @Prop({ type: [String], default: [] }) accountIds: string[];
  @Prop({ enum: ['bird-v1', 'messagebird-v1'] }) birdApi?: BirdApi;
  @Prop() workspaceId?: string;
  @Prop() channelId?: string;
  @Prop() pageId?: string;
  @Prop({ default: false }) hasSigningSecret: boolean;
  @Prop() checkedAt?: Date;
  @Prop() checkedRevision?: number;
  @Prop() lastCheckStartedAt?: Date;
  @Prop({ type: Object }) check?: Record<string, unknown>;
  @Prop() syncLeaseUntil?: Date;
  @Prop() lastReadSyncAt?: Date;
  @Prop({ enum: ['success', 'partial', 'failed'] }) lastReadSyncStatus?: 'success' | 'partial' | 'failed';
  @Prop() lastReadSyncRunId?: string;
  @Prop({ type: [Object], default: [] }) audit: Array<{ at: Date; actor: string; operation: string; revision: number }>;
}

export const ProviderConnectionSchema = SchemaFactory.createForClass(ProviderConnection);
ProviderConnectionSchema.index({ kind: 1, scope: 1 }, { unique: true });
ProviderConnectionSchema.index({ kind: 1, state: 1 });
