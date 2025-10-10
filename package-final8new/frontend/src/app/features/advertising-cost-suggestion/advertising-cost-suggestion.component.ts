/**
 * File: advertising-cost-suggestion.component.ts
 * Mục đích: Component quản lý đề xuất chi phí quảng cáo
 * Chức năng: CRUD operations, tích hợp với ad-group và advertising-cost2
 */
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { 
  AdvertisingCostSuggestion, 
  AdvertisingCostSuggestionStatistics,
  CreateAdvertisingCostSuggestionRequest
} from './models/advertising-cost-suggestion.interface';
import { AdvertisingCostSuggestionService } from './advertising-cost-suggestion.service';

@Component({
  selector: 'app-advertising-cost-suggestion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './advertising-cost-suggestion.component.html',
  styleUrls: ['./advertising-cost-suggestion.component.css']
})
export class AdvertisingCostSuggestionComponent implements OnInit {
  // Signals for reactive UI
  suggestions = signal<AdvertisingCostSuggestion[]>([]);
  statistics = signal<AdvertisingCostSuggestionStatistics | null>(null);
  adGroups = signal<any[]>([]);
  advertisingCosts = signal<any[]>([]); // Chi phí ngày hôm qua
  combinedData = signal<any[]>([]); // Kết hợp ad groups và suggestions
  loading = signal(false);
  error = signal<string | null>(null);
  recommendedBudgets = signal<Record<string, number>>({});
  recommendLoading = signal(false);
  
  // Form data - ẩn form vì không cần thiết nữa
  showAddForm = signal(false);
  editingId = signal<string | null>(null);
  formData = signal<CreateAdvertisingCostSuggestionRequest>({
    adGroupId: '',
    adGroupName: '',
    suggestedCost: 0,
    dailyCost: 0,
    isActive: true,
    notes: ''
  });

  // Computed values
  totalSuggestions = computed(() => this.suggestions().length);
  activeSuggestions = computed(() => this.suggestions().filter(s => s.isActive !== false).length);
  filteredSuggestions = computed(() => this.suggestions().filter(s => s.isActive !== false));
  
  // Combined data: merge ad groups với suggestions
  combinedDataComputed = computed(() => {
    const adGroups = this.adGroups();
    const suggestions = this.suggestions();
    const advertisingCosts = this.advertisingCosts();
    
    return adGroups.map(adGroup => {
      const suggestion = suggestions.find(s => s.adGroupId === adGroup.adGroupId);
      const yesterdayCost = this.getDailyCostByAdGroupId(adGroup.adGroupId);
      const suggestedCost = suggestion?.suggestedCost || 0;
      
      // Tính toán chênh lệch (chi phí hôm qua - chi phí đề xuất)
      const dailyDifference = yesterdayCost - suggestedCost;
      const dailyDifferencePercent = suggestedCost > 0 ? (dailyDifference / suggestedCost) * 100 : 0;
      
      return {
        adGroupId: adGroup.adGroupId, // Sử dụng adGroupId thật thay vì _id
        adGroupName: adGroup.name,
        suggestedCost: suggestedCost,
        dailyCost: yesterdayCost, // Chi phí ngày hôm qua
        dailyDifference: dailyDifference,
        dailyDifferencePercent: dailyDifferencePercent,
        isActive: suggestion?.isActive !== false,
        notes: suggestion?.notes || '',
        suggestionId: suggestion?._id || null, // null nếu chưa có suggestion
        hasChanges: false // flag để track changes
      };
    });
  });

  constructor(
    private suggestionService: AdvertisingCostSuggestionService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    this.error.set(null);
    
    console.log('Starting loadData...');
    
    // Load từng phần riêng biệt để tránh fail cascade
    await this.loadSuggestions();
    await this.loadStatistics();
    await this.loadAdGroups();
    await this.loadAdvertisingCosts();
    await this.loadRecommendedBudgets();
    
    this.loading.set(false);
    console.log('Final state:', {
      adGroups: this.adGroups().length,
      suggestions: this.suggestions().length,
      advertisingCosts: this.advertisingCosts().length
    });
  }

  async loadSuggestions() {
    try {
      const response = await firstValueFrom(this.suggestionService.getAllSuggestions());
      if (response && response.data) {
        this.suggestions.set(response.data);
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
      throw error;
    }
  }

  async loadStatistics() {
    try {
      const response = await firstValueFrom(this.suggestionService.getStatistics());
      if (response && response.data) {
        this.statistics.set(response.data);
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  }

  async loadAdGroups() {
    try {
      console.log('Loading ad groups...');
  const response = await firstValueFrom(this.http.get<any>(`${environment.apiUrl}/ad-groups`));
      console.log('Ad groups response:', response);
      if (response) {
        // API trả về array trực tiếp, không có wrapper object
        const adGroups = Array.isArray(response) ? response : [];
        console.log('Setting ad groups:', adGroups.length, 'items');
        this.adGroups.set(adGroups);
      }
    } catch (error) {
      console.error('Error loading ad groups:', error);
    }
  }

  async loadAdvertisingCosts() {
    try {
      console.log('Loading advertising costs from yesterday...');
      const response = await firstValueFrom(
  this.http.get<any>(`${environment.apiUrl}/advertising-cost-public/yesterday-spent`)
      );
      console.log('Yesterday spent response:', response);
      
      if (response && response.data) {
        // Convert map to array format for easier processing
        const costsArray = Object.entries(response.data).map(([adGroupId, spentAmount]) => ({
          adGroupId,
          spentAmount: spentAmount as number
        }));
        this.advertisingCosts.set(costsArray);
        
        const totalSpent = costsArray.reduce((sum, item) => sum + (item.spentAmount || 0), 0);
        console.log(`Setting yesterday costs: ${costsArray.length} ad groups, total spent: ${totalSpent}`);
        
        if (costsArray.length === 0) {
          console.log('No advertising cost data found for yesterday - all costs will show as 0');
        }
      } else {
        console.log('No cost data received - all costs will show as 0');
        this.advertisingCosts.set([]);
      }
    } catch (error) {
      console.error('Error loading advertising costs:', error);
      this.advertisingCosts.set([]); // Ensure empty array on error
      console.log('Set empty array due to error - all costs will show as 0');
    }
  }

  async loadRecommendedBudgets(){
    try {
      this.recommendLoading.set(true);
      const today = new Date();
      const from = new Date(today.getTime() - 7*86400000).toISOString().split('T')[0];
      const to = today.toISOString().split('T')[0];
  const data: any = await firstValueFrom(this.http.get(`${environment.apiUrl}/profit-forecast/recommended-budget?from=${from}&to=${to}`));
      if (Array.isArray(data)) {
        const map: Record<string, number> = {};
        data.forEach(item => { map[item.adGroupId] = item.recommendedDailySpend; });
        this.recommendedBudgets.set(map);
      }
    } catch (e) {
      console.warn('Cannot load recommended budgets', e);
    } finally {
      this.recommendLoading.set(false);
    }
  }

  // Get yesterday spent amount for ad group from advertising-cost
  getDailyCostByAdGroupId(adGroupId: string): number {
    const cost = this.advertisingCosts().find(c => c.adGroupId === adGroupId);
    return cost ? cost.spentAmount || 0 : 0;
  }

  // Show add form
  showAdd() {
    this.showAddForm.set(true);
    this.editingId.set(null);
    this.resetForm();
  }

  // Hide forms
  hideForm() {
    this.showAddForm.set(false);
    this.editingId.set(null);
    this.resetForm();
  }

  // Reset form
  resetForm() {
    this.formData.set({
      adGroupId: '',
      adGroupName: '',
      suggestedCost: 0,
      dailyCost: 0,
      isActive: true,
      notes: ''
    });
  }

  // Handle ad group selection
  onAdGroupSelected(adGroupId: string) {
    const adGroup = this.adGroups().find(ag => ag.adGroupId === adGroupId);
    if (adGroup) {
      const currentForm = this.formData();
      const dailyCost = this.getDailyCostByAdGroupId(adGroupId);
      this.formData.set({
        ...currentForm,
        adGroupId: adGroupId,
        adGroupName: adGroup.name,
        dailyCost: dailyCost
      });
    }
  }

  // Submit form
  async onSubmit() {
    const form = this.formData();
    
    if (!form.adGroupId || !form.adGroupName || form.suggestedCost <= 0) {
      this.error.set('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    try {
      this.loading.set(true);
      this.error.set(null);

      if (this.editingId()) {
        // Update existing
        await this.suggestionService.updateSuggestion(this.editingId()!, form).toPromise();
      } else {
        // Create new
        await this.suggestionService.createSuggestion(form).toPromise();
      }

      await this.loadData();
      this.hideForm();
    } catch (error) {
      console.error('Error saving suggestion:', error);
      this.error.set('Không thể lưu đề xuất chi phí. Vui lòng thử lại.');
    } finally {
      this.loading.set(false);
    }
  }

  // Edit suggestion
  editSuggestion(suggestion: AdvertisingCostSuggestion) {
    this.editingId.set(suggestion._id!);
    this.showAddForm.set(true);
    this.formData.set({
      adGroupId: suggestion.adGroupId,
      adGroupName: suggestion.adGroupName,
      suggestedCost: suggestion.suggestedCost,
      dailyCost: suggestion.dailyCost,
      isActive: suggestion.isActive,
      notes: suggestion.notes || ''
    });
  }

  // Delete suggestion
  async deleteSuggestion(suggestion: AdvertisingCostSuggestion) {
    if (!confirm(`Bạn có chắc muốn xóa đề xuất chi phí cho "${suggestion.adGroupName}"?`)) {
      return;
    }

    try {
      this.loading.set(true);
      await this.suggestionService.deleteSuggestion(suggestion._id!).toPromise();
      await this.loadData();
    } catch (error) {
      console.error('Error deleting suggestion:', error);
      this.error.set('Không thể xóa đề xuất chi phí. Vui lòng thử lại.');
    } finally {
      this.loading.set(false);
    }
  }

  // Update suggested cost (inline editing) - với auto-create
  async updateSuggestedCost(rowData: any, event: Event) {
    const input = event.target as HTMLInputElement;
    const newValue = parseFloat(input.value) || 0;
    
    if (newValue !== rowData.suggestedCost) {
      try {
        this.loading.set(true);
        
        if (rowData.suggestionId) {
          // Cập nhật suggestion có sẵn
          await firstValueFrom(this.suggestionService.updateSuggestion(rowData.suggestionId, {
            suggestedCost: newValue
          }));
        } else {
          // Tạo suggestion mới cho ad group này
          await firstValueFrom(this.suggestionService.createSuggestion({
            adGroupId: rowData.adGroupId,
            adGroupName: rowData.adGroupName,
            suggestedCost: newValue,
            dailyCost: rowData.dailyCost,
            isActive: true,
            notes: rowData.notes
          }));
        }
        
        await this.loadData();
      } catch (error) {
        console.error('Error updating suggested cost:', error);
        this.error.set('Không thể cập nhật chi phí đề xuất');
        // Revert input value
        input.value = rowData.suggestedCost.toString();
      } finally {
        this.loading.set(false);
      }
    }
  }
  
  // Update notes inline
  async updateNotes(rowData: any, event: Event) {
    const input = event.target as HTMLInputElement;
    const newValue = input.value.trim();
    
    if (newValue !== rowData.notes) {
      try {
        this.loading.set(true);
        
        if (rowData.suggestionId) {
          // Cập nhật suggestion có sẵn
          await firstValueFrom(this.suggestionService.updateSuggestion(rowData.suggestionId, {
            notes: newValue
          }));
        } else if (rowData.suggestedCost > 0) {
          // Tạo suggestion mới nếu có chi phí đề xuất
          await firstValueFrom(this.suggestionService.createSuggestion({
            adGroupId: rowData.adGroupId,
            adGroupName: rowData.adGroupName,
            suggestedCost: rowData.suggestedCost,
            dailyCost: rowData.dailyCost,
            isActive: true,
            notes: newValue
          }));
        }
        
        await this.loadData();
      } catch (error) {
        console.error('Error updating notes:', error);
        this.error.set('Không thể cập nhật ghi chú');
        // Revert input value
        input.value = rowData.notes;
      } finally {
        this.loading.set(false);
      }
    }
  }

  // Sync daily costs from advertising-cost (yesterday spent)
  async syncDailyCosts() {
    try {
      this.loading.set(true);
      
      for (const suggestion of this.suggestions()) {
        const yesterdayCost = this.getDailyCostByAdGroupId(suggestion.adGroupId);
        if (yesterdayCost !== suggestion.dailyCost) {
          await firstValueFrom(this.suggestionService.updateDailyCost(suggestion.adGroupId, yesterdayCost));
        }
      }
      
      await this.loadData();
    } catch (error) {
      console.error('Error syncing daily costs:', error);
      this.error.set('Không thể đồng bộ chi phí ngày hôm qua');
    } finally {
      this.loading.set(false);
    }
  }

  // Apply recommended budgets to rows without suggestion or zero cost
  applyRecommendationsToEmpty() {
    const rec = this.recommendedBudgets();
    const rows = this.combinedDataComputed();
    let applied = 0;
    rows.forEach(r => {
      if ((!r.suggestionId || r.suggestedCost === 0) && rec[r.adGroupId]) {
        const fakeEvent = { target: { value: rec[r.adGroupId].toString() } } as any as Event;
        this.updateSuggestedCost(r, fakeEvent);
        applied++;
      }
    });
    if (applied === 0) {
      console.log('No recommendations applied');
    }
  }

  // Format currency
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value);
  }

  // Format percentage
  formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  // Get difference color class
  getDifferenceColorClass(difference: number): string {
    if (difference > 0) return 'text-success'; // Green for positive (actual > suggested)
    if (difference < 0) return 'text-danger';  // Red for negative (actual < suggested)
    return 'text-muted'; // Gray for zero
  }
}