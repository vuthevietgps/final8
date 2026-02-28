/**
 * File: app/app.routes.ts
 * Mục đích: Định nghĩa route của ứng dụng với authentication guards và permissions.
 */
import { Routes } from '@angular/router';
import { MediaReportComponent } from './features/media/media-report.component';
import { AuthGuard } from './core/guards/auth.guard';
import { GuestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  // Trailing-slash redirects to avoid dev-proxy collisions with /media/
  { path: 'media/', redirectTo: 'media', pathMatch: 'full' },
  { path: 'media-report/', redirectTo: 'media-report', pathMatch: 'full' },
  // Authentication routes
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [GuestGuard]
  },
  {
    path: 'loans',
    canActivate: [AuthGuard],
    data: { permissions: ['finance'] },
    // Tạm thời mở cho tất cả; sẽ phân quyền sau
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/loan/loan-dashboard.component').then(m => m.LoanDashboardComponent) },
      { path: 'new', loadComponent: () => import('./features/loan/loan-form.component').then(m => m.LoanFormComponent) },
      { path: ':id/pay', loadComponent: () => import('./features/loan/loan-payment.component').then(m => m.LoanPaymentComponent) },
      { path: ':id', loadComponent: () => import('./features/loan/loan-detail.component').then(m => m.LoanDetailComponent) },
    ]
  },
  {
    path: 'finance',
    canActivate: [AuthGuard],
    data: { permissions: ['finance'] },
    children: [
      { path: 'financial-control', loadComponent: () => import('./features/finance/financial-control/financial-control.component').then(m => m.FinancialControlComponent) },
      { path: 'available-funds', loadComponent: () => import('./features/finance/available-funds.component').then(m => m.AvailableFundsComponent) },
      { path: 'budget-allocation', loadComponent: () => import('./features/finance/budget-allocation.component').then(m => m.BudgetAllocationComponent) },
      { path: 'capital-allocation', loadComponent: () => import('./features/finance/capital-allocation.component').then(m => m.CapitalAllocationComponent) },
      { path: 'capital-flow', loadComponent: () => import('./features/finance/capital-flow.component').then(m => m.CapitalFlowComponent) },
      { path: 'ad-group-daily-report', loadComponent: () => import('./features/finance/ad-group-daily-report.component').then(m => m.AdGroupDailyReportComponent) },
      { path: '', redirectTo: 'financial-control', pathMatch: 'full' },
    ]
  },
  {
    path: 'purchases',
    canActivate: [AuthGuard],
    data: { permissions: ['purchase-costs'] },
    children: [
      { path: 'payables', loadComponent: () => import('./features/supplier-payable/supplier-payable.component').then(m => m.SupplierPayableComponent) },
      { path: '', redirectTo: 'payables', pathMatch: 'full' }
    ]
  },
  {
    path: 'payments',
    canActivate: [AuthGuard],
    children: [
      { path: 'supplier', loadComponent: () => import('./features/payment-management/supplier-payment.component').then(m => m.SupplierPaymentComponent) },
      { path: 'agent', loadComponent: () => import('./features/payment-management/agent-payment.component').then(m => m.AgentPaymentComponent) },
      { path: '', redirectTo: 'supplier', pathMatch: 'full' }
    ]
  },
  {
    path: 'suppliers',
    loadComponent: () => import('./features/supplier/supplier.component').then(m => m.SupplierComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['users'] }
  },
  {
    path: 'supplier-quotes',
    loadComponent: () => import('./features/supplier-quote/supplier-quote.component').then(m => m.SupplierQuoteComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['purchase-costs'] }
  },
  {
    path: 'fanpages',
    loadComponent: () => import('./features/fanpage/fanpage.component').then(m => m.FanpageComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['fanpages'] }
  },
  {
    path: 'openai-configs',
    loadComponent: () => import('./features/openai-config/openai-config.component').then(m => m.OpenAIConfigComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['openai-configs'] }
  },
  {
    path: 'api-tokens',
    loadComponent: () => import('./features/api-token/api-token.component').then(m => m.ApiTokenComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['api-tokens'] }
  },
  {
    path: 'ads-settings',
    loadComponent: () => import('./features/ads-settings/ads-settings.component').then(m => m.AdsSettingsComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['api-tokens'] }
  },
  {
    path: 'conversations',
    loadComponent: () => import('./features/chat-message/conversation-list.component').then(m => m.ConversationListComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['chat-messages'] }
  },
  {
    path: 'unauthorized',
    loadComponent: () => import('./features/auth/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent)
  },
  {
    path: 'clear-storage',
    loadComponent: () => import('./features/clear-storage/clear-storage.component').then(m => m.ClearStorageComponent)
  },
  // Ngân sách Ads - Standalone menu for Manager/Director
  {
    path: 'ads-budget',
    loadComponent: () => import('./features/ads-budget/ads-budget.component').then(m => m.AdsBudgetComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['ads-budget'] }
  },
  // Owner Fund Management - Director/Manager only
  {
    path: 'owner-fund',
    loadComponent: () => import('./features/owner-fund/owner-fund.component').then(m => m.OwnerFundComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['owner-fund'] }
  },
  // KPI Nhân viên Ads - Manager/Director only
  {
    path: 'employee-ads-kpi',
    loadComponent: () => import('./features/employee-ads-kpi/employee-ads-kpi.component').then(m => m.EmployeeAdsKpiComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['employee-ads-kpi'] }
  },
  
  // Dashboard (default after login)
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [AuthGuard]
  },
  
  // Protected routes
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'users',
    loadChildren: () => import('./features/user/user.routes').then(m => m.userRoutes),
    canActivate: [AuthGuard],
    data: { permissions: ['users'] }
  },
  {
    path: 'production-status',
    loadComponent: () => import('./features/production-status/production-status.component').then(m => m.ProductionStatusComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['production-status'] }
  },
  {
    path: 'orders',
    canActivate: [AuthGuard],
    data: { permissions: ['orders'] },
    children: [
      { path: 'test2', loadComponent: () => import('./features/test-order2/test-order2.component').then(m => m.TestOrder2Component) },
      { path: 'update', loadComponent: () => import('./features/order-update/order-update.component').then(m => m.OrderUpdateComponent) },
      { path: 'google-sheet-sync', loadComponent: () => import('./features/google-sheet-sync/google-sheet-sync.component').then(m => m.GoogleSheetSyncComponent) },
      { path: '', loadComponent: () => import('./features/order-status/order-status.component').then(m => m.OrderStatusComponent) }
    ]
  },
  {
    path: 'delivery-status',
    loadComponent: () => import('./features/delivery-status/delivery-status.component').then(m => m.DeliveryStatusComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['delivery-status'] }
  },
  {
    path: 'product-category',
    loadComponent: () => import('./features/product-category/product-category.component').then(m => m.ProductCategoryComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['product-categories'] }
  },
  {
    path: 'product',
    loadComponent: () => import('./features/product/product.component').then(m => m.ProductComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['products'] }
  },
  {
    path: 'media',
    loadComponent: () => import('./features/media/media-manager.component').then(m => m.MediaManagerComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['media'] }
  },
  {
    path: 'media-report',
    loadComponent: () => Promise.resolve(MediaReportComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['media'] }
  },
  {
    path: 'customer',
    loadComponent: () => import('./features/customer/customer.component').then(m => m.CustomerComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['customers'] }
  },
  {
    path: 'quotes',
    loadComponent: () => import('./features/quote/quote.component').then(m => m.QuoteComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['quotes'] }
  },
  {
    path: 'agents',
    loadComponent: () => import('./features/agent/agent-list.component').then(m => m.AgentListComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['users'] }
  },
  {
    path: 'agents/receivables',
    loadComponent: () => import('./features/agent-receivable/agent-receivable.component').then(m => m.AgentReceivableComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['quotes'] }
  },
  {
    path: 'customers',
    loadComponent: () => import('./features/customer/customer.component').then(m => m.CustomerComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['customers'] }
  },
  {
    path: 'ad-groups',
    loadComponent: () => import('./features/ad-group/ad-group.component').then(m => m.AdGroupComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['ad-groups'] }
  },
  {
    path: 'ad-accounts',
    loadComponent: () => import('./features/ad-account/ad-account.component').then(m => m.AdAccountComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['ad-accounts'] }
  },
  {
    path: 'ad-group-counts',
    loadComponent: () => import('./features/ad-group-counts/ad-group-counts.component').then(m => m.AdGroupCountsComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['ad-groups'] }
  },

  {
    path: 'costs',
    children: [
      // Canonical route: /costs/advertising - Updated to use main AdvertisingCostComponent with Excel upload
      { path: 'advertising', loadComponent: () => import('./features/advertising-cost/advertising-cost.component').then(m => m.AdvertisingCostComponent), canActivate: [AuthGuard], data: { permissions: ['advertising-costs'] } },
      // Backward-compatible alias: redirect old path to the new one
      { path: 'advertising2', redirectTo: 'advertising', pathMatch: 'full' },
      { path: 'labor1', loadComponent: () => import('./features/labor-cost1/labor-cost1.component').then(m => m.LaborCost1Component), canActivate: [AuthGuard], data: { permissions: ['labor-costs'] } },
      { path: 'other', loadComponent: () => import('./features/other-cost/other-cost.component').then(m => m.OtherCostComponent), canActivate: [AuthGuard], data: { permissions: ['other-costs'] } },
      { path: 'salary', loadComponent: () => import('./features/salary-config/salary-config.component').then(m => m.SalaryConfigComponent), canActivate: [AuthGuard], data: { permissions: ['salary-config'] } },
      {
        path: ':type',
        loadComponent: () => import('./core/components/coming-soon.component').then(m => m.ComingSoonComponent),
        data: { prerender: false }
      },
      {
        path: '',
        redirectTo: 'other',
        pathMatch: 'full'
  },
    ]
  },
  {
    path: 'profit',
    loadComponent: () => import('./core/components/coming-soon.component').then(m => m.ComingSoonComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['reports'] }
  },
  {
    path: 'reports',
    canActivate: [AuthGuard],
    data: { permissions: ['reports'] },
    children: [
      { path: 'return-report', loadComponent: () => import('./features/return-report/return-report.component').then(m => m.ReturnReportComponent) },
      { path: 'daily-profit', loadComponent: () => import('./features/daily-profit-report/daily-profit-report.component').then(m => m.DailyProfitReportComponent) },
      { path: 'product-profit', loadComponent: () => import('./features/product-profit-report/product-profit-report.component').then(m => m.ProductProfitReportComponent) },
      { path: '', redirectTo: 'return-report', pathMatch: 'full' }
    ]
  },

  {
    path: 'settings',
    loadComponent: () => import('./core/components/coming-soon.component').then(m => m.ComingSoonComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['settings'] }
  },
  {
    path: '**',
    redirectTo: '/users'
  }
];
