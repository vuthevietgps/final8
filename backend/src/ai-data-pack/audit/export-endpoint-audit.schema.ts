import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type AiDataPackEndpointAuditDocument =
  HydratedDocument<AiDataPackEndpointAudit>;

@Schema({
  collection: "ai_data_pack_endpoint_audits",
  timestamps: true,
})
export class AiDataPackEndpointAudit {
  @Prop({ required: true, trim: true, unique: true, index: true })
  auditId!: string;

  @Prop({ required: true, trim: true, index: true })
  event!: string;

  @Prop({ trim: true, index: true })
  actorId?: string | null;

  @Prop({ trim: true, index: true })
  jobId?: string | null;

  @Prop({ trim: true, index: true })
  status?: string;

  @Prop({ trim: true })
  reason?: string;

  @Prop({ trim: true, index: true })
  requestId?: string;

  @Prop({ trim: true, index: true })
  correlationId?: string;

  @Prop({ trim: true, index: true })
  routeTemplate?: string;

  @Prop({ trim: true, index: true })
  method?: string;

  @Prop({ trim: true })
  ipHash?: string;

  @Prop({ trim: true })
  userAgentHash?: string;

  @Prop({ type: Object })
  details?: Record<string, unknown>;

  @Prop({ required: true, default: false })
  canImportActionFile!: false;

  @Prop({ required: true, default: false })
  canDryRun!: false;

  @Prop({ required: true, default: false })
  canExecuteLive!: false;
}

export const AiDataPackEndpointAuditSchema = SchemaFactory.createForClass(
  AiDataPackEndpointAudit,
);

AiDataPackEndpointAuditSchema.index(
  { event: 1, createdAt: -1 },
  { name: "idx_ai_data_pack_endpoint_audit_event_created" },
);
AiDataPackEndpointAuditSchema.index(
  { actorId: 1, createdAt: -1 },
  { name: "idx_ai_data_pack_endpoint_audit_actor_created" },
);
AiDataPackEndpointAuditSchema.index(
  { jobId: 1, createdAt: -1 },
  { name: "idx_ai_data_pack_endpoint_audit_job_created" },
);
AiDataPackEndpointAuditSchema.index(
  { routeTemplate: 1, method: 1, createdAt: -1 },
  { name: "idx_ai_data_pack_endpoint_audit_route_method_created" },
);
AiDataPackEndpointAuditSchema.index(
  { correlationId: 1, createdAt: -1 },
  { name: "idx_ai_data_pack_endpoint_audit_correlation_created" },
);
