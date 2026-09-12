import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import {EventEmitter2} from '@nestjs/event-emitter';
import {notifyLedgerChanged} from './ledger-events';
import { Model, Types } from "mongoose";
import { createHash } from "crypto";
import { TestOrder2 } from "../test-order2/schemas/test-order2.schema";
import {
  LedgerAccount,
  LedgerEntry,
  LedgerOrderProfile,
} from "./business-ledger.schema";
import {
  CreateLedgerAccountDto,
  CreateLedgerEntryDto,
  CreateLedgerProfileDto,
} from "./business-ledger.dto";
import {
  calculateEffects,
  money,
  OrderContext,
  Posting,
  assertOperationalPosting,
  revenueEligibility,
  reverseEffects,
} from "./business-ledger.rules";
import { buildLedgerReport, rangeDates } from "./business-ledger.report";
import { isDealerSale } from '../test-order2/order-sale-mode';
import { receivedPurchaseValue } from '../purchase/purchase-costs';

@Injectable()
export class BusinessLedgerService implements OnModuleInit {
  constructor(
    @InjectModel(LedgerEntry.name) private readonly entries: Model<LedgerEntry>,
    @InjectModel(LedgerAccount.name)
    private readonly accounts: Model<LedgerAccount>,
    @InjectModel(LedgerOrderProfile.name)
    private readonly profiles: Model<LedgerOrderProfile>,
    @InjectModel(TestOrder2.name) private readonly orders: Model<TestOrder2>,
    @Optional() private events?:EventEmitter2,
  ) {}

  async onModuleInit() {
    // Idempotency and reversal protection require the unique indexes, including
    // installations which disable Mongoose autoIndex. Never drop existing indexes.
    await Promise.all([
      this.entries.createIndexes(),
      this.accounts.createIndexes(),
      this.profiles.createIndexes(),
    ]);
  }

  private id(value: string) {
    if (!Types.ObjectId.isValid(value))
      throw new BadRequestException("Mã không hợp lệ.");
    return value;
  }
  private date(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(+date) || +date > Date.now())
      throw new BadRequestException(
        "Ngày không hợp lệ hoặc nằm trong tương lai.",
      );
    return date;
  }
  private required(value: string, field: string) {
    if (!value?.trim()) throw new BadRequestException(`Cần ${field}.`);
    return value.trim();
  }
  private actor(value: string) {
    return this.id(value);
  }
  private async guarded<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error?.code === 11000)
        throw new ConflictException(
          "Nghiệp vụ đã tồn tại hoặc đã được đảo trước đó.",
        );
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      )
        throw error;
      throw error;
    }
  }
  async createAccount(dto: CreateLedgerAccountDto, actorId: string) {
    const openingAt = this.date(dto.openingAt);
    money(dto.openingBalance);
    const account = await this.guarded(() =>
      this.accounts.create({
        code: dto.code,
        name: this.required(dto.name, "tên tài khoản"),
        openingBalance: dto.openingBalance,
        openingAt,
        evidence: this.required(dto.evidence, "chứng từ số dư đầu kỳ"),
        createdBy: this.actor(actorId),
      }),
    );
    notifyLedgerChanged(this.events);
    return account;
  }
  async listAccounts() {
    return this.accounts.find({}).sort({ code: 1 }).lean();
  }

  private async purchaseContext(id: string): Promise<OrderContext> {
    const po = await this.orders.db.collection('purchaseorders').findOne({ _id: new Types.ObjectId(this.id(id)), financialModelVersion: 2 });
    if (!po) throw new BadRequestException('Chỉ ghi sổ tự động cho PO tạo theo mô hình mới; PO cũ cần đối chiếu.');
    return { orderId: `purchase:${id}`, productId: 'inventory_purchase', supplierId: String(po.supplierId),
      quantity: 0, orderDate: new Date(po.createdAt).toISOString(), saleMode: 'retail', fulfillment: 'inventory' };
  }

  async purchaseOptions() {
    return this.orders.db.collection('purchaseorders').find({ financialModelVersion: 2 },
      { projection: { poNumber: 1, supplierNameSnap: 1, grandTotal: 1, status: 1 } }).sort({ createdAt: -1 }).limit(200).toArray();
  }

  private context(
    order: any,
    dto: Pick<CreateLedgerProfileDto, "saleMode" | "fulfillment"> & Pick<OrderContext, "returnPolicy" | "dealerReturnPolicy" | "dealerReturnTerms">,
  ): OrderContext {
    if (order.isActive === false)
      throw new BadRequestException(
        "Đơn đã ngừng hoạt động; cần rà soát trước khi lập sổ.",
      );
    const productId = String(order.productId?._id || order.productId || "");
    const category = order.productId?.categoryId;
    const productCategoryId = String(category?._id || category || "").trim() || undefined;
    if (
      !Types.ObjectId.isValid(productId) ||
      !Number.isSafeInteger(order.quantity) ||
      order.quantity <= 0 ||
      order.quantity > 1_000_000 ||
      !order.orderDate
    ) {
      throw new BadRequestException(
        "Đơn cần sản phẩm, số lượng dương và ngày đặt hàng hợp lệ.",
      );
    }
    const dealer = isDealerSale(order);
    const agentId = dealer && order.agentId ? String(order.agentId) : undefined;
    const supplierId = order.supplierId ? String(order.supplierId) : undefined;
    if (order.financialModelVersion === 2 && (dto.saleMode !== (dealer ? 'dealer' : 'retail')
      || dto.fulfillment !== (order.productSource === 'supplier' ? 'supplier_direct' : 'inventory'))) {
      throw new BadRequestException('Quan hệ bán và nguồn hàng phải khớp đơn, để thanh toán giảm đúng công nợ.');
    }
    if (dto.saleMode === "dealer" && !agentId)
      throw new BadRequestException("Đơn chưa có đại lý.");
    if (dto.fulfillment === "supplier_direct" && !supplierId)
      throw new BadRequestException("Đơn chưa có NCC.");
    return {
      orderId: String(order._id),
      productId,
      ...(productCategoryId ? { productCategoryId } : {}),
      ...(category?.name ? { productCategoryName: String(category.name) } : {}),
      ...(category?.code ? { productCategoryCode: String(category.code) } : {}),
      agentId,
      supplierId,
      adGroupId:
        String(order.adGroupId || "").trim() === "0"
          ? undefined
          : String(order.adGroupId || "").trim() || undefined,
      quantity: order.quantity,
      orderDate: new Date(order.orderDate).toISOString(),
      ...dto,
    };
  }
  async createProfile(dto: CreateLedgerProfileDto, actorId: string) {
    const order = await this.orders
      .findById(this.id(dto.orderId))
      .populate({
        path: "productId",
        select: "name ledgerReturnPolicy dealerReturnPolicy dealerReturnTerms categoryId",
        populate: { path: "categoryId", select: "name code" },
      })
      .lean();
    if (!order) throw new NotFoundException("Không tìm thấy đơn.");
    const existing = await this.profiles
      .findOne({ orderId: dto.orderId })
      .lean();
    let dealerReturnPolicy = existing?.context.dealerReturnPolicy;
    let dealerReturnTerms = existing?.context.dealerReturnTerms;
    // New dealer contracts follow the owner's confirmed end-customer rule.
    // Existing accepted profiles remain historical records and are not rewritten.
    if (!existing && dto.saleMode === 'dealer') {
      dealerReturnPolicy = 'full_sale_price';
      dealerReturnTerms = 'Đại lý là người mua cuối của công ty. Đơn hoàn phải chịu đủ giá hàng, phí giao và phí hoàn; hàng hoàn công ty chỉ giữ hộ.';
    }
    const context = this.context(order, {
      saleMode: dto.saleMode,
      fulfillment: dto.fulfillment,
      returnPolicy: dto.returnPolicy,
      ...(dealerReturnPolicy ? { dealerReturnPolicy } : {}),
      ...(dealerReturnTerms ? { dealerReturnTerms } : {}),
    });
    if (existing) {
      // Category is a reporting snapshot. Reopening an accepted profile must not
      // rewrite it when the product master is reorganized later.
      for (const key of ["productCategoryId", "productCategoryName", "productCategoryCode"] as const) {
        if (existing.context[key] === undefined) delete context[key];
        else context[key] = existing.context[key] as any;
      }
      if (JSON.stringify(existing.context) !== JSON.stringify(context))
        throw new ConflictException(
          "Đơn đã có cấu hình sổ khác. Không tự đổi lịch sử.",
        );
      return existing;
    }
    return this.guarded(() =>
      this.profiles.create({
        orderId: dto.orderId,
        context,
        productName:
          (order.productId as any)?.name || productIdLabel(context.productId),
        evidence: this.required(dto.evidence, "căn cứ xác nhận mô hình đơn"),
        createdBy: this.actor(actorId),
      }),
    );
  }
  async orderDetail(orderId: string) {
    this.id(orderId);
    const [order, profile, entries] = await Promise.all([
      this.orders.findById(orderId).populate({
        path: "productId",
        select: "name ledgerReturnPolicy dealerReturnPolicy dealerReturnTerms categoryId",
        populate: { path: "categoryId", select: "name code" },
      }).lean(),
      this.profiles.findOne({ orderId }).lean(),
      this.entries
        .find({ orderId })
        .sort({ occurredAt: 1, _id: 1 })
        .limit(1001)
        .lean(),
    ]);
    if (!order) throw new NotFoundException("Không tìm thấy đơn.");
    if (entries.length > 1000)
      throw new BadRequestException(
        "Đơn có quá nhiều bút toán; cần xuất sổ chuyên biệt.",
      );
    return {
      profile,
      entries,
      order: {
        id: String(order._id),
        financialModelVersion: order.financialModelVersion,
        productSource: order.productSource,
        recognizedRevenue: order.recognizedRevenue,
        recognizedGoodsCost: order.recognizedGoodsCost,
        supplierContractAmount: order.supplierContractAmount,
        productName: (order.productId as any)?.name,
        quantity: order.quantity,
        supplierId: order.supplierId,
        agentId: order.agentId,
        saleMode: order.saleMode,
        agentRoleSnapshot: order.agentRoleSnapshot,
        adGroupId: order.adGroupId,
        orderDate: order.orderDate,
        orderStatus: order.orderStatus,
        productionStatus: order.productionStatus,
        trackingNumber: order.trackingNumber,
        goodsOwner: order.goodsOwner,
        returnDisposition: order.returnDisposition,
        dealerContractAmount: order.dealerContractAmount,
        dealerRecoverableFees: order.dealerRecoverableFees,
      },
      revenueEligibility: {
        retail: revenueEligibility(order, "retail"),
        dealer: revenueEligibility(order, "dealer"),
      },
      suggestions: {
        supplierPrice: order.supplierQuote,
        returnPolicy: (order.productId as any)?.ledgerReturnPolicy || "unconfigured",
        dealerReturnPolicy: isDealerSale(order) ? "full_sale_price" : "unconfigured",
        dealerReturnTerms: isDealerSale(order) ? "Đơn đại lý hoàn chịu đủ giá hàng, phí giao và phí hoàn; công ty giữ hộ hàng." : "",
        dealerPrice: order.agentQuote,
        cod: order.codAmount,
        deposit: order.depositAmount,
        manualPayment: order.manualPayment,
        warning:
          "Giá và số tiền cũ chỉ để tham khảo; không phải chứng từ thực nhận.",
      },
    };
  }
  private async checkedProfile(orderId: string) {
    const profile = await this.profiles
      .findOne({ orderId: this.id(orderId) })
      .lean();
    if (!profile)
      throw new BadRequestException("Cần xác nhận cấu hình sổ cho đơn trước.");
    const order = await this.orders.findById(orderId).lean();
    if (!order) throw new NotFoundException("Không tìm thấy đơn.");
    const current = this.context(order, {
      saleMode: profile.context.saleMode,
      fulfillment: profile.context.fulfillment,
      ...(profile.context.returnPolicy ? { returnPolicy: profile.context.returnPolicy } : {}),
      ...(profile.context.dealerReturnPolicy ? { dealerReturnPolicy: profile.context.dealerReturnPolicy } : {}),
      ...(profile.context.dealerReturnTerms ? { dealerReturnTerms: profile.context.dealerReturnTerms } : {}),
    });
    if (JSON.stringify(current) !== JSON.stringify(profile.context)) {
      throw new ConflictException(
        "Sản phẩm/NCC/đại lý/số lượng/ngày/nhóm quảng cáo đã đổi. Cần rà soát ánh xạ sổ trước.",
      );
    }
    return profile;
  }
  private async checkOperationalPosting(kind: Posting["kind"], orderId: string, context: OrderContext) {
    const order = await this.orders.findById(orderId).lean();
    if (!order) throw new NotFoundException("Không tìm thấy đơn.");
    if (order.financialModelVersion === 2 && ['sale', 'direct_cost', 'inventory_cost', 'returned_stock', 'inventory_recovery', 'dealer_cost_recovery', 'opening_payable', 'opening_receivable'].includes(kind)) {
      throw new BadRequestException('Đơn mới lấy doanh thu, giá vốn và phí từ giao dịch/kho; không ghi thêm lần nữa. Sổ dùng ghi thực thu, thực chi và điều chỉnh có chứng từ.');
    }
    try { assertOperationalPosting(kind, order, context); }
    catch (error) { throw new BadRequestException(error.message); }
  }
  private async checkCashAccounts(effects: any, occurredAt: Date) {
    for (const effect of effects.cash) {
      const account = await this.accounts
        .findById(this.id(effect.accountId))
        .lean();
      if (!account)
        throw new BadRequestException("Tài khoản tiền chưa được khai báo.");
      if (+occurredAt < +new Date(account.openingAt))
        throw new BadRequestException(
          "Giao dịch trước mốc số dư đầu kỳ sẽ bị cộng trùng; không được ghi vào tài khoản này.",
        );
    }
  }
  async createEntry(dto: CreateLedgerEntryDto, actorId: string) {
    if (dto.kind === 'debt_offset') throw new BadRequestException('Đối trừ phải lập cân bằng trong bảng đối soát đối tác.');
    this.actor(actorId);
    const occurredAt = this.date(dto.occurredAt);
    const key = this.required(dto.idempotencyKey, "mã chống ghi trùng");
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify(
          Object.keys(dto)
            .sort()
            .map((k) => [k, dto[k]]),
        ),
      )
      .digest("hex");
    const existing = await this.entries.findOne({ idempotencyKey: key }).lean();
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new ConflictException(
          "Mã ghi trùng đã được dùng với nội dung khác.",
        );
      return existing;
    }
    const posting: Posting = {
      kind: dto.kind,
      amount: dto.amount,
      fromParty: dto.fromParty,
      toParty: dto.toParty,
      expenseParty: dto.expenseParty,
      otherParty: dto.otherParty,
      fromAccountId: dto.fromAccountId,
      toAccountId: dto.toAccountId,
      settlesDebt: dto.settlesDebt,
    };
    let profile = dto.orderId
      ? await this.checkedProfile(dto.orderId)
      : undefined;
    let context = profile?.context;
    let productName = profile?.productName;
    let orderId = dto.orderId;
    if (dto.purchaseOrderId) {
      if (dto.orderId || dto.kind !== 'payment') throw new BadRequestException('Thanh toán PO dùng phiếu thu/chi riêng, không ghép đơn bán.');
      context = await this.purchaseContext(dto.purchaseOrderId);
      orderId = context.orderId; productName = 'Nhập hàng vào kho';
      if (![dto.fromParty, dto.toParty].includes('supplier') || [dto.fromParty, dto.toParty].some(p => !['company', 'supplier', 'other'].includes(p))) {
        throw new BadRequestException('Thanh toán PO phải xác định NCC và bên chuyển/nhận tiền.');
      }
    }
    let effects;
    if (dto.kind === "reversal") {
      const original = await this.entries
        .findById(this.id(dto.reversalOf || ""))
        .lean();
      if (
        !original ||
        original.status !== "confirmed" ||
        original.kind === "reversal"
      )
        throw new BadRequestException("Chỉ đảo nghiệp vụ gốc đã xác nhận.");
      if (original.settlementId || original.kind === 'debt_offset') throw new BadRequestException('Đảo giao dịch tại bảng đối soát để giữ đủ các khoản phân bổ và mã chứng từ.');
      if (original.idempotencyKey.startsWith('treasury:')) throw new BadRequestException('Chứng từ vay/Quỹ Owner phải điều chỉnh cùng nghiệp vụ nguồn, không đảo riêng sổ tiền.');
      if (
        dto.amount !== original.amount ||
        (orderId && orderId !== original.orderId) ||
        +occurredAt < +new Date(original.occurredAt)
      ) {
        throw new BadRequestException(
          "Bút toán đảo phải khớp số tiền, đơn và không trước nghiệp vụ gốc.",
        );
      }
      context = original.context;
      productName = original.productName;
      orderId = original.orderId;
      effects = reverseEffects(original.effects);
    } else {
      if (dto.reversalOf)
        throw new BadRequestException(
          "Chỉ bút toán đảo được tham chiếu nghiệp vụ gốc.",
        );
      if (orderId && context && !dto.purchaseOrderId) await this.checkOperationalPosting(dto.kind, orderId, context);
      try {
        effects = calculateEffects(posting, context);
      } catch (error) {
        throw new BadRequestException(error.message);
      }
    }
    await this.checkCashAccounts(effects, occurredAt);
    return this.guarded(() =>
      this.entries.create({
        idempotencyKey: key,
        requestHash,
        kind: dto.kind,
        amount: dto.amount,
        occurredAt,
        evidence: this.required(dto.evidence, "chứng từ/căn cứ"),
        description: this.required(dto.description, "diễn giải"),
        posting,
        effects,
        orderId,
        context,
        productName,
        reversalOf: dto.reversalOf,
        status: "draft",
        createdBy: actorId,
      }),
    );
  }
  async confirmEntry(id: string, actorId: string) {
    this.actor(actorId);
    const entry = await this.entries.findById(this.id(id)).lean();
    if (!entry) throw new NotFoundException("Không tìm thấy nghiệp vụ.");
    if (entry.status === "confirmed") return entry;
    if (entry.status !== "draft")
      throw new ConflictException("Nghiệp vụ đã bị từ chối.");
    // Reversals must remain possible even after the operational order has changed.
    if (entry.orderId?.startsWith('purchase:') && entry.kind !== 'reversal') {
      const current = await this.purchaseContext(entry.orderId.slice(9));
      if (JSON.stringify(current) !== JSON.stringify(entry.context)) throw new ConflictException('PO đã đổi NCC hoặc ngày lập; cần lập lại phiếu thanh toán.');
    } else if (entry.orderId && entry.kind !== "reversal") {
      const profile = await this.checkedProfile(entry.orderId);
      await this.checkOperationalPosting(entry.kind, entry.orderId, profile.context);
    }
    await this.checkCashAccounts(entry.effects, new Date(entry.occurredAt));
    return this.guarded(async () => {
      const session = await this.entries.db.startSession();
      let updated;
      try { await session.withTransaction(async () => {
        await this.entries.db.collection('businessledgerlocks').updateOne({ _id: 'journal' as any }, { $inc: { revision: 1 } }, { upsert: true, session });
        if (entry.orderId && Types.ObjectId.isValid(entry.orderId)) {
          await this.entries.db.collection('ordertest2').updateOne({ _id: new Types.ObjectId(entry.orderId) }, { $inc: { __v: 1 } }, { session });
          if (entry.kind !== 'reversal') {
            const profile=await this.checkedProfile(entry.orderId);
            await this.checkOperationalPosting(entry.kind,entry.orderId,profile.context);
          }
        } else if(entry.orderId?.startsWith('purchase:')) {
          await this.entries.db.collection('purchaseorders').updateOne({_id:new Types.ObjectId(entry.orderId.slice(9))},{$inc:{__v:1}},{session});
          if(entry.kind!=='reversal'&&JSON.stringify(await this.purchaseContext(entry.orderId.slice(9)))!==JSON.stringify(entry.context))throw new ConflictException('PO đã thay đổi; cần lập lại phiếu thanh toán.');
        }
        updated = await this.entries
        .findOneAndUpdate(
          { _id: id, status: "draft" },
          {
            $set: {
              status: "confirmed",
              confirmedBy: actorId,
              confirmedAt: new Date(),
            },
          },
          { new: true, session },
        )
        .lean();
      if (!updated)
        throw new ConflictException(
          "Nghiệp vụ vừa được người khác xử lý; hãy tải lại.",
        );
      }); } finally { await session.endSession(); }
      notifyLedgerChanged(this.events);
      return updated;
    });
  }
  async rejectEntry(id: string, reason: string, actorId: string) {
    this.actor(actorId);
    const updated = await this.entries
      .findOneAndUpdate(
        { _id: this.id(id), status: "draft" },
        {
          $set: {
            status: "rejected",
            rejectedBy: actorId,
            rejectedAt: new Date(),
            rejectionReason: this.required(reason, "lý do"),
          },
        },
        { new: true },
      )
      .lean();
    if (!updated)
      throw new ConflictException("Chỉ từ chối nghiệp vụ đang chờ.");
    return updated;
  }
  async listPending() {
    return this.entries
      .find({ status: "draft" })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(200)
      .lean();
  }
  async report(from: string, to: string) {
    let range: { start: Date; end: Date };
    try {
      range = rangeDates(from, to);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
    const [entries, accounts, profiles, orders, ads, labor, other] = await Promise.all([
      this.entries
        .find({
          status: { $in: ["confirmed", "draft"] },
          occurredAt: { $lte: range.end },
        })
        .limit(20001)
        .lean(),
      this.accounts.find({}).lean(),
      this.profiles.find({}).limit(10001).lean(),
      this.orders
        .find({
          orderDate: { $lte: range.end },
          isActive: { $ne: false },
        })
        .select('_id productId productCategoryIdSnapshot productCategoryNameSnapshot productCategoryCodeSnapshot agentId saleMode agentRoleSnapshot supplierId adGroupId quantity orderDate orderStatus productionStatus financialModelVersion isActive shipments receivedReturnQuantity costAllocatedAt dealerProfitState retailProfitState recognizedRevenue recognizedGoodsCost grossProfit netProfit advertisingCost laborCostAllocation otherCostAllocation supplierContractAmount dealerContractAmount')
        .populate({ path: "productId", select: "name color categoryId", populate: { path: "categoryId", select: "name code" } })
        .limit(10001)
        .lean(),
      this.orders.db
        .collection("advertisingcosts")
        .find(
          {
            $or: [
              { date: { $gte: range.start, $lte: range.end } },
              { date: { $gte: from, $lte: to } },
            ],
          },
          {
            projection: {
              adGroupId: 1,
              spentAmount: 1,
              isEstimated: 1,
              currency: 1,
              date: 1,
              channel: 1,
              customerId: 1,
            },
          },
        )
        .limit(20001)
        .toArray(),
      this.orders.db.collection('laborcost1').find({ date: { $gte: range.start, $lte: range.end } },
        { projection: { date: 1, cost: 1 } }).limit(20001).toArray(),
      this.orders.db.collection('othercosts').find({ date: { $gte: range.start, $lte: range.end } },
        { projection: { date: 1, amount: 1 } }).limit(20001).toArray(),
    ]);
    const purchases = await this.orders.db.collection('purchaseorders').find({ financialModelVersion: 2,
      receivedDate: { $lte: range.end }, 'items.quantityReceived': { $gt: 0 } }).limit(10001).toArray();
    if (purchases.length > 10000) throw new BadRequestException('Vượt giới hạn số PO trong báo cáo; cần tổng hợp phía máy chủ.');
    for (const po of purchases) {
      entries.push({ _id: `purchase-obligation:${po._id}`, orderId: `purchase:${po._id}`, kind: 'opening_payable',
        status: 'confirmed', occurredAt: po.receivedDate, effects: { revenue: 0, cogs: 0, expense: 0, cash: [],
          debts: [{ partyKey: `supplier:${po.supplierId}`, amount: -receivedPurchaseValue(po) }] } } as any);
    }
    if (
      entries.length > 20000 ||
      accounts.length > 1000 ||
      profiles.length > 10000 ||
      orders.length > 10000 ||
      ads.length > 20000 || labor.length > 20000 || other.length > 20000
    ) {
      throw new BadRequestException(
        "Vượt giới hạn báo cáo giai đoạn đầu; cần tổng hợp sổ phía máy chủ, không dùng số liệu cắt bớt.",
      );
    }
    let report: ReturnType<typeof buildLedgerReport>;
    try {
      report = buildLedgerReport({
        entries,
        accounts,
        profiles,
        orders,
        ads,
        overhead: { labor, other },
        from,
        to,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
    const userIds = new Set<string>();
    for (const d of report.debts) {
      const [type, id] = d.partyKey.split(":");
      if (["agent", "supplier"].includes(type) && Types.ObjectId.isValid(id))
        userIds.add(id);
    }
    for (const a of report.agents)
      if (Types.ObjectId.isValid(a.key)) userIds.add(a.key);
    const [users, groups] = await Promise.all([
      this.orders.db
        .collection("users")
        .find(
          { _id: { $in: [...userIds].map((id) => new Types.ObjectId(id)) } },
          { projection: { fullName: 1 } },
        )
        .toArray(),
      this.orders.db
        .collection("adgroups")
        .find(
          { adGroupId: { $in: report.adGroups.map((g) => g.key) } },
          { projection: { adGroupId: 1, name: 1 } },
        )
        .toArray(),
    ]);
    const names = new Map(users.map((u) => [String(u._id), u.fullName]));
    for (const a of report.agents)
      a.name =
        names.get(a.key) ||
        (a.key === "retail"
          ? "Bán lẻ / không gắn đại lý"
          : a.key === "unallocated"
            ? "Chưa phân bổ"
            : a.key);
    for (const g of report.adGroups)
      g.name =
        groups.find((x) => x.adGroupId === g.key)?.name ||
        (g.key === "unallocated" ? "Chưa gắn nhóm quảng cáo" : g.key);
    for (const d of report.debts) {
      const [type, id] = d.partyKey.split(":");
      (d as any).name =
        names.get(id) ||
        (type === "customer"
          ? `Khách của đơn ${id}`
          : type === "other"
            ? id
            : d.partyKey);
    }
    return report;
  }
}
function productIdLabel(id: string) {
  return `Sản phẩm ${id}`;
}
