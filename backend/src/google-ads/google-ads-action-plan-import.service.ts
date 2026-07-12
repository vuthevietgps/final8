import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import AdmZip = require('adm-zip');
import Ajv2020, { ValidateFunction } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { Model } from 'mongoose';
import { resolve } from 'path';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import {
  GoogleAdsActionPlan,
  GoogleAdsActionPlanDocument,
} from './schemas/google-ads-action-plan.schema';
import {
  GoogleAdsCampaignBudget,
  GoogleAdsCampaignBudgetDocument,
} from './schemas/google-ads-campaign-budget.schema';

type ImportFile = { originalname?: string; mimetype?: string; size?: number; buffer?: Buffer };
type ImportAction = {
  actionId: string;
  idempotencyKey: string;
  provider: 'google';
  actionType: string;
  customerId: string;
  loginCustomerId?: string;
  resourceType: string;
  operation: string;
  typedPayload: Record<string, any>;
  reason: string;
  evidence: Record<string, any>;
  confidence: number;
  risk: 'low' | 'medium' | 'high';
  dataQuality: string;
  approvalRequired: true;
  rollbackIf: string[];
};
type ImportPlan = {
  schemaVersion: '2.0';
  planId: string;
  sourceExportId: string;
  targetProvider: 'google';
  currency: 'VND';
  timezone: 'Asia/Ho_Chi_Minh';
  executionMode: 'pending_approval';
  analysisSummary: Record<string, any>;
  actions: ImportAction[];
};

@Injectable()
export class GoogleAdsActionPlanImportService {
  private readonly validateActionPlan: ValidateFunction;
  private readonly validateManifest: ValidateFunction;

  constructor(
    @InjectModel(GoogleAdsActionPlan.name)
    private readonly actionPlanModel: Model<GoogleAdsActionPlanDocument>,
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(GoogleAdsCampaignBudget.name)
    private readonly campaignBudgetModel: Model<GoogleAdsCampaignBudgetDocument>,
  ) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    this.validateActionPlan = ajv.compile(this.loadContract('action-plan.schema.json'));
    this.validateManifest = ajv.compile(this.loadContract('manifest.schema.json'));
  }

  async importPending(file: ImportFile, options?: { source?: string }) {
    const buffer = this.validateUpload(file);
    const zip = this.openAndValidateZip(buffer);
    const manifest = this.parseRequiredJson(zip, 'manifest.json');
    const actionPlan = this.parseRequiredJson(zip, 'action_plan.json') as ImportPlan;
    this.validateSchemas(manifest, actionPlan);
    this.validateManifestConsistency(manifest, actionPlan, zip);
    this.validateUniqueActions(actionPlan);
    await this.validateBusinessRules(actionPlan);
    await this.validateDatabaseDuplicates(actionPlan);

    const items = actionPlan.actions.map((action) => ({
      ...action,
      status: 'pending',
      providerValidationStatus: 'pending',
    }));
    try {
      await this.actionPlanModel.create({
        planId: actionPlan.planId,
        sourceExportId: actionPlan.sourceExportId,
        schemaVersion: actionPlan.schemaVersion,
        targetProvider: actionPlan.targetProvider,
        currency: actionPlan.currency,
        timezone: actionPlan.timezone,
        executionMode: actionPlan.executionMode,
        status: 'pending_approval',
        providerValidationStatus: 'pending',
        analysisSummary: actionPlan.analysisSummary,
        items,
        actionIds: actionPlan.actions.map((action) => action.actionId),
        idempotencyKeys: actionPlan.actions.map((action) => action.idempotencyKey),
        manifest,
        source: options?.source || 'codex_operator',
        originalFileName: file.originalname,
        originalZipSha256: this.sha256(buffer),
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new ConflictException('Action plan, action ID, or idempotency key already exists.');
      }
      throw error;
    }

    return {
      success: true,
      planId: actionPlan.planId,
      status: 'pending_approval',
      itemsTotal: items.length,
      itemsValid: items.length,
      itemsInvalid: 0,
      providerValidationStatus: 'pending',
    };
  }

  private validateUpload(file: ImportFile) {
    const maxBytes = this.positiveEnv('GOOGLE_ADS_ACTION_PLAN_MAX_ZIP_BYTES', 10 * 1024 * 1024);
    if (!file?.buffer?.length) throw new BadRequestException('ads_execution_plan.zip is required.');
    if (file.buffer.length > maxBytes) throw new BadRequestException(`ZIP exceeds maximum size of ${maxBytes} bytes.`);
    if (file.buffer[0] !== 0x50 || file.buffer[1] !== 0x4b) throw new BadRequestException('Uploaded file is not a ZIP archive.');
    return file.buffer;
  }

  private openAndValidateZip(buffer: Buffer) {
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      throw new BadRequestException('Invalid ZIP archive.');
    }
    const entries = zip.getEntries();
    const maxFiles = this.positiveEnv('GOOGLE_ADS_ACTION_PLAN_MAX_ZIP_FILES', 50);
    const maxUncompressedBytes = this.positiveEnv('GOOGLE_ADS_ACTION_PLAN_MAX_UNCOMPRESSED_BYTES', 25 * 1024 * 1024);
    if (entries.length > maxFiles) throw new BadRequestException(`ZIP exceeds maximum file count of ${maxFiles}.`);
    const names = new Set<string>();
    let totalUncompressed = 0;
    for (const entry of entries) {
      const name = entry.entryName.replace(/\\/g, '/');
      if (entry.isDirectory) continue;
      if (!name || name.startsWith('/') || /^[A-Za-z]:\//.test(name) || name.split('/').includes('..')) {
        throw new BadRequestException(`ZIP contains unsafe path: ${entry.entryName}`);
      }
      if (name.includes('/')) throw new BadRequestException(`ZIP files must be at archive root: ${entry.entryName}`);
      if (names.has(name)) throw new BadRequestException(`ZIP contains duplicate file name: ${name}`);
      names.add(name);
      totalUncompressed += Number(entry.header.size || 0);
    }
    if (totalUncompressed > maxUncompressedBytes) {
      throw new BadRequestException(`ZIP exceeds maximum uncompressed size of ${maxUncompressedBytes} bytes.`);
    }
    for (const required of ['manifest.json', 'action_plan.json']) {
      if (!names.has(required)) throw new BadRequestException(`ZIP is missing required file: ${required}`);
    }
    return zip;
  }

  private parseRequiredJson(zip: AdmZip, name: string) {
    try {
      return JSON.parse(zip.readAsText(name).replace(/^\uFEFF/, ''));
    } catch {
      throw new BadRequestException(`${name} is not valid JSON.`);
    }
  }

  private validateSchemas(manifest: any, actionPlan: ImportPlan) {
    if (!this.validateManifest(manifest)) {
      throw new BadRequestException({ message: 'manifest.json failed schema validation.', errors: this.validateManifest.errors });
    }
    if (!this.validateActionPlan(actionPlan)) {
      throw new BadRequestException({ message: 'action_plan.json failed schema validation.', errors: this.validateActionPlan.errors });
    }
  }

  private validateManifestConsistency(manifest: any, plan: ImportPlan, zip: AdmZip) {
    for (const field of ['schemaVersion', 'planId', 'sourceExportId', 'targetProvider', 'currency', 'timezone', 'executionMode']) {
      if (manifest[field] !== (plan as any)[field]) {
        throw new BadRequestException(`manifest.json ${field} does not match action_plan.json.`);
      }
    }
    for (const [name, expected] of Object.entries(manifest.hashes || {})) {
      const entry = zip.getEntry(name);
      if (!entry || this.sha256(entry.getData()) !== expected) {
        throw new BadRequestException(`Manifest checksum failed for ${name}.`);
      }
    }
  }

  private validateUniqueActions(plan: ImportPlan) {
    this.assertUnique(plan.actions.map((action) => action.actionId), 'Duplicate actionId in action plan.');
    this.assertUnique(plan.actions.map((action) => action.idempotencyKey), 'Duplicate idempotencyKey in action plan.');
  }

  private async validateBusinessRules(plan: ImportPlan) {
    const accounts = await this.adAccountModel.find({ accountType: 'google', isActive: true }).lean();
    const envCustomerIds = this.csvEnv('GOOGLE_ADS_CUSTOMER_ID_ALLOWLIST').map((value) => this.digits(value));
    const envLoginCustomerIds = this.csvEnv('GOOGLE_ADS_LOGIN_CUSTOMER_ID_ALLOWLIST', 'GOOGLE_ADS_LOGIN_CUSTOMER_ID')
      .map((value) => this.digits(value));
    const allowedCustomerIds = new Set([
      ...envCustomerIds,
      ...accounts.map((account: any) => this.digits(account.accountId)),
    ].filter(Boolean));
    if (!allowedCustomerIds.size) throw new BadRequestException('Google Ads customer allowlist is empty.');

    const accountsByCustomerId = new Map(accounts.map((account: any) => [this.digits(account.accountId), account]));
    for (const action of plan.actions) {
      if (!allowedCustomerIds.has(action.customerId)) {
        throw new BadRequestException(`customerId is not allowlisted for action ${action.actionId}.`);
      }
      const account: any = accountsByCustomerId.get(action.customerId);
      if (action.loginCustomerId) {
        const configuredLoginId = this.digits(account?.loginCustomerId);
        if (configuredLoginId !== action.loginCustomerId && !envLoginCustomerIds.includes(action.loginCustomerId)) {
          throw new BadRequestException(`loginCustomerId does not match configured account for action ${action.actionId}.`);
        }
      }
      this.rejectRawExecutionPayload(action);
      this.validateLandingPages(action);
      await this.validateBudgetPolicy(action);
    }
  }

  private validateLandingPages(action: ImportAction) {
    const urls = this.collectUrls(action.typedPayload);
    if (!urls.length) return;
    const allowlist = this.csvEnv('GOOGLE_ADS_LANDING_PAGE_ALLOWLIST', 'AI_MARKETING_LANDING_PAGE_ALLOWLIST')
      .map((value) => value.toLowerCase());
    if (!allowlist.length) throw new BadRequestException('Landing page allowlist is empty.');
    for (const raw of urls) {
      let url: URL;
      try { url = new URL(raw); } catch { throw new BadRequestException(`Invalid landing page URL in action ${action.actionId}.`); }
      const host = url.hostname.toLowerCase();
      if (url.protocol !== 'https:' || !allowlist.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
        throw new BadRequestException(`Landing page is not allowlisted for action ${action.actionId}.`);
      }
    }
  }

  private async validateBudgetPolicy(action: ImportAction) {
    if (!['create_search_campaign', 'update_campaign_budget'].includes(action.actionType)) return;
    const requested = Number(action.typedPayload.dailyBudget);
    const maxDaily = this.positiveEnv('GOOGLE_ADS_MAX_DAILY_BUDGET_VND', 5_000_000);
    if (!Number.isFinite(requested) || requested <= 0 || requested > maxDaily) {
      throw new BadRequestException(`Daily budget violates policy for action ${action.actionId}.`);
    }
    if (action.actionType !== 'update_campaign_budget') return;
    const budgetId = action.typedPayload.campaignBudgetId;
    const resourceName = action.typedPayload.campaignBudgetResourceName;
    const filter: any = { customerId: action.customerId, $or: [] };
    if (budgetId) filter.$or.push({ campaignBudgetId: budgetId });
    if (resourceName) filter.$or.push({ resourceName });
    if (!filter.$or.length) throw new BadRequestException(`Campaign budget identifier is required for action ${action.actionId}.`);
    const syncedBudget: any = await this.campaignBudgetModel.findOne(filter).lean();
    if (!syncedBudget) {
      throw new BadRequestException(`Campaign budget is not present in synced ERP data for action ${action.actionId}.`);
    }
    const current = Number(syncedBudget.amountVnd);
    if (!Number.isFinite(current) || current <= 0) {
      throw new BadRequestException(`Current synced budget is required for action ${action.actionId}.`);
    }
    const maxIncreasePercent = this.positiveEnv('GOOGLE_ADS_MAX_BUDGET_INCREASE_PERCENT', 20);
    if (requested > current * (1 + maxIncreasePercent / 100)) {
      throw new BadRequestException(`Budget increase exceeds policy for action ${action.actionId}.`);
    }
  }

  private async validateDatabaseDuplicates(plan: ImportPlan) {
    const existing: any = await this.actionPlanModel.findOne({
      $or: [
        { planId: plan.planId },
        { idempotencyKeys: { $in: plan.actions.map((action) => action.idempotencyKey) } },
      ],
    }).lean();
    if (existing?.planId === plan.planId) throw new ConflictException('planId already exists.');
    if (existing) throw new ConflictException('idempotencyKey already exists.');
  }

  private loadContract(fileName: string) {
    const candidates = [
      resolve(process.cwd(), '..', 'docs', 'ai-ads-v2', 'contracts', fileName),
      resolve(process.cwd(), 'docs', 'ai-ads-v2', 'contracts', fileName),
      resolve(__dirname, '..', '..', 'docs', 'ai-ads-v2', 'contracts', fileName),
    ];
    const path = candidates.find((candidate) => existsSync(candidate));
    if (!path) throw new Error(`AI Ads V2 contract not found: ${fileName}`);
    return JSON.parse(readFileSync(path, 'utf8'));
  }

  private collectUrls(value: any, key = ''): string[] {
    if (typeof value === 'string' && /^(finalUrl|finalUrls|landingPageUrl)$/i.test(key)) return [value];
    if (Array.isArray(value)) return value.flatMap((item) => this.collectUrls(item, key));
    if (value && typeof value === 'object') {
      return Object.entries(value).flatMap(([childKey, child]) => this.collectUrls(child, childKey));
    }
    return [];
  }

  private rejectRawExecutionPayload(action: ImportAction) {
    const blockedKeys = new Set([
      'api_execution_queue',
      'rawApiRequest',
      'rawPayload',
      'mutateOperation',
      'providerRequest',
    ]);
    const walk = (value: any): boolean => {
      if (Array.isArray(value)) return value.some(walk);
      if (!value || typeof value !== 'object') return false;
      return Object.entries(value).some(([key, child]) => blockedKeys.has(key) || walk(child));
    };
    if (walk(action.typedPayload)) {
      throw new BadRequestException(`Raw provider execution payload is forbidden for action ${action.actionId}.`);
    }
  }

  private csvEnv(...names: string[]) {
    return names.flatMap((name) => String(process.env[name] || '').split(','))
      .map((value) => value.trim()).filter(Boolean);
  }

  private digits(value: any) {
    return String(value || '').replace(/\D/g, '');
  }

  private positiveEnv(name: string, fallback: number) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private assertUnique(values: string[], message: string) {
    if (new Set(values).size !== values.length) throw new BadRequestException(message);
  }

  private sha256(value: Buffer) {
    return createHash('sha256').update(value).digest('hex');
  }
}
