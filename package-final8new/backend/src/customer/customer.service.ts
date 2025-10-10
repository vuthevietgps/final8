/**
 * File: customer/customer.service.ts
 * Mục đích: Service xử lý logic nghiệp vụ cho Khách Hàng.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    @InjectModel(Customer.name) private customerModel: Model<CustomerDocument>,
    @InjectModel(TestOrder2.name) private testOrder2Model: Model<TestOrder2Document>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
  ) {}

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

        // Tính toán thời gian còn lại
        const purchaseDate = new Date(latestOrder.createdAt);
        const usageDurationMs = product.usageDurationMonths * 30 * 24 * 60 * 60 * 1000; // Convert months to ms
        const expiryDate = new Date(purchaseDate.getTime() + usageDurationMs);
        const remainingMs = expiryDate.getTime() - Date.now();
        const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

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
  async findAll(query: any = {}): Promise<Customer[]> {
    const {
      search,
      expiringSoon, // Lọc sắp hết hạn (< 15 ngày)
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

    // Lọc theo trạng thái
    if (isDisabled !== undefined) {
      mongoQuery.isDisabled = isDisabled === 'true';
    }

    return this.customerModel
      .find(mongoQuery)
      .populate('productId', 'name sku color usageDurationMonths')
      .sort({ remainingDays: 1, latestPurchaseDate: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .exec();
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
        const usageDurationMs = product.usageDurationMonths * 30 * 24 * 60 * 60 * 1000;
        const expiryDate = new Date(purchaseDate.getTime() + usageDurationMs);
        const remainingMs = expiryDate.getTime() - Date.now();
        const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

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
}