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
    path: 'purchases',
    canActivate: [AuthGuard],
    data: { permissions: ['purchase-costs'] },
    children: [
      { path: '', loadComponent: () => import('./features/purchase/purchase-list.component').then(m => m.PurchaseListComponent) },
      { path: 'new', loadComponent: () => import('./features/purchase/purchase-form.component').then(m => m.PurchaseFormComponent) },
      { path: ':id', loadComponent: () => import('./features/purchase/purchase-form.component').then(m => m.PurchaseFormComponent) },
      { path: ':id/receive', loadComponent: () => import('./features/purchase/purchase-receive.component').then(m => m.PurchaseReceiveComponent) }
    ]
  },
  {
    path: 'inventory',
    canActivate: [AuthGuard],
    data: { permissions: ['purchase-costs'] }, // assumption: same permission group as purchases
    children: [
      { path: '', loadComponent: () => import('./features/inventory/inventory-list.component').then(m => m.InventoryListComponent) },
      { path: ':productId', loadComponent: () => import('./features/inventory/inventory-detail.component').then(m => m.InventoryDetailComponent) }
    ]
  },
  {
    path: 'suppliers',
    loadComponent: () => import('./features/supplier/supplier.component').then(m => m.SupplierComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['users'] }
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
    path: 'advertising-cost-suggestion',
    loadComponent: () => import('./features/advertising-cost-suggestion/advertising-cost-suggestion.component').then(m => m.AdvertisingCostSuggestionComponent),
    canActivate: [AuthGuard],
    data: { permissions: ['advertising-costs'] }
  },

  {
    path: 'costs',
    children: [
      // Canonical route: /costs/advertising - Updated to use main AdvertisingCostComponent with Excel upload
      { path: 'advertising', loadComponent: () => import('./features/advertising-cost/advertising-cost.component').then(m => m.AdvertisingCostComponent), canActivate: [AuthGuard], data: { permissions: ['advertising-costs'] } },
      // Backward-compatible alias: redirect old path to the new one
      { path: 'advertising2', redirectTo: 'advertising', pathMatch: 'full' },
      { path: 'labor1', loadComponent: () => import('./features/labor-cost1/labor-cost1.component').then(m => m.LaborCost1Component), canActivate: [AuthGuard], data: { permissions: ['labor-costs'] } },
  { path: 'purchase', loadComponent: () => import('./core/components/coming-soon.component').then(m => m.ComingSoonComponent), canActivate: [AuthGuard], data: { permissions: ['purchase-costs'] } },
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
      { path: 'ad-group-profit', loadComponent: () => import('./features/ad-group-profit/ad-group-profit.component').then(m => m.AdGroupProfitComponent) },
      { path: 'ad-group-profit-report', loadComponent: () => import('./features/ad-group-profit-report/ad-group-profit-report.component').then(m => m.AdGroupProfitReportComponent) },
      { path: 'profit-forecast', loadComponent: () => import('./features/profit-forecast/profit-forecast.component').then(m => m.ProfitForecastComponent) },
      // Summary1 & Summary2 removed - replaced by Summary4 & Summary5
      { path: 'summary4', loadComponent: () => import('./features/summary4/summary4.component').then(m => m.Summary4Component) },
  { path: 'summary5', loadComponent: () => import('./features/summary5/summary5.component').then(m => m.Summary5Component) },
      { path: 'product-profit', loadComponent: () => import('./features/product-profit-report/product-profit-report.component').then(m => m.ProductProfitReportComponent) },
  { path: '', redirectTo: 'ad-group-profit-report', pathMatch: 'full' }
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
