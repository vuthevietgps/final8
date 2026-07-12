import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GoogleAdsCampaignBudgetDocument = HydratedDocument<GoogleAdsCampaignBudget>;

@Schema({ collection: 'google_ads_campaign_budgets', timestamps: true })
export class GoogleAdsCampaignBudget {
  @Prop({ required: true, trim: true, match: /^\d+$/ })
  customerId: string;

  @Prop({ required: true, trim: true, match: /^\d+$/ })
  campaignBudgetId: string;

  @Prop({ required: true, trim: true, match: /^customers\/\d+\/campaignBudgets\/\d+$/ })
  resourceName: string;

  @Prop({ trim: true })
  name?: string;

  @Prop({ type: Number, min: 0 })
  amountMicros?: number;

  @Prop({ type: Number, min: 0 })
  amountVnd?: number;

  @Prop({ trim: true })
  deliveryMethod?: string;

  @Prop({ type: Boolean, default: false })
  explicitlyShared?: boolean;

  @Prop({ trim: true })
  status?: string;

  @Prop({ type: Date })
  lastSyncAt?: Date;
}

export const GoogleAdsCampaignBudgetSchema = SchemaFactory.createForClass(GoogleAdsCampaignBudget);

GoogleAdsCampaignBudgetSchema.index(
  { customerId: 1, campaignBudgetId: 1 },
  { unique: true, name: 'uniq_google_ads_budget_customer_budget' },
);
GoogleAdsCampaignBudgetSchema.index(
  { resourceName: 1 },
  { unique: true, name: 'uniq_google_ads_budget_resource_name' },
);
GoogleAdsCampaignBudgetSchema.index(
  { customerId: 1, status: 1, updatedAt: -1 },
  { name: 'idx_google_ads_budget_customer_status' },
);
