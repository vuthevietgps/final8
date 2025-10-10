/**
 * File: order-status.service.ts
 * Mục đích: Nghiệp vụ xử lý trạng thái đơn hàng.
 */
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OrderStatus, OrderStatusDocument } from './schemas/order-status.schema';
import { CreateOrderStatusDto } from './dto/create-order-status.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

/**
 * Service xử lý logic nghiệp vụ cho trạng thái đơn hàng
 * Cung cấp các phương thức CRUD và các tính năng bổ sung
 */
@Injectable()
export class OrderStatusService {
  constructor(
    @InjectModel(OrderStatus.name) 
    private orderStatusModel: Model<OrderStatusDocument>,
  ) {}

  /**
   * Tạo mới trạng thái đơn hàng
   * @param createOrderStatusDto - Dữ liệu trạng thái đơn hàng cần tạo
   * @returns Trạng thái đơn hàng vừa được tạo
   */
  async create(createOrderStatusDto: CreateOrderStatusDto): Promise<OrderStatus> {
    try {
      // Kiểm tra trùng tên
      const existingStatus = await this.orderStatusModel.findOne({ 
        name: createOrderStatusDto.name 
      });
      
      if (existingStatus) {
        throw new ConflictException('Tên trạng thái đơn hàng đã tồn tại');
      }

      const createdStatus = new this.orderStatusModel(createOrderStatusDto);
      return createdStatus.save();
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error(`Lỗi khi tạo trạng thái đơn hàng: ${error.message}`);
    }
  }

  /**
   * Lấy danh sách tất cả trạng thái đơn hàng
   * @param isActive - Lọc theo trạng thái hoạt động (tùy chọn)
   * @param isFinal - Lọc theo trạng thái cuối (tùy chọn)
   * @returns Danh sách trạng thái đơn hàng
   */
  async findAll(isActive?: boolean, isFinal?: boolean): Promise<OrderStatus[]> {
    try {
      const filter: any = {};
      if (isActive !== undefined) filter.isActive = isActive;
      if (isFinal !== undefined) filter.isFinal = isFinal;
      
      return this.orderStatusModel
        .find(filter)
        .sort({ order: 1, createdAt: -1 })
        .exec();
    } catch (error) {
      throw new Error(`Lỗi khi lấy danh sách trạng thái đơn hàng: ${error.message}`);
    }
  }

  /**
   * Lấy một trạng thái đơn hàng theo ID
   * @param id - ID của trạng thái đơn hàng
   * @returns Trạng thái đơn hàng tìm được
   */
  async findOne(id: string): Promise<OrderStatus> {
    try {
      const status = await this.orderStatusModel.findById(id).exec();
      if (!status) {
        throw new NotFoundException('Không tìm thấy trạng thái đơn hàng');
      }
      return status;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Lỗi khi tìm trạng thái đơn hàng: ${error.message}`);
    }
  }

  /**
   * Cập nhật trạng thái đơn hàng
   * @param id - ID của trạng thái đơn hàng cần cập nhật
   * @param updateOrderStatusDto - Dữ liệu cập nhật
   * @returns Trạng thái đơn hàng sau khi cập nhật
   */
  async update(id: string, updateOrderStatusDto: UpdateOrderStatusDto): Promise<OrderStatus> {
    try {
      // Kiểm tra trùng tên (nếu có thay đổi tên)
      if (updateOrderStatusDto.name) {
        const existingStatus = await this.orderStatusModel.findOne({ 
          name: updateOrderStatusDto.name,
          _id: { $ne: id }
        });
        
        if (existingStatus) {
          throw new ConflictException('Tên trạng thái đơn hàng đã tồn tại');
        }
      }

      const updatedStatus = await this.orderStatusModel
        .findByIdAndUpdate(id, updateOrderStatusDto, { new: true })
        .exec();
      
      if (!updatedStatus) {
        throw new NotFoundException('Không tìm thấy trạng thái đơn hàng để cập nhật');
      }
      
      return updatedStatus;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new Error(`Lỗi khi cập nhật trạng thái đơn hàng: ${error.message}`);
    }
  }

  /**
   * Xóa trạng thái đơn hàng
   * @param id - ID của trạng thái đơn hàng cần xóa
   * @returns Thông báo xóa thành công
   */
  async remove(id: string): Promise<{ message: string }> {
    try {
      const deletedStatus = await this.orderStatusModel.findByIdAndDelete(id).exec();
      
      if (!deletedStatus) {
        throw new NotFoundException('Không tìm thấy trạng thái đơn hàng để xóa');
      }
      
      return { message: 'Xóa trạng thái đơn hàng thành công' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Lỗi khi xóa trạng thái đơn hàng: ${error.message}`);
    }
  }

  /**
   * Cập nhật thứ tự hiển thị cho nhiều trạng thái
   * @param orderUpdates - Mảng các object chứa id và order mới
   * @returns Danh sách trạng thái sau khi cập nhật thứ tự
   */
  async updateOrder(orderUpdates: Array<{ id: string; order: number }>): Promise<OrderStatus[]> {
    try {
      const updatePromises = orderUpdates.map(({ id, order }) =>
        this.orderStatusModel.findByIdAndUpdate(id, { order }, { new: true }).exec()
      );

      await Promise.all(updatePromises);
      
      return this.findAll();
    } catch (error) {
      throw new Error(`Lỗi khi cập nhật thứ tự trạng thái đơn hàng: ${error.message}`);
    }
  }

  /**
   * Thống kê số lượng trạng thái theo các tiêu chí
   * @returns Object chứa thống kê
   */
  async getStats(): Promise<{ 
    total: number; 
    active: number; 
    inactive: number; 
    finalStatuses: number; 
    processingStatuses: number 
  }> {
    try {
      const [total, active, finalStatuses] = await Promise.all([
        this.orderStatusModel.countDocuments().exec(),
        this.orderStatusModel.countDocuments({ isActive: true }).exec(),
        this.orderStatusModel.countDocuments({ isFinal: true }).exec(),
      ]);

      return {
        total,
        active,
        inactive: total - active,
        finalStatuses,
        processingStatuses: total - finalStatuses,
      };
    } catch (error) {
      throw new Error(`Lỗi khi lấy thống kê trạng thái đơn hàng: ${error.message}`);
    }
  }

  /**
   * Lấy danh sách trạng thái theo workflow (processing -> final)
   * @returns Object chứa trạng thái xử lý và trạng thái cuối
   */
  async getWorkflowStatuses(): Promise<{
    processing: OrderStatus[];
    final: OrderStatus[];
  }> {
    try {
      const [processing, final] = await Promise.all([
        this.orderStatusModel.find({ isFinal: false, isActive: true }).sort({ order: 1 }).exec(),
        this.orderStatusModel.find({ isFinal: true, isActive: true }).sort({ order: 1 }).exec(),
      ]);

      return { processing, final };
    } catch (error) {
      throw new Error(`Lỗi khi lấy workflow trạng thái đơn hàng: ${error.message}`);
    }
  }
}
