/**
 * File: user.service.ts
 * Mục đích: Chứa nghiệp vụ Người dùng, thao tác với MongoDB qua Mongoose Model.
 */
/**
 * User Service - Business logic layer cho User management
 * 
 * Chức năng:
 * - Xử lý logic nghiệp vụ cho User
 * - Tương tác với MongoDB thông qua Mongoose
 * - Cung cấp các method CRUD và query đặc biệt
 * - Tách biệt logic nghiệp vụ khỏi controller
 */

import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from './user.enum';
import { enforceActiveUserLimit } from '../plan/user-limit.util';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  /**
   * Tạo user mới
   * @param createUserDto - Dữ liệu user cần tạo
   * @returns Promise<User> - User vừa được tạo
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Kiem tra gioi han user theo goi (khong tinh user inactive)
    if (createUserDto.isActive !== false) {
      await enforceActiveUserLimit(() => this.userModel.countDocuments({ isActive: true }).exec());
    }

    try {
      const createdUser = new this.userModel(createUserDto);
      const saved = await createdUser.save();
      const { password, ...result } = saved.toObject();
      return result as unknown as User;
    } catch (error: any) {
      // Xử lý lỗi duplicate email (MongoDB error code 11000)
      if (error.code === 11000 && error.keyPattern?.email) {
        throw new ConflictException(`Email "${error.keyValue.email}" đã được sử dụng bởi người dùng khác`);
      }
      // Lỗi khác
      throw new BadRequestException(error.message || 'Không thể tạo người dùng');
    }
  }

  /**
   * Lấy danh sách tất cả users
   * @returns Promise<User[]> - Mảng tất cả users
   */
  async findAll(): Promise<User[]> {
    return this.userModel.find().select('-password').exec();
  }

  /**
   * Tìm user theo ID
   * @param id - ID của user
   * @returns Promise<User> - User tìm được
   */
  async findOne(id: string): Promise<User> {
    return this.userModel.findById(id).select('-password').exec();
  }

  /**
   * Cập nhật user theo ID
   * @param id - ID của user cần update
   * @param updateUserDto - Dữ liệu cần update
   * @returns Promise<User> - User sau khi update
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    // Chi check quota khi update user tu inactive -> active
    if (updateUserDto.isActive === true) {
      const existing = await this.userModel.findById(id).select('isActive').lean();
      if (existing && existing.isActive !== true) {
        await enforceActiveUserLimit(() => this.userModel.countDocuments({ isActive: true }).exec());
      }
    }

    try {
      return await this.userModel.findByIdAndUpdate(id, updateUserDto, { new: true }).select('-password').exec();
    } catch (error: any) {
      // Xử lý lỗi duplicate email khi update
      if (error.code === 11000 && error.keyPattern?.email) {
        throw new ConflictException(`Email "${error.keyValue.email}" đã được sử dụng bởi người dùng khác`);
      }
      throw new BadRequestException(error.message || 'Không thể cập nhật người dùng');
    }
  }

  /**
   * Xóa user theo ID
   * @param id - ID của user cần xóa
   * @returns Promise<User> - User vừa bị xóa
   */
  async remove(id: string): Promise<User> {
    return this.userModel.findByIdAndDelete(id).select('-password').exec();
  }

  /**
   * Tìm users theo vai trò
   * @param role - Vai trò cần tìm
   * @returns Promise<User[]> - Mảng users có vai trò đó
   */
  async findByRole(role: string): Promise<User[]> {
    return this.userModel.find({ role }).select('-password').exec();
  }

  /**
   * Tìm user theo email
   * @param email - Email cần tìm
   * @returns Promise<User> - User có email đó
   */
  async findByEmail(email: string): Promise<User> {
    return this.userModel.findOne({ email }).exec();
  }

  /**
   * Tìm users đang hoạt động
   * @returns Promise<User[]> - Mảng users có isActive = true
   */
  async findActiveUsers(): Promise<User[]> {
    return this.userModel.find({ isActive: true }).select('-password').exec();
  }

  /**
   * Lấy danh sách đại lý đang hoạt động với trường tối giản cho dropdown
   * @param roles - Danh sách vai trò cần lọc (mặc định là nội bộ + ngoài)
   */
  async findActiveAgentsMinimal(
    roles: UserRole[] = [UserRole.INTERNAL_AGENT, UserRole.EXTERNAL_AGENT],
  ): Promise<Array<{ _id: string; fullName: string; email: string; role: UserRole }>> {
    const users = await this.userModel
      .find({ role: { $in: roles }, isActive: true })
      .select('_id fullName email role')
      .sort({ fullName: 1 })
      .lean();
    return users.map((u: any) => ({ _id: String(u._id), fullName: u.fullName, email: u.email, role: u.role }));
  }

  /**
   * Tìm danh sách Nhà Cung Cấp (Internal/External) với optional search/active
   * @param params.q   - Tìm theo tên, email, điện thoại, địa chỉ (regex, i)
   * @param params.active - Chỉ lấy isActive=true nếu true
   * @param params.minimal - Chỉ trả về trường tối giản nếu true
   */
  async findSuppliers(params: { q?: string; active?: boolean; minimal?: boolean } = {}) {
    const { q, active, minimal } = params;
    const filter: any = { role: { $in: [UserRole.INTERNAL_SUPPLIER, UserRole.EXTERNAL_SUPPLIER] } };
    if (active === true) filter.isActive = true;
    if (q && q.trim()) {
      const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { fullName: rx },
        { email: rx },
        { phone: rx },
        { address: rx }
      ];
    }

    const query = this.userModel.find(filter).sort({ fullName: 1 });
    if (minimal) {
      query.select('_id fullName email phone role isActive');
    } else {
      query.select('-password');
    }
    const docs = await query.lean();
    return docs.map((u: any) => ({ ...u, _id: String(u._id) }));
  }
}
