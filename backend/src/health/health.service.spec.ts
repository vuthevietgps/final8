import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

describe('HealthService database readiness', () => {
  const createConnection = (options: {
    readyState?: number;
    hello?: Record<string, unknown>;
    indexes?: Record<string, any[]>;
    commandError?: Error;
  } = {}) => {
    const command = jest.fn().mockImplementation(async (commandBody: Record<string, unknown>) => {
      if (options.commandError) throw options.commandError;
      if ('ping' in commandBody) return { ok: 1 };
      return options.hello || {
        isWritablePrimary: true,
        setName: 'rs0',
        logicalSessionTimeoutMinutes: 30,
      };
    });
    const indexes = options.indexes || {
      system_settings: [{ key: { key: 1 }, unique: true }],
      cashflow_summary_snapshots: [{ key: { domain: 1, windowDays: 1 }, unique: true }],
      cashflowentries: [{
        key: { idempotencyKey: 1 }, unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      }],
      loan_payments: [
        {
          key: { idempotencyKey: 1 }, unique: true,
          partialFilterExpression: { idempotencyKey: { $type: 'string' } },
        },
        {
          key: { repaymentId: 1 }, unique: true,
          partialFilterExpression: { repaymentId: { $type: 'objectId' } },
        },
      ],
      fund_transactions: [{
        key: { idempotencyKey: 1 }, unique: true,
        partialFilterExpression: { idempotencyKey: { $type: 'string' } },
      }],
      owner_fund_accounts: [{
        key: { isActive: 1 }, unique: true,
        partialFilterExpression: { isActive: true },
      }],
      google_ads_action_execution_logs: [{
        key: { idempotencyKey: 1 }, unique: true,
        partialFilterExpression: { idempotencyReserved: true },
      }],
      google_ads_financial_execution_leases: [{ key: { scope: 1 }, unique: true }],
    };
    return {
      readyState: options.readyState ?? 1,
      db: {
        admin: () => ({ command }),
        collection: (name: string) => ({
          indexes: jest.fn().mockResolvedValue(indexes[name] || []),
        }),
      },
    };
  };

  it('passes strict readiness only with writable transaction topology and critical indexes', async () => {
    const service = new HealthService(createConnection() as any);

    const result = await service.checkDatabase(true);

    expect(result).toEqual(expect.objectContaining({
      status: 'ok',
      checks: {
        connected: true,
        ping: true,
        writablePrimary: true,
        transactions: true,
        criticalIndexes: true,
      },
    }));
    expect(JSON.stringify(result)).not.toMatch(/dbName|count|management-system/i);
  });

  it('allows basic health without requiring transaction topology', async () => {
    const service = new HealthService(createConnection({
      hello: { isWritablePrimary: true },
    }) as any);

    const result = await service.checkDatabase(false);

    expect(result.checks).toEqual({
      connected: true,
      ping: true,
      writablePrimary: true,
    });
  });

  it.each([
    ['disconnected', { readyState: 0 }],
    ['not writable', { hello: { isWritablePrimary: false, setName: 'rs0', logicalSessionTimeoutMinutes: 30 } }],
    ['standalone topology', { hello: { isWritablePrimary: true, logicalSessionTimeoutMinutes: 30 } }],
    ['sessions unavailable', { hello: { isWritablePrimary: true, setName: 'rs0', logicalSessionTimeoutMinutes: null } }],
    ['missing index', { indexes: { system_settings: [], cashflow_summary_snapshots: [] } }],
    ['command failure', { commandError: new Error('driver details must not escape') }],
  ])('returns a safe 503 when readiness fails: %s', async (_name, options) => {
    const service = new HealthService(createConnection(options as any) as any);

    await expect(service.checkDatabase(true)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.checkDatabase(true)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'DATABASE_NOT_READY' }),
    });
  });
});
