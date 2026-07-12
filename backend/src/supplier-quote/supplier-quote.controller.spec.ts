import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { SupplierQuoteController } from './supplier-quote.controller';
import { SupplierQuoteService } from './supplier-quote.service';

describe('SupplierQuoteController approval RBAC', () => {
  let app: INestApplication;
  const quoteId = '507f1f77bcf86cd799439011';
  const service = {
    approve: jest.fn().mockResolvedValue({ approvalStatus: 'approved' }),
    reject: jest.fn().mockResolvedValue({ approvalStatus: 'rejected' }),
    claimProvenance: jest.fn().mockResolvedValue({ approvalStatus: 'pending', provenanceComplete: true }),
    create: jest.fn().mockResolvedValue({ approvalStatus: 'pending' }),
    update: jest.fn(),
    findAll: jest.fn(),
    getLatest: jest.fn(),
    getEffectiveAt: jest.fn(),
    getPriceHistory: jest.fn(),
    getSupplierQuotes: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SupplierQuoteController],
      providers: [
        Reflector,
        RolesGuard,
        { provide: SupplierQuoteService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: any) {
          const requestObject = context.switchToHttp().getRequest();
          requestObject.user = {
            id: '507f1f77bcf86cd799439012',
            email: `${requestObject.headers['x-test-role']}@example.com`,
            role: requestObject.headers['x-test-role'],
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

  it('allows a director to approve and reject using the authenticated actor', async () => {
    await request(app.getHttpServer())
      .patch(`/supplier-quotes/${quoteId}/approve`)
      .set('x-test-role', 'director')
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/supplier-quotes/${quoteId}/reject`)
      .set('x-test-role', 'director')
      .send({ reason: 'Giá chưa đúng thỏa thuận' })
      .expect(200);

    expect(service.approve).toHaveBeenCalledWith(
      quoteId,
      expect.objectContaining({ role: 'director', email: 'director@example.com' }),
    );
    expect(service.reject).toHaveBeenCalledWith(
      quoteId,
      expect.objectContaining({ role: 'director' }),
      'Giá chưa đúng thỏa thuận',
    );
  });

  it('takes create and legacy provenance actors only from the authenticated request', async () => {
    await request(app.getHttpServer())
      .post('/supplier-quotes')
      .set('x-test-role', 'director')
      .send({
        productId: '507f1f77bcf86cd799439013',
        supplierId: '507f1f77bcf86cd799439014',
        price: 180000,
        createdBy: '507f1f77bcf86cd799439099',
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/supplier-quotes/${quoteId}/claim-provenance`)
      .set('x-test-role', 'director')
      .send({ actorId: '507f1f77bcf86cd799439099' })
      .expect(200);

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ price: 180000 }),
      expect.objectContaining({ id: '507f1f77bcf86cd799439012', role: 'director' }),
    );
    expect(service.claimProvenance).toHaveBeenCalledWith(
      quoteId,
      expect.objectContaining({ id: '507f1f77bcf86cd799439012', role: 'director' }),
    );
  });

  it('returns forbidden for a role without supplier-quotes.approve', async () => {
    await request(app.getHttpServer())
      .patch(`/supplier-quotes/${quoteId}/approve`)
      .set('x-test-role', 'manager')
      .send({})
      .expect(403);

    expect(service.approve).not.toHaveBeenCalled();
  });
});
