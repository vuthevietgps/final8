/**
 * File: frontend/src/app/features/advertising-cost-suggestion/ai-optimization-panel.component.ts
 * Mục đích: Component điều khiển AI optimization và auto mode
 */
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdvertisingCostSuggestionService } from './advertising-cost-suggestion.service';

@Component({
  selector: 'app-ai-optimization-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-optimization-panel.component.html',
  styleUrls: ['./ai-optimization-panel.component.css']
})
export class AIOptimizationPanelComponent implements OnInit {
  // Signals
  optimizing = signal(false);
  adGroups = signal<any[]>([]);
  pendingRecommendations = signal<any[]>([]);
  optimizationLog = signal<any[]>([]);
  
  stats = computed(() => {
    const adGroupsData = this.adGroups();
    return {
      totalAdGroups: adGroupsData.length,
      autoModeEnabled: adGroupsData.filter(ag => ag.autoModeEnabled).length,
      pendingRecommendations: this.pendingRecommendations().length,
      lastOptimization: '10:00 AM hôm nay' // Mock data
    };
  });

  adGroupsWithAutoMode = computed(() => {
    return this.adGroups().map(ag => ({
      ...ag,
      autoModeEnabled: ag.autoModeEnabled || false,
      roi: this.calculateROI(ag)
    }));
  });

  constructor(
    private suggestionService: AdvertisingCostSuggestionService
  ) {}

  async ngOnInit() {
    await this.loadData();
  }

  private async loadData() {
    try {
      // Load suggestions và calculate auto mode status
      const suggestionsResponse = await this.suggestionService.getAllSuggestions().toPromise();
      if (suggestionsResponse?.data) {
        this.adGroups.set(suggestionsResponse.data);
      }

      // Load pending recommendations
      const pendingResponse = await this.suggestionService.getPendingRecommendations().toPromise();
      if (pendingResponse?.data) {
        this.pendingRecommendations.set(pendingResponse.data);
      }

      // Mock optimization log
      this.optimizationLog.set([
        {
          id: 1,
          timestamp: new Date(),
          action: 'Tăng ngân sách Ad Group 123',
          details: 'ROI 4.2 → Tăng 20% ngân sách',
          success: true
        },
        {
          id: 2,
          timestamp: new Date(Date.now() - 3600000),
          action: 'Tạm dừng Ad Group 456',
          details: 'ROI 0.8 → Tạm dừng để tiết kiệm chi phí',
          success: true
        }
      ]);

    } catch (error) {
      console.error('Failed to load AI optimization data:', error);
    }
  }

  async triggerManualOptimization() {
    this.optimizing.set(true);
    
    try {
      await this.suggestionService.triggerAIOptimization().toPromise();
      
      // Reload data after optimization
      setTimeout(() => {
        this.loadData();
        this.optimizing.set(false);
      }, 3000); // Mock delay

    } catch (error) {
      console.error('AI optimization failed:', error);
      this.optimizing.set(false);
    }
  }

  async toggleAutoMode(adGroupId: string, event: Event) {
    const checkbox = event.target as HTMLInputElement;
    const enabled = checkbox.checked;

    try {
      await this.suggestionService.toggleAutoMode(adGroupId, enabled).toPromise();
      
      // Update local state
      const currentAdGroups = this.adGroups();
      const updatedAdGroups = currentAdGroups.map(ag => 
        ag.adGroupId === adGroupId 
          ? { ...ag, autoModeEnabled: enabled }
          : ag
      );
      this.adGroups.set(updatedAdGroups);

    } catch (error) {
      console.error('Failed to toggle auto mode:', error);
      // Revert checkbox state on error
      checkbox.checked = !enabled;
    }
  }

  async approveRecommendation(recommendationId: string) {
    try {
      await this.suggestionService.approveRecommendation(recommendationId).toPromise();
      
      // Remove from pending list
      const currentPending = this.pendingRecommendations();
      const updatedPending = currentPending.filter(r => r.id !== recommendationId);
      this.pendingRecommendations.set(updatedPending);

      // Add to log
      this.addLogEntry(`Phê duyệt recommendation ${recommendationId}`, true);

    } catch (error) {
      console.error('Failed to approve recommendation:', error);
    }
  }

  async rejectRecommendation(recommendationId: string) {
    try {
      // Remove from pending list
      const currentPending = this.pendingRecommendations();
      const updatedPending = currentPending.filter(r => r.id !== recommendationId);
      this.pendingRecommendations.set(updatedPending);

      // Add to log
      this.addLogEntry(`Từ chối recommendation ${recommendationId}`, true);

    } catch (error) {
      console.error('Failed to reject recommendation:', error);
    }
  }

  private calculateROI(adGroup: any): number {
    // Mock ROI calculation - in real app, get from profit data
    const spend = adGroup.dailyCost || 0;
    const profit = spend * (0.5 + Math.random() * 3); // Random ROI between 0.5-3.5
    return spend > 0 ? profit / spend : 0;
  }

  private addLogEntry(action: string, success: boolean) {
    const currentLog = this.optimizationLog();
    const newEntry = {
      id: Date.now(),
      timestamp: new Date(),
      action,
      details: success ? 'Thành công' : 'Thất bại',
      success
    };
    this.optimizationLog.set([newEntry, ...currentLog.slice(0, 9)]); // Keep only 10 recent entries
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  }
}