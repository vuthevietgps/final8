import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-ad-group-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ad-group-management.component.html',
  styleUrl: './ad-group-management.component.css',
})
export class AdGroupManagementComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/finance/business-ledger`;
  report: any = null;
  loading = false;
  error = '';
  message = '';
  from = this.day(-59);
  to = this.day(0);
  maturityDays = 7;
  statusFilter = '';
  platformFilter = '';
  search = '';
  selected: any = null;
  review = { decision: 'observe', rationale: '', evidence: '' };

  async ngOnInit() { await this.reload(); }

  private day(offset: number) {
    const date = new Date(Date.now() + offset * 86_400_000);
    return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  }

  get rows() {
    const needle = this.search.trim().toLowerCase();
    return (this.report?.rows || []).filter((row: any) =>
      (!this.statusFilter || row.quality.status === this.statusFilter)
      && (!this.platformFilter || row.platform === this.platformFilter)
      && (!needle || [row.name, row.adGroupId, row.product?.name, row.category?.name]
        .some((value) => String(value || '').toLowerCase().includes(needle))),
    );
  }

  amount(value: number | null | undefined) {
    return value == null ? '—' : `${new Intl.NumberFormat('vi-VN').format(Math.round(value))} đ`;
  }

  ratio(value: number | null | undefined) {
    return value == null ? '—' : `${(value * 100).toFixed(1)}%`;
  }

  multiple(value: number | null | undefined) {
    return value == null ? '—' : `${value.toFixed(2)}x`;
  }

  signed(value: number | null | undefined) {
    return value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)} đ/1đ chi thêm`;
  }

  averagePerDay(value: number | null | undefined) {
    const days = this.report?.rows?.[0]?.marginalAnalysis?.observedDays;
    return days && value != null ? this.amount(value / days) : '—';
  }

  recentDays(row: any) {
    return (row?.dailySeries || []).slice(-14).reverse();
  }

  marginalStatus(value: string) {
    return value === 'ready' ? 'Đủ dữ liệu ước tính' : 'Đang tích lũy dữ liệu';
  }

  status(value: string) {
    return ({
      data_issue: 'Cần rà soát dữ liệu',
      insufficient_data: 'Chưa đủ dữ liệu',
      loss: 'Đang lỗ',
      profitable: 'Có lãi',
      break_even: 'Hòa vốn',
    } as Record<string, string>)[value] || value;
  }

  decision(value: string) {
    return ({
      observe: 'Theo dõi', keep_budget: 'Giữ ngân sách', propose_increase: 'Đề xuất tăng',
      propose_decrease: 'Đề xuất giảm', pause_candidate: 'Ứng viên tạm dừng',
    } as Record<string, string>)[value] || value;
  }

  private fail(error: any) {
    const value = error?.error?.message;
    this.error = Array.isArray(value) ? value.join(' · ')
      : typeof value === 'string' ? value : 'Không thể tải dữ liệu quản trị.';
  }

  async reload() {
    if (this.loading) return;
    this.loading = true;
    this.error = '';
    try {
      this.report = await firstValueFrom(this.http.get<any>(`${this.api}/ad-group-management`, {
        params: { from: this.from, to: this.to, maturityDays: this.maturityDays },
      }));
      if (this.selected) this.selected = this.report.rows.find((row: any) => row.adGroupId === this.selected.adGroupId) || null;
    } catch (error) { this.fail(error); }
    finally { this.loading = false; }
  }

  inspect(row: any) {
    this.selected = row;
    this.message = '';
    this.review = { decision: row.quality.status === 'loss' ? 'propose_decrease' : 'observe', rationale: '', evidence: '' };
  }

  async saveReview() {
    if (!this.selected || this.loading) return;
    this.loading = true;
    this.error = '';
    this.message = '';
    try {
      await firstValueFrom(this.http.post(`${this.api}/ad-group-management/${encodeURIComponent(this.selected.adGroupId)}/reviews`, {
        requestKey: crypto.randomUUID(), periodFrom: this.from, periodTo: this.to,
        decision: this.review.decision, rationale: this.review.rationale, evidence: this.review.evidence,
      }));
      this.message = 'Đã lưu quyết định nội bộ. Chưa gửi hoặc thay đổi gì trên nền tảng quảng cáo.';
      await this.reload();
    } catch (error) { this.fail(error); }
    finally { this.loading = false; }
  }
}
