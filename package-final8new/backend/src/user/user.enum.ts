/**
 * File: user.enum.ts
 * Mục đích: Khai báo enum vai trò Người dùng để dùng thống nhất giữa Schema/DTO/UI.
 */
/**
 * User Enum - Định nghĩa các loại người dùng trong hệ thống
 * 
 * Mục đích:
 * - Chuẩn hóa các vai trò người dùng
 * - Đảm bảo tính nhất quán trong database
 * - Dễ dàng mở rộng thêm vai trò mới
 */

export enum UserRole {
  DIRECTOR = 'director',                    // Giám đốc - quyền cao nhất
  MANAGER = 'manager',                      // Quản lý - quản lý nhân viên
  EMPLOYEE = 'employee',                    // Nhân viên - nhân viên thường
  INTERNAL_AGENT = 'internal_agent',        // Đại lý nội bộ - đại lý thuộc công ty
  EXTERNAL_AGENT = 'external_agent',        // Đại lý ngoài - đại lý bên ngoài
  INTERNAL_SUPPLIER = 'internal_supplier',  // Nhà cung cấp nội bộ - cung cấp nội bộ
  EXTERNAL_SUPPLIER = 'external_supplier',  // Nhà cung cấp ngoài - cung cấp bên ngoài
}
