/**
 * File: delivery-status.service.ts
 * Mục đích: Nghiệp vụ xử lý trạng thái giao hàng và thao tác dữ liệu tương ứng.
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateDeliveryStatusDto } from './dto/create-delivery-status.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { DeliveryStatus, DeliveryStatusDocument } from './schemas/delivery-status.schema';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';

@Injectable()
export class DeliveryStatusService {
  constructor(
    @InjectModel(DeliveryStatus.name) 
    private deliveryStatusModel: Model<DeliveryStatusDocument>,
    @InjectModel(TestOrder2.name)
    private testOrder2Model: Model<TestOrder2Document>,
  ) {}

  async create(createDeliveryStatusDto: CreateDeliveryStatusDto): Promise<DeliveryStatus> {
    // Tự động set order nếu không được cung cấp
    if (!createDeliveryStatusDto.order) {
      const count = await this.deliveryStatusModel.countDocuments();
      createDeliveryStatusDto.order = count + 1;
    }

    const deliveryStatus = new this.deliveryStatusModel(createDeliveryStatusDto);
    return deliveryStatus.save();
  }

  async findAll(): Promise<DeliveryStatus[]> {
    return this.deliveryStatusModel.find().sort({ order: 1 }).exec();
  }

  async findOne(id: string): Promise<DeliveryStatus> {
    const deliveryStatus = await this.deliveryStatusModel.findById(id).exec();
    if (!deliveryStatus) {
      throw new NotFoundException(`Delivery status with ID ${id} not found`);
    }
    return deliveryStatus;
  }

  async update(id: string, updateDeliveryStatusDto: UpdateDeliveryStatusDto): Promise<DeliveryStatus> {
    const existing = await this.deliveryStatusModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`Delivery status with ID ${id} not found`);
    }

    // Nếu đổi tên, kiểm tra xem có đơn hàng nào đang dùng tên cũ không
    if (updateDeliveryStatusDto.name && updateDeliveryStatusDto.name !== existing.name) {
      const ordersUsingStatus = await this.testOrder2Model.countDocuments({ orderStatus: existing.name });
      if (ordersUsingStatus > 0) {
        throw new BadRequestException(
          `Không thể đổi tên trạng thái "${existing.name}" vì có ${ordersUsingStatus} đơn hàng đang sử dụng. ` +
          `Vui lòng cập nhật trạng thái các đơn hàng trước.`
        );
      }
    }

    const deliveryStatus = await this.deliveryStatusModel
      .findByIdAndUpdate(id, updateDeliveryStatusDto, { new: true })
      .exec();
    
    return deliveryStatus!;
  }

  async remove(id: string): Promise<void> {
    const existing = await this.deliveryStatusModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`Delivery status with ID ${id} not found`);
    }

    // Kiểm tra xem có đơn hàng nào đang dùng trạng thái này không
    const ordersUsingStatus = await this.testOrder2Model.countDocuments({ orderStatus: existing.name });
    if (ordersUsingStatus > 0) {
      throw new BadRequestException(
        `Không thể xóa trạng thái "${existing.name}" vì có ${ordersUsingStatus} đơn hàng đang sử dụng. ` +
        `Vui lòng cập nhật trạng thái các đơn hàng trước.`
      );
    }

    await this.deliveryStatusModel.findByIdAndDelete(id).exec();
  }

  async updateOrder(orderId: string, newOrder: number): Promise<DeliveryStatus> {
    return this.update(orderId, { order: newOrder });
  }

  async getActiveStatuses(): Promise<DeliveryStatus[]> {
    return this.deliveryStatusModel.find({ isActive: true }).sort({ order: 1 }).exec();
  }

  async getFinalStatuses(): Promise<DeliveryStatus[]> {
    return this.deliveryStatusModel.find({ isFinal: true }).sort({ order: 1 }).exec();
  }

  /**
   * Lấy các trạng thái trigger thanh toán (NCC + hoa hồng đại lý)
   * Dùng để query đơn hàng đủ điều kiện thanh toán
   */
  async getPaymentTriggerStatuses(): Promise<DeliveryStatus[]> {
    return this.deliveryStatusModel.find({ isPaymentTrigger: true }).sort({ order: 1 }).exec();
  }

  /**
   * Lấy danh sách tên các trạng thái trigger thanh toán
   * Dùng trực tiếp trong query { orderStatus: { $in: [...] } }
   */
  async getPaymentTriggerStatusNames(): Promise<string[]> {
    const statuses = await this.getPaymentTriggerStatuses();
    return statuses.map(s => s.name);
  }

  /**
   * Lấy các trạng thái hoàn hàng (tính phí hoàn)
   */
  async getReturnStatuses(): Promise<DeliveryStatus[]> {
    return this.deliveryStatusModel.find({ isReturnStatus: true }).sort({ order: 1 }).exec();
  }

  /**
   * Lấy danh sách tên các trạng thái hoàn hàng
   */
  async getReturnStatusNames(): Promise<string[]> {
    const statuses = await this.getReturnStatuses();
    return statuses.map(s => s.name);
  }

  async getStatsSummary() {
    const total = await this.deliveryStatusModel.countDocuments();
    const active = await this.deliveryStatusModel.countDocuments({ isActive: true });
    const inactive = total - active;
    const finalStatuses = await this.deliveryStatusModel.countDocuments({ isFinal: true });

    return {
      total,
      active,
      inactive,
      finalStatuses,
      averageEstimatedDays: await this.getAverageEstimatedDays()
    };
  }

  private async getAverageEstimatedDays(): Promise<number> {
    const statuses = await this.deliveryStatusModel.find({ estimatedDays: { $exists: true, $ne: null } });
    if (statuses.length === 0) return 0;
    
    const sum = statuses.reduce((acc, status) => acc + (status.estimatedDays || 0), 0);
    return Math.round(sum / statuses.length);
  }

  // Method để seed dữ liệu mẫu với encoding UTF-8 đúng
  async seedSampleData(): Promise<DeliveryStatus[]> {
    // Xóa tất cả dữ liệu cũ
    await this.deliveryStatusModel.deleteMany({});
    
    // CHỈ 4 TRẠNG THÁI CẦN THIẾT CHO THANH TOÁN
    const sampleData = [
      {
        name: 'Chưa có mã vận đơn',
        description: 'Đơn hàng chưa được tạo mã vận đơn',
        color: '#6b7280',  // gray
        icon: '📦',
        isActive: true,
        isFinal: false,
        isPaymentTrigger: false,
        isReturnStatus: false,
        order: 1,
        estimatedDays: 0,
        trackingNote: 'Chờ tạo mã vận đơn'
      },
      {
        name: 'Đang giao',
        description: 'Hàng hóa đang được vận chuyển đến khách hàng',
        color: '#3b82f6',  // blue
        icon: '🚚',
        isActive: true,
        isFinal: false,
        isPaymentTrigger: false,
        isReturnStatus: false,
        order: 2,
        estimatedDays: 3,
        trackingNote: 'Dự kiến giao trong 2-3 ngày'
      },
      {
        name: 'Giao thành công',
        description: 'Đơn hàng đã giao thành công → TRIGGER THANH TOÁN',
        color: '#22c55e',  // green
        icon: '✅',
        isActive: true,
        isFinal: true,
        isPaymentTrigger: true,   // ← TRIGGER
        isReturnStatus: false,
        order: 3,
        estimatedDays: 0,
        trackingNote: 'Đơn hoàn thành - ghi nhận thanh toán'
      },
      {
        name: 'Hàng hoàn',
        description: 'Đơn hàng bị hoàn → TRIGGER THANH TOÁN + PHÍ HOÀN',
        color: '#ef4444',  // red
        icon: '↩️',
        isActive: true,
        isFinal: true,
        isPaymentTrigger: true,   // ← TRIGGER
        isReturnStatus: true,     // ← TÍNH PHÍ HOÀN
        order: 4,
        estimatedDays: 0,
        trackingNote: 'Đơn hoàn - tính phí hoàn hàng'
      }
    ];

    const createdRecords = [];
    for (const data of sampleData) {
      const created = new this.deliveryStatusModel(data);
      createdRecords.push(await created.save());
    }

    return createdRecords;
  }
}
