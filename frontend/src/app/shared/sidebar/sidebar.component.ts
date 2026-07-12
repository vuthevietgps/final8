﻿﻿﻿﻿import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";
import { AuthService } from "../../core/services/auth.service";
import { ThemeService } from "../../core/services/theme.service";
import { PlanService } from "../../core/services/plan.service";
import { AdsAlertsComponent } from "../../features/ads-alerts/ads-alerts.component";

interface MenuItem {
  icon: string;
  label: string;
  route: string;
  children?: MenuItem[];
}

@Component({
  selector: "app-sidebar",
  standalone: true,
  imports: [CommonModule, RouterModule, AdsAlertsComponent],
  templateUrl: "./sidebar.component.html",
  styleUrls: ["./sidebar.component.css"]
})
export class SidebarComponent implements OnInit {
  constructor(
    public authService: AuthService,
    public themeService: ThemeService,
    public planService: PlanService
  ) { }

  isCollapsed = false;

  ngOnInit(): void {
    // Load plan info để biết modules nào được phép
    this.planService.loadPlanInfo();

    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      if (saved === '1') {
        this.isCollapsed = true;
        document.body.classList.add('sidebar-collapsed');
      }
    } catch {}
  }

  menuItems: MenuItem[] = [
    {
      icon: "🧭",
      label: "Trợ Lý Quản Trị",
      route: "/ai-assistant"
    },
    {
      icon: "👥",
      label: "Quản Lý Người Dùng",
      route: "/users",
      children: [
        { icon: "👥", label: "Người Dùng", route: "/users" },
        { icon: "💵", label: "Cấu Hình Lương", route: "/costs/salary" }
      ]
    },
    // Supplier-focused menu (no inbound purchasing / inventory)
    {
      icon: "🤝",
      label: "Nhà Cung Cấp",
      route: "/suppliers",
      children: [
        { icon: "🏭", label: "Nhà Cung Cấp", route: "/suppliers" },
        { icon: "📑", label: "Báo giá NCC", route: "/supplier-quotes" },
        { icon: "💸", label: "Thanh Toán NCC", route: "/payments/supplier" }
      ]
    },
    {
      icon: "🏢",
      label: "Đại Lý",
      route: "/agents",
      children: [
        { icon: "📋", label: "Danh Sách Đại Lý", route: "/agents" },
        { icon: "📊", label: "Báo Giá Đại Lý", route: "/quotes" },
        { icon: "💰", label: "Hoa Hồng Đại Lý", route: "/payments/agent" }
      ]
    },
    {
      icon: "📦",
      label: "Quản Lý Đơn Hàng",
      route: "/orders",
      children: [
        { icon: "🧪", label: "Đơn Hàng Thử Nghiệm 2", route: "/orders/test2" },
        { icon: "📝", label: "Cập nhật thông tin đơn hàng", route: "/orders/update" },
        { icon: "📊", label: "Sync Google Sheets", route: "/orders/google-sheet-sync" }
      ]
    },
    {
      icon: "🤝",
      label: "Quản Lý Khách Hàng",
      route: "/customers"
    },
    {
      icon: "🛍️",
      label: "Sản Phẩm",
      route: "/products",
      children: [
        { icon: "📦", label: "Nhóm Sản Phẩm", route: "/product-category" },
        { icon: "🛍️", label: "Quản Lý Sản Phẩm", route: "/product" },
        { icon: "📊", label: "Tồn Kho", route: "/inventory" },
        { icon: "📷", label: "Media", route: "/media" },
        { icon: "📊", label: "Báo cáo ảnh sản phẩm", route: "/media-report" }
      ]
    },
    // 📢 Ngân Sách Ads - Menu riêng cho Manager/Director
    {
      icon: "💸",
      label: "Ngân Sách Ads",
      route: "/ads-budget"
    },
    // 📊 KPI Nhân Viên Ads - Menu riêng cho Manager/Director
    {
      icon: "📊",
      label: "KPI Nhân Viên Ads",
      route: "/employee-ads-kpi"
    },
    {
      icon: "📘",
      label: "Sổ Tay Manager",
      route: "/manager-handbook"
    },
    {
      icon: "📢",
      label: "Quảng Cáo",
      route: "/advertising",
      children: [
        { icon: "🎯", label: "Tài Khoản Quảng Cáo", route: "/ad-accounts" },
        { icon: "📊", label: "Nhóm Quảng Cáo", route: "/ad-groups" },
        { icon: "💰", label: "Chi Phí Quảng Cáo", route: "/costs/advertising" },
        { icon: "⚙️", label: "Cài Đặt Ads", route: "/ads-settings" },
        { icon: "📝", label: "Ngữ Cảnh Kinh Doanh Ads", route: "/ads-business-context" },
        { icon: "🔑", label: "Token API Ads", route: "/api-tokens" },
        { icon: "📊📊", label: "Đề xuất SL nhóm quảng cáo theo SP", route: "/ad-group-counts" }
      ]
    },
    {
      icon: "🤖",
      label: "AI & Chat",
      route: "/ai",
      children: [
        { icon: "📈", label: "AI Marketing", route: "/ai-marketing" },
        { icon: "EV", label: "Bằng Chứng Duyệt Ads", route: "/ai/ads-approval-evidence-reviewer" },
        { icon: "FD", label: "Tài Liệu Nền Ads", route: "/ai/ads-foundation-reviewer-docs" },
        { icon: "SS", label: "Trạng Thái Nguồn Ads", route: "/ai/ads-platform-source-sync-status-reviewer" },
        { icon: "📘", label: "Fanpage", route: "/fanpages" },
        { icon: "⚙️", label: "API Key & Prompt AI", route: "/openai-configs" },
        { icon: "💬", label: "Hội Thoại", route: "/conversations" },
        { icon: "🔐", label: "Token API Ads", route: "/api-tokens" }
      ]
    },
    {
      icon: "💰",
      label: "Chi Phí",
      route: "/costs",
      children: [
        { icon: "🧑‍🏭", label: "Chi Phí Nhân Công 1", route: "/costs/labor1" },
        { icon: "💸", label: "Chi Phí Khác", route: "/costs/other" }
      ]
    },
    {
      icon: "💳",
      label: "Tài chính",
      route: "/finance",
      children: [
        { icon: "🎛️", label: "Financial Control", route: "/finance/financial-control" },
        { icon: "🪣", label: "Budget Buckets", route: "/finance/budget-buckets" },
        { icon: "💼", label: "Quỹ Owner", route: "/owner-fund" },
        { icon: "📊", label: "Chi Phí & Lợi Nhuận Nhóm QC", route: "/finance/ad-group-daily-report" },
{ icon: "💳", label: "Quản lý khoản vay", route: "/loans" }
      ]
    },
    // Việc cần làm vận hành (NCC, Đại lý, Đơn hàng)
    {
      icon: "🔥",
      label: "Việc Cần Làm",
      route: "/ops-actions"
    },
    // Cấu hình lương đã được đưa vào nhóm Quản Lý Người Dùng ở trên
    {
      icon: "🔄",
      label: "Quản Lý Trạng Thái",
      route: "/status",
      children: [
        { icon: "🏭", label: "Trạng Thái Sản Xuất", route: "/production-status" },
        { icon: "🚚", label: "Trạng Thái Giao Hàng", route: "/delivery-status" }
      ]
    },
    {
      icon: "�",
      label: "Lợi Nhuận",
      route: "/profit",
      children: [
        { icon: "📋", label: "Báo Cáo Lợi Nhuận Hàng Ngày", route: "/reports/daily-profit" },
        { icon: "🔁", label: "Báo Cáo Hàng Hoàn", route: "/reports/return-report" },
        { icon: "📅", label: "Lợi Nhuận Sản Phẩm Theo Ngày", route: "/reports/product-profit" }
      ]
    },

    {
      icon: "⚙️",
      label: "Cài Đặt",
      route: "/settings"
    }
  ];

  expandedItems: Set<string> = new Set();

  toggleExpanded(route: string): void {
    if (this.expandedItems.has(route)) {
      this.expandedItems.delete(route);
    } else {
      this.expandedItems.add(route);
    }
  }

  isExpanded(route: string): boolean {
    return this.expandedItems.has(route);
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
    if (this.isCollapsed) {
      this.expandedItems.clear();
    }
    try {
      const cls = 'sidebar-collapsed';
      if (this.isCollapsed) {
        document.body.classList.add(cls);
        localStorage.setItem('sidebarCollapsed', '1');
      } else {
        document.body.classList.remove(cls);
        localStorage.setItem('sidebarCollapsed', '0');
      }
    } catch {}
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  // Mapping route → featureModule (dùng cho plan-based access)
  private readonly routeFeatureMap: Record<string, string> = {
    "/orders/test2": "test-order2",
    "/orders/update": "order-update",
    "/orders/google-sheet-sync": "order-sheet-sync",
    "/ad-groups": "ad-group",
    "/ad-group-counts": "ad-group",
    "/costs/advertising": "advertising-cost",
    "/ads-budget": "employee-ads-kpi",
    "/employee-ads-kpi": "employee-ads-kpi",
    "/manager-handbook": "employee-ads-kpi",
    "/supplier-quotes": "supplier-quote",
    "/inventory": "inventory",
    "/payments/supplier": "supplier-payable",
    "/payments/agent": "agent-receivable",
    "/finance/financial-control": "finance",
    "/finance/available-funds": "finance",
    "/finance/budget-allocation": "finance",
    "/finance/budget-buckets": "finance",
    "/finance/capital-allocation": "finance",
    "/finance/ad-group-daily-report": "finance",
    "/loans": "finance",
    "/owner-fund": "owner-fund",
    "/ai-assistant": "ai-operator",
    "/ai-marketing": "ai-marketing",
    "/ads-business-context": "ai-marketing",
    "/ai/ads-approval-evidence-reviewer": "ai-marketing",
    "/ai/ads-foundation-reviewer-docs": "ai-marketing",
    "/ai/ads-platform-source-sync-status-reviewer": "ai-marketing",
    "/fanpages": "fanpage",
    "/openai-configs": "openai-config",
    "/conversations": "chat-message",
    "/ops-actions": "ops-action",
    "/reports/daily-profit": "ad-group-profit-report",
    "/reports/return-report": "return-report",
    "/reports/product-profit": "ad-group-profit-report",
  };

  canShow(item: MenuItem): boolean {
    if (!this.authService.isAuthenticated()) {
      return item.route === "/login";
    }

    // Kiểm tra module access theo gói (plan)
    const featureModule = this.routeFeatureMap[item.route];
    if (featureModule && !this.planService.hasModuleAccess(featureModule)) {
      return false;
    }
    const managerHiddenRoutes = new Set<string>([
      '/finance/financial-control',
      '/loans',
      '/payments/supplier',
      '/payments/agent',
      '/orders',
      '/orders/test2',
      '/orders/update',
      '/orders/google-sheet-sync',
      '/products',
      '/product-category',
      '/product'
    ]);
    if (this.authService.user()?.role === 'manager' && managerHiddenRoutes.has(item.route)) {
      return false;
    }


    const routePermMap: Record<string, string> = {
      "/users": "users",
      "/suppliers": "users",
      "/orders": "orders",
      "/orders/test": "orders",
      "/orders/test2": "orders-test2",
      "/orders/update": "order-update",
      "/orders/google-sheet-sync": "orders",
      "/products": "products",
      "/product-category": "product-categories",
      "/product": "products",
      "/inventory": "purchase-costs",
  "/media": "media",
    "/media-report": "media",
      "/customers": "customers",
      "/ad-accounts": "ad-accounts",
  "/costs/advertising": "advertising-costs",
      "/ad-groups": "ad-groups",
      "/ad-group-counts": "ad-groups",
      "/costs/labor1": "labor-costs",
      "/labor1": "labor-costs",
      "/costs/purchase": "purchase-costs",
      "/costs/other": "other-costs",
      "/costs/salary": "salary-config",
      "/purchases/payables": "purchase-costs",
      "/ops-actions": "purchase-costs",
      "/supplier-quotes": "purchase-costs",
      "/payments/supplier": "purchase-costs",
      "/agents": "users",
      "/production-status": "production-status",
      "/delivery-status": "delivery-status",
      "/quotes": "quotes",
      "/payments/agent": "quotes",
      "/reports/ad-group-profit": "reports",
      "/reports/return-report": "reports",
      "/reports/product-profit": "reports",
      "/profit": "reports",
      "/fanpages": "fanpages",
      "/ai-assistant": "ai-assistant",
      "/ai-marketing": "google-ads.read",
      "/ai/ads-approval-evidence-reviewer": "ai-data-pack.marketer.read",
      "/ai/ads-foundation-reviewer-docs": "ai-data-pack.marketer.read",
      "/ai/ads-platform-source-sync-status-reviewer": "ai-data-pack.marketer.read",
      "/openai-configs": "openai-configs",
	"/conversations": "chat-messages",
  "/api-tokens": "google-ads.credentials.read",
      "/ads-settings": "google-ads.credentials.read",
      "/ads-business-context": "google-ads.read",
      "/finance/financial-control": "finance",
      "/loans": "finance",
      "/reports/daily-profit": "reports",
      "/finance/available-funds": "finance",
      "/finance/budget-allocation": "finance",
      "/finance/budget-buckets": "finance.budget-buckets.manage",
      "/finance/capital-allocation": "finance",
      "/finance/ad-group-daily-report": "finance",
      "/ads-budget": "ads-budget",
      "/employee-ads-kpi": "employee-ads-kpi",
      "/manager-handbook": "manager-handbook",
      "/owner-fund": "owner-fund",
      "/settings": "settings"
    };

    if (item.children?.length) {
      return item.children.some(child => this.canShow(child));
    }

    const permission = routePermMap[item.route];
    if (!permission) {
      return false;
    }

    return this.authService.hasPermission(permission);
  }

  /**
   * Check if current user can see Ads Alerts (requires ad-groups permission)
   */
  canShowAlerts(): boolean {
    return this.authService.hasPermission('ad-groups');
  }
}
