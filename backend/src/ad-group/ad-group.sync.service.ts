import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { Model, Types } from 'mongoose';
import { ApiTokenService } from '../api-token/api-token.service';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import { AdGroup, AdGroupDocument } from './schemas/ad-group.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { getMetaGraphApiVersion } from '../common/ads-api-version';

const FB_GRAPH_API_VERSION = getMetaGraphApiVersion();

interface FbAdAccountResponse {
  name?: string;
  account_status?: number;
  currency?: string;
  timezone_id?: string;
  business?: { name?: string };
  spend_cap?: number;
  amount_spent?: number;
}

interface FbAdset {
  id: string;
  name?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  bid_amount?: string | number;
  campaign_id?: string;
}

interface DiscoveredAdGroup {
  adGroupId: string;
  name: string;
  status: string;
  effectiveStatus: string;
  dailyBudget: number;
  campaignId?: string;
  existsInDb: boolean;
  adAccountId?: string;
  adAccountName?: string;
  linkedFanpageId?: string;
  linkedProductId?: string;
  linkedAgentId?: string;
  linkedIsActive?: boolean;
}

@Injectable()
export class AdGroupSyncService {
  private readonly logger = new Logger(AdGroupSyncService.name);

  constructor(
    @InjectModel(AdAccount.name) private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly apiTokenService: ApiTokenService,
  ) {}

  private normalizeFacebookAccountId(value: string): string {
    return String(value || '').trim().replace(/^act_/i, '');
  }

  private isRemoteAdsetActive(adset?: FbAdset): boolean {
    const status = String(adset?.status || '').toUpperCase();
    const effective = String(adset?.effective_status || '').toUpperCase();
    return status === 'ACTIVE' || effective === 'ACTIVE';
  }

  /** Cron má»—i giá» Ä‘á»ƒ Ä‘á»“ng bá»™ metadata ad account + ad group tá»« Facebook */
  @Cron('0 * * * *')
  async cronSyncFacebook() {
    const accounts = await this.adAccountModel.find({ accountType: 'facebook', isActive: true }).lean();
    if (!accounts.length) return;

    for (const acc of accounts) {
      await this.syncAdAccount(acc);
      await this.syncAdsetsForAccount(acc);
    }
  }

  private async syncAdAccount(acc: any) {
    const started = Date.now();
    const cleanAccountId = this.normalizeFacebookAccountId(acc.accountId);
    const token = await this.apiTokenService.getRawAccessTokenForAdsManagement(cleanAccountId);
    if (!token) {
      await this.adAccountModel.updateOne(
        { _id: acc._id },
        {
          $set: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'error',
            lastSyncError: 'KhÃ´ng tÃ¬m tháº¥y token ads_management cho tÃ i khoáº£n',
            lastSyncDurationMs: Date.now() - started,
          },
        },
      );
      return;
    }

    const url = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/act_${encodeURIComponent(cleanAccountId)}`;
    try {
      const { data } = await axios.get<FbAdAccountResponse>(url, {
        params: {
          fields: 'name,account_status,currency,timezone_id,business{name},spend_cap,amount_spent',
          access_token: token,
        },
      });

      await this.adAccountModel.updateOne(
        { _id: acc._id },
        {
          $set: {
            name: data?.name || acc.name,
            accountStatus: data?.account_status,
            currency: data?.currency,
            timezoneId: data?.timezone_id?.toString(),
            businessName: data?.business?.name,
            spendCap: this.toNumber(data?.spend_cap),
            amountSpent: this.toNumber(data?.amount_spent),
            lastSyncAt: new Date(),
            lastSyncStatus: 'ok',
            lastSyncDurationMs: Date.now() - started,
          },
          $unset: { lastSyncError: '' },
        },
      );
    } catch (error: any) {
      const message = error?.response?.data?.error?.message || error?.message || 'UNKNOWN_ERROR';
      this.logger.warn(`Sync ad account ${acc.accountId} failed: ${message}`);
      await this.adAccountModel.updateOne(
        { _id: acc._id },
        {
          $set: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'error',
            lastSyncError: message,
            lastSyncDurationMs: Date.now() - started,
          },
        },
      );
    }
  }

  private async syncAdsetsForAccount(acc: any) {
    const cleanAccountId = this.normalizeFacebookAccountId(acc.accountId);
    const token = await this.apiTokenService.getRawAccessTokenForAdsManagement(cleanAccountId);
    if (!token) return;

    let next: string | null = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/act_${encodeURIComponent(cleanAccountId)}/adsets?fields=id,name,status,effective_status,daily_budget,bid_amount,campaign_id&limit=50&access_token=${encodeURIComponent(token)}`;
    while (next) {
      try {
        const { data } = await axios.get<{ data: FbAdset[]; paging?: { next?: string } }>(next);
        const adsets = data?.data || [];
        for (const adset of adsets) {
          await this.upsertAdsetMetadata(adset);
        }
        next = data?.paging?.next || null;
      } catch (error: any) {
        const message = error?.response?.data?.error?.message || error?.message || 'UNKNOWN_ERROR';
        this.logger.warn(`Sync adsets for account ${acc.accountId} failed: ${message}`);
        break; // trÃ¡nh loop vÃ´ háº¡n khi lá»—i
      }
    }
  }

  private async upsertAdsetMetadata(adset: FbAdset) {
    const started = Date.now();
    const updateSet: any = {
      name: adset.name,
      remoteStatus: adset.status,
      effectiveStatus: adset.effective_status,
      isActive: this.isRemoteAdsetActive(adset),
      dailyBudget: this.toNumber(adset.daily_budget),
      bidAmount: this.toNumber(adset.bid_amount),
      campaignId: adset.campaign_id,
      lastSyncAt: new Date(),
      lastSyncStatus: 'ok',
      lastSyncDurationMs: Date.now() - started,
    };

    const res = await this.adGroupModel.updateMany(
      { adGroupId: adset.id },
      { $set: updateSet, $unset: { lastSyncError: '' } },
    );

    if (!res.matchedCount) {
      this.logger.debug(`Adset ${adset.id} khÃ´ng khá»›p adGroup nÃ o trong DB`);
    }
  }

  private toNumber(v: unknown): number | undefined {
    if (v === null || v === undefined) return undefined;
    const num = Number(v);
    return Number.isFinite(num) ? num : undefined;
  }

  private async resolveSingleProductForImport(
    selectedProductId?: string,
    productCategoryId?: string,
  ): Promise<{ productId?: string; categoryId?: string }> {
    if (!selectedProductId && !productCategoryId) {
      return {};
    }

    if (selectedProductId) {
      if (!Types.ObjectId.isValid(selectedProductId)) {
        throw new Error('selectedProductId is invalid');
      }

      const selectedProduct = await this.productModel
        .findById(selectedProductId)
        .select('_id categoryId')
        .lean();
      if (!selectedProduct?._id || !selectedProduct?.categoryId) {
        throw new Error('selectedProductId does not exist or has no categoryId');
      }

      const selectedCategoryId = String(selectedProduct.categoryId);
      if (productCategoryId && selectedCategoryId !== String(productCategoryId)) {
        throw new Error('selectedProductId does not belong to productCategoryId');
      }

      return {
        productId: String(selectedProduct._id),
        categoryId: selectedCategoryId,
      };
    }

    if (!productCategoryId) {
      return {};
    }

    const categoryObjectId = new Types.ObjectId(productCategoryId);

    // Prefer active product first, then fallback to any product in category
    const activeProduct = await this.productModel.findOne({
      categoryId: categoryObjectId,
      status: 'Hoạt động',
    }).select('_id categoryId').lean();
    if (activeProduct?._id && activeProduct?.categoryId) {
      return {
        productId: String(activeProduct._id),
        categoryId: String(activeProduct.categoryId),
      };
    }

    const anyProduct = await this.productModel.findOne({
      categoryId: categoryObjectId,
    }).select('_id categoryId').lean();
    if (anyProduct?._id && anyProduct?.categoryId) {
      return {
        productId: String(anyProduct._id),
        categoryId: String(anyProduct.categoryId),
      };
    }

    throw new Error('Category has no product to assign for ad group import');
  }

  /**
   * Auto-discover: Láº¥y danh sÃ¡ch ad groups tá»« Facebook cho 1 ad account
   * Tráº£ vá» danh sÃ¡ch Ä‘á»ƒ hiá»ƒn thá»‹, nhÃ¢n viÃªn chá»n import
   */
  async discoverAdGroupsFromFacebook(adAccountId: string): Promise<{
    success: boolean;
    adAccountId: string;
    discovered: DiscoveredAdGroup[];
    error?: string;
  }> {
    const acc = await this.adAccountModel.findOne({ 
      $or: [
        { accountId: adAccountId },
        { accountId: `act_${adAccountId}` },
        { accountId: adAccountId.replace('act_', '') }
      ],
      accountType: 'facebook',
      isActive: true 
    }).lean();

    if (!acc) {
      return { success: false, adAccountId, discovered: [], error: 'KhÃ´ng tÃ¬m tháº¥y Ad Account' };
    }

    const token = await this.apiTokenService.getRawAccessTokenForAdsManagement(acc.accountId);
    if (!token) {
      return { success: false, adAccountId, discovered: [], error: 'KhÃ´ng cÃ³ token API. Vui lÃ²ng cáº¥u hÃ¬nh token trong CÃ i Äáº·t API.' };
    }

    const cleanId = this.normalizeFacebookAccountId(acc.accountId);
    const discovered: DiscoveredAdGroup[] = [];
    
    // Láº¥y danh sÃ¡ch adGroupId hiá»‡n cÃ³ trong DB
    const existingGroups = await this.adGroupModel
      .find({ platform: 'facebook' })
      .select('adGroupId fanpageId selectedProducts agentId isActive')
      .lean();
    const existingById = new Map(existingGroups.map((g: any) => [String(g.adGroupId), g]));

    let next: string | null = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/act_${encodeURIComponent(cleanId)}/adsets?fields=id,name,status,effective_status,daily_budget,campaign_id&limit=100&access_token=${encodeURIComponent(token)}`;
    
    while (next) {
      try {
        const { data } = await axios.get<{ data: FbAdset[]; paging?: { next?: string } }>(next);
        const adsets = data?.data || [];
        
        for (const adset of adsets) {
          const existing = existingById.get(String(adset.id));
          discovered.push({
            adGroupId: adset.id,
            name: adset.name || `Adset ${adset.id}`,
            status: adset.status || 'UNKNOWN',
            effectiveStatus: adset.effective_status || 'UNKNOWN',
            dailyBudget: this.toNumber(adset.daily_budget) || 0,
            campaignId: adset.campaign_id,
            existsInDb: Boolean(existing),
            adAccountId: String(acc.accountId),
            adAccountName: String(acc.name || ''),
            linkedFanpageId: existing?.fanpageId ? String(existing.fanpageId) : undefined,
            linkedProductId: Array.isArray(existing?.selectedProducts) && existing.selectedProducts.length
              ? String(existing.selectedProducts[0])
              : undefined,
            linkedAgentId: existing?.agentId ? String(existing.agentId) : undefined,
            linkedIsActive: typeof existing?.isActive === 'boolean' ? Boolean(existing.isActive) : undefined,
          });
        }
        
        next = data?.paging?.next || null;
      } catch (error: any) {
        const message = error?.response?.data?.error?.message || error?.message || 'UNKNOWN_ERROR';
        this.logger.warn(`Discover adsets for account ${acc.accountId} failed: ${message}`);
        return { success: false, adAccountId, discovered, error: message };
      }
    }

    return { success: true, adAccountId, discovered };
  }

  /**
   * Discover ACTIVE ad groups cho tat ca ad account Facebook dang hoat dong.
   * Chi tra danh sach de nhan vien import/chon san pham, khong xoa du lieu da lien ket.
   */
  async discoverActiveAdGroupsFromAllAccounts(): Promise<{
    success: boolean;
    accounts: number;
    discovered: DiscoveredAdGroup[];
    errors: string[];
  }> {
    const accounts = await this.adAccountModel
      .find({ accountType: 'facebook', isActive: true })
      .select('_id accountId name')
      .lean();

    if (!accounts.length) {
      return { success: true, accounts: 0, discovered: [], errors: [] };
    }

    const existingGroups = await this.adGroupModel
      .find({ platform: 'facebook' })
      .select('adGroupId fanpageId selectedProducts agentId isActive')
      .lean();
    const existingById = new Map(existingGroups.map((g: any) => [String(g.adGroupId), g]));
    const discovered: DiscoveredAdGroup[] = [];
    const seen = new Set<string>();
    const errors: string[] = [];

    for (const acc of accounts) {
      const token = await this.apiTokenService.getRawAccessTokenForAdsManagement(String(acc.accountId));
      if (!token) {
        errors.push(`${acc.accountId}: missing ads token`);
        continue;
      }

      const cleanId = this.normalizeFacebookAccountId(String(acc.accountId));
      let next: string | null = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/act_${encodeURIComponent(cleanId)}/adsets?fields=id,name,status,effective_status,daily_budget,campaign_id&limit=100&access_token=${encodeURIComponent(token)}`;

      while (next) {
        try {
          const { data } = await axios.get<{ data: FbAdset[]; paging?: { next?: string } }>(next);
          const adsets = data?.data || [];
          for (const adset of adsets) {
            const adsetId = String(adset?.id || '');
            if (!adsetId || seen.has(adsetId)) continue;
            if (!this.isRemoteAdsetActive(adset)) continue;
            seen.add(adsetId);

            const existing = existingById.get(adsetId);
            discovered.push({
              adGroupId: adsetId,
              name: adset.name || `Adset ${adsetId}`,
              status: adset.status || 'UNKNOWN',
              effectiveStatus: adset.effective_status || 'UNKNOWN',
              dailyBudget: this.toNumber(adset.daily_budget) || 0,
              campaignId: adset.campaign_id,
              existsInDb: Boolean(existing),
              adAccountId: String(acc.accountId),
              adAccountName: String(acc.name || ''),
              linkedFanpageId: existing?.fanpageId ? String(existing.fanpageId) : undefined,
              linkedProductId: Array.isArray(existing?.selectedProducts) && existing.selectedProducts.length
                ? String(existing.selectedProducts[0])
                : undefined,
              linkedAgentId: existing?.agentId ? String(existing.agentId) : undefined,
              linkedIsActive: typeof existing?.isActive === 'boolean' ? Boolean(existing.isActive) : undefined,
            });
          }
          next = data?.paging?.next || null;
        } catch (error: any) {
          const message = error?.response?.data?.error?.message || error?.message || 'UNKNOWN_ERROR';
          errors.push(`${acc.accountId}: ${message}`);
          break;
        }
      }
    }

    return { success: true, accounts: accounts.length, discovered, errors };
  }

  /**
   * Auto-import: Tá»± Ä‘á»™ng táº¡o ad groups tá»« danh sÃ¡ch discovered
   * YÃªu cáº§u: fanpageId, agentId + selectedProductId (khuyáº¿n nghá»‹) hoáº·c productCategoryId (legacy)
   */
  async autoImportAdGroups(params: {
    adAccountId: string;
    adGroupIds: string[];
    fanpageId: string;
    productCategoryId?: string;
    selectedProductId?: string;
    agentId: string;
  }): Promise<{ success: boolean; imported: number; skipped: number; errors: string[] }> {
    const acc = await this.adAccountModel.findOne({ 
      $or: [
        { accountId: params.adAccountId },
        { accountId: `act_${params.adAccountId}` },
        { accountId: params.adAccountId.replace('act_', '') }
      ],
      accountType: 'facebook',
      isActive: true 
    }).lean();

    if (!acc) {
      return { success: false, imported: 0, skipped: 0, errors: ['KhÃ´ng tÃ¬m tháº¥y Ad Account'] };
    }

    const token = await this.apiTokenService.getRawAccessTokenForAdsManagement(acc.accountId);
    if (!token) {
      return { success: false, imported: 0, skipped: 0, errors: ['KhÃ´ng cÃ³ token API'] };
    }

    const existingGroups = await this.adGroupModel.find({ adGroupId: { $in: params.adGroupIds } }).select('adGroupId').lean();
    const existingIds = new Set(existingGroups.map(g => g.adGroupId));
    let selectedProductIdForImport: string | undefined;
    let productCategoryIdForImport: string | undefined;
    try {
      const resolvedProduct = await this.resolveSingleProductForImport(
        params.selectedProductId,
        params.productCategoryId,
      );
      selectedProductIdForImport = resolvedProduct.productId;
      productCategoryIdForImport = resolvedProduct.categoryId;
    } catch (error: any) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        errors: [error?.message || 'KhÃ´ng xÃ¡c Ä‘á»‹nh Ä‘Æ°á»£c sáº£n pháº©m Ä‘á»ƒ gÃ¡n cho ad group'],
      };
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const adGroupId of params.adGroupIds) {
      if (existingIds.has(adGroupId)) {
        skipped++;
        continue;
      }

      try {
        // Láº¥y thÃ´ng tin tá»« Facebook
        const url = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/${encodeURIComponent(adGroupId)}?fields=id,name,status,effective_status,daily_budget,campaign_id&access_token=${encodeURIComponent(token)}`;
        const { data } = await axios.get<FbAdset>(url);

        // Táº¡o ad group má»›i
        await this.adGroupModel.create({
          name: data.name || `Adset ${adGroupId}`,
          adGroupId: adGroupId,
          fanpageId: new Types.ObjectId(params.fanpageId),
          productCategoryId: productCategoryIdForImport ? new Types.ObjectId(productCategoryIdForImport) : undefined,
          selectedProducts: selectedProductIdForImport ? [new Types.ObjectId(selectedProductIdForImport)] : [],
          agentId: new Types.ObjectId(params.agentId),
          adAccountId: acc._id,
          platform: 'facebook',
          isActive: true,
          remoteStatus: data.status,
          effectiveStatus: data.effective_status,
          dailyBudget: this.toNumber(data.daily_budget),
          campaignId: data.campaign_id,
          lastSyncAt: new Date(),
          lastSyncStatus: 'ok',
        });
        imported++;
      } catch (error: any) {
        const msg = error?.message || 'Lá»—i khÃ´ng xÃ¡c Ä‘á»‹nh';
        errors.push(`${adGroupId}: ${msg}`);
      }
    }

    return { success: true, imported, skipped, errors };
  }

  /**
   * Láº¥y tráº¡ng thÃ¡i sync gáº§n nháº¥t cá»§a táº¥t cáº£ ad accounts
   */
  async getSyncStatus(): Promise<{
    accounts: Array<{
      accountId: string;
      name: string;
      accountType: string;
      lastSyncAt?: Date;
      lastSyncStatus?: string;
      lastSyncError?: string;
      adGroupCount: number;
    }>;
    lastCostSyncAt?: Date;
  }> {
    const accounts = await this.adAccountModel.find({ isActive: true }).lean();
    const result: any[] = [];

    for (const acc of accounts) {
      const adGroupCount = await this.adGroupModel.countDocuments({ adAccountId: acc._id });
      result.push({
        accountId: acc.accountId,
        name: acc.name,
        accountType: acc.accountType,
        lastSyncAt: acc.lastSyncAt,
        lastSyncStatus: acc.lastSyncStatus,
        lastSyncError: acc.lastSyncError,
        adGroupCount,
      });
    }

    return { accounts: result };
  }
}
