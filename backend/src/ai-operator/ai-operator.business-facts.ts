import { AiOperatorIntent, AiOperatorSnapshot } from "./ai-operator.interfaces";
import {
  asArray,
  formatMoney,
  formatPercent,
  removeVietnameseTone,
} from "./ai-operator.format";

export function buildBusinessFactAnswer(
  message: string,
  snapshot: AiOperatorSnapshot,
  intent: AiOperatorIntent,
): string {
  const source = snapshot.businessFacts;
  const facts = source?.data;
  if (!source?.ok || !facts) {
    return [
      "Chua doc duoc business-facts de tra loi cau hoi nay.",
      `Nguon business-facts: ${source?.error || "khong co trong snapshot"}.`,
    ].join("\n");
  }

  switch (intent) {
    case "product_count":
      return buildProductCountFactAnswer(facts);
    case "product_list":
      return buildProductListFactAnswer(facts);
    case "product_profit_leaderboard":
      return buildProductProfitFactAnswer(message, facts);
    case "fanpage_performance_lookup":
      return buildFanpagePerformanceFactAnswer(facts);
    case "chatbot_fanpage_performance_lookup":
      return buildChatbotFanpagePerformanceFactAnswer(facts);
    case "agent_revenue_leaderboard":
      return buildAgentLeaderboardFactAnswer(facts, "revenue");
    case "agent_profit_leaderboard":
      return buildAgentLeaderboardFactAnswer(facts, "profit");
    case "ads_product_profit_leaderboard":
      return buildAdsProductProfitFactAnswer(facts);
    case "product_ads_revenue_ratio":
      return buildProductAdsRevenueRatioFactAnswer(message, facts);
    default:
      return "Chua co rule-based answer cho intent business fact nay.";
  }
}

export function buildProductCountFactAnswer(facts: any): string {
  const products = facts.products || {};
  const statusText =
    asArray(products.byStatus)
      .slice(0, 6)
      .map((item: any) => `${item.status}: ${item.count}`)
      .join(", ") || "chua co phan nhom status";
  return [
    `Hien tai co ${products.total || 0} san pham trong he thong.`,
    `Dang active: ${products.active || 0}. Theo status: ${statusText}.`,
    `Can bo sung media: ${products.missingMedia || 0}; can bo sung gia NCC: ${products.missingSupplierPrice || 0}.`,
  ].join("\n");
}

export function buildProductListFactAnswer(facts: any): string {
  const products = facts.products || {};
  const rows = asArray(products.list).slice(0, 50);
  const names = rows.map((product: any, index: number) => {
    const sku = product.sku ? ` [${product.sku}]` : "";
    const status = product.status ? ` - ${product.status}` : "";
    return `${index + 1}. ${product.name}${sku}${status}`;
  });
  return [
    `He thong dang co ${products.total || 0} san pham${products.truncated ? `; dang hien ${rows.length}/${products.total} san pham dau tien theo ten.` : "."}`,
    ...(names.length ? names : ["Chua co san pham nao trong snapshot."]),
  ].join("\n");
}

export function buildProductProfitFactAnswer(
  message: string,
  facts: any,
): string {
  const normalized = removeVietnameseTone(message || "").toLowerCase();
  const wantsWeek =
    normalized.includes("tuan") || !normalized.includes("thang");
  const wantsMonth = normalized.includes("thang");
  const sections: string[] = [];
  if (wantsWeek) {
    sections.push(
      productProfitSection("Tuan vua roi", facts.productProfit?.week),
    );
  }
  if (wantsMonth) {
    sections.push(
      productProfitSection("Thang vua roi", facts.productProfit?.month),
    );
  }
  return (
    sections.join("\n\n") ||
    productProfitSection("Ky hien tai", facts.productProfit?.current)
  );
}

export function productProfitSection(label: string, report: any): string {
  const rows = asArray(report?.products).slice(0, 5);
  const top = rows[0];
  if (!top) {
    return `${label}: chua co san pham co don hoan tat trong ky ${factDateRangeText(report?.dateRange)}.`;
  }
  return [
    `${label} (${factDateRangeText(report?.dateRange)}): san pham lai nhat la ${top.productName} voi loi nhuan ${formatMoney(top.netProfit)}, doanh thu ${formatMoney(top.totalRevenue)}, ${top.totalOrders} don, margin ${formatPercent(top.profitMargin)}.`,
    "Top san pham:",
    ...rows.map(
      (row: any, index: number) =>
        `${index + 1}. ${row.productName}: lai ${formatMoney(row.netProfit)}, doanh thu ${formatMoney(row.totalRevenue)}, don ${row.totalOrders}, margin ${formatPercent(row.profitMargin)}.`,
    ),
  ].join("\n");
}

export function buildFanpagePerformanceFactAnswer(facts: any): string {
  const fanpages = facts.fanpages || {};
  const rows = asArray(fanpages.topFanpages).slice(0, 5);
  const top = rows[0];
  return [
    `Hien tai co ${fanpages.total || 0} fanpage; active ${fanpages.active || 0}; bat AI ${fanpages.aiEnabled || 0}; webhook subscribed ${fanpages.webhookSubscribed || 0}.`,
    top
      ? `Fanpage hoat dong tot nhat trong ky ${factDateRangeText(fanpages.dateRange)} la ${top.name}: doanh thu ${formatMoney(top.revenue)}, loi nhuan ${formatMoney(top.netProfit)}, ${top.orders} don, ${top.conversations} hoi thoai, score ${Number(top.performanceScore || 0).toFixed(1)}.`
      : `Chua co du lieu hoat dong fanpage trong ky ${factDateRangeText(fanpages.dateRange)}.`,
    "Top fanpage:",
    ...(rows.length
      ? rows.map(
          (row: any, index: number) =>
            `${index + 1}. ${row.name}: doanh thu ${formatMoney(row.revenue)}, loi nhuan ${formatMoney(row.netProfit)}, don ${row.orders}, hoi thoai ${row.conversations}, needsHuman ${row.needsHuman}.`,
        )
      : ["- Chua co fanpage nao co tin hieu hoat dong."]),
  ].join("\n");
}

export function buildChatbotFanpagePerformanceFactAnswer(facts: any): string {
  const fanpages = facts.fanpages || {};
  const rows = asArray(fanpages.topChatbotFanpages).slice(0, 5);
  const top = rows[0];
  return [
    top
      ? `Chatbot fanpage hoat dong tot nhat trong ky ${factDateRangeText(fanpages.dateRange)} la ${top.name}: AI=${top.aiEnabled ? "bat" : "tat"}, webhook=${top.subscribedWebhook ? "bat" : "tat"}, outbound ${top.outboundCount}, inbound ${top.inboundCount}, needsHuman ${top.needsHuman}, score ${Number(top.chatbotScore || 0).toFixed(1)}.`
      : `Chua co fanpage nao co du lieu chatbot trong ky ${factDateRangeText(fanpages.dateRange)}.`,
    "Top chatbot fanpage:",
    ...(rows.length
      ? rows.map(
          (row: any, index: number) =>
            `${index + 1}. ${row.name}: AI=${row.aiEnabled ? "bat" : "tat"}, webhook=${row.subscribedWebhook ? "bat" : "tat"}, hoi thoai ${row.conversations}, outbound ${row.outboundCount}, needsHuman ${row.needsHuman}.`,
        )
      : ["- Chua co du lieu chatbot fanpage."]),
  ].join("\n");
}

export function buildAgentLeaderboardFactAnswer(
  facts: any,
  metric: "revenue" | "profit",
): string {
  const report = facts.agents?.current || {};
  const rows = [...asArray(report.agents)]
    .sort((a: any, b: any) =>
      metric === "revenue"
        ? (b.totalRevenue || 0) - (a.totalRevenue || 0)
        : (b.netProfit || 0) - (a.netProfit || 0),
    )
    .slice(0, 5);
  const top = rows[0];
  const label = metric === "revenue" ? "doanh thu" : "loi nhuan";
  if (!top) {
    return `Chua co dai ly nao co don hoan tat trong ky ${factDateRangeText(report.dateRange)}.`;
  }
  return [
    `Dai ly co ${label} cao nhat trong ky ${factDateRangeText(report.dateRange)} la ${top.agentName}: doanh thu ${formatMoney(top.totalRevenue)}, loi nhuan ${formatMoney(top.netProfit)}, ${top.totalOrders} don, margin ${formatPercent(top.profitMargin)}.`,
    "Top dai ly:",
    ...rows.map(
      (row: any, index: number) =>
        `${index + 1}. ${row.agentName}: doanh thu ${formatMoney(row.totalRevenue)}, loi nhuan ${formatMoney(row.netProfit)}, don ${row.totalOrders}, hoa hong ${formatMoney(row.totalAgentCommission)}.`,
    ),
  ].join("\n");
}

export function buildAdsProductProfitFactAnswer(facts: any): string {
  const report = facts.adsProducts?.current || {};
  const rows = asArray(report.products).slice(0, 5);
  const top = rows[0];
  if (!top) {
    return `Chua co du lieu ads theo san pham trong ky ${factDateRangeText(report.dateRange)}.`;
  }
  return [
    `Quang cao ve san pham co loi nhuan cao nhat trong ky ${factDateRangeText(report.dateRange)} la ${top.productName}: loi nhuan sau ads ${formatMoney(top.netProfitAfterAds)}, doanh thu gan ads ${formatMoney(top.adAttributedRevenue)}, spend ${formatMoney(top.adsSpend)}, ${top.adAttributedOrders} don gan ads.`,
    "Top san pham theo loi nhuan sau ads:",
    ...rows.map(
      (row: any, index: number) =>
        `${index + 1}. ${row.productName}: lai sau ads ${formatMoney(row.netProfitAfterAds)}, spend ${formatMoney(row.adsSpend)}, doanh thu gan ads ${formatMoney(row.adAttributedRevenue)}, ty le ads/doanh thu ${row.adsRevenueRatio == null ? "N/A" : formatPercent(row.adsRevenueRatio)}.`,
    ),
  ].join("\n");
}

export function buildProductAdsRevenueRatioFactAnswer(
  message: string,
  facts: any,
): string {
  const report = facts.adsProducts?.current || {};
  const rows = asArray(report.products);
  const productName = extractProductNameFromQuestion(message);
  if (!productName) {
    const suggestions = rows
      .filter(
        (row: any) => (row.adsSpend || 0) > 0 || (row.totalRevenue || 0) > 0,
      )
      .slice(0, 5)
      .map((row: any, index: number) => `${index + 1}. ${row.productName}`)
      .join("\n");
    return [
      "Can ten san pham cu the de tinh ty le chi phi ads/doanh thu.",
      suggestions
        ? `Mot so san pham co du lieu:\n${suggestions}`
        : "Chua co san pham nao co du lieu ads/doanh thu trong ky.",
    ].join("\n");
  }

  const matched = findProductAdsFact(rows, productName);
  if (!matched) {
    return [
      `Khong tim thay san pham khop voi "${productName}" trong du lieu ads/doanh thu ky ${factDateRangeText(report.dateRange)}.`,
      "Hay gui lai dung ten san pham trong danh sach san pham.",
    ].join("\n");
  }

  return [
    `San pham ${matched.productName} trong ky ${factDateRangeText(report.dateRange)}: chi phi ads ${formatMoney(matched.adsSpend)}, doanh thu ${formatMoney(matched.totalRevenue)}.`,
    `Ty le ads/doanh thu = ${matched.adsRevenueRatio == null ? "N/A do doanh thu = 0" : formatPercent(matched.adsRevenueRatio)}.`,
    `Neu chi tinh don gan ads: doanh thu ${formatMoney(matched.adAttributedRevenue)}, ty le ${matched.adAttributedAdsRevenueRatio == null ? "N/A" : formatPercent(matched.adAttributedAdsRevenueRatio)}, loi nhuan sau ads ${formatMoney(matched.netProfitAfterAds)}.`,
  ].join("\n");
}

export function factDateRangeText(dateRange: any): string {
  if (!dateRange?.from || !dateRange?.to) return "khong ro ky";
  return `${dateRange.from} den ${dateRange.to}`;
}

export function extractProductNameFromQuestion(message: string): string | null {
  const text = String(message || "")
    .replace(/\s+/g, " ")
    .trim();
  const normalized = removeVietnameseTone(text).toLowerCase();
  if (
    !normalized ||
    normalized.includes("san pham ...") ||
    normalized.endsWith("san pham")
  )
    return null;
  const match =
    normalized.match(/san pham\s+(.+?)(?:\?|$)/) ||
    normalized.match(/product\s+(.+?)(?:\?|$)/);
  const value = match?.[1]
    ?.trim()
    .replace(/^la\s+/, "")
    .replace(/^ten\s+/, "");
  if (!value || ["gi", "nao", "...", "."].includes(value)) return null;
  return value;
}

export function findProductAdsFact(rows: any[], productName: string) {
  const target = removeVietnameseTone(productName || "")
    .toLowerCase()
    .trim();
  if (!target) return null;
  return (
    asArray(rows).find((row: any) => {
      const name = removeVietnameseTone(
        String(row.productName || ""),
      ).toLowerCase();
      const sku = removeVietnameseTone(
        String(row.productSku || ""),
      ).toLowerCase();
      return (
        name === target ||
        sku === target ||
        name.includes(target) ||
        target.includes(name)
      );
    }) || null
  );
}
