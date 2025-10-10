/**
 * Summary4 Service - Báo cáo tổng hợp với tính toán chi phí và lợi nhuận
 * Features: Sync từ TestOrder2, cleanup orphaned records, export Excel
 */
import { Injectable, NotFoundException, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as XLSX from 'xlsx';

import { Summary4, Summary4Document } from './schemas/summary4.schema';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { Quote, QuoteDocument } from '../quote/schemas/quote.schema';
import { User, UserDocument } from '../user/user.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { Summary5Service } from '../summary5/summary5.service';
import { Summary4FilterDto } from './dto/summary4-filter.dto';
import { UpdateManualPaymentDto } from './dto/update-manual-payment.dto';
import { Summary4GoogleSyncService } from './summary4-google-sync.service';

@Injectable()
export class Summary4Service implements OnModuleInit {
  private readonly logger = new Logger(Summary4Service.name);
  private readonly debugEnabled = process.env.DEBUG_SUMMARY4 === 'true';

  constructor(
    @InjectModel(Summary4.name) private readonly summary4Model: Model<Summary4Document>,
    @InjectModel(TestOrder2.name) private readonly testOrder2Model: Model<TestOrder2Document>,
    @InjectModel(Quote.name) private readonly quoteModel: Model<QuoteDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly summary5Service: Summary5Service,
    @Inject(forwardRef(() => Summary4GoogleSyncService))
    private readonly summary4GoogleSyncService: Summary4GoogleSyncService,
  ) {}

  onModuleInit() {
    this.logger.log('Summary4Service initialized with Google Sync Service');
  }

  /**
   * Trigger Google Sheets sync for affected agents
   */
  private triggerGoogleSync(agentIds: string[]): void {
    if (!this.summary4GoogleSyncService) {
      this.logger.warn('Google Sync Service not available');
      return;
    }

    // Trigger sync for each unique agent with delay
    const uniqueAgentIds = [...new Set(agentIds.filter(id => id && id !== 'undefined' && id !== 'null'))];
    
    uniqueAgentIds.forEach((agentId, index) => {
      // Stagger the sync calls to avoid overwhelming
      const delay = 1000 + (index * 500);
      this.summary4GoogleSyncService.scheduleSyncAgent(agentId, delay);
      this.logger.log(`🔄 Scheduled Google Sync for agent ${agentId} (delay: ${delay}ms)`);
    });
  }

  async findAll(filter: Summary4FilterDto = {}) {
    // Sanitize and validate input parameters
    const page = Math.max(1, Math.floor(filter.page || 1));
    const limit = Math.max(1, Math.min(200, Math.floor(filter.limit || 50)));
    const sortBy = filter.sortBy || 'orderDate';
    const sortOrder = filter.sortOrder === 'asc' ? 'asc' : 'desc';

    const sortOption = { [sortBy]: sortOrder === 'asc' ? 1 : -1 } as any;
    const skip = (page - 1) * limit;

    // Build dynamic query based on filters
    const baseQuery: any = { isActive: true };

    // Filter theo đại lý
    if (filter.agentId) {
      baseQuery.agentId = new Types.ObjectId(filter.agentId);
    }
    if (filter.agentName) {
      baseQuery.agentName = { $regex: filter.agentName, $options: 'i' };
    }

    // Filter theo thời gian
    if (filter.startDate || filter.endDate) {
      baseQuery.orderDate = {};
      if (filter.startDate) {
        baseQuery.orderDate.$gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        const endDate = new Date(filter.endDate);
        endDate.setHours(23, 59, 59, 999); // Include whole end day
        baseQuery.orderDate.$lte = endDate;
      }
    }

    // Filter theo trạng thái
    if (filter.productionStatus) {
      baseQuery.productionStatus = filter.productionStatus;
    }
    if (filter.orderStatus) {
      baseQuery.orderStatus = filter.orderStatus;
    }

    // Filter theo sản phẩm
    if (filter.productId) {
      baseQuery.productId = new Types.ObjectId(filter.productId);
    }
    if (filter.productName) {
      baseQuery.product = { $regex: filter.productName, $options: 'i' };
    }

    // Filter theo khách hàng
    if (filter.customerName) {
      baseQuery.customerName = { $regex: filter.customerName, $options: 'i' };
    }

    // Filter theo thanh toán
    if (filter.paymentStatus && filter.paymentStatus !== 'all') {
      switch (filter.paymentStatus) {
        case 'unpaid':
          baseQuery.needToPay = { $gt: 0 };
          break;
        case 'paid':
          baseQuery.needToPay = { $lte: 0 };
          break;
        case 'manual':
          baseQuery.manualPayment = { $gt: 0 };
          break;
      }
    }

    // Filter theo Ad Group
    if (filter.adGroupId) {
      baseQuery.adGroupId = filter.adGroupId;
    }

    if (this.debugEnabled) {
      this.logger.debug('Summary4 query:', JSON.stringify(baseQuery, null, 2));
    }

    // Get total count first
    const total = await this.summary4Model.countDocuments(baseQuery).exec();
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // If requested page > total pages, redirect to last valid page
    const validPage = Math.min(page, totalPages);
    const validSkip = (validPage - 1) * limit;

    const data = total > 0 ? await this.summary4Model
      .find(baseQuery)
      .sort(sortOption)
      .skip(validSkip)
      .limit(limit)
      .populate('agentId', 'fullName email role')
      .populate('productId', 'name sku price')
      .exec() : [];

    return { 
      data, 
      total, 
      page: validPage, // Return the valid page we actually used
      totalPages,
      requestedPage: page, // Also return what was originally requested for debugging
      ...(page !== validPage && { redirectedToPage: validPage }) // Indicate if we redirected
    };
  }

  async findOne(id: string): Promise<Summary4> {
    const summary = await this.summary4Model
      .findById(id)
      .populate('agentId', 'fullName email role')
      .populate('productId', 'name sku price')
      .exec();
    
    if (!summary) {
      throw new NotFoundException(`Summary4 với ID ${id} không tìm thấy`);
    }
    return summary;
  }

  async updateManualPayment(id: string, updateDto: UpdateManualPaymentDto): Promise<Summary4> {
    const summary = await this.findOne(id);
    
    if (updateDto.manualPayment !== undefined) {
      summary.manualPayment = updateDto.manualPayment;
      summary.needToPay = summary.paidToCompany - summary.mustPayToCompany - summary.manualPayment;
    }

    await this.summary4Model.updateOne({ _id: id }, summary);

    // Trigger Summary5 sync for the specific day range of this order
    try {
      const d = new Date(summary.orderDate);
      const startDate = new Date(d); startDate.setHours(0,0,0,0);
      const endDate = new Date(d); endDate.setHours(23,59,59,999);
      await this.summary5Service.sync({ startDate: startDate.toISOString(), endDate: endDate.toISOString() });
    } catch (e) {
      this.logger.warn(`Summary5 sync failed after manualPayment update: ${e?.message || e}`);
    }

    // Trigger Google Sheets sync for this agent after manual payment update
    if (summary.agentId) {
      const agentIdString = summary.agentId.toString();
      this.logger.log(`🔄 Triggering Google Sync for agent ${agentIdString} after manual payment update`);
      this.triggerGoogleSync([agentIdString]);
    }

    return summary;
  }

  // Chẩn đoán trùng lặp dữ liệu theo testOrder2Id
  async diagnostics() {
    const dupAgg = await this.summary4Model.aggregate([
      { $addFields: { testOrder2IdStr: { $toString: '$testOrder2Id' } } },
      { $group: { _id: '$testOrder2IdStr', count: { $sum: 1 }, ids: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } }
    ]).exec();

    const indexInfo = await (this.summary4Model as any).collection?.indexInformation()?.catch?.(() => null);

    const total = await this.summary4Model.countDocuments({}).exec();
    const totalActive = await this.summary4Model.countDocuments({ isActive: true }).exec();

    return {
      counts: { total, totalActive },
      duplicates: dupAgg,
      indexes: indexInfo,
      note: 'Nếu có duplicates, hãy gọi POST /summary4/fix-duplicates để dọn.'
    };
  }

  // Xử lý trùng lặp: giữ lại 1 bản ghi tốt nhất cho mỗi testOrder2Id
  async fixDuplicates() {
    const dups = await this.summary4Model.aggregate([
      { $addFields: { testOrder2IdStr: { $toString: '$testOrder2Id' } } },
      { $group: { _id: '$testOrder2IdStr', docs: { $push: '$$ROOT' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).exec();

    let removed = 0;
    for (const group of dups) {
      const docs = group.docs as any[];
      // Ưu tiên dòng có approvedQuotePrice > 0, nếu không có thì chọn updatedAt mới nhất
      const preferred = docs
        .slice()
        .sort((a, b) => {
          if ((b.approvedQuotePrice || 0) !== (a.approvedQuotePrice || 0)) {
            return (b.approvedQuotePrice || 0) - (a.approvedQuotePrice || 0);
          }
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        })[0];

      for (const doc of docs) {
        if (String(doc._id) !== String(preferred._id)) {
          await this.summary4Model.deleteOne({ _id: doc._id }).exec();
          removed++;
        }
      }

      // Chuẩn hoá field testOrder2Id về ObjectId nếu bị string
      if (preferred && typeof preferred.testOrder2Id === 'string') {
        await this.summary4Model.updateOne(
          { _id: preferred._id },
          { $set: { testOrder2Id: new Types.ObjectId(preferred.testOrder2Id) } }
        ).exec();
      }
    }

    // Đảm bảo unique index
    try {
      await (this.summary4Model as any).collection.createIndex({ testOrder2Id: 1 }, { unique: true });
    } catch (e) {
      // ignore if exists
    }

    return { groupsProcessed: dups.length, removed };
  }

  async syncFromTestOrder2(): Promise<{ processed: number; updated: number; errors: string[] }> {
    this.logger.log('Bắt đầu đồng bộ dữ liệu từ TestOrder2...');
    const result = { processed: 0, updated: 0, errors: [] };

    try {
      const testOrder2Records = await this.testOrder2Model
        .find({ isActive: true })
        .populate('agentId', 'fullName')
        .populate('productId', 'name')
        .sort({ createdAt: -1 })
        .exec();

  if (this.debugEnabled) this.logger.log(`Tìm thấy ${testOrder2Records.length} bản ghi TestOrder2`);

      for (const order of testOrder2Records) {
        result.processed++;
        
        try {
          // Tìm record hiện có theo cả 2 dạng (ObjectId hoặc string) để tránh bị lệch kiểu dữ liệu từ các lần sync cũ
          const existingSummary = await this.summary4Model.findOne({
            $or: [
              { testOrder2Id: order._id },
              { testOrder2Id: order._id.toString() as any }
            ]
          }).exec();

          const agentName = (order.agentId as any)?.fullName || 'Unknown Agent';
          const productName = (order.productId as any)?.name || 'Unknown Product';

          // Extract proper ObjectId from populated fields
          const agentIdObjectId = (order.agentId as any)?._id || order.agentId;
          const productIdObjectId = (order.productId as any)?._id || order.productId;
          const agentIdString = agentIdObjectId?.toString();
          const productIdString = productIdObjectId?.toString();
          
          if (this.debugEnabled) this.logger.debug(`Looking for quote: agentId=${agentIdString}, productId=${productIdString}, status='Đã duyệt'`);
          
          // Query with both ObjectId and string support to handle database inconsistency
          const approvedQuote = await this.quoteModel.findOne({
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
              { isActive: true }
            ]
          }).exec();
          
          if (this.debugEnabled) this.logger.debug(`Found quote price: ${approvedQuote?.unitPrice || 0}`);

          const approvedQuotePrice = approvedQuote?.unitPrice || 0;

          // Logic tính toán theo yêu cầu
          const mustPayToCompany = order.productionStatus === 'Đã trả kết quả' 
            ? approvedQuotePrice * order.quantity 
            : 0;

          const paidToCompany = order.orderStatus === 'Giao thành công' 
            ? order.codAmount 
            : 0;

          // Manual payment priority logic:
          // 1. Use TestOrder2.manualPayment if exists (user updated via TestOrder2)  
          // 2. Fallback to existing Summary4.manualPayment (user updated via Summary4 directly)
          // 3. Default to 0
          const manualPayment = order.manualPayment || existingSummary?.manualPayment || 0;
          
          // Calculate what needs to be paid: COD received - amount due to company - manual payments
          const needToPay = paidToCompany - mustPayToCompany - manualPayment;

          const summaryData = {
            testOrder2Id: order._id,
            orderDate: order.createdAt,
            customerName: order.customerName,
            product: productName,
            quantity: order.quantity,
            agentName: agentName,
            adGroupId: order.adGroupId || '0',
            isActive: order.isActive,
            serviceDetails: order.serviceDetails,
            productionStatus: order.productionStatus,
            orderStatus: order.orderStatus,
            submitLink: order.submitLink,
            trackingNumber: order.trackingNumber,
            depositAmount: order.depositAmount || 0,
            codAmount: order.codAmount || 0,
            agentId: agentIdObjectId, // Use proper ObjectId
            productId: productIdObjectId, // Use proper ObjectId
            approvedQuotePrice,
            mustPayToCompany,
            paidToCompany,
            manualPayment,
            needToPay
          };

          // Upsert theo testOrder2Id, đồng thời xử lý cả dữ liệu cũ dùng string
          // Loại bỏ testOrder2Id khỏi $set để tránh xung đột đường dẫn
          const { testOrder2Id, ...setData } = summaryData as any;

          await this.summary4Model.updateOne(
            {
              $or: [
                { testOrder2Id: order._id },
                { testOrder2Id: order._id.toString() as any }
              ]
            },
            {
              $set: setData,
              // Đảm bảo sau update, testOrder2Id chuẩn là ObjectId
              $setOnInsert: { testOrder2Id: order._id }
            },
            { upsert: true }
          ).exec();

          result.updated++;

        } catch (error) {
          result.errors.push(`TestOrder2 ${order._id}: ${error.message}`);
        }
      }

      if (this.debugEnabled) this.logger.log(`Hoàn thành đồng bộ: ${result.updated}/${result.processed} bản ghi`);
      
      // Trigger Google Sync ONLY for agents with actual updates
      if (result.updated > 0) {
        // Thu thập chỉ các agentIds có thay đổi thực tế
        const updatedAgentIds = new Set<string>();
        
        // Logic này cần track được những record nào thực sự updated
        // Tạm thời disable để tránh sync toàn bộ hệ thống
        this.logger.log(`🔄 Summary4 sync completed: ${result.updated} records updated, but Google Sync is managed per-order basis`);
        
        // Google Sync sẽ được trigger từ individual order operations thay vì batch sync
      }
      
      return result;

    } catch (error) {
      this.logger.error('Lỗi đồng bộ dữ liệu:', error);
      result.errors.push(`Lỗi chung: ${error.message}`);
      return result;
    }
  }

  /**
   * Sync Summary4 cho một order cụ thể (thay vì sync toàn bộ)
   * Detect nếu agent thay đổi và sync cả 2 agents (cũ + mới)
   */
  async syncSingleOrder(orderId: string): Promise<{ success: boolean; agentIds?: string[]; oldAgentId?: string; newAgentId?: string; error?: string }> {
    try {
      const order = await this.testOrder2Model
        .findById(orderId)
        .populate('agentId', 'fullName')
        .populate('productId', 'name')
        .exec();

      if (!order) {
        return { success: false, error: `Order ${orderId} not found` };
      }

      // Extract agent info
      const agentName = (order.agentId as any)?.fullName || 'Unknown Agent';
      const productName = (order.productId as any)?.name || 'Unknown Product';
      const agentIdObjectId = (order.agentId as any)?._id || order.agentId;
      const productIdObjectId = (order.productId as any)?._id || order.productId;
      const agentIdString = agentIdObjectId?.toString();
      const productIdString = productIdObjectId?.toString();

      // Check if agent changed by looking at existing Summary4 record
      const existingSummary4 = await this.summary4Model.findOne({
        $or: [
          { testOrder2Id: order._id },
          { testOrder2Id: order._id.toString() as any }
        ]
      }).exec();

      const oldAgentId = existingSummary4?.agentId?.toString();
      const newAgentId = agentIdString;
      const agentChanged = oldAgentId && oldAgentId !== newAgentId;

      if (agentChanged) {
        this.logger.log(`🔄 Agent changed for order ${orderId}: ${oldAgentId} → ${newAgentId}`);
      }

      // Find approved quote
      const approvedQuote = await this.quoteModel.findOne({
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
          { status: 'Đã duyệt' }
        ]
      }).exec();

      // Build Summary4 data
      const setData = {
        orderDate: order.createdAt,
        customerName: order.customerName,
        product: productName,
        quantity: order.quantity,
        agentId: agentIdObjectId,
        agentName: agentName,
        adGroupId: order.adGroupId,
        productionStatus: order.productionStatus,
        orderStatus: order.orderStatus,
        trackingNumber: order.trackingNumber,
        submitLink: order.submitLink,
        depositAmount: order.depositAmount,
        codAmount: order.codAmount,
        approvedQuotePrice: approvedQuote?.unitPrice || 0,
        mustPayToCompany: (approvedQuote?.unitPrice || 0) - (order.depositAmount || 0),
        paidToCompany: 0,
        manualPayment: 0,
        needToPay: (approvedQuote?.unitPrice || 0) - (order.depositAmount || 0),
        updatedAt: new Date(),
        isActive: true
      };

      // Upsert Summary4 record
      await this.summary4Model.updateOne(
        {
          $or: [
            { testOrder2Id: order._id },
            { testOrder2Id: order._id.toString() as any }
          ]
        },
        {
          $set: setData,
          $setOnInsert: { testOrder2Id: order._id }
        },
        { upsert: true }
      ).exec();

      this.logger.log(`✅ Summary4 synced for single order ${orderId}, agent: ${agentIdString}`);
      
      // Return both old and new agent IDs if agent changed
      if (agentChanged) {
        const agentIds = [oldAgentId!, newAgentId].filter(Boolean);
        this.logger.log(`🔄 Agent change detected, need to sync both agents: ${agentIds.join(', ')}`);
        return { 
          success: true, 
          agentIds,
          oldAgentId, 
          newAgentId 
        };
      }
      
      return { success: true, agentIds: [agentIdString] };

    } catch (error) {
      this.logger.error(`Summary4 sync failed for order ${orderId}:`, error);
      return { success: false, error: (error as any)?.message || 'Unknown error' };
    }
  }

  async getStats() {
    const [
      totalRecords,
      totalMustPay,
      totalPaidToCompany,
      totalManualPayment,
      totalNeedToPay
    ] = await Promise.all([
      this.summary4Model.countDocuments({ isActive: true }),
      this.summary4Model.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, total: { $sum: '$mustPayToCompany' } } }
      ]),
      this.summary4Model.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, total: { $sum: '$paidToCompany' } } }
      ]),
      this.summary4Model.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, total: { $sum: '$manualPayment' } } }
      ]),
      this.summary4Model.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, total: { $sum: '$needToPay' } } }
      ])
    ]);

    return {
      totalRecords,
      totalMustPay: totalMustPay[0]?.total || 0,
      totalPaidToCompany: totalPaidToCompany[0]?.total || 0,
      totalManualPayment: totalManualPayment[0]?.total || 0,
      totalNeedToPay: totalNeedToPay[0]?.total || 0,
      timestamp: new Date()
    };
  }

  async getAgents() {
    const agents = await this.summary4Model.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$agentId',
          agentName: { $first: '$agentName' },
          orderCount: { $sum: 1 },
          totalMustPay: { $sum: '$mustPayToCompany' },
          totalPaidToCompany: { $sum: '$paidToCompany' },
          totalManualPayment: { $sum: '$manualPayment' },
          totalNeedToPay: { $sum: '$needToPay' },
          lastOrderDate: { $max: '$orderDate' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo'
        }
      },
      {
        $project: {
          _id: 1,
          agentId: '$_id',
          agentName: 1,
          fullName: { $arrayElemAt: ['$userInfo.fullName', 0] },
          email: { $arrayElemAt: ['$userInfo.email', 0] },
          role: { $arrayElemAt: ['$userInfo.role', 0] },
          orderCount: 1,
          totalMustPay: 1,
          totalPaidToCompany: 1,
          totalManualPayment: 1,
          totalNeedToPay: 1,
          lastOrderDate: 1
        }
      },
      { $sort: { orderCount: -1, agentName: 1 } }
    ]).exec();

    return agents;
  }

  // Agents listing was removed as part of filter/search cleanup

  async exportUnpaidToExcel(_: Summary4FilterDto = {}): Promise<Buffer> {
    this.logger.log('Xuất Excel các khoản chưa thanh toán...');

    const unpaidData = await this.summary4Model
      .find({ isActive: true, needToPay: { $ne: 0 } })
      .select('_id testOrder2Id manualPayment needToPay customerName agentName product orderDate')
      .sort({ needToPay: -1 }) // Sắp xếp theo needToPay giảm dần
      .exec();

    if (!unpaidData || unpaidData.length === 0) {
      this.logger.warn('Không có dữ liệu chưa thanh toán để xuất');
    }

    // Tạo workbook và worksheet
    const workbook = XLSX.utils.book_new();
    
    // Chuẩn bị dữ liệu cho Excel
    const excelData = unpaidData.map((item, index) => ({
      'STT': index + 1,
      'ID': item._id.toString(),
      'TestOrder2 ID': item.testOrder2Id.toString(),
      'Khách hàng': item.customerName || '',
      'Sản phẩm': item.product || '',
      'Đại lý': item.agentName || '',
      'Ngày đặt hàng': item.orderDate ? new Date(item.orderDate).toLocaleDateString('vi-VN') : '',
      'Thanh toán thủ công': item.manualPayment || 0,
      'Cần thanh toán': item.needToPay || 0
    }));

    // Tạo worksheet từ dữ liệu
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Thiết lập độ rộng cột
    const columnWidths = [
      { wch: 5 },   // STT
      { wch: 25 },  // ID
      { wch: 25 },  // TestOrder2 ID
      { wch: 20 },  // Khách hàng
      { wch: 20 },  // Sản phẩm
      { wch: 20 },  // Đại lý
      { wch: 15 },  // Ngày đặt hàng
      { wch: 20 },  // Thanh toán thủ công
      { wch: 20 },  // Cần thanh toán
    ];
    worksheet['!cols'] = columnWidths;

    // Thêm worksheet vào workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Chưa Thanh Toán');

    // Tạo buffer từ workbook
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    this.logger.log(`Xuất Excel thành công: ${unpaidData.length} bản ghi`);
    return buffer;
  }

  async exportManualPaymentTemplate(_: Summary4FilterDto = {}): Promise<Buffer> {
    this.logger.log('Xuất template thanh toán tay...');

    // Lấy tất cả dữ liệu đang active (không filter)
    const templateData = await this.summary4Model
      .find({ isActive: true })
      .select('_id testOrder2Id manualPayment customerName agentName product orderDate')
      .sort({ orderDate: -1 })
      .exec();

    // Tạo workbook và worksheet
    const workbook = XLSX.utils.book_new();
    
    // Chuẩn bị dữ liệu template
    const excelData = templateData.map((item, index) => ({
      'STT': index + 1,
      '_id': item._id.toString(),
      'TestOrder2ID': item.testOrder2Id.toString(),
      'manualPayment': item.manualPayment || 0,
      'Khách hàng (chỉ để tham khảo)': item.customerName || '',
      'Đại lý (chỉ để tham khảo)': item.agentName || '',
      'Sản phẩm (chỉ để tham khảo)': item.product || '',
      'Ngày đặt hàng (chỉ để tham khảo)': item.orderDate ? new Date(item.orderDate).toLocaleDateString('vi-VN') : ''
    }));

    // Thêm hàng hướng dẫn ở đầu
    const instructionRow = {
      'STT': 'HƯỚNG DẪN:',
      '_id': 'KHÔNG ĐƯỢC SỬA cột này',
      'TestOrder2ID': 'KHÔNG ĐƯỢC SỬA cột này', 
      'manualPayment': 'CHỈ SỬA cột này',
      'Khách hàng (chỉ để tham khảo)': 'Các cột bên phải chỉ để tham khảo',
      'Đại lý (chỉ để tham khảo)': 'không ảnh hưởng đến import',
      'Sản phẩm (chỉ để tham khảo)': '',
      'Ngày đặt hàng (chỉ để tham khảo)': ''
    };

    const finalExcelData = [instructionRow, ...excelData];

    // Tạo worksheet từ dữ liệu
    const worksheet = XLSX.utils.json_to_sheet(finalExcelData);

    // Thiết lập độ rộng cột
    const columnWidths = [
      { wch: 5 },   // STT
      { wch: 25 },  // _id
      { wch: 25 },  // TestOrder2ID
      { wch: 15 },  // manualPayment
      { wch: 25 },  // Khách hàng
      { wch: 20 },  // Đại lý
      { wch: 20 },  // Sản phẩm
      { wch: 15 },  // Ngày đặt hàng
    ];
    worksheet['!cols'] = columnWidths;

    // Thêm worksheet vào workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Thanh Toán Tay');

    // Tạo buffer từ workbook
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      compression: true 
    });

    this.logger.log(`Xuất template thành công: ${templateData.length} bản ghi`);
    return excelBuffer;
  }

  async importManualPaymentFromExcel(fileBuffer: Buffer): Promise<{processed: number; updated: number; errors: string[]}> {
    this.logger.log('Bắt đầu import thanh toán tay từ Excel...');
    const result = { processed: 0, updated: 0, errors: [] };

    try {
      // Đọc file Excel
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Chuyển đổi thành JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (rawData.length < 2) {
        throw new Error('File Excel không có dữ liệu hoặc chỉ có header');
      }

      // Lấy header row để tìm vị trí các cột
      const headerRow = rawData[0];
      const idIndex = headerRow.findIndex(h => h === '_id');
      const manualPaymentIndex = headerRow.findIndex(h => h === 'manualPayment');

      if (idIndex === -1) {
        throw new Error('Không tìm thấy cột _id trong file Excel');
      }
      if (manualPaymentIndex === -1) {
        throw new Error('Không tìm thấy cột manualPayment trong file Excel');
      }

      // Xử lý từng dòng dữ liệu (bỏ qua header và instruction row)
      const dataRows = rawData.slice(2); // Bỏ qua header và instruction row
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        result.processed++;

        try {
          const id = row[idIndex];
          const manualPayment = row[manualPaymentIndex];

          // Validate dữ liệu
          if (!id) {
            result.errors.push(`Dòng ${i + 3}: Thiếu _id`);
            continue;
          }

          if (manualPayment === undefined || manualPayment === null) {
            result.errors.push(`Dòng ${i + 3}: Thiếu manualPayment`);
            continue;
          }

          // Chuyển đổi manualPayment thành number
          const manualPaymentValue = Number(manualPayment);
          if (isNaN(manualPaymentValue)) {
            result.errors.push(`Dòng ${i + 3}: manualPayment phải là số (hiện tại: ${manualPayment})`);
            continue;
          }

          // Tìm và cập nhật record
          const summary = await this.summary4Model.findById(id).exec();
          if (!summary) {
            result.errors.push(`Dòng ${i + 3}: Không tìm thấy record với _id: ${id}`);
            continue;
          }

          // Cập nhật manualPayment và tính lại needToPay
          summary.manualPayment = manualPaymentValue;
          summary.needToPay = summary.paidToCompany - summary.mustPayToCompany - manualPaymentValue;

          await summary.save();
          result.updated++;

        } catch (error) {
          result.errors.push(`Dòng ${i + 3}: ${error.message}`);
        }
      }

      // Trigger Summary5 sync sau khi import xong
      try {
        await this.summary5Service.sync({});
      } catch (e) {
        this.logger.warn(`Summary5 sync failed after manual payment import: ${e?.message || e}`);
      }

      this.logger.log(`Hoàn thành import: ${result.updated}/${result.processed} bản ghi được cập nhật`);
      return result;

    } catch (error) {
      this.logger.error('Lỗi import thanh toán tay:', error);
      result.errors.push(`Lỗi chung: ${error.message}`);
      return result;
    }
  }

  /**
   * SMART CLEANUP: Tìm và xóa records orphaned (không có testOrder2 tương ứng)
   * nhưng giữ lại records có manualPayment ≠ 0 để bảo vệ dữ liệu quan trọng
   */
  async cleanupOrphanedRecords(options: { 
    dryRun?: boolean, 
    preserveManualPayment?: boolean 
  } = {}): Promise<{
    totalOrphaned: number;
    safeToDelete: number;
    needsReview: number;
    deleted: number;
    preservedRecords: Array<{
      _id: string;
      testOrder2Id: string;
      manualPayment: number;
      customerName: string;
      agentName: string;
    }>;
    deletedRecords?: Array<{
      _id: string;
      testOrder2Id: string;
      customerName: string;
    }>;
  }> {
    const { dryRun = true, preserveManualPayment = true } = options;
    
    this.logger.log(`🧹 Bắt đầu SMART CLEANUP - DryRun: ${dryRun}, PreserveManualPayment: ${preserveManualPayment}`);

    // Tìm tất cả records trong Summary4 không có testOrder2 tương ứng
    const orphanedRecords = await this.summary4Model.aggregate([
      {
        $lookup: {
          from: 'ordertest2', // MongoDB collection name - FIXED!
          let: { testOrder2Id: '$testOrder2Id' },
          pipeline: [
            { 
              $match: { 
                $expr: { 
                  $eq: ['$_id', { $toObjectId: '$$testOrder2Id' }] 
                } 
              } 
            }
          ],
          as: 'testOrder2Match'
        }
      },
      { $match: { testOrder2Match: { $size: 0 } } }, // Không tìm thấy testOrder2
      {
        $project: {
          _id: 1,
          testOrder2Id: 1,
          manualPayment: { $ifNull: ['$manualPayment', 0] },
          customerName: 1,
          agentName: 1,
          orderDate: 1
        }
      }
    ]).exec();

    this.logger.log(`📊 Tìm thấy ${orphanedRecords.length} records orphaned`);

    // Phân loại records theo mức độ rủi ro
    const safeToDelete = orphanedRecords.filter(r => r.manualPayment === 0);
    const needsReview = orphanedRecords.filter(r => r.manualPayment !== 0);

    this.logger.log(`🟢 An toàn xóa: ${safeToDelete.length} records (manualPayment = 0)`);
    this.logger.log(`🟡 Cần xem xét: ${needsReview.length} records (manualPayment ≠ 0)`);

    let deleted = 0;
    let deletedRecords = [];

    // Thực hiện xóa nếu không phải dry-run
    if (!dryRun) {
      const recordsToDelete = preserveManualPayment ? safeToDelete : orphanedRecords;
      
      if (recordsToDelete.length > 0) {
        const deleteIds = recordsToDelete.map(r => r._id);
        const deleteTestOrder2Ids = recordsToDelete.map(r => r._id);
        
        // Xóa từ Summary4
        const summary4DeleteResult = await this.summary4Model.deleteMany({ 
          _id: { $in: deleteIds } 
        }).exec();
        
        // Xóa từ Summary5 (theo _id vì Summary5 cũng có _id tương ứng)
        const summary5DeleteResult = await this.summary5Service['s5Model'].deleteMany({ 
          _id: { $in: deleteTestOrder2Ids } 
        }).exec();
        
        deleted = summary4DeleteResult.deletedCount || 0;
        deletedRecords = recordsToDelete.map(r => ({
          _id: r._id.toString(),
          testOrder2Id: r.testOrder2Id.toString(),
          customerName: r.customerName
        }));
        
        this.logger.log(`✅ Đã xóa ${deleted} records từ Summary4`);
        this.logger.log(`✅ Đã xóa ${summary5DeleteResult.deletedCount} records từ Summary5`);
      }
    }

    const result = {
      totalOrphaned: orphanedRecords.length,
      safeToDelete: safeToDelete.length,
      needsReview: needsReview.length,
      deleted,
      preservedRecords: needsReview.map(r => ({
        _id: r._id.toString(),
        testOrder2Id: r.testOrder2Id.toString(),
        manualPayment: r.manualPayment,
        customerName: r.customerName,
        agentName: r.agentName
      })),
      ...(deletedRecords.length > 0 && { deletedRecords })
    };

    this.logger.log(`🎯 SMART CLEANUP hoàn thành: ${JSON.stringify(result, null, 2)}`);
    return result;
  }

  /**
   * Tìm Summary4 record theo testOrder2Id 
   * Sử dụng để kiểm tra manualPayment trước khi xóa TestOrder2
   */
  async findByTestOrder2Id(testOrder2Id: string): Promise<Summary4 | null> {
    const startTime = Date.now();
    
    if (!testOrder2Id) {
      this.logger.warn('[Summary4Service.findByTestOrder2Id] Empty testOrder2Id provided');
      return null;
    }

    this.logger.log(`[Summary4Service.findByTestOrder2Id] Searching for testOrder2Id: ${testOrder2Id}`);

    try {
      // Support both ObjectId and string format for backward compatibility
      const isObjectId = Types.ObjectId.isValid(testOrder2Id);
      const query = isObjectId 
        ? {
            $or: [
              { testOrder2Id: new Types.ObjectId(testOrder2Id) },
              { testOrder2Id: testOrder2Id as any }
            ]
          }
        : { testOrder2Id: testOrder2Id as any };

      this.logger.debug(`[Summary4Service.findByTestOrder2Id] Query type: ${isObjectId ? 'ObjectId' : 'string'} for testOrder2Id: ${testOrder2Id}`);

      const result = await this.summary4Model.findOne(query).exec();
      const duration = Date.now() - startTime;
      
      if (result) {
        this.logger.log(`[Summary4Service.findByTestOrder2Id] Found Summary4 record with manualPayment: ${result.manualPayment || 0} for testOrder2Id: ${testOrder2Id} (${duration}ms)`);
      } else {
        this.logger.log(`[Summary4Service.findByTestOrder2Id] No Summary4 record found for testOrder2Id: ${testOrder2Id} (${duration}ms)`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[Summary4Service.findByTestOrder2Id] Error finding Summary4 by testOrder2Id ${testOrder2Id} (${duration}ms):`, {
        error: error.message,
        stack: error.stack,
        testOrder2Id,
        timestamp: new Date().toISOString()
      });
      return null;
    }
  }

  /**
   * Xóa Summary4 record theo testOrder2Id
   * Sử dụng khi TestOrder2 bị xóa để đồng bộ
   */
  async deleteByTestOrder2Id(testOrder2Id: string): Promise<{ success: boolean; deletedCount: number; message: string }> {
    const startTime = Date.now();
    
    if (!testOrder2Id) {
      this.logger.warn('[Summary4Service.deleteByTestOrder2Id] Empty testOrder2Id provided');
      return {
        success: false,
        deletedCount: 0,
        message: 'testOrder2Id không được để trống'
      };
    }

    this.logger.log(`[Summary4Service.deleteByTestOrder2Id] Deleting Summary4 record for testOrder2Id: ${testOrder2Id}`);

    try {
      // Support both ObjectId and string format for backward compatibility
      const isObjectId = Types.ObjectId.isValid(testOrder2Id);
      const query = isObjectId 
        ? {
            $or: [
              { testOrder2Id: new Types.ObjectId(testOrder2Id) },
              { testOrder2Id: testOrder2Id as any }
            ]
          }
        : { testOrder2Id: testOrder2Id as any };

      this.logger.debug(`[Summary4Service.deleteByTestOrder2Id] Query type: ${isObjectId ? 'ObjectId' : 'string'} for testOrder2Id: ${testOrder2Id}`);

      const result = await this.summary4Model.deleteOne(query).exec();
      const duration = Date.now() - startTime;
      
      if (result.deletedCount > 0) {
        this.logger.log(`[Summary4Service.deleteByTestOrder2Id] Successfully deleted Summary4 record for testOrder2Id: ${testOrder2Id} (${duration}ms)`);
        return {
          success: true,
          deletedCount: result.deletedCount,
          message: `Đã xóa ${result.deletedCount} Summary4 record cho testOrder2Id: ${testOrder2Id}`
        };
      } else {
        this.logger.log(`[Summary4Service.deleteByTestOrder2Id] No Summary4 record found to delete for testOrder2Id: ${testOrder2Id} (${duration}ms)`);
        return {
          success: true,
          deletedCount: 0,
          message: `Không tìm thấy Summary4 record cho testOrder2Id: ${testOrder2Id}`
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[Summary4Service.deleteByTestOrder2Id] Error deleting Summary4 by testOrder2Id ${testOrder2Id} (${duration}ms):`, {
        error: error.message,
        stack: error.stack,
        testOrder2Id,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        deletedCount: 0,
        message: `Lỗi khi xóa Summary4 record (${duration}ms): ${error.message}`
      };
    }
  }

  /**
   * Xóa tất cả Summary4 records (dành cho cleanup/reset)
   */
  async clearAll(): Promise<{ success: boolean; deletedCount: number; message: string }> {
    const startTime = Date.now();
    
    this.logger.warn('[Summary4Service.clearAll] Starting clear all operation...');
    
    try {
      // Đếm số records trước khi xóa
      const countBefore = await this.summary4Model.countDocuments();
      this.logger.log(`[Summary4Service.clearAll] Found ${countBefore} records to clear`);

      const result = await this.summary4Model.deleteMany({});
      const duration = Date.now() - startTime;
      
      this.logger.warn(`[Summary4Service.clearAll] Successfully cleared ${result.deletedCount} records from Summary4 (${duration}ms)`);
      
      // Verify the deletion
      const countAfter = await this.summary4Model.countDocuments();
      if (countAfter > 0) {
        this.logger.error(`[Summary4Service.clearAll] Warning: ${countAfter} records still remain after clear operation`);
      }

      return {
        success: true,
        deletedCount: result.deletedCount,
        message: `Đã xóa thành công ${result.deletedCount} records từ Summary4 (${duration}ms)`
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[Summary4Service.clearAll] Error clearing Summary4 records (${duration}ms):`, {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        deletedCount: 0,
        message: `Lỗi khi xóa dữ liệu Summary4 (${duration}ms): ${error.message}`
      };
    }
  }
}