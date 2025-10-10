/**
 * File: user.controller.ts
 * Mục đích: Cung cấp REST API CRUD cho Người dùng, nhận request và gọi service.
 */
/**
 * User Controller - API endpoints cho User management
 * 
 * Chức năng:
 * - Định nghĩa các REST API endpoints
 * - Nhận requests từ frontend
 * - Gọi UserService để xử lý business logic
 * - Trả về responses cho frontend
 * - Validation input parameters
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from './user.enum';

@Controller('users') // Base route: /users
@UseGuards(JwtAuthGuard, RolesGuard) // Bảo vệ tất cả routes với JWT
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * POST /users - Tạo user mới
   * @param createUserDto - Dữ liệu user từ request body
   * @returns User vừa được tạo
   */
  @Post()
  @RequirePermissions('users')
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  /**
   * GET /users - Lấy danh sách users với filtering
   * @param role - Query parameter để filter theo role (optional)
   * @param active - Query parameter để filter theo trạng thái (optional)
   * @returns Mảng users phù hợp với filter
   */
  @Get()
  @RequirePermissions('users')
  findAll(@Query('role') role?: string, @Query('active') active?: string) {
    if (role) {
      // Nếu có role parameter, filter theo role
      return this.userService.findByRole(role);
    }
    if (active === 'true') {
      // Nếu active=true, chỉ lấy users đang hoạt động
      return this.userService.findActiveUsers();
    }
    // Không có filter, lấy tất cả users
    return this.userService.findAll();
  }

  /**
   * GET /users/agents - Danh sách đại lý đang hoạt động (tối giản) cho dropdown
   * - Quyền: 'orders' (để nhân viên tạo đơn có thể tra cứu đại lý)
   * - Trả về: _id, fullName, email, role
   */
  @Get('agents')
  @RequirePermissions('orders')
  getActiveAgentsMinimal() {
    // Chỉ lấy đại lý nội bộ/ngoài và đang hoạt động
    return this.userService.findActiveAgentsMinimal([UserRole.INTERNAL_AGENT, UserRole.EXTERNAL_AGENT]);
  }

  /**
   * GET /users/:id - Lấy thông tin 1 user theo ID
   * @param id - ID của user cần lấy
   * @returns User với ID đó
   */
  @Get(':id')
  @RequirePermissions('users')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  /**
   * PATCH /users/:id - Cập nhật user theo ID
   * @param id - ID của user cần update
   * @param updateUserDto - Dữ liệu cần update từ request body
   * @returns User sau khi update
   */
  @Patch(':id')
  @RequirePermissions('users')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  /**
   * DELETE /users/:id - Xóa user theo ID
   * @param id - ID của user cần xóa
   * @returns User vừa bị xóa
   */
  @Delete(':id')
  @RequirePermissions('users')
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  /**
   * GET /users/email/:email - Tìm user theo email
   * @param email - Email cần tìm
   * @returns User có email đó
   */
  @Get('email/:email')
  @RequirePermissions('users')
  findByEmail(@Param('email') email: string) {
    return this.userService.findByEmail(email);
  }
}
