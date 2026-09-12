import { FINANCIAL_INPUT_CHANGED } from '../advertising-cost/advertising-cost-refresh.module';
import { businessDay } from '../common/business-day';
import { BadRequestException, Injectable, Logger, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TestOrder2, TestOrder2Document } from './schemas/test-order2.schema';
import { CreateTestOrder2Dto } from './dto/create-test-order2.dto';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { SupplierPayableService } from '../supplier-payable/supplier-payable.service';
import { OrderSheetSyncService } from '../order-sheet-sync/order-sheet-sync.service';
import { OrderCalculationService } from './services/order-calculation.service';
import { OrderPaymentService } from './services/order-payment.service';
import { OrderReportService } from './services/order-report.service';
import {
  ProductionStatus,
  OrderStatus,
  PaymentStatus,
  AgentRole,
  DEFAULT_VALUES,
  SUPPLIER_PAYABLE_AUTO_NOTE,
} from './constants/test-order2.constants';
import { FinanceEvents } from '../finance/events/finance-events.constants';
import { InventoryService } from '../inventory/inventory.service';
import { profitAssessment } from './profit-assessment';
import {
  businessConfirmationAudit,
  BusinessConfirmationSource,
  stripBusinessConfirmationAuditFields,
} from './business-confirmation.util';
import { AdsAttributionOptionsService } from './services/ads-attribution-options.service';

/** Fields that suppliers are allowed to update on their own orders */
const SUPPLIER_EDITABLE_FIELDS = new Set([
  'serviceDetails', 'productionStatus', 'orderStatus',
  'submitLink', 'trackingNumber', 'depositAmount',
  'codAmount', 'receiverName', 'receiverPhone', 'receiverAddress',
]);

const SUPPLIER_ROLES = new Set(['internal_supplier', 'external_supplier']);
const AGENT_ROLES = new Set(['internal_agent', 'external_agent']);

@Injectable()
export class TestOrder2Service {
  private readonly logger = new Logger(TestOrder2Service.name);
  private readonly profitImpactFields = new Set([
    'retailSaleAmount', 'productSource', 'inventoryBatchId',
    'depositAmount', 'manualPayment', 'supplierPaidAmount', 'agentPaidAmount',
    'supplierPaymentStatus', 'agentPaymentStatus', 'dealerShippingCharges', 'dealerReturnCharges',
    'adsProvider', 'adAccountProviderId', 'adCampaignId',
    'productId',
    'quantity',
    'agentId',
    'adGroupId',
    'isActive',
    'orderStatus',
    'productionStatus',
    'trackingNumber',
    'dealerShippingIncludedInPrice',
    'orderDate',
    'supplierId',
    'supplierAppliedPrice',
    'supplierQuote',
    'agentAppliedPrice',
    'agentQuote',
    'shippingFee',
    'returnFee',
    'codAmount',
    'grossProfit',
    'advertisingCost',
    'laborCostAllocation',
    'otherCostAllocation',
    'netProfit',
  ]);

  // Cache cho Agent Roles (tránh N+1 query khi update hàng loạt)

  private agentRoleCache = new Map<string, string>();

  constructor(
    @InjectModel(TestOrder2.name) private model: Model<TestOrder2Document>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private readonly calculationService: OrderCalculationService,
    private readonly paymentService: OrderPaymentService,
    private readonly reportService: OrderReportService,
    private readonly supplierPayableService: SupplierPayableService,
    private readonly orderSheetSyncService: OrderSheetSyncService,
    private readonly eventEmitter: EventEmitter2,
    private readonly adsAttributionOptions: AdsAttributionOptionsService,
    private readonly inventory?: InventoryService,
  ) {}

  private normalizeUsageDurationMonths(value: unknown): number | undefined {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return undefined;
    const rounded = Math.floor(normalized);
    return rounded > 0 ? rounded : undefined;
  }

  private normalizeAdGroupId(value: unknown): string | undefined {
    const normalized = String(value ?? '').trim();
    return normalized && normalized !== '0' ? normalized : undefined;
  }

  private assertAcquisitionAttribution(source: unknown, adGroupId: unknown): 'ads' | 'non_ads' {
    if (source !== 'ads' && source !== 'non_ads') {
      throw new BadRequestException('Phải chọn nguồn khách hàng: quảng cáo hoặc không từ quảng cáo.');
    }
    const normalizedAdGroupId = this.normalizeAdGroupId(adGroupId);
    if (source === 'ads' && !normalizedAdGroupId) {
      throw new BadRequestException('Đơn từ quảng cáo bắt buộc phải gắn ID nhóm quảng cáo.');
    }
    if (source === 'non_ads' && normalizedAdGroupId) {
      throw new BadRequestException('Đơn không từ quảng cáo không được gắn ID nhóm quảng cáo.');
    }
    return source;
  }

  private foldOrderStatus(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[\uFFFD?]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  private canonicalizeOrderStatus(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const raw = value.trim();
    if (!raw) return raw;

    const folded = this.foldOrderStatus(raw);
    if (!folded) return raw;

    if (/^chuacoma?vandon$/.test(folded) || /^chuacovandon$/.test(folded) || /^chuacmvdn$/.test(folded)) {
      return 'Ch\u01b0a c\u00f3 m\u00e3 v\u1eadn \u0111\u01a1n';
    }
    if (/^danggiao$/.test(folded)) {
      return '\u0110ang giao';
    }
    if (/^cholay$/.test(folded) || /^chlay$/.test(folded)) {
      return 'Ch\u1edd l\u1ea5y';
    }
    if (/^giaothanhcong$/.test(folded) || /^giaothnhcng$/.test(folded)) {
      return 'Giao th\u00e0nh c\u00f4ng';
    }
    if (
      /^hanghoan$/.test(folded) ||
      /^hoanhang$/.test(folded) ||
      /^hnghon$/.test(folded) ||
      /^honhng$/.test(folded)
    ) {
      return 'H\u00e0ng ho\u00e0n';
    }
    if (/^dadoisoat$/.test(folded) || /^dadsoat$/.test(folded) || /^doisoat$/.test(folded)) {
      return '\u0110\u00e3 \u0111\u1ed1i so\u00e1t';
    }
    if (/^hoanthanh$/.test(folded) || /^honthnh$/.test(folded)) {
      return 'Ho\u00e0n th\u00e0nh';
    }

    return raw;
  }

  private getCurrentUserId(currentUser?: any): string | undefined {
    const rawId = currentUser?.id ?? currentUser?._id ?? currentUser?.userId ?? currentUser?.sub;
    if (!rawId) return undefined;
    return rawId instanceof Types.ObjectId ? rawId.toString() : String(rawId);
  }

  private hasProfitImpactChange(payload: Partial<TestOrder2>): boolean {
    return Object.keys(payload || {}).some((key) => this.profitImpactFields.has(key));
  }

  private emitOrderProfitImpactEvent(order: Partial<TestOrder2> & { _id?: any }): void {
    this.eventEmitter.emit(FinanceEvents.ORDER_COMPLETED, {
      orderId: order._id ? String(order._id) : 'unknown',
      orderDate: order.orderDate,
      adGroupId: order.adGroupId,
      supplierId: order.supplierId ? String(order.supplierId) : undefined,
      agentId: order.agentId ? String(order.agentId) : undefined,
      codAmount: order.codAmount,
    });
  }

  private emitOrderProfitImpactEventForDate(orderId: string, orderDate?: Date | string): void {
    this.eventEmitter.emit(FinanceEvents.ORDER_COMPLETED, {
      orderId,
      orderDate,
    });
  }

  private async getProductUsageDurationMonths(productId?: Types.ObjectId | string): Promise<number | undefined> {
    if (!productId) return undefined;
    const id = typeof productId === 'string' ? productId : productId.toString();
    if (!Types.ObjectId.isValid(id)) return undefined;

    const product = await this.productModel
      .findById(id)
      .select('usageDurationMonths')
      .lean<{ usageDurationMonths?: number }>()
      .exec();

    return this.normalizeUsageDurationMonths(product?.usageDurationMonths);
  }

  private getOrderDateKey(value?: Date | string | null): string | undefined {
    if (!value) return undefined;
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return businessDay(date);
  }

  private async refreshOrderAllocationsForDates(
    values: Array<Date | string | null | undefined>,
  ): Promise<void> {
    const uniqueDates = Array.from(
      new Set(
        values
          .map((value) => this.getOrderDateKey(value))
          .filter((value): value is string => !!value),
      ),
    );

    if (this.eventEmitter?.emitAsync) {
      await this.eventEmitter.emitAsync(FINANCIAL_INPUT_CHANGED, { dates: uniqueDates, revalue: false });
    } else {
      for (const dateKey of uniqueDates) await this.calculationService.recalculateOrdersForDate(dateKey);
    }
  }

  private async reloadOrderById(id: Types.ObjectId | string): Promise<TestOrder2Document | null> {
    return this.model.findById(id);
  }

  // ============ ORDER LIFECYCLE HOOKS ============

  /**
   * Create supplier payable when order production status becomes DONE
   */
  private async createSupplierPayableIfEligible(order: TestOrder2Document, _previous: string | undefined | null) {
    // Legacy SupplierPayable means remittance of COD margin. New purchase debts
    // are projected from supplierContractAmount in the business ledger instead.
    if (order.financialModelVersion === 2) return;
    if (order.productionStatus !== ProductionStatus.DONE || order.productSource === 'inventory'
        || order.productSource === 'dealer_custody' || !order.supplierId || !order.supplierQuoteId) return;
    const quantity = Number(order.quantity || 1);
    const price = Number(order.supplierAppliedPrice ?? 0);
    const returned = await this.calculationService.isReturnStatus(order.orderStatus);
    await this.supplierPayableService.upsertForOrder({
      orderId: String(order._id), supplierId: String(order.supplierId),
      items: [{ productId: order.productId ? String(order.productId) : undefined, quantity, unitPrice: price, amount: price * quantity }],
      totalAmount: price * quantity + Number(order.supplierFreightObligation
        ?? (order.trackingNumber ? Number(order.shippingFee || 0) + (returned ? Number(order.returnFee || 0) : 0) : 0)),
      currency: 'VND', notes: 'Nghĩa vụ mua hàng và phí NCC; không phải tiền NCC đã thu hộ.',
    });
  }

  /**
   * Ensure COD collected amount is filled when order is delivered
   */
  private ensureCodCollectedIfDelivered(_doc: TestOrder2Document, _previous: string | undefined | null) {
    // Delivery is not evidence of collection by any party.
  }

  /**
   * Auto-trigger payment status when orderStatus changes to completed states
   */
  private async handleOrderStatusChange(doc: TestOrder2Document, _previous: string | undefined | null) {
    await this.calculationService.applyCompletedStatusFinancials(doc);
  }

  async create(dto: CreateTestOrder2Dto, currentUser?: any, trackingLeadId?: string) {
    if (currentUser && SUPPLIER_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Nhà cung cấp không được phép tạo đơn hàng');
    }

    if (currentUser && AGENT_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Agent users can only view their own orders');
    }

    if (trackingLeadId) {
      const existing = await this.model.findOne({ trackingLeadId: new Types.ObjectId(trackingLeadId) });
      if (existing) return existing;
    }

    const customerAcquisitionSource = this.assertAcquisitionAttribution(dto.customerAcquisitionSource, dto.adGroupId);
    const attribution = await this.adsAttributionOptions.resolve({
      adGroupId: dto.adGroupId,
      adsProvider: dto.adsProvider,
      adAccountProviderId: dto.adAccountProviderId,
      adCampaignId: dto.adCampaignId,
    });
    const doc: Partial<TestOrder2> = {
      ...(trackingLeadId ? { trackingLeadId: new Types.ObjectId(trackingLeadId) } : {}),
      financialModelVersion: 2,
      productSource: dto.productSource || 'supplier',
      inventoryBatchId: dto.inventoryBatchId ? new Types.ObjectId(dto.inventoryBatchId) : undefined,
      retailSaleAmount: dto.retailSaleAmount,
      productId: dto.productId ? new Types.ObjectId(dto.productId) : undefined,
      productUsageDurationMonths: this.normalizeUsageDurationMonths(dto.productUsageDurationMonths),
      customerName: dto.customerName,
      quantity: dto.quantity ?? 1,
      agentId: dto.agentId ? new Types.ObjectId(dto.agentId) : undefined,
      customerAcquisitionSource,
      ...attribution,
      isActive: dto.isActive ?? true,
      productionStatus: dto.productionStatus ?? 'Chưa làm',
      orderStatus: dto.orderStatus ?? 'Chưa có mã vận đơn',
      serviceDetails: dto.serviceDetails,
      submitLink: dto.submitLink,
      trackingNumber: dto.trackingNumber,
      depositAmount: dto.depositAmount ?? 0,
      codAmount: dto.codAmount ?? 0,
      manualPayment: dto.manualPayment ?? 0,
      shippingFee: dto.shippingFee,
      returnFee: dto.returnFee,
      codCollectedBySupplier: dto.codCollectedBySupplier ?? 0,
      receiverName: dto.receiverName,
      receiverPhone: dto.receiverPhone,
      receiverAddress: dto.receiverAddress,
      orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
      supplierId: dto.supplierId ? new Types.ObjectId(dto.supplierId) : undefined,
      supplierPriceLevel: dto.supplierPriceLevel,
    };

    if (typeof doc.orderStatus === 'string') {
      doc.orderStatus = this.canonicalizeOrderStatus(doc.orderStatus) ?? doc.orderStatus;
    }

    if (!doc.productUsageDurationMonths && doc.productId) {
      doc.productUsageDurationMonths = await this.getProductUsageDurationMonths(doc.productId);
    }

    const created = new this.model(doc);
    if (created.trackingNumber) {
      throw new BadRequestException('Lưu đơn và chọn lô trước; xuất kho bằng chức năng lần giao.');
    }
    let saved: TestOrder2Document;
    try {
      await this.inventory?.prepareOrderSource(created);
      await this.calculationService.autoCalculateQuoteFields(created);
      this.ensureCodCollectedIfDelivered(created as any, null);
      await this.handleOrderStatusChange(created as any, null);
      saved = await created.save();
    }
    catch (error) { await this.inventory?.releaseOrderReservation(created.inventoryBatchId, String(created._id)); throw error; }
    await this.createSupplierPayableIfEligible(saved, null);
    await this.refreshOrderAllocationsForDates([saved.orderDate]);

    const hydrated = await this.reloadOrderById(saved._id);
    const persistedOrder = hydrated || saved;

    this.emitOrderProfitImpactEvent(persistedOrder);

    this.orderSheetSyncService.triggerSyncOnOrderChange(persistedOrder).catch(err => {
      this.logger.error('Failed to trigger sheet sync after create', err);
    });

    return persistedOrder;
  }

  /**
   * Product list dedicated for Order Test2 screen.
   * Uses orders-test2 permission scope (not products module permission),
   * so restricted employee accounts can still resolve product names/options.
   */
  async listProductsForOrderModule() {
    const products = await this.productModel
      .find({}, { name: 1, color: 1, status: 1, suppliers: 1 })
      .sort({ name: 1 })
      .lean()
      .exec();

    return products.map((product: any) => ({
      _id: String(product._id),
      name: product.name,
      color: product.color || '#3B82F6',
      status: product.status,
      suppliers: Array.isArray(product.suppliers)
        ? product.suppliers.map((supplier: any) => ({
            ...supplier,
            supplierId: supplier?.supplierId ? String(supplier.supplierId) : undefined,
          }))
        : [],
    }));
  }

  async findById(id: string, currentUser?: any) {
    const doc = await this.model.findById(id).lean();
    if (doc && currentUser && AGENT_ROLES.has(currentUser.role)) {
      const currentUserId = this.getCurrentUserId(currentUser);
      if (!currentUserId || doc.agentId?.toString() !== currentUserId) {
        throw new ForbiddenException('You can only view your own orders');
      }
    }
    if (doc && currentUser && SUPPLIER_ROLES.has(currentUser.role)) {
      const currentUserId = this.getCurrentUserId(currentUser);
      if (!currentUserId || doc.supplierId?.toString() !== currentUserId) {
        throw new ForbiddenException('Bạn chỉ được phép xem đơn hàng của mình');
      }
    }
    return doc ? { ...doc, profitAssessment: profitAssessment(doc) } : null;
  }

  async update(id: string, payload: Partial<TestOrder2>, currentUser?: any, expectedVersion?: number) {
    // Defense in depth: DTO validation rejects these fields at the HTTP boundary,
    // and the service also removes them so internal callers cannot spoof provenance.
    payload = stripBusinessConfirmationAuditFields(payload as any) as Partial<TestOrder2>;
    const doc = await this.model.findById(id);
    if (!doc) return null;
    if (expectedVersion !== undefined && doc.__v !== expectedVersion) {
      throw new ConflictException('Đơn vừa thay đổi. Hãy tải lại và đối chiếu trước khi cập nhật.');
    }

    // --- Supplier access control ---
    if (currentUser && SUPPLIER_ROLES.has(currentUser.role)) {
      const currentUserId = this.getCurrentUserId(currentUser);
      if (!currentUserId || doc.supplierId?.toString() !== currentUserId) {
        throw new ForbiddenException('Bạn chỉ được phép chỉnh sửa đơn hàng của mình');
      }
      const filtered: any = {};
      for (const key of Object.keys(payload)) {
        if (SUPPLIER_EDITABLE_FIELDS.has(key)) {
          filtered[key] = (payload as any)[key];
        }
      }
      payload = filtered;
      if (Object.keys(payload).length === 0) return doc;
    }
    if (currentUser && AGENT_ROLES.has(currentUser.role)) {
      const currentUserId = this.getCurrentUserId(currentUser);
      if (!currentUserId || doc.agentId?.toString() !== currentUserId) {
        throw new ForbiddenException('You can only view your own orders');
      }
      throw new ForbiddenException('Agent users are not allowed to edit orders');
    }

    const prevProductionStatus = doc.productionStatus;
    const prevOrderStatus = doc.orderStatus;
    const prevSupplierId = doc.supplierId?.toString();
    const prevProductId = doc.productId?.toString();
    const prevAgentId = doc.agentId?.toString();

    const updates: any = { ...payload };
    // Prices/provenance are resolved by the server, never copied from a table UI.
    for (const key of [
      'supplierQuoteId', 'supplierAppliedPrice', 'supplierQuote', 'supplierQuoteSnapshotAt',
      'supplierQuoteEffectiveAt', 'supplierPriceSource', 'supplierShippingFeeSnapshot',
      'supplierReturnFeeSnapshot', 'supplierIsReturnableSnapshot', 'packagingCostSnapshot',
      'agentQuoteId', 'agentAppliedPrice', 'agentQuote', 'agentQuoteSnapshotAt',
      'agentQuoteEffectiveAt', 'agentPaymentDueDate', 'costAllocatedAt', 'costAllocationDate',
      'dealerSaleRecognizedAt', 'dealerReturnedAt', 'dealerProfitState', 'goodsOwner', 'returnDisposition',
      'recognizedRevenue', 'recognizedGoodsCost', 'dealerRecoverableFees',
      'dealerReturnFeeReceivable', 'dealerContractAmount', 'supplierContractAmount', 'retailProfitState',
      'dealerShippingIncludedInPrice',
      'saleMode', 'agentRoleSnapshot',
      'shipments', 'financialModelVersion', 'deliveredQuantity', 'receivedReturnQuantity',
      'dealerShippingCharges', 'dealerReturnCharges', 'supplierFreightObligation', 'originalOrderId',
      'recoveredInventoryValue', 'inventoryUnitCostSnapshot', 'resalePolicySnapshot',
      'dealerShippingFeeSnapshot', 'dealerReturnFeeSnapshot',
      'productType', 'productCategoryIdSnapshot', 'productCategoryNameSnapshot',
      'productCategoryCodeSnapshot',
    ]) delete updates[key];
    if (doc.shipments?.length && ['trackingNumber', 'orderStatus', 'shippingFee', 'returnFee', 'productSource', 'inventoryBatchId']
      .some(key => key in updates && String(updates[key] ?? '') !== String((doc as any)[key] ?? ''))) {
      throw new BadRequestException('Cập nhật giao nhận và phí trong từng lần giao, không ghi đè lịch sử trên dòng đơn.');
    }
    if (doc.retailSaleAmount != null && Number(doc.recognizedRevenue || 0) > 0 && 'retailSaleAmount' in updates
        && updates.retailSaleAmount !== doc.retailSaleAmount) {
      throw new BadRequestException('Giá bán đã ghi nhận; cần chứng từ điều chỉnh thay vì sửa giá gốc.');
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'adGroupId')) {
      updates.adGroupId = this.normalizeAdGroupId(updates.adGroupId);
    }
    const attributionIdentityFields = ['adGroupId', 'adsProvider', 'adAccountProviderId', 'adCampaignId'];
    const attributionIdentityChanged = attributionIdentityFields.some((key) => Object.prototype.hasOwnProperty.call(updates, key));
    if (attributionIdentityChanged || Object.prototype.hasOwnProperty.call(updates, 'customerAcquisitionSource')) {
      const resultingAdGroupId = Object.prototype.hasOwnProperty.call(updates, 'adGroupId') ? updates.adGroupId : doc.adGroupId;
      const resultingSource = updates.customerAcquisitionSource
        ?? doc.customerAcquisitionSource
        ?? (this.normalizeAdGroupId(resultingAdGroupId) ? 'ads' : 'non_ads');
      updates.customerAcquisitionSource = this.assertAcquisitionAttribution(resultingSource, resultingAdGroupId);
    }
    if (attributionIdentityChanged) {
      const explicitComposite = ['adsProvider', 'adAccountProviderId', 'adCampaignId']
        .some((key) => Object.prototype.hasOwnProperty.call(updates, key));
      Object.assign(updates, await this.adsAttributionOptions.resolve({
        adGroupId: Object.prototype.hasOwnProperty.call(updates, 'adGroupId') ? updates.adGroupId : doc.adGroupId,
        adsProvider: explicitComposite ? updates.adsProvider : undefined,
        adAccountProviderId: explicitComposite ? updates.adAccountProviderId : undefined,
        adCampaignId: explicitComposite ? updates.adCampaignId : undefined,
      }));
    }
    if (doc.dealerSaleRecognizedAt || doc.shipments?.length || doc.orderStatus === OrderStatus.DELIVERED || (doc.productSource !== 'supplier' && doc.trackingNumber)) {
      for (const key of ['agentId', 'productId', 'supplierId', 'quantity', 'productSource', 'inventoryBatchId', 'productionStatus', 'isActive']) {
        if (key in updates && String(updates[key] ?? '') !== String((doc as any)[key] ?? '')) {
          throw new BadRequestException('Đơn đã xuất cho đại lý; không đổi người mua, sản phẩm, NCC hoặc số lượng của giao dịch đã chốt.');
        }
      }
    }
    if (typeof updates.productId === 'string') updates.productId = new Types.ObjectId(updates.productId);
    if (typeof updates.agentId === 'string') updates.agentId = updates.agentId ? new Types.ObjectId(updates.agentId) : undefined;
    if (typeof updates.supplierId === 'string') updates.supplierId = new Types.ObjectId(updates.supplierId);
    if (typeof updates.orderDate === 'string') updates.orderDate = new Date(updates.orderDate);
    if (typeof updates.isActive === 'string') updates.isActive = updates.isActive === 'true' || updates.isActive === '1';
    if (updates.productUsageDurationMonths !== undefined) {
      updates.productUsageDurationMonths = this.normalizeUsageDurationMonths(updates.productUsageDurationMonths);
    }
    ['quantity', 'retailSaleAmount', 'depositAmount', 'codAmount', 'manualPayment', 'shippingFee', 'returnFee'].forEach((k) => {
      const key = k as keyof TestOrder2;
      const v: any = (updates as any)[key];
      if (typeof v === 'string') (updates as any)[key] = parseFloat(v) || 0;
    });

    if (typeof (updates as any).codCollectedBySupplier === 'string') {
      (updates as any).codCollectedBySupplier = parseFloat((updates as any).codCollectedBySupplier) || 0;
    }
    if (typeof updates.orderStatus === 'string') {
      updates.orderStatus = this.canonicalizeOrderStatus(updates.orderStatus) ?? updates.orderStatus;
    }

    // ============ SUPPLIER QUOTE SNAPSHOT IMMUTABILITY ============
    const newSupplierId = updates.supplierId?.toString();
    const newProductId = updates.productId?.toString();
    const supplierChanged = 'supplierId' in updates && (newSupplierId || '') !== (prevSupplierId || '');
    const productChanged = !!newProductId && newProductId !== prevProductId;

    if (supplierChanged || productChanged || ('productSource' in updates && updates.productSource !== doc.productSource)) {
      updates.supplierQuoteId = undefined;
      updates.supplierAppliedPrice = undefined;
      updates.supplierQuoteSnapshotAt = undefined;
      updates.supplierShippingFeeSnapshot = undefined;
      updates.supplierReturnFeeSnapshot = undefined;
      updates.supplierQuote = undefined;
      updates.supplierQuoteEffectiveAt = undefined;
      updates.supplierPriceSource = undefined;
      updates.supplierIsReturnableSnapshot = undefined;
      updates.packagingCostSnapshot = undefined;
      if (productChanged) {
        updates.productType = undefined;
        updates.productCategoryIdSnapshot = undefined;
        updates.productCategoryNameSnapshot = undefined;
        updates.productCategoryCodeSnapshot = undefined;
      }
      updates.shippingFee = payload.shippingFee;
      updates.returnFee = payload.returnFee;

      this.logger.log(`Supplier/Product changed for order ${id} - clearing supplier quote snapshot. Old: ${prevSupplierId}/${prevProductId}, New: ${newSupplierId}/${newProductId}`);
    }

    if (productChanged || (updates.productId && updates.productUsageDurationMonths === undefined)) {
      const resolvedUsageDuration = await this.getProductUsageDurationMonths(updates.productId);
      if (resolvedUsageDuration) {
        updates.productUsageDurationMonths = resolvedUsageDuration;
      }
    }

    // ============ AGENT QUOTE SNAPSHOT IMMUTABILITY ============
    const newAgentId = updates.agentId?.toString();
    const agentChanged = 'agentId' in updates && (newAgentId || '') !== (prevAgentId || '');

    if (agentChanged || productChanged) {
      updates.dealerShippingFeeSnapshot = undefined;
      updates.dealerReturnFeeSnapshot = undefined;
      updates.agentQuoteId = undefined;
      updates.agentAppliedPrice = undefined;
      updates.agentQuoteSnapshotAt = undefined;
      updates.agentPaymentDueDate = undefined;
      updates.agentQuote = undefined;
      updates.agentQuoteEffectiveAt = undefined;
      if (agentChanged) {
        updates.saleMode = undefined;
        updates.agentRoleSnapshot = undefined;
      }

      this.logger.log(`Agent/Product changed for order ${id} - clearing agent quote snapshot. Old: ${prevAgentId}/${prevProductId}, New: ${newAgentId}/${newProductId}`);
    }

    // ============ ORDERDATE CHANGE DETECTION ============
    const prevOrderDate = this.getOrderDateKey(doc.orderDate);
    const newOrderDate = this.getOrderDateKey(updates.orderDate);

    if (newOrderDate && prevOrderDate && newOrderDate !== prevOrderDate) {
      if (doc.supplierQuoteId || doc.agentQuoteId) {
        this.logger.warn(
          `Order ${id} orderDate changed from ${prevOrderDate} to ${newOrderDate} ` +
          `but quote snapshots are preserved (supplierQuoteId: ${doc.supplierQuoteId}, agentQuoteId: ${doc.agentQuoteId}). ` +
          `To recalculate quotes, change supplier/product/agent.`
        );
      }
    }

    if (agentChanged && !updates.agentId) {
      for (const key of ['dealerProfitState', 'goodsOwner', 'returnDisposition', 'recognizedRevenue',
        'recognizedGoodsCost', 'dealerRecoverableFees', 'dealerReturnFeeReceivable', 'dealerContractAmount']) {
        updates[key] = undefined;
      }
    }
    const stockSourceChanged = ['inventoryBatchId', 'productSource', 'quantity', 'productId', 'agentId']
      .some(key => key in updates && String(updates[key] ?? '') !== String((doc as any)[key] ?? ''));
    if (!doc.shipments?.length && (doc.financialModelVersion === 2 || (updates.productSource || doc.productSource) !== 'supplier')
      && (updates.trackingNumber || doc.trackingNumber)) {
      throw new BadRequestException('Xuất hàng đang có bằng chức năng lần giao để ghi nhận kho và nơi gửi.');
    }
    if ('productSource' in updates && !['supplier', 'inventory', 'dealer_custody'].includes(updates.productSource)) {
      throw new BadRequestException('Nguồn hàng không hợp lệ.');
    }
    const previousStock = doc.toObject();
    if (stockSourceChanged) await this.inventory?.releaseOrderReservation(doc.inventoryBatchId, String(doc._id));
    Object.assign(doc, updates);
    let saved: TestOrder2Document;
    try {
      if (!doc.shipments?.length) await this.inventory?.prepareOrderSource(doc);
      await this.calculationService.autoCalculateQuoteFields(doc);
      this.ensureCodCollectedIfDelivered(doc as any, prevOrderStatus);
      await this.handleOrderStatusChange(doc, prevOrderStatus);
      saved = await doc.save();
    } catch (error) {
      if (stockSourceChanged) {
        await this.inventory?.releaseOrderReservation(doc.inventoryBatchId, String(doc._id));
        // Best-effort restoration after a failed edit; reservations cannot exceed available stock.
        try { await this.inventory?.prepareOrderSource(previousStock); }
        catch { this.logger.warn(`Cần giữ lại lô cho đơn ${doc._id} sau thay đổi thất bại.`); }
      }
      throw error;
    }
    await this.createSupplierPayableIfEligible(saved as any, prevProductionStatus);

    const shouldRefreshAllocations =
      this.hasProfitImpactChange(updates) || prevOrderStatus !== saved.orderStatus;

    if (shouldRefreshAllocations) {
      await this.refreshOrderAllocationsForDates([prevOrderDate, saved.orderDate]);
    }

    const persistedOrder =
      shouldRefreshAllocations
        ? (await this.reloadOrderById(saved._id)) || saved
        : saved;

    if (shouldRefreshAllocations) {
      if (newOrderDate && prevOrderDate && newOrderDate !== prevOrderDate) {
        this.emitOrderProfitImpactEventForDate(String(persistedOrder._id), prevOrderDate);
      }
      this.emitOrderProfitImpactEvent(persistedOrder);
    }

    this.orderSheetSyncService.triggerSyncOnOrderChange(persistedOrder).catch(err => {
      this.logger.error('Failed to trigger sheet sync after update', err);
    });

    return persistedOrder;
  }

  /**
   * Atomically transition an order from unconfirmed to business-confirmed.
   * A retry never rewrites the original server timestamp, actor or source.
   */
  async confirmBusiness(
    id: string,
    currentUser: any,
    source: BusinessConfirmationSource = 'erp_manual_confirmation',
  ): Promise<TestOrder2Document> {
    if (!Types.ObjectId.isValid(String(id || ''))) {
      throw new BadRequestException('Order id is invalid');
    }

    const confirmation = businessConfirmationAudit(currentUser, source, new Date());
    const objectId = new Types.ObjectId(id);
    const confirmed = await this.model.findOneAndUpdate(
      {
        _id: objectId,
        $or: [
          { businessConfirmedAt: { $exists: false } },
          { businessConfirmedAt: null },
        ],
      },
      { $set: confirmation },
      { new: true },
    );
    if (confirmed) return confirmed;

    // Either the order does not exist or another request already committed the
    // transition. Reading it back makes retries idempotent without overwriting.
    const existing = await this.model.findById(objectId);
    if (!existing) throw new NotFoundException('Order not found');
    return existing;
  }

  async remove(id: string, currentUser?: any) {
    if (currentUser && SUPPLIER_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Nhà cung cấp không được phép xóa đơn hàng');
    }

    if (currentUser && AGENT_ROLES.has(currentUser.role)) {
      throw new ForbiddenException('Agent users are not allowed to delete orders');
    }

    const order = await this.model.findById(id);

    if (order?.dealerSaleRecognizedAt || order?.shipments?.length || order?.productionStatus === ProductionStatus.DONE) {
      throw new BadRequestException('Đơn đã xuất cho đại lý; giữ hồ sơ sở hữu hàng và nghĩa vụ thanh toán.');
    }
    await this.inventory?.releaseOrderReservation(order?.inventoryBatchId, String(order?._id));
    await this.model.findByIdAndDelete(id);

    if (order?.orderDate) {
      await this.refreshOrderAllocationsForDates([order.orderDate]);
    }

    if (order) {
      this.emitOrderProfitImpactEvent(order);
    } else {
      this.eventEmitter.emit(FinanceEvents.ORDER_COMPLETED, { orderId: id });
    }

    return { message: 'Deleted' };
  }

  async seed(count = 10) {
    const docs: Partial<TestOrder2>[] = [];
    for (let i = 0; i < count; i++) {
      docs.push({
        financialModelVersion: 2,
        saleMode: 'retail',
        customerName: `Khách hàng #${i + 1}`,
        quantity: 1 + (i % 3),
        adGroupId: i % 2 === 0 ? undefined : `ADG_${1000 + i}`,
        isActive: true,
        productionStatus: 'Chưa làm',
        orderStatus: 'Chưa có mã vận đơn',
        depositAmount: 0,
        codAmount: 0,
        manualPayment: 0,
        orderDate: new Date(),
      });
    }
    const res = await this.model.insertMany(docs);
    return { inserted: res.length };
  }

  async findAll(params: {
    currentUser?: any;
    q?: string;
    productId?: string;
    agentId?: string;
    supplierId?: string;
    adGroupId?: string;
    isActive?: string;
    from?: string;
    to?: string;
    productionStatus?: string;
    orderStatus?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(params.limit) || 50));

    const query: FilterQuery<TestOrder2Document> = {};

    const isSupplierUser = !!params.currentUser && SUPPLIER_ROLES.has(params.currentUser.role);
    const isAgentUser = !!params.currentUser && AGENT_ROLES.has(params.currentUser.role);

    if (params.currentUser) {
      const userRole = params.currentUser.role;
      const userId = this.getCurrentUserId(params.currentUser);

      if (userRole === 'internal_supplier' || userRole === 'external_supplier') {
        if (!userId || !Types.ObjectId.isValid(userId)) {
          throw new ForbiddenException('Không xác định được tài khoản nhà cung cấp');
        }
        query.supplierId = new Types.ObjectId(userId);
        this.logger.log(`Supplier ${userId} filtering orders by supplierId`);
      }
      if (userRole === 'internal_agent' || userRole === 'external_agent') {
        if (!userId || !Types.ObjectId.isValid(userId)) {
          throw new ForbiddenException('Khong xac dinh duoc tai khoan dai ly');
        }
        query.agentId = new Types.ObjectId(userId);
        this.logger.log(`Agent ${userId} filtering orders by agentId`);
      }
    }

    if (params.q) {
      const regex = new RegExp(params.q, 'i');
      Object.assign(query, {
        $or: [
          { customerName: regex },
          { receiverPhone: regex },
          { trackingNumber: regex },
        ],
      });
    }
    if (params.productId) query.productId = new Types.ObjectId(params.productId);
    if (params.agentId && !isAgentUser) query.agentId = new Types.ObjectId(params.agentId);
    if (params.supplierId && !isSupplierUser) query.supplierId = new Types.ObjectId(params.supplierId);
    if (params.adGroupId) query.adGroupId = params.adGroupId;
    if (params.isActive !== undefined) {
      if (params.isActive === 'true' || params.isActive === '1') query.isActive = true;
      if (params.isActive === 'false' || params.isActive === '0') query.isActive = false;
    }
    if (params.productionStatus) query.productionStatus = params.productionStatus;
    if (params.orderStatus) query.orderStatus = params.orderStatus;

    if (params.from || params.to) {
      const fromDate = params.from ? new Date(params.from) : undefined;
      const toDate = params.to ? new Date(params.to) : undefined;

      const dateConditions: any[] = [];

      const orderDateCond: any = { orderDate: { $exists: true, $ne: null } };
      if (fromDate) orderDateCond.orderDate.$gte = fromDate;
      if (toDate) orderDateCond.orderDate.$lte = toDate;
      dateConditions.push(orderDateCond);

      const createdAtCond: any = {
        $or: [
          { orderDate: { $exists: false } },
          { orderDate: null }
        ]
      };
      if (fromDate || toDate) {
        const createdRange: any = {};
        if (fromDate) createdRange.$gte = fromDate;
        if (toDate) createdRange.$lte = toDate;
        createdAtCond.createdAt = createdRange;
      }
      dateConditions.push(createdAtCond);

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: dateConditions }];
        delete query.$or;
      } else {
        query.$or = dateConditions;
      }
    }

    const sort: Record<string, 1 | -1> = {};
    if (params.sortBy) sort[params.sortBy] = params.sortOrder === 'asc' ? 1 : -1;
    else sort['createdAt'] = -1;

    const [total, items] = await Promise.all([
      this.model.countDocuments(query),
      this.model
        .find(query)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return {
      data: items.map(item => ({ ...item.toObject(), profitAssessment: profitAssessment(item) })),
      pagination: {
        page,
        limit,
        total,
        totalPages: total ? Math.ceil(total / limit) : 0,
      },
    };
  }

  // ============ RECALCULATION (delegates to calculationService) ============

  /**
   * Recalculate cost allocations for all orders on a specific date
   * Used by external services (advertising cost sync)
   */
  async recalculateOrdersForDate(orderDate: Date | string) {
    return this.calculationService.recalculateOrdersForDate(orderDate);
  }

  /**
   * Recalculate quotes for an order - force refresh based on current orderDate
   */
  async recalculateQuotes(orderId: string) {
    const order = await this.model.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const prevSupplierQuoteId = order.supplierQuoteId?.toString();
    const prevAgentQuoteId = order.agentQuoteId;

    // Re-running calculation must preserve existing commercial snapshots.
    // A different product/supplier/dealer is handled by the explicit update path.
    await this.calculationService.autoCalculateQuoteFields(order);
    await order.save();
    await this.refreshOrderAllocationsForDates([order.orderDate]);
    this.emitOrderProfitImpactEvent(order);

    this.logger.log(
      `Recalculated quotes for order ${orderId}: ` +
      `SupplierQuote ${prevSupplierQuoteId} -> ${order.supplierQuoteId} (${order.supplierAppliedPrice}), ` +
      `AgentQuote ${prevAgentQuoteId} -> ${order.agentQuoteId} (${order.agentAppliedPrice})`
    );

    return {
      _id: order._id,
      orderDate: order.orderDate,
      supplierQuoteId: order.supplierQuoteId,
      supplierAppliedPrice: order.supplierAppliedPrice,
      supplierQuoteSnapshotAt: order.supplierQuoteSnapshotAt,
      agentQuoteId: order.agentQuoteId,
      agentAppliedPrice: order.agentAppliedPrice,
      agentQuoteSnapshotAt: order.agentQuoteSnapshotAt,
      agentPaymentDueDate: order.agentPaymentDueDate,
      message: 'Quote snapshots preserved; missing snapshots resolved for the order date'
    };
  }

  /**
   * Recalculate profits for a single order
   */
  async recalculateProfits(orderId: string) {
    const order = await this.model.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    order.grossProfit = await this.calculationService.calculateGrossProfit(order);
    await order.save();
    await this.refreshOrderAllocationsForDates([order.orderDate]);

    const persistedOrder = (await this.reloadOrderById(orderId)) || order;

    this.logger.log(
      `Recalculated profits for order ${orderId}: grossProfit=${persistedOrder.grossProfit}, netProfit=${persistedOrder.netProfit}`,
    );

    return persistedOrder;
  }

  /**
   * Recalculate profits for all orders (batch operation)
   */
  async recalculateAllProfits(filters?: { from?: string; to?: string; supplierId?: string; agentId?: string }) {
    const query: FilterQuery<TestOrder2Document> = {};

    if (filters?.from || filters?.to) {
      query.orderDate = {} as any;
      if (filters.from) (query.orderDate as any).$gte = new Date(filters.from);
      if (filters.to) (query.orderDate as any).$lte = new Date(filters.to);
    }
    if (filters?.supplierId) query.supplierId = new Types.ObjectId(filters.supplierId);
    if (filters?.agentId) query.agentId = new Types.ObjectId(filters.agentId);

    const orders = await this.model.find(query);
    const touchedDates = new Set<string>();

    let updated = 0;
    for (const order of orders) {
      order.grossProfit = await this.calculationService.calculateGrossProfit(order);
      await order.save();
      const dateKey = this.getOrderDateKey(order.orderDate);
      if (dateKey) {
        touchedDates.add(dateKey);
      }
      updated++;
    }

    await this.refreshOrderAllocationsForDates(Array.from(touchedDates));

    this.logger.log(`Recalculated profits for ${updated} orders across ${touchedDates.size} dates`);

    return { updated, recalculatedDates: touchedDates.size };
  }

  // ============ PAYMENT DELEGATION ============

  async createSupplierPaymentBatch(dto: any) {
    const result = await this.paymentService.createSupplierPaymentBatch(dto);
    this.eventEmitter.emit(FinanceEvents.ORDER_PAYMENT_UPDATED, {
      orderId: 'batch',
      paymentType: 'supplier',
      oldStatus: 'pending',
      newStatus: 'paid',
    });
    return result;
  }

  async createAgentPaymentBatch(dto: any) {
    const result = await this.paymentService.createAgentPaymentBatch(dto);
    this.eventEmitter.emit(FinanceEvents.ORDER_PAYMENT_UPDATED, {
      orderId: 'batch',
      paymentType: 'agent',
      oldStatus: 'pending',
      newStatus: 'paid',
    });
    return result;
  }

  async createAgentPaymentBatchAtomic(dto: any) {
    const result = await this.paymentService.createAgentPaymentBatchAtomic(dto);
    this.eventEmitter.emit(FinanceEvents.ORDER_PAYMENT_UPDATED, {
      orderId: 'batch',
      paymentType: 'agent',
      oldStatus: 'pending',
      newStatus: 'paid',
    });
    return result;
  }

  async getOrdersPendingSupplierPayment(filters?: any) {
    return this.paymentService.getOrdersPendingSupplierPayment(filters);
  }

  async getOrdersPendingAgentPayment(filters?: any) {
    return this.paymentService.getOrdersPendingAgentPayment(filters);
  }

  async getSupplierPaymentBatches(filters?: any) {
    return this.paymentService.getSupplierPaymentBatches(filters);
  }

  async getAgentPaymentBatches(filters?: any) {
    return this.paymentService.getAgentPaymentBatches(filters);
  }

  async getOrdersInBatch(batchId: string, type: 'supplier' | 'agent') {
    return this.paymentService.getOrdersInBatch(batchId, type);
  }

  async getSupplierPaymentOpsSummary(filters?: any) {
    return this.paymentService.getSupplierPaymentOpsSummary(filters);
  }

  async getAgentPaymentOpsSummary(filters?: any) {
    return this.paymentService.getAgentPaymentOpsSummary(filters);
  }

  async syncSupplierPaymentFromStatement(params: any) {
    return this.paymentService.syncSupplierPaymentFromStatement(params);
  }

  async syncAgentPaymentFromStatement(params: any) {
    return this.paymentService.syncAgentPaymentFromStatement(params);
  }

  generateStatementBatchId(type: 'supplier' | 'agent', statementId: string): string {
    return this.paymentService.generateStatementBatchId(type, statementId);
  }

  // ============ REPORT DELEGATION ============

  async getDailyProfitReport(date?: string) {
    return this.reportService.getDailyProfitReport(date);
  }

  async getProductProfitReport(params: { date?: string; from?: string; to?: string }) {
    return this.reportService.getProductProfitReport(params);
  }
}
