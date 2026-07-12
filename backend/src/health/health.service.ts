import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

type IndexRequirement = {
  collection: string;
  keys: Record<string, 1 | -1>;
  unique: boolean;
  partialFilterExpression?: Record<string, unknown>;
};

const CRITICAL_INDEXES: IndexRequirement[] = [
  { collection: 'system_settings', keys: { key: 1 }, unique: true },
  {
    collection: 'cashflow_summary_snapshots',
    keys: { domain: 1, windowDays: 1 },
    unique: true,
  },
  {
    collection: 'cashflowentries',
    keys: { idempotencyKey: 1 },
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
  {
    collection: 'loan_payments',
    keys: { idempotencyKey: 1 },
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
  {
    collection: 'loan_payments',
    keys: { repaymentId: 1 },
    unique: true,
    partialFilterExpression: { repaymentId: { $type: 'objectId' } },
  },
  {
    collection: 'fund_transactions',
    keys: { idempotencyKey: 1 },
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
  {
    collection: 'owner_fund_accounts',
    keys: { isActive: 1 },
    unique: true,
    partialFilterExpression: { isActive: true },
  },
  {
    collection: 'google_ads_action_execution_logs',
    keys: { idempotencyKey: 1 },
    unique: true,
    partialFilterExpression: { idempotencyReserved: true },
  },
  {
    collection: 'google_ads_financial_execution_leases',
    keys: { scope: 1 },
    unique: true,
  },
];

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async checkDatabase(requireProductionCapabilities: boolean) {
    const timeoutMs = this.readTimeoutMs();
    try {
      const checks = await this.withTimeout(
        this.runChecks(requireProductionCapabilities),
        timeoutMs,
      );
      return {
        status: 'ok',
        checks,
        timestamp: new Date().toISOString(),
      };
    } catch {
      // Do not include driver errors, hostnames, database names or URI fragments in the response/log.
      this.logger.warn('[READINESS] Database readiness check failed');
      throw new ServiceUnavailableException({
        status: 'error',
        code: 'DATABASE_NOT_READY',
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async runChecks(requireProductionCapabilities: boolean) {
    if (this.connection.readyState !== 1 || !this.connection.db) {
      throw new Error('database connection is not ready');
    }

    const admin = this.connection.db.admin();
    const ping = await admin.command({ ping: 1 });
    if (ping?.ok !== 1) throw new Error('database ping failed');

    const hello: any = await admin.command({ hello: 1 });
    const writablePrimary = hello?.isWritablePrimary === true || hello?.ismaster === true;
    if (!writablePrimary) throw new Error('database is not writable');

    const checks: Record<string, boolean> = {
      connected: true,
      ping: true,
      writablePrimary: true,
    };

    if (requireProductionCapabilities) {
      const transactionTopology = Boolean(
        hello?.setName
        || hello?.msg === 'isdbgrid'
        || hello?.serviceId,
      );
      const sessionTimeout = hello?.logicalSessionTimeoutMinutes;
      const sessionsAvailable = typeof sessionTimeout === 'number'
        && Number.isFinite(sessionTimeout)
        && sessionTimeout > 0;
      if (!transactionTopology || !sessionsAvailable) {
        throw new Error('database topology does not support required transactions');
      }
      checks.transactions = true;

      for (const requirement of CRITICAL_INDEXES) {
        if (!await this.hasIndex(requirement)) {
          throw new Error('critical database index is missing');
        }
      }
      checks.criticalIndexes = true;
    }

    return checks;
  }

  private async hasIndex(requirement: IndexRequirement): Promise<boolean> {
    const indexes = await this.connection.db.collection(requirement.collection).indexes();
    return indexes.some((index: any) => {
      if (Boolean(index.unique) !== requirement.unique) return false;
      if (requirement.partialFilterExpression
        && JSON.stringify(index.partialFilterExpression || {})
          !== JSON.stringify(requirement.partialFilterExpression)) {
        return false;
      }
      const actual = Object.entries(index.key || {});
      const expected = Object.entries(requirement.keys);
      return actual.length === expected.length
        && actual.every(([key, direction], position) => (
          expected[position]?.[0] === key && expected[position]?.[1] === direction
        ));
    });
  }

  private readTimeoutMs(): number {
    const configured = Number(process.env.DB_READINESS_TIMEOUT_MS || 3000);
    return Number.isFinite(configured) && configured >= 500 && configured <= 30_000
      ? configured
      : 3000;
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('database readiness timeout')), timeoutMs);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
}
