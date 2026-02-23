import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CapitalAllocationService } from './capital-allocation.service';
import {
  CapitalAllocationPolicy,
  AllocationComputation,
  CapitalAllocationSnapshot,
  ReinvestmentBudget
} from './capital-allocation.model';

@Component({
  selector: 'app-capital-allocation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './capital-allocation.component.html',
  styleUrls: ['./capital-allocation.component.css']
})
export class CapitalAllocationComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(CapitalAllocationService);

  // Expose Math for template
  Math = Math;

  // Signals
  policies = signal<CapitalAllocationPolicy[]>([]);
  activePolicy = signal<CapitalAllocationPolicy | null>(null);
  currentAllocation = signal<AllocationComputation | null>(null);
  latestSnapshot = signal<CapitalAllocationSnapshot | null>(null);
  reinvestmentBudget = signal<ReinvestmentBudget | null>(null);
  snapshots = signal<CapitalAllocationSnapshot[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  showPolicyForm = signal(false);

  // Form tạo policy mới
  policyForm = this.fb.group({
    name: ['', Validators.required],
    description: [''],
    reinvestmentRatio: [45, [Validators.required, Validators.min(0), Validators.max(100)]],
    safetyReserveRatio: [25, [Validators.required, Validators.min(0), Validators.max(100)]],
    personalIncomeRatio: [20, [Validators.required, Validators.min(0), Validators.max(100)]],
    longTermAssetRatio: [10, [Validators.required, Validators.min(0), Validators.max(100)]],
    notes: ['']
  });

  ngOnInit(): void {
    this.loadAllData();
  }

  loadAllData(): void {
    this.loading.set(true);
    this.error.set(null);

    Promise.all([
      this.service.getAllPolicies().toPromise(),
      this.service.getActivePolicy().toPromise().catch(() => null),
      this.service.computeAllocation().toPromise().catch(() => null),
      this.service.getLatestSnapshot().toPromise().catch(() => null),
      this.service.getReinvestmentBudget().toPromise(),
      this.service.getSnapshots(10).toPromise()
    ])
      .then(([policies, active, allocation, snapshot, budget, snapshots]) => {
        this.policies.set(policies || []);
        this.activePolicy.set(active || null);
        this.currentAllocation.set(allocation || null);
        this.latestSnapshot.set(snapshot || null);
        this.reinvestmentBudget.set(budget || { totalAllocated: 0, totalUsed: 0, available: 0 });
        this.snapshots.set(snapshots || []);
      })
      .catch(err => {
        this.error.set('Lỗi tải dữ liệu: ' + err.message);
      })
      .finally(() => {
        this.loading.set(false);
      });
  }

  getTotalRatio(): number {
    const form = this.policyForm.value;
    return (form.reinvestmentRatio || 0) + (form.safetyReserveRatio || 0) +
           (form.personalIncomeRatio || 0) + (form.longTermAssetRatio || 0);
  }

  createPolicy(): void {
    if (this.policyForm.invalid) {
      alert('Vui lòng điền đầy đủ thông tin');
      return;
    }

    const total = this.getTotalRatio();
    if (Math.abs(total - 100) > 0.01) {
      alert(`Tổng tỷ lệ phải = 100%. Hiện tại: ${total}%`);
      return;
    }

    this.loading.set(true);
    this.service.createPolicy(this.policyForm.value as any)
      .subscribe({
        next: () => {
          alert('✅ Tạo policy thành công!');
          this.showPolicyForm.set(false);
          this.policyForm.reset({
            reinvestmentRatio: 45,
            safetyReserveRatio: 25,
            personalIncomeRatio: 20,
            longTermAssetRatio: 10
          });
          this.loadAllData();
        },
        error: (err) => {
          alert('❌ Lỗi: ' + err.error?.message || err.message);
          this.loading.set(false);
        }
      });
  }

  activatePolicy(policy: CapitalAllocationPolicy): void {
    if (confirm(`Kích hoạt policy "${policy.name}"?`)) {
      this.loading.set(true);
      this.service.updatePolicy(policy._id!, { isActive: true })
        .subscribe({
          next: () => {
            alert('✅ Đã kích hoạt policy!');
            this.loadAllData();
          },
          error: (err) => {
            alert('❌ Lỗi: ' + err.error?.message || err.message);
            this.loading.set(false);
          }
        });
    }
  }

  deletePolicy(policy: CapitalAllocationPolicy): void {
    if (policy.isActive) {
      alert('Không thể xóa policy đang active');
      return;
    }

    if (confirm(`Xóa policy "${policy.name}"?`)) {
      this.loading.set(true);
      this.service.deletePolicy(policy._id!)
        .subscribe({
          next: () => {
            alert('✅ Đã xóa policy!');
            this.loadAllData();
          },
          error: (err) => {
            alert('❌ Lỗi: ' + err.error?.message || err.message);
            this.loading.set(false);
          }
        });
    }
  }

  captureSnapshot(): void {
    if (confirm('Chụp snapshot phân bổ vốn hiện tại?')) {
      this.loading.set(true);
      this.service.captureSnapshot('manual-capture')
        .subscribe({
          next: () => {
            alert('✅ Đã tạo snapshot!');
            this.loadAllData();
          },
          error: (err) => {
            alert('❌ Lỗi: ' + err.error?.message || err.message);
            this.loading.set(false);
          }
        });
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('vi-VN');
  }

  getPercentage(amount: number, total: number): number {
    return total > 0 ? (amount / total) * 100 : 0;
  }
}
