/**
 * File: customer/customer.service.ts
 * Mục đích: Service xử lý logic nghiệp vụ cho Khách Hàng.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { UpdateCustomerDto } from './dto';

// Interface cho lịch thông báo
export interface CustomerExpiryNotification {
  _id: string;
  customerName: string;
  phoneNumber: string;
  address: string;
  productName: string;
  productSku: string;
  remainingDays: number;
  expiryDate: Date;
  latestPurchaseDate: Date;
  priority: 'urgent' | 'warning' | 'normal';
}

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(TestOrder2.name) private testOrder2Model: Model<TestOrder2Document>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

  // ============ HELPER: TÍNH NGÀY CHÍNH XÁC ============
  /**
   * Tính ngày hết hạn chính xác bằng cách cộng tháng thực tế
   * (không dùng 30 ngày/tháng)
   */
  private calculateExpiryDate(purchaseDate: Date, usageDurationMonths: number): Date {
    const expiry = new Date(purchaseDate);
    expiry.setMonth(expiry.getMonth() + usageDurationMonths);
    return expiry;
  }

  /**
   * Tính số ngày còn lại từ ngày hết hạn
   */
  private calculateRemainingDays(expiryDate: Date): number {
    const remainingMs = expiryDate.getTime() - Date.now();
    return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  }

  private normalizeUsageDurationMonths(value: unknown): number | null {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) return null;
    const rounded = Math.floor(normalized);
    return rounded > 0 ? rounded : null;
  }

  private resolveUsageDurationMonths(...values: unknown[]): number | null {
    for (const value of values) {
      const normalized = this.normalizeUsageDurationMonths(value);
      if (normalized) return normalized;
    }
    return null;
  }

  private getOrderPurchaseDate(order: any): Date {
    if (order?.orderDate) return new Date(order.orderDate);
    if (order?.createdAt) return new Date(order.createdAt);
    return new Date();
  }

  /**
   * Đồng bộ dữ liệu khách hàng từ TestOrder2
   */
  async syncCustomersFromOrders(): Promise<void> {
    this.logger.log('🔄 Starting customer sync from TestOrder2...');

    const orders = await this.testOrder2Model
      .find({
        customerName: { $exists: true, $ne: '' },
        receiverPhone: { $exists: true, $ne: '' },
        receiverAddress: { $exists: true, $ne: '' },
        productId: { $exists: true, $ne: null },
        isActive: true
      })
      .populate('productId')
      .sort({ orderDate: -1, createdAt: -1 })
      .exec();

    this.logger.log(`📦 Found ${orders.length} orders with customer info`);

    const customerGroups = new Map<string, typeof orders>();

    orders.forEach(order => {
      const key = `${order.customerName}-${order.receiverPhone}`;
      if (!customerGroups.has(key)) {
        customerGroups.set(key, []);
      }
      customerGroups.get(key)!.push(order);
    });

    this.logger.log(`👥 Found ${customerGroups.size} unique customers`);

    let syncedCount = 0;
    let updatedCount = 0;

    for (const [customerKey, customerOrders] of customerGroups) {
      try {
        const latestOrder = customerOrders[0];
        const product = latestOrder.productId as any;

        const existingCustomer = await this.customerModel.findOne({
          customerName: latestOrder.customerName,
          phoneNumber: latestOrder.receiverPhone
        });

        const usageDurationMonths = this.resolveUsageDurationMonths(
          (latestOrder as any).productUsageDurationMonths,
          product?.usageDurationMonths,
          existingCustomer?.usageDurationMonths
        );

        if (!usageDurationMonths) {
          this.logger.warn(
            `⚠️ Missing usageDurationMonths for order ${latestOrder._id} (product=${product?._id || 'N/A'})`
          );
          continue;
        }

        const latestPurchaseDate = this.getOrderPurchaseDate(latestOrder);
        const latestExpiryDate = this.calculateExpiryDate(latestPurchaseDate, usageDurationMonths);
        const latestRemainingDays = this.calculateRemainingDays(latestExpiryDate);

        if (existingCustomer) {
          const isNewerOrder = latestPurchaseDate > new Date(existingCustomer.latestPurchaseDate);

          if (isNewerOrder) {
            await this.customerModel.updateOne(
              { _id: existingCustomer._id },
              {
                address: latestOrder.receiverAddress,
                productId: latestOrder.productId,
                latestPurchaseDate,
                usageDurationMonths,
                remainingDays: latestRemainingDays,
                latestOrderId: latestOrder._id,
                lastCalculated: new Date()
              }
            );
            updatedCount++;
            this.logger.log(`📝 Updated customer: ${latestOrder.customerName}`);
          } else {
            const currentUsageDuration = this.resolveUsageDurationMonths(
              existingCustomer.usageDurationMonths,
              usageDurationMonths
            );
            if (!currentUsageDuration) continue;

            const currentPurchaseDate = new Date(existingCustomer.latestPurchaseDate);
            const expiryDate = this.calculateExpiryDate(currentPurchaseDate, currentUsageDuration);
            const remainingDays = this.calculateRemainingDays(expiryDate);

            const updatePayload: any = {
              remainingDays,
              lastCalculated: new Date()
            };

            if (existingCustomer.usageDurationMonths !== currentUsageDuration) {
              updatePayload.usageDurationMonths = currentUsageDuration;
            }

            await this.customerModel.updateOne(
              { _id: existingCustomer._id },
              updatePayload
            );
          }
        } else {
          await this.customerModel.create({
            customerName: latestOrder.customerName,
            phoneNumber: latestOrder.receiverPhone,
            address: latestOrder.receiverAddress,
            productId: latestOrder.productId,
            latestPurchaseDate,
            usageDurationMonths,
            remainingDays: latestRemainingDays,
            latestOrderId: latestOrder._id,
            isDisabled: false,
            lastCalculated: new Date()
          });
          syncedCount++;
          this.logger.log(`✅ Created customer: ${latestOrder.customerName}`);
        }
      } catch (error) {
        this.logger.error(`❌ Error processing customer ${customerKey}:`, error.message);
      }
    }

    this.logger.log(`🎉 Customer sync completed: ${syncedCount} created, ${updatedCount} updated`);
  }
  /**
   * Lấy danh sách khách hàng với tìm kiếm và lọc
   */
  async findAll(query: any = {}): Promise<{
    customers: Customer[];
    total: number;
    limit: number;
    skip: number;
  }> {
    const {
      search,
      expiringSoon, // Lọc sắp hết hạn (<= 10 ngày)
      expired,      // P1 FIX: Lọc đã hết hạn
      isDisabled,
      limit = 100,
      skip = 0
    } = query;

    const mongoQuery: any = {};

    // Tìm kiếm theo tên hoặc số điện thoại
    if (search) {
      mongoQuery.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Lọc sắp hết hạn
    if (expiringSoon === 'true') {
      mongoQuery.remainingDays = { $lte: 10, $gt: 0 };
      mongoQuery.isDisabled = false;
    }

    // P1 FIX: Lọc đã hết hạn
    if (expired === 'true') {
      mongoQuery.remainingDays = { $lte: 0 };
      mongoQuery.isDisabled = false;
    }

    // Lọc theo trạng thái
    if (isDisabled !== undefined) {
      mongoQuery.isDisabled = isDisabled === 'true';
    }

    // P2 FIX: Thêm total count cho pagination
    const [customers, total] = await Promise.all([
      this.customerModel
        .find(mongoQuery)
        .populate('productId', 'name sku color usageDurationMonths')
        .sort({ remainingDays: 1, latestPurchaseDate: -1 })
        .limit(Number(limit))
        .skip(Number(skip))
        .exec(),
      this.customerModel.countDocuments(mongoQuery)
    ]);

    return { customers, total, limit: Number(limit), skip: Number(skip) };
  }

  /**
   * Lấy thống kê khách hàng
   */
  async getStats(): Promise<any> {
    const [
      totalCustomers,
      activeCustomers,
      expiringSoon,
      expired,
      disabledCustomers
    ] = await Promise.all([
      this.customerModel.countDocuments(),
      this.customerModel.countDocuments({ isDisabled: false }),
      this.customerModel.countDocuments({
        remainingDays: { $lte: 10, $gt: 0 },
        isDisabled: false
      }),
      this.customerModel.countDocuments({ 
        remainingDays: { $lte: 0 }, 
        isDisabled: false 
      }),
      this.customerModel.countDocuments({ isDisabled: true })
    ]);

    return {
      totalCustomers,
      activeCustomers,
      expiringSoon,
      expired,
      disabledCustomers
    };
  }

  /**
   * Vô hiệu hóa khách hàng
   */
  async disable(id: string): Promise<Customer> {
    const customer = await this.customerModel.findById(id);
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    customer.isDisabled = true;
    await customer.save();

    this.logger.log(`🚫 Disabled customer: ${customer.customerName}`);
    return customer;
  }

  /**
   * Kích hoạt lại khách hàng
   */
  async enable(id: string): Promise<Customer> {
    const customer = await this.customerModel.findById(id);
    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    customer.isDisabled = false;
    await customer.save();

    this.logger.log(`✅ Enabled customer: ${customer.customerName}`);
    return customer;
  }

  /**
   * Cập nhật thời gian còn lại cho tất cả khách hàng
   */
  async updateRemainingDays(): Promise<void> {
    this.logger.log('🔄 Updating remaining days for all customers...');

    const customers = await this.customerModel.find({ isDisabled: false }).populate('productId');
    let updatedCount = 0;
    let recalculatedCount = 0;
    const now = new Date();

    for (const customer of customers) {
      try {
        const product = customer.productId as any;
        const usageDurationMonths = this.resolveUsageDurationMonths(
          product?.usageDurationMonths,
          customer.usageDurationMonths
        );
        if (!usageDurationMonths) continue;

        const purchaseDate = new Date(customer.latestPurchaseDate);
        const expiryDate = this.calculateExpiryDate(purchaseDate, usageDurationMonths);
        const remainingDays = this.calculateRemainingDays(expiryDate);

        const updatePayload: any = { lastCalculated: now };
        let hasBusinessDataChange = false;

        if (customer.remainingDays !== remainingDays) {
          updatePayload.remainingDays = remainingDays;
          hasBusinessDataChange = true;
        }

        if (customer.usageDurationMonths !== usageDurationMonths) {
          updatePayload.usageDurationMonths = usageDurationMonths;
          hasBusinessDataChange = true;
        }

        await this.customerModel.updateOne(
          { _id: customer._id },
          updatePayload
        );

        if (hasBusinessDataChange) {
          updatedCount++;
        }
        recalculatedCount++;
      } catch (error) {
        this.logger.error(`Error updating customer ${customer._id}:`, error.message);
      }
    }

    this.logger.log(`📊 Updated remaining days for ${updatedCount} customers (recalculated: ${recalculatedCount})`);
  }
  /**
   * Tìm khách hàng theo ID
   */
  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerModel
      .findById(id)
      .populate('productId')
      .populate('latestOrderId')
      .exec();

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return customer;
  }

  /**
   * Cập nhật thông tin khách hàng
   */
  async update(id: string, updateCustomerDto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.customerModel
      .findByIdAndUpdate(id, updateCustomerDto, { new: true })
      .populate('productId')
      .exec();

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    this.logger.log(`📝 Updated customer: ${customer.customerName}`);
    return customer;
  }

  /**
   * Xóa khách hàng
   */
  async remove(id: string): Promise<void> {
    const result = await this.customerModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }
    this.logger.log(`🗑️ Deleted customer with ID: ${id}`);
  }

  // ============ CRON JOB: AUTO UPDATE REMAINING DAYS ============
  /**
   * P3 FIX: Cron job chạy mỗi ngày lúc 00:30 để cập nhật remainingDays
   */
  @Cron('0 30 0 * * *', { 
    name: 'customer-remaining-days-update',
    timeZone: 'Asia/Ho_Chi_Minh' 
  })
  async cronUpdateRemainingDays(): Promise<void> {
    this.logger.log('⏰ [CRON] Starting daily remainingDays update...');
    await this.updateRemainingDays();
  }

  // ============ NOTIFICATION SCHEDULE: KHÁCH SẮP HẾT HẠN ============
  /**
   * Lấy danh sách khách hàng cần thông báo (còn ≤ daysThreshold ngày)
   * Cho nhân viên chăm sóc khách hàng sử dụng
   */
  async getExpiryNotificationSchedule(
    daysThreshold: number = 10
  ): Promise<{
    notifications: CustomerExpiryNotification[];
    summary: {
      total: number;
      urgent: number;    // ≤ 3 ngày
      warning: number;   // 4-7 ngày
      normal: number;    // 8-10 ngày
    };
    generatedAt: Date;
  }> {
    this.logger.log(`📋 Getting expiry notification schedule (threshold: ${daysThreshold} days)...`);

    const customers = await this.customerModel
      .find({
        remainingDays: { $lte: daysThreshold, $gt: 0 },
        isDisabled: false
      })
      .populate('productId', 'name sku usageDurationMonths')
      .sort({ remainingDays: 1 })
      .exec();

    const notifications: CustomerExpiryNotification[] = customers.map(customer => {
      const product = customer.productId as any;
      const purchaseDate = new Date(customer.latestPurchaseDate);
      const usageDurationMonths = this.resolveUsageDurationMonths(
        product?.usageDurationMonths,
        customer.usageDurationMonths
      );
      const expiryDate = usageDurationMonths
        ? this.calculateExpiryDate(purchaseDate, usageDurationMonths)
        : purchaseDate;

      // Xác định mức độ ưu tiên
      let priority: 'urgent' | 'warning' | 'normal';
      if (customer.remainingDays <= 3) {
        priority = 'urgent';
      } else if (customer.remainingDays <= 7) {
        priority = 'warning';
      } else {
        priority = 'normal';
      }

      return {
        _id: customer._id.toString(),
        customerName: customer.customerName,
        phoneNumber: customer.phoneNumber,
        address: customer.address,
        productName: product?.name || 'N/A',
        productSku: product?.sku || 'N/A',
        remainingDays: customer.remainingDays,
        expiryDate,
        latestPurchaseDate: purchaseDate,
        priority
      };
    });

    const summary = {
      total: notifications.length,
      urgent: notifications.filter(n => n.priority === 'urgent').length,
      warning: notifications.filter(n => n.priority === 'warning').length,
      normal: notifications.filter(n => n.priority === 'normal').length
    };

    this.logger.log(`📋 Found ${summary.total} customers expiring soon (Urgent: ${summary.urgent}, Warning: ${summary.warning}, Normal: ${summary.normal})`);

    return {
      notifications,
      summary,
      generatedAt: new Date()
    };
  }

  /**
   * Lấy lịch thông báo theo ngày trong tuần
   * Giúp nhân viên CSKH lên kế hoạch gọi điện
   */
  async getWeeklyNotificationCalendar(): Promise<{
    calendar: Array<{
      date: string;
      dayOfWeek: string;
      customersExpiring: CustomerExpiryNotification[];
      count: number;
    }>;
    totalThisWeek: number;
    generatedAt: Date;
  }> {
    this.logger.log('📅 Generating weekly notification calendar...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const calendar: Array<{
      date: string;
      dayOfWeek: string;
      customersExpiring: CustomerExpiryNotification[];
      count: number;
    }> = [];

    // Lấy tất cả KH hết hạn trong 7 ngày tới
    const customers = await this.customerModel
      .find({
        remainingDays: { $lte: 7, $gt: 0 },
        isDisabled: false
      })
      .populate('productId', 'name sku usageDurationMonths')
      .exec();

    // Group theo ngày hết hạn
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + i);
      
      const customersExpiringOnDay = customers.filter(customer => {
        return customer.remainingDays === i;
      });

      const notifications: CustomerExpiryNotification[] = customersExpiringOnDay.map(customer => {
        const product = customer.productId as any;
        const purchaseDate = new Date(customer.latestPurchaseDate);
        const usageDurationMonths = this.resolveUsageDurationMonths(
          product?.usageDurationMonths,
          customer.usageDurationMonths
        );
        const expiryDate = usageDurationMonths
          ? this.calculateExpiryDate(purchaseDate, usageDurationMonths)
          : purchaseDate;

        return {
          _id: customer._id.toString(),
          customerName: customer.customerName,
          phoneNumber: customer.phoneNumber,
          address: customer.address,
          productName: product?.name || 'N/A',
          productSku: product?.sku || 'N/A',
          remainingDays: customer.remainingDays,
          expiryDate,
          latestPurchaseDate: purchaseDate,
          priority: i <= 3 ? 'urgent' as const : 'warning' as const
        };
      });

      calendar.push({
        date: targetDate.toISOString().split('T')[0],
        dayOfWeek: dayNames[targetDate.getDay()],
        customersExpiring: notifications,
        count: notifications.length
      });
    }

    const totalThisWeek = calendar.reduce((sum, day) => sum + day.count, 0);

    this.logger.log(`📅 Weekly calendar: ${totalThisWeek} customers expiring in next 7 days`);

    return {
      calendar,
      totalThisWeek,
      generatedAt: new Date()
    };
  }

  /**
   * Export danh sách khách cần liên hệ (cho CSKH)
   * Trả về format phù hợp để in hoặc export Excel
   */
  async exportContactList(daysThreshold: number = 10): Promise<{
    contacts: Array<{
      stt: number;
      customerName: string;
      phoneNumber: string;
      address: string;
      productName: string;
      remainingDays: number;
      expiryDateFormatted: string;
      priority: string;
      notes: string;
    }>;
    exportedAt: Date;
  }> {
    const { notifications } = await this.getExpiryNotificationSchedule(daysThreshold);

    const contacts = notifications.map((n, index) => ({
      stt: index + 1,
      customerName: n.customerName,
      phoneNumber: n.phoneNumber,
      address: n.address,
      productName: n.productName,
      remainingDays: n.remainingDays,
      expiryDateFormatted: n.expiryDate.toLocaleDateString('vi-VN'),
      priority: n.priority === 'urgent' ? 'Khẩn cấp' : 
                n.priority === 'warning' ? 'Cảnh báo' : 'Bình thường',
      notes: '' // Để trống cho CSKH ghi chú
    }));

    return {
      contacts,
      exportedAt: new Date()
    };
  }
}
