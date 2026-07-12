import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { GoogleAdsActionPlanImportService } from './google-ads-action-plan-import.service';
import { GoogleAdsActionPlanService } from './google-ads-action-plan.service';
import { GoogleAdsController } from './google-ads.controller';
import { GoogleAdsExportService } from './google-ads-export.service';
import { GoogleAdsExecutionService } from './google-ads-execution.service';
import { GoogleAdsProviderValidationService } from './google-ads-provider-validation.service';
import { GoogleAdsReadonlySyncService } from './google-ads-readonly-sync.service';

describe('GoogleAdsController approval RBAC', () => {
  let app: INestApplication;
  const actionPlanService = {
    approve: jest.fn().mockResolvedValue({ success: true, action: { status: 'approved' } }),
    reject: jest.fn().mockResolvedValue({ success: true, action: { status: 'rejected' } }),
    getPlan: jest.fn(),
    getExecutions: jest.fn(),
  };
  const executionService = {
    execute: jest.fn().mockResolvedValue({ success: true, dryRun: true }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [GoogleAdsController],
      providers: [
        Reflector,
        RolesGuard,
        { provide: GoogleAdsReadonlySyncService, useValue: {} },
        { provide: GoogleAdsExportService, useValue: {} },
        { provide: GoogleAdsActionPlanImportService, useValue: {} },
        { provide: GoogleAdsProviderValidationService, useValue: {} },
        { provide: GoogleAdsActionPlanService, useValue: actionPlanService },
        { provide: GoogleAdsExecutionService, useValue: executionService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: any) {
          const request = context.switchToHttp().getRequest();
          request.user = {
            id: 'user-1',
            email: `${request.headers['x-test-role']}@example.com`,
            role: request.headers['x-test-role'],
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());

  beforeEach(() => jest.clearAllMocks());

  it('allows approve and reject for a role with google-ads.approve', async () => {
    await request(app.getHttpServer())
      .patch('/google-ads/action-plans/PLAN-001/items/ACT001/approve')
      .set('x-test-role', 'director')
      .send({ approvedBySource: 'codex_operator', approvalText: 'Approve ACT001' })
      .expect(200);
    await request(app.getHttpServer())
      .patch('/google-ads/action-plans/PLAN-001/items/ACT001/reject')
      .set('x-test-role', 'director')
      .send({ rejectedBySource: 'codex_operator', reason: 'Reject ACT001' })
      .expect(200);

    expect(actionPlanService.approve).toHaveBeenCalledTimes(1);
    expect(actionPlanService.reject).toHaveBeenCalledTimes(1);
  });

  it('returns forbidden when the role lacks google-ads.approve', async () => {
    await request(app.getHttpServer())
      .patch('/google-ads/action-plans/PLAN-001/items/ACT001/approve')
      .set('x-test-role', 'manager')
      .send({ approvedBySource: 'codex_operator', approvalText: 'Approve ACT001' })
      .expect(403);

    expect(actionPlanService.approve).not.toHaveBeenCalled();
  });

  it('checks google-ads.execute permission on the execution endpoint', async () => {
    await request(app.getHttpServer())
      .post('/google-ads/action-plans/PLAN-001/execute')
      .set('x-test-role', 'director')
      .send({ actionIds: ['ACT001'], dryRun: true, source: 'codex_operator' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/google-ads/action-plans/PLAN-001/execute')
      .set('x-test-role', 'manager')
      .send({ actionIds: ['ACT001'], dryRun: true, source: 'codex_operator' })
      .expect(403);

    expect(executionService.execute).toHaveBeenCalledTimes(1);
  });
});
