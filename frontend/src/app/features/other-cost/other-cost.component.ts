/**
 * File: features/other-cost/other-cost.component.ts
 * Mục đích: UI quản lý Chi Phí Khác: ngày, chi phí, ghi chú. CRUD + lọc theo khoảng ngày.
 */
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { OtherCostService } from './other-cost.service';
import { environment } from '../../../environments/environment';
import { CreateOtherCost, OtherCost, OtherCostSummary } from './models/other-cost.model';

@Component({
  selector: 'app-other-cost',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './other-cost.component.html',
  styleUrls: ['./other-cost.component.css']
})
export class OtherCostComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(OtherCostService);

  // State
  costs = signal<OtherCost[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  summary = signal<OtherCostSummary | null>(null);

  // Filters
  fromDate = signal<string>('');
  toDate = signal<string>('');

  // UI
  showModal = signal(false);
  editingId: string | null = null;

  form = this.fb.group({
    date: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0)]],
  notes: [''],
  documentLink: ['']
  });

  ngOnInit(): void {
    // default: set today
    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    this.form.patchValue({ date: iso });
    this.loadData();
  }

  getExportUrl(): string {
  const url = new URL(`${environment.apiUrl}/other-cost/export/csv`, window.location.origin);
    const from = this.fromDate();
    const to = this.toDate();
    if (from) url.searchParams.set('from', from);
    if (to) url.searchParams.set('to', to);
    return url.toString();
  }

  loadData() {
    this.loading.set(true);
    const params = {
      from: this.fromDate() || undefined,
      to: this.toDate() || undefined,
    };
    this.service.getAll(params).subscribe({
      next: (data) => {
        this.costs.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Không tải được dữ liệu');
        this.loading.set(false);
      },
    });

    this.service.getSummary(params).subscribe({
      next: (sum) => this.summary.set(sum),
      error: () => this.summary.set({ totalAmount: 0, count: 0 }),
    });
  }

  openCreate() {
    this.editingId = null;
    const today = new Date().toISOString().slice(0, 10);
  this.form.reset({ date: today, amount: 0, notes: '', documentLink: '' });
    this.showModal.set(true);
  }

  openEdit(item: OtherCost) {
    this.editingId = item._id || null;
    const date = item.date?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  this.form.reset({ date, amount: item.amount, notes: item.notes || '', documentLink: item.documentLink || '' });
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  save() {
    if (this.form.invalid) return;
    this.loading.set(true);
    const payload: CreateOtherCost = this.form.value as any;

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

  confirm(id: string) {
    if (!confirm('Xác nhận đã chi khoản này?')) return;
    this.loading.set(true);
    this.service.confirm(id).subscribe({
      next: () => this.loadData(),
      error: (err) => {
        console.error(err);
        this.error.set('Lỗi khi xác nhận');
        this.loading.set(false);
      },
    });
  }
}
