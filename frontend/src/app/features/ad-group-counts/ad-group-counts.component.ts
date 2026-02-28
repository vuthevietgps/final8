/**
 * File: features/ad-group-counts/ad-group-counts.component.ts
 * Mục đích: Hiển thị 3 cột: Sản phẩm | Số nhóm QC đang hoạt động | Số nhóm QC tạm dừng
 */
import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdGroupService } from '../ad-group/ad-group.service';

interface Row {
  productId: string;
  productName: string;
  active: number;
  inactive: number;
  standardQuantity: number;
}

@Component({
  selector: 'app-ad-group-counts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ad-group-counts.component.html',
  styleUrls: ['./ad-group-counts.component.css']
})
export class AdGroupCountsComponent implements OnInit {
  rows = signal<Row[]>([]);
  isLoading = signal(false);

  // Totals for summary chips
  totalActive = computed(() => this.rows().reduce((sum, r) => sum + (r.active || 0), 0));
  totalInactive = computed(() => this.rows().reduce((sum, r) => sum + (r.inactive || 0), 0));
  totalProducts = computed(() => this.rows().length);

  constructor(
    private adGroupService: AdGroupService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.adGroupService.getCountsByProduct().subscribe({
      next: (counts) => {
        const rows: Row[] = (counts || []).map((c: any) => ({
          productId: c.productId,
          productName: (c.productName || '').trim() || 'Không xác định',
          active: Number(c.active || 0),
          inactive: Number(c.inactive || 0),
          standardQuantity: 9,
        }));
        this.rows.set(rows);
        this.isLoading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.isLoading.set(false);
      }
    });
  }

  refresh(): void {
    this.load();
  }

  updateStandardQuantity(index: number, value: string): void {
    const num = parseInt(value || '0', 10);
    if (!isNaN(num) && num >= 0) {
      const currentRows = this.rows();
      currentRows[index].standardQuantity = num;
      this.rows.set([...currentRows]);
    }
  }

  getSuggestion(row: Row): number {
    return row.standardQuantity - row.active;
  }

  getSuggestionClass(row: Row): string {
    const suggestion = this.getSuggestion(row);
    if (suggestion < 6) return 'suggestion-red';
    if (suggestion >= 6 && suggestion <= 9) return 'suggestion-yellow';
    return 'suggestion-green';
  }
}
