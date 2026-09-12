import {
  AiOperatorRecommendation,
  AiOperatorSnapshot,
} from "./ai-operator.interfaces";
import {
  asArray,
  formatMoney,
  formatPercent,
  labelScaleAction,
} from "./ai-operator.format";

export function buildRecommendations(
  snapshot: AiOperatorSnapshot,
): AiOperatorRecommendation[] {
  const recommendations: AiOperatorRecommendation[] = [];
  const performance = asArray(snapshot.ads.performance.data);
  const losingAds = performance
    .filter(
      (ad: any) =>
        (ad.totalAdsSpent || 0) > 0 &&
        ((ad.totalNetProfit || 0) < 0 || (ad.roi || 0) < 50),
    )
    .sort((a: any, b: any) => (a.totalNetProfit || 0) - (b.totalNetProfit || 0))
    .slice(0, 5);

  losingAds.forEach((ad: any, index: number) => {
    recommendations.push({
      id: `AI-ADS-LOSS-${index + 1}`,
      type: "ads.review_loss",
      priority: (ad.totalNetProfit || 0) < 0 ? "high" : "medium",
      title: `Kiem tra quang cao ${ad.adGroupName || ad.adGroupId}`,
      reason: `ROI ${formatPercent(ad.roi)}, loi nhuan ${formatMoney(ad.totalNetProfit)}, chi ads ${formatMoney(ad.totalAdsSpent)} trong ky.`,
      proposedAction:
        (ad.totalNetProfit || 0) < 0
          ? "Tam dung hoac giam ngan sach nhom quang cao nay sau khi duoc duyet."
          : "Giam ngan sach/test lai noi dung truoc khi scale tiep.",
      requiresApproval: true,
      riskLevel: "medium",
      source: {
        module: "ad-group-profit-report",
        id: ad.adGroupId,
        linkTo: `/ad-group-profit-report?adGroupId=${encodeURIComponent(ad.adGroupId || "")}`,
      },
    });
  });

  const optimalSpend = asArray(snapshot.ads.optimalSpendSuggestions.data)
    .filter((item: any) =>
      ["increase", "decrease", "kill"].includes(item.scaleAction),
    )
    .slice(0, 5);

  optimalSpend.forEach((item: any, index: number) => {
    const isIncrease = item.scaleAction === "increase";
    recommendations.push({
      id: `AI-ADS-SCALE-${index + 1}`,
      type: `ads.${item.scaleAction}`,
      priority: item.scaleAction === "kill" ? "high" : "medium",
      title: `${labelScaleAction(item.scaleAction)} ${item.adGroupName || item.adGroupId}`,
      reason:
        item.reason ||
        `ROI hien tai ${formatPercent(item.currentROI)}, ngan sach goi y ${formatMoney(item.suggestedSpend)}.`,
      proposedAction: isIncrease
        ? `Tang ngan sach trong gioi han rule, toi da toi ${formatMoney(item.suggestedSpend)} neu duoc duyet.`
        : `Dieu chinh ngan sach ve ${formatMoney(item.suggestedSpend)} neu duoc duyet.`,
      requiresApproval: true,
      riskLevel: isIncrease ? "high" : "medium",
      source: {
        module: "ad-group-profit-report",
        id: item.adGroupId,
        linkTo: `/ad-group-profit-report?adGroupId=${encodeURIComponent(item.adGroupId || "")}`,
      },
    });
  });

  const financeActions = asArray(snapshot.finance.actions.data?.actions);
  financeActions.slice(0, 5).forEach((action: any, index: number) => {
    recommendations.push({
      id: `AI-FINANCE-${index + 1}`,
      type: `finance.${action.type || "review"}`,
      priority: action.priority || "medium",
      title: action.title || "Kiem tra tai chinh",
      reason:
        action.reason ||
        action.description ||
        "Financial Control dang co khuyen nghi can xem.",
      proposedAction:
        action.description ||
        action.impact ||
        "Mo man hinh tai chinh de kiem tra va xu ly.",
      requiresApproval: ["critical", "high"].includes(action.priority),
      riskLevel: action.priority === "critical" ? "high" : "medium",
      source: {
        module: "financial-control",
        id: action.id,
        linkTo: action.linkTo,
      },
    });
  });

  const budgetPreview = snapshot.strategic.budgetPreview.data;
  if (
    budgetPreview?.systemLocked ||
    budgetPreview?.globalStatus === "blocked"
  ) {
    recommendations.push({
      id: "AI-BUDGET-CASHFLOW-LOCK",
      type: "finance.ads_budget_locked",
      priority: "critical",
      title: "Tam khoa scale ads do dieu kien dong tien",
      reason:
        budgetPreview.recommendation ||
        "Budget allocation dry-run cho thay he thong dang bi khoa hoac khong du dieu kien scale.",
      proposedAction:
        "Khong tang ngan sach ads; kiem tra free cash, committed cash, no den han va allocation preview truoc khi duyet.",
      requiresApproval: true,
      riskLevel: "high",
      source: { module: "budget-allocation", linkTo: "/budget-allocation" },
    });
  }

  const loanDashboard = snapshot.strategic.loanDashboard.data;
  if (
    (loanDashboard?.overdueAmount || 0) > 0 ||
    (loanDashboard?.due14Days || 0) > 0
  ) {
    recommendations.push({
      id: "AI-LOAN-DUE",
      type: "finance.loan_due",
      priority: (loanDashboard.overdueAmount || 0) > 0 ? "critical" : "high",
      title: "Kiem tra khoan vay den han",
      reason: `Qua han ${formatMoney(loanDashboard.overdueAmount || 0)}, den han 14 ngay ${formatMoney(loanDashboard.due14Days || 0)}.`,
      proposedAction:
        "Doi chieu lich tra no voi free cash va quy owner truoc khi duyet chi hoac scale ads.",
      requiresApproval: true,
      riskLevel: "high",
      source: { module: "loan-management", linkTo: "/loans" },
    });
  }

  const laborCashflow = snapshot.strategic.laborCashflow.data;
  if (
    (laborCashflow?.summary?.outstanding || 0) > 0 ||
    (laborCashflow?.overdueCount || 0) > 0
  ) {
    recommendations.push({
      id: "AI-LABOR-CASHFLOW",
      type: "finance.labor_due",
      priority: (laborCashflow.overdueCount || 0) > 0 ? "high" : "medium",
      title: "Soat luong/cham cong chua thanh toan",
      reason: `Con ${laborCashflow.summary?.count || 0} statement, outstanding ${formatMoney(laborCashflow.summary?.outstanding || 0)}, qua han ${laborCashflow.overdueCount || 0}.`,
      proposedAction:
        "Xac nhan statement, chung tu va lich chi truoc khi chot free cash.",
      requiresApproval: true,
      riskLevel: "medium",
      source: { module: "labor-cost1", linkTo: "/labor-cost1" },
    });
  }

  const otherCostCashflow = snapshot.strategic.otherCostCashflow.data;
  if (
    (otherCostCashflow?.summary?.outstanding || 0) > 0 ||
    (otherCostCashflow?.overdueCount || 0) > 0
  ) {
    recommendations.push({
      id: "AI-OTHER-COST-CASHFLOW",
      type: "finance.other_cost_due",
      priority: (otherCostCashflow.overdueCount || 0) > 0 ? "high" : "medium",
      title: "Soat chi phi van hanh chua thanh toan",
      reason: `Con ${otherCostCashflow.summary?.count || 0} khoan, outstanding ${formatMoney(otherCostCashflow.summary?.outstanding || 0)}, qua han ${otherCostCashflow.overdueCount || 0}.`,
      proposedAction:
        "Uu tien khoan den han/qua han va cap nhat chung tu de forecast cashflow khong lech.",
      requiresApproval: true,
      riskLevel: "medium",
      source: { module: "other-cost", linkTo: "/other-cost" },
    });
  }

  const ownerFund = snapshot.strategic.ownerFund.data;
  const pendingOwnerWithdrawal = asArray(ownerFund?.withdrawalsByStatus).find(
    (item: any) => item._id === "pending",
  );
  if ((pendingOwnerWithdrawal?.amount || 0) > 0) {
    recommendations.push({
      id: "AI-OWNER-WITHDRAWAL-PENDING",
      type: "finance.owner_withdrawal_pending",
      priority: "high",
      title: "Co lenh rut owner dang cho duyet",
      reason: `Dang pending ${pendingOwnerWithdrawal.count || 0} lenh, tong ${formatMoney(pendingOwnerWithdrawal.amount || 0)}.`,
      proposedAction:
        "Chi duyet rut owner sau khi tru committed cash, survival floor, no den han va budget ads da khoa.",
      requiresApproval: true,
      riskLevel: "high",
      source: { module: "owner-fund", linkTo: "/owner-fund" },
    });
  }

  const availableFunds = snapshot.strategic.availableFunds.data?.latest;
  if (availableFunds && (availableFunds.available || 0) <= 0) {
    recommendations.push({
      id: "AI-AVAILABLE-FUNDS-LOW",
      type: "finance.available_funds_low",
      priority: "high",
      title: "Von kha dung conservative dang thap",
      reason: `Available funds snapshot moi nhat: ${formatMoney(availableFunds.available || 0)}; reserved payroll/payables/other ${formatMoney((availableFunds.reservedPayroll || 0) + (availableFunds.reservedPayables || 0) + (availableFunds.reservedOther || 0))}.`,
      proposedAction:
        "Tam dung quyet dinh chi/rut/scale cho den khi cap nhat tien thu that va khoan reserve.",
      requiresApproval: true,
      riskLevel: "high",
      source: {
        module: "finance.available-funds",
        linkTo: "/finance/available-funds",
      },
    });
  }

  const receivables = snapshot.receivables.data;
  const supplierOverdue = asArray(receivables?.supplier?.overdue);
  if (supplierOverdue.length > 0) {
    const total = supplierOverdue.reduce(
      (sum: number, item: any) => sum + (item.balance || 0),
      0,
    );
    recommendations.push({
      id: "AI-DEBT-SUPPLIER-OVERDUE",
      type: "receivable.supplier_overdue",
      priority: "high",
      title: `${supplierOverdue.length} khoan NCC qua han`,
      reason: `Tong so tien qua han trong danh sach doc duoc: ${formatMoney(total)}.`,
      proposedAction:
        "Nhac ke toan/ops kiem tra doi soat va lien he NCC thanh toan.",
      requiresApproval: false,
      riskLevel: "low",
      source: { module: "supplier-payable", linkTo: "/supplier-payable" },
    });
  }

  const agentOverdue = asArray(receivables?.agent?.overdue);
  if (agentOverdue.length > 0) {
    const total = agentOverdue.reduce(
      (sum: number, item: any) => sum + (item.closingBalance || 0),
      0,
    );
    recommendations.push({
      id: "AI-DEBT-AGENT-OVERDUE",
      type: "payable.agent_overdue",
      priority: "medium",
      title: `${agentOverdue.length} sao ke dai ly qua han`,
      reason: `Tong so tien con phai xu ly: ${formatMoney(total)}.`,
      proposedAction: "Nhac ke toan kiem tra lich thanh toan hoa hong dai ly.",
      requiresApproval: false,
      riskLevel: "low",
      source: { module: "agent-receivable", linkTo: "/agent-receivable" },
    });
  }

  const employeeKpi = snapshot.manager?.employeeKpi?.data;
  const criticalEmployeeAlerts = asArray(employeeKpi?.alerts).filter(
    (alert: any) => String(alert.type || "").toUpperCase() === "CRITICAL",
  );
  const underperformers = asArray(employeeKpi?.underperformers);
  if (criticalEmployeeAlerts.length || underperformers.length) {
    recommendations.push({
      id: "AI-MGR-EMPLOYEE-KPI",
      type: "manager.employee_kpi_alert",
      priority: criticalEmployeeAlerts.length ? "high" : "medium",
      title: "Soat KPI va workload nhan vien Ads",
      reason: criticalEmployeeAlerts.length
        ? `Co ${criticalEmployeeAlerts.length} alert KPI critical; ${underperformers.length} nhan vien chua dat KPI profitable.`
        : `Co ${underperformers.length} nhan vien chua dat KPI profitable trong ky.`,
      proposedAction:
        "Manager chot owner, cap lai ad group lo/qua tai va tao task coaching neu can; khong bulk-assign khi chua xac nhan employeeId/adGroupId.",
      requiresApproval: true,
      riskLevel: "medium",
      source: { module: "employee-ads-kpi", linkTo: "/employee-ads-kpi" },
    });
  }

  const tokenHealth = snapshot.manager?.tokenHealth?.data;
  const tokenIssueCount =
    (tokenHealth?.summary?.failing || 0) +
    (tokenHealth?.summary?.expired || 0) +
    (tokenHealth?.summary?.expiringSoon || 0);
  const syncHealth = snapshot.ads.syncHealth?.data;
  const syncIssueCount =
    (syncHealth?.summary?.failedPlatforms || 0) +
    (syncHealth?.summary?.stalePlatforms || 0) +
    (syncHealth?.summary?.tokenIssues || 0);
  if (tokenIssueCount || syncIssueCount) {
    recommendations.push({
      id: "AI-MGR-TOKEN-SYNC-HEALTH",
      type: "manager.token_sync_health",
      priority: tokenIssueCount + syncIssueCount >= 3 ? "high" : "medium",
      title: "Kiem tra token va sync ads/social",
      reason: `Token issues ${tokenIssueCount}; sync issues ${syncIssueCount}. Du lieu ads/fanpage co the tre hoac sai neu sync fail.`,
      proposedAction:
        "Kiem tra token sap het han/invalid, sync health theo platform va chay validate/sync lai sau khi manager xac nhan.",
      requiresApproval: true,
      riskLevel: "medium",
      source: { module: "api-tokens", linkTo: "/api-tokens" },
    });
  }

  const costPerOrder = snapshot.ads.costPerOrder?.data;
  if ((costPerOrder?.summary?.noOrdersWithSpend || 0) > 0) {
    recommendations.push({
      id: "AI-MGR-CPO-NO-ORDER-SPEND",
      type: "ads.no_order_spend",
      priority: "high",
      title: "Co spend ads khong ra don trong ky",
      reason: `${costPerOrder.summary.noOrdersWithSpend} dong/ngay ad group co chi phi nhung khong co order tuong ung; blended CPO ${costPerOrder.summary.blendedCostPerOrder == null ? "N/A" : formatMoney(costPerOrder.summary.blendedCostPerOrder)}.`,
      proposedAction:
        "Uu tien soat tracking, mapping adGroupId, creative/lead funnel va giam ngan sach nhom spend khong ra don sau khi duyet.",
      requiresApproval: true,
      riskLevel: "medium",
      source: { module: "ad-report", linkTo: "/ad-report/cost-per-order" },
    });
  }

  const marketingDecision = snapshot.manager?.marketing?.data;
  const readiness =
    marketingDecision?.overview?.readiness ||
    snapshot.strategic.aiMarketingOverview.data?.readiness;
  if (readiness && readiness.status && readiness.status !== "ready") {
    recommendations.push({
      id: "AI-MGR-MARKETING-READINESS",
      type: "manager.marketing_readiness",
      priority: readiness.status === "blocked" ? "high" : "medium",
      title: "AI Marketing chua san sang de quyet dinh sau",
      reason:
        readiness.reason ||
        readiness.message ||
        `Readiness hien tai: ${readiness.status}.`,
      proposedAction:
        "Bo sung du lieu lead/creative/evaluation con thieu truoc khi dung AI de de xuat scale, pause hoac doi creative.",
      requiresApproval: false,
      riskLevel: "medium",
      source: { module: "ai-marketing", linkTo: "/ai-marketing" },
    });
  }

  const conversations = snapshot.manager?.conversations?.data || null;
  const pendingOrders = snapshot.manager?.pendingOrders?.data || null;
  const managerNeedsHuman = Number(
    conversations?.needsHuman || conversations?.needsHumanCount || 0,
  );
  const managerAwaitingOrder = Number(
    conversations?.awaitingOrder || conversations?.awaitingOrderCount || 0,
  );
  const pendingOrderCount = asArray(pendingOrders?.recentPending).length;
  if (managerNeedsHuman || managerAwaitingOrder || pendingOrderCount) {
    recommendations.push({
      id: "AI-MGR-CONVERSATION-SLA",
      type: "manager.conversation_sla",
      priority: managerNeedsHuman ? "high" : "medium",
      title: "Hoi thoai/pending order can manager can thiep",
      reason: `Needs human ${managerNeedsHuman}; awaiting order ${managerAwaitingOrder}; pending order snapshot ${pendingOrderCount}.`,
      proposedAction:
        "Giao sale/ads owner xu ly hoi thoai co y dinh mua, draft order va fanpage co auto AI bat thuong.",
      requiresApproval: false,
      riskLevel: "low",
      source: { module: "chat-messages", linkTo: "/chat-messages" },
    });
  }

  return recommendations.slice(0, 20);
}
