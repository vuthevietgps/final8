import { Injectable, Optional } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { SectionQuality } from '../contracts/metadata.contract';
import type { BuildEvidenceDetailInput } from '../evidence-detail/evidence-detail.contract';
import { buildEvidenceDetail } from '../evidence-detail/evidence-detail.helper';
import type { SeverityScoringInput } from '../severity-scoring/severity-scoring.contract';
import { scoreOperationalSeverity } from '../severity-scoring/severity-scoring.helper';
import type { SourceMetadataPart } from '../source-freshness/source-freshness.contract';
import { mergeSourceMetadata } from '../source-freshness/source-freshness.helper';
import { OperationalRiskFindingKey } from '../threshold-registry/threshold-source.contract';
import { ThresholdSourceResolver } from '../threshold-registry/threshold-source.resolver';
import { findRows } from './query.util';

const SOURCE_FRESHNESS_MAX_AGE_MINUTES = 60 * 24 * 45;

const OPERATIONAL_RISK_THRESHOLD_KEYS: Record<OperationalRiskFindingKey, readonly string[]> = {
  low_inventory_best_seller: [
    'low_inventory.days_of_cover_threshold',
    'low_inventory.sales_velocity_window',
    'low_inventory.bestseller_rank_window',
    'low_inventory.reorder_point',
  ],
  supplier_cost_up: [
    'supplier_cost.cost_increase_percent_threshold',
    'supplier_cost.supplier_quote_effective_date',
    'supplier_cost.dealer_price_lag_threshold',
  ],
  overdue_dealer_receivables: [
    'dealer_receivable.settlement_due_date_source',
    'dealer_receivable.outstanding_balance_formula',
    'dealer_receivable.overdue_aging_buckets',
  ],
  labor_overtime_high: [
    'labor.overtime_hours_threshold',
    'labor.work_hour_source_hierarchy',
    'labor.revenue_workload_window',
    'labor.overtime_growth_threshold',
  ],
  slow_supplier_good_cost: [
    'slow_supplier.cost_advantage_threshold',
    'slow_supplier.peer_quote_comparison_method',
    'slow_supplier.delivery_delay_threshold',
    'slow_supplier.expected_lead_time_source',
  ],
};

@Injectable()
export class OperationsCapacityQuery {
  private readonly thresholdSourceResolver: ThresholdSourceResolver;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Optional() thresholdSourceResolver?: ThresholdSourceResolver,
  ) {
    this.thresholdSourceResolver = thresholdSourceResolver || new ThresholdSourceResolver();
  }

  async get(asOfDateInput?: string) {
    const [orders, agentStatements, returnRequests, inventoryTransactions, purchaseOrders, inventorySummaries, products, deliveryStatuses, supplierQuotes, dealerQuotes, users, laborCosts, laborStatements] = await Promise.all([
      findRows(this.connection, 'ordertest2', { isActive: { $ne: false } }, {
        productId: 1, quantity: 1, isActive: 1, productionStatus: 1, orderStatus: 1, orderDate: 1, updatedAt: 1, createdAt: 1,
        agentId: 1, agentPaymentStatus: 1, agentPaymentDueDate: 1, agentPaidAt: 1, agentPaidAmount: 1, agentCommissionAmount: 1, agentCommissionFinal: 1,
        agentQuote: 1, agentAppliedPrice: 1, codAmount: 1, shippingFee: 1, manualPayment: 1, depositAmount: 1,
      }),
      findRows(this.connection, 'agentstatements', {
        $or: [{ notes: /late_payment_agent/i }, { status: 'open' }, { closingBalance: { $gt: 0 } }],
      }, {
        agentId: 1, status: 1, periodFrom: 1, periodTo: 1, openingBalance: 1, periodReceivables: 1,
        periodCollected: 1, statementPaymentTotal: 1, closingBalance: 1, netAfterDelivery: 1, payments: 1, notes: 1, updatedAt: 1, createdAt: 1,
      }),
      findRows(this.connection, 'returnrequests', {
        $or: [{ reason: /high_return_product/i }, { reason: /return_rate/i }, { 'items.notes': /return/i }],
      }, { orderId: 1, supplierId: 1, status: 1, reason: 1, items: 1, updatedAt: 1 }),
      findRows(this.connection, 'inventorytransactions', {
        $or: [
          { notes: /inventory_movement/i },
          { purchaseOrderId: { $exists: false } },
          { purchaseOrderId: null },
        ],
      }, { productId: 1, type: 1, quantity: 1, purchaseOrderId: 1, notes: 1, occurredAt: 1, updatedAt: 1 }),
      findRows(this.connection, 'purchaseorders', {}, { _id: 1, poNumber: 1, supplierId: 1, supplierNameSnap: 1, status: 1, expectedDeliveryDate: 1, items: 1, createdAt: 1, updatedAt: 1, receivedDate: 1 }),
      findRows(this.connection, 'inventorysummaries', {}, { productId: 1, onHand: 1, avgCost: 1, updatedAt: 1 }),
      findRows(this.connection, 'products', {}, { name: 1, sku: 1, minStock: 1, importPrice: 1, totalCost: 1, estimatedDeliveryDays: 1, suppliers: 1, updatedAt: 1 }),
      findRows(this.connection, 'deliverystatuses', {}, { name: 1, isActive: 1, isFinal: 1, isPaymentTrigger: 1, isReturnStatus: 1, updatedAt: 1 }),
      findRows(this.connection, 'supplierquotes', {}, {
        productId: 1, supplierId: 1, price: 1, currency: 1, effectiveAt: 1, note: 1, status: 1, approvalStatus: 1, createdAt: 1, updatedAt: 1,
      }),
      findRows(this.connection, 'quotes', {}, {
        productId: 1, agentId: 1, agentName: 1, unitPrice: 1, status: 1, validFrom: 1, validUntil: 1, isActive: 1, createdAt: 1, updatedAt: 1,
      }),
      findRows(this.connection, 'users', {}, { _id: 1, fullName: 1, role: 1, managerId: 1, isActive: 1, updatedAt: 1 }),
      findRows(this.connection, 'laborcost1', {}, {
        userId: 1, date: 1, startTime: 1, endTime: 1, workHours: 1, sessionCount: 1, hourlyRate: 1, cost: 1, notes: 1, paymentStatus: 1, createdAt: 1, updatedAt: 1,
      }),
      findRows(this.connection, 'laborstatements', {}, {
        employeeId: 1, periodFrom: 1, periodTo: 1, status: 1, periodCost: 1, totalWorkHours: 1, sessionCount: 1, closingBalance: 1, dueDate: 1, notes: 1, createdAt: 1, updatedAt: 1,
      }),
    ]);
    const asOfDate = this.asOfDate(asOfDateInput);
    const statusCounts = orders.reduce((result, row) => {
      const key = `${row.productionStatus || 'unknown'} / ${row.orderStatus || 'unknown'}`;
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {} as Record<string, number>);
    const purchaseOrderIds = new Set(purchaseOrders.map((row) => String(row._id)));
    const unmatchedInventoryTransactions = inventoryTransactions.filter((row) => {
      const purchaseOrderId = row.purchaseOrderId ? String(row.purchaseOrderId) : '';
      return !purchaseOrderId || !purchaseOrderIds.has(purchaseOrderId);
    });
    const operationalRiskFindings = this.operationalRiskFindings({
      agentStatements,
      returnRequests,
      unmatchedInventoryTransactions,
      lowInventoryBestSellerEvidence: this.lowInventoryBestSellerEvidence({
        orders,
        inventorySummaries,
        products,
        purchaseOrders,
        deliveryStatuses,
        asOfDate,
      }),
      supplierCostUpEvidence: this.supplierCostUpEvidence({
        supplierQuotes,
        dealerQuotes,
        products,
        asOfDate,
      }),
      slowSupplierGoodCostEvidence: this.slowSupplierGoodCostEvidence({
        supplierQuotes,
        purchaseOrders,
        products,
        inventorySummaries,
        users,
        asOfDate,
      }),
      overdueDealerReceivablesEvidence: this.overdueDealerReceivablesEvidence({
        orders,
        agentStatements,
        users,
        asOfDate,
      }),
      laborOvertimeHighEvidence: this.laborOvertimeHighEvidence({
        laborCosts,
        laborStatements,
        orders,
        users,
        asOfDate,
      }),
    });
    const quality: SectionQuality = {
      source: 'ordertest2 status counts + agent statements + return requests + inventory movement checks + read-only inventory bestseller, supplier cost, supplier reliability, dealer receivable, and labor overtime evidence',
      source_table_or_service: 'ordertest2, agentstatements, returnrequests, inventorytransactions, purchaseorders, inventorysummaries, products, deliverystatuses, supplierquotes, quotes, users, laborcost1, laborstatements',
      freshness_at: this.latestFreshness([...orders, ...agentStatements, ...returnRequests, ...inventoryTransactions, ...purchaseOrders, ...inventorySummaries, ...products, ...deliveryStatuses, ...supplierQuotes, ...dealerQuotes, ...users, ...laborCosts, ...laborStatements]),
      period: 'current',
      calculation_method: 'Open order counts by current status plus deterministic operational risk signals surfaced for Director demo review.',
      data_quality_status: orders.length ? 'weak' : 'missing',
      confidence: 'low',
      missing_fields: ['capacity_baseline', 'deadline_sla', 'status_history', 'staff_availability', 'canonical_reserved_quantity', 'confirmed_incoming_stock_status', 'supplier_quote_approval_status', 'product_cost_history', 'supplier_reliability_score', 'supplier_delivery_quality_notes', 'supplier_lead_time_policy_threshold', 'collection_owner_if_missing', 'last_payment_date_if_missing', 'overtime_policy_threshold', 'staff_capacity_for_labor'],
      warning: [
        'Current data cannot determine remaining operation capacity.',
        ...operationalRiskFindings.map((row) => `Surfaced operational risk finding: ${row.finding_key}`),
      ],
      can_use_for_decision: 'no',
      data_state: orders.length ? 'weak_mapping' : 'missing',
      empty_reason: orders.length ? null : 'missing',
    };
    return {
      operation_capacity: [
        ...Object.entries(statusCounts).map(([status, count]) => ({ status, count, capacity_remaining: null })),
        ...operationalRiskFindings,
      ],
      operational_risk_findings: operationalRiskFindings,
      quality,
    };
  }

  private operationalRiskFindings(input: {
    agentStatements: any[];
    returnRequests: any[];
    unmatchedInventoryTransactions: any[];
    lowInventoryBestSellerEvidence: any[];
    supplierCostUpEvidence: any[];
    slowSupplierGoodCostEvidence: any[];
    overdueDealerReceivablesEvidence: any[];
    laborOvertimeHighEvidence: any[];
  }) {
    const findings: any[] = [];
    if (input.agentStatements.length) {
      findings.push({
        status: 'risk_signal',
        finding_key: 'high_sales_late_payment_agent',
        source_collection: 'agentstatements',
        affected_count: input.agentStatements.length,
        max_period_collected: Math.max(...input.agentStatements.map((row) => Number(row.periodCollected || 0))),
        max_closing_balance: Math.max(...input.agentStatements.map((row) => Number(row.closingBalance || 0))),
        evidence_note: 'late_payment_agent',
        capacity_remaining: null,
      });
    }
    if (input.returnRequests.length) {
      findings.push({
        status: 'risk_signal',
        finding_key: 'return_rate_above_policy_for_single_offer',
        alias: 'return_rate_above_policy',
        source_collection: 'returnrequests',
        affected_count: input.returnRequests.length,
        pending_count: input.returnRequests.filter((row) => row.status === 'pending').length,
        evidence_note: 'high_return_product',
        capacity_remaining: null,
      });
    }
    if (input.unmatchedInventoryTransactions.length) {
      findings.push({
        status: 'risk_signal',
        finding_key: 'inventory_movement_without_matching_purchase_order',
        alias: 'inventory_movement_gap',
        source_collection: 'inventorytransactions',
        affected_count: input.unmatchedInventoryTransactions.length,
        sample_product_id: input.unmatchedInventoryTransactions[0]?.productId ? String(input.unmatchedInventoryTransactions[0].productId) : null,
        evidence_note: 'inventory_movement_without_matching_purchase_order',
        capacity_remaining: null,
      });
    }
    findings.push(...input.lowInventoryBestSellerEvidence);
    findings.push(...input.supplierCostUpEvidence);
    findings.push(...input.slowSupplierGoodCostEvidence);
    findings.push(...input.overdueDealerReceivablesEvidence);
    findings.push(...input.laborOvertimeHighEvidence);
    return findings;
  }

  private lowInventoryBestSellerEvidence(input: {
    orders: any[];
    inventorySummaries: any[];
    products: any[];
    purchaseOrders: any[];
    deliveryStatuses: any[];
    asOfDate: Date;
  }) {
    const productById = new Map<string, any>();
    for (const product of input.products) {
      const productId = this.entityId(product?._id);
      if (productId) {
        productById.set(productId, product);
      }
    }

    const inventoryByProductId = new Map<string, any>();
    for (const summary of input.inventorySummaries) {
      const productId = this.entityId(summary?.productId);
      if (productId && this.finiteNumber(summary?.onHand) !== null) {
        inventoryByProductId.set(productId, summary);
      }
    }

    const salesByProductId = new Map<string, {
      orderCount: number;
      quantity: number;
      firstOrderAt: number | null;
      lastOrderAt: number | null;
    }>();
    for (const order of input.orders) {
      if (order?.isActive === false) {
        continue;
      }
      const productId = this.entityId(order?.productId);
      const quantity = this.finiteNumber(order?.quantity);
      if (!productId || quantity === null || quantity <= 0) {
        continue;
      }
      const timestamp = this.timestamp(order?.orderDate || order?.updatedAt || order?.createdAt);
      const current = salesByProductId.get(productId) || {
        orderCount: 0,
        quantity: 0,
        firstOrderAt: null,
        lastOrderAt: null,
      };
      current.orderCount += 1;
      current.quantity += quantity;
      if (timestamp !== null) {
        current.firstOrderAt = current.firstOrderAt === null ? timestamp : Math.min(current.firstOrderAt, timestamp);
        current.lastOrderAt = current.lastOrderAt === null ? timestamp : Math.max(current.lastOrderAt, timestamp);
      }
      salesByProductId.set(productId, current);
    }

    const daysOfCoverThreshold = 7;
    return Array.from(salesByProductId.entries())
      .sort(([, left], [, right]) => right.quantity - left.quantity || right.orderCount - left.orderCount)
      .map(([productId, stats], index) => ({
        productId,
        stats,
        bestsellerRank: index + 1,
      }))
      .map((candidate) => {
        const product = productById.get(candidate.productId);
        const inventory = inventoryByProductId.get(candidate.productId);
        const currentInventory = this.finiteNumber(inventory?.onHand);
        const reorderThreshold = this.finiteNumber(product?.minStock);
        if (!product || !inventory || currentInventory === null || reorderThreshold === null) {
          return null;
        }
        if (candidate.stats.firstOrderAt === null || candidate.stats.lastOrderAt === null) {
          return null;
        }

        const orderWindowDays = Math.max(
          1,
          Math.ceil((candidate.stats.lastOrderAt - candidate.stats.firstOrderAt) / 86_400_000) + 1,
        );
        const salesVelocityPerDay = candidate.stats.quantity / orderWindowDays;
        if (salesVelocityPerDay <= 0) {
          return null;
        }

        const reserved = this.reservedQuantityCandidate(candidate.productId, input.orders, input.deliveryStatuses);
        const incoming = this.incomingStockQuantityCandidate(candidate.productId, input.purchaseOrders);
        const availableQuantity = Math.max(0, currentInventory - reserved.quantity);
        const projectedAvailableQuantity = Math.max(0, availableQuantity + incoming.quantity);
        const daysOfCover = availableQuantity / salesVelocityPerDay;
        const projectedDaysOfCover = projectedAvailableQuantity / salesVelocityPerDay;
        const belowReorderThreshold = availableQuantity <= reorderThreshold;
        const belowDaysOfCoverThreshold = daysOfCover <= daysOfCoverThreshold;
        if (!belowReorderThreshold && !belowDaysOfCoverThreshold) {
          return null;
        }
        const thresholdMetadata = this.thresholdMetadata('low_inventory_best_seller', input.asOfDate, [
          'reserved_quantity_candidate',
          'incoming_stock_quantity_candidate',
          'confirmed_incoming_stock_status',
        ]);
        const productOrders = input.orders.filter((order) => this.entityId(order?.productId) === candidate.productId);
        const productPurchaseOrders = input.purchaseOrders.filter((purchaseOrder) => {
          const items = Array.isArray(purchaseOrder?.items) ? purchaseOrder.items : [];
          return items.some((item: any) => this.entityId(item?.productId) === candidate.productId);
        });
        const sourceMetadata = this.sourceFreshnessMetadata('low_inventory_best_seller', input.asOfDate, [
          { rows: inventory ? [inventory] : [], timestampFields: ['updatedAt'], sampleSize: inventory ? 1 : 0, missingReason: 'inventorysummary_missing_for_product' },
          { rows: product ? [product] : [], timestampFields: ['updatedAt'], sampleSize: product ? 1 : 0, missingReason: 'product_missing_for_inventory_finding' },
          { rows: productOrders, timestampFields: ['orderDate', 'updatedAt', 'createdAt'], sampleSize: candidate.stats.orderCount, missingReason: 'recent_order_velocity_missing' },
          { rows: productPurchaseOrders, timestampFields: ['updatedAt', 'createdAt', 'expectedDeliveryDate', 'receivedDate'], sampleSize: incoming.purchaseOrderCount },
          { rows: input.deliveryStatuses, timestampFields: ['updatedAt'], sampleSize: input.deliveryStatuses.length },
        ], 'Source timestamps are row-local and fresh enough for advisory evidence; reserved, incoming, and projected inventory values remain derived candidates.');

        const row = {
          status: 'risk_signal',
          finding_key: 'low_inventory_best_seller',
          finding_label: 'best_selling_product_low_inventory',
          evidence_strength: 'medium',
          source_domain: 'inventory',
          source_collection: 'inventorysummaries',
          source_collections_or_modules: 'inventorysummaries, products, ordertest2, purchaseorders, deliverystatuses',
          time_window: `${orderWindowDays} day order velocity window`,
          affected_entity_type: 'product_or_sku',
          affected_entity_id: candidate.productId,
          affected_entity_name_or_alias: product.name || product.sku || candidate.productId,
          sku: product.sku || null,
          bestseller_rank: candidate.bestsellerRank,
          current_inventory_quantity: currentInventory,
          reserved_quantity: reserved.quantity,
          reserved_quantity_candidate: reserved.quantity,
          reserved_quantity_source: reserved.source,
          reserved_order_count: reserved.orderCount,
          reserved_statuses_included: reserved.statusesIncluded,
          reserved_statuses_excluded_or_ambiguous: reserved.statusesExcludedOrAmbiguous,
          available_quantity: availableQuantity,
          available_quantity_formula: 'max(0, inventorysummaries.onHand - reserved_quantity_candidate)',
          available_quantity_assumption: 'reserved quantity is a derived candidate from active non-final/non-payment/non-return order statuses; not a canonical inventory reservation.',
          reorder_threshold: reorderThreshold,
          reorder_threshold_source: 'products.minStock',
          incoming_stock_quantity: incoming.quantity,
          incoming_stock_quantity_candidate: incoming.quantity,
          incoming_stock_source: incoming.source,
          incoming_purchase_order_count: incoming.purchaseOrderCount,
          incoming_expected_delivery_dates: incoming.expectedDeliveryDates,
          incoming_statuses_included: incoming.statusesIncluded,
          incoming_statuses_excluded_or_ambiguous: incoming.statusesExcludedOrAmbiguous,
          projected_available_quantity: projectedAvailableQuantity,
          projected_available_quantity_formula: 'max(0, inventorysummaries.onHand - reserved_quantity_candidate + incoming_stock_quantity_candidate)',
          projected_days_of_cover: this.roundMetric(projectedDaysOfCover, 2),
          recent_order_count: candidate.stats.orderCount,
          recent_order_quantity: candidate.stats.quantity,
          sales_velocity_per_day: this.roundMetric(salesVelocityPerDay, 4),
          days_of_cover: this.roundMetric(daysOfCover, 2),
          metric_name: 'days_of_cover',
          metric_value: this.roundMetric(daysOfCover, 2),
          threshold_value: `minStock=${reorderThreshold}; days_of_cover_threshold=${daysOfCoverThreshold}`,
          comparison_period: `${orderWindowDays} day order velocity window`,
          calculation_method: 'reserved_quantity_candidate = active non-final/non-payment/non-return order quantity; incoming_stock_quantity_candidate = ordered/partially_received PO unreceived quantity; available_quantity = max(0, inventorysummaries.onHand - reserved_quantity_candidate); days_of_cover = available_quantity / sales_velocity_per_day',
          sample_size: candidate.stats.orderCount,
          data_quality_status: 'partial',
          confidence: 'medium',
          ...thresholdMetadata,
          ...sourceMetadata,
          blocking_reason_if_any: 'reserved_quantity_candidate and incoming_stock_quantity_candidate are derived read-only semantics, not canonical reservation or confirmed incoming stock; row is advisory-only and cannot support purchase/replenishment action.',
          recommended_advisory_language: 'This best-selling product appears to have low available stock relative to sales velocity. Review replenishment manually after confirming reserved quantity, incoming stock, and reorder threshold.',
          evidence_note: 'low_inventory_best_seller_reserved_incoming_readonly',
          inventory_semantics_data_quality_notes: [
            'reserved_quantity_candidate is derived from order status metadata or safe fallback statuses.',
            'incoming_stock_quantity_candidate is derived from ordered and partially_received purchase order item quantities not yet received.',
            'inventorybatches.quantityRemaining is not counted as incoming stock because it represents received batch stock remaining.',
            'Evidence remains partial and advisory-only.',
          ],
          not_allowed_actions: 'do_not_create_purchase_order; do_not_mutate_inventory; do_not_execute_replenishment',
          capacity_remaining: null,
        };
        return this.withEvidenceAndSeverity(row, {
          source_rows: [
            {
              source_module: 'OperationsCapacityQuery',
              source_collection: 'inventorysummaries',
              entity_type: 'inventory_summary',
              rows: inventory ? [inventory] : [],
              source_field_names: ['productId', 'onHand', 'avgCost', 'updatedAt'],
              timestamp_fields: ['updatedAt'],
            },
            {
              source_module: 'OperationsCapacityQuery',
              source_collection: 'products',
              entity_type: 'product',
              rows: product ? [product] : [],
              source_field_names: ['_id', 'name', 'sku', 'minStock', 'estimatedDeliveryDays', 'updatedAt'],
              timestamp_fields: ['updatedAt'],
              entity_name_fields: ['name', 'sku'],
            },
            {
              source_module: 'OperationsCapacityQuery',
              source_collection: 'ordertest2',
              entity_type: 'order',
              rows: productOrders,
              source_field_names: ['_id', 'productId', 'quantity', 'orderStatus', 'productionStatus', 'orderDate', 'updatedAt', 'createdAt'],
              timestamp_fields: ['orderDate', 'updatedAt', 'createdAt'],
            },
            {
              source_module: 'OperationsCapacityQuery',
              source_collection: 'purchaseorders',
              entity_type: 'purchase_order',
              rows: productPurchaseOrders,
              source_field_names: ['_id', 'poNumber', 'status', 'expectedDeliveryDate', 'receivedDate', 'items.productId', 'items.quantity', 'items.quantityReceived', 'updatedAt', 'createdAt'],
              timestamp_fields: ['updatedAt', 'createdAt', 'expectedDeliveryDate', 'receivedDate'],
              entity_name_fields: ['poNumber', 'status'],
            },
            {
              source_module: 'OperationsCapacityQuery',
              source_collection: 'deliverystatuses',
              entity_type: 'delivery_status',
              rows: input.deliveryStatuses,
              source_field_names: ['name', 'isActive', 'isFinal', 'isPaymentTrigger', 'isReturnStatus', 'updatedAt'],
              timestamp_fields: ['updatedAt'],
              entity_name_fields: ['name'],
            },
          ],
          evidence_entities: [{
            entity_id: candidate.productId,
            entity_name_or_alias: product.name || product.sku || candidate.productId,
            entity_type: 'product_or_sku',
          }],
          evidence_time_window: {
            label: `${orderWindowDays} day order velocity window`,
            comparison_window_from: new Date(candidate.stats.firstOrderAt).toISOString(),
            comparison_window_to: new Date(candidate.stats.lastOrderAt).toISOString(),
          },
          evidence_direct_fields: ['inventorysummaries.onHand', 'products.minStock', 'ordertest2.quantity', 'ordertest2.orderDate', 'purchaseorders.items.quantity', 'purchaseorders.items.quantityReceived'],
          evidence_derived_fields: ['reserved_quantity_candidate', 'incoming_stock_quantity_candidate', 'available_quantity', 'projected_available_quantity', 'sales_velocity_per_day', 'days_of_cover', 'projected_days_of_cover'],
          evidence_calculation_steps: [
            {
              step_key: 'sales_velocity_per_day',
              description: 'Sum recent order quantity and divide by the observed order window days.',
              input_fields: ['ordertest2.quantity', 'ordertest2.orderDate'],
              output_field: 'sales_velocity_per_day',
              output_value: this.roundMetric(salesVelocityPerDay, 4),
            },
            {
              step_key: 'days_of_cover',
              description: 'Compute available quantity after reserved candidate and divide by sales velocity.',
              input_fields: ['inventorysummaries.onHand', 'reserved_quantity_candidate', 'sales_velocity_per_day'],
              output_field: 'days_of_cover',
              output_value: this.roundMetric(daysOfCover, 2),
            },
          ],
          evidence_threshold_comparison: {
            metric_name: 'days_of_cover',
            metric_value: this.roundMetric(daysOfCover, 2),
            threshold_value: daysOfCoverThreshold,
            threshold_source_key: thresholdMetadata.threshold_source_key,
            threshold_unit: thresholdMetadata.threshold_unit,
            comparison_operator: '<=',
            comparison_result: belowDaysOfCoverThreshold ? 'breached' : 'not_breached_but_reorder_threshold_breached',
          },
          evidence_source_freshness: sourceMetadata,
          evidence_missing_fields: thresholdMetadata.missing_or_weak_fields,
          evidence_verification_fields: ['current_inventory_quantity', 'reserved_quantity_candidate', 'incoming_stock_quantity_candidate', 'sales_velocity_per_day', 'days_of_cover', 'reorder_threshold'],
          evidence_sample_limit: 10,
          recommended_manual_owner: 'Inventory / Purchasing manager',
          manual_review_question: 'Can inventory and purchasing confirm reserved quantity, incoming stock, and reorder threshold before making any replenishment decision?',
          reason_row_was_emitted: 'Best-selling product breached available stock or days-of-cover advisory threshold.',
          reason_action_is_blocked: row.blocking_reason_if_any,
        }, {
          threshold_breach_magnitude: Math.max(
            0,
            ((daysOfCoverThreshold - daysOfCover) / Math.max(daysOfCoverThreshold, 1)) * 100,
            ((reorderThreshold - availableQuantity) / Math.max(reorderThreshold, 1)) * 100,
          ),
          impact_estimate: Math.min(100, candidate.stats.quantity),
          repeated_occurrence: candidate.stats.orderCount,
          direct_evidence_ratio: 0.65,
          direct_breach_is_extreme: projectedDaysOfCover <= 1,
        });
      })
      .filter(Boolean)
      .slice(0, 5);
  }

  private overdueDealerReceivablesEvidence(input: {
    orders: any[];
    agentStatements: any[];
    users: any[];
    asOfDate: Date;
  }) {
    const usersById = new Map<string, any>();
    for (const user of input.users) {
      const userId = this.entityId(user?._id);
      if (userId) {
        usersById.set(userId, user);
      }
    }

    const statementsByAgentId = new Map<string, any[]>();
    const lastPaymentByAgentId = new Map<string, any>();
    for (const statement of input.agentStatements) {
      const agentId = this.entityId(statement?.agentId);
      if (!agentId) {
        continue;
      }
      statementsByAgentId.set(agentId, [...(statementsByAgentId.get(agentId) || []), statement]);
      const payments = Array.isArray(statement?.payments) ? statement.payments : [];
      for (const payment of payments) {
        const paidAt = this.timestamp(payment?.paidAt || payment?.paymentDate);
        if (paidAt === null) {
          continue;
        }
        const current = lastPaymentByAgentId.get(agentId);
        const currentPaidAt = this.timestamp(current?.paidAt || current?.paymentDate);
        if (!current || currentPaidAt === null || paidAt > currentPaidAt) {
          lastPaymentByAgentId.set(agentId, payment);
        }
      }
    }

    const rows: any[] = [];
    const asOfTimestamp = input.asOfDate.getTime();
    for (const order of input.orders) {
      const paymentStatusKey = this.statusKey(order?.agentPaymentStatus);
      if (order?.isActive === false || paymentStatusKey === 'paid' || paymentStatusKey === 'na') {
        continue;
      }

      const agentId = this.entityId(order?.agentId);
      if (!agentId) {
        continue;
      }

      const dueAt = this.timestamp(order?.agentPaymentDueDate);
      if (dueAt === null) {
        continue;
      }

      const daysOverdue = Math.floor((asOfTimestamp - dueAt) / 86_400_000);
      if (daysOverdue <= 0) {
        continue;
      }

      const outstandingBalance = this.outstandingAgentBalance(order);
      if (outstandingBalance === null || outstandingBalance <= 0) {
        continue;
      }

      const agent = usersById.get(agentId);
      const statements = statementsByAgentId.get(agentId) || [];
      const lastPayment = lastPaymentByAgentId.get(agentId) || null;
      const lastPaymentDate = this.isoDateOnly(lastPayment?.paidAt || lastPayment?.paymentDate);
      const lastPaymentAmount = this.finiteNumber(lastPayment?.amount);
      const collectionOwner = this.entityId(agent?.managerId) || lastPayment?.createdBy || null;
      const originalAmount = this.originalAgentOrderAmount(order) ?? outstandingBalance;
      const paidAmount = paymentStatusKey === 'paid' ? (this.finiteNumber(order?.agentPaidAmount) ?? 0) : 0;
      const confidence = lastPaymentDate && collectionOwner ? 'medium' : 'low';
      const missingOrWeakFields = [
        ...(lastPaymentDate ? [] : ['last_payment_date']),
        ...(collectionOwner ? [] : ['collection_owner']),
        ...(statements.length ? [] : ['agent_statement_linkage']),
        'receivable_payable_terminology_boundary',
      ];
      const thresholdMetadata = this.thresholdMetadata('overdue_dealer_receivables', input.asOfDate, missingOrWeakFields);
      const sourceMetadata = this.sourceFreshnessMetadata('overdue_dealer_receivables', input.asOfDate, [
        { rows: [order], timestampFields: ['agentPaymentDueDate', 'agentPaidAt', 'orderDate', 'updatedAt', 'createdAt'], sampleSize: 1, missingReason: 'order_due_date_or_payment_timestamp_missing' },
        { rows: statements, timestampFields: ['periodTo', 'periodFrom', 'payments.paidAt', 'updatedAt', 'createdAt'], sampleSize: statements.length },
        { rows: agent ? [agent] : [], timestampFields: ['updatedAt'], sampleSize: agent ? 1 : 0, missingReason: 'agent_user_row_missing' },
      ], 'Source timestamps are row-local; outstanding balance, aging, and owner inference remain derived settlement-pressure candidates.');

      const row = {
        status: 'risk_signal',
        finding_key: 'overdue_dealer_receivables',
        finding_label: 'overdue_dealer_receivables_for_high_revenue_agent',
        evidence_strength: confidence === 'medium' ? 'medium' : 'weak',
        source_domain: 'receivables',
        source_collection: 'ordertest2',
        source_collections_or_modules: 'ordertest2, agentstatements, users',
        time_window: `as_of_${this.isoDateOnly(input.asOfDate)}`,
        affected_entity_type: 'dealer_or_agent',
        affected_entity_id: agentId,
        affected_entity_name_or_alias: agent?.fullName || `agent:${agentId}`,
        dealer_or_agent_id: agentId,
        dealer_or_agent_alias: agent?.fullName || `agent:${agentId}`,
        outstanding_balance: outstandingBalance,
        overdue_balance: outstandingBalance,
        due_date: this.isoDateOnly(dueAt),
        days_overdue: daysOverdue,
        aging_bucket: this.agingBucket(daysOverdue),
        last_payment_date: lastPaymentDate,
        last_payment_amount: lastPaymentAmount,
        original_invoice_or_order_amount: originalAmount,
        paid_amount: paidAmount,
        invoice_or_order_id: this.entityId(order?._id),
        collection_owner: collectionOwner,
        payment_terms_or_threshold_source: 'ordertest2.agentPaymentDueDate; overdue when due_date < as_of_report_date',
        linked_statement_count: statements.length,
        related_statement_ids: statements.map((statement) => this.entityId(statement?._id)).filter(Boolean).slice(0, 5),
        metric_name: 'overdue_balance_by_aging_bucket',
        metric_value: outstandingBalance,
        threshold_value: 'due_date_before_as_of_report_date',
        comparison_period: `as_of_report_date=${this.isoDateOnly(input.asOfDate)}`,
        calculation_method: 'days_overdue = floor((as_of_report_date - ordertest2.agentPaymentDueDate) / 1 day); overdue_balance = pending positive agent payment amount from ordertest2; aging_bucket derived from days_overdue',
        sample_size: 1,
        data_quality_status: 'partial',
        confidence,
        ...thresholdMetadata,
        ...sourceMetadata,
        blocking_reason_if_any: 'Evidence is advisory-only: current ERP agent receivable/payable terminology is settlement-oriented and must not support collection, agent blocking, payment, cashflow, or provider action without approved workflow.',
        recommended_advisory_language: 'Receivables show possible overdue dealer or agent settlement pressure. Review aging buckets, payment history, and owner follow-up before making collection or sales policy decisions.',
        evidence_note: 'overdue_dealer_receivables_readonly',
        receivable_semantics_note: 'AgentStatement module is named receivable in routes but schema comments describe company payable to agent; treat this row as dealer/agent settlement-pressure evidence, not proof of dealer fault or collectible cash-in.',
        not_allowed_actions: 'do_not_create_collection_action; do_not_block_agent; do_not_mutate_customer; do_not_mutate_invoice_or_order; do_not_mutate_cashflow; do_not_execute_ads_actions',
        capacity_remaining: null,
      };
      rows.push(this.withEvidenceAndSeverity(row, {
        source_rows: [
          {
            source_module: 'OperationsCapacityQuery',
            source_collection: 'ordertest2',
            entity_type: 'order_receivable',
            rows: [order],
            source_field_names: ['_id', 'agentId', 'agentPaymentStatus', 'agentPaymentDueDate', 'agentPaidAt', 'agentPaidAmount', 'agentCommissionAmount', 'agentCommissionFinal', 'agentQuote', 'agentAppliedPrice', 'orderDate', 'updatedAt', 'createdAt'],
            timestamp_fields: ['agentPaymentDueDate', 'agentPaidAt', 'orderDate', 'updatedAt', 'createdAt'],
          },
          {
            source_module: 'OperationsCapacityQuery',
            source_collection: 'agentstatements',
            entity_type: 'agent_statement',
            rows: statements,
            source_field_names: ['_id', 'agentId', 'status', 'periodFrom', 'periodTo', 'closingBalance', 'periodCollected', 'payments.paidAt', 'payments.amount', 'updatedAt', 'createdAt'],
            timestamp_fields: ['periodTo', 'periodFrom', 'payments.paidAt', 'updatedAt', 'createdAt'],
          },
          {
            source_module: 'OperationsCapacityQuery',
            source_collection: 'users',
            entity_type: 'dealer_or_agent',
            rows: agent ? [agent] : [],
            source_field_names: ['_id', 'fullName', 'role', 'managerId', 'isActive', 'updatedAt'],
            timestamp_fields: ['updatedAt'],
            entity_name_fields: ['fullName'],
          },
        ],
        evidence_entities: [{
          entity_id: agentId,
          entity_name_or_alias: agent?.fullName || `agent:${agentId}`,
          entity_type: 'dealer_or_agent',
        }],
        evidence_time_window: {
          label: `as_of_${this.isoDateOnly(input.asOfDate)}`,
          comparison_window_from: new Date(dueAt).toISOString(),
          comparison_window_to: input.asOfDate.toISOString(),
        },
        evidence_direct_fields: ['ordertest2.agentPaymentDueDate', 'ordertest2.agentPaidAmount', 'ordertest2.agentCommissionFinal', 'agentstatements.payments.paidAt', 'users.managerId'],
        evidence_derived_fields: ['days_overdue', 'overdue_balance', 'aging_bucket', 'collection_owner'],
        evidence_calculation_steps: [
          {
            step_key: 'days_overdue',
            description: 'Compute elapsed days between report date and agent payment due date.',
            input_fields: ['ordertest2.agentPaymentDueDate'],
            output_field: 'days_overdue',
            output_value: daysOverdue,
          },
          {
            step_key: 'overdue_balance',
            description: 'Use pending positive agent payment amount as settlement pressure candidate.',
            input_fields: ['ordertest2.agentPaymentStatus', 'ordertest2.agentPaidAmount', 'ordertest2.agentCommissionFinal'],
            output_field: 'overdue_balance',
            output_value: outstandingBalance,
          },
        ],
        evidence_threshold_comparison: {
          metric_name: 'overdue_balance_by_aging_bucket',
          metric_value: outstandingBalance,
          threshold_value: 'due_date_before_as_of_report_date',
          threshold_source_key: thresholdMetadata.threshold_source_key,
          threshold_unit: thresholdMetadata.threshold_unit,
          comparison_operator: 'due_date < as_of_date',
          comparison_result: 'breached',
        },
        evidence_source_freshness: sourceMetadata,
        evidence_missing_fields: thresholdMetadata.missing_or_weak_fields,
        evidence_verification_fields: ['dealer_or_agent_id', 'due_date', 'days_overdue', 'overdue_balance', 'last_payment_date', 'collection_owner'],
        evidence_sample_limit: 10,
        recommended_manual_owner: 'Finance / Sales operations owner',
        manual_review_question: 'Can finance confirm the settlement semantics, aging bucket, last payment, and owner before any collection follow-up?',
        reason_row_was_emitted: 'Dealer or agent settlement row has a positive overdue balance after due date.',
        reason_action_is_blocked: row.blocking_reason_if_any,
      }, {
        threshold_breach_magnitude: Math.min(100, daysOverdue * 5),
        impact_estimate: Math.min(100, outstandingBalance / 100000),
        repeated_occurrence: statements.length,
        direct_evidence_ratio: 0.75,
        direct_breach_is_extreme: daysOverdue >= 30,
      }));
    }

    return rows
      .sort((left, right) => right.days_overdue - left.days_overdue || right.overdue_balance - left.overdue_balance)
      .slice(0, 5);
  }

  private laborOvertimeHighEvidence(input: {
    laborCosts: any[];
    laborStatements: any[];
    orders: any[];
    users: any[];
    asOfDate: Date;
  }) {
    const usersById = new Map<string, any>();
    for (const user of input.users) {
      const userId = this.entityId(user?._id);
      if (userId) {
        usersById.set(userId, user);
      }
    }

    const window = this.comparisonWindow(input.asOfDate, 7);
    const currentLaborByUser = this.laborWindowStats(input.laborCosts, window.currentStart, window.currentEnd);
    const priorLaborByUser = this.laborWindowStats(input.laborCosts, window.priorStart, window.priorEnd);
    const currentWorkload = this.orderWindowStats(input.orders, window.currentStart, window.currentEnd);
    const priorWorkload = this.orderWindowStats(input.orders, window.priorStart, window.priorEnd);
    if (currentWorkload.orderCount <= 0 || priorWorkload.orderCount <= 0 || priorWorkload.revenue <= 0) {
      return [];
    }

    const revenueGrowthPercent = this.percentGrowth(currentWorkload.revenue, priorWorkload.revenue);
    if (revenueGrowthPercent === null) {
      return [];
    }

    const rows: any[] = [];
    for (const [userId, currentLabor] of currentLaborByUser.entries()) {
      const priorLabor = priorLaborByUser.get(userId);
      if (!priorLabor || currentLabor.overtimeHours <= 0 || priorLabor.overtimeHours <= 0) {
        continue;
      }

      const overtimeGrowthPercent = this.percentGrowth(currentLabor.overtimeHours, priorLabor.overtimeHours);
      if (overtimeGrowthPercent === null || overtimeGrowthPercent <= revenueGrowthPercent) {
        continue;
      }

      const laborCostGrowthPercent = this.percentGrowth(currentLabor.cost, priorLabor.cost);
      const employee = usersById.get(userId);
      const statements = input.laborStatements.filter((statement) => this.entityId(statement?.employeeId) === userId);
      const thresholdMetadata = this.thresholdMetadata('labor_overtime_high', input.asOfDate, [
        'canonical_overtime_policy_threshold',
        'sla_or_deadline_pressure',
        'staff_capacity',
        'team_mapping',
      ]);
      const relatedLaborCosts = input.laborCosts.filter((row) =>
        this.entityId(row?.userId) === userId && this.isTimestampInWindow(row?.date || row?.updatedAt || row?.createdAt, window.priorStart, window.currentEnd),
      );
      const relatedLaborStatements = statements.filter((statement) =>
        this.windowOverlaps(statement?.periodFrom, statement?.periodTo, window.priorStart, window.currentEnd),
      );
      const relatedOrders = input.orders.filter((order) =>
        this.isTimestampInWindow(order?.orderDate || order?.updatedAt || order?.createdAt, window.priorStart, window.currentEnd),
      );
      const sourceMetadata = this.sourceFreshnessMetadata('labor_overtime_high', input.asOfDate, [
        { rows: relatedLaborCosts, timestampFields: ['date', 'updatedAt', 'createdAt'], sampleSize: currentLabor.sessionCount + priorLabor.sessionCount, missingReason: 'labor_cost_window_missing' },
        { rows: relatedLaborStatements, timestampFields: ['periodTo', 'periodFrom', 'dueDate', 'updatedAt', 'createdAt'], sampleSize: relatedLaborStatements.length },
        { rows: relatedOrders, timestampFields: ['orderDate', 'updatedAt', 'createdAt'], sampleSize: currentWorkload.orderCount + priorWorkload.orderCount, missingReason: 'workload_comparison_window_missing' },
        { rows: employee ? [employee] : [], timestampFields: ['updatedAt'], sampleSize: employee ? 1 : 0 },
      ], 'Source timestamps are row-local; overtime, workload, revenue growth, and labor cost growth remain derived comparison-window candidates.');
      const row = {
        status: 'risk_signal',
        finding_key: 'labor_overtime_high',
        finding_label: 'labor_overtime_high_without_matching_revenue_growth',
        evidence_strength: 'weak',
        source_domain: 'labor_operations',
        source_collection: 'laborcost1',
        source_collections_or_modules: 'laborcost1, laborstatements, ordertest2, users',
        time_window: `${this.isoDateOnly(window.currentStart)} to ${this.isoDateOnly(new Date(window.currentEnd.getTime() - 1))}`,
        affected_entity_type: 'team_or_period',
        affected_entity_id: userId,
        affected_entity_name_or_alias: employee?.fullName || `employee:${userId}`,
        team_or_labor_group_id: userId,
        team_or_labor_group_alias: employee?.fullName || `employee:${userId}`,
        labor_group_basis: 'employee_as_labor_group_candidate',
        current_overtime_hours: this.roundMetric(currentLabor.overtimeHours, 2),
        prior_overtime_hours: this.roundMetric(priorLabor.overtimeHours, 2),
        overtime_growth_percent: this.roundMetric(overtimeGrowthPercent, 2),
        current_labor_cost: this.roundMetric(currentLabor.cost, 2),
        prior_labor_cost: this.roundMetric(priorLabor.cost, 2),
        labor_cost_growth_percent: laborCostGrowthPercent === null ? null : this.roundMetric(laborCostGrowthPercent, 2),
        current_revenue: this.roundMetric(currentWorkload.revenue, 2),
        prior_revenue: this.roundMetric(priorWorkload.revenue, 2),
        revenue_growth_percent: this.roundMetric(revenueGrowthPercent, 2),
        workload_or_order_count_current: currentWorkload.orderCount,
        workload_or_order_count_prior: priorWorkload.orderCount,
        workload_quantity_current: currentWorkload.quantity,
        workload_quantity_prior: priorWorkload.quantity,
        current_labor_session_count: currentLabor.sessionCount,
        prior_labor_session_count: priorLabor.sessionCount,
        current_labor_statement_count: statements.filter((statement) => this.windowOverlaps(statement?.periodFrom, statement?.periodTo, window.currentStart, window.currentEnd)).length,
        prior_labor_statement_count: statements.filter((statement) => this.windowOverlaps(statement?.periodFrom, statement?.periodTo, window.priorStart, window.priorEnd)).length,
        sla_or_deadline_pressure_if_available: null,
        staff_capacity_if_available: null,
        overtime_threshold_hours_per_day: 8,
        overtime_threshold_source: 'derived_candidate_8_hours_per_employee_day_from_laborcost1.workHours; no canonical overtime policy threshold found',
        metric_name: 'overtime_hours_growth_vs_revenue_growth',
        metric_value: this.roundMetric(overtimeGrowthPercent - revenueGrowthPercent, 2),
        threshold_value: 'overtime_growth_percent greater than revenue_growth_percent; overtime hours derived above 8h/day candidate threshold',
        comparison_period: `${this.isoDateOnly(window.currentStart)} to ${this.isoDateOnly(new Date(window.currentEnd.getTime() - 1))} versus ${this.isoDateOnly(window.priorStart)} to ${this.isoDateOnly(new Date(window.priorEnd.getTime() - 1))}`,
        calculation_method: 'current/prior windows are adjacent 7-day periods; overtime_hours_candidate = sum(max(0, daily laborcost1.workHours by employee - 8)); revenue = sum(ordertest2.depositAmount + codAmount + manualPayment); emit row when overtime growth exceeds revenue growth',
        sample_size: currentLabor.sessionCount,
        data_quality_status: 'partial',
        confidence: 'low',
        ...thresholdMetadata,
        ...sourceMetadata,
        blocking_reason_if_any: 'Evidence is advisory-only: overtime is a derived candidate from laborcost1.workHours, while SLA pressure, staff capacity, and canonical overtime policy are not mapped; row cannot support staffing, scheduling, payroll, timesheet, order, revenue, cashflow, or provider action.',
        recommended_advisory_language: 'Overtime appears elevated relative to revenue growth. Treat this as an operations cost and capacity review signal; confirm workload, SLA pressure, and staffing context before drawing performance conclusions.',
        evidence_note: 'labor_overtime_high_readonly',
        not_allowed_actions: 'do_not_change_staffing; do_not_create_schedule_action; do_not_mutate_payroll; do_not_mutate_timesheets; do_not_mutate_orders_or_revenue; do_not_mutate_cashflow; do_not_execute_ads_actions',
        capacity_remaining: null,
      };
      rows.push(this.withEvidenceAndSeverity(row, {
        source_rows: [
          {
            source_module: 'OperationsCapacityQuery',
            source_collection: 'laborcost1',
            entity_type: 'labor_cost',
            rows: relatedLaborCosts,
            source_field_names: ['_id', 'userId', 'date', 'workHours', 'cost', 'sessionCount', 'updatedAt', 'createdAt'],
            timestamp_fields: ['date', 'updatedAt', 'createdAt'],
          },
          {
            source_module: 'OperationsCapacityQuery',
            source_collection: 'laborstatements',
            entity_type: 'labor_statement',
            rows: relatedLaborStatements,
            source_field_names: ['_id', 'employeeId', 'periodFrom', 'periodTo', 'periodCost', 'totalWorkHours', 'sessionCount', 'updatedAt', 'createdAt'],
            timestamp_fields: ['periodTo', 'periodFrom', 'updatedAt', 'createdAt'],
          },
          {
            source_module: 'OperationsCapacityQuery',
            source_collection: 'ordertest2',
            entity_type: 'workload_order',
            rows: relatedOrders,
            source_field_names: ['_id', 'orderDate', 'quantity', 'depositAmount', 'codAmount', 'manualPayment', 'productionStatus', 'orderStatus', 'updatedAt', 'createdAt'],
            timestamp_fields: ['orderDate', 'updatedAt', 'createdAt'],
          },
          {
            source_module: 'OperationsCapacityQuery',
            source_collection: 'users',
            entity_type: 'employee',
            rows: employee ? [employee] : [],
            source_field_names: ['_id', 'fullName', 'role', 'managerId', 'isActive', 'updatedAt'],
            timestamp_fields: ['updatedAt'],
            entity_name_fields: ['fullName'],
          },
        ],
        evidence_entities: [{
          entity_id: userId,
          entity_name_or_alias: employee?.fullName || `employee:${userId}`,
          entity_type: 'team_or_period',
        }],
        evidence_time_window: {
          label: `${this.isoDateOnly(window.currentStart)} to ${this.isoDateOnly(new Date(window.currentEnd.getTime() - 1))}`,
          comparison_window_from: window.priorStart.toISOString(),
          comparison_window_to: new Date(window.currentEnd.getTime() - 1).toISOString(),
        },
        evidence_direct_fields: ['laborcost1.userId', 'laborcost1.date', 'laborcost1.workHours', 'laborcost1.cost', 'ordertest2.orderDate', 'ordertest2.depositAmount', 'ordertest2.codAmount', 'ordertest2.manualPayment'],
        evidence_derived_fields: ['current_overtime_hours', 'prior_overtime_hours', 'overtime_growth_percent', 'revenue_growth_percent', 'labor_cost_growth_percent'],
        evidence_calculation_steps: [
          {
            step_key: 'overtime_growth_percent',
            description: 'Compare current and prior adjacent 7-day overtime candidates derived from hours above 8 per day.',
            input_fields: ['laborcost1.workHours', 'laborcost1.date'],
            output_field: 'overtime_growth_percent',
            output_value: this.roundMetric(overtimeGrowthPercent, 2),
          },
          {
            step_key: 'revenue_growth_percent',
            description: 'Compare current and prior adjacent 7-day order revenue candidates.',
            input_fields: ['ordertest2.depositAmount', 'ordertest2.codAmount', 'ordertest2.manualPayment'],
            output_field: 'revenue_growth_percent',
            output_value: this.roundMetric(revenueGrowthPercent, 2),
          },
        ],
        evidence_threshold_comparison: {
          metric_name: 'overtime_hours_growth_vs_revenue_growth',
          metric_value: this.roundMetric(overtimeGrowthPercent - revenueGrowthPercent, 2),
          threshold_value: 0,
          threshold_source_key: thresholdMetadata.threshold_source_key,
          threshold_unit: thresholdMetadata.threshold_unit,
          comparison_operator: '>',
          comparison_result: 'breached',
        },
        evidence_source_freshness: sourceMetadata,
        evidence_missing_fields: thresholdMetadata.missing_or_weak_fields,
        evidence_verification_fields: ['team_or_labor_group_id', 'current_overtime_hours', 'prior_overtime_hours', 'overtime_growth_percent', 'revenue_growth_percent', 'current_labor_cost'],
        evidence_sample_limit: 10,
        recommended_manual_owner: 'Operations / HR owner',
        manual_review_question: 'Can operations confirm workload, SLA pressure, staffing capacity, and approved overtime policy before changing staffing or schedules?',
        reason_row_was_emitted: 'Overtime growth exceeded revenue growth in adjacent comparison windows.',
        reason_action_is_blocked: row.blocking_reason_if_any,
      }, {
        threshold_breach_magnitude: Math.min(100, Math.max(0, overtimeGrowthPercent - revenueGrowthPercent)),
        impact_estimate: Math.min(100, Math.max(currentLabor.cost, currentLabor.overtimeHours) / 1000),
        repeated_occurrence: currentLabor.sessionCount + priorLabor.sessionCount,
        direct_evidence_ratio: 0.6,
        direct_breach_is_extreme: overtimeGrowthPercent - revenueGrowthPercent >= 80,
      }));
    }

    return rows
      .sort((left, right) => right.overtime_growth_percent - left.overtime_growth_percent)
      .slice(0, 5);
  }

  private supplierCostUpEvidence(input: {
    supplierQuotes: any[];
    dealerQuotes: any[];
    products: any[];
    asOfDate: Date;
  }) {
    const productById = new Map<string, any>();
    for (const product of input.products) {
      const productId = this.entityId(product?._id);
      if (productId) {
        productById.set(productId, product);
      }
    }

    const supplierQuotesByPair = new Map<string, any[]>();
    for (const quote of input.supplierQuotes) {
      const productId = this.entityId(quote?.productId);
      const supplierId = this.entityId(quote?.supplierId);
      const price = this.finiteNumber(quote?.price);
      if (!productId || !supplierId || price === null || price <= 0) {
        continue;
      }
      const key = `${productId}::${supplierId}`;
      supplierQuotesByPair.set(key, [...(supplierQuotesByPair.get(key) || []), quote]);
    }

    const dealerQuotesByProduct = new Map<string, any[]>();
    for (const quote of input.dealerQuotes) {
      const productId = this.entityId(quote?.productId);
      const price = this.finiteNumber(quote?.unitPrice);
      if (!productId || price === null || price <= 0 || quote?.isActive === false) {
        continue;
      }
      dealerQuotesByProduct.set(productId, [...(dealerQuotesByProduct.get(productId) || []), quote]);
    }
    for (const quotes of dealerQuotesByProduct.values()) {
      quotes.sort((left, right) => this.dealerPriceTimestamp(right) - this.dealerPriceTimestamp(left));
    }

    const thresholdPercent = 15;
    const rows: any[] = [];
    for (const [pairKey, quotes] of supplierQuotesByPair.entries()) {
      const [productId, supplierId] = pairKey.split('::');
      const product = productById.get(productId);
      if (!product) {
        continue;
      }

      const sortedQuotes = [...quotes].sort((left, right) => this.supplierQuoteTimestamp(right) - this.supplierQuoteTimestamp(left));
      const current = sortedQuotes[0];
      const prior = sortedQuotes.slice(1).find((row) => {
        const priorPrice = this.finiteNumber(row?.price);
        return priorPrice !== null && priorPrice > 0;
      });
      const currentPrice = this.finiteNumber(current?.price);
      const priorPrice = this.finiteNumber(prior?.price);
      const currentAt = this.supplierQuoteTimestampOrNull(current);
      const priorAt = this.supplierQuoteTimestampOrNull(prior);
      if (currentPrice === null || priorPrice === null || priorPrice <= 0 || currentAt === null || priorAt === null) {
        continue;
      }

      const increasePercent = ((currentPrice - priorPrice) / priorPrice) * 100;
      if (increasePercent <= thresholdPercent) {
        continue;
      }

      const dealerHistory = dealerQuotesByProduct.get(productId) || [];
      const approvedDealerHistory = dealerHistory.filter((row) => this.isApprovedQuoteStatus(row?.status));
      const pricedDealerHistory = approvedDealerHistory.length ? approvedDealerHistory : dealerHistory;
      const dealerCurrent = pricedDealerHistory[0] || null;
      const dealerPrior = pricedDealerHistory[1] || null;
      const dealerCurrentAt = this.dealerPriceTimestampOrNull(dealerCurrent);
      if (dealerCurrentAt !== null && dealerCurrentAt >= currentAt) {
        continue;
      }

      const dealerPriceLagDays = dealerCurrentAt === null
        ? null
        : Math.max(0, Math.floor((currentAt - dealerCurrentAt) / 86_400_000));
      const supplierQuoteApprovalStatus = current?.approvalStatus || current?.status || null;
      const productCost = this.productCostCandidate(product, supplierId);
      const dealerHistoryStatus = this.dealerPriceHistoryStatus(dealerHistory, dealerCurrent, dealerCurrentAt, currentAt);
      const confidence = dealerHistoryStatus === 'older_than_supplier_cost_increase' && this.isApprovedQuoteStatus(dealerCurrent?.status)
        ? 'medium'
        : 'low';
      const missingOrWeakFields = [
        ...(supplierQuoteApprovalStatus ? [] : ['supplier_quote_approval_status']),
        ...(productCost.effectiveDate ? [] : ['product_cost_effective_date']),
        ...(dealerCurrent ? [] : ['dealer_price_history']),
        ...(dealerCurrentAt ? [] : ['dealer_price_effective_date']),
        'margin_or_cogs_impact',
      ];
      const thresholdMetadata = this.thresholdMetadata('supplier_cost_up', input.asOfDate, missingOrWeakFields);
      const sourceMetadata = this.sourceFreshnessMetadata('supplier_cost_up', input.asOfDate, [
        { rows: sortedQuotes, timestampFields: ['effectiveAt', 'updatedAt', 'createdAt'], sampleSize: sortedQuotes.length, missingReason: 'supplier_quote_history_missing' },
        { rows: dealerHistory, timestampFields: ['validFrom', 'updatedAt', 'createdAt'], sampleSize: dealerHistory.length },
        { rows: [product], timestampFields: ['updatedAt', 'suppliers.appliedAt'], sampleSize: 1 },
      ], 'Source timestamps are row-local; cost increase, dealer price lag, and cost source selection remain derived pricing candidates.');

      const row = {
        status: 'risk_signal',
        finding_key: 'supplier_cost_up',
        finding_label: 'supplier_cost_up_15_percent_without_matching_dealer_price_update',
        evidence_strength: confidence === 'medium' ? 'medium' : 'weak',
        source_domain: 'supplier_pricing',
        source_collection: 'supplierquotes',
        source_collections_or_modules: 'supplierquotes, products, quotes',
        time_window: `${this.isoDateOnly(priorAt)} to ${this.isoDateOnly(currentAt)}`,
        affected_entity_type: 'product_supplier_pair',
        affected_entity_id: pairKey,
        affected_entity_name_or_alias: `${product.name || product.sku || productId} / supplier:${supplierId}`,
        product_id: productId,
        supplier_id_or_alias: supplierId,
        sku: product.sku || null,
        current_supplier_cost_or_quote: currentPrice,
        prior_supplier_cost_or_quote: priorPrice,
        current_supplier_quote_id: this.entityId(current?._id),
        prior_supplier_quote_id: this.entityId(prior?._id),
        supplier_quote_effective_date: this.isoDateOnly(currentAt),
        prior_supplier_quote_effective_date: this.isoDateOnly(priorAt),
        supplier_quote_approval_status: supplierQuoteApprovalStatus,
        supplier_quote_approval_status_source: supplierQuoteApprovalStatus ? 'supplierquotes.status_or_approvalStatus' : 'not_available_in_supplier_quote_schema',
        product_cost_or_import_price_current: productCost.value,
        product_cost_effective_date: productCost.effectiveDate,
        product_cost_source: productCost.source,
        dealer_price_current_or_latest: this.finiteNumber(dealerCurrent?.unitPrice),
        dealer_price_prior_or_effective: this.finiteNumber(dealerPrior?.unitPrice),
        dealer_price_effective_date: this.isoDateOnly(dealerCurrentAt),
        dealer_price_list_id: this.entityId(dealerCurrent?._id),
        dealer_price_agent_id_or_alias: this.entityId(dealerCurrent?.agentId) || dealerCurrent?.agentName || null,
        dealer_price_approval_status: dealerCurrent?.status || null,
        dealer_price_history_status: dealerHistoryStatus,
        dealer_price_update_lag_days: dealerPriceLagDays,
        cost_increase_percent: this.roundMetric(increasePercent, 2),
        cost_threshold_percent: thresholdPercent,
        metric_name: 'cost_increase_percent',
        metric_value: this.roundMetric(increasePercent, 2),
        threshold_value: `${thresholdPercent}_percent`,
        comparison_period: 'current supplier quote versus prior supplier quote',
        calculation_method: '(current_supplier_cost_or_quote - prior_supplier_cost_or_quote) / prior_supplier_cost_or_quote * 100; dealer update is considered unmatched when latest dealer quote effective date is missing or older than the current supplier quote effective date',
        sample_size: sortedQuotes.length,
        supplier_quote_count: sortedQuotes.length,
        dealer_price_quote_count: dealerHistory.length,
        data_quality_status: 'partial',
        confidence,
        ...thresholdMetadata,
        ...sourceMetadata,
        blocking_reason_if_any: 'supplier quote approval status and product cost history may be unavailable in current ERP schema; row is advisory-only and cannot support supplier, dealer price, purchase order, or ads mutation.',
        recommended_advisory_language: 'Supplier cost appears to have increased faster than dealer price updates for this product/supplier pair. Treat as margin pressure requiring pricing review; do not auto-change prices without approved pricing workflow.',
        evidence_note: 'supplier_cost_up_readonly',
        not_allowed_actions: 'do_not_change_prices; do_not_create_supplier_actions; do_not_mutate_dealer_prices; do_not_create_purchase_order; do_not_execute_ads_actions',
        capacity_remaining: null,
      };
      rows.push(this.withEvidenceAndSeverity(row, {
        source_rows: [
          {
            source_module: 'OperationsCapacityQuery',
            source_collection: 'supplierquotes',
            entity_type: 'supplier_quote',
            rows: sortedQuotes,
            source_field_names: ['_id', 'productId', 'supplierId', 'price', 'currency', 'status', 'approvalStatus', 'effectiveAt', 'updatedAt', 'createdAt'],
            timestamp_fields: ['effectiveAt', 'updatedAt', 'createdAt'],
          },
          {
            source_module: 'OperationsCapacityQuery',
            source_collection: 'quotes',
            entity_type: 'dealer_quote',
            rows: dealerHistory,
            source_field_names: ['_id', 'productId', 'agentId', 'unitPrice', 'status', 'validFrom', 'updatedAt', 'createdAt'],
            timestamp_fields: ['validFrom', 'updatedAt', 'createdAt'],
          },
          {
            source_module: 'OperationsCapacityQuery',
            source_collection: 'products',
            entity_type: 'product',
            rows: [product],
            source_field_names: ['_id', 'name', 'sku', 'importPrice', 'totalCost', 'suppliers.supplierId', 'suppliers.appliedPrice', 'suppliers.appliedAt', 'updatedAt'],
            timestamp_fields: ['updatedAt', 'suppliers.appliedAt'],
            entity_name_fields: ['name', 'sku'],
          },
        ],
        evidence_entities: [
          {
            entity_id: pairKey,
            entity_name_or_alias: `${product.name || product.sku || productId} / supplier:${supplierId}`,
            entity_type: 'product_supplier_pair',
          },
          {
            entity_id: productId,
            entity_name_or_alias: product.name || product.sku || productId,
            entity_type: 'product',
          },
          {
            entity_id: supplierId,
            entity_name_or_alias: `supplier:${supplierId}`,
            entity_type: 'supplier',
          },
        ],
        evidence_time_window: {
          label: `${this.isoDateOnly(priorAt)} to ${this.isoDateOnly(currentAt)}`,
          comparison_window_from: new Date(priorAt).toISOString(),
          comparison_window_to: new Date(currentAt).toISOString(),
        },
        evidence_direct_fields: ['supplierquotes.price', 'supplierquotes.effectiveAt', 'supplierquotes.status', 'quotes.unitPrice', 'quotes.validFrom', 'products.importPrice', 'products.suppliers.appliedPrice'],
        evidence_derived_fields: ['cost_increase_percent', 'dealer_price_update_lag_days', 'dealer_price_history_status', 'product_cost_or_import_price_current'],
        evidence_calculation_steps: [
          {
            step_key: 'cost_increase_percent',
            description: 'Compare current supplier quote with prior supplier quote for the same product and supplier.',
            input_fields: ['supplierquotes.price', 'supplierquotes.effectiveAt'],
            output_field: 'cost_increase_percent',
            output_value: this.roundMetric(increasePercent, 2),
          },
          {
            step_key: 'dealer_price_lag',
            description: 'Check whether latest dealer quote effective date is older than the current supplier quote effective date.',
            input_fields: ['quotes.unitPrice', 'quotes.validFrom', 'supplierquotes.effectiveAt'],
            output_field: 'dealer_price_update_lag_days',
            output_value: dealerPriceLagDays,
          },
        ],
        evidence_threshold_comparison: {
          metric_name: 'cost_increase_percent',
          metric_value: this.roundMetric(increasePercent, 2),
          threshold_value: thresholdPercent,
          threshold_source_key: thresholdMetadata.threshold_source_key,
          threshold_unit: thresholdMetadata.threshold_unit,
          comparison_operator: '>',
          comparison_result: 'breached',
        },
        evidence_source_freshness: sourceMetadata,
        evidence_missing_fields: thresholdMetadata.missing_or_weak_fields,
        evidence_verification_fields: ['product_id', 'supplier_id_or_alias', 'current_supplier_cost_or_quote', 'prior_supplier_cost_or_quote', 'cost_increase_percent', 'dealer_price_update_lag_days'],
        evidence_sample_limit: 10,
        recommended_manual_owner: 'Pricing / Purchasing manager',
        manual_review_question: 'Can pricing confirm supplier quote approval, dealer price history, product cost source, and margin impact before any price review?',
        reason_row_was_emitted: 'Supplier quote cost increase breached the configured percent threshold while dealer price update was missing or older.',
        reason_action_is_blocked: row.blocking_reason_if_any,
      }, {
        threshold_breach_magnitude: Math.max(0, increasePercent - thresholdPercent),
        impact_estimate: Math.min(100, increasePercent + (dealerPriceLagDays ?? 0)),
        repeated_occurrence: sortedQuotes.length,
        direct_evidence_ratio: 0.7,
        direct_breach_is_extreme: increasePercent >= thresholdPercent * 2,
      }));
    }

    return rows
      .sort((left, right) => right.cost_increase_percent - left.cost_increase_percent)
      .slice(0, 5);
  }

  private slowSupplierGoodCostEvidence(input: {
    supplierQuotes: any[];
    purchaseOrders: any[];
    products: any[];
    inventorySummaries: any[];
    users: any[];
    asOfDate: Date;
  }) {
    const productById = new Map<string, any>();
    for (const product of input.products) {
      const productId = this.entityId(product?._id);
      if (productId) {
        productById.set(productId, product);
      }
    }

    const usersById = new Map<string, any>();
    for (const user of input.users) {
      const userId = this.entityId(user?._id);
      if (userId) {
        usersById.set(userId, user);
      }
    }

    const inventoryByProductId = new Map<string, any>();
    for (const summary of input.inventorySummaries) {
      const productId = this.entityId(summary?.productId);
      if (productId) {
        inventoryByProductId.set(productId, summary);
      }
    }

    const supplierQuotesByPair = new Map<string, any[]>();
    for (const quote of input.supplierQuotes) {
      const productId = this.entityId(quote?.productId);
      const supplierId = this.entityId(quote?.supplierId);
      const price = this.finiteNumber(quote?.price);
      if (!productId || !supplierId || price === null || price <= 0) {
        continue;
      }
      const key = `${productId}::${supplierId}`;
      supplierQuotesByPair.set(key, [...(supplierQuotesByPair.get(key) || []), quote]);
    }
    for (const quotes of supplierQuotesByPair.values()) {
      quotes.sort((left, right) => this.supplierQuoteTimestamp(right) - this.supplierQuoteTimestamp(left));
    }

    const latestQuotesByProductCurrency = new Map<string, Array<{
      pairKey: string;
      productId: string;
      supplierId: string;
      quote: any;
      price: number;
      currency: string;
    }>>();
    for (const [pairKey, quotes] of supplierQuotesByPair.entries()) {
      const current = quotes[0];
      const [productId, supplierId] = pairKey.split('::');
      const price = this.finiteNumber(current?.price);
      if (!productId || !supplierId || price === null || price <= 0) {
        continue;
      }
      const currency = String(current?.currency || 'VND').trim() || 'VND';
      const productCurrencyKey = `${productId}::${currency}`;
      latestQuotesByProductCurrency.set(productCurrencyKey, [
        ...(latestQuotesByProductCurrency.get(productCurrencyKey) || []),
        { pairKey, productId, supplierId, quote: current, price, currency },
      ]);
    }

    const window = this.comparisonWindow(input.asOfDate, 30);
    const costAdvantageThresholdPercent = 5;
    const rows: any[] = [];

    for (const [pairKey, quotes] of supplierQuotesByPair.entries()) {
      const [productId, supplierId] = pairKey.split('::');
      const product = productById.get(productId);
      if (!product) {
        continue;
      }

      const current = quotes[0];
      const prior = quotes.slice(1).find((row) => {
        const priorPrice = this.finiteNumber(row?.price);
        return priorPrice !== null && priorPrice > 0;
      });
      const currentPrice = this.finiteNumber(current?.price);
      const priorPrice = this.finiteNumber(prior?.price);
      const currentAt = this.supplierQuoteTimestampOrNull(current);
      const priorAt = this.supplierQuoteTimestampOrNull(prior);
      const currency = String(current?.currency || 'VND').trim() || 'VND';
      if (currentPrice === null || currentPrice <= 0 || currentAt === null) {
        continue;
      }

      const peerQuotes = (latestQuotesByProductCurrency.get(`${productId}::${currency}`) || [])
        .filter((row) => row.supplierId !== supplierId);
      const peerMedianCost = this.median(peerQuotes.map((row) => row.price));
      if (peerMedianCost === null || peerMedianCost <= 0) {
        continue;
      }

      const costAdvantagePercent = ((peerMedianCost - currentPrice) / peerMedianCost) * 100;
      if (costAdvantagePercent < costAdvantageThresholdPercent) {
        continue;
      }

      const currentFulfillment = this.supplierProductFulfillmentStats(
        input.purchaseOrders,
        productId,
        supplierId,
        window.currentStart,
        window.currentEnd,
      );
      if (currentFulfillment.fulfilledPoCount <= 0 || currentFulfillment.delayedPoCount <= 0) {
        continue;
      }

      const leadTimeThreshold = this.finiteNumber(product?.estimatedDeliveryDays);
      const slowByLeadTime = leadTimeThreshold !== null
        && currentFulfillment.averageLeadTimeDays !== null
        && currentFulfillment.averageLeadTimeDays > leadTimeThreshold;
      const slowByDelay = currentFulfillment.averageDelayDays !== null && currentFulfillment.averageDelayDays > 0;
      if (!slowByLeadTime && !slowByDelay) {
        continue;
      }

      const priorFulfillment = this.supplierProductFulfillmentStats(
        input.purchaseOrders,
        productId,
        supplierId,
        window.priorStart,
        window.priorEnd,
      );
      const supplierCostGrowthPercent = priorPrice === null ? null : this.percentGrowth(currentPrice, priorPrice);
      const leadTimeGrowthPercent = currentFulfillment.averageLeadTimeDays === null || priorFulfillment.averageLeadTimeDays === null
        ? null
        : this.percentGrowth(currentFulfillment.averageLeadTimeDays, priorFulfillment.averageLeadTimeDays);
      const delayGrowthPercent = currentFulfillment.averageDelayDays === null || priorFulfillment.averageDelayDays === null
        ? null
        : this.percentGrowth(currentFulfillment.averageDelayDays, priorFulfillment.averageDelayDays);
      const acceptedQuoteCount = quotes.filter((row) => this.isApprovedQuoteStatus(row?.approvalStatus || row?.status)).length;
      const supplierRows = Array.isArray(product?.suppliers) ? product.suppliers : [];
      const productSupplierMappingSource = supplierRows.some((row: any) => this.entityId(row?.supplierId) === supplierId)
        ? 'products.suppliers'
        : 'supplierquotes.productId_supplierId';
      const inventory = inventoryByProductId.get(productId);
      const incoming = this.incomingStockQuantityCandidate(productId, input.purchaseOrders);
      const supplier = usersById.get(supplierId);
      const supplierAlias = supplier?.fullName || currentFulfillment.supplierNameSnap || `supplier:${supplierId}`;
      const confidence = currentFulfillment.fulfilledPoCount >= 2
        && leadTimeThreshold !== null
        && acceptedQuoteCount > 0
        ? 'medium'
        : 'low';
      const missingOrWeakFields = [
        ...(priorPrice === null ? ['prior_supplier_cost'] : []),
        ...(current?.approvalStatus || current?.status ? [] : ['supplier_quote_approval_status']),
        ...(acceptedQuoteCount ? [] : ['accepted_quote_count']),
        ...(leadTimeThreshold === null ? ['product_estimated_delivery_days'] : []),
        ...(priorFulfillment.fulfilledPoCount ? [] : ['prior_period_fulfilled_po_sample']),
        ...(currentFulfillment.missingCreatedDateCount ? ['purchase_order_created_date_for_lead_time'] : []),
        'delivery_quality_notes',
        'supplier_reliability_score',
        'variant_level_supplier_mapping',
        'reserved_quantity',
        'sales_or_usage_mapping',
        'margin_or_cogs_impact',
      ];
      const thresholdMetadata = this.thresholdMetadata('slow_supplier_good_cost', input.asOfDate, missingOrWeakFields);
      const relatedPurchaseOrders = input.purchaseOrders.filter((purchaseOrder) => {
        if (this.entityId(purchaseOrder?.supplierId) !== supplierId) {
          return false;
        }
        const items = Array.isArray(purchaseOrder?.items) ? purchaseOrder.items : [];
        return items.some((item: any) => this.entityId(item?.productId) === productId);
      });
      const sourceMetadata = this.sourceFreshnessMetadata('slow_supplier_good_cost', input.asOfDate, [
        { rows: [...quotes, ...peerQuotes.map((row) => row.quote)], timestampFields: ['effectiveAt', 'updatedAt', 'createdAt'], sampleSize: quotes.length + peerQuotes.length, missingReason: 'peer_supplier_quote_comparison_missing' },
        { rows: relatedPurchaseOrders, timestampFields: ['receivedDate', 'expectedDeliveryDate', 'updatedAt', 'createdAt'], sampleSize: currentFulfillment.fulfilledPoCount + priorFulfillment.fulfilledPoCount, missingReason: 'purchase_order_fulfillment_sample_missing' },
        { rows: [product], timestampFields: ['updatedAt'], sampleSize: 1 },
        { rows: inventory ? [inventory] : [], timestampFields: ['updatedAt'], sampleSize: inventory ? 1 : 0 },
        { rows: supplier ? [supplier] : [], timestampFields: ['updatedAt'], sampleSize: supplier ? 1 : 0 },
      ], 'Source timestamps are row-local; peer median, cost advantage, delivery delay, and lead-time values remain derived supplier candidates.');

      const row = {
        status: 'risk_signal',
        finding_key: 'slow_supplier_good_cost',
        finding_label: 'supplier_has_good_cost_but_slow_reliability',
        evidence_strength: confidence === 'medium' ? 'medium' : 'weak',
        source_domain: 'supplier_reliability',
        source_collection: 'purchaseorders',
        source_collections_or_modules: 'supplierquotes, purchaseorders, products, inventorysummaries, users',
        time_window: `${this.isoDateOnly(window.currentStart)} to ${this.isoDateOnly(new Date(window.currentEnd.getTime() - 1))}`,
        affected_entity_type: 'product_supplier_pair',
        affected_entity_id: pairKey,
        affected_entity_name_or_alias: `${product.name || product.sku || productId} / ${supplierAlias}`,
        supplier_id: supplierId,
        supplier_alias: supplierAlias,
        good_or_product_id: productId,
        good_or_product_alias: product.name || product.sku || productId,
        sku_or_variant_if_available: product.sku || null,
        product_supplier_mapping_source: productSupplierMappingSource,
        current_supplier_cost: currentPrice,
        prior_supplier_cost: priorPrice,
        supplier_cost_growth_percent: supplierCostGrowthPercent === null ? null : this.roundMetric(supplierCostGrowthPercent, 2),
        supplier_cost_advantage_percent: this.roundMetric(costAdvantagePercent, 2),
        peer_supplier_median_cost: this.roundMetric(peerMedianCost, 2),
        peer_supplier_quote_count: peerQuotes.length,
        currency,
        current_supplier_quote_id: this.entityId(current?._id),
        prior_supplier_quote_id: this.entityId(prior?._id),
        supplier_quote_effective_date: this.isoDateOnly(currentAt),
        prior_supplier_quote_effective_date: this.isoDateOnly(priorAt),
        supplier_quote_approval_status: current?.approvalStatus || current?.status || null,
        accepted_quote_count: acceptedQuoteCount,
        current_lead_time_days_if_available: currentFulfillment.averageLeadTimeDays,
        prior_lead_time_days_if_available: priorFulfillment.averageLeadTimeDays,
        lead_time_growth_percent_if_available: leadTimeGrowthPercent === null ? null : this.roundMetric(leadTimeGrowthPercent, 2),
        current_delay_days_if_available: currentFulfillment.averageDelayDays,
        prior_delay_days_if_available: priorFulfillment.averageDelayDays,
        delay_growth_percent_if_available: delayGrowthPercent === null ? null : this.roundMetric(delayGrowthPercent, 2),
        fulfilled_purchase_order_count: currentFulfillment.fulfilledPoCount,
        delayed_purchase_order_count: currentFulfillment.delayedPoCount,
        purchase_order_ids_sample: currentFulfillment.purchaseOrderIds.slice(0, 5),
        purchase_order_numbers_sample: currentFulfillment.purchaseOrderNumbers.slice(0, 5),
        purchase_order_statuses_included: currentFulfillment.statusesIncluded,
        current_quantity_received: currentFulfillment.quantityReceived,
        current_purchase_cost: currentFulfillment.purchaseCost,
        current_average_purchase_unit_cost: currentFulfillment.averageUnitCost,
        stock_on_hand_if_available: this.finiteNumber(inventory?.onHand),
        inventory_avg_cost_if_available: this.finiteNumber(inventory?.avgCost),
        reserved_quantity_if_available: null,
        incoming_quantity_if_available: incoming.quantity,
        current_sales_or_usage_if_available: null,
        prior_sales_or_usage_if_available: null,
        margin_or_cogs_impact_if_available: null,
        slow_supplier_threshold_source: leadTimeThreshold === null
          ? 'purchaseorders.expectedDeliveryDate/receivedDate delay_days; product.estimatedDeliveryDays not available'
          : 'purchaseorders.expectedDeliveryDate/receivedDate delay_days plus products.estimatedDeliveryDays',
        supplier_cost_threshold_source: `latest supplierquotes same product/currency; current supplier cost must be at least ${costAdvantageThresholdPercent}% below peer median`,
        metric_name: 'cost_advantage_with_delivery_delay',
        metric_value: this.roundMetric(costAdvantagePercent, 2),
        threshold_value: `cost_advantage_threshold=${costAdvantageThresholdPercent}_percent; delayed_po_count>0; estimated_delivery_days=${leadTimeThreshold ?? 'missing'}`,
        comparison_period: `${this.isoDateOnly(window.currentStart)} to ${this.isoDateOnly(new Date(window.currentEnd.getTime() - 1))} versus ${this.isoDateOnly(window.priorStart)} to ${this.isoDateOnly(new Date(window.priorEnd.getTime() - 1))}`,
        calculation_method: 'Cost advantage = (peer latest supplier quote median - current supplier quote) / peer median * 100 for the same product and currency; slow signal = fulfilled purchase orders with receivedDate later than expectedDeliveryDate in the current 30-day window.',
        sample_size: currentFulfillment.fulfilledPoCount,
        data_quality_status: 'partial',
        confidence,
        ...thresholdMetadata,
        ...sourceMetadata,
        blocking_reason_if_any: 'Evidence is advisory-only: good-cost and slow-supplier signals are read from supplier quotes and purchase order dates, while delivery quality notes, reliability score, variant-level mapping, reserved quantity, and margin impact are incomplete; row cannot support supplier purchase, supplier order, inventory, stock, cost, price, COGS, cashflow, or provider action.',
        recommended_advisory_language: 'This supplier appears cost-competitive but has delayed fulfilled purchase orders. Review lead-time history, delivery quality, and operational tradeoffs before changing procurement priority.',
        evidence_note: 'slow_supplier_good_cost_readonly',
        not_allowed_actions: 'do_not_create_purchase_order; do_not_change_supplier_order; do_not_mutate_inventory; do_not_mutate_stock; do_not_mutate_supplier_cost; do_not_mutate_price; do_not_mutate_cogs; do_not_mutate_orders_or_revenue; do_not_mutate_cashflow; do_not_execute_ads_actions',
        capacity_remaining: null,
      };
      rows.push(this.withEvidenceAndSeverity(row, {
        source_rows: [
          {
            source_module: 'OperationsCapacityQuery',
            source_collection: 'supplierquotes',
            entity_type: 'supplier_quote',
            rows: [...quotes, ...peerQuotes.map((item) => item.quote || item)],
            source_field_names: ['_id', 'productId', 'supplierId', 'price', 'currency', 'status', 'approvalStatus', 'effectiveAt', 'updatedAt', 'createdAt'],
            timestamp_fields: ['effectiveAt', 'updatedAt', 'createdAt'],
          },
          {
            source_module: 'OperationsCapacityQuery',
            source_collection: 'purchaseorders',
            entity_type: 'purchase_order',
            rows: relatedPurchaseOrders,
            source_field_names: ['_id', 'poNumber', 'supplierId', 'supplierNameSnap', 'status', 'expectedDeliveryDate', 'receivedDate', 'createdAt', 'updatedAt', 'items.productId', 'items.quantity', 'items.quantityReceived', 'items.unitPrice'],
            timestamp_fields: ['receivedDate', 'expectedDeliveryDate', 'updatedAt', 'createdAt'],
            entity_name_fields: ['poNumber', 'supplierNameSnap'],
          },
          {
            source_module: 'OperationsCapacityQuery',
            source_collection: 'products',
            entity_type: 'product',
            rows: [product],
            source_field_names: ['_id', 'name', 'sku', 'estimatedDeliveryDays', 'importPrice', 'totalCost', 'suppliers.supplierId', 'suppliers.appliedPrice', 'updatedAt'],
            timestamp_fields: ['updatedAt'],
            entity_name_fields: ['name', 'sku'],
          },
          {
            source_module: 'OperationsCapacityQuery',
            source_collection: 'inventorysummaries',
            entity_type: 'inventory_summary',
            rows: inventory ? [inventory] : [],
            source_field_names: ['productId', 'onHand', 'avgCost', 'updatedAt'],
            timestamp_fields: ['updatedAt'],
          },
          {
            source_module: 'OperationsCapacityQuery',
            source_collection: 'users',
            entity_type: 'supplier',
            rows: supplier ? [supplier] : [],
            source_field_names: ['_id', 'fullName', 'role', 'isActive', 'updatedAt'],
            timestamp_fields: ['updatedAt'],
            entity_name_fields: ['fullName'],
          },
        ],
        evidence_entities: [
          {
            entity_id: pairKey,
            entity_name_or_alias: `${product.name || product.sku || productId} / ${supplierAlias}`,
            entity_type: 'product_supplier_pair',
          },
          {
            entity_id: productId,
            entity_name_or_alias: product.name || product.sku || productId,
            entity_type: 'product',
          },
          {
            entity_id: supplierId,
            entity_name_or_alias: supplierAlias,
            entity_type: 'supplier',
          },
        ],
        evidence_time_window: {
          label: `${this.isoDateOnly(window.currentStart)} to ${this.isoDateOnly(new Date(window.currentEnd.getTime() - 1))}`,
          comparison_window_from: window.priorStart.toISOString(),
          comparison_window_to: new Date(window.currentEnd.getTime() - 1).toISOString(),
        },
        evidence_direct_fields: ['supplierquotes.price', 'supplierquotes.effectiveAt', 'purchaseorders.expectedDeliveryDate', 'purchaseorders.receivedDate', 'purchaseorders.items.quantityReceived', 'products.estimatedDeliveryDays'],
        evidence_derived_fields: ['supplier_cost_advantage_percent', 'peer_supplier_median_cost', 'current_delay_days_if_available', 'current_lead_time_days_if_available', 'delayed_purchase_order_count'],
        evidence_calculation_steps: [
          {
            step_key: 'cost_advantage_percent',
            description: 'Compare current supplier quote against same-product peer supplier median for the same currency.',
            input_fields: ['supplierquotes.price', 'supplierquotes.currency'],
            output_field: 'supplier_cost_advantage_percent',
            output_value: this.roundMetric(costAdvantagePercent, 2),
          },
          {
            step_key: 'delivery_delay',
            description: 'Compute fulfilled purchase-order delay from received date minus expected delivery date.',
            input_fields: ['purchaseorders.expectedDeliveryDate', 'purchaseorders.receivedDate', 'purchaseorders.items.quantityReceived'],
            output_field: 'current_delay_days_if_available',
            output_value: currentFulfillment.averageDelayDays,
          },
        ],
        evidence_threshold_comparison: {
          metric_name: 'cost_advantage_with_delivery_delay',
          metric_value: this.roundMetric(costAdvantagePercent, 2),
          threshold_value: costAdvantageThresholdPercent,
          threshold_source_key: thresholdMetadata.threshold_source_key,
          threshold_unit: thresholdMetadata.threshold_unit,
          comparison_operator: '>= and delayed_po_count>0',
          comparison_result: 'breached',
        },
        evidence_source_freshness: sourceMetadata,
        evidence_missing_fields: thresholdMetadata.missing_or_weak_fields,
        evidence_verification_fields: ['supplier_id', 'good_or_product_id', 'supplier_cost_advantage_percent', 'peer_supplier_median_cost', 'current_delay_days_if_available', 'delayed_purchase_order_count'],
        evidence_sample_limit: 10,
        recommended_manual_owner: 'Purchasing / Supplier operations manager',
        manual_review_question: 'Can purchasing confirm delivery quality, supplier reliability, lead time, and margin tradeoff before changing supplier priority?',
        reason_row_was_emitted: 'Supplier is cheaper than peer median but has delayed fulfilled purchase orders or lead time above threshold.',
        reason_action_is_blocked: row.blocking_reason_if_any,
      }, {
        threshold_breach_magnitude: Math.max(
          0,
          costAdvantagePercent - costAdvantageThresholdPercent,
          (currentFulfillment.averageDelayDays || 0) * 20,
        ),
        impact_estimate: Math.min(100, Math.max(costAdvantagePercent, currentFulfillment.purchaseCost / 1000)),
        repeated_occurrence: currentFulfillment.fulfilledPoCount,
        direct_evidence_ratio: 0.65,
        direct_breach_is_extreme: (currentFulfillment.averageDelayDays || 0) >= 5,
      }));
    }

    return rows
      .sort((left, right) => right.supplier_cost_advantage_percent - left.supplier_cost_advantage_percent || right.current_delay_days_if_available - left.current_delay_days_if_available)
      .slice(0, 5);
  }

  private thresholdMetadata(
    findingKey: OperationalRiskFindingKey,
    asOfDate: Date,
    missingOrWeakFields: string[] = [],
  ) {
    const summary = this.thresholdSourceResolver.resolveMany({
      findingKey,
      thresholdKeys: OPERATIONAL_RISK_THRESHOLD_KEYS[findingKey],
      asOfDate,
    });
    const mergedWeakFields = this.uniqueStrings([
      ...missingOrWeakFields,
      ...summary.missing_or_weak_fields,
    ]);

    return {
      threshold_source_key: summary.threshold_source_key,
      threshold_source_type: summary.threshold_source_type,
      threshold_source_version_or_effective_date: summary.threshold_source_version_or_effective_date,
      threshold_source_approval_status: summary.threshold_source_approval_status,
      threshold_source_owner: summary.threshold_source_owner,
      threshold_source_default_used: summary.threshold_source_default_used,
      threshold_unit: summary.threshold_unit,
      threshold_registry_row_policy: summary.should_emit_row ? 'emit_readonly_evidence' : 'suppress_row',
      weak_fields_present: mergedWeakFields.length ? mergedWeakFields : ['none_from_threshold_registry'],
      missing_or_weak_fields: mergedWeakFields,
      semantic_notes: summary.semantic_notes,
      confidence_reason: summary.confidence_reason,
      data_quality_reason: summary.data_quality_reason,
    };
  }

  private withEvidenceAndSeverity(
    row: any,
    evidenceInput: Omit<BuildEvidenceDetailInput, 'finding_key' | 'row'>,
    severityInput: Partial<Omit<SeverityScoringInput, 'finding_key'>> = {},
  ) {
    const findingKey = row.finding_key as OperationalRiskFindingKey;
    const evidenceDetail = buildEvidenceDetail({
      finding_key: findingKey,
      row,
      ...evidenceInput,
    });
    const missingEssentialFields = evidenceDetail.evidence_missing_fields.filter((field) => field !== 'none_known');
    const severity = scoreOperationalSeverity({
      finding_key: findingKey,
      threshold_breach_magnitude: null,
      source_freshness_status: row.source_freshness_status || null,
      sample_size: this.finiteNumber(row.sample_size) ?? evidenceDetail.evidence_row_count,
      data_quality_status: row.data_quality_status || null,
      confidence: row.confidence || null,
      impact_estimate: null,
      repeated_occurrence: null,
      direct_evidence_ratio: evidenceDetail.evidence_row_count > 0
        ? Math.min(1, evidenceDetail.evidence_rows.length / evidenceDetail.evidence_row_count)
        : null,
      source_is_derived_candidate: row.source_is_derived_candidate === true,
      missing_essential_fields: missingEssentialFields,
      blocked_reason_present: Boolean(row.blocking_reason_if_any || row.not_allowed_actions),
      ...severityInput,
    });

    return {
      ...row,
      ...evidenceDetail,
      ...severity,
    };
  }

  private sourceFreshnessMetadata(
    findingKey: OperationalRiskFindingKey,
    asOfDate: Date,
    parts: SourceMetadataPart[],
    sourceConfidenceReason: string,
  ) {
    return mergeSourceMetadata(parts, {
      findingKey,
      asOfDate,
      maxAgeMinutes: SOURCE_FRESHNESS_MAX_AGE_MINUTES,
      sourceConfidenceReason,
    });
  }

  private uniqueStrings(values: string[]) {
    return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0)));
  }

  private supplierProductFulfillmentStats(purchaseOrders: any[], productId: string, supplierId: string, start: Date, end: Date) {
    const purchaseOrderIds = new Set<string>();
    const purchaseOrderNumbers = new Set<string>();
    const statusesIncluded = new Set<string>();
    let fulfilledPoCount = 0;
    let delayedPoCount = 0;
    let delayDaysTotal = 0;
    let leadTimeDaysTotal = 0;
    let leadTimeCount = 0;
    let quantityReceived = 0;
    let purchaseCost = 0;
    let missingExpectedDateCount = 0;
    let missingReceivedDateCount = 0;
    let missingCreatedDateCount = 0;
    let supplierNameSnap: string | null = null;

    for (const purchaseOrder of purchaseOrders) {
      if (this.entityId(purchaseOrder?.supplierId) !== supplierId) {
        continue;
      }
      const matchingItems = Array.isArray(purchaseOrder?.items)
        ? purchaseOrder.items.filter((item: any) => this.entityId(item?.productId) === productId)
        : [];
      if (!matchingItems.length) {
        continue;
      }

      const receivedAt = this.timestamp(purchaseOrder?.receivedDate);
      if (receivedAt === null) {
        missingReceivedDateCount += matchingItems.length;
        continue;
      }
      if (receivedAt < start.getTime() || receivedAt >= end.getTime()) {
        continue;
      }

      const status = this.safeStatusLabel(purchaseOrder?.status);
      const statusKey = this.statusKey(status);
      if (statusKey === 'draft' || statusKey === 'cancelled') {
        continue;
      }
      const expectedAt = this.timestamp(purchaseOrder?.expectedDeliveryDate);
      if (expectedAt === null) {
        missingExpectedDateCount += matchingItems.length;
        continue;
      }
      const createdAt = this.timestamp(purchaseOrder?.createdAt);
      if (createdAt === null) {
        missingCreatedDateCount += matchingItems.length;
      }
      supplierNameSnap = supplierNameSnap || purchaseOrder?.supplierNameSnap || null;

      let purchaseOrderHasIncludedItem = false;
      let purchaseOrderHasDelay = false;
      for (const item of matchingItems) {
        const receivedQuantity = this.finiteNumber(item?.quantityReceived) ?? 0;
        const orderedQuantity = this.finiteNumber(item?.quantity) ?? 0;
        const quantity = receivedQuantity > 0 ? receivedQuantity : orderedQuantity;
        if (quantity <= 0) {
          continue;
        }
        const unitPrice = this.finiteNumber(item?.unitPrice) ?? 0;
        const delayDays = Math.max(0, Math.ceil((receivedAt - expectedAt) / 86_400_000));
        const leadTimeDays = createdAt === null ? null : Math.max(0, Math.ceil((receivedAt - createdAt) / 86_400_000));
        quantityReceived += quantity;
        purchaseCost += quantity * unitPrice;
        delayDaysTotal += delayDays;
        if (leadTimeDays !== null) {
          leadTimeDaysTotal += leadTimeDays;
          leadTimeCount += 1;
        }
        purchaseOrderHasIncludedItem = true;
        purchaseOrderHasDelay = purchaseOrderHasDelay || delayDays > 0;
      }

      if (purchaseOrderHasIncludedItem) {
        fulfilledPoCount += 1;
        statusesIncluded.add(status);
        if (purchaseOrderHasDelay) {
          delayedPoCount += 1;
        }
        if (purchaseOrder?._id) {
          purchaseOrderIds.add(String(purchaseOrder._id));
        }
        if (purchaseOrder?.poNumber) {
          purchaseOrderNumbers.add(String(purchaseOrder.poNumber));
        }
      }
    }

    return {
      fulfilledPoCount,
      delayedPoCount,
      averageDelayDays: fulfilledPoCount ? this.roundMetric(delayDaysTotal / fulfilledPoCount, 2) : null,
      averageLeadTimeDays: leadTimeCount ? this.roundMetric(leadTimeDaysTotal / leadTimeCount, 2) : null,
      quantityReceived: this.roundMetric(quantityReceived, 2),
      purchaseCost: this.roundMetric(purchaseCost, 2),
      averageUnitCost: quantityReceived > 0 ? this.roundMetric(purchaseCost / quantityReceived, 2) : null,
      missingExpectedDateCount,
      missingReceivedDateCount,
      missingCreatedDateCount,
      supplierNameSnap,
      purchaseOrderIds: Array.from(purchaseOrderIds).sort(),
      purchaseOrderNumbers: Array.from(purchaseOrderNumbers).sort(),
      statusesIncluded: Array.from(statusesIncluded).sort(),
    };
  }

  private reservedQuantityCandidate(productId: string, orders: any[], deliveryStatuses: any[]) {
    const statusMap = new Map<string, any>();
    for (const status of deliveryStatuses) {
      const key = this.statusKey(status?.name);
      if (key) {
        statusMap.set(key, status);
      }
    }

    const fallbackIncluded = new Set(['chuacomavandon', 'chuacovandon', 'danggiao']);
    const useDynamicStatuses = statusMap.size > 0;
    const statusesIncluded = new Set<string>();
    const statusesExcludedOrAmbiguous = new Set<string>();
    let quantity = 0;
    let orderCount = 0;

    for (const order of orders) {
      if (this.entityId(order?.productId) !== productId) {
        continue;
      }
      const orderQuantity = this.finiteNumber(order?.quantity);
      if (order?.isActive === false || orderQuantity === null || orderQuantity <= 0) {
        statusesExcludedOrAmbiguous.add(order?.isActive === false ? 'inactive_order' : 'missing_or_non_positive_quantity');
        continue;
      }

      const statusLabel = this.safeStatusLabel(order?.orderStatus);
      const statusKey = this.statusKey(order?.orderStatus);
      if (!statusKey) {
        statusesExcludedOrAmbiguous.add('missing_order_status');
        continue;
      }

      if (useDynamicStatuses) {
        const metadata = statusMap.get(statusKey);
        if (
          metadata?.isActive === true &&
          metadata?.isFinal !== true &&
          metadata?.isPaymentTrigger !== true &&
          metadata?.isReturnStatus !== true
        ) {
          quantity += orderQuantity;
          orderCount += 1;
          statusesIncluded.add(statusLabel);
        } else {
          statusesExcludedOrAmbiguous.add(statusLabel);
        }
        continue;
      }

      if (fallbackIncluded.has(statusKey)) {
        quantity += orderQuantity;
        orderCount += 1;
        statusesIncluded.add(statusLabel);
      } else {
        statusesExcludedOrAmbiguous.add(statusLabel);
      }
    }

    return {
      quantity,
      orderCount,
      source: useDynamicStatuses
        ? 'order_status_derived_candidate_using_delivery_status_metadata'
        : 'order_status_derived_candidate_using_safe_fallback_statuses',
      statusesIncluded: Array.from(statusesIncluded).sort(),
      statusesExcludedOrAmbiguous: Array.from(statusesExcludedOrAmbiguous).sort(),
    };
  }

  private incomingStockQuantityCandidate(productId: string, purchaseOrders: any[]) {
    const includedStatuses = new Set(['ordered', 'partially_received']);
    const explicitlyExcludedStatuses = new Set(['draft', 'cancelled', 'received']);
    const statusesIncluded = new Set<string>();
    const statusesExcludedOrAmbiguous = new Set<string>();
    const purchaseOrderIds = new Set<string>();
    const expectedDeliveryDates = new Set<string>();
    let quantity = 0;

    for (const purchaseOrder of purchaseOrders) {
      const matchingItems = Array.isArray(purchaseOrder?.items)
        ? purchaseOrder.items.filter((item: any) => this.entityId(item?.productId) === productId)
        : [];
      if (!matchingItems.length) {
        continue;
      }

      const status = String(purchaseOrder?.status || '').trim();
      const statusKey = status.toLowerCase();
      if (!includedStatuses.has(statusKey)) {
        statusesExcludedOrAmbiguous.add(status || 'missing_purchase_order_status');
        if (!status || !explicitlyExcludedStatuses.has(statusKey)) {
          statusesExcludedOrAmbiguous.add('ambiguous_purchase_order_status');
        }
        continue;
      }

      let hasPositiveRemainingQuantity = false;
      for (const item of matchingItems) {
        const orderedQuantity = this.finiteNumber(item?.quantity);
        const receivedQuantity = this.finiteNumber(item?.quantityReceived) ?? 0;
        if (orderedQuantity === null) {
          statusesExcludedOrAmbiguous.add('missing_purchase_order_item_quantity');
          continue;
        }
        const remainingQuantity = Math.max(0, orderedQuantity - receivedQuantity);
        if (remainingQuantity <= 0) {
          statusesExcludedOrAmbiguous.add('non_positive_remaining_purchase_order_quantity');
          continue;
        }

        quantity += remainingQuantity;
        hasPositiveRemainingQuantity = true;
      }

      if (hasPositiveRemainingQuantity) {
        statusesIncluded.add(status);
        if (purchaseOrder?._id) {
          purchaseOrderIds.add(String(purchaseOrder._id));
        }
        const expectedAt = this.isoDateOnly(purchaseOrder?.expectedDeliveryDate);
        if (expectedAt) {
          expectedDeliveryDates.add(expectedAt);
        }
      }
    }

    return {
      quantity,
      source: 'purchase_order_unreceived_quantity_candidate',
      purchaseOrderCount: purchaseOrderIds.size,
      expectedDeliveryDates: Array.from(expectedDeliveryDates).sort(),
      statusesIncluded: Array.from(statusesIncluded).sort(),
      statusesExcludedOrAmbiguous: Array.from(statusesExcludedOrAmbiguous).sort(),
    };
  }

  private productCostCandidate(product: any, supplierId: string) {
    const supplierRows = Array.isArray(product?.suppliers) ? product.suppliers : [];
    const supplierCost = supplierRows.find((row: any) => this.entityId(row?.supplierId) === supplierId);
    const appliedPrice = this.finiteNumber(supplierCost?.appliedPrice);
    if (appliedPrice !== null && appliedPrice > 0) {
      return {
        value: appliedPrice,
        effectiveDate: this.isoDateOnly(supplierCost?.appliedAt || product?.updatedAt),
        source: 'products.suppliers.appliedPrice',
      };
    }

    const importPrice = this.finiteNumber(product?.importPrice);
    if (importPrice !== null && importPrice > 0) {
      return {
        value: importPrice,
        effectiveDate: this.isoDateOnly(product?.updatedAt),
        source: 'products.importPrice_current_only',
      };
    }

    const totalCost = this.finiteNumber(product?.totalCost);
    if (totalCost !== null && totalCost > 0) {
      return {
        value: totalCost,
        effectiveDate: this.isoDateOnly(product?.updatedAt),
        source: 'products.totalCost_current_only',
      };
    }

    return {
      value: null,
      effectiveDate: null,
      source: 'not_available',
    };
  }

  private asOfDate(value?: string): Date {
    const timestamp = this.timestamp(value);
    return timestamp === null ? new Date() : new Date(timestamp);
  }

  private comparisonWindow(asOfDate: Date, days: number) {
    const currentEnd = this.startOfDay(new Date(asOfDate));
    currentEnd.setDate(currentEnd.getDate() + 1);
    const currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() - days);
    const priorEnd = new Date(currentStart);
    const priorStart = new Date(priorEnd);
    priorStart.setDate(priorStart.getDate() - days);
    return { currentStart, currentEnd, priorStart, priorEnd };
  }

  private laborWindowStats(rows: any[], start: Date, end: Date) {
    const dailyByUser = new Map<string, Map<string, {
      hours: number;
      cost: number;
      sessionCount: number;
    }>>();

    for (const row of rows) {
      const userId = this.entityId(row?.userId);
      const date = this.timestamp(row?.date);
      const hours = this.finiteNumber(row?.workHours);
      if (!userId || date === null || date < start.getTime() || date >= end.getTime() || hours === null || hours <= 0) {
        continue;
      }

      const dayKey = this.isoDateOnly(date) || 'missing_date';
      const userDays = dailyByUser.get(userId) || new Map<string, { hours: number; cost: number; sessionCount: number }>();
      const daily = userDays.get(dayKey) || { hours: 0, cost: 0, sessionCount: 0 };
      daily.hours += hours;
      daily.cost += (this.finiteNumber(row?.cost) ?? 0);
      daily.sessionCount += (this.finiteNumber(row?.sessionCount) ?? 1);
      userDays.set(dayKey, daily);
      dailyByUser.set(userId, userDays);
    }

    const result = new Map<string, {
      totalHours: number;
      overtimeHours: number;
      cost: number;
      sessionCount: number;
      dayCount: number;
    }>();
    for (const [userId, userDays] of dailyByUser.entries()) {
      let totalHours = 0;
      let overtimeHours = 0;
      let cost = 0;
      let sessionCount = 0;
      for (const daily of userDays.values()) {
        totalHours += daily.hours;
        overtimeHours += Math.max(0, daily.hours - 8);
        cost += daily.cost;
        sessionCount += daily.sessionCount;
      }
      result.set(userId, {
        totalHours,
        overtimeHours,
        cost,
        sessionCount,
        dayCount: userDays.size,
      });
    }

    return result;
  }

  private orderWindowStats(rows: any[], start: Date, end: Date) {
    const statusCounts: Record<string, number> = {};
    let revenue = 0;
    let orderCount = 0;
    let quantity = 0;

    for (const row of rows) {
      const orderDate = this.timestamp(row?.orderDate || row?.createdAt);
      if (row?.isActive === false || orderDate === null || orderDate < start.getTime() || orderDate >= end.getTime()) {
        continue;
      }

      orderCount += 1;
      quantity += this.finiteNumber(row?.quantity) ?? 0;
      revenue += (this.finiteNumber(row?.depositAmount) ?? 0)
        + (this.finiteNumber(row?.codAmount) ?? 0)
        + (this.finiteNumber(row?.manualPayment) ?? 0);
      const status = `${row?.productionStatus || 'unknown'} / ${row?.orderStatus || 'unknown'}`;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }

    return { revenue, orderCount, quantity, statusCounts };
  }

  private percentGrowth(current: number, prior: number): number | null {
    if (!Number.isFinite(current) || !Number.isFinite(prior) || prior <= 0) {
      return null;
    }
    return ((current - prior) / prior) * 100;
  }

  private windowOverlaps(periodFrom: any, periodTo: any, windowStart: Date, windowEnd: Date): boolean {
    const from = this.timestamp(periodFrom);
    const to = this.timestamp(periodTo);
    if (from === null || to === null) {
      return false;
    }
    return from < windowEnd.getTime() && to >= windowStart.getTime();
  }

  private startOfDay(input: Date): Date {
    const date = new Date(input);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private outstandingAgentBalance(order: any): number | null {
    for (const value of [order?.agentPaidAmount, order?.agentCommissionFinal, order?.agentCommissionAmount]) {
      const amount = this.finiteNumber(value);
      if (amount !== null && amount > 0) {
        return amount;
      }
    }

    const quote = this.finiteNumber(order?.agentQuote ?? order?.agentAppliedPrice);
    const quantity = this.finiteNumber(order?.quantity) ?? 1;
    if (quote !== null && quote > 0 && quantity > 0) {
      return quote * quantity;
    }

    return null;
  }

  private originalAgentOrderAmount(order: any): number | null {
    for (const value of [
      order?.agentCommissionFinal,
      order?.agentCommissionAmount,
      order?.agentPaidAmount,
      order?.agentQuote !== undefined
        ? (this.finiteNumber(order?.agentQuote) ?? 0) * (this.finiteNumber(order?.quantity) ?? 1)
        : null,
      order?.codAmount,
    ]) {
      const amount = this.finiteNumber(value);
      if (amount !== null && amount > 0) {
        return amount;
      }
    }
    return null;
  }

  private agingBucket(daysOverdue: number): string {
    if (daysOverdue <= 7) {
      return '1_7';
    }
    if (daysOverdue <= 14) {
      return '8_14';
    }
    if (daysOverdue <= 30) {
      return '15_30';
    }
    return '31_plus';
  }

  private dealerPriceHistoryStatus(dealerHistory: any[], dealerCurrent: any, dealerCurrentAt: number | null, supplierCurrentAt: number) {
    if (!dealerHistory.length) {
      return 'missing';
    }
    if (!dealerCurrent) {
      return 'missing_priced_dealer_quote';
    }
    if (dealerCurrentAt === null) {
      return 'missing_effective_date';
    }
    return dealerCurrentAt < supplierCurrentAt ? 'older_than_supplier_cost_increase' : 'current_or_newer_than_supplier_cost_increase';
  }

  private isApprovedQuoteStatus(value: any): boolean {
    return ['approved', 'daduyet', 'aduyet'].includes(this.statusKey(value));
  }

  private supplierQuoteTimestamp(row: any): number {
    return this.supplierQuoteTimestampOrNull(row) ?? 0;
  }

  private supplierQuoteTimestampOrNull(row: any): number | null {
    return this.timestamp(row?.effectiveAt || row?.createdAt || row?.updatedAt);
  }

  private dealerPriceTimestamp(row: any): number {
    return this.dealerPriceTimestampOrNull(row) ?? 0;
  }

  private dealerPriceTimestampOrNull(row: any): number | null {
    return this.timestamp(row?.validFrom || row?.createdAt || row?.updatedAt);
  }

  private median(values: number[]): number | null {
    const sorted = values
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => left - right);
    if (!sorted.length) {
      return null;
    }
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  private isTimestampInWindow(value: any, start: Date, end: Date): boolean {
    const timestamp = this.timestamp(value);
    return timestamp !== null && timestamp >= start.getTime() && timestamp < end.getTime();
  }

  private latestFreshness(rows: any[]): string | null {
    const timestamps = rows
      .map((row) => row?.updatedAt || row?.createdAt || row?.occurredAt || row?.orderDate || row?.effectiveAt || row?.validFrom || row?.receivedDate || row?.expectedDeliveryDate || row?.date || row?.periodTo || row?.periodFrom || row?.dueDate)
      .filter(Boolean)
      .map((value) => new Date(value).getTime())
      .filter(Number.isFinite);
    return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
  }

  private entityId(value: any): string | null {
    if (!value) {
      return null;
    }
    if (typeof value.toHexString === 'function') {
      return value.toHexString();
    }
    if (value._id) {
      return this.entityId(value._id);
    }
    const normalized = String(value);
    return normalized === '[object Object]' ? null : normalized;
  }

  private finiteNumber(value: any): number | null {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : null;
  }

  private timestamp(value: any): number | null {
    if (!value) {
      return null;
    }
    const normalized = new Date(value).getTime();
    return Number.isFinite(normalized) ? normalized : null;
  }

  private statusKey(value: any): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[\uFFFD?]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  private safeStatusLabel(value: any): string {
    const normalized = String(value || '').trim();
    return normalized || 'missing_status';
  }

  private isoDateOnly(value: any): string | null {
    const timestamp = this.timestamp(value);
    return timestamp === null ? null : new Date(timestamp).toISOString().slice(0, 10);
  }

  private roundMetric(value: number, digits: number): number {
    return Number(value.toFixed(digits));
  }
}
