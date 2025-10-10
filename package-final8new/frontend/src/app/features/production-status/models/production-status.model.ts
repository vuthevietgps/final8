/**
 * File: features/production-status/models/production-status.model.ts
 * Mục đích: Định nghĩa interface/model cho Trạng thái sản xuất ở frontend.
 */
/**
 * Interface định nghĩa cấu trúc dữ liệu cho trạng thái sản xuất
 * Sử dụng trong toàn bộ frontend để đảm bảo type safety
 */
export interface ProductionStatus {
  /**
   * ID duy nhất của trạng thái sản xuất (MongoDB ObjectId)
   */
  _id: string;

  /**
   * Tên trạng thái sản xuất
   * VD: "Chờ sản xuất", "Đang sản xuất", "Hoàn thành"
   */
  name: string;

  /**
   * Màu sắc đại diện cho trạng thái (hex color)
   * VD: "#FF5733", "#33FF57", "#3357FF"
   */
  color: string;

  /**
   * Mô tả chi tiết về trạng thái (tùy chọn)
   */
  description?: string;

  /**
   * Thứ tự hiển thị của trạng thái
   */
  order: number;

  /**
   * Trạng thái có đang hoạt động không
   */
  isActive: boolean;

  /**
   * Thời gian tạo (từ MongoDB timestamps)
   */
  createdAt: string;

  /**
   * Thời gian cập nhật cuối (từ MongoDB timestamps)
   */
  updatedAt: string;
}

/**
 * Interface cho việc tạo mới trạng thái sản xuất
 * Loại bỏ các field được MongoDB tự tạo
 */
export interface CreateProductionStatus {
  name: string;
  color: string;
  description?: string;
  order?: number;
  isActive?: boolean;
}

/**
 * Interface cho việc cập nhật trạng thái sản xuất
 * Tất cả fields đều optional
 */
export interface UpdateProductionStatus {
  name?: string;
  color?: string;
  description?: string;
  order?: number;
  isActive?: boolean;
}

/**
 * Interface cho thống kê trạng thái sản xuất
 */
export interface ProductionStatusStats {
  total: number;
  active: number;
  inactive: number;
}
