import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface CapitalFlowData {
  // Nguồn vốn
  initialCapital: number;
  loanAmount: number;
  totalCapital: number;
  
  // Đã sử dụng cho ads
  adsSpent: number;
  
  // Kết quả kinh doanh
  revenue: number;
  netProfit: number;
  
  // Phân bổ lợi nhuận thuần
  reinvestment: {
    daily: number;
    used: number;
    available: number;
    accumulated: number;
  };
  safetyReserve: {
    daily: number;
    accumulated: number;
  };
  personalIncome: {
    daily: number;
    accumulated: number;
  };
  longTermAsset: {
    daily: number;
    accumulated: number;
  };
  
  // Policy hiện tại
  policy: {
    name: string;
    reinvestmentRatio: number;
    safetyReserveRatio: number;
    personalIncomeRatio: number;
    longTermAssetRatio: number;
  };
}

@Component({
  selector: 'app-capital-flow',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="capital-flow-page">
      <div class="header">
        <h1>💰 Luồng Vốn & Phân Bổ Tự Động</h1>
        <p class="subtitle">Theo dõi vốn từ nguồn → Ads → Lợi nhuận → Phân bổ tái đầu tư</p>
        <button (click)="loadData()" [disabled]="loading()">🔄 Tải lại</button>
      </div>

      <div *ngIf="loading()" class="loading">⏳ Đang tải dữ liệu...</div>

      <div *ngIf="error()" class="error">❌ {{ error() }}</div>

      <div *ngIf="data()" class="flow-container">
        
        <!-- BƯỚC 1: Nguồn Vốn Ban Đầu -->
        <div class="flow-step">
          <div class="step-header">
            <span class="step-number">1</span>
            <h2>🏦 Nguồn Vốn Ban Đầu</h2>
          </div>
          <div class="cards-grid">
            <div class="metric-card blue">
              <div class="metric-label">Vốn ban đầu</div>
              <div class="metric-value">{{ format(data()!.initialCapital) }} đ</div>
            </div>
            <div class="metric-card green">
              <div class="metric-label">+ Vay</div>
              <div class="metric-value">{{ format(data()!.loanAmount) }} đ</div>
            </div>
            <div class="metric-card purple total">
              <div class="metric-label">= Tổng vốn khả dụng</div>
              <div class="metric-value">{{ format(data()!.totalCapital) }} đ</div>
            </div>
          </div>
          <div class="flow-arrow">↓</div>
        </div>

        <!-- BƯỚC 2: Phân Bổ Ngân Sách Chạy Ads -->
        <div class="flow-step">
          <div class="step-header">
            <span class="step-number">2</span>
            <h2>🎯 Phân Bổ Ngân Sách → Chạy Ads</h2>
          </div>
          <div class="cards-grid">
            <div class="metric-card orange">
              <div class="metric-label">Đã chi cho Ads</div>
              <div class="metric-value">{{ format(data()!.adsSpent) }} đ</div>
            </div>
            <div class="metric-card gray">
              <div class="metric-label">Còn lại khả dụng</div>
              <div class="metric-value">{{ format(data()!.totalCapital - data()!.adsSpent) }} đ</div>
            </div>
          </div>
          <div class="flow-arrow">↓</div>
        </div>

        <!-- BƯỚC 3: Đơn Hàng → Doanh Thu → Lợi Nhuận -->
        <div class="flow-step">
          <div class="step-header">
            <span class="step-number">3</span>
            <h2>📦 Đơn Hàng → 💵 Doanh Thu → 💰 Lợi Nhuận Thuần</h2>
          </div>
          <div class="cards-grid">
            <div class="metric-card cyan">
              <div class="metric-label">Doanh thu</div>
              <div class="metric-value">{{ format(data()!.revenue) }} đ</div>
            </div>
            <div class="metric-card green total">
              <div class="metric-label">Lợi nhuận thuần</div>
              <div class="metric-value">{{ format(data()!.netProfit) }} đ</div>
              <div class="metric-note">ROI: {{ calculateROI() }}%</div>
            </div>
          </div>
          <div class="flow-arrow">↓</div>
        </div>

        <!-- BƯỚC 4: Phân Bổ Lợi Nhuận Thuần -->
        <div class="flow-step">
          <div class="step-header">
            <span class="step-number">4</span>
            <h2>🎯 Phân Bổ Lợi Nhuận Thuần</h2>
          </div>
          
          <div class="policy-info">
            <strong>Chính sách: {{ data()!.policy.name }}</strong>
          </div>

          <div class="allocation-grid">
            
            <!-- Tái đầu tư -->
            <div class="allocation-card reinvest">
              <div class="allocation-header">
                <h3>🔄 Tái Đầu Tư</h3>
                <span class="ratio">{{ data()!.policy.reinvestmentRatio }}%</span>
              </div>
              <div class="allocation-metrics">
                <div class="metric-row">
                  <span>Hôm nay:</span>
                  <strong class="positive">+{{ format(data()!.reinvestment.daily) }} đ</strong>
                </div>
                <div class="metric-row">
                  <span>Đã sử dụng:</span>
                  <strong class="used">-{{ format(data()!.reinvestment.used) }} đ</strong>
                </div>
                <div class="metric-row highlight">
                  <span>Còn lại khả dụng:</span>
                  <strong class="available">{{ format(data()!.reinvestment.available) }} đ</strong>
                </div>
                <div class="metric-row">
                  <span>Lũy kế tổng:</span>
                  <strong>{{ format(data()!.reinvestment.accumulated) }} đ</strong>
                </div>
              </div>
              <div class="allocation-action">
                <button (click)="goToAllocation()" class="btn-action">
                  → Quay lại Phân Bổ Ngân Sách
                </button>
              </div>
            </div>

            <!-- Dự phòng -->
            <div class="allocation-card reserve">
              <div class="allocation-header">
                <h3>🛡️ Dự Phòng</h3>
                <span class="ratio">{{ data()!.policy.safetyReserveRatio }}%</span>
              </div>
              <div class="allocation-metrics">
                <div class="metric-row">
                  <span>Hôm nay:</span>
                  <strong class="positive">+{{ format(data()!.safetyReserve.daily) }} đ</strong>
                </div>
                <div class="metric-row highlight">
                  <span>Lũy kế:</span>
                  <strong>{{ format(data()!.safetyReserve.accumulated) }} đ</strong>
                </div>
              </div>
            </div>

            <!-- Thu nhập cá nhân -->
            <div class="allocation-card personal">
              <div class="allocation-header">
                <h3>👤 Thu Nhập Cá Nhân</h3>
                <span class="ratio">{{ data()!.policy.personalIncomeRatio }}%</span>
              </div>
              <div class="allocation-metrics">
                <div class="metric-row">
                  <span>Hôm nay:</span>
                  <strong class="positive">+{{ format(data()!.personalIncome.daily) }} đ</strong>
                </div>
                <div class="metric-row highlight">
                  <span>Lũy kế:</span>
                  <strong>{{ format(data()!.personalIncome.accumulated) }} đ</strong>
                </div>
              </div>
            </div>

            <!-- Tài sản dài hạn -->
            <div class="allocation-card longterm">
              <div class="allocation-header">
                <h3>🏠 Tài Sản Dài Hạn</h3>
                <span class="ratio">{{ data()!.policy.longTermAssetRatio }}%</span>
              </div>
              <div class="allocation-metrics">
                <div class="metric-row">
                  <span>Hôm nay:</span>
                  <strong class="positive">+{{ format(data()!.longTermAsset.daily) }} đ</strong>
                </div>
                <div class="metric-row highlight">
                  <span>Lũy kế:</span>
                  <strong>{{ format(data()!.longTermAsset.accumulated) }} đ</strong>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .capital-flow-page {
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e0e0e0;
    }

    .header h1 {
      margin: 0;
      color: #1a1a1a;
      font-size: 28px;
    }

    .subtitle {
      color: #666;
      margin: 5px 0 0 0;
      font-size: 14px;
    }

    .header button {
      padding: 10px 20px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }

    .header button:hover:not(:disabled) {
      background: #45a049;
    }

    .header button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .loading, .error {
      padding: 20px;
      text-align: center;
      font-size: 16px;
      border-radius: 8px;
      margin: 20px 0;
    }

    .loading {
      background: #e3f2fd;
      color: #1976d2;
    }

    .error {
      background: #ffebee;
      color: #c62828;
    }

    .flow-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .flow-step {
      background: white;
      border-radius: 12px;
      padding: 25px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .step-header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 20px;
    }

    .step-number {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: bold;
    }

    .step-header h2 {
      margin: 0;
      font-size: 22px;
      color: #333;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 15px;
    }

    .metric-card {
      padding: 20px;
      border-radius: 10px;
      border-left: 4px solid;
    }

    .metric-card.blue {
      background: #e3f2fd;
      border-left-color: #2196F3;
    }

    .metric-card.green {
      background: #e8f5e9;
      border-left-color: #4CAF50;
    }

    .metric-card.purple {
      background: #f3e5f5;
      border-left-color: #9c27b0;
    }

    .metric-card.orange {
      background: #fff3e0;
      border-left-color: #ff9800;
    }

    .metric-card.gray {
      background: #f5f5f5;
      border-left-color: #757575;
    }

    .metric-card.cyan {
      background: #e0f7fa;
      border-left-color: #00bcd4;
    }

    .metric-card.total {
      border-width: 4px;
      font-weight: bold;
    }

    .metric-label {
      font-size: 13px;
      color: #666;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .metric-value {
      font-size: 24px;
      font-weight: bold;
      color: #1a1a1a;
    }

    .metric-note {
      margin-top: 5px;
      font-size: 12px;
      color: #4CAF50;
      font-weight: bold;
    }

    .flow-arrow {
      text-align: center;
      font-size: 40px;
      color: #9c27b0;
      margin: 15px 0;
      font-weight: bold;
    }

    .policy-info {
      background: #f5f5f5;
      padding: 12px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      text-align: center;
      font-size: 15px;
      color: #333;
    }

    .allocation-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 20px;
    }

    .allocation-card {
      background: white;
      border-radius: 10px;
      border: 2px solid;
      padding: 20px;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .allocation-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .allocation-card.reinvest {
      border-color: #4CAF50;
      background: linear-gradient(to bottom, #e8f5e9 0%, white 100px);
    }

    .allocation-card.reserve {
      border-color: #ff9800;
      background: linear-gradient(to bottom, #fff3e0 0%, white 100px);
    }

    .allocation-card.personal {
      border-color: #2196F3;
      background: linear-gradient(to bottom, #e3f2fd 0%, white 100px);
    }

    .allocation-card.longterm {
      border-color: #9c27b0;
      background: linear-gradient(to bottom, #f3e5f5 0%, white 100px);
    }

    .allocation-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 12px;
      border-bottom: 2px solid rgba(0,0,0,0.1);
    }

    .allocation-header h3 {
      margin: 0;
      font-size: 18px;
      color: #333;
    }

    .ratio {
      font-size: 20px;
      font-weight: bold;
      color: #9c27b0;
      background: white;
      padding: 5px 12px;
      border-radius: 20px;
      border: 2px solid currentColor;
    }

    .allocation-metrics {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .metric-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      font-size: 14px;
    }

    .metric-row.highlight {
      background: rgba(76, 175, 80, 0.1);
      padding: 12px;
      border-radius: 6px;
      margin: 5px 0;
      border-left: 3px solid #4CAF50;
    }

    .metric-row span {
      color: #666;
    }

    .metric-row strong {
      font-size: 16px;
      color: #1a1a1a;
    }

    .metric-row strong.positive {
      color: #4CAF50;
    }

    .metric-row strong.used {
      color: #ff9800;
    }

    .metric-row strong.available {
      color: #2196F3;
      font-size: 18px;
    }

    .allocation-action {
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid rgba(0,0,0,0.1);
    }

    .btn-action {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: transform 0.2s;
    }

    .btn-action:hover {
      transform: scale(1.02);
      box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
    }

    @media (max-width: 768px) {
      .cards-grid {
        grid-template-columns: 1fr;
      }

      .allocation-grid {
        grid-template-columns: 1fr;
      }

      .header {
        flex-direction: column;
        align-items: flex-start;
        gap: 15px;
      }

      .metric-value {
        font-size: 20px;
      }
    }
  `]
})
export class CapitalFlowComponent implements OnInit {
  data = signal<CapitalFlowData | null>(null);
  loading = signal(false);
  error = signal('');

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    this.error.set('');

    try {
      // 1. Lấy available funds
      const funds = await this.http.get<any>(`${environment.apiUrl}/finance/available-funds`).toPromise();
      
      // 2. Lấy allocation computation
      const allocation = await this.http.get<any>(`${environment.apiUrl}/capital-allocation/compute`).toPromise();
      
      // 3. Lấy reinvestment budget
      const reinvestBudget = await this.http.get<any>(`${environment.apiUrl}/capital-allocation/reinvestment-budget`).toPromise();
      
      // 4. Lấy snapshots lũy kế
      const snapshotsResponse = await this.http.get<any[]>(`${environment.apiUrl}/capital-allocation/snapshots?limit=1000`).toPromise();
      const snapshots = snapshotsResponse || [];

      // Tính toán lũy kế
      const accumulatedSafetyReserve = snapshots.reduce((sum, s) => sum + (s.safetyReserveAmount || 0), 0);
      const accumulatedPersonalIncome = snapshots.reduce((sum, s) => sum + (s.personalIncomeAmount || 0), 0);
      const accumulatedLongTermAsset = snapshots.reduce((sum, s) => sum + (s.longTermAssetAmount || 0), 0);

      this.data.set({
        initialCapital: funds.breakdown?.collectedRevenue || 0,
        loanAmount: funds.breakdown?.loanAvailable || 0,
        totalCapital: funds.available || 0,
        adsSpent: funds.breakdown?.actualSpent || 0,
        revenue: funds.breakdown?.collectedRevenue || 0,
        netProfit: allocation.totalNetProfit || 0,
        reinvestment: {
          daily: allocation.reinvestmentAmount || 0,
          used: reinvestBudget.totalUsed || 0,
          available: reinvestBudget.available || 0,
          accumulated: reinvestBudget.totalAllocated || 0
        },
        safetyReserve: {
          daily: allocation.safetyReserveAmount || 0,
          accumulated: accumulatedSafetyReserve
        },
        personalIncome: {
          daily: allocation.personalIncomeAmount || 0,
          accumulated: accumulatedPersonalIncome
        },
        longTermAsset: {
          daily: allocation.longTermAssetAmount || 0,
          accumulated: accumulatedLongTermAsset
        },
        policy: {
          name: allocation.policyName || 'Default Policy',
          reinvestmentRatio: allocation.ratios?.reinvestmentRatio || 45,
          safetyReserveRatio: allocation.ratios?.safetyReserveRatio || 25,
          personalIncomeRatio: allocation.ratios?.personalIncomeRatio || 20,
          longTermAssetRatio: allocation.ratios?.longTermAssetRatio || 10
        }
      });

    } catch (err: any) {
      this.error.set(err.error?.message || 'Không thể tải dữ liệu');
      console.error('Load capital flow error:', err);
    } finally {
      this.loading.set(false);
    }
  }

  format(value: number): string {
    return value.toLocaleString('vi-VN');
  }

  calculateROI(): string {
    const d = this.data();
    if (!d || d.adsSpent === 0) return '0';
    return ((d.netProfit / d.adsSpent) * 100).toFixed(1);
  }

  goToAllocation() {
    window.location.href = '/finance/budget-allocation';
  }
}
