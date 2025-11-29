# 🚀 Management System - Final7

## 📋 Tổng Quan Hệ Thống

Hệ thống quản lý toàn diện với NestJS backend + MongoDB và Angular frontend, đã được phát triển hoàn chỉnh và đẩy lên repository mới.

## 🔥 Quick Setup

### Clone và Cài Đặt
```bash
git clone https://github.com/vuthevietgps/final6.git
cd final6
```

### Cài Đặt Dependencies
```bash
# Cài đặt backend dependencies
cd backend
npm install

# Cài đặt frontend dependencies  
cd ../frontend
npm install
```

### Khởi Động Ứng Dụng
```bash
# Terminal 1: Backend
cd backend
npm run start:dev

# Terminal 2: Frontend
cd frontend
npm start
```

**Truy cập**: http://localhost:4200

## 📋 Yêu Cầu Hệ Thống
- Node.js v18+
- MongoDB v5.0+
- npm hoặc yarn

## Cấu trúc Project

```
webtest3/
├── backend/          # NestJS API Server
│   ├── src/
│   │   ├── user/     # User management module
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── package.json
├── frontend/         # Angular Application
│   ├── src/
│   │   ├── app/
│   │   │   ├── features/
│   │   │   │   └── user/  # User management feature
│   │   │   └── shared/
│   │   │       └── sidebar/
│   │   └── ...
│   └── package.json
└── README.md
```

## Yêu Cầu Hệ Thống

- Node.js (v18 hoặc cao hơn)
- MongoDB (v5.0 hoặc cao hơn)
- npm hoặc yarn

## Cài Đặt và Chạy

### Phương pháp 1: Sử dụng VS Code Tasks (Khuyến nghị)

1. **Mở project trong VS Code**
2. **Sử dụng Command Palette** (`Ctrl+Shift+P`):
   - `Tasks: Run Task` → `Start All (Backend + Frontend)` - Khởi động cả hai
   - `Tasks: Run Task` → `Start Backend` - Chỉ khởi động backend
   - `Tasks: Run Task` → `Start Frontend` - Chỉ khởi động frontend
   - `Tasks: Run Task` → `Install All Dependencies` - Cài đặt tất cả dependencies

3. **Hoặc sử dụng keyboard shortcut**:
   - `Ctrl+Shift+P` → `Tasks: Run Build Task` (chạy task mặc định)

### Phương pháp 2: Sử dụng Scripts

**Windows (PowerShell):**
```powershell
.\start.ps1
```

**Linux/macOS (Bash):**
```bash
chmod +x start.sh
./start.sh
```

### Phương pháp 3: Manual Setup

### 1. Cài đặt MongoDB

Đảm bảo MongoDB đang chạy trên `mongodb://localhost:27017/management-system`

### 2. Cài đặt Backend

```bash
cd backend
npm install
npm run start:dev
```

Backend sẽ chạy tại: http://localhost:3000

### 3. Cài đặt Frontend

```bash
cd frontend
npm install
npm start
```

Frontend sẽ chạy tại: http://localhost:4200

## VS Code Tasks Có Sẵn

Project đã được cấu hình với các VS Code tasks để dễ dàng phát triển:

### Development Tasks
- **Start All (Backend + Frontend)** - Khởi động cả backend và frontend song song
- **Start Backend** - Khởi động backend server với watch mode  
- **Start Frontend** - Khởi động frontend development server
- **Build Backend** - Build backend thành production
- **Build Frontend** - Build frontend thành production

### Installation Tasks  
- **Install All Dependencies** - Cài đặt dependencies cho cả backend và frontend
- **Install Backend Dependencies** - Chỉ cài đặt dependencies cho backend
- **Install Frontend Dependencies** - Chỉ cài đặt dependencies cho frontend

### Cách sử dụng Tasks
1. Mở Command Palette: `Ctrl+Shift+P` (Windows/Linux) hoặc `Cmd+Shift+P` (macOS)
2. Gõ: `Tasks: Run Task`
3. Chọn task bạn muốn chạy
4. Hoặc sử dụng `Ctrl+Shift+P` → `Tasks: Run Build Task` để chạy task mặc định

### Debug Configuration
Project cũng đã được cấu hình debug cho backend:
- **Debug Backend** - Debug backend application
- **Debug Backend (attach)** - Attach vào backend process đang chạy

## Tính Năng Hiện Tại

### Quản Lý Người Dùng
- ✅ Thêm, sửa, xóa người dùng
- ✅ Các loại người dùng: Giám Đốc, Quản Lý, Nhân Viên, Đại Lý Nội Bộ, Đại Lý Ngoài, Nhà Cung Cấp Nội Bộ, Nhà Cung Cấp Ngoài
- ✅ Lọc theo vai trò
- ✅ Giao diện responsive
- ✅ Xuất danh sách người dùng ra file CSV
- ✅ Nhập người dùng từ file CSV với ghi đè email trùng

### Quản Lý Trạng Thái Sản Xuất
- ✅ Thêm, sửa, xóa trạng thái sản xuất
- ✅ Tùy chỉnh tên trạng thái và màu sắc
- ✅ Thứ tự hiển thị và trạng thái hoạt động
- ✅ Giao diện card hiện đại với modal popup
- ✅ Tìm kiếm và lọc theo trạng thái hoạt động

### Quản Lý Trạng Thái Đơn Hàng
- ✅ Thêm, sửa, xóa trạng thái đơn hàng
- ✅ Tùy chỉnh tên, màu sắc và icon
- ✅ Phân loại trạng thái: đang xử lý vs trạng thái cuối
- ✅ Giao diện card với icon selector
- ✅ Tìm kiếm và lọc đa tiêu chí

### Quản Lý Trạng Thái Giao Hàng
- ✅ Thêm, sửa, xóa trạng thái giao hàng
- ✅ Tùy chỉnh tên, màu sắc, icon và thời gian ước tính
- ✅ Phân loại trạng thái: hoạt động vs trạng thái cuối
- ✅ Ghi chú theo dõi cho khách hàng
- ✅ Thống kê tổng quan và thứ tự hiển thị
- ✅ Giao diện hiện đại với stats cards

### Giao Diện
- ✅ Sidebar navigation
- ✅ Layout 2 cột (sidebar trái, nội dung phải)
- ✅ Design hiện đại với CSS tùy chỉnh

## API Endpoints

### User Management
- `GET /users` - Lấy danh sách người dùng
- `GET /users/:id` - Lấy thông tin một người dùng
- `POST /users` - Tạo người dùng mới
- `PATCH /users/:id` - Cập nhật người dùng
- `DELETE /users/:id` - Xóa người dùng
- `GET /users?role=role_name` - Lọc theo vai trò
- `GET /users?active=true` - Lọc người dùng hoạt động

### Export User CSV
- `GET /export-users/csv` - Xuất danh sách người dùng ra file CSV
- `GET /export-users/csv?role=role_name` - Xuất theo vai trò

### Import User CSV
- `POST /import-users/csv` - Nhập người dùng từ file CSV
- `GET /import-users/template` - Tải template CSV mẫu

### Production Status Management
- `GET /production-status` - Lấy danh sách trạng thái sản xuất
- `GET /production-status/:id` - Lấy thông tin một trạng thái sản xuất
- `POST /production-status` - Tạo trạng thái sản xuất mới
- `PATCH /production-status/:id` - Cập nhật trạng thái sản xuất
- `DELETE /production-status/:id` - Xóa trạng thái sản xuất
- `GET /production-status?isActive=true` - Lọc theo trạng thái hoạt động
- `PATCH /production-status/order/update` - Cập nhật thứ tự hiển thị
- `GET /production-status/stats/summary` - Lấy thống kê trạng thái

### Order Status Management
- `GET /order-status` - Lấy danh sách trạng thái đơn hàng
- `GET /order-status/:id` - Lấy thông tin một trạng thái đơn hàng
- `POST /order-status` - Tạo trạng thái đơn hàng mới
- `PATCH /order-status/:id` - Cập nhật trạng thái đơn hàng
- `DELETE /order-status/:id` - Xóa trạng thái đơn hàng
- `GET /order-status?isActive=true&isFinal=false` - Lọc theo trạng thái
- `PATCH /order-status/order/update` - Cập nhật thứ tự hiển thị
- `GET /order-status/stats/summary` - Lấy thống kê trạng thái
- `GET /order-status/workflow/statuses` - Lấy workflow trạng thái

### Delivery Status Management
- `GET /delivery-status` - Lấy danh sách trạng thái giao hàng
- `GET /delivery-status/:id` - Lấy thông tin một trạng thái giao hàng
- `POST /delivery-status` - Tạo trạng thái giao hàng mới
- `PATCH /delivery-status/:id` - Cập nhật trạng thái giao hàng
- `DELETE /delivery-status/:id` - Xóa trạng thái giao hàng
- `GET /delivery-status/active` - Lấy trạng thái đang hoạt động
- `GET /delivery-status/final` - Lấy trạng thái cuối cùng
- `PATCH /delivery-status/:id/order` - Cập nhật thứ tự hiển thị
- `GET /delivery-status/stats/summary` - Lấy thống kê trạng thái

### Product Category Management
- `GET /product-category` - Lấy danh sách nhóm sản phẩm
- `GET /product-category/:id` - Lấy thông tin một nhóm sản phẩm
- `POST /product-category` - Tạo nhóm sản phẩm mới
- `PATCH /product-category/:id` - Cập nhật nhóm sản phẩm
- `DELETE /product-category/:id` - Xóa nhóm sản phẩm
- `GET /product-category/active` - Lấy nhóm sản phẩm đang hoạt động
- `PATCH /product-category/:id/product-count` - Cập nhật số lượng sản phẩm
- `PATCH /product-category/:id/order` - Cập nhật thứ tự hiển thị
- `GET /product-category/stats/summary` - Lấy thống kê nhóm sản phẩm
- `POST /product-category/seed` - Tạo dữ liệu mẫu

# Management System V4-4.1

Hệ thống quản lý tổng hợp với NestJS backend và Angular frontend.

## 🚀 Tính năng chính

### ✅ Đã hoàn thành
- **Quản lý người dùng**: CRUD với 7 loại user (Director, Manager, Employee, Internal/External Agent/Supplier)
- **Quản lý sản phẩm**: Categories, products với import/export CSV
- **Quản lý đơn hàng**: Order status, delivery status, production status
- **Quản lý quảng cáo**: Ad accounts, ad groups, advertising costs
- **Báo cáo lợi nhuận**: 
  - Lợi nhuận sản phẩm theo ngày (matrix view với biểu đồ)
  - Lợi nhuận và chi phí quảng cáo (row view)
  - Lợi nhuận QC theo ngày (matrix view với biểu đồ, cost columns)
- **Chi phí**: Labor costs, other costs, salary config
- **Tổng hợp**: Summary1, Summary2 reporting

### 🔄 Đang phát triển
- **Authentication & Authorization**: Login với phân quyền theo role
- **Production deployment**: VPS Vietnix setup

## Tính Năng Sẽ Phát Triển

- 🔲 Quản lý khách hàng
- 🔲 Chi phí quảng cáo
- 🔲 Chi phí lương
- 🔲 Chi phí khác
- 🔲 Chi phí nhập hàng
- ✅ Trạng thái giao hàng
- 🔲 Báo cáo lợi nhuận
- 🔲 Dashboard tổng quan

## Cấu Trúc Code

### Backend (NestJS)
- Tổ chức theo modules (feature-based)
- Mỗi module có: controller, service, schema, dto
- Validation với class-validator
- MongoDB integration với Mongoose

### Frontend (Angular)
- Standalone components
- Feature-based folder structure
- Reactive forms
- HttpClient cho API calls
- Responsive CSS

## Chức Năng Import CSV - Danh Sách File Cần Chỉnh Sửa

### Backend Files (NestJS)
1. **backend/src/import-user/import-user.module.ts**
   - Module chính cho chức năng import CSV
   - Khai báo ImportUserController và ImportUserService
   - Import UserModule để sử dụng User schema

2. **backend/src/import-user/import-user.service.ts**
   - Logic nghiệp vụ chính cho import CSV
   - Phân tích cú pháp CSV với hỗ trợ UTF-8 BOM
   - Validation và convert dữ liệu
   - Logic ghi đè email trùng (upsert)
   - Mapping vai trò tiếng Việt sang tiếng Anh

3. **backend/src/import-user/import-user.controller.ts**
   - REST API endpoints cho upload file
   - POST /import-users/csv - Upload và import CSV
   - GET /import-users/template - Tải template CSV
   - File upload interceptor với Multer
   - Error handling và validation

4. **backend/src/app.module.ts**
   - Import ImportUserModule vào AppModule
   - Đăng ký module import-user

5. **backend/package.json**
   - Thêm dependencies: @types/multer, @nestjs/platform-express
   - Cập nhật dependencies cho file upload

### Frontend Files (Angular)
1. **frontend/src/app/features/import-user/import-user.service.ts**
   - Service cho gọi API import và template
   - Upload file CSV với FormData
   - Download template CSV
   - Validation định dạng file

2. **frontend/src/app/features/import-user/import-user.component.ts**
   - Component UI 3 bước cho import CSV
   - Drag & drop file upload
   - Hiển thị kết quả import với thống kê
   - Bootstrap modal integration

3. **frontend/src/app/features/import-user/import-user.component.html**
   - Template HTML cho giao diện 3 bước
   - Form upload file với drag & drop
   - Progress indicator và kết quả import
   - Bootstrap modal structure

4. **frontend/src/app/features/import-user/import-user.component.css**
   - Styling cho drag & drop area
   - CSS cho 3-step wizard
   - Responsive design cho mobile

5. **frontend/src/app/features/user/user-list/user-list.component.ts**
   - Thêm ImportUserComponent vào imports
   - Khai báo modal reference cho import
   - Method mở modal import CSV

6. **frontend/src/app/features/user/user-list/user-list.component.html**
   - Thêm nút "Nhập CSV" cạnh nút "Xuất CSV"
   - Bootstrap modal để hiển thị ImportUserComponent
   - Integration với existing UI

### Các File Liên Quan Khác
1. **backend/src/user/schemas/user.schema.ts**
   - Schema User để import-user service sử dụng
   - UserRole enum cho mapping vai trò

2. **backend/src/user/dto/create-user.dto.ts**
   - DTO validation cho dữ liệu import
   - Được sử dụng trong quá trình validation CSV

3. **frontend/src/app/features/user/user.service.ts**
   - Gọi lại loadUsers() sau khi import thành công
   - Refresh danh sách user sau import

### Mô Tả Chức Năng
- **Import CSV với 3 bước**: Upload file → Xem trước dữ liệu → Xác nhận import
- **Drag & Drop**: Kéo thả file CSV vào area upload
- **Ghi đè email trùng**: Tự động update user nếu email đã tồn tại
- **Validation**: Kiểm tra định dạng file, dữ liệu không hợp lệ
- **Template CSV**: Tải file mẫu với cấu trúc đúng
- **Thống kê kết quả**: Hiển thị số lượng import thành công/thất bại
- **Hỗ trợ UTF-8 BOM**: Xử lý file CSV từ Excel với encoding đúng

## Chức Năng Quản Lý Trạng Thái Sản Xuất - Danh Sách File Cần Chỉnh Sửa

### Backend Files (NestJS)
1. **backend/src/production-status/schemas/production-status.schema.ts**
   - Schema MongoDB cho trạng thái sản xuất
   - Định nghĩa cấu trúc: name, color, description, order, isActive
   - Validation cho màu sắc hex format
   - Timestamps tự động

2. **backend/src/production-status/dto/create-production-status.dto.ts**
   - DTO cho việc tạo mới trạng thái sản xuất
   - Validation rules với class-validator
   - Required fields: name, color
   - Optional fields: description, order, isActive

3. **backend/src/production-status/dto/update-production-status.dto.ts**
   - DTO cho việc cập nhật trạng thái sản xuất
   - Kế thừa từ CreateProductionStatusDto với tất cả fields optional
   - Sử dụng PartialType từ @nestjs/mapped-types

4. **backend/src/production-status/production-status.service.ts**
   - Service xử lý logic nghiệp vụ
   - CRUD operations: create, findAll, findOne, update, remove
   - Kiểm tra trùng tên trạng thái
   - Cập nhật thứ tự hiển thị batch
   - Thống kê số lượng trạng thái

5. **backend/src/production-status/production-status.controller.ts**
   - REST API controller với đầy đủ endpoints
   - Validation với ValidationPipe
   - Error handling và HTTP status codes
   - Query parameters cho filtering

6. **backend/src/production-status/production-status.module.ts**
   - Module chính cho production status
   - Import MongooseModule với schema
   - Export service để các module khác sử dụng

7. **backend/src/app.module.ts**
   - Thêm import ProductionStatusModule
   - Đăng ký module vào imports array

### Frontend Files (Angular)
1. **frontend/src/app/features/production-status/models/production-status.model.ts**
   - TypeScript interfaces cho type safety
   - ProductionStatus, CreateProductionStatus, UpdateProductionStatus
   - ProductionStatusStats interface
   - Định nghĩa cấu trúc dữ liệu frontend

2. **frontend/src/app/features/production-status/production-status.service.ts**
   - Angular service cho HTTP requests
   - Đầy đủ CRUD methods với error handling
   - API calls: get, create, update, delete, updateOrder, getStats
   - Observable patterns với RxJS operators

3. **frontend/src/app/features/production-status/production-status.component.ts**
   - Component chính với đầy đủ functionality
   - Reactive Forms với validation
   - Modal management (ViewChild)
   - Search và filtering logic
   - CRUD operations với loading states

4. **frontend/src/app/features/production-status/production-status.component.html**
   - Template HTML hoàn chỉnh
   - Grid layout responsive cho cards
   - Modal popup với form validation
   - Search box và filter buttons
   - Color picker integration

5. **frontend/src/app/features/production-status/production-status.component.css**
   - Styling hiện đại với CSS Grid
   - Card design với hover effects
   - Modal styling với gradient header
   - Responsive design cho mobile
   - Color picker và form styling

6. **frontend/src/app/app.routes.ts**
   - Thêm route cho '/production-status'
   - Lazy loading component
   - Integration với routing system

### Các File Liên Quan Khác
1. **frontend/src/app/shared/sidebar/sidebar.component.ts**
   - Menu "Trạng Thái Sản Xuất" đã có sẵn
   - Icon 🏭 và route '/production-status'

### Mô Tả Chức Năng Trạng Thái Sản Xuất
- **CRUD đầy đủ**: Thêm, sửa, xóa, xem danh sách trạng thái
- **Tùy chỉnh màu sắc**: Color picker cho visual identification
- **Thứ tự hiển thị**: Có thể sắp xếp thứ tự trạng thái
- **Trạng thái hoạt động**: Toggle active/inactive
- **Tìm kiếm và lọc**: Search theo tên, filter theo trạng thái
- **Giao diện hiện đại**: Card layout với modal popup
- **Responsive**: Tương thích mobile và tablet
- **Validation**: Form validation ở cả frontend và backend
- **Error handling**: Xử lý lỗi đầy đủ với thông báo user-friendly

## Chức Năng Quản Lý Trạng Thái Đơn Hàng - Danh Sách File Cần Chỉnh Sửa

### Backend Files (NestJS)
1. **backend/src/order-status/schemas/order-status.schema.ts**
   - Schema MongoDB cho trạng thái đơn hàng
   - Định nghĩa cấu trúc: name, color, description, order, isActive, isFinal, icon
   - Validation cho màu sắc hex format
   - Timestamps tự động và field isFinal để phân loại

2. **backend/src/order-status/dto/create-order-status.dto.ts**
   - DTO cho việc tạo mới trạng thái đơn hàng
   - Validation rules với class-validator
   - Required fields: name, color, icon
   - Optional fields: description, order, isActive, isFinal

3. **backend/src/order-status/dto/update-order-status.dto.ts**
   - DTO cho việc cập nhật trạng thái đơn hàng
   - Kế thừa từ CreateOrderStatusDto với tất cả fields optional
   - Sử dụng PartialType từ @nestjs/mapped-types

4. **backend/src/order-status/order-status.service.ts**
   - Service xử lý logic nghiệp vụ cho trạng thái đơn hàng
   - CRUD operations với filter isActive và isFinal
   - Kiểm tra trùng tên trạng thái
   - Method getWorkflowStatuses() để lấy workflow
   - Thống kê chi tiết với processing vs final statuses

5. **backend/src/order-status/order-status.controller.ts**
   - REST API controller với đầy đủ endpoints
   - Query parameters: isActive, isFinal cho filtering
   - Endpoint đặc biệt: /workflow/statuses
   - Validation với ValidationPipe và error handling

6. **backend/src/order-status/order-status.module.ts**
   - Module chính cho order status
   - Import MongooseModule với OrderStatus schema
   - Export service để các module khác sử dụng

7. **backend/src/app.module.ts**
   - Thêm import OrderStatusModule
   - Đăng ký module vào imports array

### Frontend Files (Angular)
1. **frontend/src/app/features/order-status/models/order-status.model.ts**
   - TypeScript interfaces cho type safety
   - OrderStatus, CreateOrderStatus, UpdateOrderStatus
   - OrderStatusStats, OrderStatusWorkflow interfaces
   - Định nghĩa cấu trúc với isFinal và icon fields

2. **frontend/src/app/features/order-status/order-status.service.ts**
   - Angular service cho HTTP requests
   - Đầy đủ CRUD methods với query parameters
   - API calls bao gồm getWorkflowStatuses()
   - Error handling với custom error messages

3. **frontend/src/app/features/order-status/order-status.component.ts**
   - Component chính với icon selector functionality
   - Reactive Forms với icon validation
   - Extended filtering: all, active, inactive, processing, final
   - Toggle methods cho isActive và isFinal
   - availableIcons array với emoji icons

4. **frontend/src/app/features/order-status/order-status.component.html**
   - Template HTML với icon selector
   - Card layout với icon hiển thị
   - Extended filter buttons (5 options)
   - Modal form với icon grid picker
   - Type badge hiển thị processing vs final

5. **frontend/src/app/features/order-status/order-status.component.css**
   - Styling cho icon selector và grid
   - Card design với icon integration
   - Type badge styling (processing vs final)
   - Extended filter buttons layout
   - Icon picker modal styling

6. **frontend/src/app/app.routes.ts**
   - Thêm route cho '/orders'
   - Lazy loading OrderStatusComponent
   - Integration với routing system

### Các File Liên Quan Khác
1. **frontend/src/app/shared/sidebar/sidebar.component.ts**
   - Menu "Quản Lý Đơn Hàng" sử dụng route '/orders'
   - Icon 📦 đã có sẵn trong sidebar

### Mô Tả Chức Năng Trạng Thái Đơn Hàng
- **CRUD đầy đủ**: Thêm, sửa, xóa, xem danh sách trạng thái đơn hàng
- **Icon selector**: Chọn icon từ danh sách emoji có sẵn
- **Phân loại trạng thái**: Processing vs Final (hoàn thành/hủy)
- **Workflow support**: API endpoint riêng cho workflow statuses
- **Tìm kiếm nâng cao**: Filter theo 5 tiêu chí khác nhau
- **Giao diện hiện đại**: Card layout với icon hiển thị
- **Toggle functionality**: Nhanh chóng thay đổi isActive/isFinal
- **Thống kê chi tiết**: Bao gồm processing vs final counts
- **Responsive design**: Tương thích đầy đủ mobile/tablet

## Lưu Ý Phát Triển

1. Mỗi chức năng mới cần tạo module riêng
2. Tuân thủ chuẩn REST API
3. Validation ở cả frontend và backend
4. Responsive design cho mobile
5. Error handling và loading states
6. File upload cần cấu hình Multer đúng cách
7. CSV parsing phải hỗ trợ UTF-8 BOM và escaped values
8. Import CSV cần logic upsert cho email trùng
9. Color picker validation phải đúng format hex (#RRGGBB)
10. Production status cần kiểm tra trùng tên và sắp xếp thứ tự
11. Order status cần phân loại processing vs final states
12. Icon selector cần validation và danh sách emoji có sẵn

## Troubleshooting

### Backend không khởi động
- Kiểm tra MongoDB đã chạy chưa
- Kiểm tra port 3000 có bị chiếm không

### Frontend không kết nối được API
- Kiểm tra CORS settings trong main.ts
- Đảm bảo backend đang chạy

### Dependency conflicts
- Chạy `npm install --legacy-peer-deps` nếu gặp conflict

## Cấu hình giới hạn đăng nhập theo IP (tùy chọn)

Từ ngày 2025-10-26, hệ thống đã bỏ yêu cầu "đúng địa chỉ IP mới đăng nhập được" cho tất cả vai trò (mặc định không giới hạn IP).

- Mặc định: KHÔNG kiểm tra IP khi đăng nhập.
- Bật lại kiểm tra IP (áp dụng cho Manager và Employee): đặt biến môi trường `AUTH_ENABLE_IP_RESTRICTION=true` khi chạy backend.
- Khi bật, người dùng thuộc các vai trò này cần có trường `allowedLoginIps` (mảng chuỗi IP) trong hồ sơ người dùng để đăng nhập được.

Ví dụ (PowerShell, chạy trước khi start backend):

```
$env:AUTH_ENABLE_IP_RESTRICTION="true"
```

Ghi chú:
- Backend tự động chuẩn hóa IP (xử lý `::ffff:` và `::1`) và tôn trọng header `x-forwarded-for` khi chạy sau proxy.
- Không cần thay đổi gì nếu bạn muốn mở truy cập từ mọi IP (mặc định hiện tại).
