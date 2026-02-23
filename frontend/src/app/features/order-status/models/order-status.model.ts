/**
 * File: features/order-status/models/order-status.model.ts
 * Mục đích: Định nghĩa interface/model cho Trạng thái đơn hàng ở frontend.
 */
/**
 * Interface định nghĩa cấu trúc dữ liệu cho trạng thái đơn hàng
 * Sử dụng trong toàn bộ frontend để đảm bảo type safety
 */
export interface OrderStatus {
  /**
   * ID duy nhất của trạng thái đơn hàng (MongoDB ObjectId)
   */
  _id: string;

  /**
   * Tên trạng thái đơn hàng
   * VD: "Chờ xác nhận", "Đã xác nhận", "Đang xử lý", "Đang giao hàng", "Hoàn thành", "Đã hủy"
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
   * Có phải trạng thái cuối (completed/cancelled) không
   */
  isFinal: boolean;

  /**
   * Icon đại diện cho trạng thái
   */
  icon: string;

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
 * Interface cho việc tạo mới trạng thái đơn hàng
 * Loại bỏ các field được MongoDB tự tạo
 */
export interface CreateOrderStatus {
  name: string;
  color: string;
  description?: string;
  order?: number;
  isActive?: boolean;
  isFinal?: boolean;
  icon?: string;
}

/**
 * Interface cho việc cập nhật trạng thái đơn hàng
 * Tất cả fields đều optional
 */
export interface UpdateOrderStatus {
  name?: string;
  color?: string;
  description?: string;
  order?: number;
  isActive?: boolean;
  isFinal?: boolean;
  icon?: string;
}

/**
 * Interface cho thống kê trạng thái đơn hàng
 */
export interface OrderStatusStats {
  total: number;
  active: number;
  inactive: number;
  finalStatuses: number;
  processingStatuses: number;
}

/**
 * Interface cho workflow trạng thái
 */
export interface OrderStatusWorkflow {
  processing: OrderStatus[];
  final: OrderStatus[];
}
