/**
 * File: features/user/user.model.ts
 * Mục đích: Khai báo interface User dùng trong frontend.
 */
/**
 * User Model - Interface định nghĩa cấu trúc User object
 * 
 * Chức năng:
 * - Type safety cho TypeScript
 * - Đảm bảo consistency data structure giữa frontend-backend
 * - Auto-completion và validation trong IDE
 * - Document structure của User entity
 */

/**
 * Enum định nghĩa các vai trò trong hệ thống
 * Note: Values are lowercase để match với backend enum
 */
export enum UserRole {
  DIRECTOR = 'director',                   // Giám đốc - quyền cao nhất
  MANAGER = 'manager',                     // Quản lý - quản lý nhóm/phòng ban
  EMPLOYEE = 'employee',                   // Nhân viên - nhân viên thông thường
  INTERNAL_AGENT = 'internal_agent',       // Đại lý nội bộ
  EXTERNAL_AGENT = 'external_agent',       // Đại lý bên ngoài
  INTERNAL_SUPPLIER = 'internal_supplier', // Nhà cung cấp nội bộ
  EXTERNAL_SUPPLIER = 'external_supplier', // Nhà cung cấp bên ngoài
}

/**
 * Interface User - cấu trúc complete của User object
 * Bao gồm tất cả fields từ MongoDB document
 */
export interface User {
  _id?: string;          // MongoDB ObjectId (optional khi tạo mới)
  fullName: string;      // Họ và tên đầy đủ
  email: string;         // Email (unique)
  password?: string;     // Mật khẩu (optional khi get data)
  phone: string;         // Số điện thoại
  role: UserRole;        // Vai trò trong hệ thống
  address?: string;      // Địa chỉ (optional)
  isActive?: boolean;    // Trạng thái hoạt động (default: true)
  departmentId?: string; // ID phòng ban (optional)
  managerId?: string;    // ID manager (optional)
  notes?: string;        // Ghi chú (optional)
  googleDriveLink?: string; // Link Google Drive của user
  allowedLoginIps?: string[]; // Danh sách IP cho phép đăng nhập (áp dụng Manager/Employee)
  createdAt?: Date;      // Ngày tạo (auto-generated)
  updatedAt?: Date;      // Ngày cập nhật (auto-generated)
}

/**
 * Interface CreateUserDto - data structure cho việc tạo user mới
 * Loại bỏ các fields auto-generated (_id, createdAt, updatedAt)
 */
export interface CreateUserDto {
  fullName: string;      // Required
  email: string;         // Required
  password: string;      // Required khi tạo mới
  phone: string;         // Required
  role: UserRole;        // Required
  address?: string;      // Optional
  isActive?: boolean;    // Optional - default true
  departmentId?: string; // Optional
  managerId?: string;    // Optional
  notes?: string;        // Optional
  googleDriveLink?: string; // Optional
  allowedLoginIps?: string[]; // Optional (bắt buộc bởi logic khi role là manager/employee)
}

/**
 * Interface UpdateUserDto - data structure cho việc update user
 * Tất cả fields đều optional để support partial update
 */
export interface UpdateUserDto {
  fullName?: string;     // Optional - họ tên mới
  email?: string;        // Optional - email mới
  password?: string;     // Optional - mật khẩu mới
  phone?: string;        // Optional - số điện thoại mới
  role?: UserRole;       // Optional - vai trò mới
  address?: string;      // Optional - địa chỉ mới
  isActive?: boolean;    // Optional - trạng thái mới
  departmentId?: string; // Optional - phòng ban mới
  managerId?: string;    // Optional - manager mới
  notes?: string;        // Optional - ghi chú mới
  googleDriveLink?: string; // Optional - link drive mới
  allowedLoginIps?: string[]; // Optional - danh sách IP cho phép đăng nhập
}
