import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { AvailableFundsService, AvailableFunds, CaptureAvailableFundPayload } from './available-funds.service';

@Component({
  selector: 'app-available-funds',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './available-funds.component.html',
  styleUrls: ['./available-funds.component.css']
})
export class AvailableFundsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(AvailableFundsService);

  form = this.fb.group({
    collectedRevenue: [null as number | null, [Validators.min(0)]],
    loanAvailable: [null as number | null, [Validators.min(0)]],
    actualSpent: [null as number | null, [Validators.min(0)]],
    reservedPayroll: [null as number | null, [Validators.min(0)]],
    reservedInterest: [null as number | null, [Validators.min(0)]],
    reservedPayables: [null as number | null, [Validators.min(0)]],
    reservedSuppliers: [null as number | null, [Validators.min(0)]],
    reservedAgents: [null as number | null, [Validators.min(0)]],
    reservedOther: [null as number | null, [Validators.min(0)]],
    note: ['']
  });

  current = signal<AvailableFunds | null>(null);
  auto = signal<AvailableFunds | null>(null);
  snapshots = signal<AvailableFunds[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadCurrent();
    this.loadSnapshots();
  }

  private payload(): CaptureAvailableFundPayload {
    const v = this.form.value;
    const payload: CaptureAvailableFundPayload = {};
    if (v.collectedRevenue != null) payload.collectedRevenue = v.collectedRevenue;
    if (v.loanAvailable != null) payload.loanAvailable = v.loanAvailable;
    if (v.actualSpent != null) payload.actualSpent = v.actualSpent;
    if (v.reservedPayroll != null) payload.reservedPayroll = v.reservedPayroll;
    if (v.reservedInterest != null) payload.reservedInterest = v.reservedInterest;
    if (v.reservedPayables != null) payload.reservedPayables = v.reservedPayables;
    if (v.reservedSuppliers != null) payload.reservedSuppliers = v.reservedSuppliers;
    if (v.reservedAgents != null) payload.reservedAgents = v.reservedAgents;
    if (v.reservedOther != null) payload.reservedOther = v.reservedOther;
    if (v.note) payload.note = v.note;
    return payload;
  }

  loadCurrent(): void {
    this.loading.set(true);
    this.error.set(null);
    // Bước 1: lấy auto (không override)
    this.service.getCurrent().subscribe({
      next: autoRes => {
        this.auto.set(autoRes);
        // Bước 2: tính theo override (nếu có)
        this.service.getCurrent(this.payload()).subscribe({
          next: res => {
            this.current.set(res);
            this.loading.set(false);
          },
          error: err => {
            console.error(err);
            this.error.set('Không tải được vốn khả dụng hiện tại');
            this.loading.set(false);
          }
        });
      },
      error: err => {
        console.error(err);
        this.error.set('Không tải được số liệu tự động');
        this.loading.set(false);
      }
    });
  }

  capture(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.capture(this.payload()).subscribe({
      next: res => {
        this.current.set(res);
        this.loading.set(false);
        this.loadSnapshots();
      },
      error: err => {
        console.error(err);
        this.error.set('Không lưu được snapshot vốn khả dụng');
        this.loading.set(false);
      }
    });
  }

  private loadSnapshots(): void {
    this.service.listSnapshots().subscribe({
      next: res => this.snapshots.set(res || []),
      error: err => console.error(err)
    });
  }

  format(amount?: number | null): string {
    const val = amount ?? 0;
    return val.toLocaleString('vi-VN');
  }

  formatWithSign(amount?: number | null): string {
    const val = amount ?? 0;
    if (val === 0) return '0';
    const formatted = Math.abs(val).toLocaleString('vi-VN');
    return val < 0 ? `-${formatted}` : formatted;
  }

  appliedValue(key: keyof AvailableFunds): number {
    const override = this.form.get(key as any)?.value;
    if (override != null) return override;
    const curr = this.current();
    return (curr as any)?.[key] ?? 0;
  }

  // Tiền bị đặt chỗ = dành lương + dành nhà cung cấp
  reservedTotal(): number {
    const c = this.current();
    if (!c) return 0;
    return (
      (c.reservedPayroll ?? 0) +
      (c.reservedInterest ?? 0) +
      (c.reservedPayables ?? 0) +
      (c.reservedSuppliers ?? 0) +
      (c.reservedAgents ?? 0) +
      (c.reservedOther ?? 0)
    );
  }
}
