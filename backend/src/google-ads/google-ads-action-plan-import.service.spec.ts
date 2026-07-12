import { BadRequestException, ConflictException } from '@nestjs/common';
import AdmZip = require('adm-zip');
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { GoogleAdsActionPlanImportService } from './google-ads-action-plan-import.service';

const docsRoot = resolve(process.cwd(), '..', 'docs', 'ai-ads-v2');
const validZipPath = resolve(docsRoot, 'samples', 'ads_execution_plan_PLAN-20260612-001.zip');
const invalidRoot = resolve(docsRoot, 'validation-fixtures', 'invalid');

const sha256 = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

const createZip = (plan: any, extraEntries: Array<[string, string]> = []) => {
  const actionPlanBuffer = Buffer.from(`${JSON.stringify(plan, null, 2)}\n`);
  const manifest = {
    schemaVersion: plan.schemaVersion,
    planId: plan.planId,
    sourceExportId: plan.sourceExportId,
    generatedAt: '2026-06-12T10:00:00+07:00',
    generator: 'chatgpt-web',
    targetProvider: plan.targetProvider,
    currency: plan.currency,
    timezone: plan.timezone,
    executionMode: plan.executionMode,
    hashes: { 'action_plan.json': sha256(actionPlanBuffer) },
  };
  const zip = new AdmZip();
  zip.addFile('manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  zip.addFile('action_plan.json', actionPlanBuffer);
  for (const [name, value] of extraEntries) zip.addFile(name, Buffer.from(value));
  return zip.toBuffer();
};

describe('GoogleAdsActionPlanImportService', () => {
  const created: any[] = [];
  let existing: any = null;
  const actionPlanModel = {
    create: jest.fn(async (document) => {
      created.push(document);
      return document;
    }),
    findOne: jest.fn(() => ({ lean: async () => existing })),
  };
  const adAccountModel = {
    find: jest.fn(() => ({
      lean: async () => [{
        accountType: 'google',
        isActive: true,
        accountId: '1234567890',
        loginCustomerId: '4345552613',
      }],
    })),
  };
  const campaignBudgetModel = {
    findOne: jest.fn(() => ({ lean: async () => ({ customerId: '1234567890', campaignBudgetId: '1122334455', amountVnd: 500000 }) })),
  };

  beforeEach(() => {
    created.length = 0;
    existing = null;
    jest.clearAllMocks();
    process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST = 'htxbachgia.shop';
    process.env.GOOGLE_ADS_MAX_DAILY_BUDGET_VND = '5000000';
    process.env.GOOGLE_ADS_MAX_BUDGET_INCREASE_PERCENT = '20';
  });

  afterAll(() => {
    delete process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST;
    delete process.env.GOOGLE_ADS_MAX_DAILY_BUDGET_VND;
    delete process.env.GOOGLE_ADS_MAX_BUDGET_INCREASE_PERCENT;
  });

  const service = () => new GoogleAdsActionPlanImportService(
    actionPlanModel as any,
    adAccountModel as any,
    campaignBudgetModel as any,
  );

  it('imports a valid ZIP as pending actions without executing', async () => {
    const result = await service().importPending({
      originalname: 'ads_execution_plan_PLAN-20260612-001.zip',
      mimetype: 'application/zip',
      buffer: readFileSync(validZipPath),
    });

    expect(result).toEqual(expect.objectContaining({
      success: true,
      planId: 'PLAN-20260612-001',
      status: 'pending_approval',
      itemsTotal: 5,
      providerValidationStatus: 'pending',
    }));
    expect(created[0].items.every((item: any) =>
      item.status === 'pending' && item.providerValidationStatus === 'pending'
    )).toBe(true);
    expect(created[0]).not.toHaveProperty('providerResponse');
    expect(created[0]).not.toHaveProperty('executionLog');
  });

  it('rejects an invalid action plan ZIP', async () => {
    const plan = json(resolve(invalidRoot, 'action_plan.invalid-rsa-minimum.json'));
    await expect(service().importPending({
      originalname: 'invalid.zip',
      buffer: createZip(plan),
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(actionPlanModel.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate actionId in one ZIP', async () => {
    const plan = json(resolve(invalidRoot, 'action_plan.invalid-duplicate-action-id.json'));
    await expect(service().importPending({
      originalname: 'duplicate-action.zip',
      buffer: createZip(plan),
    })).rejects.toThrow('Duplicate actionId');
  });

  it('rejects duplicate idempotencyKey in one ZIP', async () => {
    const plan = json(resolve(invalidRoot, 'action_plan.invalid-duplicate-idempotency-key.json'));
    await expect(service().importPending({
      originalname: 'duplicate-idempotency.zip',
      buffer: createZip(plan),
    })).rejects.toThrow('Duplicate idempotencyKey');
  });

  it('rejects an idempotencyKey already stored in DB', async () => {
    existing = { planId: 'PLAN-EXISTING', idempotencyKeys: ['PLAN-20260612-001:ACT001'] };
    await expect(service().importPending({
      originalname: 'duplicate-existing.zip',
      buffer: readFileSync(validZipPath),
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects customer IDs and landing pages outside configured allowlists', async () => {
    const plan = json(resolve(docsRoot, 'validation-fixtures', 'valid', 'action_plan.valid.json'));
    plan.actions.forEach((action: any) => { action.customerId = '5555555555'; });
    await expect(service().importPending({
      originalname: 'customer-not-allowed.zip',
      buffer: createZip(plan),
    })).rejects.toThrow('customerId is not allowlisted');

    process.env.GOOGLE_ADS_LANDING_PAGE_ALLOWLIST = 'example.com';
    await expect(service().importPending({
      originalname: 'landing-not-allowed.zip',
      buffer: readFileSync(validZipPath),
    })).rejects.toThrow('Landing page is not allowlisted');
  });

  it('rejects a budget update that cannot be verified from synced ERP data', async () => {
    campaignBudgetModel.findOne.mockReturnValueOnce({ lean: async () => null } as any);
    await expect(service().importPending({
      originalname: 'unverified-budget.zip',
      buffer: readFileSync(validZipPath),
    })).rejects.toThrow('not present in synced ERP data');
  });

  it('rejects path traversal and file-count overflow', async () => {
    const plan = json(resolve(docsRoot, 'validation-fixtures', 'valid', 'action_plan.valid.json'));
    const traversalArchive = new AdmZip(createZip(plan, [['safe.txt', 'unsafe']]));
    traversalArchive.getEntry('safe.txt')!.entryName = '../unsafe.txt';
    await expect(service().importPending({ originalname: 'unsafe.zip', buffer: traversalArchive.toBuffer() }))
      .rejects.toThrow('unsafe path');

    process.env.GOOGLE_ADS_ACTION_PLAN_MAX_ZIP_FILES = '2';
    const tooManyFiles = createZip(plan, [['extra.txt', 'extra']]);
    await expect(service().importPending({ originalname: 'too-many.zip', buffer: tooManyFiles }))
      .rejects.toThrow('maximum file count');
    delete process.env.GOOGLE_ADS_ACTION_PLAN_MAX_ZIP_FILES;
  });
});
