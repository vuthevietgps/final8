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
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

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

  /**
   * Đồng bộ dữ liệu khách hàng từ TestOrder2
   */
  async syncCustomersFromOrders(): Promise<void> {
    this.logger.log('🔄 Starting customer sync from TestOrder2...');

    // Lấy tất cả đơn hàng có thông tin khách hàng đầy đủ
    const orders = await this.testOrder2Model
      .find({
        customerName: { $exists: true, $ne: '' },
        receiverPhone: { $exists: true, $ne: '' },
        receiverAddress: { $exists: true, $ne: '' },
        isActive: true
      })
      .populate('productId')
      .sort({ createdAt: -1 })
      .exec();

    this.logger.log(`📦 Found ${orders.length} orders with customer info`);

    // Group orders by customer (name + phone)
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
        // Lấy đơn hàng mới nhất của khách hàng này
        const latestOrder = customerOrders[0]; // Already sorted by createdAt desc
        const product = latestOrder.productId as any;

        if (!product || !product.usageDurationMonths) {
          this.logger.warn(`⚠️ Product missing usageDurationMonths for order ${latestOrder._id}`);
          continue;
        }

        // Tính toán thời gian còn lại - P2 FIX: dùng tháng thực tế
        const purchaseDate = new Date(latestOrder.createdAt);
        const expiryDate = this.calculateExpiryDate(purchaseDate, product.usageDurationMonths);
        const remainingDays = this.calculateRemainingDays(expiryDate);

        // Tìm hoặc tạo customer
        const existingCustomer = await this.customerModel.findOne({
          customerName: latestOrder.customerName,
          phoneNumber: latestOrder.receiverPhone
        });

        if (existingCustomer) {
          // Cập nhật nếu có đơn hàng mới hơn
          if (new Date(latestOrder.createdAt) > existingCustomer.latestPurchaseDate) {
            await this.customerModel.updateOne(
              { _id: existingCustomer._id },
              {
                address: latestOrder.receiverAddress,
                productId: latestOrder.productId,
                latestPurchaseDate: latestOrder.createdAt,
                usageDurationMonths: product.usageDurationMonths,
                remainingDays,
                latestOrderId: latestOrder._id,
                lastCalculated: new Date()
              }
            );
            updatedCount++;
            this.logger.log(`📝 Updated customer: ${latestOrder.customerName}`);
          } else {
            // Chỉ cập nhật remainingDays
            await this.customerModel.updateOne(
              { _id: existingCustomer._id },
              {
                remainingDays,
                lastCalculated: new Date()
              }
            );
          }
        } else {
          // Tạo mới
          await this.customerModel.create({
            customerName: latestOrder.customerName,
            phoneNumber: latestOrder.receiverPhone,
            address: latestOrder.receiverAddress,
            productId: latestOrder.productId,
            latestPurchaseDate: latestOrder.createdAt,
            usageDurationMonths: product.usageDurationMonths,
            remainingDays,
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
      expiringSoon, // Lọc sắp hết hạn (< 15 ngày)
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
      mongoQuery.remainingDays = { $lt: 15, $gt: 0 };
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
        remainingDays: { $lt: 15, $gt: 0 }, 
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

    for (const customer of customers) {
      try {
        const product = customer.productId as any;
        if (!product?.usageDurationMonths) continue;

        const purchaseDate = new Date(customer.latestPurchaseDate);
        // P2 FIX: dùng tháng thực tế thay vì 30 ngày/tháng
        const expiryDate = this.calculateExpiryDate(purchaseDate, product.usageDurationMonths);
        const remainingDays = this.calculateRemainingDays(expiryDate);

        if (customer.remainingDays !== remainingDays) {
          await this.customerModel.updateOne(
            { _id: customer._id },
            { 
              remainingDays,
              lastCalculated: new Date()
            }
          );
          updatedCount++;
        }
      } catch (error) {
        this.logger.error(`Error updating customer ${customer._id}:`, error.message);
      }
    }

    this.logger.log(`📊 Updated remaining days for ${updatedCount} customers`);
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
      const expiryDate = this.calculateExpiryDate(purchaseDate, product?.usageDurationMonths || customer.usageDurationMonths);

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
        const expiryDate = this.calculateExpiryDate(purchaseDate, product?.usageDurationMonths || customer.usageDurationMonths);

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