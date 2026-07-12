import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { SectionQuality } from '../contracts/metadata.contract';
import { findRows } from './query.util';

@Injectable()
export class CustomerLtvQuery {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async get() {
    const customers = await findRows(this.connection, 'customers', { isDisabled: { $ne: true } }, { latestOrderId: 1, productId: 1, latestPurchaseDate: 1, lastCalculated: 1 });
    const quality: SectionQuality = {
      source: 'customers derived from orders',
      source_table_or_service: 'customers',
      freshness_at: customers.length ? new Date(Math.max(...customers.map((row) => new Date(row.lastCalculated || row.latestPurchaseDate).getTime()))).toISOString() : null,
      period: 'current',
      calculation_method: 'Count only; no strong LTV because orders lack durable customerId.',
      data_quality_status: customers.length ? 'weak' : 'missing',
      confidence: 'low',
      missing_fields: ['durable_order_customer_relation', 'customer_source_campaign_relation', 'repeat_order_history_link'],
      warning: ['Do not use campaign LTV strongly. Customer mapping is approximate.'],
      can_use_for_decision: 'no',
      data_state: 'weak_mapping',
      empty_reason: 'weak_mapping',
    };
    return { ltv_summary: [{ customer_records: customers.length, ltv: null, status: 'unavailable' }], customers, quality };
  }
}
