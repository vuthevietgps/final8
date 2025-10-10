/**
 * File: features/advertising-cost2/advertising-cost2.component.ts
 * Mục đích: Chi Phí Quảng Cáo 2 - bảng chỉnh sửa trực tiếp, thêm nhanh một hàng.
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdvertisingCost, CreateAdvertisingCost } from '../advertising-cost/models/advertising-cost.model';
import { AdvertisingCostService } from '../advertising-cost/advertising-cost.service';
import { lastValueFrom } from 'rxjs';
import { AdAccountService } from '../ad-account/ad-account.service';
import { AdAccount } from '../ad-account/models/ad-account.model';

@Component({
  selector: 'app-advertising-cost2',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './advertising-cost2.component.html',
  styleUrls: ['./advertising-cost2.component.css']
})
export class AdvertisingCost2Component implements OnInit {
  items = signal<AdvertisingCost[]>([]);
  adAccounts = signal<AdAccount[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  filterAdAccountId = signal('all');

  constructor(private service: AdvertisingCostService, private adAccountService: AdAccountService) {}

  ngOnInit(): void { this.loadAdAccounts(); this.load(); }

  loadAdAccounts(): void {
    this.adAccountService.getAdAccounts().subscribe({
      next: acs => this.adAccounts.set(acs),
      error: err => console.error('Load ad accounts error', err)
    });
  }

  private toIsoFromDdMmYyyy(input: string): string {
    const m = (input || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return input; // assume already ISO
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  private toDdMmYyyy(iso: string): string {
    const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return iso;
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const filter = this.filterAdAccountId() !== 'all' ? { adAccountId: this.filterAdAccountId() } : undefined;
    this.service.getAll(filter).subscribe({
      next: rows => {
        const normalized = (rows || []).map(r => ({
          ...r,
          date: this.toDdMmYyyy((r as any).date?.slice(0,10) || new Date().toISOString().slice(0,10))
        } as AdvertisingCost));
        this.items.set(normalized);
        this.loading.set(false);
      },
      error: err => { console.error(err); this.error.set('Không thể tải dữ liệu'); this.loading.set(false); }
    });
  }

  onFilterChange(): void { this.load(); }

  addNew(): void {
    const todayIso = new Date().toISOString().slice(0,10);
    this.loading.set(true);
    this.service.create({
      date: todayIso,
      adGroupId: '0',
      frequency: null as any,
      spentAmount: 0,
      cpm: 0,
      cpc: 0,
    }).subscribe({
      next: created => {
        const normalized = { ...created, date: this.toDdMmYyyy(created.date?.slice(0,10) || todayIso) } as AdvertisingCost;
        this.items.update(list => [normalized, ...list]);
        this.loading.set(false);
      },
      error: err => { console.error(err); this.error.set('Không thể tạo bản ghi'); this.loading.set(false); }
    });
  }

  // ================= CSV Export/Import =================
  private csvEscape(val: any): string {
    const s = (val ?? '').toString();
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  downloadCsv(): void {
    const headers = ['date','adGroupId','spentAmount','cpm','cpc'];
    const rows = this.items().map(r => [
      r.date || '',
      r.adGroupId || '',
      r.spentAmount ?? 0,
      r.cpm ?? 0,
      r.cpc ?? 0,
    ]);
    const lines = [headers, ...rows]
      .map(cols => cols.map(c => this.csvEscape(c)).join(','))
      .join('\r\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + lines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'advertising-cost2.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let i = 0, field = '', row: string[] = [], inQuotes = false;
    // Remove BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    while (i < text.length) {
      const ch = text[i++];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { row.push(field); field = ''; }
        else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (ch === '\r') { /* skip */ }
        else { field += ch; }
      }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
  }

  async onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    const text = await file.text();
    await this.uploadCsvText(text);
    // reset input so selecting the same file again still triggers change
    input.value = '';
  }

  private normalizeDateToIso(s: string): string {
    const trimmed = (s || '').trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) return this.toIsoFromDdMmYyyy(trimmed);
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0,10);
    return new Date().toISOString().slice(0,10);
  }

  private async uploadCsvText(text: string) {
    const rows = this.parseCsv(text);
    if (!rows.length) return;
    // map header indexes
    const header = rows[0].map(h => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name.toLowerCase());
    const iDate = idx('date');
    const iAdGroup = idx('adGroupId') >= 0 ? idx('adGroupId') : idx('adgroupid');
    const iSpent = idx('spentAmount') >= 0 ? idx('spentAmount') : idx('spentamount');
    const iCpm = idx('cpm');
    const iCpc = idx('cpc');
    const payloads: CreateAdvertisingCost[] = [];
    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r]; if (!cols || cols.length === 0) continue;
      const date = this.normalizeDateToIso(cols[iDate] ?? '');
      const adGroupId = (cols[iAdGroup] ?? '0').toString();
      const spentAmount = parseFloat(cols[iSpent] ?? '0') || 0;
      const cpm = parseFloat(cols[iCpm] ?? '0') || 0;
      const cpc = parseFloat(cols[iCpc] ?? '0') || 0;
      payloads.push({ date, adGroupId, spentAmount, cpm, cpc } as CreateAdvertisingCost);
    }
    this.loading.set(true);
    let ok = 0, fail = 0;
    for (const p of payloads) {
      try { await lastValueFrom(this.service.create(p)); ok++; }
      catch (e) { console.error(e); fail++; }
    }
    this.loading.set(false);
    this.load();
    if (fail) this.error.set(`Nhập CSV hoàn tất: ${ok} thành công, ${fail} lỗi.`);
  }

  onEnter(row: AdvertisingCost, field: keyof AdvertisingCost, ev: KeyboardEvent) {
    if (ev.key === 'Enter') {
      (ev.target as HTMLElement).blur();
    }
  }

  onBlur(row: AdvertisingCost, field: keyof AdvertisingCost, ev: Event) {
    const target = ev.target as HTMLInputElement;
    let value: any = target.value;
    if (field === 'date') {
      value = this.toIsoFromDdMmYyyy(value);
    }
    if (['spentAmount','cpm','cpc','frequency'].includes(field as string)) {
      value = parseFloat(value);
      if (isNaN(value)) value = 0;
    }
    const id = row._id as string;
    const payload: any = { [field]: value };
    this.service.update(id, payload).subscribe({
      next: updated => {
        // reflect UI format for date back to dd/MM/yyyy
        const patched: any = { ...updated };
        patched.date = this.toDdMmYyyy((updated as any).date?.slice(0,10) || '');
        this.items.update(list => list.map(r => (r._id === id ? patched : r)));
      },
      error: err => console.error(err)
    });
  }

  remove(row: AdvertisingCost): void {
    if (!confirm('Xóa bản ghi này?')) return;
    const id = row._id as string;
    this.service.delete(id).subscribe({
      next: () => this.items.update(list => list.filter(r => r._id !== id)),
      error: err => console.error(err)
    });
  }
}
