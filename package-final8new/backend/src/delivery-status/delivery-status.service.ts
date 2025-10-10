/**
 * File: delivery-status.service.ts
 * Mục đích: Nghiệp vụ xử lý trạng thái giao hàng và thao tác dữ liệu tương ứng.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateDeliveryStatusDto } from './dto/create-delivery-status.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { DeliveryStatus, DeliveryStatusDocument } from './schemas/delivery-status.schema';

@Injectable()
export class DeliveryStatusService {
  constructor(
    @InjectModel(DeliveryStatus.name) 
    private deliveryStatusModel: Model<DeliveryStatusDocument>
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
    const deliveryStatus = await this.deliveryStatusModel
      .findByIdAndUpdate(id, updateDeliveryStatusDto, { new: true })
      .exec();
    
    if (!deliveryStatus) {
      throw new NotFoundException(`Delivery status with ID ${id} not found`);
    }
    
    return deliveryStatus;
  }

  async remove(id: string): Promise<void> {
    const result = await this.deliveryStatusModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Delivery status with ID ${id} not found`);
    }
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
    
    const sampleData = [
      {
        name: 'Chờ xử lý',
        description: 'Đơn hàng đang chờ được xử lý',
        color: '#f39c12',
        icon: '⏳',
        isActive: true,
        isFinal: false,
        order: 1,
        estimatedDays: 1,
        trackingNote: 'Đơn hàng sẽ được xử lý trong 1 ngày làm việc'
      },
      {
        name: 'Đang vận chuyển',
        description: 'Hàng hóa đang được vận chuyển đến địa chỉ giao hàng',
        color: '#3498db',
        icon: '🚛',
        isActive: true,
        isFinal: false,
        order: 2,
        estimatedDays: 3,
        trackingNote: 'Dự kiến giao hàng trong 2-3 ngày'
      },
      {
        name: 'Đã giao hàng',
        description: 'Đơn hàng đã được giao thành công',
        color: '#27ae60',
        icon: '✅',
        isActive: true,
        isFinal: true,
        order: 3,
        estimatedDays: 0,
        trackingNote: 'Đơn hàng đã hoàn thành'
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
