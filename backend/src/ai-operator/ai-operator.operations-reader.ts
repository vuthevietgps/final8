import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AdAccount,
  AdAccountDocument,
} from '../ad-account/schemas/ad-account.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import {
  AgentStatement,
  AgentStatementDocument,
} from '../agent-receivable/schemas/agent-statement.schema';
import {
  Conversation,
  ConversationDocument,
} from '../chat-message/schemas/conversation.schema';
import {
  Customer,
  CustomerDocument,
} from '../customer/schemas/customer.schema';
import { Fanpage, FanpageDocument } from '../fanpage/schemas/fanpage.schema';
import { Media, MediaDocument } from '../media/schemas/media.schema';
import {
  PendingOrder,
  PendingOrderDocument,
} from '../pending-order/schemas/pending-order.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import {
  SupplierPayable,
  SupplierPayableDocument,
} from '../supplier-payable/schemas/supplier-payable.schema';
import {
  TestOrder2,
  TestOrder2Document,
} from '../test-order2/schemas/test-order2.schema';
import {
  dateRangeMatch,
  trimText,
  maskPhone,
} from './ai-operator.snapshot-utils';

@Injectable()
export class AiOperatorOperationsReader {
  constructor(
    @InjectModel(TestOrder2.name)
    private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(SupplierPayable.name)
    private readonly supplierPayableModel: Model<SupplierPayableDocument>,
    @InjectModel(AgentStatement.name)
    private readonly agentStatementModel: Model<AgentStatementDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
    @InjectModel(PendingOrder.name)
    private readonly pendingOrderModel: Model<PendingOrderDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Media.name)
    private readonly mediaModel: Model<MediaDocument>,
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(Fanpage.name)
    private readonly fanpageModel: Model<FanpageDocument>,
  ) {}

  async buildOrderSnapshot(startDate: Date, endDate: Date) {
    const dateMatch = dateRangeMatch(startDate, endDate);

    const [totalInWindow, byStatus, recentOrders, pendingPayments] =
      await Promise.all([
        this.orderModel.countDocuments({
          isActive: { $ne: false },
          ...dateMatch,
        }),
        this.orderModel.aggregate([
          { $match: { isActive: { $ne: false }, ...dateMatch } },
          {
            $group: {
              _id: { $ifNull: ['$orderStatus', 'Unknown'] },
              count: { $sum: 1 },
              revenue: { $sum: '$codCollectedBySupplier' },
              netProfit: { $sum: '$netProfit' },
            },
          },
          { $sort: { count: -1 } },
        ]),
        this.orderModel
          .find(
            { isActive: { $ne: false }, ...dateMatch },
            {
              customerName: 1,
              orderStatus: 1,
              productionStatus: 1,
              adGroupId: 1,
              netProfit: 1,
              orderDate: 1,
              createdAt: 1,
            },
          )
          .sort({ orderDate: -1, createdAt: -1 })
          .limit(10)
          .lean(),
        this.orderModel.aggregate([
          {
            $match: {
              isActive: { $ne: false },
              $or: [
                { supplierPaymentStatus: 'pending' },
                { agentPaymentStatus: 'pending' },
              ],
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              supplierPending: {
                $sum: {
                  $cond: [{ $eq: ['$supplierPaymentStatus', 'pending'] }, 1, 0],
                },
              },
              agentPending: {
                $sum: {
                  $cond: [{ $eq: ['$agentPaymentStatus', 'pending'] }, 1, 0],
                },
              },
            },
          },
        ]),
      ]);

    return {
      totalInWindow,
      byStatus,
      recentOrders,
      pendingPayments: pendingPayments[0] || {
        count: 0,
        supplierPending: 0,
        agentPending: 0,
      },
    };
  }

  async buildReturnSnapshot(startDate: Date, endDate: Date) {
    const dateMatch = dateRangeMatch(startDate, endDate);
    const returnMatch = {
      isActive: { $ne: false },
      ...dateMatch,
      orderStatus: { $regex: 'hoan|return', $options: 'i' },
    };
    const [summary, byAdGroup, byProduct, requestsByStatus, recentRequests] =
      await Promise.all([
        this.orderModel.aggregate([
          { $match: returnMatch },
          {
            $group: {
              _id: null,
              returnOrders: { $sum: 1 },
              returnQty: { $sum: { $ifNull: ['$quantity', 0] } },
              returnRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
              returnCost: { $sum: { $ifNull: ['$productCostTotal', 0] } },
              returnCod: { $sum: { $ifNull: ['$codAmount', 0] } },
            },
          },
        ]),
        this.orderModel.aggregate([
          { $match: returnMatch },
          {
            $group: {
              _id: { $ifNull: ['$adGroupId', 'unknown'] },
              returnOrders: { $sum: 1 },
              returnQty: { $sum: { $ifNull: ['$quantity', 0] } },
              returnRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
            },
          },
          { $sort: { returnOrders: -1 } },
          { $limit: 10 },
        ]),
        this.orderModel.aggregate([
          { $match: returnMatch },
          {
            $group: {
              _id: '$productId',
              returnOrders: { $sum: 1 },
              returnQty: { $sum: { $ifNull: ['$quantity', 0] } },
              returnRevenue: { $sum: { $ifNull: ['$paidToCompanyAmount', 0] } },
            },
          },
          { $sort: { returnOrders: -1 } },
          { $limit: 10 },
        ]),
        this.orderModel.db
          .collection('returnrequests')
          .aggregate([
            {
              $group: {
                _id: { $ifNull: ['$status', 'unknown'] },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
          ])
          .toArray(),
        this.orderModel.db
          .collection('returnrequests')
          .find(
            {},
            {
              projection: {
                orderId: 1,
                supplierId: 1,
                status: 1,
                reason: 1,
                createdAt: 1,
                resolvedAt: 1,
              },
            },
          )
          .sort({ createdAt: -1 })
          .limit(10)
          .toArray(),
      ]);

    return {
      from: startDate,
      to: endDate,
      summary: summary[0] || {
        returnOrders: 0,
        returnQty: 0,
        returnRevenue: 0,
        returnCost: 0,
        returnCod: 0,
      },
      byAdGroup,
      byProduct: byProduct.map((item: any) => ({
        ...item,
        _id: item._id ? String(item._id) : 'unknown',
      })),
      requestsByStatus,
      recentRequests: recentRequests.map((item: any) => ({
        _id: String(item._id),
        orderId: item.orderId ? String(item.orderId) : null,
        supplierId: item.supplierId ? String(item.supplierId) : null,
        status: item.status || null,
        reason: trimText(item.reason, 180),
        createdAt: item.createdAt,
        resolvedAt: item.resolvedAt || null,
      })),
    };
  }

  async buildReceivablesSnapshot(now: Date) {
    const [supplierOpen, supplierOverdue, agentOpen, agentOverdue] =
      await Promise.all([
        this.supplierPayableModel.aggregate([
          { $match: { status: { $in: ['unpaid', 'partial'] } } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              balance: { $sum: '$balance' },
              totalAmount: { $sum: '$totalAmount' },
              amountPaid: { $sum: '$amountPaid' },
            },
          },
        ]),
        this.supplierPayableModel
          .find(
            {
              status: { $in: ['unpaid', 'partial'] },
              dueDate: { $lt: now },
              balance: { $gt: 0 },
            },
            {
              supplierNameSnap: 1,
              status: 1,
              balance: 1,
              dueDate: 1,
              totalAmount: 1,
            },
          )
          .sort({ dueDate: 1 })
          .limit(10)
          .lean(),
        this.agentStatementModel.aggregate([
          { $match: { status: 'open', closingBalance: { $gt: 0 } } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              closingBalance: { $sum: '$closingBalance' },
              periodReceivables: { $sum: '$periodReceivables' },
              paid: { $sum: '$statementPaymentTotal' },
            },
          },
        ]),
        this.agentStatementModel
          .find(
            {
              status: 'open',
              periodTo: { $lt: now },
              closingBalance: { $gt: 0 },
            },
            {
              agentId: 1,
              periodFrom: 1,
              periodTo: 1,
              closingBalance: 1,
              periodReceivables: 1,
            },
          )
          .sort({ periodTo: 1 })
          .limit(10)
          .lean(),
      ]);

    return {
      supplier: {
        open: supplierOpen[0] || {
          count: 0,
          balance: 0,
          totalAmount: 0,
          amountPaid: 0,
        },
        overdue: supplierOverdue,
      },
      agent: {
        open: agentOpen[0] || {
          count: 0,
          closingBalance: 0,
          periodReceivables: 0,
          paid: 0,
        },
        overdue: agentOverdue,
      },
    };
  }

  async buildProductSalesSnapshot() {
    const [totalProducts, missingMedia, missingSupplierPrice, recentProducts] =
      await Promise.all([
        this.productModel.countDocuments({}),
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
              importPrice: 1,
              shippingCost: 1,
              packagingCost: 1,
              images: 1,
              suppliers: 1,
              fanpageVariations: 1,
              updatedAt: 1,
            },
          )
          .sort({ updatedAt: -1, createdAt: -1 })
          .limit(12)
          .lean(),
      ]);

    return {
      totalProducts,
      missingMedia,
      missingSupplierPrice,
      recentProducts: recentProducts.map((product: any) => ({
        _id: String(product._id),
        name: product.name,
        sku: product.sku,
        status: product.status,
        totalCost: product.totalCost,
        imageCount: Array.isArray(product.images) ? product.images.length : 0,
        supplierCount: Array.isArray(product.suppliers)
          ? product.suppliers.length
          : 0,
        fanpageVariationCount: Array.isArray(product.fanpageVariations)
          ? product.fanpageVariations.length
          : 0,
        updatedAt: product.updatedAt,
      })),
    };
  }

  async buildCustomerSnapshot() {
    const [totalCustomers, activeCustomers, expiringSoon, recentCustomers] =
      await Promise.all([
        this.customerModel.countDocuments({}),
        this.customerModel.countDocuments({ isDisabled: { $ne: true } }),
        this.customerModel.countDocuments({
          isDisabled: { $ne: true },
          remainingDays: { $gte: 0, $lte: 10 },
        }),
        this.customerModel
          .find(
            {},
            {
              customerName: 1,
              phoneNumber: 1,
              productId: 1,
              latestPurchaseDate: 1,
              remainingDays: 1,
              isDisabled: 1,
            },
          )
          .sort({ latestPurchaseDate: -1, updatedAt: -1 })
          .limit(12)
          .lean(),
      ]);

    return {
      totalCustomers,
      activeCustomers,
      expiringSoon,
      recentCustomers: recentCustomers.map((customer: any) => ({
        _id: String(customer._id),
        customerName: customer.customerName,
        phoneMasked: maskPhone(customer.phoneNumber),
        productId: customer.productId ? String(customer.productId) : null,
        latestPurchaseDate: customer.latestPurchaseDate,
        remainingDays: customer.remainingDays,
        isDisabled: !!customer.isDisabled,
      })),
    };
  }

  async buildPendingOrderSnapshot() {
    const [byStatus, recentPending] = await Promise.all([
      this.pendingOrderModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.pendingOrderModel
        .find(
          { status: { $in: ['draft', 'awaiting'] } },
          {
            fanpageId: 1,
            productId: 1,
            agentId: 1,
            supplierId: 1,
            adGroupId: 1,
            customerName: 1,
            phone: 1,
            quantity: 1,
            status: 1,
            capturedAt: 1,
            createdAt: 1,
          },
        )
        .sort({ capturedAt: -1, createdAt: -1 })
        .limit(12)
        .lean(),
    ]);

    return {
      byStatus,
      recentPending: recentPending.map((order: any) => ({
        _id: String(order._id),
        status: order.status,
        customerName: order.customerName,
        phoneMasked: maskPhone(order.phone),
        productId: order.productId ? String(order.productId) : null,
        agentId: order.agentId ? String(order.agentId) : null,
        supplierId: order.supplierId ? String(order.supplierId) : null,
        adGroupId: order.adGroupId || null,
        quantity: order.quantity || 1,
        capturedAt: order.capturedAt || order.createdAt,
      })),
    };
  }

  async buildConversationSnapshot() {
    const [needsHuman, awaitingOrder, recentConversations] = await Promise.all([
      this.conversationModel.countDocuments({
        needsHuman: true,
        archived: { $ne: true },
      }),
      this.conversationModel.countDocuments({
        orderDraftStatus: { $in: ['draft', 'awaiting'] },
        archived: { $ne: true },
      }),
      this.conversationModel
        .find(
          { archived: { $ne: true } },
          {
            fanpageId: 1,
            totalMessages: 1,
            inboundCount: 1,
            outboundCount: 1,
            awaitingCount: 1,
            lastMessageSnippet: 1,
            lastDirection: 1,
            lastMessageAt: 1,
            lastAdGroupId: 1,
            needsHuman: 1,
            autoAiEnabled: 1,
            orderDraftStatus: 1,
            orderCustomerName: 1,
            orderPhone: 1,
          },
        )
        .sort({ needsHuman: -1, lastMessageAt: -1 })
        .limit(12)
        .lean(),
    ]);

    return {
      needsHuman,
      awaitingOrder,
      recentConversations: recentConversations.map((conversation: any) => ({
        _id: String(conversation._id),
        fanpageId: conversation.fanpageId
          ? String(conversation.fanpageId)
          : null,
        totalMessages: conversation.totalMessages || 0,
        awaitingCount: conversation.awaitingCount || 0,
        lastMessageSnippet: trimText(conversation.lastMessageSnippet, 180),
        lastDirection: conversation.lastDirection || null,
        lastMessageAt: conversation.lastMessageAt,
        lastAdGroupId: conversation.lastAdGroupId || null,
        needsHuman: !!conversation.needsHuman,
        autoAiEnabled: conversation.autoAiEnabled !== false,
        orderDraftStatus: conversation.orderDraftStatus || 'none',
        orderCustomerName: conversation.orderCustomerName || null,
        orderPhoneMasked: maskPhone(conversation.orderPhone),
      })),
    };
  }

  async buildMediaSnapshot() {
    const [totalMedia, bySourceType, unlinkedMedia, recentMedia] =
      await Promise.all([
        this.mediaModel.countDocuments({}),
        this.mediaModel.aggregate([
          {
            $group: {
              _id: { $ifNull: ['$sourceType', 'gallery'] },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ]),
        this.mediaModel.countDocuments({
          productId: { $exists: false },
          fanpageId: { $exists: false },
        }),
        this.mediaModel
          .find(
            {},
            {
              url: 1,
              productId: 1,
              fanpageId: 1,
              tags: 1,
              isMainImage: 1,
              sourceType: 1,
              aspectRatio: 1,
              width: 1,
              height: 1,
              createdAt: 1,
            },
          )
          .sort({ createdAt: -1 })
          .limit(12)
          .lean(),
      ]);

    return {
      totalMedia,
      bySourceType,
      unlinkedMedia,
      recentMedia: recentMedia.map((media: any) => ({
        _id: String(media._id),
        productId: media.productId ? String(media.productId) : null,
        fanpageId: media.fanpageId ? String(media.fanpageId) : null,
        tags: media.tags || [],
        isMainImage: !!media.isMainImage,
        sourceType: media.sourceType || 'gallery',
        aspectRatio: media.aspectRatio || null,
        width: media.width || null,
        height: media.height || null,
        createdAt: media.createdAt,
      })),
    };
  }

  async buildAdGroupSnapshot() {
    const [
      totalAdGroups,
      activeAdGroups,
      missingProductMap,
      syncErrors,
      recentAdGroups,
    ] = await Promise.all([
      this.adGroupModel.countDocuments({}),
      this.adGroupModel.countDocuments({ isActive: true }),
      this.adGroupModel.countDocuments({
        $or: [
          { selectedProducts: { $exists: false } },
          { selectedProducts: { $size: 0 } },
        ],
      }),
      this.adGroupModel.countDocuments({ lastSyncStatus: 'error' }),
      this.adGroupModel
        .find(
          {},
          {
            name: 1,
            adGroupId: 1,
            platform: 1,
            isActive: 1,
            selectedProducts: 1,
            fanpageId: 1,
            adAccountId: 1,
            assignedEmployeeId: 1,
            remoteStatus: 1,
            effectiveStatus: 1,
            dailyBudget: 1,
            lastSyncStatus: 1,
            lastSyncError: 1,
            updatedAt: 1,
          },
        )
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(12)
        .lean(),
    ]);

    return {
      totalAdGroups,
      activeAdGroups,
      missingProductMap,
      syncErrors,
      recentAdGroups: recentAdGroups.map((group: any) => ({
        _id: String(group._id),
        name: group.name,
        adGroupId: group.adGroupId,
        platform: group.platform,
        isActive: !!group.isActive,
        productCount: Array.isArray(group.selectedProducts)
          ? group.selectedProducts.length
          : 0,
        fanpageId: group.fanpageId ? String(group.fanpageId) : null,
        adAccountId: group.adAccountId ? String(group.adAccountId) : null,
        assignedEmployeeId: group.assignedEmployeeId
          ? String(group.assignedEmployeeId)
          : null,
        remoteStatus: group.remoteStatus || null,
        effectiveStatus: group.effectiveStatus || null,
        dailyBudget: group.dailyBudget || null,
        lastSyncStatus: group.lastSyncStatus || null,
        lastSyncError: trimText(group.lastSyncError, 180),
      })),
    };
  }

  async buildAdAccountSnapshot() {
    const [totalAccounts, activeAccounts, syncErrors, byPlatform] =
      await Promise.all([
        this.adAccountModel.countDocuments({}),
        this.adAccountModel.countDocuments({ isActive: true }),
        this.adAccountModel.countDocuments({ lastSyncStatus: 'error' }),
        this.adAccountModel.aggregate([
          {
            $group: {
              _id: '$accountType',
              count: { $sum: 1 },
              active: { $sum: { $cond: ['$isActive', 1, 0] } },
            },
          },
          { $sort: { count: -1 } },
        ]),
      ]);

    return {
      totalAccounts,
      activeAccounts,
      syncErrors,
      byPlatform,
    };
  }

  async buildFanpageSnapshot() {
    const [
      totalFanpages,
      activeFanpages,
      aiEnabledFanpages,
      webhookSubscribed,
      recentFanpages,
    ] = await Promise.all([
      this.fanpageModel.countDocuments({}),
      this.fanpageModel.countDocuments({ status: 'active' }),
      this.fanpageModel.countDocuments({ aiEnabled: true }),
      this.fanpageModel.countDocuments({ subscribedWebhook: true }),
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
            updatedAt: 1,
          },
        )
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(12)
        .lean(),
    ]);

    return {
      totalFanpages,
      activeFanpages,
      aiEnabledFanpages,
      webhookSubscribed,
      recentFanpages: recentFanpages.map((fanpage: any) => ({
        _id: String(fanpage._id),
        pageId: fanpage.pageId,
        name: fanpage.name,
        status: fanpage.status,
        aiEnabled: !!fanpage.aiEnabled,
        subscribedWebhook: !!fanpage.subscribedWebhook,
        sentThisMonth: fanpage.sentThisMonth || 0,
        messageQuota: fanpage.messageQuota || 0,
        lastRefreshAt: fanpage.lastRefreshAt || null,
      })),
    };
  }
}
