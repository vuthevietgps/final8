import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OpsActionComponent } from './ops-action.component';

describe('OpsActionComponent approval queue', () => {
  let fixture: ComponentFixture<OpsActionComponent>;
  let component: OpsActionComponent;
  let http: HttpTestingController;

  const suggestionsResponse = {
    actions: [
      {
        actionType: 'SUPPLIER_OVER_THRESHOLD',
        priority: 'high',
        title: 'Supplier balance is high',
        description: 'Supplier has 6,000,000 VND unpaid.',
        reason: 'Above threshold.',
        linkTo: '/payments/supplier',
        amount: 6_000_000,
        generatedAt: '2026-06-09T00:00:00.000Z',
      },
    ],
    totalCount: 1,
    criticalCount: 0,
    highCount: 1,
    mediumCount: 0,
    bySeverity: { critical: 0, high: 1, medium: 0, low: 0 },
    asOf: '2026-06-09T01:00:00.000Z',
    dataSources: { supplierPayable: true, agentReceivable: true },
  };

  const plan = {
    _id: '665000000000000000000001',
    title: 'Morning ops plan',
    status: 'pending_approval',
    summary: { selectedSuggestions: 1 },
    createdAt: '2026-06-09T01:00:00.000Z',
  };

  const taskRow = {
    planId: plan._id,
    planTitle: plan.title,
    planStatus: 'pending_approval',
    task: {
      _id: '665000000000000000000002',
      actionType: 'SUPPLIER_OVER_THRESHOLD',
      priority: 'high',
      title: 'Supplier balance is high',
      description: 'Supplier has 6,000,000 VND unpaid.',
      reason: 'Above threshold.',
      amount: 6_000_000,
      generatedAt: '2026-06-09T00:00:00.000Z',
      status: 'pending',
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OpsActionComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OpsActionComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function flushInitialLoad(tasks = [taskRow]) {
    fixture.detectChanges();
    http.expectOne('/api/ops-actions/suggestions').flush(suggestionsResponse);
    http.expectOne('/api/ops-actions/plans?limit=5').flush({ success: true, plans: [plan] });
    http.expectOne('/api/ops-actions/tasks?status=pending&limit=20').flush({ success: true, tasks });
    fixture.detectChanges();
  }

  it('loads suggestions, plans, and pending tasks on init', () => {
    flushInitialLoad();

    expect(component.response()?.totalCount).toBe(1);
    expect(component.plans().length).toBe(1);
    expect(component.pendingTasks().length).toBe(1);
    expect(component.queueLoading()).toBeFalse();
  });

  it('creates an approval-only plan from current suggestions and reloads the queue', () => {
    flushInitialLoad([]);

    component.createPlanFromSuggestions();

    const createReq = http.expectOne('/api/ops-actions/plans/from-suggestions');
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual(jasmine.objectContaining({ limit: 100 }));
    createReq.flush({ success: true, plan: { ...plan, tasks: [taskRow.task] } });

    http.expectOne('/api/ops-actions/plans?limit=5').flush({ success: true, plans: [plan] });
    http.expectOne('/api/ops-actions/tasks?status=pending&limit=20').flush({ success: true, tasks: [taskRow] });

    expect(component.queueMessage()).toContain('Morning ops plan');
    expect(component.pendingTasks().length).toBe(1);
  });

  it('approves a pending task without live execution and reloads the queue', () => {
    flushInitialLoad();

    component.approveTask(taskRow as any);

    const approveReq = http.expectOne(`/api/ops-actions/plans/${plan._id}/tasks/${taskRow.task._id}/approve`);
    expect(approveReq.request.method).toBe('PATCH');
    expect(approveReq.request.body).toEqual(jasmine.objectContaining({
      note: jasmine.stringMatching(/No live action executed/),
    }));
    approveReq.flush({ success: true, execution: { applied: false } });

    http.expectOne('/api/ops-actions/plans?limit=5').flush({ success: true, plans: [plan] });
    http.expectOne('/api/ops-actions/tasks?status=pending&limit=20').flush({ success: true, tasks: [] });

    expect(component.queueMessage()).toContain('Chưa thực thi live');
    expect(component.pendingTasks().length).toBe(0);
  });
});
