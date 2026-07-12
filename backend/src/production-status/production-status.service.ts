/**
 * File: production-status.service.ts
 * Mục đích: Nghiệp vụ cho trạng thái sản xuất và truy cập dữ liệu.
 */
import { Injectable, NotFoundException, ConflictException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductionStatus, ProductionStatusDocument } from './schemas/production-status.schema';
import { CreateProductionStatusDto } from './dto/create-production-status.dto';
import { UpdateProductionStatusDto } from './dto/update-production-status.dto';

/**
 * Service xử lý logic nghiệp vụ cho trạng thái sản xuất
 * Cung cấp các phương thức CRUD và các tính năng bổ sung
 */
@Injectable()
export class ProductionStatusService implements OnModuleInit {
  private readonly logger = new Logger(ProductionStatusService.name);

  constructor(
    @InjectModel(ProductionStatus.name) 
    private productionStatusModel: Model<ProductionStatusDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureDefaultStatuses();
    } catch (error: any) {
      this.logger.warn(`Failed to bootstrap production statuses: ${error?.message || error}`);
    }
  }

  /**
   * Tạo mới trạng thái sản xuất
   * @param createProductionStatusDto - Dữ liệu trạng thái sản xuất cần tạo
   * @returns Trạng thái sản xuất vừa được tạo
   */
  async create(createProductionStatusDto: CreateProductionStatusDto): Promise<ProductionStatus> {
    try {
      // Kiểm tra trùng tên
      const existingStatus = await this.productionStatusModel.findOne({ 
        name: createProductionStatusDto.name 
      });
      
      if (existingStatus) {
        throw new ConflictException('Tên trạng thái sản xuất đã tồn tại');
      }

      const createdStatus = new this.productionStatusModel(createProductionStatusDto);
      return createdStatus.save();
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error(`Lỗi khi tạo trạng thái sản xuất: ${error.message}`);
    }
  }

  /**
   * Lấy danh sách tất cả trạng thái sản xuất
   * @param isActive - Lọc theo trạng thái hoạt động (tùy chọn)
   * @returns Danh sách trạng thái sản xuất
   */
  async findAll(isActive?: boolean): Promise<ProductionStatus[]> {
    try {
      await this.ensureDefaultStatuses();
      const filter = isActive !== undefined ? { isActive } : {};
      return this.productionStatusModel
        .find(filter)
        .sort({ order: 1, createdAt: -1 })
        .exec();
    } catch (error) {
      throw new Error(`Lỗi khi lấy danh sách trạng thái sản xuất: ${error.message}`);
    }
  }

  /**
   * Lấy một trạng thái sản xuất theo ID
   * @param id - ID của trạng thái sản xuất
   * @returns Trạng thái sản xuất tìm được
   */
  async findOne(id: string): Promise<ProductionStatus> {
    try {
      const status = await this.productionStatusModel.findById(id).exec();
      if (!status) {
        throw new NotFoundException('Không tìm thấy trạng thái sản xuất');
      }
      return status;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Lỗi khi tìm trạng thái sản xuất: ${error.message}`);
    }
  }

  /**
   * Cập nhật trạng thái sản xuất
   * @param id - ID của trạng thái sản xuất cần cập nhật
   * @param updateProductionStatusDto - Dữ liệu cập nhật
   * @returns Trạng thái sản xuất sau khi cập nhật
   */
  async update(id: string, updateProductionStatusDto: UpdateProductionStatusDto): Promise<ProductionStatus> {
    try {
      // Kiểm tra trùng tên (nếu có thay đổi tên)
      if (updateProductionStatusDto.name) {
        const existingStatus = await this.productionStatusModel.findOne({ 
          name: updateProductionStatusDto.name,
          _id: { $ne: id }
        });
        
        if (existingStatus) {
          throw new ConflictException('Tên trạng thái sản xuất đã tồn tại');
        }
      }

      const updatedStatus = await this.productionStatusModel
        .findByIdAndUpdate(id, updateProductionStatusDto, { new: true })
        .exec();
      
      if (!updatedStatus) {
        throw new NotFoundException('Không tìm thấy trạng thái sản xuất để cập nhật');
      }
      
      return updatedStatus;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      throw new Error(`Lỗi khi cập nhật trạng thái sản xuất: ${error.message}`);
    }
  }

  /**
   * Xóa trạng thái sản xuất
   * @param id - ID của trạng thái sản xuất cần xóa
   * @returns Thông báo xóa thành công
   */
  async remove(id: string): Promise<{ message: string }> {
    try {
      const deletedStatus = await this.productionStatusModel.findByIdAndDelete(id).exec();
      
      if (!deletedStatus) {
        throw new NotFoundException('Không tìm thấy trạng thái sản xuất để xóa');
      }
      
      return { message: 'Xóa trạng thái sản xuất thành công' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Lỗi khi xóa trạng thái sản xuất: ${error.message}`);
    }
  }

  /**
   * Cập nhật thứ tự hiển thị cho nhiều trạng thái
   * @param orderUpdates - Mảng các object chứa id và order mới
   * @returns Danh sách trạng thái sau khi cập nhật thứ tự
   */
  async updateOrder(orderUpdates: Array<{ id: string; order: number }>): Promise<ProductionStatus[]> {
    try {
      const updatePromises = orderUpdates.map(({ id, order }) =>
        this.productionStatusModel.findByIdAndUpdate(id, { order }, { new: true }).exec()
      );

      await Promise.all(updatePromises);
      
      return this.findAll();
    } catch (error) {
      throw new Error(`Lỗi khi cập nhật thứ tự trạng thái sản xuất: ${error.message}`);
    }
  }

  /**
   * Thống kê số lượng trạng thái theo trạng thái hoạt động
   * @returns Object chứa thống kê
   */
  async getStats(): Promise<{ total: number; active: number; inactive: number }> {
    try {
      const [total, active] = await Promise.all([
        this.productionStatusModel.countDocuments().exec(),
        this.productionStatusModel.countDocuments({ isActive: true }).exec(),
      ]);

      return {
        total,
        active,
        inactive: total - active,
      };
    } catch (error) {
      throw new Error(`Lỗi khi lấy thống kê trạng thái sản xuất: ${error.message}`);
    }
  }
  async ensureDefaultStatuses(): Promise<void> {
    const count = await this.productionStatusModel.estimatedDocumentCount();
    if (count > 0) return;

    await this.productionStatusModel.insertMany([
      {
        name: 'Chưa làm',
        color: '#9CA3AF',
        description: 'Đơn hàng đã tạo nhưng chưa bắt đầu sản xuất',
        order: 1,
        isActive: true,
      },
      {
        name: 'Đang làm',
        color: '#3B82F6',
        description: 'Đơn hàng đang được xử lý sản xuất',
        order: 2,
        isActive: true,
      },
      {
        name: 'Đã trả kết quả',
        color: '#22C55E',
        description: 'Đơn hàng hoàn tất sản xuất và đủ điều kiện tạo supplier payable',
        order: 3,
        isActive: true,
      },
    ], { ordered: true });

    this.logger.log('Bootstrapped default production statuses');
  }
}
