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
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'path';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AdAccountModule } from './ad-account/ad-account.module';
import { AdGroupModule } from './ad-group/ad-group.module';
import { AdvertisingCostModule } from './advertising-cost/advertising-cost.module';
import { AdvertisingCostPublicModule } from './advertising-cost-public/advertising-cost-public.module';
import { AdvertisingOptimizationModule } from './advertising-optimization/advertising-optimization.module';
import { AdsManagerAccountModule } from './ads-manager-account/ads-manager-account.module';
import { AuthModule } from './auth/auth.module';
import { CustomerModule } from './customer/customer.module';
import { DeliveryStatusModule } from './delivery-status/delivery-status.module';
import { ExportUserModule } from './export-user/export-user.module';
import { GoogleSyncModule } from './google-sync/google-sync.module';
import { GoogleAdsModule } from './google-ads/google-ads.module';
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
import { PurchaseOrderModule } from './purchase/purchase-order.module';
import { AgentReceivableModule } from './agent-receivable/agent-receivable.module';
import { AdGroupProfitReportModule } from './ad-group-profit-report/ad-group-profit-report.module';
import { OrderSheetSyncModule } from './order-sheet-sync/order-sheet-sync.module';
import { EmployeeAdsKpiModule } from './employee-ads-kpi/employee-ads-kpi.module';
import { AdsAlertsModule } from './ads-alerts/ads-alerts.module';
import { CashflowControlModule } from './cashflow-control/cashflow-control.module';
import { OwnerFundModule } from './owner-fund/owner-fund.module';
import { EmergencyActionModule } from './emergency-action/emergency-action.module';
import { OpsActionModule } from './ops-action/ops-action.module';
import { AiOperatorModule } from './ai-operator/ai-operator.module';
import { AiMarketingModule } from './ai-marketing/ai-marketing.module';
import { AiDataPackModule } from './ai-data-pack/ai-data-pack.module';
import { AdsAutomationEvidenceModule } from './ads-automation-evidence/ads-automation-evidence.module';
import { AdsBusinessContextModule } from './ads-business-context/ads-business-context.module';
import { PlanModule } from './plan/plan.module';
import { FeatureGateGuard } from './plan/feature-gate.guard';
import { redactSecretString } from './common/utils/secret-redaction.util';


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

    // Phase 3: Event-driven architecture — các domain module emit finance events
    // thay vì gọi trực tiếp FinancialControlService (loại bỏ forwardRef circular deps)
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.', global: true }),

    // Global Cache (Redis nếu REDIS_URL được cấu hình, ngược lại in-memory)
    // Giải quyết Issue 3: multi-pod cache inconsistency.
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): any => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl) {
          return {
            stores: [createKeyv(redisUrl)],
            ttl: 30_000, // milliseconds -- default TTL, overridable per-call
          };
        }
        // Fallback: in-process memory cache (dev / single-pod environments)
        return { ttl: 30_000 };
      },
      inject: [ConfigService],
    }),

    // Cấu hình multer cho upload file
    MulterModule.register({
      dest: './uploads',
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),

    // Kết nối MongoDB (ưu tiên MONGODB_URI từ môi trường; fallback local MongoDB)
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const directUri = configService.get<string>('MONGODB_URI')?.trim();
        const host = configService.get<string>('DATABASE_HOST');
        const port = configService.get<string>('DATABASE_PORT');
        const name = configService.get<string>('DATABASE_NAME');

        const uri = directUri || (host && port && name ? `mongodb://${host}:${port}/${name}` : undefined);

        if (!uri) {
          throw new Error('Missing database configuration. Set MONGODB_URI or DATABASE_HOST, DATABASE_PORT, DATABASE_NAME.');
        }

        console.log('MongoDB connecting to:', redactSecretString(uri));
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
    AdsManagerAccountModule,
    // Module Public API cho Advertising Cost (không cần authentication)
    AdvertisingCostPublicModule,
    AdvertisingOptimizationModule,
    SalaryConfigModule,
    LaborCost1Module,
    // Module đồng bộ Google Sheets định kỳ
    GoogleSyncModule,
    // Google Ads V2 provider-scoped metadata collections. Does not replace legacy adgroups.
    GoogleAdsModule,
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
    PurchaseOrderModule,
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
    // Module Ops Action (hành động khẩn cấp vận hành: NCC, đại lý, đơn hàng)
    OpsActionModule,
    AiOperatorModule,
    AiMarketingModule,
    AiDataPackModule,
    AdsAutomationEvidenceModule,
    AdsBusinessContextModule,
    // Module Plan - Quản lý gói dịch vụ (Starter/Professional/Enterprise)
    PlanModule,
  ],
  controllers: [],
  providers: [
    // Global guard: kiểm tra module có được phép theo gói hay không
    { provide: APP_GUARD, useClass: FeatureGateGuard },
  ],
})
export class AppModule { }
