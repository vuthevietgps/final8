import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { SectionQuality } from '../contracts/metadata.contract';
import { dayRange, findRows, sum } from './query.util';

@Injectable()
export class OrderProfitQuery {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async get(date: string) {
    const { start, end } = dayRange(date);
    const [orders, products, categories] = await Promise.all([
      findRows(this.connection, 'ordertest2', { orderDate: { $gte: start, $lt: end } }, {
        productId: 1, quantity: 1, adGroupId: 1, orderStatus: 1, productionStatus: 1,
        depositAmount: 1, codAmount: 1, manualPayment: 1, grossProfit: 1, netProfit: 1,
        realizedGrossProfit: 1, realizedNetProfit: 1, realizedAt: 1, advertisingCost: 1,
        laborCostAllocation: 1, otherCostAllocation: 1, orderDate: 1, createdAt: 1, updatedAt: 1,
      }),
      findRows(this.connection, 'products', {}, { name: 1, categoryId: 1, sku: 1, totalCost: 1, status: 1, updatedAt: 1 }),
      findRows(this.connection, 'productcategories', {}, { name: 1, code: 1, isActive: 1, updatedAt: 1 }),
    ]);
    const productMap = new Map(products.map((row) => [String(row._id), row]));
    const categoryMap = new Map(categories.map((row) => [String(row._id), row]));
    const revenue = orders.reduce((total, row) => total + Number(row.depositAmount || 0) + Number(row.codAmount || 0) + Number(row.manualPayment || 0), 0);
    const byProduct = new Map<string, any>();
    for (const order of orders) {
      const productId = order.productId ? String(order.productId) : 'unmapped';
      const product = productMap.get(productId);
      const category = product?.categoryId ? categoryMap.get(String(product.categoryId)) : undefined;
      const current = byProduct.get(productId) || {
        product_variant_id: productId, product_variant_name: product?.name || null, sku: product?.sku || null,
        service_group_id: product?.categoryId ? String(product.categoryId) : null, service_group_name: category?.name || null,
        orders: 0, quantity: 0, revenue: 0, gross_profit: 0, net_profit: 0, realized_net_profit: 0,
      };
      current.orders++;
      current.quantity += Number(order.quantity || 0);
      current.revenue += Number(order.depositAmount || 0) + Number(order.codAmount || 0) + Number(order.manualPayment || 0);
      current.gross_profit += Number(order.grossProfit || 0);
      current.net_profit += Number(order.netProfit || 0);
      current.realized_net_profit += Number(order.realizedNetProfit || 0);
      byProduct.set(productId, current);
    }
    const productVariants = Array.from(byProduct.values());
    const byService = new Map<string, any>();
    for (const row of productVariants) {
      const id = row.service_group_id || 'unmapped';
      const current = byService.get(id) || { service_group_id: id, service_group_name: row.service_group_name, orders: 0, revenue: 0, gross_profit: 0, net_profit: 0 };
      current.orders += row.orders;
      current.revenue += row.revenue;
      current.gross_profit += row.gross_profit;
      current.net_profit += row.net_profit;
      byService.set(id, current);
    }
    const quality: SectionQuality = {
      source: 'ordertest2 + products + productcategories',
      source_table_or_service: 'ordertest2',
      freshness_at: orders.length ? new Date(Math.max(...orders.map((row) => new Date(row.updatedAt || row.orderDate).getTime()))).toISOString() : null,
      period: 'custom',
      calculation_method: 'Revenue and profit aggregated by Product; ProductCategory is V1 service_group alias.',
      data_quality_status: orders.length ? 'partial' : 'missing',
      confidence: orders.length ? 'medium' : 'low',
      missing_fields: ['durable_customer_id', 'durable_lead_id', 'cost_allocation_completion_status'],
      warning: ['Estimated and realized profit are exported separately.'],
      can_use_for_decision: orders.length ? 'cautious' : 'no',
      data_state: orders.length ? 'available' : 'no_records_for_report_date',
      empty_reason: orders.length ? null : 'no_records_for_report_date',
    };
    const realizedOrderCount = orders.filter((row) => row.realizedNetProfit !== undefined && row.realizedNetProfit !== null).length;
    return {
      orders,
      products,
      categories,
      business_summary: {
        orders: orders.length,
        revenue,
        gross_profit: sum(orders, 'grossProfit'),
        estimated_net_profit: sum(orders, 'netProfit'),
        estimated_net_profit_value_state: orders.length ? 'estimated' : 'no_records_for_report_date',
        realized_net_profit: sum(orders, 'realizedNetProfit'),
        realized_net_profit_value_state: !orders.length ? 'no_records_for_report_date' : realizedOrderCount ? 'realized' : 'missing',
      },
      product_variant_performance: productVariants,
      service_group_performance: Array.from(byService.values()),
      unit_economics: productVariants.map((row) => ({
        ...row,
        average_revenue_per_order: row.orders ? row.revenue / row.orders : null,
        average_net_profit_per_order: row.orders ? row.net_profit / row.orders : null,
      })),
      quality,
    };
  }
}
