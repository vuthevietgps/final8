/**
 * File: app.module.ts
 * Mục đích: Root module của ứng dụng NestJS, import các module con (user, product,
 *   quote, v.v.), cấu hình Mongoose và các provider toàn cục nếu cần.
 */
/**
 * App Module - Module chính của ứng dụng NestJS
 * 
 * Chức năng:
 * - Khởi tạo kết nối MongoDB Atlas
 * - Import các module con (UserModule, ExportUserModule, ImportUserModule)
 * - Cấu hình các providers và controllers chính
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { ScheduleModule } from '@nestjs/schedule';
import { AdAccountModule } from './ad-account/ad-account.module';
import { AdGroupProfitReportModule } from './ad-group-profit-report/ad-group-profit-report.module';
import { AdGroupProfitModule } from './ad-group-profit/ad-group-profit.module';
import { AdGroupModule } from './ad-group/ad-group.module';
import { AdvertisingCostModule } from './advertising-cost/advertising-cost.module';
import { AdvertisingCostPublicModule } from './advertising-cost-public/advertising-cost-public.module';
import { AdvertisingCostSuggestionModule } from './advertising-cost-suggestion/advertising-cost-suggestion.module';
import { AdvertisingOptimizationModule } from './advertising-optimization/advertising-optimization.module';
import { AuthModule } from './auth/auth.module';
import { CustomerModule } from './customer/customer.module';
import { DeliveryStatusModule } from './delivery-status/delivery-status.module';
import { ExportUserModule } from './export-user/export-user.module';
import { GoogleSyncModule } from './google-sync/google-sync.module';
import { HealthModule } from './health/health.module';
import { ImportUserModule } from './import-user/import-user.module';
import { LaborCost1Module } from './labor-cost1/labor-cost1.module';
import { OrderStatusModule } from './order-status/order-status.module';
import { OtherCostModule } from './other-cost/other-cost.module';
import { ProductCategoryModule } from './product-category/product-category.module';
import { ProductProfitReportModule } from './product-profit-report/product-profit-report.module';
import { ProductModule } from './product/product.module';
import { ProductionStatusModule } from './production-status/production-status.module';
import { QuoteModule } from './quote/quote.module';
import { SalaryConfigModule } from './salary-config/salary-config.module';
import { SessionLogModule } from './session-log/session-log.module';
// Re-enable minimal endpoints for Summary4, Summary5, TestOrder2 (for compatibility with frontend)
import { Summary4Module } from './summary4/summary4.module';
import { Summary5Module } from './summary5/summary5.module';
import { TestOrder2Module } from './test-order2/test-order2.module';
import { UserModule } from './user/user.module';
// Chatbot & AI related modules
import { FanpageModule } from './fanpage/fanpage.module';
import { OpenAIConfigModule } from './openai-config/openai-config.module';
import { ApiTokenModule } from './api-token/api-token.module';
import { ChatMessageModule } from './chat-message/chat-message.module';
import { PendingOrderModule } from './pending-order/pending-order.module';
import { ProfitForecastModule } from './profit-forecast/profit-forecast.module';

import { MediaModule } from './media/media.module';
import { OrderUpdateModule } from './order-update/order-update.module';
import { PurchaseOrderModule } from './purchase/purchase-order.module';
import { InventoryModule } from './inventory/inventory.module';
import { AdReportModule } from './ad-report/ad-report.module';
import { ReturnReportModule } from './return-report/return-report.module';
import { SupplierPayableModule } from './supplier-payable/supplier-payable.module';
import { FinanceModule } from './finance/finance.module';

@Module({
  imports: [
    // Load environment variables globally from multiple possible locations (robust to different CWDs)
    ConfigModule.forRoot({
      isGlobal: true,
      // Try several common locations so dev/prod and root/backend CWDs all work
      envFilePath: [
        '.env',
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), 'backend', '.env'),
        path.resolve(__dirname, '..', '.env'),
        path.resolve(__dirname, '..', '..', '.env'),
      ],
      ignoreEnvFile: false,
    }),
    // Bật scheduler để dùng cron job
    ScheduleModule.forRoot(),

    // Cấu hình multer cho upload file
    MulterModule.register({
      dest: './uploads',
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),

    // Kết nối MongoDB (ưu tiên MONGODB_URI từ môi trường; fallback atlas smarterp-dev)
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/smarterp-dev', {
      connectionFactory: (connection) => {
        connection.on('connected', () => {
          console.log('MongoDB connected with UTF-8 support');
        });
        return connection;
      },
    }),

    // Import AuthModule để sử dụng JWT authentication
    AuthModule,

    // Import UserModule để sử dụng các chức năng quản lý user
    UserModule,

    // Import ExportUserModule để sử dụng các chức năng xuất CSV
    ExportUserModule,

    // Import ImportUserModule để sử dụng các chức năng nhập CSV
    ImportUserModule,

    // Import ProductionStatusModule để quản lý trạng thái sản xuất
    ProductionStatusModule,

    // Import OrderStatusModule để quản lý trạng thái đơn hàng
    OrderStatusModule,

    // Import DeliveryStatusModule để quản lý trạng thái giao hàng
    DeliveryStatusModule,

    // Import ProductCategoryModule để quản lý nhóm sản phẩm
    ProductCategoryModule,

    // Import ProductModule để quản lý sản phẩm
    ProductModule,

    // Import CustomerModule để quản lý khách hàng
    CustomerModule,

    // Import QuoteModule để quản lý báo giá đại lý
    QuoteModule,

    // Import AdGroupModule để quản lý nhóm quảng cáo
    AdGroupModule,
    // Import AdAccountModule để quản lý tài khoản quảng cáo
    AdAccountModule,
    // Import OtherCostModule để quản lý Chi Phí Khác
    OtherCostModule,
    AdvertisingCostModule,
    // Module Public API cho Advertising Cost (không cần authentication)
    AdvertisingCostPublicModule,
    // Module Đề Xuất Chi Phí Quảng Cáo
    AdvertisingCostSuggestionModule,
    AdvertisingOptimizationModule,
    SalaryConfigModule,
    LaborCost1Module,
    // Module đồng bộ Google Sheets định kỳ
    GoogleSyncModule,
    // Health check endpoint
    HealthModule,
    // Module báo cáo lợi nhuận nhóm quảng cáo
    AdGroupProfitModule,
    // Module báo cáo lợi nhuận sản phẩm theo ngày
    ProductProfitReportModule,
    // Module báo cáo lợi nhuận của Quảng Cáo theo ngày
    AdGroupProfitReportModule,
    SessionLogModule,
    // Chatbot & AI subsystem modules
    FanpageModule,
    OpenAIConfigModule,
    ApiTokenModule,
    ChatMessageModule,
    PendingOrderModule,
    ProfitForecastModule,

    // Media management module (server-side image storage)
    MediaModule,
    // Module cập nhật thông tin đơn hàng từ Excel
    OrderUpdateModule,
    // Module quản lý nhập hàng (Purchase Orders)
    PurchaseOrderModule,
    // Module công nợ nhà cung cấp
    SupplierPayableModule,
    // Module quản lý kho & WAC
    InventoryModule,
    // Module báo cáo hiệu quả quảng cáo (chi phí / đơn theo ad group)
    AdReportModule,
    // Module báo cáo hàng hoàn (ad group / sản phẩm)
    ReturnReportModule,
    FinanceModule,
    // Compatibility modules (lightweight stubs)
    Summary4Module,
    Summary5Module,
    TestOrder2Module,
  ],
  controllers: [], // Không có controllers ở level app, chỉ có ở modules con
  providers: [],   // Không có providers chung ở level app
})
export class AppModule { }
