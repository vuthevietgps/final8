import { isDealerSale } from './order-sale-mode';

/** Recognition is distinct from completeness of the latest operational inputs. */
export function profitAssessment(order: any) {
  const reasons: string[] = [];
  const dealer = isDealerSale(order);
  const state = dealer ? order.dealerProfitState : order.retailProfitState;
  if (!state || state === 'missing_quotes') return { state: 'incomplete', label: 'Chưa đủ dữ liệu giá', reasons: ['Cần bản chụp báo giá hợp lệ và tính lại đơn.'] };
  if (state === 'missing_sale_price') return { state: 'incomplete', label: 'Thiếu tổng giá bán lẻ', reasons: ['COD và tiền cọc không thay cho tổng giá bán.'] };
  if (state !== 'recognized') return { state: 'awaiting_event', label: dealer ? 'Chờ xuất bán cho đại lý' : 'Chờ kết quả giao hàng', reasons: ['Chưa tới mốc ghi nhận doanh thu/giá vốn bán hàng; nghĩa vụ NCC được theo dõi riêng.'] };
  if (order.agentId && !order.saleMode) reasons.push('Đơn cũ chưa chụp quan hệ bán theo vai trò đại lý; cần đối chiếu.');
  if (order.financialModelVersion !== 2) reasons.push('Đơn cũ cần đối chiếu lịch sử giao, giá và các khoản phí.');
  const shipments = order.shipments || [];
  const last = shipments[shipments.length - 1];
  if (last?.status === 'preparing') reasons.push('Lần xuất kho chưa hoàn tất.');
  if (last && ['returning', 'returned', 'partial'].includes(last.status)
    && Number(order.receivedReturnQuantity || 0) < last.quantity - Number(last.deliveredQuantity || 0)) {
    reasons.push('Chưa nhận và kiểm tra đủ hàng hoàn; giá trị thu hồi còn có thể thay đổi.');
  }
  if (shipments.some(s => !s.feesConfirmed)) reasons.push('Có lần giao chưa xác nhận đủ phí.');
  if (!order.costAllocatedAt) reasons.push('Chưa có mốc phân bổ chi phí quảng cáo/nhân công/chi phí chung.');
  return { state: reasons.length ? 'provisional' : 'calculated',
    label: reasons.length ? 'Lợi nhuận tạm tính' : 'Đã tính theo dữ liệu hiện có', reasons };
}
