import { BadRequestException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { ProviderConnection, ProviderConnectionDocument } from './provider-connection.schema';
import { WindsorAdsResource, WindsorAdsResourceDocument } from './schemas/windsor-ads-resource.schema';
import { WindsorAdsSyncRun, WindsorAdsSyncRunDocument } from './schemas/windsor-ads-sync-run.schema';

export interface WindsorCatalogResult {
  status: 'success' | 'partial' | 'failed';
  accounts: number;
  groups: number;
  conflicts: Array<{ type: string; providerId: string; code: string }>;
}

/** Reads the persisted Windsor catalog only; never calls an ads provider or enables execution. */
@Injectable()
export class WindsorAdsCatalogService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WindsorAdsCatalogService.name);
  constructor(
    @InjectModel(ProviderConnection.name) private readonly connections: Model<ProviderConnectionDocument>,
    @InjectModel(WindsorAdsResource.name) private readonly resources: Model<WindsorAdsResourceDocument>,
    @InjectModel(WindsorAdsSyncRun.name) private readonly runs: Model<WindsorAdsSyncRunDocument>,
    @InjectModel(AdAccount.name) private readonly accounts: Model<AdAccountDocument>,
    @InjectModel(AdGroup.name) private readonly groups: Model<AdGroupDocument>,
  ) {}

  async onApplicationBootstrap() {
    // Backfill existing installations without another provider request. Replays preserve ERP assignments.
    const connections = await this.connections.find({ kind: 'windsor-google', state: 'configured' })
      .select('_id revision checkedRevision check').lean();
    for (const connection of connections) {
      if (connection.revision !== connection.checkedRevision || !connection.check?.readAccessConfirmed) continue;
      const result = await this.reconcileSafely(String(connection._id));
      if (result.status !== 'success') this.logger.warn(`Windsor catalog requires attention: ${connection._id}`);
    }
  }

  async reconcileSafely(id: string): Promise<WindsorCatalogResult> {
    try { return await this.reconcile(id); }
    catch { return { status: 'failed', accounts: 0, groups: 0,
      conflicts: [{ type: 'connection', providerId: id, code: 'CATALOG_SYNC_FAILED' }] }; }
  }

  async reconcile(id: string): Promise<WindsorCatalogResult> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID kết nối không hợp lệ.');
    const connection = await this.connections.findById(id).select('kind state accountIds revision checkedRevision check').lean();
    if (!connection || connection.kind !== 'windsor-google' || connection.state !== 'configured'
      || connection.revision !== connection.checkedRevision || !connection.check?.readAccessConfirmed) {
      throw new BadRequestException('Cần kiểm tra quyền đọc của kết nối Windsor Google trước khi đồng bộ danh mục.');
    }
    const result: WindsorCatalogResult = { status: 'success', accounts: 0, groups: 0, conflicts: [] };
    const conflict = (type: string, providerId: string, code: string) => {
      result.status = 'partial'; result.conflicts.push({ type, providerId, code });
    };
    const rows = await this.resources.find({ connectionId: connection._id, provider: 'google', connector: 'google_ads',
      accountId: { $in: connection.accountIds } }).sort({ lastSeenAt: 1 }).lean();
    const runs = await this.runs.find({ connectionId: connection._id,
      runId: { $in: [...new Set(rows.map(row => row.lastSyncRunId))] }, status: { $in: ['success', 'partial'] } })
      .select('runId status syncErrors').lean();
    const runMap = new Map(runs.map(run => [run.runId, run]));
    // Partial writes may have reached the resource store before a slice failed.
    // Exclude that account for the run until a later successful read repairs it.
    const usable = rows.filter(row => {
      const run = runMap.get(row.lastSyncRunId);
      return run && !(run.syncErrors || []).some(error => !error.accountId || error.accountId === row.accountId);
    });
    const usableSet = new Set(usable);
    const excludedAccounts = new Set(rows.filter(row => !usableSet.has(row)).map(row => row.accountId));
    for (const accountId of excludedAccounts) conflict('account', accountId, 'RESOURCE_READ_NOT_COMPLETE');
    const resourceMap = new Map(usable.map(row => [`${row.resourceType}:${row.accountId}:${row.providerId}`, row]));
    const accountRefs = new Map<string, any>();
    const checkedAccounts = (connection.check?.accounts || []) as Array<{ id: string; name: string }>;
    const discovered = new Map(checkedAccounts.map(account => [account.id, account.name]));
    for (const accountId of connection.accountIds || []) {
      const resource = resourceMap.get(`account:${accountId}:${accountId}`);
      // A checked account with zero spend still belongs in the ERP catalog.
      if (!resource && !discovered.has(accountId)) continue;
      try {
        const variants = [accountId];
        if (/^\d{10}$/.test(accountId)) variants.push(`${accountId.slice(0, 3)}-${accountId.slice(3, 6)}-${accountId.slice(6)}`);
        const existing = await this.accounts.find({ accountId: { $in: variants } }).lean();
        if (existing.length > 1 || existing.some(row => row.accountType !== 'google'
          || (row.sourceConnectionId && String(row.sourceConnectionId) !== id))) {
          conflict('account', accountId, 'ACCOUNT_ID_CONFLICT'); continue;
        }
        const current = existing[0];
        if (resource && current?.sourceLastSeenAt && +new Date(current.sourceLastSeenAt) > +new Date(resource.lastSeenAt)) {
          accountRefs.set(accountId, current._id); result.accounts++; continue;
        }
        const metadata: any = { sourceSystem: 'windsor', sourceConnectionId: connection._id };
        const name = resource?.name || (!current?.sourceLastSeenAt ? discovered.get(accountId) : undefined);
        if (name) metadata.name = name;
        if (resource) {
          metadata.sourceLastSeenAt = resource.lastSeenAt;
          if (resource.currency) metadata.currency = resource.currency;
          if (resource.timezone) metadata.timezoneId = resource.timezone;
        }
        const account = current
          ? await this.accounts.findOneAndUpdate({ _id: current._id, accountId: current.accountId,
            accountType: 'google', sourceConnectionId: current.sourceConnectionId ?? null,
            sourceLastSeenAt: current.sourceLastSeenAt ?? null }, { $set: metadata }, { new: true })
          : await this.accounts.findOneAndUpdate({ accountId, accountType: 'google', sourceConnectionId: connection._id },
            { $set: metadata, $setOnInsert: { ...(name ? {} : { name: `Google Ads ${accountId}` }),
              managementMode: 'direct', isActive: true } }, { new: true, upsert: true, runValidators: true });
        if (!account) { conflict('account', accountId, 'ACCOUNT_CHANGED_DURING_SYNC'); continue; }
        accountRefs.set(accountId, account._id); result.accounts++;
      } catch { conflict('account', accountId, 'ACCOUNT_WRITE_FAILED'); }
    }
    for (const row of usable.filter(row => row.resourceType === 'ad_group')) {
      const accountRef = accountRefs.get(row.accountId);
      if (!accountRef) { conflict('ad_group', row.providerId, 'ACCOUNT_NOT_LINKED'); continue; }
      try {
        const current = await this.groups.findOne({ adGroupId: row.providerId }).lean();
        if (current && (current.platform !== 'google' || String(current.adAccountId) !== String(accountRef)
          || (current.campaignId && current.campaignId !== row.campaignId)
          || (current.sourceConnectionId && String(current.sourceConnectionId) !== id))) {
          conflict('ad_group', row.providerId, 'AD_GROUP_ID_CONFLICT'); continue;
        }
        if (current?.sourceLastSeenAt && +new Date(current.sourceLastSeenAt) > +new Date(row.lastSeenAt)) continue;
        const campaign = resourceMap.get(`campaign:${row.accountId}:${row.campaignId}`);
        const metadata: any = { sourceSystem: 'windsor', sourceConnectionId: connection._id,
          sourceLastSeenAt: row.lastSeenAt, campaignId: row.campaignId };
        if (row.name) metadata.name = row.name;
        if (row.status) metadata.remoteStatus = row.status;
        if (campaign?.campaignBudgetId) metadata.campaignBudgetId = campaign.campaignBudgetId;
        const filter: any = { adGroupId: row.providerId, platform: 'google', adAccountId: accountRef,
          sourceConnectionId: current ? current.sourceConnectionId ?? null : connection._id };
        if (current) { filter._id = current._id; filter.sourceLastSeenAt = current.sourceLastSeenAt ?? null; }
        const updated = await this.groups.findOneAndUpdate(filter, { $set: metadata, ...(current ? {} : {
          $setOnInsert: { ...(row.name ? {} : { name: `Google Ads ${row.providerId}` }),
            isActive: row.status === 'ENABLED', selectedProducts: [], autoControlEnabled: false, enableWebhook: false },
        }) }, { new: true, upsert: !current, runValidators: true });
        if (updated) result.groups++;
        else conflict('ad_group', row.providerId, 'GROUP_CHANGED_DURING_SYNC');
      } catch { conflict('ad_group', row.providerId, 'GROUP_WRITE_FAILED'); }
    }
    return result;
  }
}
