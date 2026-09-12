# Kế hoạch sửa mô hình kinh doanh trên local

Người dùng đã yêu cầu lập kế hoạch và thực hiện toàn bộ các bước dưới đây. Không triển khai, không kết nối database cũ, không tự chuyển đổi lịch sử.

| Bước | Công việc | Điều kiện kiểm chứng | Trạng thái |
|---|---|---|---|
| 1 | Giá bán lẻ đầy đủ, phí đại lý riêng, nghĩa vụ NCC, công nợ đại lý dựa thanh toán xác nhận; loại bỏ suy diễn tiền từ trạng thái | Kiểm thử tính toán, bản chụp giá, khoản thu một phần và đảo chứng từ | Đã sửa và kiểm thử lõi; chưa nghiệm thu HTTP/UI |
| 2 | Chính sách khả năng bán lại; chủ hàng/nơi giữ; nhận hoàn có giá trị; nguồn kho và xuất lại | Hàng độc bản không vào tồn bán; hàng đại lý vào tồn giữ hộ; hàng bán lại không mua NCC thêm | Đã triển khai; giữ chỗ/xuất kho đã kiểm tra Mongo; transaction nhận hoàn thật còn chờ |
| 3 | Từng lần giao, phí phát sinh, bên gửi/nơi nhận hoàn, liên kết đơn gốc; thu chi nhiều bên | Giao/hoàn/giao lại giữ lịch sử, không lặp tiền hàng/phí; thanh toán một phần có số dư đúng | Đã triển khai và kiểm thử service; chưa nghiệm thu xuyên suốt |
| 4 | Đồng bộ báo cáo và giao diện thao tác; kiểm tra local xuyên suốt | Tổng theo đơn/sản phẩm/đại lý/ads cùng cơ sở; build và kiểm thử tích hợp đạt | Báo cáo Sổ kinh doanh đã dùng nguồn chung; màn hình cũ và nghiệm thu local còn giới hạn |

Module sử dụng: Product, SupplierQuote, Quote, TestOrder2/OrderCalculationService, Inventory, Purchase, ReturnRequest, BusinessLedger, AgentReceivable, SupplierPayable và các báo cáo. Bổ sung bảng con/chứng từ khi cần, tránh một trường vừa nghĩa vụ vừa thực nhận.

Quy tắc bảo toàn: không dùng giao thành công làm bằng chứng thực thu; không dùng COD làm toàn bộ doanh thu; không dùng hàng hoàn để tự giảm nợ NCC; không nhập tài sản đại lý thành tài sản công ty; không phát sinh mua mới khi dùng hàng đã có. Mọi thay đổi số liệu đã xác nhận cần lịch sử/chứng từ.

Kịch bản phải kiểm tra: bốn loại đơn cơ bản; bán lẻ cọc/trả trước; ba bên thu từng phần; đại lý hoàn vẫn nợ đủ giá và phí; giá hợp lệ 0; hàng hoàn không giá trị/còn giá trị; hàng về bên gửi; xuất lại hàng công ty/đại lý; nhiều lần giao; báo giá đổi sau chụp; các báo cáo cộng khớp. Tình huống chưa kiểm chứng phải được ghi rõ khi bàn giao.

Chi tiết kết quả, quy tắc ghi nhận và giới hạn: [Trạng thái sửa và ma trận đơn hàng](business-model-fix-status-2026-09-04.md). Không coi các trạng thái “đã triển khai” là nghiệm thu toàn bộ hệ thống.
