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
  // Manual FB sync
  syncLoading = signal(false);
  syncDate = signal<string>('');
  syncDays = signal<number>(1);
  // Total spent by adGroupId for each row
  totalSpentByGroup = signal<Map<string, number>>(new Map());
  // Conversation cost by adGroupId for each row  
  conversationCostByGroup = signal<Map<string, { totalSpent: number; conversationCount: number; costPerConversation: number }>>(new Map());

  // Filters
  filterAdAccountId = signal('all');
  filterChannel = signal<'all' | 'facebook' | 'google' | 'tiktok' | 'zalo' | 'other'>('all');

  // UI
  showModal = signal(false);
  editingId: string | null = null;

  // Upload Excel
  showUploadSection = signal(false);
  selectedFile: File | null = null;
  uploadProgress = signal<any | null>(null);
  uploadLoading = signal(false);

  // Google Ads sync
  syncGoogleLoading = signal(false);
  syncGoogleDate = signal<string>('');
  syncGoogleDays = signal<number>(1);

  // TikTok Ads sync
  syncTikTokLoading = signal(false);
  syncTikTokDate = signal<string>('');
  syncTikTokDays = signal<number>(1);

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
    // default sync date: yesterday
    const yesterday = new Date(Date.now() - 24*60*60*1000).toISOString().slice(0,10);
    this.syncDate.set(yesterday);
    this.syncDays.set(1);
    this.syncGoogleDate.set(yesterday);
    this.syncGoogleDays.set(1);
    this.syncTikTokDate.set(yesterday);
    this.syncTikTokDays.set(1);
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
    const filter: any = {};
    if (this.filterAdAccountId() !== 'all') filter.adAccountId = this.filterAdAccountId();
    if (this.filterChannel() !== 'all') filter.channel = this.filterChannel();
    this.service.getAll(filter).subscribe({
      next: (data) => {
        // chuẩn hoá hiển thị ngày theo mm/dd/yyyy
        const normalized = data.map(d => ({
          ...d,
          channel: d.channel || 'facebook',
          date: this.toMmDdYyyy(d.date?.slice(0,10) || new Date().toISOString().slice(0,10))
        } as AdvertisingCost));
        this.items.set(normalized);
        
        // Load total spent for each unique adGroupId
        this.loadTotalSpentByGroups(normalized);
        
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Không tải được dữ liệu');
        this.loading.set(false);
      },
    });

    this.service.getSummary(this.filterChannel()).subscribe({
      next: (sum) => this.summary.set(sum),
      error: () => this.summary.set({ totalSpent: 0, count: 0, avgCPM: 0, avgCPC: 0 }),
    });
  }

  private loadTotalSpentByGroups(items: AdvertisingCost[]) {
    const uniqueAdGroupIds = Array.from(new Set(items.map(item => item.adGroupId)));
    const totalMap = new Map<string, number>();
    const conversationMap = new Map<string, { totalSpent: number; conversationCount: number; costPerConversation: number }>();
    
    // Load total spent and conversation cost for each unique adGroupId
    uniqueAdGroupIds.forEach(adGroupId => {
      // Load total spent
      this.service.getTotalSpentByAdGroup(adGroupId).subscribe({
        next: (result) => {
          totalMap.set(adGroupId, result.totalSpent);
          this.totalSpentByGroup.set(new Map(totalMap));
        },
        error: (err) => {
          console.error(`Error loading total spent for adGroupId ${adGroupId}:`, err);
          totalMap.set(adGroupId, 0);
          this.totalSpentByGroup.set(new Map(totalMap));
        }
      });

      // Load conversation cost
      this.service.getConversationCostByAdGroup(adGroupId).subscribe({
        next: (result) => {
          conversationMap.set(adGroupId, result);
          this.conversationCostByGroup.set(new Map(conversationMap));
        },
        error: (err) => {
          console.error(`Error loading conversation cost for adGroupId ${adGroupId}:`, err);
          conversationMap.set(adGroupId, { totalSpent: 0, conversationCount: 0, costPerConversation: 0 });
          this.conversationCostByGroup.set(new Map(conversationMap));
        }
      });
    });
  }

  onFilterChange() {
    this.loadData();
  }

  setChannelFilter(channel: 'all' | 'facebook' | 'google' | 'tiktok' | 'zalo' | 'other') {
    this.filterChannel.set(channel);
    this.onFilterChange();
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
      channel: this.filterChannel() === 'all' ? 'facebook' : (this.filterChannel() as any),
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

  // ===== UPLOAD EXCEL METHODS =====
  
  toggleUploadSection() {
    this.showUploadSection.update(val => !val);
    if (!this.showUploadSection()) {
      this.resetUpload();
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      this.selectedFile = file;
      this.error.set(null);
    } else {
      this.selectedFile = null;
      this.error.set('Vui lòng chọn file Excel (.xlsx hoặc .xls)');
    }
  }

  uploadExcel() {
    if (!this.selectedFile) {
      this.error.set('Vui lòng chọn file Excel');
      return;
    }

    this.uploadLoading.set(true);
    this.uploadProgress.set(null);
    this.error.set(null);

    this.service.uploadFacebookExcel(this.selectedFile).subscribe({
      next: (result) => {
        this.uploadLoading.set(false);
        this.uploadProgress.set(result);
        
        // Reload data to show updates
        this.loadData();
        
        // Reset file input
        this.resetUpload();
      },
      error: (err) => {
        console.error('Upload error:', err);
        this.uploadLoading.set(false);
        this.error.set(err.error?.message || 'Lỗi khi tải file Excel');
      }
    });
  }

  resetUpload() {
    this.selectedFile = null;
    this.uploadProgress.set(null);
    // Reset file input
    const fileInput = document.getElementById('excelFileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  // ===== Manual Facebook sync =====
  syncFacebook() {
    this.syncLoading.set(true);
    const date = this.syncDate();
    const days = this.syncDays();
    this.service.fetchFacebookCost({ date, days }).subscribe({
      next: () => {
        this.syncLoading.set(false);
        this.loadData();
      },
      error: (err) => {
        console.error('Sync FB cost error', err);
        this.syncLoading.set(false);
        this.error.set(err?.error?.message || 'Không thể đồng bộ chi phí từ Facebook');
      }
    });
  }

  // ===== Manual Google sync =====
  syncGoogle() {
    this.syncGoogleLoading.set(true);
    const date = this.syncGoogleDate();
    const days = this.syncGoogleDays();
    this.service.fetchGoogleCost({ date, days }).subscribe({
      next: () => {
        this.syncGoogleLoading.set(false);
        this.setChannelFilter('google');
      },
      error: (err) => {
        console.error('Sync Google Ads cost error', err);
        this.syncGoogleLoading.set(false);
        this.error.set(err?.error?.message || 'Không thể đồng bộ chi phí từ Google Ads');
      }
    });
  }

  // ===== Manual TikTok sync =====
  syncTikTok() {
    this.syncTikTokLoading.set(true);
    const date = this.syncTikTokDate();
    const days = this.syncTikTokDays();
    this.service.fetchTikTokCost({ date, days }).subscribe({
      next: () => {
        this.syncTikTokLoading.set(false);
        this.setChannelFilter('tiktok');
      },
      error: (err) => {
        console.error('Sync TikTok Ads cost error', err);
        this.syncTikTokLoading.set(false);
        this.error.set(err?.error?.message || 'Không thể đồng bộ chi phí từ TikTok Ads');
      }
    });
  }
}
