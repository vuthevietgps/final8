/**
 * File: features/advertising-cost/advertising-cost.component.ts
 * Mục đích: UI quản lý Chi Phí Quảng Cáo.
 */
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { AdvertisingCostService } from './advertising-cost.service';
import { AdAccountService } from '../ad-account/ad-account.service';
import { AdAccount } from '../ad-account/models/ad-account.model';
import { AdvertisingCost, AdvertisingCostSummary, CreateAdvertisingCost } from './models/advertising-cost.model';

@Component({
  selector: 'app-advertising-cost',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './advertising-cost.component.html',
  styleUrls: ['./advertising-cost.component.css']
})
export class AdvertisingCostComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(AdvertisingCostService);
  private adAccountService = inject(AdAccountService);

  // State
  items = signal<AdvertisingCost[]>([]);
  adAccounts = signal<AdAccount[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  summary = signal<AdvertisingCostSummary | null>(null);

  // Filters
  filterAdAccountId = signal('all');

  // UI
  showModal = signal(false);
  editingId: string | null = null;

  form = this.fb.group({
    // Ngày: UI nhập theo mm/dd/yyyy nhưng lưu ISO yyyy-mm-dd
    date: ['', Validators.required],
    frequency: [null], // không bắt buộc
    adGroupId: ['', Validators.required],
    spentAmount: [0, [Validators.min(0)]],
    cpm: [0, [Validators.min(0)]],
    cpc: [0, [Validators.min(0)]],
  });

  ngOnInit(): void {
    // default values
    const todayIso = new Date().toISOString().slice(0, 10);
    this.form.patchValue({ date: todayIso, spentAmount: 0, cpm: 0, cpc: 0 });
    this.loadAdAccounts();
    this.loadData();
  }

  private toIsoFromMmDdYyyy(input: string): string {
    // input mm/dd/yyyy -> yyyy-mm-dd
    const m = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return input; // assume already ISO
    const mm = m[1].padStart(2, '0');
    const dd = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  private toMmDdYyyy(iso: string): string {
    // yyyy-mm-dd -> mm/dd/yyyy
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso;
    return `${m[2]}/${m[3]}/${m[1]}`;
  }

  // Giá trị hiển thị cho ô nhập ngày (mm/dd/yyyy) dựa trên giá trị ISO trong form
  getDateInputValue(): string {
    const v = this.form.value.date as string | undefined | null;
    if (!v) return '';
    // Nếu đã có dạng mm/dd/yyyy thì trả về luôn
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) return v;
    // Nếu là ISO yyyy-mm-dd thì chuyển sang mm/dd/yyyy
    return this.toMmDdYyyy(v);
  }

  loadAdAccounts() {
    this.adAccountService.getAdAccounts().subscribe({
      next: (acs) => this.adAccounts.set(acs),
      error: (e) => console.error('Load ad accounts error', e)
    });
  }

  loadData() {
    this.loading.set(true);
    const filter = this.filterAdAccountId() !== 'all' ? { adAccountId: this.filterAdAccountId() } : undefined;
    this.service.getAll(filter).subscribe({
      next: (data) => {
        // chuẩn hoá hiển thị ngày theo mm/dd/yyyy
        const normalized = data.map(d => ({ ...d, date: this.toMmDdYyyy(d.date?.slice(0,10) || new Date().toISOString().slice(0,10)) } as AdvertisingCost));
        this.items.set(normalized);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Không tải được dữ liệu');
        this.loading.set(false);
      },
    });

    this.service.getSummary().subscribe({
      next: (sum) => this.summary.set(sum),
      error: () => this.summary.set({ totalSpent: 0, count: 0, avgCPM: 0, avgCPC: 0 }),
    });
  }

  onFilterChange() {
    this.loadData();
  }

  openCreate() {
    this.editingId = null;
    const todayIso = new Date().toISOString().slice(0, 10);
    this.form.reset({ date: todayIso, frequency: null, adGroupId: '', spentAmount: 0, cpm: 0, cpc: 0 });
    this.showModal.set(true);
  }

  // Tạo mới bản ghi ngay lập tức (giống hành vi "Thêm mới" của Đơn hàng thử nghiệm 2)
  addNew() {
    const todayIso = new Date().toISOString().slice(0, 10);
    const payload: CreateAdvertisingCost = {
      date: todayIso,
      frequency: null as any,
      adGroupId: '0',
      spentAmount: 0,
      cpm: 0,
      cpc: 0,
    };
    this.loading.set(true);
    this.service.create(payload).subscribe({
      next: (created) => {
        // chuyển ngày về mm/dd/yyyy để đồng bộ hiển thị
        const normalized = { ...created, date: this.toMmDdYyyy(created.date?.slice(0,10) || todayIso) } as AdvertisingCost;
        this.items.update(list => [normalized, ...list]);
        this.loading.set(false);
        // cập nhật lại summary
        this.service.getSummary().subscribe({ next: (sum) => this.summary.set(sum) });
      },
      error: (err) => { console.error(err); this.error.set('Không thể tạo bản ghi'); this.loading.set(false); }
    });
  }

  openEdit(item: AdvertisingCost) {
    this.editingId = item._id || null;
    // form giữ ISO cho backend; convert ngược từ hiển thị mm/dd/yyyy nếu cần
    const isoDate = this.toIsoFromMmDdYyyy(item.date);
    this.form.reset({
      date: isoDate,
      frequency: (item.frequency === undefined ? null : item.frequency) as any,
      adGroupId: item.adGroupId,
      spentAmount: item.spentAmount ?? 0,
      cpm: item.cpm ?? 0,
      cpc: item.cpc ?? 0,
    });
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  save() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const raw = this.form.value as any;
    const payload: CreateAdvertisingCost = {
      ...raw,
      date: this.toIsoFromMmDdYyyy(raw.date),
    };

    const obs = this.editingId
      ? this.service.update(this.editingId, payload)
      : this.service.create(payload);

    obs.subscribe({
      next: () => {
        this.loadData();
        this.showModal.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Lỗi khi lưu');
        this.loading.set(false);
      },
    });
  }

  remove(id: string) {
    if (!confirm('Xóa chi phí này?')) return;
    this.loading.set(true);
    this.service.delete(id).subscribe({
      next: () => this.loadData(),
      error: (err) => {
        console.error(err);
        this.error.set('Lỗi khi xóa');
        this.loading.set(false);
      },
    });
  }
}
