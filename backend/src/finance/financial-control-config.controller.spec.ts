import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { FinancialControlController } from './financial-control.controller';
import { FinancialControlService } from './financial-control.service';
import { DEFAULT_CONFIG } from './interfaces/financial-control.interface';
import { PERMISSIONS_KEY } from '../auth/decorators/auth.decorator';

describe('FinancialControlController config RBAC', () => {
  let app: INestApplication;
  const service = {
    getConfig: jest.fn(() => ({ ...DEFAULT_CONFIG })),
    updateConfig: jest.fn().mockResolvedValue({ ...DEFAULT_CONFIG, SurvivalMonths: 6 }),
    getTaxObligationSnapshot: jest.fn().mockResolvedValue(null),
    upsertTaxObligationSnapshot: jest.fn().mockImplementation(async (input, user) => ({
      ...input,
      updatedBy: user.id,
    })),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FinancialControlController],
      providers: [
        Reflector,
        RolesGuard,
        { provide: FinancialControlService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: any) {
          const req = context.switchToHttp().getRequest();
          req.user = {
            id: 'user-1',
            email: `${req.headers['x-test-role']}@example.com`,
            role: req.headers['x-test-role'],
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

  it('allows finance readers to view canonical config but not mutate it', async () => {
    await request(app.getHttpServer())
      .get('/financial-control/config')
      .set('x-test-role', 'investor')
      .expect(200);
    await request(app.getHttpServer())
      .patch('/financial-control/config')
      .set('x-test-role', 'investor')
      .send({ SurvivalMonths: 6 })
      .expect(403);

    expect(service.getConfig).toHaveBeenCalledTimes(1);
    expect(service.updateConfig).not.toHaveBeenCalled();
  });

  it('allows the director policy owner and forwards the JWT actor', async () => {
    await request(app.getHttpServer())
      .patch('/financial-control/config')
      .set('x-test-role', 'director')
      .send({ SurvivalMonths: 6 })
      .expect(200);

    expect(service.updateConfig).toHaveBeenCalledWith(
      { SurvivalMonths: 6 },
      expect.objectContaining({ role: 'director', email: 'director@example.com' }),
    );
  });

  it('protects both tax snapshot endpoints with finance.policy.manage', async () => {
    expect(Reflect.getMetadata(
      PERMISSIONS_KEY,
      FinancialControlController.prototype.getTaxObligation,
    )).toEqual(['finance', 'finance.policy.manage']);
    expect(Reflect.getMetadata(
      PERMISSIONS_KEY,
      FinancialControlController.prototype.upsertTaxObligation,
    )).toEqual(['finance', 'finance.policy.manage']);

    await request(app.getHttpServer())
      .get('/financial-control/tax-obligation')
      .set('x-test-role', 'investor')
      .expect(403);
    await request(app.getHttpServer())
      .put('/financial-control/tax-obligation')
      .set('x-test-role', 'investor')
      .send({})
      .expect(403);
  });
});
