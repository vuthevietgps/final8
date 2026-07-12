import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateDeliveryStatusDto } from './dto/create-delivery-status.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { DeliveryStatus, DeliveryStatusDocument } from './schemas/delivery-status.schema';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { OrderStatus } from '../test-order2/constants/test-order2.constants';

type DeliveryStatusSeed = Record<string, any>;

@Injectable()
export class DeliveryStatusService implements OnModuleInit {
  private readonly logger = new Logger(DeliveryStatusService.name);

  constructor(
    @InjectModel(DeliveryStatus.name)
    private deliveryStatusModel: Model<DeliveryStatusDocument>,
    @InjectModel(TestOrder2.name)
    private testOrder2Model: Model<TestOrder2Document>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureDefaultStatuses();
    } catch (error: any) {
      this.logger.warn(`Failed to bootstrap delivery statuses: ${error?.message || error}`);
    }
  }

  async create(createDeliveryStatusDto: CreateDeliveryStatusDto): Promise<DeliveryStatus> {
    if (!createDeliveryStatusDto.order) {
      const count = await this.deliveryStatusModel.countDocuments();
      createDeliveryStatusDto.order = count + 1;
    }

    const deliveryStatus = new this.deliveryStatusModel(createDeliveryStatusDto);
    return deliveryStatus.save();
  }

  async findAll(): Promise<DeliveryStatus[]> {
    await this.ensureDefaultStatuses();
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

    if (updateDeliveryStatusDto.name && updateDeliveryStatusDto.name !== existing.name) {
      const ordersUsingStatus = await this.testOrder2Model.countDocuments({ orderStatus: existing.name });
      if (ordersUsingStatus > 0) {
        throw new BadRequestException(
          `Khong the doi ten trang thai "${existing.name}" vi co ${ordersUsingStatus} don hang dang su dung.`,
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

    const ordersUsingStatus = await this.testOrder2Model.countDocuments({ orderStatus: existing.name });
    if (ordersUsingStatus > 0) {
      throw new BadRequestException(
        `Khong the xoa trang thai "${existing.name}" vi co ${ordersUsingStatus} don hang dang su dung.`,
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

  async getPaymentTriggerStatuses(): Promise<DeliveryStatus[]> {
    await this.ensureDefaultStatuses();
    return this.deliveryStatusModel.find({ isPaymentTrigger: true }).sort({ order: 1 }).exec();
  }

  async getPaymentTriggerStatusNames(): Promise<string[]> {
    const statuses = await this.getPaymentTriggerStatuses();
    return statuses.map((status) => status.name);
  }

  async getReturnStatuses(): Promise<DeliveryStatus[]> {
    await this.ensureDefaultStatuses();
    return this.deliveryStatusModel.find({ isReturnStatus: true }).sort({ order: 1 }).exec();
  }

  async getReturnStatusNames(): Promise<string[]> {
    const statuses = await this.getReturnStatuses();
    return statuses.map((status) => status.name);
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
      averageEstimatedDays: await this.getAverageEstimatedDays(),
    };
  }

  private async getAverageEstimatedDays(): Promise<number> {
    const statuses = await this.deliveryStatusModel.find({
      estimatedDays: { $exists: true, $ne: null },
    });
    if (statuses.length === 0) return 0;

    const sum = statuses.reduce((acc, status) => acc + (status.estimatedDays || 0), 0);
    return Math.round(sum / statuses.length);
  }

  private getDefaultStatuses(): DeliveryStatusSeed[] {
    return [
      {
        name: OrderStatus.NO_TRACKING,
        description: 'Don hang chua co ma van don',
        color: '#6b7280',
        icon: 'box',
        isActive: true,
        isFinal: false,
        isPaymentTrigger: false,
        isReturnStatus: false,
        order: 1,
        estimatedDays: 0,
        trackingNote: 'Cho tao ma van don',
      },
      {
        name: OrderStatus.SHIPPING,
        description: 'Hang hoa dang duoc van chuyen den khach hang',
        color: '#3b82f6',
        icon: 'truck',
        isActive: true,
        isFinal: false,
        isPaymentTrigger: false,
        isReturnStatus: false,
        order: 2,
        estimatedDays: 3,
        trackingNote: 'Du kien giao trong 2-3 ngay',
      },
      {
        name: OrderStatus.DELIVERED,
        description: 'Don hang da giao thanh cong va phat sinh thanh toan',
        color: '#22c55e',
        icon: 'check',
        isActive: true,
        isFinal: true,
        isPaymentTrigger: true,
        isReturnStatus: false,
        order: 3,
        estimatedDays: 0,
        trackingNote: 'Don hoan thanh - ghi nhan thanh toan',
      },
      {
        name: OrderStatus.RETURNED,
        description: 'Don hang bi hoan va phat sinh phi hoan hang',
        color: '#ef4444',
        icon: 'return',
        isActive: true,
        isFinal: true,
        isPaymentTrigger: true,
        isReturnStatus: true,
        order: 4,
        estimatedDays: 0,
        trackingNote: 'Don hoan - tinh phi hoan hang',
      },
    ];
  }

  private async migrateOrdersToCanonicalName(sourceNames: string[], canonicalName: string): Promise<number> {
    let modified = 0;

    for (const sourceName of sourceNames) {
      if (!sourceName || sourceName === canonicalName) continue;

      const result = await this.testOrder2Model.updateMany(
        { orderStatus: sourceName },
        { $set: { orderStatus: canonicalName } },
      ).exec();
      modified += result.modifiedCount || 0;
    }

    return modified;
  }

  async ensureDefaultStatuses(): Promise<void> {
    const defaults = this.getDefaultStatuses();
    const existing = await this.deliveryStatusModel.find().sort({ order: 1 }).exec();

    if (existing.length === 0) {
      await this.deliveryStatusModel.insertMany(defaults, { ordered: true });
      this.logger.log('Bootstrapped default delivery statuses');
      return;
    }

    let changed = 0;

    for (const canonical of defaults) {
      const matched = existing.filter(
        (status) => status.name === canonical.name || status.order === canonical.order,
      );

      let primary = matched.find((status) => status.name === canonical.name) ?? matched[0];

      if (!primary) {
        primary = await this.deliveryStatusModel.create(canonical);
        existing.push(primary);
        changed++;
      } else {
        const updates: Record<string, any> = {};
        for (const [key, value] of Object.entries(canonical)) {
          if ((primary as any)[key] !== value) {
            updates[key] = value;
          }
        }

        if (Object.keys(updates).length > 0) {
          await this.deliveryStatusModel.updateOne({ _id: primary._id }, { $set: updates }).exec();
          Object.assign(primary, updates);
          changed++;
        }
      }

      changed += await this.migrateOrdersToCanonicalName(
        matched.map((status) => status.name),
        canonical.name,
      );

      const duplicates = matched.filter((status) => String(status._id) !== String(primary._id));
      for (const duplicate of duplicates) {
        await this.testOrder2Model.updateMany(
          { orderStatus: duplicate.name },
          { $set: { orderStatus: canonical.name } },
        ).exec();
        await this.deliveryStatusModel.deleteOne({ _id: duplicate._id }).exec();

        const duplicateIndex = existing.findIndex((status) => String(status._id) === String(duplicate._id));
        if (duplicateIndex >= 0) {
          existing.splice(duplicateIndex, 1);
        }
        changed++;
      }
    }

    if (changed > 0) {
      this.logger.log('Synchronized delivery statuses with canonical defaults');
    }
  }

  async seedSampleData(): Promise<DeliveryStatus[]> {
    await this.deliveryStatusModel.deleteMany({});

    const createdRecords = [];
    for (const data of this.getDefaultStatuses()) {
      const created = new this.deliveryStatusModel(data);
      createdRecords.push(await created.save());
    }

    return createdRecords;
  }
}
