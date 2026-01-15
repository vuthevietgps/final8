import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Summary4, Summary4Document } from './schemas/summary4.schema';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { Quote, QuoteDocument } from '../quote/schemas/quote.schema';
import { computeSummary4Derived } from './summary4-calculator';
import { InventorySummary, InventorySummaryDocument } from '../inventory/schemas/inventory-summary.schema';
import { Summary4GoogleSyncService } from './summary4-google-sync.service';
import { Summary5Service } from '../summary5/summary5.service';

export interface SyncResult {
  processed: number;
  updated: number;
  created: number;
  errors: string[];
}

export interface SyncOneResult {
  created: boolean;
  updated: boolean;
  agentId?: Types.ObjectId;
}

@Injectable()
export class Summary4SyncService {
  private readonly logger = new Logger(Summary4SyncService.name);
  private readonly debugEnabled = process.env.DEBUG_SUMMARY4 === 'true';

  constructor(
    @InjectModel(Summary4.name) private summary4Model: Model<Summary4Document>,
    @InjectModel(TestOrder2.name) private testOrder2Model: Model<TestOrder2Document>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(InventorySummary.name) private inventorySummaryModel: Model<InventorySummaryDocument>,
    private readonly summary4GoogleSyncService: Summary4GoogleSyncService,
    private readonly summary5Service: Summary5Service,
  ) {}

  async syncFromTestOrder2(): Promise<SyncResult> {
    this.logger.log('🔄 Bắt đầu đồng bộ dữ liệu từ TestOrder2...');
    
    const result: SyncResult = { 
      processed: 0, 
      updated: 0, 
      created: 0,
      errors: [] 
    };

    try {
      const agentsTouched = new Set<string>();
      // Get all active TestOrder2 records with populated references
      const testOrder2Records = await this.testOrder2Model
        .find({ isActive: true })
        .populate('agentId', 'fullName role') // Thêm role để tính doanh thu đúng
        .populate('productId', 'name importPrice shippingCost packagingCost suppliers') // Thêm giá vốn + NCC
        .sort({ createdAt: -1 })
        .exec();

      if (this.debugEnabled) {
        this.logger.log(`📋 Tìm thấy ${testOrder2Records.length} bản ghi TestOrder2`);
      }

      for (const order of testOrder2Records) {
        result.processed++;
        
        try {
          const { agentId } = await this.processTestOrderRecord(order, result);
          if (agentId) agentsTouched.add(String(agentId));
        } catch (error) {
          const errorMsg = `Lỗi xử lý TestOrder2 ${order._id}: ${error.message}`;
          this.logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      this.logger.log(`✅ Đồng bộ hoàn thành: ${result.processed} processed, ${result.created} created, ${result.updated} updated`);

      // Schedule Google Sheets sync per agent (debounced inside service)
      if (agentsTouched.size > 0) {
        for (const agentId of agentsTouched) {
          this.summary4GoogleSyncService.scheduleSyncAgent(agentId, 2000);
        }
        this.logger.log(`📤 Đã lên lịch đồng bộ Google Sheets cho ${agentsTouched.size} đại lý`);
      }

      // Tự động đồng bộ Summary5 sau khi Summary4 đã được cập nhật
      this.logger.log('🔄 Bắt đầu đồng bộ Summary5 từ Summary4...');
      try {
        await this.summary5Service.sync();
        this.logger.log('✅ Đồng bộ Summary5 hoàn thành');
      } catch (error) {
        this.logger.error(`❌ Lỗi đồng bộ Summary5: ${error.message}`);
        result.errors.push(`Summary5 sync error: ${error.message}`);
      }
      
    } catch (error) {
      const errorMsg = `Lỗi đồng bộ Summary4: ${error.message}`;
      this.logger.error(errorMsg);
      result.errors.push(errorMsg);
    }

    return result;
  }

  async syncOneOrder(orderId: string): Promise<SyncOneResult> {
    const order = await this.testOrder2Model
      .findById(orderId)
      .populate('agentId', 'fullName role') // Thêm role
      .populate('productId', 'name importPrice shippingCost packagingCost suppliers') // Thêm giá vốn + NCC
      .exec();
    if (!order) return { created: false, updated: false };

    const tmp: SyncResult = { processed: 0, updated: 0, created: 0, errors: [] };
    const res = await this.processTestOrderRecord(order, tmp);

    // Schedule sheets sync for that agent
    if (res.agentId) {
      this.summary4GoogleSyncService.scheduleSyncAgent(String(res.agentId), 1000);
    }

    // Tự động đồng bộ Summary5 sau khi cập nhật một đơn hàng
    try {
      await this.summary5Service.sync();
      this.logger.log('✅ Đồng bộ Summary5 hoàn thành (syncOneOrder)');
    } catch (error) {
      this.logger.error(`❌ Lỗi đồng bộ Summary5 (syncOneOrder): ${error.message}`);
    }

    return { created: tmp.created > 0, updated: tmp.updated > 0, agentId: res.agentId };
  }

  private async processTestOrderRecord(order: TestOrder2Document, result: SyncResult): Promise<{ agentId?: Types.ObjectId }> {
    const orderId = order._id;
    
    // Check if Summary4 record already exists
    const existingSummary = await this.summary4Model.findOne({ 
      testOrder2Id: orderId 
    }).exec();

    // Extract IDs safely
    const agentName = (order.agentId as any)?.fullName || 'Unknown Agent';
    const agentRole = (order.agentId as any)?.role || ''; // Lấy role của agent
    const productName = (order.productId as any)?.name || 'Unknown Product';
    const agentIdObjectId = (order.agentId as any)?._id || order.agentId;
    const productIdObjectId = (order.productId as any)?._id || order.productId;

    if (!agentIdObjectId || !productIdObjectId) {
      throw new Error(`Missing agentId or productId for order ${orderId}`);
    }

    // Find approved quote for this agent + product combination
    const approvedQuote = await this.findApprovedQuote(agentIdObjectId, productIdObjectId);

    // Get product data for cost calculation
    const productData = (order.productId as any);
    const importPrice = productData?.importPrice || 0;
    const shippingCost = productData?.shippingCost || 0;
    const packagingCost = productData?.packagingCost || 0;

    // Determine unit cost + source
    const productSuppliers: any[] = Array.isArray(productData?.suppliers) ? productData.suppliers : [];
    const orderSupplierId = (order as any)?.supplierId;
    const orderSource = (order as any)?.productSource;
    const orderPriceLevel = Number((order as any)?.supplierPriceLevel || 0) || 0;
    const orderAppliedPrice = Number((order as any)?.supplierAppliedPrice || 0) || 0;

    let unitCost = importPrice + shippingCost + packagingCost;
    let costSource: 'product' | 'supplier' | 'inventory' | 'missing' = 'product';
    let supplierIdUsed: any = undefined;

    const pickSupplierPrice = () => {
      if (orderSource !== 'supplier' || !orderSupplierId) return 0;
      const found = productSuppliers.find((s: any) => String(s.supplierId) === String(orderSupplierId));
      if (!found) return 0;
      supplierIdUsed = orderSupplierId;
      const level = orderAppliedPrice > 0 ? -1 : (orderPriceLevel || found?.appliedLevel || 1);
      // If orderAppliedPrice > 0, use it directly
      if (orderAppliedPrice > 0) return orderAppliedPrice;
      const lvl = level || 1;
      const levelPrice = lvl === 1 ? found?.price1 : lvl === 2 ? found?.price2 : found?.price3;
      return levelPrice || found?.appliedPrice || 0;
    };

    const supplierCost = pickSupplierPrice();
    if (supplierCost > 0) {
      unitCost = supplierCost;
      costSource = 'supplier';
    } else if (orderSource === 'inventory') {
      // Try inventory WAC (avgCost) first
      const inv = await this.inventorySummaryModel.findOne({ productId: productIdObjectId }).lean();
      if (inv && inv.avgCost && inv.avgCost > 0) {
        unitCost = inv.avgCost;
        costSource = 'inventory';
      } else {
        costSource = 'inventory'; // mark inventory even if fallback to product cost
      }
    }

    if (unitCost <= 0) {
      unitCost = 0;
      costSource = 'missing';
    }

    const productCostOverride = unitCost > 0 && costSource === 'supplier' ? unitCost : undefined;

    if (this.debugEnabled) {
      this.logger.debug(`📊 Processing order ${orderId}: agent=${agentName} (${agentRole}), product=${productName}, quote=${approvedQuote ? 'found' : 'not found'}, cost=${importPrice + shippingCost + packagingCost}`);
    }

    // Calculate financial fields using business logic
    const calculation = computeSummary4Derived(
      {
        productionStatus: order.productionStatus,
        orderStatus: order.orderStatus, 
        codAmount: order.codAmount,
        depositAmount: order.depositAmount,
        quantity: order.quantity,
        manualPayment: order.manualPayment,
      },
      { 
        unitPrice: approvedQuote?.unitPrice 
      },
      {
        importPrice,
        shippingCost,
        packagingCost,
        productCostOverride,
      },
      { 
        manualPaymentAmount: existingSummary?.manualPaymentAmount 
      }
    );

    // Prepare Summary4 data
    const productCostTotal = unitCost * (order.quantity || 0);
    const summaryData = {
      testOrder2Id: orderId,
      agentId: agentIdObjectId,
      productId: productIdObjectId,
      supplierId: supplierIdUsed,
      orderDate: order.createdAt,
      customerName: order.customerName,
      quantity: order.quantity,
      trackingNumber: order.trackingNumber,
      productionStatus: order.productionStatus,
      orderStatus: order.orderStatus,
      codAmount: order.codAmount,
      depositAmount: order.depositAmount,
      // Ghi nhận adGroupId để báo cáo doanh thu/chi phí theo nhóm QC
      adGroupId: order.adGroupId,
      approvedQuotePrice: calculation.approvedQuotePrice,
      productCost: unitCost,
      productCostTotal,
      costSource,
      mustPayAmount: calculation.mustPayAmount,
      paidToCompanyAmount: calculation.paidToCompanyAmount,
      manualPaymentAmount: calculation.manualPaymentAmount,
      needToPayAmount: calculation.needToPayAmount,
      isActive: true,
    };

    if (existingSummary) {
      // Update existing record
      await this.summary4Model.findByIdAndUpdate(
        existingSummary._id, 
        summaryData, 
        { new: true }
      ).exec();
      result.updated++;
      
      if (this.debugEnabled) {
        this.logger.debug(`📝 Updated Summary4 for order ${orderId}`);
      }
    } else {
      // Create new record
      await this.summary4Model.create(summaryData);
      result.created++;
      
      if (this.debugEnabled) {
        this.logger.debug(`➕ Created Summary4 for order ${orderId}`);
      }
    }

    return { agentId: agentIdObjectId as Types.ObjectId };
  }

  async softDeleteByOrderId(orderId: string): Promise<{ matched: number; modified: number; agentId?: string }> {
    const existing = await this.summary4Model.findOne({ testOrder2Id: new Types.ObjectId(orderId) }).lean();
    if (!existing) return { matched: 0, modified: 0 };
    const res = await this.summary4Model.updateOne({ _id: existing._id }, { $set: { isActive: false } }).exec();
    if (existing.agentId) {
      this.summary4GoogleSyncService.scheduleSyncAgent(String(existing.agentId), 1000);
    }

    // Tự động đồng bộ Summary5 sau khi xóa mềm
    try {
      await this.summary5Service.sync();
      this.logger.log('✅ Đồng bộ Summary5 hoàn thành (softDeleteByOrderId)');
    } catch (error) {
      this.logger.error(`❌ Lỗi đồng bộ Summary5 (softDeleteByOrderId): ${error.message}`);
    }

    return { matched: res.matchedCount || 0, modified: res.modifiedCount || 0, agentId: existing.agentId ? String(existing.agentId) : undefined };
  }

  private async findApprovedQuote(agentId: Types.ObjectId, productId: Types.ObjectId): Promise<QuoteDocument | null> {
    const agentIdString = agentId.toString();
    const productIdString = productId.toString();

    if (this.debugEnabled) {
      this.logger.debug(`🔍 Looking for quote: agentId=${agentIdString}, productId=${productIdString}, status='Đã duyệt'`);
    }

    return this.quoteModel.findOne({
      $and: [
        { 
          $or: [
            { agentId: agentIdString }, 
            { agentId: new Types.ObjectId(agentIdString) }
          ] 
        },
        { 
          $or: [
            { productId: productIdString }, 
            { productId: new Types.ObjectId(productIdString) }
          ] 
        },
        { status: 'Đã duyệt' },
        { isActive: true },
      ],
    }).exec();
  }
}