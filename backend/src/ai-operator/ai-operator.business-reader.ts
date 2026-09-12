import { removeVietnameseTone, asArray } from './ai-operator.format';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import {
  Conversation,
  ConversationDocument,
} from '../chat-message/schemas/conversation.schema';
import { Fanpage, FanpageDocument } from '../fanpage/schemas/fanpage.schema';
import {
  PendingOrder,
  PendingOrderDocument,
} from '../pending-order/schemas/pending-order.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { COMPLETED_ORDER_STATUSES } from '../test-order2/constants/test-order2.constants';
import {
  TestOrder2,
  TestOrder2Document,
} from '../test-order2/schemas/test-order2.schema';
import { dateOnly, dateRangeMatch, DAY_MS } from './ai-operator.snapshot-utils';

@Injectable()
export class AiOperatorBusinessReader {
  constructor(
    @InjectModel(TestOrder2.name)
    private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(PendingOrder.name)
    private readonly pendingOrderModel: Model<PendingOrderDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Fanpage.name)
    private readonly fanpageModel: Model<FanpageDocument>,
  ) {}

  private buildBusinessFactPeriod(days: number, now: Date) {
    const safeDays = Math.max(1, Math.round(Number(days) || 1));
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    const from = new Date(to.getTime() - (safeDays - 1) * DAY_MS);
    from.setHours(0, 0, 0, 0);
    return {
      from,
      to,
      days: safeDays,
      fromDate: dateOnly(from),
      toDate: dateOnly(to),
    };
  }

  private buildBusinessFactMonthToDatePeriod(now: Date) {
    const to = new Date(now);
    to.setHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    return {
      from,
      to,
      days: Math.max(
        1,
        Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1,
      ),
      fromDate: dateOnly(from),
      toDate: dateOnly(to),
    };
  }

  async buildBusinessFactsSnapshot(windowDays: number, now: Date) {
    const currentPeriod = this.buildBusinessFactPeriod(windowDays, now);
    const todayPeriod = this.buildBusinessFactPeriod(1, now);
    const yesterdayPeriod = this.buildBusinessFactPeriod(
      1,
      new Date(now.getTime() - DAY_MS),
    );
    const weekPeriod = this.buildBusinessFactPeriod(7, now);
    const monthPeriod = this.buildBusinessFactPeriod(30, now);
    const monthToDatePeriod = this.buildBusinessFactMonthToDatePeriod(now);

    const [
      products,
      currentProductProfit,
      todayProductProfit,
      yesterdayProductProfit,
      weekProductProfit,
      monthProductProfit,
      monthToDateProductProfit,
      fanpages,
      currentAgents,
      currentAdsProducts,
    ] = await Promise.all([
      this.buildProductCatalogFacts(),
      this.buildProductProfitRows(currentPeriod.from, currentPeriod.to),
      this.buildProductProfitRows(todayPeriod.from, todayPeriod.to),
      this.buildProductProfitRows(yesterdayPeriod.from, yesterdayPeriod.to),
      this.buildProductProfitRows(weekPeriod.from, weekPeriod.to),
      this.buildProductProfitRows(monthPeriod.from, monthPeriod.to),
      this.buildProductProfitRows(monthToDatePeriod.from, monthToDatePeriod.to),
      this.buildFanpagePerformanceRows(currentPeriod.from, currentPeriod.to),
      this.buildAgentPerformanceRows(currentPeriod.from, currentPeriod.to),
      this.buildAdsProductPerformanceRows(currentPeriod.from, currentPeriod.to),
    ]);

    return {
      generatedAt: now.toISOString(),
      windowDays,
      currentPeriod,
      todayPeriod,
      yesterdayPeriod,
      weekPeriod,
      monthPeriod,
      monthToDatePeriod,
      products,
      productProfit: {
        current: currentProductProfit,
        today: todayProductProfit,
        yesterday: yesterdayProductProfit,
        week: weekProductProfit,
        month: monthProductProfit,
        monthToDate: monthToDateProductProfit,
      },
      fanpages,
      agents: {
        current: currentAgents,
      },
      adsProducts: {
        current: currentAdsProducts,
      },
    };
  }

  private async buildProductCatalogFacts() {
    const [total, byStatusRows, missingMedia, missingSupplierPrice, products] =
      await Promise.all([
        this.productModel.countDocuments({}),
        this.productModel.aggregate([
          {
            $group: {
              _id: { $ifNull: ['$status', 'unknown'] },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ]),
        this.productModel.countDocuments({
          $or: [{ images: { $exists: false } }, { images: { $size: 0 } }],
        }),
        this.productModel.countDocuments({
          $or: [
            { suppliers: { $exists: false } },
            { suppliers: { $size: 0 } },
            { 'suppliers.appliedPrice': { $lte: 0 } },
          ],
        }),
        this.productModel
          .find(
            {},
            {
              name: 1,
              sku: 1,
              status: 1,
              totalCost: 1,
              images: 1,
              suppliers: 1,
              updatedAt: 1,
            },
          )
          .sort({ name: 1, sku: 1 })
          .limit(200)
          .lean(),
      ]);
    const byStatus = asArray(byStatusRows).map((item: any) => ({
      status: item._id || 'unknown',
      count: item.count || 0,
    }));
    const active = byStatus
      .filter(
        (item) => removeVietnameseTone(item.status).toLowerCase() === 'active',
      )
      .reduce((sum, item) => sum + item.count, 0);

    return {
      total,
      active,
      byStatus,
      missingMedia,
      missingSupplierPrice,
      listLimit: 200,
      truncated: total > 200,
      list: products.map((product: any) => ({
        productId: String(product._id),
        name: product.name || product.sku || String(product._id),
        sku: product.sku || null,
        status: product.status || null,
        totalCost: product.totalCost || 0,
        imageCount: Array.isArray(product.images) ? product.images.length : 0,
        supplierCount: Array.isArray(product.suppliers)
          ? product.suppliers.length
          : 0,
        updatedAt: product.updatedAt || null,
      })),
    };
  }

  private completedOrderMatch(startDate: Date, endDate: Date, extra: any = {}) {
    return {
      isActive: { $ne: false },
      orderStatus: { $in: Array.from(COMPLETED_ORDER_STATUSES) },
      ...dateRangeMatch(startDate, endDate),
      ...extra,
    };
  }

  private revenueExpression() {
    return {
      $add: [
        { $ifNull: ['$codAmount', 0] },
        { $ifNull: ['$depositAmount', 0] },
        { $ifNull: ['$manualPayment', 0] },
      ],
    };
  }

  private quantityExpression() {
    return { $ifNull: ['$quantity', 1] };
  }

  private agentCommissionExpression() {
    return {
      $ifNull: [
        '$agentCommissionFinal',
        {
          $ifNull: [
            '$agentCommissionAmount',
            {
              $multiply: [
                { $ifNull: ['$agentQuote', 0] },
                this.quantityExpression(),
              ],
            },
          ],
        },
      ],
    };
  }

  private async buildProductProfitRows(
    startDate: Date,
    endDate: Date,
    adAttributedOnly = false,
  ) {
    const match: any = this.completedOrderMatch(startDate, endDate);
    if (adAttributedOnly) {
      match.adGroupId = { $exists: true, $nin: [null, ''] };
    }

    const rows = await this.orderModel.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $addFields: { productInfo: { $first: '$product' } } },
      {
        $group: {
          _id: '$productId',
          productName: {
            $first: { $ifNull: ['$productInfo.name', 'Khong xac dinh'] },
          },
          productSku: { $first: { $ifNull: ['$productInfo.sku', null] } },
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: this.quantityExpression() },
          totalRevenue: { $sum: this.revenueExpression() },
          totalProductCost: {
            $sum: {
              $multiply: [
                { $ifNull: ['$supplierAppliedPrice', 0] },
                this.quantityExpression(),
              ],
            },
          },
          totalAdvertisingCost: { $sum: { $ifNull: ['$advertisingCost', 0] } },
          totalLaborCost: { $sum: { $ifNull: ['$laborCostAllocation', 0] } },
          totalOtherCost: { $sum: { $ifNull: ['$otherCostAllocation', 0] } },
          totalAgentCommission: { $sum: this.agentCommissionExpression() },
          grossProfit: { $sum: { $ifNull: ['$grossProfit', 0] } },
          netProfit: { $sum: { $ifNull: ['$netProfit', 0] } },
        },
      },
    ]);

    const products = asArray(rows)
      .map((row: any) => {
        const totalOrders = Number(row.totalOrders || 0);
        const totalRevenue = Number(row.totalRevenue || 0);
        const netProfit = Number(row.netProfit || 0);
        return {
          productId: row._id ? String(row._id) : 'unknown',
          productName: row.productName || 'Khong xac dinh',
          productSku: row.productSku || null,
          totalOrders,
          totalQuantity: Number(row.totalQuantity || 0),
          totalRevenue,
          totalProductCost: Number(row.totalProductCost || 0),
          totalAdvertisingCost: Number(row.totalAdvertisingCost || 0),
          totalLaborCost: Number(row.totalLaborCost || 0),
          totalOtherCost: Number(row.totalOtherCost || 0),
          totalAgentCommission: Number(row.totalAgentCommission || 0),
          grossProfit: Number(row.grossProfit || 0),
          netProfit,
          averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
          averageProfitPerOrder: totalOrders > 0 ? netProfit / totalOrders : 0,
          profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
        };
      })
      .sort((a: any, b: any) => (b.netProfit || 0) - (a.netProfit || 0));

    return {
      dateRange: {
        from: dateOnly(startDate),
        to: dateOnly(endDate),
      },
      totals: {
        totalProducts: products.length,
        totalOrders: products.reduce(
          (sum: number, item: any) => sum + item.totalOrders,
          0,
        ),
        totalQuantity: products.reduce(
          (sum: number, item: any) => sum + item.totalQuantity,
          0,
        ),
        totalRevenue: products.reduce(
          (sum: number, item: any) => sum + item.totalRevenue,
          0,
        ),
        totalProductCost: products.reduce(
          (sum: number, item: any) => sum + item.totalProductCost,
          0,
        ),
        totalAdvertisingCost: products.reduce(
          (sum: number, item: any) => sum + item.totalAdvertisingCost,
          0,
        ),
        totalLaborCost: products.reduce(
          (sum: number, item: any) => sum + item.totalLaborCost,
          0,
        ),
        totalOtherCost: products.reduce(
          (sum: number, item: any) => sum + item.totalOtherCost,
          0,
        ),
        totalAgentCommission: products.reduce(
          (sum: number, item: any) => sum + item.totalAgentCommission,
          0,
        ),
        grossProfit: products.reduce(
          (sum: number, item: any) => sum + item.grossProfit,
          0,
        ),
        netProfit: products.reduce(
          (sum: number, item: any) => sum + item.netProfit,
          0,
        ),
      },
      products,
    };
  }

  private async buildAgentPerformanceRows(startDate: Date, endDate: Date) {
    const rows = await this.orderModel.aggregate([
      { $match: this.completedOrderMatch(startDate, endDate) },
      {
        $group: {
          _id: '$agentId',
          totalOrders: { $sum: 1 },
          totalQuantity: { $sum: this.quantityExpression() },
          totalRevenue: { $sum: this.revenueExpression() },
          grossProfit: { $sum: { $ifNull: ['$grossProfit', 0] } },
          netProfit: { $sum: { $ifNull: ['$netProfit', 0] } },
          totalAgentCommission: { $sum: this.agentCommissionExpression() },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agent',
        },
      },
      { $addFields: { agentInfo: { $first: '$agent' } } },
      { $sort: { totalRevenue: -1 } },
      { $limit: 50 },
    ]);

    const agents = asArray(rows).map((row: any) => {
      const agent = row.agentInfo || {};
      const totalRevenue = Number(row.totalRevenue || 0);
      const netProfit = Number(row.netProfit || 0);
      const totalOrders = Number(row.totalOrders || 0);
      return {
        agentId: row._id ? String(row._id) : null,
        agentName:
          agent.fullName ||
          agent.name ||
          agent.username ||
          agent.email ||
          (row._id ? String(row._id) : 'Khong co dai ly'),
        totalOrders,
        totalQuantity: Number(row.totalQuantity || 0),
        totalRevenue,
        grossProfit: Number(row.grossProfit || 0),
        netProfit,
        totalAgentCommission: Number(row.totalAgentCommission || 0),
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      };
    });

    return {
      dateRange: {
        from: dateOnly(startDate),
        to: dateOnly(endDate),
      },
      totals: {
        totalAgents: agents.length,
        totalOrders: agents.reduce(
          (sum: number, item: any) => sum + item.totalOrders,
          0,
        ),
        totalRevenue: agents.reduce(
          (sum: number, item: any) => sum + item.totalRevenue,
          0,
        ),
        netProfit: agents.reduce(
          (sum: number, item: any) => sum + item.netProfit,
          0,
        ),
      },
      agents,
    };
  }

  private async buildFanpagePerformanceRows(startDate: Date, endDate: Date) {
    const dateMatch = {
      $or: [
        { lastMessageAt: { $gte: startDate, $lte: endDate } },
        {
          lastMessageAt: { $exists: false },
          createdAt: { $gte: startDate, $lte: endDate },
        },
        { lastMessageAt: null, createdAt: { $gte: startDate, $lte: endDate } },
      ],
    };
    const pendingDateMatch = {
      $or: [
        { capturedAt: { $gte: startDate, $lte: endDate } },
        {
          capturedAt: { $exists: false },
          createdAt: { $gte: startDate, $lte: endDate },
        },
        { capturedAt: null, createdAt: { $gte: startDate, $lte: endDate } },
      ],
    };

    const [
      fanpages,
      conversations,
      pendingOrders,
      adGroups,
      orderRows,
      spendRows,
    ] = await Promise.all([
      this.fanpageModel
        .find(
          {},
          {
            pageId: 1,
            name: 1,
            status: 1,
            aiEnabled: 1,
            subscribedWebhook: 1,
            sentThisMonth: 1,
            messageQuota: 1,
            lastRefreshAt: 1,
          },
        )
        .lean(),
      this.conversationModel.aggregate([
        { $match: { archived: { $ne: true }, ...dateMatch } },
        {
          $group: {
            _id: '$fanpageId',
            conversations: { $sum: 1 },
            totalMessages: { $sum: { $ifNull: ['$totalMessages', 0] } },
            inboundCount: { $sum: { $ifNull: ['$inboundCount', 0] } },
            outboundCount: { $sum: { $ifNull: ['$outboundCount', 0] } },
            awaitingCount: { $sum: { $ifNull: ['$awaitingCount', 0] } },
            needsHuman: { $sum: { $cond: ['$needsHuman', 1, 0] } },
            autoAiConversations: {
              $sum: { $cond: [{ $ne: ['$autoAiEnabled', false] }, 1, 0] },
            },
          },
        },
      ]),
      this.pendingOrderModel.aggregate([
        { $match: pendingDateMatch },
        {
          $group: {
            _id: '$fanpageId',
            pendingOrders: { $sum: 1 },
            awaitingOrders: {
              $sum: {
                $cond: [{ $in: ['$status', ['draft', 'awaiting']] }, 1, 0],
              },
            },
          },
        },
      ]),
      this.adGroupModel.aggregate([
        {
          $group: {
            _id: '$fanpageId',
            adGroups: { $sum: 1 },
            activeAdGroups: { $sum: { $cond: ['$isActive', 1, 0] } },
          },
        },
      ]),
      this.orderModel.aggregate([
        {
          $match: this.completedOrderMatch(startDate, endDate, {
            adGroupId: { $exists: true, $nin: [null, ''] },
          }),
        },
        {
          $lookup: {
            from: 'adgroups',
            localField: 'adGroupId',
            foreignField: 'adGroupId',
            as: 'adGroup',
          },
        },
        { $unwind: { path: '$adGroup', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: '$adGroup.fanpageId',
            orders: { $sum: 1 },
            revenue: { $sum: this.revenueExpression() },
            netProfit: { $sum: { $ifNull: ['$netProfit', 0] } },
          },
        },
      ]),
      this.orderModel.db
        .collection('advertisingcosts')
        .aggregate([
          { $match: { date: { $gte: startDate, $lte: endDate } } },
          {
            $lookup: {
              from: 'adgroups',
              localField: 'adGroupId',
              foreignField: 'adGroupId',
              as: 'adGroup',
            },
          },
          { $unwind: { path: '$adGroup', preserveNullAndEmptyArrays: false } },
          {
            $group: {
              _id: '$adGroup.fanpageId',
              adsSpend: { $sum: { $ifNull: ['$spentAmount', 0] } },
              impressions: { $sum: { $ifNull: ['$impressions', 0] } },
              clicks: { $sum: { $ifNull: ['$clicks', 0] } },
              messages: {
                $sum: { $ifNull: ['$messagingConversationStarted7d', 0] },
              },
            },
          },
        ])
        .toArray(),
    ]);

    const toMap = (items: any[]) =>
      new Map(
        asArray(items).map((item: any) => [
          item._id ? String(item._id) : 'unknown',
          item,
        ]),
      );
    const conversationMap = toMap(conversations);
    const pendingMap = toMap(pendingOrders);
    const adGroupMap = toMap(adGroups);
    const orderMap = toMap(orderRows);
    const spendMap = toMap(spendRows);

    const rows = asArray(fanpages).map((fanpage: any) => {
      const id = fanpage._id ? String(fanpage._id) : 'unknown';
      const c = conversationMap.get(id) || {};
      const p = pendingMap.get(id) || {};
      const g = adGroupMap.get(id) || {};
      const o = orderMap.get(id) || {};
      const s = spendMap.get(id) || {};
      const revenue = Number(o.revenue || 0);
      const netProfit = Number(o.netProfit || 0);
      const conversationsCount = Number(c.conversations || 0);
      const activeAdGroups = Number(g.activeAdGroups || 0);
      const needsHuman = Number(c.needsHuman || 0);
      const awaitingOrders = Number(p.awaitingOrders || 0);
      const aiEnabled = fanpage.aiEnabled === true;
      const subscribedWebhook = fanpage.subscribedWebhook === true;
      const active = String(fanpage.status || '').toLowerCase() === 'active';
      const performanceScore =
        revenue / 100000 +
        netProfit / 100000 +
        conversationsCount * 2 +
        Number(o.orders || 0) * 5 +
        activeAdGroups * 3 +
        (active ? 10 : 0) +
        (aiEnabled ? 4 : 0) +
        (subscribedWebhook ? 4 : 0) -
        needsHuman * 4 -
        awaitingOrders;
      const chatbotScore =
        (aiEnabled ? 20 : 0) +
        (subscribedWebhook ? 10 : 0) +
        Number(c.autoAiConversations || 0) * 4 +
        conversationsCount * 2 +
        Number(c.outboundCount || 0) * 0.3 +
        Number(c.inboundCount || 0) * 0.2 -
        needsHuman * 5 -
        awaitingOrders;

      return {
        fanpageId: id,
        pageId: fanpage.pageId || null,
        name: fanpage.name || fanpage.pageId || id,
        status: fanpage.status || null,
        active,
        aiEnabled,
        subscribedWebhook,
        sentThisMonth: Number(fanpage.sentThisMonth || 0),
        messageQuota: Number(fanpage.messageQuota || 0),
        conversations: conversationsCount,
        totalMessages: Number(c.totalMessages || 0),
        inboundCount: Number(c.inboundCount || 0),
        outboundCount: Number(c.outboundCount || 0),
        awaitingCount: Number(c.awaitingCount || 0),
        needsHuman,
        autoAiConversations: Number(c.autoAiConversations || 0),
        pendingOrders: Number(p.pendingOrders || 0),
        awaitingOrders,
        adGroups: Number(g.adGroups || 0),
        activeAdGroups,
        orders: Number(o.orders || 0),
        revenue,
        netProfit,
        adsSpend: Number(s.adsSpend || 0),
        impressions: Number(s.impressions || 0),
        clicks: Number(s.clicks || 0),
        messages: Number(s.messages || 0),
        performanceScore,
        chatbotScore,
      };
    });

    return {
      dateRange: {
        from: dateOnly(startDate),
        to: dateOnly(endDate),
      },
      total: rows.length,
      active: rows.filter((row: any) => row.active).length,
      aiEnabled: rows.filter((row: any) => row.aiEnabled).length,
      webhookSubscribed: rows.filter((row: any) => row.subscribedWebhook)
        .length,
      topFanpages: [...rows]
        .sort((a: any, b: any) => b.performanceScore - a.performanceScore)
        .slice(0, 20),
      topChatbotFanpages: [...rows]
        .sort((a: any, b: any) => b.chatbotScore - a.chatbotScore)
        .slice(0, 20),
    };
  }

  private async buildAdsProductPerformanceRows(startDate: Date, endDate: Date) {
    const [allProfit, adAttributedProfit, spendRows, products] =
      await Promise.all([
        this.buildProductProfitRows(startDate, endDate),
        this.buildProductProfitRows(startDate, endDate, true),
        this.orderModel.db
          .collection('advertisingcosts')
          .aggregate([
            { $match: { date: { $gte: startDate, $lte: endDate } } },
            {
              $lookup: {
                from: 'adgroups',
                localField: 'adGroupId',
                foreignField: 'adGroupId',
                as: 'adGroup',
              },
            },
            {
              $unwind: { path: '$adGroup', preserveNullAndEmptyArrays: false },
            },
            {
              $addFields: {
                productId: { $first: '$adGroup.selectedProducts' },
              },
            },
            {
              $group: {
                _id: '$productId',
                adsSpend: { $sum: { $ifNull: ['$spentAmount', 0] } },
                impressions: { $sum: { $ifNull: ['$impressions', 0] } },
                clicks: { $sum: { $ifNull: ['$clicks', 0] } },
                messages: {
                  $sum: { $ifNull: ['$messagingConversationStarted7d', 0] },
                },
                adGroupIds: { $addToSet: '$adGroup.adGroupId' },
              },
            },
          ])
          .toArray(),
        this.productModel.find({}, { name: 1, sku: 1 }).lean(),
      ]);

    const productNameMap = new Map(
      asArray(products).map((product: any) => [
        product._id ? String(product._id) : 'unknown',
        {
          name: product.name || product.sku || String(product._id),
          sku: product.sku || null,
        },
      ]),
    );
    const allProfitMap = new Map(
      asArray(allProfit.products).map((row: any) => [row.productId, row]),
    );
    const adProfitMap = new Map(
      asArray(adAttributedProfit.products).map((row: any) => [
        row.productId,
        row,
      ]),
    );
    const spendMap = new Map(
      asArray(spendRows).map((row: any) => [
        row._id ? String(row._id) : 'unknown',
        row,
      ]),
    );
    const productIds = Array.from(
      new Set([
        ...Array.from(allProfitMap.keys()),
        ...Array.from(adProfitMap.keys()),
        ...Array.from(spendMap.keys()),
      ]),
    );

    const rows = productIds.map((productId) => {
      const product: any = productNameMap.get(productId) || {};
      const all = allProfitMap.get(productId) || {};
      const adProfit = adProfitMap.get(productId) || {};
      const spend = spendMap.get(productId) || {};
      const adsSpend = Number(spend.adsSpend || 0);
      const totalRevenue = Number(all.totalRevenue || 0);
      const adAttributedRevenue = Number(adProfit.totalRevenue || 0);
      const totalNetProfit = Number(all.netProfit || 0);
      const adAttributedNetProfit = Number(adProfit.netProfit || 0);
      const netProfitAfterAds = adAttributedNetProfit - adsSpend;
      return {
        productId,
        productName:
          adProfit.productName || all.productName || product.name || productId,
        productSku:
          adProfit.productSku || all.productSku || product.sku || null,
        totalOrders: Number(all.totalOrders || 0),
        adAttributedOrders: Number(adProfit.totalOrders || 0),
        totalRevenue,
        adAttributedRevenue,
        totalNetProfit,
        adAttributedNetProfit,
        adsSpend,
        netProfitAfterAds,
        adsRevenueRatio:
          totalRevenue > 0 ? (adsSpend / totalRevenue) * 100 : null,
        adAttributedAdsRevenueRatio:
          adAttributedRevenue > 0
            ? (adsSpend / adAttributedRevenue) * 100
            : null,
        impressions: Number(spend.impressions || 0),
        clicks: Number(spend.clicks || 0),
        messages: Number(spend.messages || 0),
        adGroupCount: asArray(spend.adGroupIds).length,
        profitMarginAfterAds:
          adAttributedRevenue > 0
            ? (netProfitAfterAds / adAttributedRevenue) * 100
            : null,
      };
    });

    return {
      dateRange: {
        from: dateOnly(startDate),
        to: dateOnly(endDate),
      },
      totals: {
        products: rows.length,
        adsSpend: rows.reduce(
          (sum: number, item: any) => sum + item.adsSpend,
          0,
        ),
        totalRevenue: rows.reduce(
          (sum: number, item: any) => sum + item.totalRevenue,
          0,
        ),
        adAttributedRevenue: rows.reduce(
          (sum: number, item: any) => sum + item.adAttributedRevenue,
          0,
        ),
        netProfitAfterAds: rows.reduce(
          (sum: number, item: any) => sum + item.netProfitAfterAds,
          0,
        ),
      },
      products: rows.sort(
        (a: any, b: any) => b.netProfitAfterAds - a.netProfitAfterAds,
      ),
    };
  }
}
