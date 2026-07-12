import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

type OpsActionPriority = 'critical' | 'high' | 'medium' | 'low';

interface OpsActionItem {
  actionType: string;
  priority: OpsActionPriority;
  title: string;
  description: string;
  reason: string;
  linkTo?: string;
  amount?: number;
  count?: number;
  entityName?: string;
  entityId?: string;
  generatedAt: string;
}

interface OpsActionsResponse {
  actions: OpsActionItem[];
  totalCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  bySeverity: { critical: number; high: number; medium: number; low: number };
  asOf: string;
  dataSources?: { supplierPayable?: boolean; agentReceivable?: boolean };
}

type OpsTaskStatus = 'pending' | 'approved' | 'rejected';
type OpsPlanStatus = 'draft' | 'pending_approval' | 'partially_approved' | 'approved' | 'rejected';

interface OpsTask extends OpsActionItem {
  _id: string;
  status: OpsTaskStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  requiresApproval?: boolean;
}

interface OpsActionPlan {
  _id: string;
  title: string;
  status: OpsPlanStatus;
  mode?: string;
  summary?: {
    selectedSuggestions?: number;
    bySeverity?: { critical?: number; high?: number; medium?: number; low?: number };
    executionMode?: string;
    liveApplyEnabled?: boolean;
  };
  tasks?: OpsTask[];
  createdBy?: string;
  createdAt?: string;
}

interface OpsTaskRow {
  planId: string;
  planTitle: string;
  planStatus: OpsPlanStatus;
  createdAt?: string;
  task: OpsTask;
}

@Component({
  selector: 'app-ops-action',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ops-dashboard">
      <header class="dash-header">
        <div class="header-left">
          <h1>Việc Cần Làm - Vận Hành</h1>
          <span class="subtitle">Hành động khẩn cấp • NCC, Đại lý, Đơn hàng • xử lý thủ công có kiểm soát</span>
        </div>
        <div class="header-right">
          <span class="update-time" *ngIf="response()">
            Cập nhật: {{ response()!.asOf | date:'HH:mm dd/MM' }}
          </span>
          <button class="btn-refresh" (click)="load()" [disabled]="loading()">
            <span [class.spin]="loading()">↻</span>
          </button>
        </div>
      </header>

      <div class="ops-mode-note">
        <div>
          <span class="mode-chip read">AI chỉ gợi ý</span>
          <span class="mode-chip approve">Người phụ trách duyệt</span>
          <span class="mode-chip manual">Không tự động ghi ERP</span>
        </div>
        <div class="mode-links">
          <button class="quick-btn" (click)="navigateTo('/ai-assistant')">AI Assistant</button>
          <button class="quick-btn" (click)="navigateTo('/ai-marketing')">AI Marketing</button>
          <a class="quick-btn docs-link" href="/docs/AI-OPS-SUBAGENT-ROADMAP.md" target="_blank" rel="noopener">Tai lieu AI Ops</a>
        </div>
      </div>

      <!-- Data Source Status -->
      <div class="data-sources" *ngIf="response()">
        <span class="ds-item" [class.ok]="dataSourceReady('supplierPayable')" [class.fail]="!dataSourceReady('supplierPayable')">NCC</span>
        <span class="ds-item" [class.ok]="dataSourceReady('agentReceivable')" [class.fail]="!dataSourceReady('agentReceivable')">Đại lý</span>
      </div>

      <section class="approval-workbench">
        <div class="workbench-header">
          <div>
            <h2>Hàng đợi duyệt vận hành</h2>
            <p>Chuyển gợi ý hiện tại thành plan/task để ghi nhận người duyệt. Không có thao tác live nào được thực thi.</p>
          </div>
          <div class="workbench-actions">
            <button class="quick-btn primary" (click)="createPlanFromSuggestions()" [disabled]="queueLoading() || !response()?.totalCount">
              Tạo plan từ gợi ý
            </button>
            <button class="quick-btn" (click)="loadApprovalQueue()" [disabled]="queueLoading()">Tải lại plan</button>
          </div>
        </div>

        <div class="queue-message" *ngIf="queueMessage()">{{ queueMessage() }}</div>

        <div class="plan-strip" *ngIf="plans().length">
          <article *ngFor="let plan of plans()" class="plan-chip" [class.approved]="plan.status === 'approved'" [class.rejected]="plan.status === 'rejected'">
            <strong>{{ plan.title }}</strong>
            <span>{{ planStatusLabel(plan.status) }} · {{ plan.summary?.selectedSuggestions || plan.tasks?.length || 0 }} task</span>
            <small>{{ plan.createdAt | date:'HH:mm dd/MM' }}</small>
          </article>
        </div>

        <div class="pending-task-list" *ngIf="pendingTasks().length; else emptyPendingTasks">
          <article *ngFor="let row of pendingTasks()" class="pending-task" [class]="row.task.priority">
            <div>
              <span class="task-plan">{{ row.planTitle }}</span>
              <strong>{{ row.task.title }}</strong>
              <p>{{ row.task.description }}</p>
              <small>
                {{ getPriorityLabel(row.task.priority) }} · {{ row.task.amount ? formatCurrency(row.task.amount) : 'Không có số tiền' }}
              </small>
            </div>
            <div class="task-actions">
              <button class="approve-btn" (click)="approveTask(row)" [disabled]="actionInFlight() === taskKey(row)">Duyệt</button>
              <button class="reject-btn" (click)="rejectTask(row)" [disabled]="actionInFlight() === taskKey(row)">Từ chối</button>
            </div>
          </article>
        </div>

        <ng-template #emptyPendingTasks>
          <div class="empty-queue" *ngIf="!queueLoading()">Chưa có task pending trong các plan gần đây.</div>
        </ng-template>
      </section>

      <!-- Critical Alert Banner -->
      <div class="critical-alert-banner" *ngIf="hasCritical()">
        <div class="alert-icon">🚨</div>
        <div class="alert-content">
          <strong>CÓ {{ response()!.criticalCount }} VIỆC KHẨN CẤP CẦN XỬ LÝ NGAY</strong>
          <p>Hệ thống phát hiện các vấn đề nghiêm trọng cần can thiệp lập tức.</p>
        </div>
      </div>

      <!-- Summary Counters -->
      <div class="summary-bar" *ngIf="response() && response()!.totalCount > 0">
        <div class="counter critical" *ngIf="response()!.bySeverity.critical > 0">
          <span class="counter-num">{{ response()!.bySeverity.critical }}</span>
          <span class="counter-label">Khẩn cấp</span>
        </div>
        <div class="counter high" *ngIf="response()!.bySeverity.high > 0">
          <span class="counter-num">{{ response()!.bySeverity.high }}</span>
          <span class="counter-label">Quan trọng</span>
        </div>
        <div class="counter medium" *ngIf="response()!.bySeverity.medium > 0">
          <span class="counter-num">{{ response()!.bySeverity.medium }}</span>
          <span class="counter-label">Cần làm</span>
        </div>
        <div class="counter low" *ngIf="response()!.bySeverity.low > 0">
          <span class="counter-num">{{ response()!.bySeverity.low }}</span>
          <span class="counter-label">Gợi ý</span>
        </div>
      </div>

      <!-- Action List -->
      <div class="action-panel" *ngIf="response() && response()!.actions.length > 0">
        <div class="action-list">
          <div class="action-item" *ngFor="let action of response()!.actions; let i = index" [class]="action.priority">
            <div class="action-number">{{ i + 1 }}</div>
            <div class="action-priority-badge">{{ getPriorityLabel(action.priority) }}</div>
            <div class="action-content">
              <strong>{{ action.title }}</strong>
              <p>{{ action.description }}</p>
              <div class="action-details">
                <span class="action-reason">💡 {{ action.reason }}</span>
                <span class="action-impact" *ngIf="action.amount">
                  📊 Số tiền: {{ formatCurrency(action.amount!) }}
                </span>
                <span class="action-count" *ngIf="action.count">
                  📋 Số lượng: {{ action.count }}
                </span>
              </div>
            </div>
            <div class="action-controls">
              <span class="approval-note">Cần xác nhận</span>
              <button class="action-btn" *ngIf="action.linkTo" (click)="navigateTo(action.linkTo!)">
                Xử lý →
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions" *ngIf="response() && response()!.totalCount > 0">
        <div class="quick-header">⚡ Truy cập nhanh:</div>
        <div class="quick-buttons">
          <button class="quick-btn supplier" (click)="navigateTo('/purchases/payables')">💰 Đối soát NCC</button>
          <button class="quick-btn supplier" (click)="navigateTo('/payments/supplier')">💳 Thanh toán NCC</button>
          <button class="quick-btn agent" (click)="navigateTo('/payments/agent')">🤝 Hoa hồng Đại lý</button>
          <button class="quick-btn agent" (click)="navigateTo('/agents/receivables')">📋 Công nợ Đại lý</button>
        </div>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="response() && response()!.totalCount === 0">
        <div class="empty-icon">✅</div>
        <h3>Không có việc khẩn cấp</h3>
        <p>Mọi thứ đang ổn định. Hệ thống sẽ tự động cảnh báo khi có vấn đề.</p>
      </div>

      <!-- Loading -->
      <div class="loading-overlay" *ngIf="loading()">
        <div class="spinner"></div>
        <p>Đang tải dữ liệu vận hành...</p>
      </div>

      <!-- Error -->
      <div class="error-state" *ngIf="error()">
        <p>{{ error() }}</p>
        <button class="action-btn" (click)="load()">↻ Thử lại</button>
      </div>
    </div>
  `,
  styles: [`
    .ops-dashboard { max-width: 900px; margin: 0 auto; padding: 24px; font-family: system-ui, -apple-system, sans-serif; }

    .dash-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .header-left h1 { margin: 0; font-size: 22px; font-weight: 700; }
    .subtitle { font-size: 13px; color: #666; }
    .header-right { display: flex; align-items: center; gap: 12px; }
    .update-time { font-size: 12px; color: #888; }
    .btn-refresh { background: none; border: 1px solid #ddd; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 16px; }
    .btn-refresh:hover { background: #f5f5f5; }
    .spin { display: inline-block; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .ops-mode-note {
      display: flex; justify-content: space-between; gap: 12px; align-items: center;
      padding: 12px; border: 1px solid #dde5df; border-radius: 10px; background: #fff;
      margin-bottom: 14px;
    }
    .ops-mode-note > div { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .mode-chip, .approval-note {
      display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px;
      border-radius: 999px; font-size: 11px; font-weight: 800;
    }
    .mode-chip.read { color: #2e7d32; background: #e8f5e9; }
    .mode-chip.approve, .approval-note { color: #c62828; background: #ffebee; }
    .mode-chip.manual { color: #7a4b12; background: #fff3e0; }
    .mode-links { justify-content: flex-end; }
    .docs-link { color: #155a9c; border-color: #b7cce2; text-decoration: none; }

    .data-sources { display: flex; gap: 8px; margin-bottom: 16px; }
    .ds-item { font-size: 11px; padding: 3px 10px; border-radius: 12px; font-weight: 600; }
    .ds-item.ok { background: #e8f5e9; color: #2e7d32; }
    .ds-item.fail { background: #ffebee; color: #c62828; }

    .approval-workbench {
      margin-bottom: 20px; padding: 16px; border: 1px solid #dde5df;
      border-radius: 12px; background: #fff;
    }
    .workbench-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .workbench-header h2 { margin: 0 0 4px; font-size: 16px; }
    .workbench-header p { margin: 0; color: #666; font-size: 13px; line-height: 1.5; }
    .workbench-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .quick-btn.primary { color: white; background: #1976d2; border-color: #1976d2; }
    .queue-message { margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: #eef7ff; color: #155a9c; font-size: 13px; }
    .plan-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-top: 14px; }
    .plan-chip {
      display: grid; gap: 4px; padding: 10px; border-radius: 8px;
      background: #f8faf8; border: 1px solid #dfe6e2; font-size: 12px;
    }
    .plan-chip strong { font-size: 13px; }
    .plan-chip.approved { border-color: #81c784; background: #f1fbf2; }
    .plan-chip.rejected { border-color: #ef9a9a; background: #fff5f5; }
    .pending-task-list { display: grid; gap: 10px; margin-top: 14px; }
    .pending-task {
      display: flex; justify-content: space-between; gap: 12px; padding: 12px;
      border-radius: 10px; border-left: 4px solid #ccc; background: #fbfcfb;
    }
    .pending-task.critical { border-left-color: #d32f2f; }
    .pending-task.high { border-left-color: #e65100; }
    .pending-task.medium { border-left-color: #f57f17; }
    .pending-task.low { border-left-color: #2e7d32; }
    .pending-task strong, .pending-task small, .pending-task span { display: block; }
    .pending-task p { margin: 4px 0 6px; color: #555; font-size: 13px; }
    .task-plan { margin-bottom: 4px; color: #777; font-size: 11px; font-weight: 800; text-transform: uppercase; }
    .task-actions { display: flex; gap: 8px; align-items: center; }
    .approve-btn, .reject-btn {
      border: 0; border-radius: 6px; padding: 8px 12px; color: white;
      cursor: pointer; font-weight: 700; white-space: nowrap;
    }
    .approve-btn { background: #2e7d32; }
    .reject-btn { background: #c62828; }
    .approve-btn:disabled, .reject-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .empty-queue { margin-top: 12px; color: #777; font-size: 13px; }

    .critical-alert-banner {
      display: flex; align-items: center; gap: 16px;
      background: linear-gradient(135deg, #d32f2f, #b71c1c); color: white;
      padding: 16px 20px; border-radius: 12px; margin-bottom: 20px;
      animation: pulse-border 2s ease-in-out infinite;
    }
    @keyframes pulse-border { 0%, 100% { box-shadow: 0 0 0 0 rgba(211,47,47,0.4); } 50% { box-shadow: 0 0 0 8px rgba(211,47,47,0); } }
    .alert-icon { font-size: 28px; }
    .alert-content strong { font-size: 15px; }
    .alert-content p { margin: 4px 0 0; font-size: 13px; opacity: 0.9; }

    .summary-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .counter { padding: 12px 20px; border-radius: 10px; text-align: center; min-width: 100px; }
    .counter-num { display: block; font-size: 28px; font-weight: 800; }
    .counter-label { font-size: 12px; font-weight: 600; }
    .counter.critical { background: #ffebee; color: #c62828; border: 2px solid #ef5350; }
    .counter.high { background: #fff3e0; color: #e65100; border: 2px solid #ff9800; }
    .counter.medium { background: #fff8e1; color: #f57f17; border: 2px solid #ffc107; }
    .counter.low { background: #e8f5e9; color: #2e7d32; border: 2px solid #4caf50; }

    .action-panel { margin-bottom: 20px; }
    .action-list { display: flex; flex-direction: column; gap: 12px; }
    .action-item {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 16px; border-radius: 10px; background: white;
      border-left: 4px solid #ccc; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      transition: transform 0.15s;
    }
    .action-item:hover { transform: translateX(4px); }
    .action-item.critical { border-left-color: #d32f2f; background: #fff5f5; }
    .action-item.high { border-left-color: #e65100; background: #fff8f0; }
    .action-item.medium { border-left-color: #f57f17; background: #fffdf0; }
    .action-item.low { border-left-color: #2e7d32; background: #f5fff5; }

    .action-number { font-size: 14px; font-weight: 800; color: #999; min-width: 24px; padding-top: 2px; }
    .action-priority-badge {
      font-size: 10px; font-weight: 800; padding: 3px 8px;
      border-radius: 4px; white-space: nowrap; letter-spacing: 0.5px;
    }
    .critical .action-priority-badge { background: #d32f2f; color: white; }
    .high .action-priority-badge { background: #e65100; color: white; }
    .medium .action-priority-badge { background: #f57f17; color: white; }
    .low .action-priority-badge { background: #2e7d32; color: white; }

    .action-content { flex: 1; }
    .action-content strong { font-size: 14px; display: block; margin-bottom: 4px; }
    .action-content p { margin: 0 0 8px; font-size: 13px; color: #555; }
    .action-details { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: #777; }
    .action-reason { flex: 1; min-width: 200px; }

    .action-controls { display: grid; gap: 8px; justify-items: end; align-self: center; }

    .action-btn {
      background: #1976d2; color: white; border: none; padding: 8px 16px;
      border-radius: 6px; cursor: pointer; font-size: 13px; white-space: nowrap; font-weight: 600;
      align-self: center;
    }
    .action-btn:hover { background: #1565c0; }

    .quick-actions { margin-bottom: 20px; }
    .quick-header { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
    .quick-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
    .quick-btn {
      padding: 10px 18px; border-radius: 8px; border: 1px solid #ddd;
      background: white; cursor: pointer; font-size: 13px; font-weight: 600;
      transition: all 0.15s;
    }
    .quick-btn:hover { background: #f0f0f0; transform: translateY(-1px); }

    .empty-state { text-align: center; padding: 60px 20px; }
    .empty-icon { font-size: 48px; margin-bottom: 12px; }
    .empty-state h3 { margin: 0 0 8px; color: #2e7d32; }
    .empty-state p { color: #666; font-size: 14px; }

    .loading-overlay { text-align: center; padding: 60px; }
    .spinner { width: 36px; height: 36px; border: 3px solid #eee; border-top-color: #1976d2; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 12px; }

    .error-state { text-align: center; padding: 40px; color: #c62828; }

    @media (max-width: 720px) {
      .dash-header, .ops-mode-note, .workbench-header, .pending-task, .action-item { display: grid; }
      .header-right, .mode-links, .action-controls { justify-content: start; justify-items: start; }
      .workbench-actions, .task-actions { justify-content: start; }
    }
  `],
})
export class OpsActionComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = `${environment.apiUrl}/ops-actions`;

  loading = signal(false);
  queueLoading = signal(false);
  error = signal<string | null>(null);
  queueMessage = signal<string | null>(null);
  actionInFlight = signal<string | null>(null);
  response = signal<OpsActionsResponse | null>(null);
  plans = signal<OpsActionPlan[]>([]);
  tasks = signal<OpsTaskRow[]>([]);

  hasCritical = computed(() => (this.response()?.criticalCount ?? 0) > 0);
  pendingTasks = computed(() => this.tasks().filter((row) => row.task.status === 'pending'));

  ngOnInit(): void {
    this.load();
    this.loadApprovalQueue();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<OpsActionsResponse>(`${this.apiUrl}/suggestions`).subscribe({
      next: (data) => {
        this.response.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load ops actions:', err);
        this.error.set('Không thể tải dữ liệu. Vui lòng thử lại.');
        this.loading.set(false);
      },
    });
  }

  loadApprovalQueue(clearMessage = true): void {
    this.queueLoading.set(true);
    if (clearMessage) this.queueMessage.set(null);

    this.http.get<{ success: boolean; plans: OpsActionPlan[] }>(`${this.apiUrl}/plans?limit=5`).subscribe({
      next: (plansResponse) => {
        this.plans.set(plansResponse.plans || []);
        this.loadPendingTasks();
      },
      error: (err) => {
        console.error('Failed to load ops action plans:', err);
        this.queueMessage.set('Không tải được hàng đợi duyệt vận hành.');
        this.queueLoading.set(false);
      },
    });
  }

  loadPendingTasks(): void {
    this.http.get<{ success: boolean; tasks: OpsTaskRow[] }>(`${this.apiUrl}/tasks?status=pending&limit=20`).subscribe({
      next: (tasksResponse) => {
        this.tasks.set(tasksResponse.tasks || []);
        this.queueLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load ops tasks:', err);
        this.queueMessage.set('Không tải được task đang chờ duyệt.');
        this.queueLoading.set(false);
      },
    });
  }

  createPlanFromSuggestions(): void {
    if (!this.response()?.totalCount || this.queueLoading()) return;

    this.queueLoading.set(true);
    this.queueMessage.set(null);
    this.http.post<{ success: boolean; plan: OpsActionPlan }>(`${this.apiUrl}/plans/from-suggestions`, {
      limit: 100,
      notes: 'Created from current ops suggestions in the AI operations queue.',
    }).subscribe({
      next: (result) => {
        const taskCount = result.plan?.tasks?.length || result.plan?.summary?.selectedSuggestions || 0;
        this.queueMessage.set(`Đã tạo plan "${result.plan.title}" với ${taskCount} task chờ duyệt.`);
        this.loadApprovalQueue(false);
      },
      error: (err) => {
        console.error('Failed to create ops action plan:', err);
        this.queueMessage.set(err?.error?.message || 'Không tạo được plan từ gợi ý hiện tại.');
        this.queueLoading.set(false);
      },
    });
  }

  approveTask(row: OpsTaskRow): void {
    this.setTaskApproval(row, true);
  }

  rejectTask(row: OpsTaskRow): void {
    this.setTaskApproval(row, false);
  }

  setTaskApproval(row: OpsTaskRow, approved: boolean): void {
    const key = this.taskKey(row);
    if (this.actionInFlight()) return;

    this.actionInFlight.set(key);
    const endpoint = approved ? 'approve' : 'reject';
    const body = approved
      ? { note: 'Approved from Ops Actions UI. No live action executed.' }
      : { reason: 'Rejected from Ops Actions UI. No live action executed.' };

    this.http.patch(`${this.apiUrl}/plans/${row.planId}/tasks/${row.task._id}/${endpoint}`, body).subscribe({
      next: () => {
        this.queueMessage.set(approved ? 'Đã ghi nhận duyệt task. Chưa thực thi live.' : 'Đã ghi nhận từ chối task.');
        this.actionInFlight.set(null);
        this.loadApprovalQueue(false);
      },
      error: (err) => {
        console.error('Failed to update ops task approval:', err);
        this.queueMessage.set(err?.error?.message || 'Không cập nhật được trạng thái task.');
        this.actionInFlight.set(null);
      },
    });
  }

  getPriorityLabel(priority: OpsActionPriority): string {
    const labels: Record<OpsActionPriority, string> = {
      critical: 'KHẨN CẤP',
      high: 'QUAN TRỌNG',
      medium: 'CẦN LÀM',
      low: 'GỢI Ý',
    };
    return labels[priority] || priority.toUpperCase();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value);
  }

  dataSourceReady(source: 'supplierPayable' | 'agentReceivable'): boolean {
    return Boolean(this.response()?.dataSources?.[source]);
  }

  planStatusLabel(status: OpsPlanStatus): string {
    const labels: Record<OpsPlanStatus, string> = {
      draft: 'Nháp',
      pending_approval: 'Chờ duyệt',
      partially_approved: 'Duyệt một phần',
      approved: 'Đã duyệt',
      rejected: 'Từ chối',
    };
    return labels[status] || status;
  }

  taskKey(row: OpsTaskRow): string {
    return `${row.planId}:${row.task._id}`;
  }

  navigateTo(route: string): void {
    if (route.startsWith('/')) {
      this.router.navigate([route]);
    } else {
      this.router.navigate(['/', route]);
    }
  }
}
