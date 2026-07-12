import { AdsAutomationEvidenceSnapshotStoreService } from './ads-automation-evidence-snapshot-store.service';
import { AdsAutomationEvidenceSnapshotRecordSchema } from './schemas/ads-automation-evidence-snapshot.schema';
import { AdsAutomationEvidenceController } from './ads-automation-evidence.controller';
import { PERMISSIONS_KEY } from '../auth/decorators/auth.decorator';

function queryResult<T>(resolver: (sort?: any, limit?: number) => T) {
  let sortValue: any;
  let limitValue: number | undefined;
  const query: any = {
    sort: jest.fn((value) => {
      sortValue = value;
      return query;
    }),
    limit: jest.fn((value) => {
      limitValue = value;
      return query;
    }),
    lean: jest.fn(() => query),
    exec: jest.fn(async () => resolver(sortValue, limitValue)),
  };
  return query;
}

function matches(record: any, filter: any): boolean {
  return Object.entries(filter || {}).every(([key, expected]: [string, any]) => {
    if (expected && typeof expected === 'object' && '$lt' in expected) {
      return String(record[key]) < String(expected.$lt);
    }
    return record[key] === expected;
  });
}

function createInMemoryModel(seed: any[] = []) {
  const records = [...seed];
  const model: any = {
    records,
    findOne: jest.fn((filter: any) => queryResult((sort) => {
      const found = records.filter((item) => matches(item, filter));
      if (sort?.capturedAt === -1) {
        found.sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
      }
      return found[0] || null;
    })),
    find: jest.fn((filter: any) => queryResult((sort, limit) => {
      const found = records.filter((item) => matches(item, filter));
      if (sort?.dateKey === -1) {
        found.sort((a, b) => String(b.dateKey).localeCompare(String(a.dateKey)));
      }
      return found.slice(0, limit || found.length);
    })),
    create: jest.fn(async (payload: any) => {
      // Yield once so concurrent capture calls can both reach the create-only race.
      await Promise.resolve();
      const duplicate = records.some((item) =>
        item.dateKey === payload.dateKey
        && item.environment === payload.environment
        && item.schemaVersion === payload.schemaVersion);
      if (duplicate) {
        const error: any = new Error('E11000 duplicate key');
        error.code = 11000;
        throw error;
      }
      const stored = { _id: `snapshot-${records.length + 1}`, ...payload };
      records.push(stored);
      return { ...stored, toObject: () => ({ ...stored }) };
    }),
  };
  return model;
}

function evidencePayload(overrides: Record<string, any> = {}) {
  return {
    schemaVersion: 'ads_automation_evidence_snapshot.v1',
    snapshotId: 'ads-evidence-test',
    generatedAt: '2026-07-10T00:00:00.000Z',
    environment: 'local',
    productionEnabled: false,
    providerExecutionEnabled: false,
    dryRun: true,
    killSwitchActive: false,
    summary: {
      totalAdGroups: 1,
      scaleReady: 0,
      hold: 0,
      monitorOnly: 1,
      blocked: 0,
      needsMapping: 0,
      executionReady: 0,
      executionBlocked: 1,
    },
    adGroups: [],
    globalBlockers: [],
    safety: {
      localOnly: true,
      providerApiCalled: false,
      googleAdsApiCalled: false,
      liveExecutionUsed: false,
      secretsRedacted: true,
      campaignBudgetIdNoFallback: true,
    },
    ...overrides,
  };
}

describe('AdsAutomationEvidenceSnapshotStoreService', () => {
  const previousEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...previousEnv,
      NODE_ENV: 'test',
      DATABASE_NAME: 'unit-test',
      MONGODB_URI: '',
    };
  });

  afterEach(() => {
    process.env = previousEnv;
  });

  it('uses immutable fields and a unique daily environment/schema identity', () => {
    expect((AdsAutomationEvidenceSnapshotRecordSchema.path('payload') as any).options.immutable).toBe(true);
    expect((AdsAutomationEvidenceSnapshotRecordSchema.path('hash') as any).options.immutable).toBe(true);
    const hasUniqueDailyIndex = AdsAutomationEvidenceSnapshotRecordSchema.indexes()
      .some(([fields, options]: any[]) =>
        fields.dateKey === 1
        && fields.environment === 1
        && fields.schemaVersion === 1
        && options.unique === true);
    expect(hasUniqueDailyIndex).toBe(true);
  });

  it('keeps history reads under read RBAC and capture under plan/write RBAC', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, AdsAutomationEvidenceController)).toEqual(['google-ads.read']);
    expect(Reflect.getMetadata(
      PERMISSIONS_KEY,
      AdsAutomationEvidenceController.prototype.capture,
    )).toEqual(['google-ads.plan']);
  });

  it('handles concurrent capture with one create winner and one idempotent reader', async () => {
    const model = createInMemoryModel();
    let buildCalls = 0;
    let release: () => void = () => undefined;
    const bothBuilding = new Promise<void>((resolve) => { release = resolve; });
    const evidenceService = {
      buildSnapshot: jest.fn(async () => {
        buildCalls += 1;
        if (buildCalls === 2) release();
        await bothBuilding;
        return evidencePayload();
      }),
    };
    const service = new AdsAutomationEvidenceSnapshotStoreService(model, evidenceService as any);

    const results = await Promise.all([service.captureDaily(), service.captureDaily()]);

    expect(results.filter((item) => item.created)).toHaveLength(1);
    expect(results.filter((item) => !item.created)).toHaveLength(1);
    expect(model.records).toHaveLength(1);
    expect(model.create).toHaveBeenCalledTimes(2);
    expect(results[0].snapshot._id).toBe(results[1].snapshot._id);
  });

  it('never overwrites an existing daily snapshot', async () => {
    const model = createInMemoryModel();
    const evidenceService = {
      buildSnapshot: jest
        .fn()
        .mockResolvedValueOnce(evidencePayload({ summary: { totalAdGroups: 1 } }))
        .mockResolvedValueOnce(evidencePayload({ summary: { totalAdGroups: 999 } })),
    };
    const service = new AdsAutomationEvidenceSnapshotStoreService(model, evidenceService as any);

    const first = await service.captureDaily();
    const second = await service.captureDaily();

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(evidenceService.buildSnapshot).toHaveBeenCalledTimes(1);
    expect(model.create).toHaveBeenCalledTimes(1);
    expect(second.snapshot.payload.summary.totalAdGroups).toBe(1);
    expect(second.snapshot.hash).toBe(first.snapshot.hash);
  });

  it('redacts payload before hashing and produces a canonical SHA-256 hash', async () => {
    const model = createInMemoryModel();
    const payload = evidencePayload({
      metadata: {
        apiKey: 'sk-plaintext-must-not-persist',
        note: 'api_key=sk-another-plaintext-value',
      },
    });
    const evidenceService = { buildSnapshot: jest.fn().mockResolvedValue(payload) };
    const service = new AdsAutomationEvidenceSnapshotStoreService(model, evidenceService as any);

    const result = await service.captureDaily();

    expect(result.snapshot.payload.metadata.apiKey).toBe('[REDACTED]');
    expect(result.snapshot.payload.metadata.note).toBe('api_key=[REDACTED]');
    expect(result.snapshot.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.snapshot.hash).not.toContain('plaintext');
    expect(service.hashPayload({ b: 2, a: { d: 4, c: 3 } }))
      .toBe(service.hashPayload({ a: { c: 3, d: 4 }, b: 2 }));
  });

  it('reads latest and bounded history without mutating records', async () => {
    const seed = [
      { _id: 'one', environment: 'local', dateKey: '2026-07-08', capturedAt: new Date('2026-07-08T00:00:00Z') },
      { _id: 'two', environment: 'local', dateKey: '2026-07-09', capturedAt: new Date('2026-07-09T00:00:00Z') },
      { _id: 'three', environment: 'local', dateKey: '2026-07-10', capturedAt: new Date('2026-07-10T00:00:00Z') },
      { _id: 'prod', environment: 'production', dateKey: '2026-07-11', capturedAt: new Date('2026-07-11T00:00:00Z') },
    ];
    const model = createInMemoryModel(seed);
    const service = new AdsAutomationEvidenceSnapshotStoreService(model, {} as any);

    const latest = await service.latest('local');
    const history = await service.history({ environment: 'local', beforeDateKey: '2026-07-10', limit: 1 });

    expect(latest?._id).toBe('three');
    expect(history.map((item) => item._id)).toEqual(['two']);
    expect(model.create).not.toHaveBeenCalled();
  });
});
