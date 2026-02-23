import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AvailableFundsService, RealAvailableFunds, AvailableFunds } from './available-funds.service';

@Component({
  selector: 'app-available-funds',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './available-funds.component.html',
  styleUrls: ['./available-funds.component.css']
})
export class AvailableFundsComponent implements OnInit {
  private service = inject(AvailableFundsService);

  current = signal<RealAvailableFunds | null>(null);
  snapshots = signal<AvailableFunds[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  
  selectedMode = signal<'conservative' | 'moderate' | 'aggressive'>('conservative');

  ngOnInit(): void {
    this.loadCurrent();
    this.loadSnapshots();
  }

  loadCurrent(): void {
    this.loading.set(true);
    this.error.set(null);
    
    this.service.getCurrent(this.selectedMode()).subscribe({
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
  }

  onModeChange(mode: 'conservative' | 'moderate' | 'aggressive'): void {
    this.selectedMode.set(mode);
    this.loadCurrent();
  }

  capture(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.capture({ note: 'manual-capture' }).subscribe({
      next: () => {
        this.loading.set(false);
        this.loadSnapshots();
        this.loadCurrent();
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
    return val < 0 ? `-${formatted}` : `+${formatted}`;
  }

  getModeLabel(mode: string): string {
    switch (mode) {
      case 'conservative': return '🟢 An toàn (Chỉ đơn đã thanh toán cả 2 bên)';
      case 'moderate': return '🟡 Cân bằng (Hệ số chiết khấu)';
      case 'aggressive': return '🔴 Rủi ro (Ước tính + Vay)';
      default: return mode;
    }
  }

  getRiskBadge(mode: string): string {
    switch (mode) {
      case 'conservative': return 'LOW';
      case 'moderate': return 'MEDIUM';
      case 'aggressive': return 'HIGH';
      default: return '';
    }
  }
}
