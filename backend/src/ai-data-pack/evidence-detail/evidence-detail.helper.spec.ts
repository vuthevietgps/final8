import { buildEvidenceDetail } from './evidence-detail.helper';

describe('evidence detail helper', () => {
  it('builds deterministic read-only evidence rows with drilldown references', () => {
    const sourceOrder = {
      _id: 'order-1',
      productId: 'product-1',
      quantity: 3,
      orderDate: new Date('2026-06-12T00:00:00.000Z'),
      items: [{ productId: 'product-1', quantity: 3 }],
    };
    const result = buildEvidenceDetail({
      finding_key: 'low_inventory_best_seller',
      row: {
        finding_key: 'low_inventory_best_seller',
        affected_entity_type: 'product_or_sku',
        affected_entity_id: 'product-1',
        affected_entity_name_or_alias: 'Best Seller',
        metric_name: 'days_of_cover',
        metric_value: 0.5,
        threshold_value: 7,
        threshold_source_key: 'low_inventory.days_of_cover_threshold',
        threshold_unit: 'days',
        not_allowed_actions: 'manual_review_only; read_only_evidence',
      },
      source_rows: [{
        source_module: 'OperationsCapacityQuery',
        source_collection: 'ordertest2',
        entity_type: 'order',
        rows: [sourceOrder],
        source_field_names: ['_id', 'productId', 'quantity', 'orderDate', 'items.productId', 'items.quantity'],
        timestamp_fields: ['orderDate'],
      }],
      evidence_time_window: {
        label: 'recent orders',
        comparison_window_from: '2026-06-01T00:00:00.000Z',
        comparison_window_to: '2026-06-12T00:00:00.000Z',
      },
      evidence_direct_fields: ['ordertest2.quantity', 'ordertest2.orderDate'],
      evidence_derived_fields: ['sales_velocity_per_day', 'days_of_cover'],
      evidence_calculation_steps: [{
        step_key: 'days_of_cover',
        description: 'available quantity divided by sales velocity',
        input_fields: ['inventorysummaries.onHand', 'ordertest2.quantity'],
        output_field: 'days_of_cover',
        output_value: 0.5,
      }],
      evidence_missing_fields: ['reserved_quantity'],
      evidence_sample_limit: 5,
      recommended_manual_owner: 'Inventory manager',
      manual_review_question: 'Confirm stock and velocity?',
    });

    expect(result.evidence_row_count).toBe(1);
    expect(result.evidence_rows).toHaveLength(1);
    expect(result.evidence_rows[0]).toEqual(expect.objectContaining({
      entity_id: 'order-1',
      source_module: 'OperationsCapacityQuery',
      source_collection: 'ordertest2',
      source_row_id: 'order-1',
      timestamp: '2026-06-12T00:00:00.000Z',
      threshold_source_key: 'low_inventory.days_of_cover_threshold',
      calculation_step_ref: 'days_of_cover',
      drilldown_ref: 'ordertest2:order-1',
    }));
    expect(result.evidence_rows[0].raw_values_used['items.productId']).toBe('product-1');
    expect(result.evidence_drilldown_refs).toEqual([{
      source_collection: 'ordertest2',
      source_row_id: 'order-1',
      drilldown_ref: 'ordertest2:order-1',
      read_only: true,
    }]);
    expect(result.blocked_actions_summary).toContain('2 blocked advisory follow-ups');
    expect(result.top_evidence_entities).toContain('product_or_sku:Best Seller');
  });

  it('keeps source rows unchanged and reports missing evidence explicitly', () => {
    const sourceRows = [{ _id: 'sq-1', price: 100, effectiveAt: new Date('2026-06-01T00:00:00.000Z') }];
    const before = JSON.stringify(sourceRows);
    const result = buildEvidenceDetail({
      finding_key: 'supplier_cost_up',
      row: {
        finding_key: 'supplier_cost_up',
        metric_name: 'cost_increase_percent',
        metric_value: 20,
        threshold_value: 15,
      },
      source_rows: [{
        source_module: 'OperationsCapacityQuery',
        source_collection: 'supplierquotes',
        entity_type: 'supplier_quote',
        rows: sourceRows,
        source_field_names: ['_id', 'price', 'effectiveAt'],
        timestamp_fields: ['effectiveAt'],
      }],
      evidence_missing_fields: [],
      evidence_sample_limit: 1,
    });

    expect(JSON.stringify(sourceRows)).toBe(before);
    expect(result.evidence_missing_fields).toEqual(['none_known']);
    expect(result.evidence_missing_fields_summary).toBe('none_known');
    expect(result.evidence_rows[0].raw_values_used.price).toBe(100);
  });
});
