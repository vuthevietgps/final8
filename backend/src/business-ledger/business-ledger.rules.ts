import { DealerReturnPolicy } from '../common/dealer-return-policy';
/** Management ledger in integer VND. Commercial obligations never imply cash receipt. */
export const ENTRY_KINDS = [
  "sale",
  "sale_credit",
  "direct_cost",
  "supplier_credit",
  "inventory_cost",
  "inventory_recovery",
  "returned_stock",
  "expense",
  "expense_credit",
  "dealer_cost_recovery",
  "opening_receivable",
  "opening_payable",
  "cash_adjustment_in",
  "cash_adjustment_out",
  "payment",
  "debt_offset",
  "reversal",
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
export const PARTIES = [
  "company",
  "customer",
  "supplier",
  "agent",
  "other",
] as const;
export type Party = (typeof PARTIES)[number];

export interface OrderContext {
  orderId: string;
  productId: string;
  productCategoryId?: string;
  productCategoryName?: string;
  productCategoryCode?: string;
  agentId?: string;
  supplierId?: string;
  adGroupId?: string;
  quantity: number;
  orderDate: string;
  saleMode: "retail" | "dealer";
  fulfillment: "supplier_direct" | "inventory";
  returnPolicy?: "recoverable" | "production_committed";
  dealerReturnPolicy?: DealerReturnPolicy;
  dealerReturnTerms?: string;
}

export interface OperationalState {
  dealerSaleRecognizedAt?: Date | string;
  orderStatus?: string;
  productionStatus?: string;
  trackingNumber?: string;
}

/** Reuse the canonical operational statuses; never treat a payment trigger as delivery. */
export function revenueEligibility(order: OperationalState, saleMode: "retail" | "dealer") {
  const eligible = saleMode === "retail"
    ? order.orderStatus === "Giao thành công"
    : Boolean(order.dealerSaleRecognizedAt)
      || (order.productionStatus === "Đã trả kết quả" && Boolean(order.trackingNumber?.trim()));
  return {
    eligible,
    reason: saleMode === "retail"
      ? "Bán lẻ: chỉ ghi doanh thu khi Giao thành công."
      : "Bán đại lý: cần Đã trả kết quả và mã vận đơn thực tế.",
  };
}

export function assertOperationalPosting(kind: EntryKind, order: OperationalState, context: OrderContext) {
  if (context.saleMode === 'retail' && order.orderStatus === 'Hàng hoàn'
      && kind === 'supplier_credit') {
    throw new Error('Bán lẻ giao không thành công vẫn chịu giá vốn NCC, phí giao và phí hoàn; không cho tự giảm giá vốn hoặc nợ NCC do hoàn.');
  }
  if (kind === 'dealer_cost_recovery'
      && (context.saleMode !== 'dealer' || !revenueEligibility(order, 'dealer').eligible)) {
    throw new Error('Chỉ ghi phí đại lý chịu cho đơn đã xuất bán cho đại lý.');
  }
  if (context.saleMode === 'dealer' && order.orderStatus === 'Hàng hoàn'
      && revenueEligibility(order, 'dealer').eligible
      && ['sale_credit', 'supplier_credit', 'inventory_recovery', 'returned_stock'].includes(kind)) {
    throw new Error('Hàng đã bán thuộc đại lý. Công ty chỉ giữ hộ hàng hoàn; không giảm doanh thu/giá vốn hoặc nhập thành hàng của công ty.');
  }
  if (kind === "sale") {
    const result = revenueEligibility(order, context.saleMode);
    if (!result.eligible) throw new Error(result.reason);
  }
  if (kind === "direct_cost" && context.returnPolicy === "production_committed"
      && order.productionStatus !== "Đã trả kết quả") {
    throw new Error("Hàng sản xuất theo yêu cầu: chỉ ghi nghĩa vụ giá vốn khi Đã trả kết quả.");
  }
  if (["supplier_credit", "inventory_recovery", "returned_stock"].includes(kind)) {
    if (kind === 'supplier_credit' && context.returnPolicy !== "recoverable")
      throw new Error("Chính sách đơn không cho tự thu hồi giá vốn hoặc giảm nợ NCC khi hoàn.");
    if (order.orderStatus !== "Hàng hoàn")
      throw new Error("Chỉ thu hồi giá vốn hàng hoàn khi đơn có trạng thái Hàng hoàn và chứng từ nhận lại.");
  }
}
export interface Effects {
  revenue: number;
  cogs: number;
  expense: number;
  debts: Array<{ partyKey: string; amount: number }>;
  cash: Array<{ accountId: string; amount: number }>;
}
export interface Posting {
  kind: EntryKind;
  amount: number;
  fromParty?: Party;
  toParty?: Party;
  expenseParty?: Party;
  otherParty?: string;
  fromAccountId?: string;
  toAccountId?: string;
  settlesDebt?: boolean;
}
export function emptyEffects(): Effects {
  return { revenue: 0, cogs: 0, expense: 0, debts: [], cash: [] };
}
export function money(value: unknown): number {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 0 ||
    Number(value) > 1_000_000_000_000
  ) {
    throw new Error("Số tiền phải là số nguyên VND từ 0 đến 1.000 tỷ.");
  }
  return Number(value);
}
export function partyKey(
  party: Party,
  context?: OrderContext,
  other?: string,
): string {
  if (party === "company") return "company";
  if (party === "other") {
    if (!other?.trim())
      throw new Error("Cần mã đối tác khác để theo dõi công nợ.");
    return `other:${other.trim().toLowerCase()}`;
  }
  if (!context)
    throw new Error("Giao dịch khách/NCC/đại lý phải liên kết đơn hàng.");
  // End-customer collections settle the dealer's purchase obligation in wholesale mode.
  if (party === "customer") {
    return context.saleMode === "dealer"
      ? `agent:${context.agentId}`
      : `customer:${context.orderId}`;
  }
  const id = party === "agent" ? context.agentId : context.supplierId;
  if (!id)
    throw new Error(
      `Đơn chưa có ${party === "agent" ? "đại lý" : "nhà cung cấp"}.`,
    );
  return `${party}:${id}`;
}
export function calculateEffects(
  posting: Posting,
  context?: OrderContext,
): Effects {
  const amount = money(posting.amount);
  const effects = emptyEffects();
  const debt = (key: string, value: number) => {
    if (key !== "company" && value)
      effects.debts.push({ partyKey: key, amount: value });
  };
  if (
    posting.kind === "cash_adjustment_in" ||
    posting.kind === "cash_adjustment_out"
  ) {
    if (context || posting.fromParty || posting.toParty || posting.settlesDebt)
      throw new Error(
        "Điều chỉnh kiểm quỹ chỉ tác động tài khoản tiền, không gắn đơn/công nợ.",
      );
    const increase = posting.kind === "cash_adjustment_in";
    const accountId = increase ? posting.toAccountId : posting.fromAccountId;
    if (
      !accountId ||
      amount <= 0 ||
      (increase ? posting.fromAccountId : posting.toAccountId)
    )
      throw new Error("Chọn một tài khoản và số chênh lệch dương.");
    effects.cash.push({ accountId, amount: increase ? amount : -amount });
    return effects;
  }
  if (posting.kind === "payment") {
    if (!posting.fromParty || !posting.toParty || amount <= 0)
      throw new Error("Cần bên trả, bên nhận và số tiền dương.");
    const from = partyKey(posting.fromParty, context, posting.otherParty);
    const to = partyKey(posting.toParty, context, posting.otherParty);
    if (posting.fromParty === "company") {
      if (!posting.fromAccountId)
        throw new Error("Chọn tài khoản công ty chi tiền.");
      effects.cash.push({ accountId: posting.fromAccountId, amount: -amount });
    } else if (posting.fromAccountId)
      throw new Error("Tài khoản chi chỉ dành cho công ty.");
    if (posting.toParty === "company") {
      if (!posting.toAccountId)
        throw new Error("Chọn tài khoản công ty nhận tiền.");
      effects.cash.push({ accountId: posting.toAccountId, amount });
    } else if (posting.toAccountId)
      throw new Error("Tài khoản nhận chỉ dành cho công ty.");
    if (
      posting.fromParty === posting.toParty &&
      (posting.fromParty !== "company" ||
        posting.fromAccountId === posting.toAccountId)
    ) {
      throw new Error("Bên trả và bên nhận phải khác nhau.");
    }
    // Non-order transfers (capital, bank transfers, etc.) are cash only. Expenses
    // outside an order use the same other-party key and must be settled explicitly.
    if (context || posting.settlesDebt) {
      debt(from, -amount);
      debt(to, amount);
    }
    return effects;
  }
  if (
    posting.fromAccountId ||
    posting.toAccountId ||
    posting.fromParty ||
    posting.toParty
  ) {
    throw new Error("Nghiệp vụ mua bán/chi phí không tự tạo giao dịch tiền.");
  }
  if (
    posting.kind === "opening_receivable" ||
    posting.kind === "opening_payable"
  ) {
    if (!posting.expenseParty || posting.expenseParty === "company")
      throw new Error("Chọn đối tác có số dư công nợ đầu kỳ.");
    debt(
      partyKey(posting.expenseParty, context, posting.otherParty),
      (posting.kind === "opening_receivable" ? 1 : -1) * amount,
    );
    return effects;
  }
  if (posting.kind === "expense" || posting.kind === "expense_credit") {
    if (
      !posting.expenseParty ||
      posting.expenseParty === "company" ||
      posting.expenseParty === "customer"
    ) {
      throw new Error("Chọn bên công ty có nghĩa vụ trả chi phí.");
    }
    const sign = posting.kind === "expense" ? 1 : -1;
    effects.expense = sign * amount;
    debt(
      partyKey(posting.expenseParty, context, posting.otherParty),
      -sign * amount,
    );
    return effects;
  }
  if (!context) throw new Error("Nghiệp vụ mua bán phải liên kết đơn hàng.");
  if (context.saleMode === "dealer" && !context.agentId)
    throw new Error("Đơn bán đại lý chưa có đại lý.");
  switch (posting.kind) {
    case 'dealer_cost_recovery': {
      if (context.saleMode !== 'dealer') throw new Error('Khoản thu bù phải thuộc đơn đại lý.');
      // Offset the recorded cost, without creating additional goods revenue or cash.
      effects.expense = -amount;
      debt(partyKey('agent', context), amount);
      break;
    }
    case "sale":
    case "sale_credit": {
      effects.revenue = (posting.kind === "sale" ? 1 : -1) * amount;
      debt(partyKey("customer", context), effects.revenue);
      break;
    }
    case "direct_cost":
    case "supplier_credit": {
      if (context.fulfillment !== "supplier_direct")
        throw new Error(
          "Hàng xuất kho dùng giá vốn kho, không phát sinh lại nợ NCC.",
        );
      effects.cogs = (posting.kind === "direct_cost" ? 1 : -1) * amount;
      debt(partyKey("supplier", context), -effects.cogs);
      break;
    }
    case "inventory_cost":
    case "inventory_recovery": {
      if (context.fulfillment !== "inventory")
        throw new Error("Đơn giao từ NCC dùng giá vốn trực tiếp.");
      effects.cogs = (posting.kind === "inventory_cost" ? 1 : -1) * amount;
      break;
    }
    case "returned_stock": {
      if (context.saleMode !== 'retail') throw new Error('Hàng giữ hộ đại lý không phải tài sản công ty.');
      // Stock received by the company is an asset recovery, not a supplier debt credit.
      effects.cogs = -amount;
      break;
    }
    default:
      throw new Error("Loại nghiệp vụ không hợp lệ.");
  }
  return effects;
}
export function reverseEffects(effects: Effects): Effects {
  return {
    revenue: -effects.revenue,
    cogs: -effects.cogs,
    expense: -effects.expense,
    debts: effects.debts.map((row) => ({ ...row, amount: -row.amount })),
    cash: effects.cash.map((row) => ({ ...row, amount: -row.amount })),
  };
}
export function settlementStatus(
  hasCommercial: boolean,
  balances: number[],
  pendingCount: number,
  hasPayments: boolean,
) {
  if (!hasCommercial) return "unreviewed";
  if (pendingCount) return "pending_confirmation";
  if (balances.every((value) => value === 0)) return "settled";
  return hasPayments ? "partial" : "outstanding";
}
