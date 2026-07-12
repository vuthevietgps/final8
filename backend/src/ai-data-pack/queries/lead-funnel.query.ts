import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { SectionQuality } from '../contracts/metadata.contract';
import { dayRange, findRows } from './query.util';

@Injectable()
export class LeadFunnelQuery {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async get(date: string) {
    const { start, end } = dayRange(date);
    const leads = await findRows(this.connection, 'marketing_leads', { leadCreatedAt: { $gte: start, $lt: end } }, {
      sourcePlatform: 1, adAccountId: 1, campaignId: 1, adSetId: 1, adId: 1, adGroupId: 1,
      creativeId: 1, customerId: 1, assignedSaleId: 1, status: 1, firstResponseAt: 1,
      lastFollowUpAt: 1, responseSlaSeconds: 1, lostReason: 1, orderId: 1,
      revenue: 1, grossProfit: 1, netProfit: 1, leadCreatedAt: 1, updatedAt: 1,
    });
    const byStatus = leads.reduce((result, lead) => {
      result[lead.status || 'unknown'] = (result[lead.status || 'unknown'] || 0) + 1;
      return result;
    }, {} as Record<string, number>);
    const bySale = leads.reduce((result, lead) => {
      const id = lead.assignedSaleId ? String(lead.assignedSaleId) : 'unassigned';
      result[id] = (result[id] || 0) + 1;
      return result;
    }, {} as Record<string, number>);
    const quality: SectionQuality = {
      source: 'marketing_leads',
      source_table_or_service: 'marketing_leads',
      freshness_at: leads.length ? new Date(Math.max(...leads.map((row) => new Date(row.updatedAt || row.leadCreatedAt).getTime()))).toISOString() : null,
      period: 'custom',
      calculation_method: 'Read-only aggregation of lead status/source/mapping fields.',
      data_quality_status: leads.length ? 'partial' : 'missing',
      confidence: leads.length ? 'medium' : 'low',
      missing_fields: ['product_or_service_interest', 'assignment_history', 'call_activity_log', 'status_history'],
      warning: ['Some MarketingLead rows may be inferred from chat, pending orders or final orders.'],
      can_use_for_decision: leads.length ? 'cautious' : 'no',
      data_state: leads.length ? 'available' : 'no_records_for_report_date',
      empty_reason: leads.length ? null : 'no_records_for_report_date',
    };
    return {
      leads,
      sales_funnel: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      sales_team: Object.entries(bySale).map(([sale_id, lead_count]) => ({ sale_id, lead_count })),
      quality,
    };
  }
}
