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
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { ScheduleModule } from '@nestjs/schedule';
import { AdAccountModule } from './ad-account/ad-account.module';
import { AdGroupModule } from './ad-group/ad-group.module';
import { AdvertisingCostModule } from './advertising-cost/advertising-cost.module';
import { AdvertisingCostPublicModule } from './advertising-cost-public/advertising-cost-public.module';
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
import { ProductModule } from './product/product.module';
import { ProductionStatusModule } from './production-status/production-status.module';
import { QuoteModule } from './quote/quote.module';
import { SalaryConfigModule } from './salary-config/salary-config.module';
import { SessionLogModule } from './session-log/session-log.module';
import { TestOrder2Module } from './test-order2/test-order2.module';
import { UserModule } from './user/user.module';
// Chatbot & AI related modules
import { FanpageModule } from './fanpage/fanpage.module';
import { OpenAIConfigModule } from './openai-config/openai-config.module';
import { ApiTokenModule } from './api-token/api-token.module';
import { ChatMessageModule } from './chat-message/chat-message.module';
import { PendingOrderModule } from './pending-order/pending-order.module';
// TODO: Rebuild from OrderTest2 - Will create new forecasting with different data source and rules
// import { ProfitForecastModule } from './profit-forecast/profit-forecast.module';

import { MediaModule } from './media/media.module';
import { OrderUpdateModule } from './order-update/order-update.module';
import { AdReportModule } from './ad-report/ad-report.module';
import { ReturnReportModule } from './return-report/return-report.module';
import { SupplierPayableModule } from './supplier-payable/supplier-payable.module';
import { FinanceModule } from './finance/finance.module';
import { ReturnRequestModule } from './return-request/return-request.module';
import { SupplierQuoteModule } from './supplier-quote/supplier-quote.module';
import { AgentReceivableModule } from './agent-receivable/agent-receivable.module';
import { AdGroupProfitReportModule } from './ad-group-profit-report/ad-group-profit-report.module';
import { OrderSheetSyncModule } from './order-sheet-sync/order-sheet-sync.module';
import { EmployeeAdsKpiModule } from './employee-ads-kpi/employee-ads-kpi.module';
import { AdsAlertsModule } from './ads-alerts/ads-alerts.module';
import { CashflowControlModule } from './cashflow-control/cashflow-control.module';
import { OwnerFundModule } from './owner-fund/owner-fund.module';
import { EmergencyActionModule } from './emergency-action/emergency-action.module';

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
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URI') ||
          'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';
        console.log('MongoDB connecting to:', uri.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@'));
        return {
          uri,
          connectionFactory: (connection) => {
            connection.on('connected', () => {
              console.log('MongoDB connected with UTF-8 support');
            });
            return connection;
          },
        };
      },
      inject: [ConfigService],
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
    AdvertisingOptimizationModule,
    SalaryConfigModule,
    LaborCost1Module,
    // Module đồng bộ Google Sheets định kỳ
    GoogleSyncModule,
    // Health check endpoint
    HealthModule,
    SessionLogModule,
    // Chatbot & AI subsystem modules
    FanpageModule,
    OpenAIConfigModule,
    ApiTokenModule,
    ChatMessageModule,
    PendingOrderModule,
    // TODO: Rebuild from OrderTest2 - Will create new forecasting with different data source and rules
    // ProfitForecastModule,

    // Media management module (server-side image storage)
    MediaModule,
    // Module cập nhật thông tin đơn hàng từ Excel
    OrderUpdateModule,
    // Module công nợ nhà cung cấp
    SupplierPayableModule,
    // Module công nợ đại lý
    AgentReceivableModule,
    SupplierQuoteModule,
    // Module báo cáo hiệu quả quảng cáo (chi phí / đơn theo ad group)
    AdReportModule,
    // Module báo cáo hàng hoàn (ad group / sản phẩm)
    ReturnReportModule,
    ReturnRequestModule,
    FinanceModule,
    TestOrder2Module,
    AdGroupProfitReportModule,
    // Module đồng bộ đơn hàng lên Google Sheets của Đại lý và Nhà cung cấp
    OrderSheetSyncModule,
    // Module KPI nhân viên quản lý Ads
    EmployeeAdsKpiModule,
    // Module Real-time Ads Alerts
    AdsAlertsModule,
    // Module Cashflow Control System
    CashflowControlModule,
    // Module Owner Fund Management (Quản lý Quỹ Owner & Phiếu Rút Tiền)
    OwnerFundModule,
    // Module Emergency Action Logs (trạng thái task khẩn cấp Ads, verification, cảnh báo quá hạn)
    EmergencyActionModule,
  ],
  controllers: [], // Không có controllers ở level app, chỉ có ở modules con
  providers: [],   // Không có providers chung ở level app
})
export class AppModule { }
