import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { AutoScaleDecisionService } from './scale-decision/auto-scale-decision.service';
import { AutoScaleExecutionService } from './auto-scale-execution.service';
import { CashflowSafetyService } from './cashflow-safety.service';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

describe('FinanceController budget bucket RBAC', () => {
  let app: INestApplication;
  const financeService = {
    createBudgetBucket: jest.fn().mockResolvedValue({ _id: 'bucket-1' }),
    listBudgetBuckets: jest.fn().mockResolvedValue([]),
    updateBudgetBucket: jest.fn().mockResolvedValue({ _id: 'bucket-1' }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        Reflector,
        RolesGuard,
        { provide: FinanceService, useValue: financeService },
        { provide: CashflowSafetyService, useValue: {} },
        { provide: AutoScaleDecisionService, useValue: {} },
        { provide: AutoScaleExecutionService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: any) {
          const req = context.switchToHttp().getRequest();
          req.user = { id: 'user-1', role: req.headers['x-test-role'] };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('allows the director owner surface to create and update buckets', async () => {
    await request(app.getHttpServer())
      .post('/finance/budget-buckets')
      .set('x-test-role', 'director')
      .send({ name: 'Global cap', productGroupIds: [], dailyCap: 500000 })
      .expect(201);
    await request(app.getHttpServer())
      .patch('/finance/budget-buckets/507f1f77bcf86cd799439011')
      .set('x-test-role', 'director')
      .send({ active: false })
      .expect(200);

    expect(financeService.createBudgetBucket).toHaveBeenCalledTimes(1);
    expect(financeService.updateBudgetBucket).toHaveBeenCalledTimes(1);
  });

  it('allows finance read but blocks mutation without manage permission', async () => {
    await request(app.getHttpServer())
      .get('/finance/budget-buckets')
      .set('x-test-role', 'investor')
      .expect(200);
    await request(app.getHttpServer())
      .post('/finance/budget-buckets')
      .set('x-test-role', 'investor')
      .send({ name: 'Not allowed' })
      .expect(403);

    expect(financeService.listBudgetBuckets).toHaveBeenCalledTimes(1);
    expect(financeService.createBudgetBucket).not.toHaveBeenCalled();
  });
});
