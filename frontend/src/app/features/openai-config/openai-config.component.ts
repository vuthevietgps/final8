/**
 * File: openai-config/openai-config.component.ts
 * Mục đích: Component quản lý cấu hình OpenAI với modal form và error handling
 * Chức năng: CRUD cấu hình OpenAI, hiển thị danh sách, form thêm/sửa
 */
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OpenAIConfigService, OpenAIConfig, CreateOpenAIConfigRequest } from './openai-config.service';

@Component({
  selector: 'app-openai-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './openai-config.component.html',
  styleUrls: ['./openai-config.component.css']
})
export class OpenAIConfigComponent implements OnInit {
  private service = inject(OpenAIConfigService);

  // State management với signals
  configs = signal<OpenAIConfig[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  testResult = signal<string | null>(null);
  testingKey = signal(false);

  modelOptions = [
    { value: 'gpt-5.5', label: 'GPT-5.5 - chất lượng cao cho trợ lý quản trị' },
    { value: 'gpt-5.5-pro', label: 'GPT-5.5 Pro - mạnh hơn, chậm và tốn hơn' },
    { value: 'gpt-5.4', label: 'GPT-5.4 - cân bằng chất lượng/chi phí' },
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 mini - nhanh hơn, tiết kiệm hơn' },
    { value: 'gpt-5.4-nano', label: 'GPT-5.4 nano - rẻ/nhanh cho tác vụ nhẹ' },
    { value: 'gpt-5.1', label: 'GPT-5.1 - reasoning/coding thế hệ trước' },
    { value: 'gpt-5', label: 'GPT-5 - reasoning thế hệ trước' },
    { value: 'gpt-4.1', label: 'GPT-4.1 - model không reasoning' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini - tiết kiệm' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini - cũ, rẻ' },
  ];

  purposeOptions = [
    { value: 'admin-assistant', label: 'Trợ lý quản trị' },
    { value: 'customer-chatbot', label: 'Chatbot khách hàng' },
    { value: 'general', label: 'Khác / dùng chung kỹ thuật' },
  ];

  private readonly defaultPrompts: Record<string, string> = {
    'admin-assistant': 'Bạn là trợ lý quản trị ERP của công ty. Luôn trả lời bằng tiếng Việt có dấu, ưu tiên dữ liệu nội bộ, nêu rõ phần còn thiếu và không tự ghi dữ liệu khi chưa có phê duyệt.',
    'customer-chatbot': 'Bạn là trợ lý AI thông minh và thân thiện cho fanpage bán hàng. Hãy trả lời khách hàng bằng tiếng Việt có dấu một cách chuyên nghiệp, ngắn gọn và hữu ích.',
    general: 'Bạn là trợ lý AI cho các tác vụ nội bộ. Luôn trả lời bằng tiếng Việt có dấu, bám sát dữ liệu được cung cấp và nêu rõ khi thiếu thông tin.',
  };
  
  // Modal state
  showModal = signal(false);
  isEditing = signal(false);
  editingConfig = signal<OpenAIConfig | null>(null);
  
  // Form data
  formData = signal<Partial<CreateOpenAIConfigRequest>>({
    name: '',
    description: '',
    purpose: 'admin-assistant',
    model: 'gpt-5.5',
    apiKey: '',
    systemPrompt: 'Bạn là trợ lý quản trị ERP của công ty. Luôn trả lời bằng tiếng Việt có dấu, ưu tiên dữ liệu nội bộ, nêu rõ phần còn thiếu và không tự ghi dữ liệu khi chưa có phê duyệt.',
    maxTokens: 1200,
    temperature: 0.7,
    reasoningEffort: 'medium',
    scopeType: 'global',
    status: 'active',
    isDefault: false
  });

  ngOnInit() { this.loadConfigs(); }

  /**
   * Tải danh sách cấu hình OpenAI từ server
   */
  loadConfigs() {
    this.loading.set(true);
    this.error.set(null);
    
    this.service.list().subscribe({
      next: (data) => {
        this.configs.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.handleError(err, 'Không thể tải danh sách cấu hình OpenAI');
        this.loading.set(false);
      }
    });
  }

  /**
   * Mở modal để thêm cấu hình mới
   */
  openAddModal() {
    this.isEditing.set(false);
    this.editingConfig.set(null);
    this.formData.set({
      name: '',
      description: '',
      purpose: 'admin-assistant',
      model: 'gpt-5.5',
      apiKey: '',
      systemPrompt: this.defaultSystemPrompt('admin-assistant'),
      maxTokens: 1200,
      temperature: 0.7,
      reasoningEffort: 'medium',
      scopeType: 'global',
      status: 'active',
      isDefault: false
    });
    this.showModal.set(true);
  }

  /**
   * Mở modal để chỉnh sửa cấu hình
   */
  openEditModal(config: OpenAIConfig) {
    this.isEditing.set(true);
    this.editingConfig.set(config);
    this.formData.set({
      name: config.name,
      description: config.description,
      purpose: config.purpose || 'customer-chatbot',
      model: config.model,
      apiKey: '', // Không hiển thị API key cũ vì lý do bảo mật
      systemPrompt: config.systemPrompt,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      reasoningEffort: config.reasoningEffort || 'medium',
      scopeType: config.scopeType,
      scopeRef: config.scopeRef,
      status: config.status,
      isDefault: config.isDefault
    });
    this.showModal.set(true);
  }

  /**
   * Đóng modal và xóa dữ liệu form
   */
  closeModal() {
    this.showModal.set(false);
    this.isEditing.set(false);
    this.editingConfig.set(null);
    this.error.set(null);
    this.testResult.set(null);
    this.testingKey.set(false);
  }

  /**
   * Lưu cấu hình (tạo mới hoặc cập nhật)
   */
  saveConfig() {
    const data = this.formData();
    
    // Validation
    if (!data.name?.trim()) {
      this.error.set('Vui lòng nhập tên cấu hình');
      return;
    }
    if (!data.model?.trim()) {
      this.error.set('Vui lòng chọn model OpenAI');
      return;
    }
    if (!data.systemPrompt?.trim()) {
      this.error.set('Vui lòng nhập system prompt');
      return;
    }
    if (data.temperature != null && (data.temperature < 0 || data.temperature > 2)) {
      this.error.set('Temperature phải trong khoảng 0 - 2');
      return;
    }
    if (data.maxTokens != null && (data.maxTokens < 1 || data.maxTokens > 32000)) {
      this.error.set('Max Tokens phải trong khoảng 1 - 32000');
      return;
    }

    if (this.isEditing()) {
      this.updateConfig();
    } else {
      this.createConfig();
    }
  }

  testApiKey() {
    const apiKey = this.formData().apiKey;
    if (!apiKey?.trim()) {
      this.error.set('Vui lòng nhập API Key trước khi test');
      return;
    }
    this.testingKey.set(true);
    this.testResult.set(null);
    this.error.set(null);
    this.service.testKey(apiKey, this.formData().model).subscribe({
      next: (res) => {
        this.testingKey.set(false);
        if (res.valid) this.testResult.set(res.message || 'API Key hợp lệ');
        else this.error.set(res.reason || 'API Key không hợp lệ');
      },
      error: (err) => {
        this.testingKey.set(false);
        this.handleError(err, 'Lỗi test API Key');
      }
    });
  }

  /**
   * Tạo cấu hình mới
   */
  private createConfig() {
    const data = this.formData() as CreateOpenAIConfigRequest;
    
    if (!data.apiKey?.trim()) {
      this.error.set('Vui lòng nhập OpenAI API Key');
      return;
    }

    this.loading.set(true);
    
    this.service.create(data).subscribe({
      next: (created) => {
        this.configs.update(list => [created, ...list]);
        this.closeModal();
        this.loading.set(false);
      },
      error: (err) => {
        this.handleError(err, 'Không thể tạo cấu hình');
        this.loading.set(false);
      }
    });
  }

  /**
   * Cập nhật cấu hình existing
   */
  private updateConfig() {
    const config = this.editingConfig();
    if (!config) return;

    const data = this.formData();
    // Nếu API key trống, không gửi lên server (giữ nguyên key cũ)
    if (!data.apiKey?.trim()) {
      delete data.apiKey;
    }

    this.loading.set(true);
    
    this.service.update(config._id, data).subscribe({
      next: (updated) => {
        this.configs.update(list => 
          list.map(c => c._id === config._id ? updated : c)
        );
        this.closeModal();
        this.loading.set(false);
      },
      error: (err) => {
        this.handleError(err, 'Không thể cập nhật cấu hình');
        this.loading.set(false);
      }
    });
  }

  /**
   * Xóa cấu hình
   */
  deleteConfig(config: OpenAIConfig) {
    if (!confirm(`Bạn có chắc muốn xóa cấu hình "${config.name}"?`)) {
      return;
    }

    this.service.delete(config._id).subscribe({
      next: () => {
        this.configs.update(list => list.filter(c => c._id !== config._id));
      },
      error: (err) => {
        this.handleError(err, 'Không thể xóa cấu hình');
      }
    });
  }

  /**
   * Cập nhật field trong form
   */
  updateFormField(field: keyof CreateOpenAIConfigRequest, value: any) {
    this.formData.update(data => ({ ...data, [field]: value }));
  }

  /**
   * Type-safe event handlers
   */
  onInputChange(event: Event, field: keyof CreateOpenAIConfigRequest) {
    const target = event.target as HTMLInputElement;
    if (field === 'purpose') {
      const currentPrompt = this.formData().systemPrompt || '';
      const isDefaultPrompt = Object.values(this.defaultPrompts).includes(currentPrompt);
      this.formData.update(data => ({
        ...data,
        purpose: target.value as any,
        systemPrompt: !currentPrompt.trim() || isDefaultPrompt ? this.defaultSystemPrompt(target.value) : currentPrompt,
      }));
      return;
    }
    this.updateFormField(field, target.value);
  }

  onNumberChange(event: Event, field: keyof CreateOpenAIConfigRequest) {
    const target = event.target as HTMLInputElement;
    this.updateFormField(field, +target.value);
  }

  onCheckboxChange(event: Event, field: keyof CreateOpenAIConfigRequest) {
    const target = event.target as HTMLInputElement;
    this.updateFormField(field, target.checked);
  }

  /**
   * Xử lý lỗi và hiển thị thông báo
   */
  private handleError(error: any, defaultMessage: string) {
    const message = error?.error?.message || error?.message || defaultMessage;
    this.error.set(message);
    console.error('OpenAI Config Error:', error);
  }

  /**
   * Track function cho ngFor
   */
  trackById(index: number, item: OpenAIConfig) {
    return item._id;
  }

  /**
   * Mask API Key cho hiển thị
   */
  maskApiKey(key?: string): string {
    if (!key) return '';
    return key.length > 8 ? key.substring(0, 8) + '•••••••••••' : key;
  }

  purposeLabel(purpose?: string): string {
    return this.purposeOptions.find(option => option.value === purpose)?.label || 'Chatbot khách hàng';
  }

  private defaultSystemPrompt(purpose?: string): string {
    return this.defaultPrompts[purpose || 'admin-assistant'] || this.defaultPrompts['admin-assistant'];
  }
}
