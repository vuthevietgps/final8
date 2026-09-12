import { asArray } from './ai-operator.format';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BudgetAllocationService } from '../finance/budget-allocation.service';
import { FundsService as FinanceFundsService } from '../finance/funds.service';
import { LoanManagementService } from '../finance/loan-management.service';
import {
  TestOrder2,
  TestOrder2Document,
} from '../test-order2/schemas/test-order2.schema';
import { trimText, DAY_MS } from './ai-operator.snapshot-utils';

@Injectable()
export class AiOperatorFinanceReader {
  constructor(
    @InjectModel(TestOrder2.name)
    private readonly orderModel: Model<TestOrder2Document>,
    private readonly financeFundsService?: FinanceFundsService,
    private readonly budgetAllocationService?: BudgetAllocationService,
    private readonly loanManagementService?: LoanManagementService,
  ) {}

  async getFinanceFundsOverview() {
    if (!this.financeFundsService)
      throw new Error('finance funds service is not available');
    const overview = await this.financeFundsService.computeFundsOverview();
    return {
      calculatedAt: overview.calculatedAt,
      cashFlow: overview.cashFlow,
      formulas: overview.formulas,
      validation: overview.validation,
      committedCash: {
        stock: overview.committedCash?.stock,
        threshold: overview.committedCash?.threshold,
        breakdown: overview.committedCash?.breakdown,
      },
      adsFund: {
        stock: overview.adsFund?.stock,
        threshold: overview.adsFund?.threshold,
        dailyBudget: overview.adsFund?.dailyBudget,
        breakdown: overview.adsFund?.breakdown,
      },
      survivalBuffer: {
        stock: overview.survivalBuffer?.stock,
        threshold: overview.survivalBuffer?.threshold,
        health: overview.survivalBuffer?.health,
        target: overview.survivalBuffer?.target,
      },
      ownerFund: {
        stock: overview.ownerFund?.stock,
        threshold: overview.ownerFund?.threshold,
        withdrawalStats: overview.ownerFund?.withdrawalStats,
        breakdown: overview.ownerFund?.breakdown,
      },
      netProfit: overview.netProfit,
      revenue: overview.revenue,
      seedCapital: overview.seedCapital,
    };
  }

  async getBudgetAllocationPreview() {
    if (!this.budgetAllocationService)
      throw new Error('budget allocation service is not available');
    const result = await this.budgetAllocationService.autoAllocateBudget({
      dryRun: true,
    });
    return {
      totalAvailable: result.totalAvailable,
      totalAllocated: result.totalAllocated,
      globalStatus: result.globalStatus || null,
      recommendation: result.recommendation || null,
      globalAdjustmentRatio: result.globalAdjustmentRatio || null,
      systemLocked: !!result.systemLocked,
      summary: result.summary,
      horizontalScaling: result.horizontalScaling || null,
      allocations: asArray(result.allocations)
        .slice(0, 10)
        .map((item: any) => ({
          adGroupId: item.adGroupId,
          adGroupName: item.adGroupName,
          currentBudget: item.currentBudget,
          action: item.action,
          suggestedBudget: item.suggestedBudget,
          allocatedBudget: item.allocatedBudget,
          roi: item.roi,
          profit: item.profit,
          reason: item.reason || null,
          scaleCapped: !!item.scaleCapped,
          scalePercentage: item.scalePercentage || 0,
        })),
    };
  }

  async getLoanDashboard() {
    if (!this.loanManagementService)
      throw new Error('loan management service is not available');
    const dashboard = await this.loanManagementService.getDashboard();
    return {
      availableToDisburse: dashboard.availableToDisburse,
      outstandingWithInterest: dashboard.outstandingWithInterest,
      totalOutstanding: dashboard.totalOutstanding,
      monthlyInterestCost: dashboard.monthlyInterestCost,
      due7Days: dashboard.due7Days,
      due14Days: dashboard.due14Days,
      due30Days: dashboard.due30Days,
      overdueAmount: dashboard.overdueAmount,
      alerts: asArray(dashboard.alerts).slice(0, 10),
      optimization: dashboard.optimization || null,
      metadata: dashboard.metadata || null,
      byLoan: asArray(dashboard.byLoan).slice(0, 10),
    };
  }

  async buildAvailableFundSnapshot() {
    const latest = await this.orderModel.db
      .collection('available_fund_snapshots')
      .findOne({}, { sort: { capturedAt: -1, createdAt: -1 } });

    if (!latest) {
      return { hasSnapshot: false, latest: null };
    }

    return {
      hasSnapshot: true,
      latest: {
        capturedAt: latest.capturedAt || latest.createdAt,
        available: latest.available || 0,
        collectedRevenue: latest.collectedRevenue || 0,
        loanAvailable: latest.loanAvailable || 0,
        actualSpent: latest.actualSpent || 0,
        reservedPayroll: latest.reservedPayroll || 0,
        reservedInterest: latest.reservedInterest || 0,
        reservedPayables: latest.reservedPayables || 0,
        reservedSuppliers: latest.reservedSuppliers || 0,
        reservedAgents: latest.reservedAgents || 0,
        reservedOther: latest.reservedOther || 0,
        note: trimText(latest.note, 300),
      },
    };
  }

  async buildOwnerFundSnapshot() {
    const [accounts, withdrawalSummary, recentWithdrawals] = await Promise.all([
      this.orderModel.db
        .collection('owner_fund_accounts')
        .find(
          { isActive: { $ne: false } },
          {
            projection: {
              name: 1,
              balance: 1,
              totalDeposited: 1,
              totalWithdrawn: 1,
              totalReturnedToCompany: 1,
              updatedAt: 1,
            },
          },
        )
        .sort({ updatedAt: -1 })
        .limit(10)
        .toArray(),
      this.orderModel.db
        .collection('withdrawals')
        .aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              amount: { $sum: '$amount' },
            },
          },
        ])
        .toArray(),
      this.orderModel.db
        .collection('withdrawals')
        .find(
          {},
          {
            projection: {
              ownerId: 1,
              amount: 1,
              type: 1,
              status: 1,
              requestDate: 1,
              approvedDate: 1,
              completedDate: 1,
              isUrgent: 1,
              reason: 1,
            },
          },
        )
        .sort({ requestDate: -1, createdAt: -1 })
        .limit(10)
        .toArray(),
    ]);
    const totalBalance = accounts.reduce(
      (sum: number, item: any) => sum + (Number(item.balance) || 0),
      0,
    );

    return {
      totalBalance,
      accountCount: accounts.length,
      accounts: accounts.map((item: any) => ({
        _id: String(item._id),
        name: item.name,
        balance: item.balance || 0,
        totalDeposited: item.totalDeposited || 0,
        totalWithdrawn: item.totalWithdrawn || 0,
        totalReturnedToCompany: item.totalReturnedToCompany || 0,
        updatedAt: item.updatedAt,
      })),
      withdrawalsByStatus: withdrawalSummary,
      recentWithdrawals: recentWithdrawals.map((item: any) => ({
        _id: String(item._id),
        ownerId: item.ownerId ? String(item.ownerId) : null,
        amount: item.amount || 0,
        type: item.type || null,
        status: item.status || null,
        requestDate: item.requestDate || item.createdAt,
        isUrgent: !!item.isUrgent,
        reason: trimText(item.reason, 180),
      })),
    };
  }

  async buildLaborCashflowSnapshot(now: Date, windowDays: number) {
    const dueTo = new Date(now.getTime() + windowDays * DAY_MS);
    const [summary, overdue, dueSoon] = await Promise.all([
      this.orderModel.db
        .collection('laborstatements')
        .aggregate([
          {
            $match: {
              status: { $in: ['draft', 'open'] },
              closingBalance: { $gt: 0 },
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              outstanding: { $sum: '$closingBalance' },
              periodCost: { $sum: '$periodCost' },
              paid: { $sum: '$statementPaymentTotal' },
            },
          },
        ])
        .toArray(),
      this.orderModel.db
        .collection('laborstatements')
        .find(
          {
            status: { $in: ['draft', 'open'] },
            closingBalance: { $gt: 0 },
            dueDate: { $lt: now },
          },
          {
            projection: {
              employeeId: 1,
              status: 1,
              dueDate: 1,
              closingBalance: 1,
              periodFrom: 1,
              periodTo: 1,
            },
          },
        )
        .sort({ dueDate: 1 })
        .limit(10)
        .toArray(),
      this.orderModel.db
        .collection('laborstatements')
        .find(
          {
            status: { $in: ['draft', 'open'] },
            closingBalance: { $gt: 0 },
            dueDate: { $gte: now, $lte: dueTo },
          },
          {
            projection: {
              employeeId: 1,
              status: 1,
              dueDate: 1,
              closingBalance: 1,
              periodFrom: 1,
              periodTo: 1,
            },
          },
        )
        .sort({ dueDate: 1 })
        .limit(10)
        .toArray(),
    ]);

    return {
      windowDays,
      summary: summary[0] || {
        count: 0,
        outstanding: 0,
        periodCost: 0,
        paid: 0,
      },
      overdueCount: overdue.length,
      dueSoonCount: dueSoon.length,
      overdue,
      dueSoon,
    };
  }

  async buildOtherCostCashflowSnapshot(now: Date, windowDays: number) {
    const dueTo = new Date(now.getTime() + windowDays * DAY_MS);
    const [summary, byCategory, overdue, dueSoon] = await Promise.all([
      this.orderModel.db
        .collection('othercosts')
        .aggregate([
          { $match: { isConfirmed: { $ne: true } } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              outstanding: { $sum: '$amount' },
            },
          },
        ])
        .toArray(),
      this.orderModel.db
        .collection('othercosts')
        .aggregate([
          { $match: { isConfirmed: { $ne: true } } },
          {
            $group: {
              _id: { $ifNull: ['$category', 'other'] },
              count: { $sum: 1 },
              amount: { $sum: '$amount' },
            },
          },
          { $sort: { amount: -1 } },
          { $limit: 10 },
        ])
        .toArray(),
      this.orderModel.db
        .collection('othercosts')
        .find(
          { isConfirmed: { $ne: true }, dueDate: { $lt: now } },
          { projection: { amount: 1, dueDate: 1, category: 1, notes: 1 } },
        )
        .sort({ dueDate: 1 })
        .limit(10)
        .toArray(),
      this.orderModel.db
        .collection('othercosts')
        .find(
          { isConfirmed: { $ne: true }, dueDate: { $gte: now, $lte: dueTo } },
          { projection: { amount: 1, dueDate: 1, category: 1, notes: 1 } },
        )
        .sort({ dueDate: 1 })
        .limit(10)
        .toArray(),
    ]);

    return {
      windowDays,
      summary: summary[0] || { count: 0, outstanding: 0 },
      byCategory,
      overdueCount: overdue.length,
      dueSoonCount: dueSoon.length,
      overdue: overdue.map((item: any) => ({
        ...item,
        notes: trimText(item.notes, 180),
      })),
      dueSoon: dueSoon.map((item: any) => ({
        ...item,
        notes: trimText(item.notes, 180),
      })),
    };
  }

  async buildAdsCostCashflowSnapshot(startDate: Date, endDate: Date) {
    const [summary, byChannel, topAdGroups] = await Promise.all([
      this.orderModel.db
        .collection('advertisingcosts')
        .aggregate([
          { $match: { date: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: null,
              records: { $sum: 1 },
              spent: { $sum: '$spentAmount' },
              impressions: { $sum: '$impressions' },
              clicks: { $sum: '$clicks' },
              conversations: { $sum: '$messagingConversationStarted7d' },
            },
          },
        ])
        .toArray(),
      this.orderModel.db
        .collection('advertisingcosts')
        .aggregate([
          { $match: { date: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: { $ifNull: ['$channel', 'unknown'] },
              spent: { $sum: '$spentAmount' },
              records: { $sum: 1 },
            },
          },
          { $sort: { spent: -1 } },
        ])
        .toArray(),
      this.orderModel.db
        .collection('advertisingcosts')
        .aggregate([
          { $match: { date: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: '$adGroupId',
              spent: { $sum: '$spentAmount' },
              records: { $sum: 1 },
            },
          },
          { $sort: { spent: -1 } },
          { $limit: 10 },
        ])
        .toArray(),
    ]);

    return {
      from: startDate,
      to: endDate,
      summary: summary[0] || {
        records: 0,
        spent: 0,
        impressions: 0,
        clicks: 0,
        conversations: 0,
      },
      byChannel,
      topAdGroups,
    };
  }

  async buildQuoteReadinessSnapshot(now: Date) {
    const [agentQuotes, supplierQuotes, expiringAgentQuotes] =
      await Promise.all([
        this.orderModel.db
          .collection('quotes')
          .aggregate([
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                active: { $sum: { $cond: ['$isActive', 1, 0] } },
              },
            },
          ])
          .toArray(),
        this.orderModel.db
          .collection('supplierquotes')
          .aggregate([
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                products: { $addToSet: '$productId' },
                suppliers: { $addToSet: '$supplierId' },
              },
            },
          ])
          .toArray(),
        this.orderModel.db
          .collection('quotes')
          .find(
            {
              isActive: { $ne: false },
              validUntil: {
                $gte: now,
                $lte: new Date(now.getTime() + 7 * DAY_MS),
              },
            },
            {
              projection: {
                productId: 1,
                product: 1,
                agentName: 1,
                unitPrice: 1,
                status: 1,
                validUntil: 1,
              },
            },
          )
          .sort({ validUntil: 1 })
          .limit(10)
          .toArray(),
      ]);
    const supplierSummary = supplierQuotes[0] || {
      count: 0,
      products: [],
      suppliers: [],
    };

    return {
      agentQuotes,
      supplierQuotes: {
        count: supplierSummary.count || 0,
        productCount: asArray(supplierSummary.products).length,
        supplierCount: asArray(supplierSummary.suppliers).length,
      },
      expiringAgentQuotes,
    };
  }

  async buildAccessAuditSnapshot() {
    const [usersByRole, disabledUsers, recentSessions] = await Promise.all([
      this.orderModel.db
        .collection('users')
        .aggregate([
          {
            $group: {
              _id: { $ifNull: ['$role', 'unknown'] },
              count: { $sum: 1 },
              disabled: { $sum: { $cond: ['$isDisabled', 1, 0] } },
            },
          },
          { $sort: { count: -1 } },
        ])
        .toArray(),
      this.orderModel.db
        .collection('users')
        .find(
          { isDisabled: true },
          { projection: { email: 1, fullName: 1, role: 1, updatedAt: 1 } },
        )
        .sort({ updatedAt: -1 })
        .limit(10)
        .toArray(),
      this.orderModel.db
        .collection('sessionlogs')
        .find(
          {},
          {
            projection: { userId: 1, role: 1, action: 1, createdAt: 1, ip: 1 },
          },
        )
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
    ]);

    return {
      usersByRole,
      disabledUsers: disabledUsers.map((item: any) => ({
        _id: String(item._id),
        email: item.email,
        fullName: item.fullName,
        role: item.role,
        updatedAt: item.updatedAt,
      })),
      recentSessions: recentSessions.map((item: any) => ({
        _id: String(item._id),
        userId: item.userId ? String(item.userId) : null,
        role: item.role || null,
        action: item.action || null,
        createdAt: item.createdAt,
        ip: item.ip || null,
      })),
    };
  }
}
