/**
 * File: quote.enum.ts
 * Mục đích: Khai báo enum trạng thái Báo giá và mảng giá trị QUOTE_STATUS_VALUES dùng chung
 *   giữa Schema và DTO nhằm đảm bảo đồng bộ validate.
 */
export enum QuoteStatus {
  PENDING = 'Chờ duyệt',
  APPROVED = 'Đã duyệt', 
  REJECTED = 'Từ chối',
  EXPIRED = 'Hết hiệu lực'
}

export const QUOTE_STATUS_VALUES = Object.values(QuoteStatus);
