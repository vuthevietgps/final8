"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const path = require("path");
const mongoose_1 = require("@nestjs/mongoose");
const platform_express_1 = require("@nestjs/platform-express");
const schedule_1 = require("@nestjs/schedule");
const ad_account_module_1 = require("./ad-account/ad-account.module");
const ad_group_profit_report_module_1 = require("./ad-group-profit-report/ad-group-profit-report.module");
const ad_group_profit_module_1 = require("./ad-group-profit/ad-group-profit.module");
const ad_group_module_1 = require("./ad-group/ad-group.module");
const advertising_cost_module_1 = require("./advertising-cost/advertising-cost.module");
const advertising_cost_public_module_1 = require("./advertising-cost-public/advertising-cost-public.module");
const advertising_cost_suggestion_module_1 = require("./advertising-cost-suggestion/advertising-cost-suggestion.module");
const advertising_optimization_module_1 = require("./advertising-optimization/advertising-optimization.module");
const auth_module_1 = require("./auth/auth.module");
const customer_module_1 = require("./customer/customer.module");
const delivery_status_module_1 = require("./delivery-status/delivery-status.module");
const export_user_module_1 = require("./export-user/export-user.module");
const google_sync_module_1 = require("./google-sync/google-sync.module");
const health_module_1 = require("./health/health.module");
const import_user_module_1 = require("./import-user/import-user.module");
const labor_cost1_module_1 = require("./labor-cost1/labor-cost1.module");
const order_status_module_1 = require("./order-status/order-status.module");
const other_cost_module_1 = require("./other-cost/other-cost.module");
const product_category_module_1 = require("./product-category/product-category.module");
const product_profit_report_module_1 = require("./product-profit-report/product-profit-report.module");
const product_module_1 = require("./product/product.module");
const production_status_module_1 = require("./production-status/production-status.module");
const quote_module_1 = require("./quote/quote.module");
const salary_config_module_1 = require("./salary-config/salary-config.module");
const session_log_module_1 = require("./session-log/session-log.module");
const summary4_module_1 = require("./summary4/summary4.module");
const summary5_module_1 = require("./summary5/summary5.module");
const test_order2_module_1 = require("./test-order2/test-order2.module");
const user_module_1 = require("./user/user.module");
const fanpage_module_1 = require("./fanpage/fanpage.module");
const openai_config_module_1 = require("./openai-config/openai-config.module");
const api_token_module_1 = require("./api-token/api-token.module");
const chat_message_module_1 = require("./chat-message/chat-message.module");
const pending_order_module_1 = require("./pending-order/pending-order.module");
const profit_forecast_module_1 = require("./profit-forecast/profit-forecast.module");
const media_module_1 = require("./media/media.module");
const order_update_module_1 = require("./order-update/order-update.module");
const purchase_order_module_1 = require("./purchase/purchase-order.module");
const inventory_module_1 = require("./inventory/inventory.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: [
                    '.env',
                    path.resolve(process.cwd(), '.env'),
                    path.resolve(process.cwd(), 'backend', '.env'),
                    path.resolve(__dirname, '..', '.env'),
                    path.resolve(__dirname, '..', '..', '.env'),
                ],
                ignoreEnvFile: false,
            }),
            schedule_1.ScheduleModule.forRoot(),
            platform_express_1.MulterModule.register({
                dest: './uploads',
                limits: {
                    fileSize: 10 * 1024 * 1024,
                },
            }),
            mongoose_1.MongooseModule.forRoot(process.env.MONGODB_URI, {
                connectionFactory: (connection) => {
                    connection.on('connected', () => {
                        console.log('MongoDB connected with UTF-8 support');
                    });
                    return connection;
                },
            }),
            auth_module_1.AuthModule,
            user_module_1.UserModule,
            export_user_module_1.ExportUserModule,
            import_user_module_1.ImportUserModule,
            production_status_module_1.ProductionStatusModule,
            order_status_module_1.OrderStatusModule,
            delivery_status_module_1.DeliveryStatusModule,
            product_category_module_1.ProductCategoryModule,
            product_module_1.ProductModule,
            customer_module_1.CustomerModule,
            quote_module_1.QuoteModule,
            ad_group_module_1.AdGroupModule,
            ad_account_module_1.AdAccountModule,
            other_cost_module_1.OtherCostModule,
            test_order2_module_1.TestOrder2Module,
            advertising_cost_module_1.AdvertisingCostModule,
            advertising_cost_public_module_1.AdvertisingCostPublicModule,
            advertising_cost_suggestion_module_1.AdvertisingCostSuggestionModule,
            advertising_optimization_module_1.AdvertisingOptimizationModule,
            salary_config_module_1.SalaryConfigModule,
            summary4_module_1.Summary4Module,
            summary5_module_1.Summary5Module,
            labor_cost1_module_1.LaborCost1Module,
            google_sync_module_1.GoogleSyncModule,
            health_module_1.HealthModule,
            ad_group_profit_module_1.AdGroupProfitModule,
            product_profit_report_module_1.ProductProfitReportModule,
            ad_group_profit_report_module_1.AdGroupProfitReportModule,
            session_log_module_1.SessionLogModule,
            fanpage_module_1.FanpageModule,
            openai_config_module_1.OpenAIConfigModule,
            api_token_module_1.ApiTokenModule,
            chat_message_module_1.ChatMessageModule,
            pending_order_module_1.PendingOrderModule,
            profit_forecast_module_1.ProfitForecastModule,
            media_module_1.MediaModule,
            order_update_module_1.OrderUpdateModule,
            purchase_order_module_1.PurchaseOrderModule,
            inventory_module_1.InventoryModule,
        ],
        controllers: [],
        providers: [],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map
