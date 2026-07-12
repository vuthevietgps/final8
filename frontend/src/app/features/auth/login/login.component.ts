import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LoginRequest } from '../../../core/models/auth.interface';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="erp-login-page">
      <div class="texture-layer"></div>
      <div class="glow glow-a"></div>
      <div class="glow glow-b"></div>

      <div class="public-site-bar">
        <div class="public-site-copy">
          <span class="public-site-label">Website cong khai</span>
          <strong>{{ publicSiteDomainLabel }}</strong>
          <span class="public-site-note">
            @if (isLocalPreview) {
              Local preview menu uses /site and /legal pages.
            } @else {
              Canonical public links for htxbachgia.shop.
            }
          </span>
        </div>

        <nav class="public-site-nav" aria-label="Public site links">
          @for (link of publicLinks; track link.href) {
            <a [href]="link.href">{{ link.label }}</a>
          }
        </nav>
      </div>

      <div class="erp-layout">
        <aside class="login-corner">
          <p class="coop-name">HỢP TÁC XÃ VẬN TẢI BÁCH GIA</p>
          <div class="legal-meta">
            <p class="legal-row"><span class="legal-label">Mã số thuế:</span><span class="legal-value">0318614869</span></p>
            <p class="legal-row"><span class="legal-label">Loại hình pháp lý:</span><span class="legal-value">Hợp tác xã</span></p>
            <p class="legal-row"><span class="legal-label">Ngày cấp:</span><span class="legal-value">07/08/2024</span></p>
            <p class="legal-address">
              Tầng 4, Lầu 3, Tòa nhà Đông Nam, 322 Tây Thạnh, phường Tây Thạnh, quận Tân Phú,
              Thành phố Hồ Chí Minh, Việt Nam.
            </p>
          </div>

          <div class="login-card">
            <div class="login-header">
              <h1>Đăng nhập hệ thống</h1>
              <p class="welcome-text">SMARTERP điều hành vận hành, ads và tài chính tập trung</p>
              <p class="version-text">ERP Fulfilment Version 1</p>
            </div>

            <form class="login-form" (ngSubmit)="onLogin($event)">
              @if (errorMessage()) {
                <div class="login-error">
                  {{ errorMessage() }}
                </div>
              }

              <div class="input-group">
                <label for="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autocomplete="email"
                  required
                  class="login-input"
                  placeholder="name@company.vn"
                  [(ngModel)]="loginData.email"
                />
              </div>

              <div class="input-group">
                <label for="password">Mật khẩu</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  class="login-input"
                  placeholder="Nhập mật khẩu"
                  [(ngModel)]="loginData.password"
                />
              </div>

              <button
                type="submit"
                class="login-button"
                [disabled]="authService.isLoading()"
              >
                @if (authService.isLoading()) {
                  Đang đăng nhập...
                } @else {
                  Đăng nhập
                }
              </button>
            </form>
          </div>
        </aside>

        <main class="erp-content">
          <section class="hero">
            <p class="hero-tag">NỀN TẢNG QUẢN TRỊ SMARTERP</p>
            <h2>Trung tâm điều hành số cho Hợp tác xã Vận tải Bách Gia</h2>
            <p>
              Một nền tảng hợp nhất quy trình đơn hàng, quảng cáo, công nợ, dòng tiền và AI chat
              để ban điều hành ra quyết định nhanh dựa trên dữ liệu thực tế.
            </p>

            <div class="stat-grid">
              <article>
                <strong>47</strong>
                <span>module backend</span>
              </article>
              <article>
                <strong>58</strong>
                <span>API controller</span>
              </article>
              <article>
                <strong>30</strong>
                <span>cronjob tự động hóa</span>
              </article>
            </div>
          </section>

          <section class="module-board">
            <h3>Khối nghiệp vụ trọng tâm</h3>
            <div class="module-grid">
              <article>
                <h4>Vận hành đơn hàng</h4>
                <p>Theo dõi sản xuất, giao hàng, đồng bộ Google Sheets và luồng xử lý liên phòng ban.</p>
              </article>
              <article>
                <h4>Quảng cáo và KPI</h4>
                <p>Quản lý tài khoản ads, nhóm quảng cáo, hiệu suất nhân sự và cảnh báo rủi ro chiến dịch.</p>
              </article>
              <article>
                <h4>Tài chính và dòng tiền</h4>
                <p>Kiểm soát ngân sách, công nợ, quỹ owner, vay vốn và báo cáo lợi nhuận theo ngày.</p>
              </article>
              <article>
                <h4>AI và hội thoại</h4>
                <p>Tích hợp Fanpage, Messenger webhook, OpenAI và tự động hóa phản hồi khách hàng.</p>
              </article>
            </div>
          </section>

          <section class="kpi-strip">
            <h3>Mục tiêu vận hành giai đoạn 1</h3>
            <ul>
              <li>100% dữ liệu vận hành cốt lõi quản lý tập trung trên một hệ thống.</li>
              <li>Giảm tối thiểu 50% thời gian tổng hợp báo cáo ngày cho cấp quản lý.</li>
              <li>Chuẩn hóa dashboard cảnh báo Ads và dòng tiền theo chu kỳ tự động.</li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .erp-login-page {
      --ink: #102137;
      --ink-soft: #3a506e;
      --paper: #f7f3eb;
      --panel: #fffdf7;
      --line: rgba(16, 33, 55, 0.14);
      --brand: #0f5d5c;
      --brand-strong: #0a4747;
      --accent: #dc8f2f;

      min-height: 100vh;
      position: relative;
      overflow: hidden;
      background:
        radial-gradient(1200px 600px at 90% 5%, rgba(220, 143, 47, 0.25), transparent 60%),
        radial-gradient(1200px 700px at 20% 90%, rgba(15, 93, 92, 0.28), transparent 55%),
        linear-gradient(165deg, #f5efe3 0%, #f0e6d6 52%, #ebdfcb 100%);
      padding: 28px;
      color: var(--ink);
      font-family: "Be Vietnam Pro", "Segoe UI", Tahoma, sans-serif;
    }

    .texture-layer {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(45deg, rgba(16, 33, 55, 0.018) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(16, 33, 55, 0.018) 25%, transparent 25%);
      background-size: 22px 22px;
      pointer-events: none;
    }

    .glow {
      position: absolute;
      filter: blur(8px);
      border-radius: 999px;
      pointer-events: none;
    }

    .glow-a {
      width: 300px;
      height: 300px;
      background: rgba(15, 93, 92, 0.16);
      top: -90px;
      right: -30px;
    }

    .glow-b {
      width: 240px;
      height: 240px;
      background: rgba(220, 143, 47, 0.2);
      bottom: -70px;
      left: 42%;
    }

    .erp-layout {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 360px minmax(0, 1fr);
      gap: 24px;
      align-items: start;
      max-width: 1400px;
      margin: 0 auto;
    }

    .public-site-bar {
      position: relative;
      z-index: 1;
      max-width: 1400px;
      margin: 0 auto 18px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border: 1px solid rgba(16, 33, 55, 0.14);
      border-radius: 18px;
      background: rgba(255, 252, 245, 0.8);
      backdrop-filter: blur(6px);
      box-shadow: 0 10px 24px rgba(16, 33, 55, 0.08);
      animation: reveal-up 0.4s ease both;
    }

    .public-site-copy {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    .public-site-label {
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--brand);
      font-weight: 700;
    }

    .public-site-copy strong {
      color: #0d2338;
      font-size: 18px;
      line-height: 1.2;
    }

    .public-site-note {
      color: #506178;
      font-size: 12px;
      line-height: 1.45;
    }

    .public-site-nav {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }

    .public-site-nav a {
      display: inline-flex;
      align-items: center;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid rgba(16, 33, 55, 0.14);
      background: rgba(255, 255, 255, 0.72);
      color: #1b3956;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
    }

    .public-site-nav a:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 18px rgba(16, 33, 55, 0.08);
      border-color: rgba(15, 93, 92, 0.36);
    }

    .login-corner {
      position: sticky;
      top: 14px;
      align-self: start;
      animation: reveal-up 0.5s ease both;
    }

    .coop-name {
      margin: 0 0 14px;
      display: inline-block;
      padding: 6px 12px;
      border-radius: 999px;
      border: 1px solid rgba(16, 33, 55, 0.2);
      background: rgba(255, 253, 247, 0.78);
      letter-spacing: 0.08em;
      font-size: 11px;
      font-weight: 700;
    }

    .legal-meta {
      margin: 0 0 14px;
      border-radius: 12px;
      padding: 10px 12px;
      border: 1px solid rgba(16, 33, 55, 0.16);
      background: rgba(255, 253, 247, 0.84);
      box-shadow: 0 10px 18px rgba(16, 33, 55, 0.08);
    }

    .legal-row {
      margin: 0 0 5px;
      font-size: 12px;
      line-height: 1.4;
      color: #2b4662;
    }

    .legal-row:last-of-type {
      margin-bottom: 8px;
    }

    .legal-label {
      font-weight: 700;
      margin-right: 4px;
      color: #1b3956;
    }

    .legal-value {
      font-weight: 600;
    }

    .legal-address {
      margin: 0;
      font-size: 12px;
      line-height: 1.45;
      color: #3a506e;
    }

    .login-card {
      width: 100%;
      background: linear-gradient(168deg, rgba(255, 253, 247, 0.97), rgba(255, 248, 234, 0.96));
      border-radius: 18px;
      box-shadow: 0 28px 42px rgba(16, 33, 55, 0.16);
      padding: 24px;
      border: 1px solid rgba(16, 33, 55, 0.15);
      backdrop-filter: blur(2px);
    }

    .login-header {
      margin-bottom: 16px;
    }

    .login-header h1 {
      margin: 0;
      font-size: 30px;
      font-weight: 700;
      line-height: 1.08;
      color: var(--ink);
    }

    .welcome-text {
      margin: 10px 0 5px;
      font-size: 14px;
      color: var(--ink-soft);
      font-weight: 600;
    }

    .version-text {
      margin: 0;
      font-size: 12px;
      color: #5f6c7d;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }

    .login-form {
      display: grid;
      gap: 14px;
    }

    .login-error {
      background: #fee2e2;
      border: 1px solid #fca5a5;
      color: #b91c1c;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 14px;
    }

    .input-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .input-group label {
      font-size: 14px;
      color: var(--ink-soft);
      font-weight: 600;
    }

    .login-input {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 14px;
      color: var(--ink);
      background: rgba(255, 255, 255, 0.82);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .login-input:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 3px rgba(15, 93, 92, 0.16);
    }

    .login-button {
      margin-top: 6px;
      border: none;
      border-radius: 12px;
      padding: 12px;
      font-size: 15px;
      font-weight: 700;
      color: #fffaf0;
      background: linear-gradient(132deg, var(--brand) 0%, var(--brand-strong) 75%);
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.2s;
      box-shadow: 0 10px 20px rgba(10, 71, 71, 0.28);
    }

    .login-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 14px 24px rgba(10, 71, 71, 0.32);
    }

    .login-button:disabled {
      opacity: 0.65;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .erp-content {
      display: grid;
      gap: 18px;
      animation: reveal-up 0.65s ease both;
    }

    .hero,
    .module-board,
    .kpi-strip {
      border-radius: 20px;
      border: 1px solid rgba(16, 33, 55, 0.14);
      background: rgba(255, 252, 245, 0.78);
      backdrop-filter: blur(2px);
      box-shadow: 0 12px 26px rgba(16, 33, 55, 0.08);
    }

    .hero {
      padding: 26px;
    }

    .hero-tag {
      margin: 0 0 10px;
      font-size: 12px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--brand);
      font-weight: 700;
    }

    .hero h2 {
      margin: 0;
      font-size: clamp(30px, 3vw, 44px);
      line-height: 1.12;
      letter-spacing: -0.02em;
      max-width: 18ch;
      color: #0d2338;
    }

    .hero p {
      margin: 14px 0 0;
      max-width: 70ch;
      color: #42556d;
      line-height: 1.6;
      font-size: 15px;
    }

    .stat-grid {
      margin-top: 18px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .stat-grid article {
      border-radius: 14px;
      padding: 14px;
      border: 1px solid rgba(16, 33, 55, 0.15);
      background: linear-gradient(165deg, rgba(255, 255, 255, 0.7), rgba(255, 248, 235, 0.82));
    }

    .stat-grid strong {
      display: block;
      font-size: 30px;
      line-height: 1;
      color: var(--brand-strong);
    }

    .stat-grid span {
      margin-top: 6px;
      display: block;
      color: #506178;
      font-size: 13px;
      font-weight: 600;
    }

    .module-board,
    .kpi-strip {
      padding: 22px;
    }

    .module-board h3,
    .kpi-strip h3 {
      margin: 0 0 14px;
      color: #10243b;
      font-size: 21px;
      letter-spacing: -0.01em;
    }

    .module-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .module-grid article {
      border-radius: 14px;
      border: 1px solid rgba(16, 33, 55, 0.12);
      background: rgba(255, 255, 255, 0.75);
      padding: 14px;
      transition: transform 0.18s, box-shadow 0.18s;
    }

    .module-grid article:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 20px rgba(16, 33, 55, 0.08);
    }

    .module-grid h4 {
      margin: 0 0 7px;
      font-size: 16px;
      color: #0e2a45;
    }

    .module-grid p {
      margin: 0;
      color: #4b5e74;
      line-height: 1.55;
      font-size: 14px;
    }

    .kpi-strip ul {
      margin: 0;
      padding-left: 20px;
      display: grid;
      gap: 8px;
      color: #314b67;
      line-height: 1.55;
      font-size: 15px;
    }

    .kpi-strip li::marker {
      color: var(--accent);
    }

    @keyframes reveal-up {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 1120px) {
      .public-site-bar {
        flex-direction: column;
        align-items: flex-start;
      }

      .public-site-nav {
        justify-content: flex-start;
      }

      .erp-layout {
        grid-template-columns: 1fr;
      }

      .login-corner {
        position: static;
      }

      .login-card {
        max-width: 520px;
      }

      .stat-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      .erp-login-page {
        padding: 16px;
      }

      .public-site-bar {
        padding: 14px;
      }

      .module-grid,
      .stat-grid {
        grid-template-columns: 1fr;
      }

      .hero,
      .module-board,
      .kpi-strip {
        padding: 18px;
      }

      .hero h2 {
        font-size: 30px;
      }

      .login-header h1 {
        font-size: 26px;
      }
    }
  `]
})
export class LoginComponent {
  readonly publicSiteDomain = 'https://htxbachgia.shop';
  readonly isLocalPreview =
    typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  readonly publicSiteDomainLabel = this.isLocalPreview ? 'htxbachgia.shop' : this.publicSiteDomain;
  readonly publicLinks = this.buildPublicLinks();

  loginData: LoginRequest = {
    email: '',
    password: ''
  };

  errorMessage = signal<string>('');

  constructor(
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.modal-backdrop').forEach((el) => el.remove());
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');
    }

    // Khi vao trang login, clear auth data cu de tranh race condition
    // Cac request API tu component khac se khong co token -> khong gay 401 logout loop
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('current_user');
    }
  }

  private buildPublicLinks(): Array<{ label: string; href: string }> {
    if (this.isLocalPreview) {
      return [
        { label: 'Home', href: '/site/index.html' },
        { label: 'About Us', href: '/site/about-us.html' },
        { label: 'Contact', href: '/site/contact.html' },
        { label: 'Privacy Policy', href: '/legal/privacy-policy.html' },
        { label: 'Terms', href: '/legal/terms-of-service.html' },
        { label: 'Google Ads API', href: '/site/google-ads-api.html' }
      ];
    }

    return [
      { label: 'Home', href: `${this.publicSiteDomain}/` },
      { label: 'About Us', href: `${this.publicSiteDomain}/about-us` },
      { label: 'Contact', href: `${this.publicSiteDomain}/contact` },
      { label: 'Privacy Policy', href: `${this.publicSiteDomain}/privacy-policy` },
      { label: 'Terms', href: `${this.publicSiteDomain}/terms-of-service` },
      { label: 'Google Ads API', href: `${this.publicSiteDomain}/google-ads-api` }
    ];
  }

  private extractBackendErrorMessage(error: any): string | null {
    const payload = error?.error ?? error?.response ?? null;
    const candidates = [payload, payload?.message, payload?.error, error?.message];

    for (const value of candidates) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
      if (Array.isArray(value) && value.length > 0) {
        const first = String(value[0] ?? '').trim();
        if (first) return first;
      }
    }

    return null;
  }

  onLogin(event: Event): void {
    event.preventDefault();

    if (!this.loginData.email || !this.loginData.password) {
      this.errorMessage.set('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }

    this.errorMessage.set('');

    this.authService.login(this.loginData).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigate([returnUrl]);
      },
      error: (error: any) => {
        console.error('Login error:', error);
        const backendMessage = this.extractBackendErrorMessage(error);

        if (error.status === 0) {
          this.errorMessage.set('Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.');
        } else {
          this.errorMessage.set(backendMessage || ('Đăng nhập thất bại (' + (error.status ?? 'unknown') + ')'));
        }
      }
    });
  }
}
