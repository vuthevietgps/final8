import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PlanService } from '../../core/services/plan.service';

@Component({
  selector: 'app-upgrade-plan',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="upgrade-container">
      <div class="upgrade-card">
        <div class="icon">🔒</div>
        <h2>Tính năng không khả dụng</h2>
        <p>Gói hiện tại: <strong>{{ planService.getPlan() | uppercase }}</strong></p>
        <p>Tính năng này yêu cầu gói cao hơn. Vui lòng liên hệ để nâng cấp.</p>

        <div class="plans">
          <div class="plan-card">
            <h3>Starter</h3>
            <p class="price">800K - 1.2M/tháng</p>
            <ul>
              <li>≤ 10 users</li>
              <li>Quản lý sản phẩm, khách hàng</li>
              <li>Chi phí cơ bản</li>
            </ul>
          </div>
          <div class="plan-card featured">
            <h3>Professional</h3>
            <p class="price">1.8M - 3M/tháng</p>
            <ul>
              <li>≤ 30 users</li>
              <li>Đơn hàng, công nợ NCC/ĐL</li>
              <li>Quảng cáo, KPI</li>
            </ul>
          </div>
          <div class="plan-card">
            <h3>Enterprise</h3>
            <p class="price">4M - 7M/tháng</p>
            <ul>
              <li>Không giới hạn users</li>
              <li>Tài chính, CFO Dashboard</li>
              <li>AI, Cashflow Control</li>
            </ul>
          </div>
        </div>

        <a routerLink="/dashboard" class="btn-back">← Quay lại Dashboard</a>
      </div>
    </div>
  `,
  styles: [`
    .upgrade-container {
      display: flex; justify-content: center; align-items: center;
      min-height: 80vh; padding: 2rem;
    }
    .upgrade-card {
      text-align: center; max-width: 900px; width: 100%;
    }
    .icon { font-size: 4rem; margin-bottom: 1rem; }
    h2 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .plans {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 1rem; margin: 2rem 0;
    }
    .plan-card {
      border: 1px solid #e0e0e0; border-radius: 8px;
      padding: 1.5rem; text-align: left;
    }
    .plan-card.featured {
      border-color: #4f46e5; box-shadow: 0 0 0 2px #4f46e5;
    }
    .plan-card h3 { margin: 0 0 0.5rem; }
    .price { font-size: 1.2rem; font-weight: bold; color: #4f46e5; }
    .plan-card ul { padding-left: 1.2rem; }
    .plan-card li { margin: 0.3rem 0; }
    .btn-back {
      display: inline-block; margin-top: 1rem; padding: 0.5rem 1.5rem;
      background: #4f46e5; color: white; border-radius: 6px;
      text-decoration: none;
    }
    .btn-back:hover { background: #4338ca; }
  `]
})
export class UpgradePlanComponent {
  constructor(public planService: PlanService) {}
}
