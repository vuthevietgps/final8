/**
 * PHÂN TÍCH CHI TIẾT CÁC TRƯỜNG TRONG SUMMARY5
 * 
 * Schema Summary5 (src/summary5/schemas/summary5.schema.ts):
 * ================================================================
 * 
 * 1. orderDate: Date
 *    - Nguồn: Summary4.orderDate (hoặc Summary4.createdAt nếu null)
 *    - Mục đích: Ngày đơn hàng để group theo ngày
 * 
 * 2. adGroupId: string
 *    - Nguồn: Summary4.adGroupId (hoặc '0' nếu null)
 *    - Mục đích: Nhóm quảng cáo để tính lợi nhuận theo campaign
 *    - Giá trị '0': Đơn hàng không từ quảng cáo (organic)
 * 
 * 3. productId: string
 *    - Nguồn: Summary4.productId (ObjectId → toString)
 *    - Mục đích: Báo cáo lợi nhuận theo sản phẩm
 * 
 * 4. revenue: number
 *    - Nguồn: Summary4.paidToCompanyAmount
 *    - Cách tính trong Summary4:
 *      + Internal agent: paidToCompany = codAmount khi orderStatus = "Giao thành công"
 *      + External agent: paidToCompany = codAmount khi productionStatus = "Đã trả kết quả"
 *    - Ý nghĩa: DOANH THU đã thu được từ đơn hàng
 * 
 * 5. profit: number
 *    - Cách tính: revenue - mustPayAmount - manualPaymentAmount
 *    - Chi tiết:
 *      + revenue: Doanh thu (paidToCompanyAmount)
 *      + mustPayAmount: GIÁ VỐN phải trả cho công ty = unitPrice × quantity (khi đã trả kết quả)
 *      + manualPaymentAmount: Chi phí phát sinh/thủ công
 *    - Ý nghĩa: LỢI NHUẬN trước chi phí quảng cáo
 * 
 * 6. adCost: number
 *    - Nguồn: AdvertisingCost.spentAmount (merge theo adGroupId + date)
 *    - Cách tính: SUM(spentAmount) group by (adGroupId, date)
 *    - Ý nghĩa: CHI PHÍ QUẢNG CÁO trong ngày cho nhóm QC
 * 
 * 
 * QUY TRÌNH TÍNH TOÁN SUMMARY5:
 * ================================================================
 * 
 * Bước 1: Aggregate từ Summary4
 * -------------------------------
 * - Lọc: isActive = true, orderDate is Date type
 * - Group theo: (adGroupId, productId, orderDate)
 * - Tính tổng:
 *   + revenue = SUM(paidToCompanyAmount)
 *   + profit = SUM(paidToCompanyAmount - mustPayAmount - manualPaymentAmount)
 * 
 * Bước 2: Aggregate từ AdvertisingCost
 * -------------------------------------
 * - Lọc: adGroupId exists, date is Date type
 * - Group theo: (adGroupId, date)
 * - Tính tổng: adCost = SUM(spentAmount)
 * 
 * Bước 3: Merge dữ liệu
 * ----------------------
 * - Key merge: adGroupId + orderDate
 * - Kết quả: Summary5 record với đầy đủ revenue, profit, adCost
 * 
 * 
 * Ý NGHĨA CÁC CHỈ SỐ:
 * ================================================================
 * 
 * 1. DOANH THU (revenue):
 *    - Tiền đã thu được từ khách hàng
 *    - Internal agent: khi giao thành công
 *    - External agent: khi đã trả kết quả
 * 
 * 2. GIÁ VỐN (mustPayAmount trong Summary4):
 *    - Chi phí sản xuất/mua hàng
 *    - Được tính khi đã trả kết quả = unitPrice × quantity
 * 
 * 3. LỢI NHUẬN GỘP (profit):
 *    - Lợi nhuận trước chi phí quảng cáo
 *    - profit = revenue - giá vốn - chi phí phát sinh
 * 
 * 4. CHI PHÍ QUẢNG CÁO (adCost):
 *    - Chi phí chạy ads trên Facebook/Google/TikTok
 *    - Lấy từ bảng AdvertisingCost riêng
 * 
 * 5. LỢI NHUẬN RÒNG (chưa có field):
 *    - Có thể tính: profit - adCost
 *    - = Lợi nhuận sau khi trừ cả chi phí quảng cáo
 * 
 * 
 * VÍ DỤ TÍNH TOÁN:
 * ================================================================
 * 
 * Đơn hàng:
 * - codAmount: 1,000,000 đ (khách trả)
 * - unitPrice: 600,000 đ (giá vốn)
 * - quantity: 1
 * - manualPayment: 0 đ
 * - adGroupId: "120234808394010255"
 * - orderDate: 2025-12-08
 * 
 * Tính toán Summary4:
 * - paidToCompanyAmount (revenue): 1,000,000 đ (khi giao thành công/đã trả kết quả)
 * - mustPayAmount (giá vốn): 600,000 đ (khi đã trả kết quả)
 * 
 * Tính toán Summary5:
 * - revenue: 1,000,000 đ
 * - profit: 1,000,000 - 600,000 - 0 = 400,000 đ
 * - adCost: 50,000 đ (từ AdvertisingCost)
 * - Lợi nhuận ròng: 400,000 - 50,000 = 350,000 đ
 * 
 * 
 * KẾT LUẬN:
 * ================================================================
 * 
 * Summary5 là bảng tổng hợp để báo cáo lợi nhuận theo:
 * - Nhóm quảng cáo (adGroupId)
 * - Sản phẩm (productId)
 * - Ngày (orderDate)
 * 
 * Dữ liệu được tổng hợp từ:
 * - Summary4: revenue, profit (giá vốn)
 * - AdvertisingCost: adCost (chi phí quảng cáo)
 * 
 * Logic tính doanh thu phân biệt theo loại đại lý:
 * - Internal agent: tính khi giao thành công
 * - External agent: tính khi đã trả kết quả
 */

console.log('📄 Summary5 field analysis saved to this file');
console.log('✅ Please review the documentation above');
