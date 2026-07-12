import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  AiAssistantService,
  AiOperatorAgentTrace,
  AiOperatorChatResponse,
  AiOperatorKnowledgeResponse,
  AiOperatorRecommendation,
  AiOperatorSession,
  AiOperatorStoredMessage,
  AiOperatorTokenStatusResponse,
  RolePlaybook,
  ScenarioWorkflow,
} from './ai-assistant.service';

interface AssistantMessage {
  _id?: string;
  sender: 'user' | 'assistant';
  content: string;
  createdAt: string;
  modelUsed?: string | null;
  agentTrace?: AiOperatorAgentTrace | null;
  feedbackRating?: 'up' | 'down' | 'neutral' | null;
  feedbackSubmitting?: boolean;
}

interface RoleOption {
  value: string;
  label: string;
}

interface QuickPrompt {
  text: string;
  scenarioId?: string;
  intent?: string;
}

interface OperationStatusCard {
  key: 'read_only' | 'approval_required' | 'manual_handoff';
  label: string;
  count: number;
  description: string;
}

interface DataReadinessItem {
  label: string;
  status: 'ok' | 'warn' | 'fail';
  value: string;
  detail: string;
}

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.css',
})
export class AiAssistantComponent implements OnInit {
  readonly roleOptions: RoleOption[] = [
    { value: 'director', label: 'Giám đốc' },
    { value: 'manager', label: 'Quản lý' },
    { value: 'sales', label: 'Sale / đại lý' },
    { value: 'ads', label: 'Nhân viên Ads' },
    { value: 'accountant', label: 'Kế toán / CFO' },
    { value: 'supplier', label: 'Nhà cung cấp' },
  ];

  selectedRole = 'director';
  windowDays = 7;
  draftMessage = '';

  knowledge = signal<AiOperatorKnowledgeResponse | null>(null);
  tokenStatus = signal<AiOperatorTokenStatusResponse | null>(null);
  sessions = signal<AiOperatorSession[]>([]);
  selectedSessionId = signal<string | null>(null);
  recommendations = signal<AiOperatorRecommendation[]>([]);
  workflowQuality = signal<any>(null);
  assistantQuality = signal<any>(null);
  agentTrace = signal<AiOperatorAgentTrace | null>(null);
  routeInfo = signal<NonNullable<AiOperatorChatResponse['route']> | null>(null);
  messages = signal<AssistantMessage[]>([]);
  loading = signal(false);
  contextLoading = signal(false);
  error = signal<string | null>(null);

  readonly handoffLinks = [
    { route: '/ops-actions', label: 'Ops Actions', description: 'Mở hàng đợi việc cần người xử lý hoặc phê duyệt.' },
    { route: '/ai-marketing', label: 'AI Marketing', description: 'Chuyển sang tối ưu chiến dịch, nội dung và ngân sách ads.' },
    { route: '/openai-configs', label: 'AI API Key', description: 'Kiểm tra cấu hình model và key đang active/default.' },
  ];

  readonly selectedPlaybook = computed<RolePlaybook | null>(() => {
    const role = this.selectedRole;
    return this.knowledge()?.rolePlaybooks?.find((item) => item.role === role) || null;
  });

  readonly selectedScenarioWorkflows = computed<ScenarioWorkflow[]>(() => {
    return this.knowledge()?.scenarioWorkflows || [];
  });

  readonly workflowReadiness = computed(() => {
    const workflows = this.selectedScenarioWorkflows();
    return {
      total: workflows.length,
      sufficient: workflows.filter((item) => item.apiSufficiency === 'sufficient').length,
      partial: workflows.filter((item) => item.apiSufficiency === 'partial').length,
      missing: workflows.filter((item) => item.apiSufficiency === 'missing').length,
      readOnly: workflows.filter((item) => item.executionMode === 'read_only').length,
      approvalRequired: workflows.filter((item) => item.approvalRequired || item.executionMode === 'approval_required').length,
      manualHandoff: workflows.filter((item) => item.executionMode === 'manual_handoff').length,
    };
  });

  readonly operationModes = computed<OperationStatusCard[]>(() => {
    const readiness = this.workflowReadiness();
    return [
      {
        key: 'read_only',
        label: 'Read-only',
        count: readiness.readOnly,
        description: 'AI chỉ đọc, tổng hợp và giải thích dữ liệu ERP.',
      },
      {
        key: 'approval_required',
        label: 'Cần duyệt',
        count: readiness.approvalRequired,
        description: 'Mọi API ghi hoặc thay đổi vận hành phải qua người duyệt.',
      },
      {
        key: 'manual_handoff',
        label: 'Manual handoff',
        count: readiness.manualHandoff,
        description: 'AI tạo gợi ý rồi bàn giao sang màn hình thao tác.',
      },
    ];
  });

  readonly dataReadiness = computed<DataReadinessItem[]>(() => {
    const kb = this.knowledge();
    const workflow = this.workflowReadiness();
    const workflowAudit = this.workflowQuality()?.summary;
    const token = this.tokenStatus()?.status;
    const apiCount = kb?.apiCatalog?.length || 0;
    const activeConfigs = token?.activeOpenAIConfigs || 0;
    const defaultConfigs = token?.defaultOpenAIConfigs || 0;
    const workflowIssueCount =
      (workflowAudit?.missingApiCount || 0) + (workflowAudit?.notLoadedReadApiCount || 0);
    const weakWorkflowCount = workflowAudit?.byStatus?.weak || 0;
    const needsTuningWorkflowCount = workflowAudit?.byStatus?.needs_tuning || 0;

    return [
      {
        label: 'ERP API catalog',
        status: apiCount > 0 ? 'ok' : 'warn',
        value: apiCount > 0 ? `${apiCount} nhóm API` : 'Chưa tải',
        detail: apiCount > 0 ? 'Có nguồn đọc/ghi để AI tham chiếu.' : 'UI vẫn hoạt động nhưng thiếu catalog API.',
      },
      {
        label: 'Workflow readiness',
        status: weakWorkflowCount > 0 ? 'fail' : workflowIssueCount > 0 || needsTuningWorkflowCount > 0 || workflow.partial > 0 || workflow.total === 0 ? 'warn' : 'ok',
        value: workflowAudit
          ? `${workflowAudit.byStatus?.good || 0}/${workflowAudit.totalWorkflows} 9+`
          : `${workflow.sufficient}/${workflow.total} đủ`,
        detail:
          workflowAudit
            ? workflowIssueCount > 0
              ? `${workflowAudit.missingApiCount || 0} API thiếu, ${workflowAudit.notLoadedReadApiCount || 0} API chưa có loader.`
              : needsTuningWorkflowCount > 0
                ? `${needsTuningWorkflowCount} workflow cần tinh chỉnh để đạt 9+.`
                : 'Workflow audit đạt ngưỡng 9+ theo backend quality check.'
            : workflow.missing > 0
              ? `${workflow.missing} workflow thiếu dữ liệu hoặc API.`
              : workflow.partial > 0
                ? `${workflow.partial} workflow chỉ tạm đủ.`
                : workflow.total > 0
                  ? 'Các workflow đã tải có đủ dữ liệu chính.'
                  : 'Chưa có workflow cho vai trò này.',
      },
      {
        label: 'AI API Key',
        status: activeConfigs > 0 && defaultConfigs > 0 ? 'ok' : activeConfigs > 0 ? 'warn' : 'fail',
        value: activeConfigs > 0 ? `${activeConfigs} active` : 'Chưa active',
        detail: defaultConfigs > 0 ? `${defaultConfigs} config mặc định.` : 'Nên có config mặc định trước khi vận hành.',
      },
    ];
  });

  readonly readinessSummary = computed(() => {
    const statuses = this.dataReadiness().map((item) => item.status);
    if (statuses.includes('fail')) return { label: 'Cần kiểm tra', status: 'fail' };
    if (statuses.includes('warn')) return { label: 'Chưa đủ', status: 'warn' };
    return { label: 'Sẵn sàng', status: 'ok' };
  });

  readonly quickPrompts = computed<QuickPrompt[]>(() => {
    const playbook = this.selectedPlaybook();
    const scenarioId = this.selectedScenarioWorkflows()[0]?.scenarioId || this.defaultScenarioForRole(this.selectedRole);
    const intent = this.defaultIntentForRole(this.selectedRole);
    const base: QuickPrompt[] = [
      { text: 'Tổng hợp việc cần xử lý hôm nay theo mức ưu tiên.', scenarioId, intent },
      { text: 'ERP API nào AI có thể dùng cho tình huống này?', scenarioId, intent: 'api' },
      { text: 'Kiểm tra AI API Key và các guardrail cần nhớ.', scenarioId: 'ADS-001', intent: 'token' },
    ];

    if (!playbook) return base;

    const rolePrompts: QuickPrompt[] = [];
    const dailyQuestion = this.firstText(playbook.dailyQuestions);
    const frequentScenario = this.firstText(playbook.frequentScenarios);
    if (dailyQuestion) rolePrompts.push({ text: dailyQuestion, scenarioId, intent });
    if (frequentScenario) rolePrompts.push({ text: frequentScenario, scenarioId, intent });

    return [
      ...rolePrompts,
      ...base,
    ].slice(0, 5);
  });

  constructor(private readonly service: AiAssistantService) {}

  ngOnInit(): void {
    this.loadContext();
    this.loadSessions();
  }

  loadContext(): void {
    this.contextLoading.set(true);
    this.error.set(null);
    this.workflowQuality.set(null);

    this.service.getKnowledge(this.selectedRole).subscribe({
      next: (data) => {
        this.knowledge.set(data);
        this.contextLoading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Không tải được tri thức AI Operator');
        this.contextLoading.set(false);
      },
    });

    this.service.getTokenManagement().subscribe({
      next: (data) => this.tokenStatus.set(data),
      error: () => this.tokenStatus.set(null),
    });

    this.service.getWorkflowQuality(this.selectedRole).subscribe({
      next: (data) => this.workflowQuality.set(data),
      error: () => this.workflowQuality.set(null),
    });
  }

  onRoleChange(): void {
    this.loadContext();
  }

  loadSessions(): void {
    this.service.listSessions().subscribe({
      next: (data) => this.sessions.set(data.sessions || []),
      error: () => this.sessions.set([]),
    });
  }

  newSession(): void {
    this.selectedSessionId.set(null);
    this.messages.set([]);
    this.recommendations.set([]);
    this.routeInfo.set(null);
    this.assistantQuality.set(null);
    this.agentTrace.set(null);
  }

  selectSession(session: AiOperatorSession): void {
    if (!session?._id || this.selectedSessionId() === session._id) return;
    this.contextLoading.set(true);
    this.error.set(null);
    this.service.getSession(session._id).subscribe({
      next: (data) => {
        const storedMessages = data.messages || [];
        const latestRecommendations = [...storedMessages]
          .reverse()
          .find((item) => item.recommendations?.length)?.recommendations || [];
        const latestAgentTrace = [...storedMessages]
          .reverse()
          .find((item) => item.agentTrace)?.agentTrace || null;
        this.selectedSessionId.set(data.session._id);
        this.messages.set(storedMessages.map((item) => this.storedMessageToAssistantMessage(item)));
        this.recommendations.set(latestRecommendations);
        this.agentTrace.set(latestAgentTrace);
        this.routeInfo.set(null);
        this.contextLoading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'Không tải được phiên AI Operator');
        this.contextLoading.set(false);
      },
    });
  }

  archiveSession(session: AiOperatorSession, event: Event): void {
    event.stopPropagation();
    this.service.updateSession(session._id, { status: 'archived' }).subscribe({
      next: () => {
        if (this.selectedSessionId() === session._id) this.newSession();
        this.loadSessions();
      },
      error: (err) => this.error.set(err?.error?.message || 'Không archive được phiên'),
    });
  }

  submitFeedback(message: AssistantMessage, rating: 'up' | 'down' | 'neutral'): void {
    if (!message._id || message.sender !== 'assistant' || message.feedbackSubmitting) return;

    this.messages.update((items) =>
      items.map((item) => item._id === message._id ? { ...item, feedbackSubmitting: true } : item),
    );

    this.service.submitMessageFeedback(message._id, {
      rating,
      tags: rating === 'down' ? ['needs_review'] : rating === 'up' ? ['useful'] : [],
    }).subscribe({
      next: (data) => {
        const updatedRating = data.message.feedback?.rating || rating;
        this.messages.update((items) =>
          items.map((item) =>
            item._id === message._id
              ? { ...item, feedbackRating: updatedRating, feedbackSubmitting: false }
              : item,
          ),
        );
        this.loadSessions();
      },
      error: (err) => {
        this.messages.update((items) =>
          items.map((item) => item._id === message._id ? { ...item, feedbackSubmitting: false } : item),
        );
        this.error.set(err?.error?.message || 'Khong luu duoc danh gia cau tra loi AI');
      },
    });
  }

  sendPrompt(prompt?: string | QuickPrompt): void {
    const promptMeta = typeof prompt === 'object' ? prompt : null;
    const message = ((promptMeta?.text || prompt || this.draftMessage) as string).trim();
    if (!message || this.loading()) return;

    this.messages.update((items) => [
      ...items,
      { sender: 'user', content: message, createdAt: new Date().toISOString() },
    ]);
    this.draftMessage = '';
    this.loading.set(true);
    this.error.set(null);

    this.service.chat(
      message,
      this.selectedRole,
      Number(this.windowDays) || 7,
      promptMeta?.scenarioId,
      promptMeta?.intent,
      this.selectedSessionId(),
    ).subscribe({
      next: (response) => this.applyChatResponse(response),
      error: (err) => {
        this.error.set(err?.error?.message || 'AI Operator chưa trả lời được');
        this.loading.set(false);
      },
    });
  }

  trackByDomain(_: number, item: { domain: string }) {
    return item.domain;
  }

  trackByRole(_: number, item: RolePlaybook) {
    return item.role;
  }

  trackById(_: number, item: { id?: string; _id?: string; title?: string }) {
    return item.id || item._id || item.title;
  }

  trackByRoute(_: number, item: { route: string }) {
    return item.route;
  }

  trackByAgent(_: number, item: { agent: string }) {
    return item.agent;
  }

  trackByLabel(_: number, item: { label: string }) {
    return item.label;
  }

  firstStrings(items: string[] | null | undefined, limit: number): string[] {
    return Array.isArray(items) ? items.filter(Boolean).slice(0, limit) : [];
  }

  priorityLabel(priority?: string | null) {
    switch (priority) {
      case 'critical':
        return 'Khẩn cấp';
      case 'high':
        return 'Cao';
      case 'medium':
        return 'Vừa';
      default:
        return 'Thấp';
    }
  }

  sufficiencyLabel(value?: string | null) {
    switch (value) {
      case 'sufficient':
        return 'Đủ';
      case 'partial':
        return 'Tạm đủ';
      default:
        return 'Thiếu';
    }
  }

  executionLabel(value?: string | null) {
    switch (value) {
      case 'read_only':
        return 'Chỉ đọc';
      case 'approval_required':
        return 'Cần duyệt';
      default:
        return 'Bàn giao thủ công';
    }
  }

  riskLabel(value?: string | null): string {
    switch (value) {
      case 'high':
        return 'Cao';
      case 'low':
        return 'Thấp';
      default:
        return 'Vừa';
    }
  }

  riskClass(value?: string | null): string {
    return value === 'high' || value === 'low' ? value : 'medium';
  }

  executionClass(value?: string | null): string {
    return value === 'read_only' || value === 'approval_required' ? value : 'manual_handoff';
  }

  recommendationModeLabel(item: AiOperatorRecommendation): string {
    if (item.requiresApproval) return 'Cần duyệt';
    if (item.source?.linkTo) return 'Có link nguồn';
    return 'Bàn giao thủ công';
  }

  recommendationLink(item: AiOperatorRecommendation): string {
    const directLink = item.source?.linkTo;
    if (directLink?.startsWith('/')) return directLink;

    const routingHint = `${item.type || ''} ${item.source?.module || ''}`.toLowerCase();
    if (routingHint.includes('marketing') || routingHint.includes('ads') || routingHint.includes('ad-')) {
      return '/ai-marketing';
    }
    return '/ops-actions';
  }

  recommendationLinkLabel(item: AiOperatorRecommendation): string {
    if (item.source?.linkTo) return 'Mở module nguồn';
    return this.recommendationLink(item) === '/ai-marketing' ? 'Chuyển AI Marketing' : 'Chuyển Ops Actions';
  }

  sourceLabel(item: AiOperatorRecommendation): string {
    return item.source?.module || 'AI Operator';
  }

  purposeLabel(purpose?: string): string {
    if (purpose === 'admin-assistant') return 'Trợ lý quản trị';
    if (purpose === 'general') return 'Khác';
    return 'Chatbot khách hàng';
  }

  private defaultScenarioForRole(role: string): string {
    const map: Record<string, string> = {
      director: 'DIR-001',
      manager: 'MGR-001',
      sales: 'SALES-002',
      ads: 'ADS-002',
      accountant: 'ACC-003',
      supplier: 'SUP-001',
    };
    return map[role] || 'DIR-001';
  }

  private defaultIntentForRole(role: string): string {
    const map: Record<string, string> = {
      director: 'overview',
      manager: 'operations',
      sales: 'sales',
      ads: 'ads',
      accountant: 'finance',
      supplier: 'supplier',
    };
    return map[role] || 'overview';
  }

  private firstText(items: string[] | null | undefined): string | null {
    return Array.isArray(items) ? items.find((item) => Boolean(item?.trim())) || null : null;
  }

  private storedMessageToAssistantMessage(message: AiOperatorStoredMessage): AssistantMessage {
    return {
      _id: message._id,
      sender: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
      createdAt: message.createdAt || new Date().toISOString(),
      modelUsed: message.modelUsed,
      agentTrace: message.agentTrace || null,
      feedbackRating: message.feedback?.rating || null,
    };
  }

  private applyChatResponse(response: AiOperatorChatResponse): void {
    if (response.sessionId) {
      this.selectedSessionId.set(response.sessionId);
    }
    this.messages.update((items) => [
      ...items,
      {
        _id: response.assistantMessageId || undefined,
        sender: 'assistant',
        content: response.answer,
        createdAt: response.generatedAt || new Date().toISOString(),
        modelUsed: response.modelUsed,
        agentTrace: response.agentTrace || null,
      },
    ]);
    this.recommendations.set(response.recommendations || []);
    this.assistantQuality.set(response.assistantQuality || response.context?.assistantQuality || null);
    this.agentTrace.set(response.agentTrace || null);
    this.routeInfo.set(response.route || null);
    if (response.knowledge) {
      this.knowledge.set(response.knowledge as any);
    }
    this.loading.set(false);
    this.loadSessions();
  }
}
