/**
 * Service: ApiTokenService
 * Ch?c nang: Qu?n lý vòng d?i ApiToken (CRUD + validate + setPrimary + rotate).
 * Refactor: Thêm strategy validate d? d? m? r?ng provider (facebook, zalo,...).
 */
import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ApiToken, ApiTokenDocument } from './schemas/api-token.schema';
import { ApiTokenAudit, ApiTokenAuditDocument } from './schemas/api-token-audit.schema';
import { Fanpage, FanpageDocument } from '../fanpage/schemas/fanpage.schema';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { UpdateApiTokenDto } from './dto/update-api-token.dto';
import { RotateTokenDto, SetPrimaryTokenDto, ValidateTokenDto } from './dto/token-actions.dto';
import { encryptToken, hashToken, decryptToken } from './crypto.util';
import { getGoogleAdsApiVersion, getMetaGraphApiVersion } from '../common/ads-api-version';
import { maskSecret, redactSecretString, redactSecrets } from '../common/utils/secret-redaction.util';

// ---------------- Provider Validation Strategies ----------------
// Interface don gi?n cho các strategy
interface TokenValidationResult { status: 'valid'|'invalid'|'expired'; message: string; scopes?: string[]; expireAt?: Date; }
interface ProviderValidator { validate(rawToken: string): Promise<TokenValidationResult>; }

type ConfigSource = 'env' | 'database' | 'none';

interface GoogleStoredSettings {
  clientId?: string;
  clientSecret?: string;
  developerToken?: string;
  loginCustomerId?: string;
  apiVersion?: string;
}

interface TikTokStoredSettings {
  appId?: string;
  appSecret?: string;
  authCode?: string;
  refreshToken?: string;
  redirectUri?: string;
  scopes?: string[];
  grantedAdvertiserIds?: string[];
  businessCenterId?: string;
  businessCenterName?: string;
  testAdvertiserId?: string;
  advertiserIds?: string[];
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  lastAuthAt?: string;
}

export interface GoogleAdsRuntimeConfig {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  developerToken?: string;
  customerId?: string;
  loginCustomerId?: string;
  apiVersion: string;
  configSource: ConfigSource;
  refreshTokenSource: ConfigSource;
}

export interface TikTokRuntimeConfig {
  accessToken?: string;
  refreshToken?: string;
  appId?: string;
  appSecret?: string;
  authCode?: string;
  redirectUri?: string;
  businessCenterId?: string;
  businessCenterName?: string;
  testAdvertiserId?: string;
  advertiserIds: string[];
  grantedAdvertiserIds: string[];
  scopes: string[];
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  lastAuthAt?: string;
  configured: boolean;
  configSource: ConfigSource;
}

class FacebookValidator implements ProviderValidator {
  async validate(rawToken: string): Promise<TokenValidationResult> {
    try {
      // Validate token by calling Facebook Graph API
      const response = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${encodeURIComponent(rawToken)}`);
      const data = await response.json();
      
      if (response.ok && data.id) {
        // Token is valid, get permissions
        let scopes: string[] = [];
        try {
          const permResponse = await fetch(`https://graph.facebook.com/me/permissions?access_token=${encodeURIComponent(rawToken)}`);
          const permData = await permResponse.json();
          scopes = permResponse.ok && permData.data ? 
            permData.data.filter((p: any) => p.status === 'granted').map((p: any) => p.permission) : [];
        } catch {}

        // Th? l?y expireAt qua debug_token n?u có app token
        let expireAt: Date | undefined;
        const appToken = process.env.FB_APP_ACCESS_TOKEN || process.env.FACEBOOK_APP_TOKEN;
        if (appToken) {
          try {
            const dbg = await fetch(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(rawToken)}&access_token=${encodeURIComponent(appToken)}`)
              .then(r => r.json());
            const ts = dbg?.data?.expires_at;
            if (ts && Number.isFinite(ts)) {
              expireAt = new Date(ts * 1000);
            }
          } catch {}
        }

        return { 
          status: 'valid', 
          message: `Token h?p l? cho ${data.name || data.id}`,
          scopes,
          expireAt
        };
      } else if (data.error) {
        const errorCode = data.error.code;
        const errorMessage = redactSecretString(String(data.error.message || 'Unknown provider error'));
        
        if (errorCode === 190) {
          return { status: 'expired', message: `Token h?t h?n: ${errorMessage}` };
        } else if (errorCode === 102 || errorCode === 2500) {
          return { status: 'invalid', message: `Token không h?p l?: ${errorMessage}` };
        } else {
          return { status: 'invalid', message: `L?i Facebook API: ${errorMessage}` };
        }
      } else {
        return { status: 'invalid', message: 'Token không h?p l? - không nh?n du?c ph?n h?i t? Facebook' };
      }
    } catch (error) {
      return { 
        status: 'invalid', 
        message: `L?i k?t n?i Facebook API: ${redactSecretString(error instanceof Error ? error.message : 'Unknown error')}`
      };
    }
  }
}
class ZaloValidator implements ProviderValidator {
  async validate(rawToken: string): Promise<TokenValidationResult> {
    try {
      // Validate Zalo token by calling Zalo API
      const response = await fetch(`https://openapi.zalo.me/v2.0/me?access_token=${encodeURIComponent(rawToken)}`);
      const data = await response.json();
      
      if (response.ok && data.id) {
        return { 
          status: 'valid', 
          message: `Zalo token h?p l? cho ${data.name || data.id}`,
          scopes: [] 
        };
      } else if (data.error) {
        return { status: 'invalid', message: `Zalo API error: ${redactSecretString(String(data.error.message || data.error))}` };
      } else {
        return { status: 'invalid', message: 'Zalo token không h?p l?' };
      }
    } catch (error) {
      return { 
        status: 'invalid', 
        message: `L?i k?t n?i Zalo API: ${redactSecretString(error instanceof Error ? error.message : 'Unknown error')}`
      };
    }
  }
}

class GoogleValidator implements ProviderValidator {
  async validate(rawToken: string): Promise<TokenValidationResult> {
    // Google Ads s? d?ng refresh token, không th? validate tr?c ti?p nhu access token
    // Ch? ki?m tra format co b?n
    if (!rawToken || rawToken.length < 20) {
      return { status: 'invalid', message: 'Token quá ng?n ho?c không h?p l?' };
    }
    
    // Google refresh token thu?ng b?t d?u v?i "1//"
    if (rawToken.startsWith('1//')) {
      return { 
        status: 'valid', 
        message: 'Google refresh token có format h?p l? (c?n test v?i API d? xác nh?n d?y d?)',
        scopes: ['https://www.googleapis.com/auth/adwords'] 
      };
    }
    
    return { 
      status: 'valid', 
      message: 'Token du?c ch?p nh?n (chua xác th?c v?i Google API)',
      scopes: [] 
    };
  }
}

class TiktokValidator implements ProviderValidator {
  async validate(rawToken: string): Promise<TokenValidationResult> {
    try {
      // Validate TikTok token by calling TikTok API
      const url = 'https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/';
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Access-Token': rawToken,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.code === 0) {
        const advertisers = data.data?.list || [];
        return { 
          status: 'valid', 
          message: `TikTok token h?p l? (${advertisers.length} advertiser(s))`,
          scopes: ['ad_data_read'] 
        };
      } else if (data.message) {
        return { status: 'invalid', message: `TikTok API error: ${redactSecretString(String(data.message))}` };
      } else {
        return { status: 'invalid', message: 'TikTok token không h?p l?' };
      }
    } catch (error) {
      return { 
        status: 'invalid', 
        message: `L?i k?t n?i TikTok API: ${redactSecretString(error instanceof Error ? error.message : 'Unknown error')}`
      };
    }
  }
}

class OtherValidator implements ProviderValidator {
  async validate(rawToken: string): Promise<TokenValidationResult> {
    // For 'other' provider, do basic format check only
    if (!rawToken || rawToken.length < 10) {
      return { status: 'invalid', message: 'Token quá ng?n ho?c không h?p l?' };
    }
    
    // Could implement specific validation logic for other providers here
    return { 
      status: 'valid', 
      message: 'Token du?c ch?p nh?n (chua xác th?c v?i provider)',
      scopes: [] 
    };
  }
}

function buildValidator(provider: string): ProviderValidator {
  switch(provider){
    case 'facebook': return new FacebookValidator();
    case 'zalo': return new ZaloValidator();
    case 'google': return new GoogleValidator();
    case 'tiktok': return new TiktokValidator();
    default: return new OtherValidator();
  }
}

@Injectable()
export class ApiTokenService implements OnModuleInit {
  private readonly logger = new Logger(ApiTokenService.name);
  private readonly facebookGraphApiVersion = getMetaGraphApiVersion();

  constructor(
  @InjectModel(ApiToken.name) private model: Model<ApiTokenDocument>,
  @InjectModel(ApiTokenAudit.name) private auditModel: Model<ApiTokenAuditDocument>,
    @InjectModel(Fanpage.name) private fanpageModel: Model<FanpageDocument>,
    @InjectModel(AdAccount.name) private adAccountModel: Model<AdAccountDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const result = await this.migrateLegacyPlaintextSecrets();
    const fanpageTokensMigrated = await this.migrateLegacyFanpagePlaintextSecrets();
    if (result.tokensMigrated || result.providerConfigsMigrated || fanpageTokensMigrated) {
      this.logger.log(
        `Migrated legacy API token storage: tokens=${result.tokensMigrated}, providerConfigs=${result.providerConfigsMigrated}, fanpages=${fanpageTokensMigrated}`,
      );
    }
  }

  async upsertFanpageAccessToken(params: {
    fanpageId: string;
    name?: string;
    status?: 'active' | 'inactive';
    accessToken: string;
    validated?: boolean;
    notes?: string;
  }): Promise<void> {
    const accessToken = String(params.accessToken || '').trim();
    if (!accessToken) throw new BadRequestException('Fanpage access token is empty');

    const existing = await this.model.findOne({
      fanpageId: params.fanpageId,
      provider: 'facebook',
      rotatedFrom: { $exists: false },
    });
    const tokenData: Record<string, any> = {
      name: String(params.name || existing?.name || 'Facebook Page Token').trim(),
      tokenEnc: encryptToken(accessToken),
      tokenHash: hashToken(accessToken),
      provider: 'facebook',
      status: params.status || existing?.status || 'active',
      tokenType: 'access_token',
      fanpageId: params.fanpageId,
      isPrimary: true,
      notes: params.notes || existing?.notes || 'Encrypted Facebook Page access token',
      degraded: false,
    };
    if (params.validated) {
      tokenData.lastCheckStatus = 'valid';
      tokenData.lastCheckedAt = new Date();
      tokenData.consecutiveFail = 0;
    }

    if (existing) {
      const unset: Record<string, 1> = { token: 1 };
      if (!params.validated) {
        unset.lastCheckStatus = 1;
        unset.lastCheckMessage = 1;
        unset.lastCheckedAt = 1;
      }
      await this.model.updateOne(
        { _id: existing._id },
        { $set: tokenData, $unset: unset },
      );
    } else {
      await this.model.create(tokenData);
    }

    await this.fanpageModel.updateOne(
      { _id: params.fanpageId },
      { $set: { hasAccessToken: true }, $unset: { accessToken: 1 } },
    );
  }

  async migrateLegacyFanpagePlaintextSecrets(batchSize = 100): Promise<number> {
    const safeBatchSize = Math.max(1, Math.min(1000, Math.trunc(batchSize) || 100));
    let migrated = 0;

    while (true) {
      const fanpages = await this.fanpageModel
        .find({ accessToken: { $exists: true, $ne: '' } })
        .select('+accessToken _id name status')
        .limit(safeBatchSize)
        .lean();
      if (!fanpages.length) break;

      let migratedThisBatch = 0;
      for (const fanpage of fanpages) {
        const accessToken = String(fanpage.accessToken || '').trim();
        if (!accessToken) {
          await this.fanpageModel.updateOne(
            { _id: fanpage._id },
            { $unset: { accessToken: 1 } },
          );
          continue;
        }
        await this.upsertFanpageAccessToken({
          fanpageId: String(fanpage._id),
          name: fanpage.name,
          status: fanpage.status,
          accessToken,
          notes: 'Migrated from legacy Fanpage.accessToken',
        });
        migrated += 1;
        migratedThisBatch += 1;
      }
      if (!migratedThisBatch) break;
    }

    return migrated;
  }

  /**
   * One-way compatibility migration for records created before encrypted storage.
   * Runtime reads may still fall back to legacy fields until this migration runs,
   * but every migrated record is atomically rewritten without plaintext secrets.
   */
  async migrateLegacyPlaintextSecrets(batchSize = 100): Promise<{
    tokensMigrated: number;
    providerConfigsMigrated: number;
  }> {
    const safeBatchSize = Math.max(1, Math.min(1000, Math.trunc(batchSize) || 100));
    let tokensMigrated = 0;
    let providerConfigsMigrated = 0;

    while (true) {
      const candidates = await this.model
        .find({ token: { $exists: true } })
        .select('+token _id tokenEnc tokenHash')
        .limit(safeBatchSize)
        .lean();
      if (!candidates.length) break;

      let migratedThisBatch = 0;
      for (const candidate of candidates) {
        const plaintext = String(candidate.token || '').trim();
        const update: Record<string, any> = { $unset: { token: 1 } };
        if (plaintext) {
          const existingEncryptedValue = candidate.tokenEnc
            ? decryptToken(candidate.tokenEnc)
            : undefined;
          update.$set = {
            tokenEnc: existingEncryptedValue === plaintext
              ? candidate.tokenEnc
              : encryptToken(plaintext),
            tokenHash: hashToken(plaintext),
          };
        }

        const writeResult = await this.model.updateOne(
          { _id: candidate._id, token: candidate.token },
          update,
        );
        const modified = Number((writeResult as any)?.modifiedCount ?? (writeResult as any)?.nModified ?? 0);
        if (modified > 0) {
          tokensMigrated += 1;
          migratedThisBatch += 1;
        }
      }

      // Prevent a retry loop if another writer changed every selected record.
      if (!migratedThisBatch) break;
    }

    const settingsDocs = await this.model.find({
      $or: [
        { provider: 'google', name: 'Google Ads System Settings' },
        { provider: 'tiktok', name: 'TikTok Ads System Settings' },
      ],
      providerConfigEnc: { $exists: false },
      notes: { $exists: true, $nin: [null, ''] },
    }).lean();

    for (const settingsDoc of settingsDocs) {
      const legacyConfig = this.parseJson<Record<string, any>>(settingsDoc.notes);
      if (!legacyConfig) continue;

      if (settingsDoc.provider === 'google') {
        const storedConfig = this.normalizeGoogleStoredSettings(legacyConfig);
        const containsSecret = Boolean(storedConfig.clientSecret || storedConfig.developerToken);
        if (!containsSecret) continue;
        const safeNotes = JSON.stringify({
          loginCustomerId: storedConfig.loginCustomerId,
          apiVersion: storedConfig.apiVersion,
          updatedFor: 'google-ads-system-settings',
        });
        const result = await this.model.updateOne(
          { _id: settingsDoc._id, providerConfigEnc: { $exists: false } },
          {
            $set: {
              providerConfigEnc: encryptToken(JSON.stringify(storedConfig)),
              notes: safeNotes,
            },
          },
        );
        providerConfigsMigrated += Number((result as any)?.modifiedCount ?? (result as any)?.nModified ?? 0) > 0 ? 1 : 0;
      } else if (settingsDoc.provider === 'tiktok') {
        const storedConfig = this.normalizeTikTokStoredSettings(legacyConfig);
        const containsSecret = Boolean(
          storedConfig.appSecret || storedConfig.authCode || storedConfig.refreshToken,
        );
        if (!containsSecret) continue;
        const safeNotes = JSON.stringify({
          redirectUri: storedConfig.redirectUri,
          scopes: storedConfig.scopes || [],
          grantedAdvertiserIds: storedConfig.grantedAdvertiserIds || [],
          businessCenterId: storedConfig.businessCenterId,
          businessCenterName: storedConfig.businessCenterName,
          testAdvertiserId: storedConfig.testAdvertiserId,
          advertiserIds: storedConfig.advertiserIds || [],
          accessTokenExpiresAt: storedConfig.accessTokenExpiresAt,
          refreshTokenExpiresAt: storedConfig.refreshTokenExpiresAt,
          updatedFor: 'tiktok-ads-system-settings',
        });
        const result = await this.model.updateOne(
          { _id: settingsDoc._id, providerConfigEnc: { $exists: false } },
          {
            $set: {
              providerConfigEnc: encryptToken(JSON.stringify(storedConfig)),
              notes: safeNotes,
            },
          },
        );
        providerConfigsMigrated += Number((result as any)?.modifiedCount ?? (result as any)?.nModified ?? 0) > 0 ? 1 : 0;
      }
    }

    return { tokensMigrated, providerConfigsMigrated };
  }

  // ?n tru?ng nh?y c?m tru?c khi tr? v? cho client
  private sanitize(doc: any){
    if(!doc) return doc;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    delete obj.token;
    delete obj.tokenEnc;
    delete obj.tokenHash;
    delete obj.providerConfigEnc;
    if (obj.provider === 'google') delete obj.notes;
    return obj;
  }

  private parseJson<T>(input?: string): T | undefined {
    if (!input) return undefined;
    try {
      return JSON.parse(input) as T;
    } catch {
      return undefined;
    }
  }

  private sanitizeNumericId(value?: string): string | undefined {
    if (!value) return undefined;
    const clean = String(value).replace(/[^0-9]/g, '');
    return clean || undefined;
  }

  private parseIdList(values?: string[] | string): string[] {
    if (!values) return [];
    const items = Array.isArray(values) ? values : values.split(',');
    return Array.from(new Set(
      items
        .map((item) => this.sanitizeNumericId(item))
        .filter(Boolean) as string[],
    ));
  }

  private maskValue(value?: string, prefixLength = 6, suffixLength = 4): string | undefined {
    return maskSecret(value, prefixLength, suffixLength);
  }

  private getRawToken(doc?: Partial<ApiToken> | null): string | undefined {
    if (!doc) return undefined;
    if (doc.tokenEnc) {
      const decrypted = decryptToken(doc.tokenEnc);
      if (decrypted) return decrypted;
    }
    return doc.token;
  }

  private readStoredConfig<T>(doc?: Partial<ApiToken> | null): T | undefined {
    if (!doc) return undefined;
    if (doc.providerConfigEnc) {
      const decrypted = decryptToken(doc.providerConfigEnc);
      const parsed = this.parseJson<T>(decrypted);
      if (parsed) return parsed;
    }
    return this.parseJson<T>(doc.notes);
  }

  private normalizeGoogleStoredSettings(input?: GoogleStoredSettings): GoogleStoredSettings {
    return {
      clientId: input?.clientId?.trim() || undefined,
      clientSecret: input?.clientSecret?.trim() || undefined,
      developerToken: input?.developerToken?.trim() || undefined,
      loginCustomerId: this.sanitizeNumericId(input?.loginCustomerId) || undefined,
      apiVersion: input?.apiVersion?.trim() || undefined,
    };
  }

  private normalizeTikTokStoredSettings(input?: TikTokStoredSettings): TikTokStoredSettings {
    return {
      appId: input?.appId?.trim() || undefined,
      appSecret: input?.appSecret?.trim() || undefined,
      authCode: input?.authCode?.trim() || undefined,
      refreshToken: input?.refreshToken?.trim() || undefined,
      redirectUri: input?.redirectUri?.trim() || undefined,
      scopes: this.normalizeStringList(input?.scopes),
      grantedAdvertiserIds: this.parseIdList(input?.grantedAdvertiserIds),
      businessCenterId: this.sanitizeNumericId(input?.businessCenterId) || undefined,
      businessCenterName: input?.businessCenterName?.trim() || undefined,
      testAdvertiserId: this.sanitizeNumericId(input?.testAdvertiserId) || undefined,
      advertiserIds: this.parseIdList(input?.advertiserIds),
      accessTokenExpiresAt: this.normalizeIsoDate(input?.accessTokenExpiresAt),
      refreshTokenExpiresAt: this.normalizeIsoDate(input?.refreshTokenExpiresAt),
      lastAuthAt: this.normalizeIsoDate(input?.lastAuthAt),
    };
  }

  private normalizeStringList(input?: string[] | string): string[] {
    if (Array.isArray(input)) {
      return Array.from(new Set(input.map((item) => String(item || '').trim()).filter(Boolean)));
    }

    if (typeof input === 'string') {
      return Array.from(new Set(
        input
          .split(/[,\n\s]+/)
          .map((item) => item.trim())
          .filter(Boolean),
      ));
    }

    return [];
  }

  private normalizeIsoDate(input?: string | Date): string | undefined {
    if (!input) return undefined;
    const date = input instanceof Date ? input : new Date(input);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }

  private resolveFutureIsoDateFromSeconds(value: unknown): string | undefined {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
    return new Date(Date.now() + seconds * 1000).toISOString();
  }

  private extractTikTokScopes(raw: unknown): string[] {
    if (Array.isArray(raw)) {
      return this.normalizeStringList(raw as string[]);
    }
    if (typeof raw === 'string') {
      return this.normalizeStringList(raw.split(/[,\s]+/));
    }
    return [];
  }

  private extractTikTokTokenPayload(raw: any): {
    accessToken?: string;
    refreshToken?: string;
    scopes: string[];
    accessTokenExpiresAt?: string;
    refreshTokenExpiresAt?: string;
  } {
    const accessToken = String(raw?.access_token || raw?.accessToken || '').trim() || undefined;
    const refreshToken = String(raw?.refresh_token || raw?.refreshToken || '').trim() || undefined;
    const scopes = this.extractTikTokScopes(raw?.scope || raw?.scopes || raw?.scope_list);
    const accessTokenExpiresAt =
      this.normalizeIsoDate(raw?.access_token_expires_at)
      || this.normalizeIsoDate(raw?.accessTokenExpiresAt)
      || this.resolveFutureIsoDateFromSeconds(raw?.access_token_expires_in)
      || this.resolveFutureIsoDateFromSeconds(raw?.expires_in)
      || this.resolveFutureIsoDateFromSeconds(raw?.expiresIn);
    const refreshTokenExpiresAt =
      this.normalizeIsoDate(raw?.refresh_token_expires_at)
      || this.normalizeIsoDate(raw?.refreshTokenExpiresAt)
      || this.resolveFutureIsoDateFromSeconds(raw?.refresh_token_expires_in)
      || this.resolveFutureIsoDateFromSeconds(raw?.refresh_expires_in)
      || this.resolveFutureIsoDateFromSeconds(raw?.refreshExpiresIn);

    return {
      accessToken,
      refreshToken,
      scopes,
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
    };
  }

  private summarizeTikTokAdvertisers(list: any[]): Array<{
    advertiserId: string;
    advertiserName?: string;
    status?: string;
    currency?: string;
  }> {
    return list
      .map((item) => {
        const advertiserId = this.sanitizeNumericId(
          item?.advertiser_id
          || item?.advertiserId
          || item?.id,
        );
        if (!advertiserId) return undefined;
        return {
          advertiserId,
          advertiserName: String(item?.advertiser_name || item?.advertiserName || item?.company || '').trim() || undefined,
          status: String(item?.status || '').trim() || undefined,
          currency: String(item?.currency || '').trim() || undefined,
        };
      })
      .filter(Boolean) as Array<{
      advertiserId: string;
      advertiserName?: string;
      status?: string;
      currency?: string;
    }>;
  }

  private async fetchTikTokAuthorizedAdvertisers(params: {
    accessToken: string;
    appId: string;
    appSecret: string;
  }): Promise<Array<{
    advertiserId: string;
    advertiserName?: string;
    status?: string;
    currency?: string;
  }>> {
    const url = new URL('https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/');
    url.searchParams.set('app_id', params.appId);
    url.searchParams.set('secret', params.appSecret);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Access-Token': params.accessToken,
        'Content-Type': 'application/json',
      },
    });

    const body = await response.json().catch(() => undefined);
    if (!response.ok || body?.code !== 0) {
      throw new BadRequestException(body?.message || `TikTok API error ${response.status}`);
    }

    return this.summarizeTikTokAdvertisers(Array.isArray(body?.data?.list) ? body.data.list : []);
  }

  async create(dto: CreateApiTokenDto) {
    const tokenHash = hashToken(dto.token);
    const tokenEnc = encryptToken(dto.token);
    const { token: _plaintextToken, ...safeDto } = dto;
    const doc = new this.model({
      ...safeDto,
      tokenEnc,
      tokenHash,
    });
    await doc.save();
    await this.audit('create', doc._id, undefined, { _id: doc._id, name: doc.name });
    return this.sanitize(doc);
  }
  async findAll(filter: any = {}) { const items = await this.model.find(filter).sort({ createdAt: -1 }).lean(); return items.map(i => this.sanitize(i)); }
  async findOne(id: string) { const doc = await this.model.findById(id).lean(); if (!doc) throw new NotFoundException('Token không t?n t?i'); return this.sanitize(doc) as any; }
  async update(id: string, dto: UpdateApiTokenDto) {
    const current = await this.model.findById(id);
    if (!current) throw new NotFoundException('Token không t?n t?i');

    const { token, ...safeDto } = dto;
    const update: Record<string, any> = { ...safeDto };
    const unset: Record<string, 1> = { token: 1 };
    if (token?.trim()) {
      update.tokenEnc = encryptToken(token.trim());
      update.tokenHash = hashToken(token.trim());
    }

    const doc = await this.model.findByIdAndUpdate(
      id,
      { $set: update, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true },
    );
    return this.sanitize(doc) as any;
  }
  async remove(id: string) { const res = await this.model.findByIdAndDelete(id); if (!res) throw new NotFoundException('Token không t?n t?i'); }

  /** Validate token thông qua strategy theo provider */
  async validate(id: string, _dto: ValidateTokenDto) {
  const token = await this.model.findById(id).select('+token');
  if(!token) throw new NotFoundException('Token không t?n t?i');
  const validator = buildValidator(token.provider);
  const raw = token.tokenEnc ? decryptToken(token.tokenEnc) : token.token;
  const result = await validator.validate(raw || token.token);
  token.lastCheckedAt = new Date();
  token.lastCheckStatus = result.status;
  token.lastCheckMessage = result.message;
  if(result.status==='valid') token.consecutiveFail = 0; else token.consecutiveFail = (token.consecutiveFail||0)+1;
    if(result.scopes) token.scopes = result.scopes;
    if(result.expireAt) token.expireAt = result.expireAt;
    if(token.consecutiveFail && token.consecutiveFail >= 3){
      token.degraded = true;
      token.isPrimary = false;
      token.lastCheckMessage = `${token.lastCheckMessage||''} [DEGRADED after ${token.consecutiveFail} fails]`.trim();
    }
  // Random 27-30 minutes for next check
  const minMs = 60 * 60 * 1000; // 60 phút
    const maxMs = 90 * 60 * 1000; // 90 phút
    const delta = Math.floor(minMs + Math.random() * (maxMs - minMs));
    token.nextCheckAt = new Date(Date.now() + delta);
    await token.save();
    await this.audit('validate', token._id, undefined, { status: token.lastCheckStatus });
    return this.sanitize(token);
  }

  /**
   * Ð?t token làm primary cho fanpage (b? primary cu)
   */
  async setPrimary(id: string, dto: SetPrimaryTokenDto) {
    const token = await this.model.findById(id);
    if(!token) throw new NotFoundException('Token không t?n t?i');
    if(!token.fanpageId || token.fanpageId.toString() !== dto.fanpageId) {
      throw new BadRequestException('Token không thu?c fanpageId cung c?p');
    }
    await this.model.updateMany({ fanpageId: dto.fanpageId, isPrimary: true }, { $set: { isPrimary: false } });
    token.isPrimary = true;
    await token.save();
    await this.audit('setPrimary', token._id, undefined, { fanpageId: dto.fanpageId });
    return this.sanitize(token);
  }

  /**
   * Rotate: t?o token m?i d?a trên token hi?n t?i, g?n quan h? rotatedFrom/rotatedTo
   */
  async rotate(id: string, dto: RotateTokenDto) {
    const current = await this.model.findById(id);
    if(!current) throw new NotFoundException('Token không t?n t?i');
    if(!dto.newToken?.trim()) throw new BadRequestException('newToken r?ng');
    const newHash = hashToken(dto.newToken.trim());
    const newEnc = encryptToken(dto.newToken.trim());
    const newDoc = new this.model({
      name: current.name + ' (rotated)',
      tokenEnc: newEnc,
      tokenHash: newHash,
      provider: current.provider,
      status: current.status,
      fanpageId: current.fanpageId,
      notes: dto.notes ?? current.notes,
      rotatedFrom: current._id
    });
    await newDoc.save();
    current.rotatedTo = newDoc._id as any;
    await current.save();
    await this.audit('rotate', newDoc._id, { oldId: current._id }, { newId: newDoc._id });
    return { old: this.sanitize(current), fresh: this.sanitize(newDoc) } as any;
  }

  /**
   * Ð?ng b? accessToken có trong collection Fanpage -> ApiToken (ch? t?o m?i n?u chua t?n t?i token cùng fanpageId & provider)
   */
  async syncFromFanpages() {
    const imported = await this.migrateLegacyFanpagePlaintextSecrets();
    return { imported, items: [] };
  }

  async getRawSystemUserToken(): Promise<string | undefined> {
    const envToken = process.env.FB_SYSTEM_USER_TOKEN?.trim() || process.env.FACEBOOK_SYSTEM_USER_TOKEN?.trim();
    if (envToken) return envToken;

    const tokenDoc = await this.model.findOne({
      provider: 'facebook',
      status: 'active',
      $or: [
        { tokenType: 'system_settings' },
        { name: 'Facebook System User Token' },
      ],
    }).select('+token').sort({ isPrimary: -1, updatedAt: -1 }).lean();

    return this.getRawToken(tokenDoc);
  }

  private async subscribeFanpageWebhook(pageId: string, accessToken: string): Promise<{ success: boolean; error?: string }> {
    const payload = new URLSearchParams({
      subscribed_fields: 'messages,messaging_postbacks',
      access_token: accessToken,
    });

    try {
      const response = await fetch(
        `https://graph.facebook.com/${this.facebookGraphApiVersion}/${encodeURIComponent(pageId)}/subscribed_apps`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: payload,
        },
      );

      const body = await response.json().catch(() => undefined);
      if (!response.ok || body?.error) {
        return {
          success: false,
          error: body?.error?.message || `Facebook API error ${response.status}`,
        };
      }

      return { success: body?.success !== false };
    } catch (error) {
      return {
        success: false,
        error: redactSecretString(error instanceof Error ? error.message : 'Unknown webhook subscription error'),
      };
    }
  }

  async syncFanpagesFromSystemUserToken(opts?: {
    businessId?: string;
    allowNoToken?: boolean;
    upsertApiTokens?: boolean;
    syncAdAccounts?: boolean;
  }) {
    const systemToken = await this.getRawSystemUserToken();
    if (!systemToken) {
      if (opts?.allowNoToken) {
        return {
          ok: false,
          skipped: true,
          reason: 'missing_system_user_token',
          totalPages: 0,
          created: 0,
          updated: 0,
          tokensUpserted: 0,
          adAccountsTotal: 0,
          adAccountsCreated: 0,
          adAccountsUpdated: 0,
        };
      }
      throw new BadRequestException('Chua cau hinh Facebook System User Token');
    }

    const fetchJson = async (url: string) => {
      try {
        const response = await fetch(url);
        const body = await response.json();
        if (!response.ok || body?.error) {
          throw new BadRequestException(
            redactSecretString(String(body?.error?.message || `Facebook API error ${response.status}`)),
          );
        }
        return body;
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        throw new BadRequestException(
          redactSecretString(error instanceof Error ? error.message : 'Facebook API request failed'),
        );
      }
    };

    const fetchAllGraphItems = async (startUrl: string) => {
      const items: any[] = [];
      let nextUrl: string | undefined = startUrl;
      while (nextUrl) {
        const body = await fetchJson(nextUrl);
        if (Array.isArray(body?.data)) items.push(...body.data);
        nextUrl = typeof body?.paging?.next === 'string' ? body.paging.next : undefined;
      }
      return items;
    };

    const pageUrl = `https://graph.facebook.com/${this.facebookGraphApiVersion}/me/accounts?fields=id,name,access_token,picture{url}&limit=200&access_token=${encodeURIComponent(systemToken)}`;
    const pages = await fetchAllGraphItems(pageUrl);

    let created = 0;
    let updated = 0;
    let tokensUpserted = 0;
    let webhookSubscribed = 0;
    let webhookFailed = 0;
    const webhookErrors: Array<{ pageId: string; name: string; error: string }> = [];
    for (const page of pages) {
      const pageId = String(page?.id || '').trim();
      const accessToken = String(page?.access_token || '').trim();
      if (!pageId || !accessToken) continue;

      const fanpagePayload = {
        name: String(page?.name || pageId).trim(),
        avatarUrl: page?.picture?.data?.url || undefined,
        status: 'active' as const,
        lastRefreshAt: new Date(),
      };

      const existingFanpage = await this.fanpageModel.findOne({ pageId });
      let fanpageDoc: any;
      if (existingFanpage) {
        Object.assign(existingFanpage, fanpagePayload);
        fanpageDoc = await existingFanpage.save();
        updated += 1;
      } else {
        fanpageDoc = await this.fanpageModel.create({
          pageId,
          ...fanpagePayload,
          connectedAt: new Date(),
          messageQuota: 10000,
          timezone: 'Asia/Ho_Chi_Minh',
          subscribedWebhook: false,
        });
        created += 1;
      }

      const webhookResult = await this.subscribeFanpageWebhook(pageId, accessToken);
      const subscribedWebhook = webhookResult.success || Boolean(fanpageDoc?.subscribedWebhook);
      if (webhookResult.success) {
        webhookSubscribed += 1;
      } else {
        webhookFailed += 1;
        webhookErrors.push({
          pageId,
          name: fanpagePayload.name,
          error: webhookResult.error || 'Unknown webhook subscription error',
        });
        this.logger.warn(
          `Failed to subscribe webhook for page ${fanpagePayload.name} (${pageId}): ${webhookResult.error || 'unknown error'}`,
        );
      }

      if (fanpageDoc?._id) {
        await this.fanpageModel.updateOne(
          { _id: fanpageDoc._id },
          {
            $set: {
              subscribedWebhook,
              lastRefreshAt: new Date(),
              connectedAt: fanpageDoc.connectedAt || new Date(),
            },
          },
        );
      }

      if (opts?.upsertApiTokens !== false) {
        const fanpageTokenDoc = await this.fanpageModel.findOne({ pageId }).select('_id name status').lean();
        if (!fanpageTokenDoc?._id) continue;
        await this.upsertFanpageAccessToken({
          fanpageId: String(fanpageTokenDoc._id),
          name: fanpagePayload.name,
          status: fanpageTokenDoc.status || 'active',
          accessToken,
          validated: true,
          notes: 'Synced from Facebook System User token',
        });
        tokensUpserted += 1;
      }
    }

    let adAccountsTotal = 0;
    let adAccountsCreated = 0;
    let adAccountsUpdated = 0;
    const businessId = this.sanitizeNumericId(opts?.businessId || process.env.FB_BUSINESS_ID);
    if ((opts?.syncAdAccounts ?? true) && businessId) {
      const adAccountEdges = ['owned_ad_accounts', 'client_ad_accounts'];
      const accountMap = new Map<string, any>();

      for (const edge of adAccountEdges) {
        const url = `https://graph.facebook.com/${this.facebookGraphApiVersion}/${businessId}/${edge}?fields=id,account_id,name,account_status,currency,timezone_name,business&limit=200&access_token=${encodeURIComponent(systemToken)}`;
        try {
          const items = await fetchAllGraphItems(url);
          for (const item of items) {
            const accountId = this.sanitizeNumericId(item?.account_id || item?.id);
            if (!accountId) continue;
            accountMap.set(accountId, item);
          }
        } catch {}
      }

      adAccountsTotal = accountMap.size;
      for (const item of accountMap.values()) {
        const accountId = this.sanitizeNumericId(item?.account_id || item?.id);
        if (!accountId) continue;
        const payload = {
          name: String(item?.name || accountId).trim(),
          accountId,
          accountType: 'facebook' as const,
          managementMode: 'bm' as const,
          isActive: item?.account_status !== 101,
          businessName: item?.business?.name || undefined,
          currency: item?.currency || undefined,
          timezoneId: item?.timezone_name || undefined,
          accountStatus: Number(item?.account_status || 0),
          tokenSource: 'system' as const,
          lastSyncAt: new Date(),
          lastSyncStatus: 'ok' as const,
        };
        const existingAccount = await this.adAccountModel.findOne({ accountId });
        if (existingAccount) {
          Object.assign(existingAccount, payload);
          await existingAccount.save();
          adAccountsUpdated += 1;
        } else {
          await this.adAccountModel.create(payload);
          adAccountsCreated += 1;
        }
      }
    }

    return {
      ok: true,
      businessId: businessId || null,
      totalPages: pages.length,
      created,
      updated,
      tokensUpserted,
      webhookSubscribed,
      webhookFailed,
      webhookErrors,
      adAccountsTotal,
      adAccountsCreated,
      adAccountsUpdated,
    };
  }

  /** Audit helper */
  private async audit(action: string, tokenId: any, prev?: any, next?: any, meta?: any){
    try { await this.auditModel.create({ action, tokenId, prev, next, meta }); } catch {}
  }

  /** Resolve token cho chatbot s? d?ng (primary tru?c, fallback n?u degraded/invalid) */
  async resolveForFanpage(fanpageId: string, provider: string = 'facebook') {
    let primary = await this.model.findOne({ fanpageId, provider, isPrimary: true }).lean();
    if(primary && primary.lastCheckStatus === 'valid') return { token: this.sanitize(primary), fallback: false } as any;
    // fallback tìm token h?p l? khác
    const alt = await this.model.find({ fanpageId, provider, status: 'active', lastCheckStatus: 'valid' })
      .sort({ lastCheckedAt: -1 }).limit(1).lean();
    if(alt.length){
      if(primary){
        await this.model.updateOne({ _id: primary._id }, { $set: { degraded: true } });
        await this.audit('fallback', primary._id, undefined, { fallbackTo: alt[0]._id });
      }
      return { token: this.sanitize(alt[0]), fallback: true } as any;
    }
    return { token: primary ? this.sanitize(primary) : null, fallback: false } as any;
  }

  /** INTERNAL ONLY: L?y raw access_token dùng n?i b? server d? g?i Graph API (không tr? qua HTTP) */
  async getRawAccessTokenForFanpage(
    fanpageId: string,
    provider: string = 'facebook',
    requireScopes?: string[]
  ): Promise<string | undefined> {
    let pick: any = null;
    if (requireScopes && requireScopes.length) {
      pick = await this.model.findOne({
        fanpageId,
        provider,
        status: 'active',
        lastCheckStatus: 'valid',
        scopes: { $all: requireScopes }
      }).select('+token').sort({ isPrimary: -1, lastCheckedAt: -1, updatedAt: -1 }).lean();
    }
    if (!pick && (!requireScopes || !requireScopes.length)) {
      pick = await this.model.findOne({ fanpageId, provider, status: 'active', lastCheckStatus: 'valid' })
        .select('+token').sort({ isPrimary: -1, lastCheckedAt: -1, updatedAt: -1 }).lean();
    }
    if (!pick && (!requireScopes || !requireScopes.length)) {
      pick = await this.model.findOne({ fanpageId, provider, status: 'active' })
        .select('+token').sort({ isPrimary: -1, lastCheckedAt: -1, updatedAt: -1 }).lean();
    }
    if (pick) {
      const raw = this.getRawToken(pick);
      if (raw && (pick as any).token) {
        await this.upsertFanpageAccessToken({
          fanpageId,
          name: pick.name,
          status: pick.status,
          accessToken: raw,
          validated: pick.lastCheckStatus === 'valid',
          notes: pick.notes,
        });
      }
      if (raw) return raw;
    }

    if (provider === 'facebook' && (!requireScopes || !requireScopes.length)) {
      const legacyFanpage = await this.fanpageModel
        .findById(fanpageId)
        .select('+accessToken _id name status')
        .lean();
      const legacyToken = String(legacyFanpage?.accessToken || '').trim();
      if (legacyToken) {
        await this.upsertFanpageAccessToken({
          fanpageId,
          name: legacyFanpage.name,
          status: legacyFanpage.status,
          accessToken: legacyToken,
          notes: 'Lazy-migrated from legacy Fanpage.accessToken',
        });
        return legacyToken;
      }
    }
    return undefined;
  }

  /** INTERNAL: L?y token Facebook có scope ads_management, uu tiên token g?n v?i adAccountId (n?u cung c?p) */
  async getRawAccessTokenForAdsManagement(adAccountId?: string): Promise<string | undefined> {
    const normalize = (v?: string) => {
      if (!v) return undefined;
      const m = String(v).trim().match(/^(?:act_)?(\d+)$/i);
      return m ? `act_${m[1]}` : v.trim();
    };
    const want = normalize(adAccountId);

    // 1) Uu tiên token dã khai báo adAccountId trùng kh?p và h?p l?
    if (want) {
      const pick = await this.model.findOne({
        provider: 'facebook', status: 'active', lastCheckStatus: 'valid',
        scopes: { $in: ['ads_management'] }, adAccountId: want
      }).select('+token').sort({ isPrimary: -1, lastCheckedAt: -1, updatedAt: -1 }).lean();
      if (pick) {
        try{ return pick.tokenEnc ? decryptToken(pick.tokenEnc) : (pick as any).token; } catch { return (pick as any).token; }
      }
    }

    // 2) Fallback: b?t k? token facebook h?p l? có ads_management
    const anyTok = await this.model.findOne({
      provider: 'facebook', status: 'active', lastCheckStatus: 'valid',
      scopes: { $in: ['ads_management'] }
    }).select('+token').sort({ isPrimary: -1, lastCheckedAt: -1, updatedAt: -1 }).lean();
    if (anyTok) {
      try{ return anyTok.tokenEnc ? decryptToken(anyTok.tokenEnc) : (anyTok as any).token; } catch { return (anyTok as any).token; }
    }
    return undefined;
  }

  /** Ki?m tra token có truy c?p du?c tài kho?n qu?ng cáo Facebook không */
  async testAdAccountAccess(id: string, adAccountId: string) {
    const tokenDoc = await this.model.findById(id).select('+token');
    if(!tokenDoc) throw new NotFoundException('Token không t?n t?i');
    const raw = tokenDoc.tokenEnc ? decryptToken(tokenDoc.tokenEnc) : tokenDoc.token;
    if(!raw) throw new BadRequestException('Không d?c du?c access token');

    // Chu?n hóa d?nh danh ad account: ph?i có ti?n t? act_
    const node = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const url = `https://graph.facebook.com/${this.facebookGraphApiVersion}/${encodeURIComponent(node)}`;
    const params = new URLSearchParams({
      fields: 'id,name,account_status,owner,business,spend_cap,age,capabilities',
      access_token: raw
    });
    const res = await fetch(`${url}?${params.toString()}`);
    const data = await res.json();
    if(res.ok && data?.id){
      const scopeOk = Array.isArray((tokenDoc as any).scopes) ? (tokenDoc as any).scopes.includes('ads_management') : false;
      // Ghi nh?n ad account vào token d? hi?n th? v? sau
      try {
        tokenDoc.adAccountId = data.id;
        tokenDoc.adAccountName = data.name;
        await tokenDoc.save();
      } catch {}
      return {
        ok: true,
        account: {
          id: data.id,
          name: data.name,
          account_status: data.account_status,
          age: data.age,
          capabilities: data.capabilities || []
        },
        scopeOk,
        message: scopeOk ? 'Có quy?n ads_management và truy c?p du?c tài kho?n' : 'Truy c?p du?c tài kho?n, nhung scope ads_management chua du?c ghi nh?n trong token. V?n có th? h?p l? n?u token th?c s? có quy?n.'
      };
    }
    return {
      ok: false,
      error: redactSecretString(String(data?.error?.message || 'Không truy c?p du?c tài kho?n')),
      code: data?.error?.code
    };
  }

  async getGoogleAdsRuntimeConfig(params?: {
    customerId?: string;
    loginCustomerId?: string;
    credentialReferenceId?: string;
  }): Promise<GoogleAdsRuntimeConfig> {
    const customerId = this.sanitizeNumericId(params?.customerId) || undefined;
    const requestedLoginCustomerId = this.sanitizeNumericId(params?.loginCustomerId) || undefined;

    const credentialReferenceId = String(params?.credentialReferenceId || '').trim();
    const candidates: Array<Partial<ApiToken> | null> = [];
    if (credentialReferenceId) {
      candidates.push(Types.ObjectId.isValid(credentialReferenceId)
        ? await this.model.findOne({
          _id: credentialReferenceId,
          provider: 'google',
          status: 'active',
        }).select('+token').lean()
        : null);
    } else if (customerId) {
      candidates.push(await this.model.findOne({
        provider: 'google',
        status: 'active',
        adAccountId: { $in: [customerId, params?.customerId] },
      }).select('+token').sort({ isPrimary: -1, updatedAt: -1 }).lean());
    }
    if (!credentialReferenceId) {
      candidates.push(await this.model.findOne({
        provider: 'google',
        status: 'active',
        name: 'Google Ads System Settings',
      }).select('+token').sort({ isPrimary: -1, updatedAt: -1 }).lean());
    }

    const tokenDoc = candidates.find(Boolean) || null;
    const storedConfig = this.normalizeGoogleStoredSettings(
      this.readStoredConfig<GoogleStoredSettings>(tokenDoc),
    );

    const envClientId = process.env.GOOGLE_ADS_CLIENT_ID?.trim();
    const envClientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET?.trim();
    const envRefreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim();
    const envDeveloperToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
    const envLoginCustomerId = this.sanitizeNumericId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
    const envApiVersion = process.env.GOOGLE_ADS_API_VERSION?.trim();

    const hasEnvConfig = Boolean(
      envClientId || envClientSecret || envRefreshToken || envDeveloperToken || envLoginCustomerId || envApiVersion,
    );
    const hasDbConfig = Boolean(tokenDoc);

    return {
      clientId: envClientId || storedConfig.clientId,
      clientSecret: envClientSecret || storedConfig.clientSecret,
      refreshToken: envRefreshToken || this.getRawToken(tokenDoc),
      developerToken: envDeveloperToken || storedConfig.developerToken,
      customerId,
      loginCustomerId: requestedLoginCustomerId || envLoginCustomerId || storedConfig.loginCustomerId,
      apiVersion: envApiVersion || storedConfig.apiVersion || getGoogleAdsApiVersion(),
      configSource: hasEnvConfig ? 'env' : hasDbConfig ? 'database' : 'none',
      refreshTokenSource: envRefreshToken ? 'env' : tokenDoc ? 'database' : 'none',
    };
  }

  async getGoogleAdsAccessToken(config: GoogleAdsRuntimeConfig): Promise<string | undefined> {
    if (!config.clientId || !config.clientSecret || !config.refreshToken) {
      return undefined;
    }
    try {
      const { google } = await import('googleapis');
      const oauth2Client = new google.auth.OAuth2({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      });
      oauth2Client.setCredentials({ refresh_token: config.refreshToken });
      const tokenRes = await oauth2Client.getAccessToken();
      return tokenRes?.token || undefined;
    } catch {
      return undefined;
    }
  }

  async getTikTokRuntimeConfig(): Promise<TikTokRuntimeConfig> {
    const tokenDoc = await this.model.findOne({
      provider: 'tiktok',
      status: 'active',
      name: 'TikTok Ads System Settings',
    }).select('+token').sort({ isPrimary: -1, updatedAt: -1 }).lean();

    const storedConfig = this.normalizeTikTokStoredSettings(
      this.readStoredConfig<TikTokStoredSettings>(tokenDoc),
    );

    const envAccessToken = process.env.TIKTOK_ACCESS_TOKEN?.trim();
    const envRefreshToken = process.env.TIKTOK_REFRESH_TOKEN?.trim();
    const envAppId = process.env.TIKTOK_APP_ID?.trim();
    const envAppSecret = process.env.TIKTOK_APP_SECRET?.trim();
    const envAuthCode = process.env.TIKTOK_AUTH_CODE?.trim();
    const envRedirectUri = process.env.TIKTOK_REDIRECT_URI?.trim();
    const envBusinessCenterId =
      this.sanitizeNumericId(process.env.TIKTOK_BUSINESS_CENTER_ID)
      || this.sanitizeNumericId(process.env.TIKTOK_BC_ID);
    const envBusinessCenterName = process.env.TIKTOK_BUSINESS_CENTER_NAME?.trim() || process.env.TIKTOK_BC_NAME?.trim();
    const envTestAdvertiserId =
      this.sanitizeNumericId(process.env.TIKTOK_TEST_ADVERTISER_ID)
      || this.sanitizeNumericId(process.env.TIKTOK_ADVERTISER_ID);
    const envAdvertiserIds = this.parseIdList(process.env.TIKTOK_ADVERTISER_IDS || process.env.TIKTOK_ADVERTISER_ID);
    const envGrantedAdvertiserIds = this.parseIdList(process.env.TIKTOK_GRANTED_ADVERTISER_IDS);
    const envScopes = this.normalizeStringList(process.env.TIKTOK_SCOPES);
    const envAccessTokenExpiresAt = this.normalizeIsoDate(process.env.TIKTOK_ACCESS_TOKEN_EXPIRES_AT);
    const envRefreshTokenExpiresAt = this.normalizeIsoDate(process.env.TIKTOK_REFRESH_TOKEN_EXPIRES_AT);
    const envLastAuthAt = this.normalizeIsoDate(process.env.TIKTOK_LAST_AUTH_AT);

    const accessToken = envAccessToken || this.getRawToken(tokenDoc);
    const hasEnvConfig = Boolean(
      envAccessToken
      || envRefreshToken
      || envAppId
      || envAppSecret
      || envAuthCode
      || envRedirectUri
      || envBusinessCenterId
      || envBusinessCenterName
      || envTestAdvertiserId
      || envAdvertiserIds.length
      || envGrantedAdvertiserIds.length
      || envScopes.length
      || envAccessTokenExpiresAt
      || envRefreshTokenExpiresAt
      || envLastAuthAt,
    );

    const advertiserIds = Array.from(new Set([
      ...envAdvertiserIds,
      ...(storedConfig.advertiserIds || []),
      envTestAdvertiserId || '',
      storedConfig.testAdvertiserId || '',
    ].filter(Boolean)));

    const grantedAdvertiserIds = Array.from(new Set([
      ...envGrantedAdvertiserIds,
      ...(storedConfig.grantedAdvertiserIds || []),
    ]));

    return {
      accessToken,
      refreshToken: envRefreshToken || storedConfig.refreshToken,
      appId: envAppId || storedConfig.appId,
      appSecret: envAppSecret || storedConfig.appSecret,
      authCode: envAuthCode || storedConfig.authCode,
      redirectUri: envRedirectUri || storedConfig.redirectUri,
      businessCenterId: envBusinessCenterId || storedConfig.businessCenterId,
      businessCenterName: envBusinessCenterName || storedConfig.businessCenterName,
      testAdvertiserId: envTestAdvertiserId || storedConfig.testAdvertiserId,
      advertiserIds,
      grantedAdvertiserIds,
      scopes: Array.from(new Set([
        ...envScopes,
        ...(storedConfig.scopes || []),
      ])),
      accessTokenExpiresAt: envAccessTokenExpiresAt || storedConfig.accessTokenExpiresAt,
      refreshTokenExpiresAt: envRefreshTokenExpiresAt || storedConfig.refreshTokenExpiresAt,
      lastAuthAt: envLastAuthAt || storedConfig.lastAuthAt,
      configured: Boolean(accessToken),
      configSource: hasEnvConfig ? 'env' : tokenDoc ? 'database' : 'none',
    };
  }

  // ================ GOOGLE ADS TEST & SETTINGS ================

  /**
   * Test Google Ads connection v?i credentials
   */
  async testGoogleAdsConnection(params: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    developerToken: string;
    customerId: string;
    apiVersion?: string;
  }): Promise<{ ok: boolean; message: string; account?: any; error?: string }> {
    try {
      const { google } = await import('googleapis');
      
      // L?y access token t? refresh token
      const oauth2Client = new google.auth.OAuth2({
        clientId: params.clientId,
        clientSecret: params.clientSecret,
      });
      oauth2Client.setCredentials({ refresh_token: params.refreshToken });
      
      const tokenRes = await oauth2Client.getAccessToken();
      if (!tokenRes?.token) {
        return { ok: false, message: 'Không th? l?y access token t? refresh token', error: 'Invalid refresh token' };
      }

      // Test API call
      const customerId = params.customerId.replace(/[^0-9]/g, '');
      const apiVersion = params.apiVersion || getGoogleAdsApiVersion();
      const url = `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${tokenRes.token}`,
          'developer-token': params.developerToken,
        }
      });

      if (response.ok) {
        const data = await response.json();
        return {
          ok: true,
          message: `K?t n?i thành công v?i Google Ads`,
          account: {
            id: customerId,
            name: data.descriptiveName || customerId,
            currencyCode: data.currencyCode,
            timeZone: data.timeZone
          }
        };
      } else {
        const errData = await response.json().catch(() => ({}));
        return {
          ok: false,
          message: `L?i Google Ads API: ${response.status}`,
          error: redactSecretString(String(errData?.error?.message || `HTTP ${response.status}`))
        };
      }
    } catch (err: any) {
      return {
        ok: false,
        message: 'L?i k?t n?i Google Ads',
        error: redactSecretString(err?.message || 'Unknown error')
      };
    }
  }

  /**
   * Exchange TikTok auth_code -> access_token / refresh_token
   */
  async exchangeTikTokAuthCode(params: {
    appId: string;
    appSecret: string;
    authCode: string;
    businessCenterId?: string;
    businessCenterName?: string;
    testAdvertiserId?: string;
    advertiserIds?: string[];
    save?: boolean;
  }): Promise<{
    ok: boolean;
    message: string;
    accessTokenStored?: boolean;
    hasRefreshToken?: boolean;
    scopes?: string[];
    accessTokenExpiresAt?: string;
    refreshTokenExpiresAt?: string;
    authorizedAdvertisers?: Array<{
      advertiserId: string;
      advertiserName?: string;
      status?: string;
      currency?: string;
    }>;
    advertiserIds?: string[];
    error?: string;
  }> {
    try {
      const response = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: params.appId,
          secret: params.appSecret,
          auth_code: params.authCode,
        }),
      });

      const body = await response.json().catch(() => undefined);
      if (!response.ok || body?.code !== 0) {
        return {
          ok: false,
          message: `Loi TikTok OAuth: ${body?.message || `HTTP ${response.status}`}`,
          error: body?.message || `HTTP ${response.status}`,
        };
      }

      const tokenPayload = this.extractTikTokTokenPayload(body?.data || {});
      if (!tokenPayload.accessToken) {
        return {
          ok: false,
          message: 'TikTok khong tra ve access token',
          error: 'missing_access_token',
        };
      }

      let authorizedAdvertisers: Array<{
        advertiserId: string;
        advertiserName?: string;
        status?: string;
        currency?: string;
      }> = [];

      try {
        authorizedAdvertisers = await this.fetchTikTokAuthorizedAdvertisers({
          accessToken: tokenPayload.accessToken,
          appId: params.appId,
          appSecret: params.appSecret,
        });
      } catch {}

      const mergedAdvertiserIds = Array.from(new Set([
        ...this.parseIdList(params.advertiserIds),
        ...authorizedAdvertisers.map((item) => item.advertiserId),
        this.sanitizeNumericId(params.testAdvertiserId) || '',
      ].filter(Boolean)));

      if (params.save !== false) {
        await this.saveTikTokSettings({
          accessToken: tokenPayload.accessToken,
          refreshToken: tokenPayload.refreshToken,
          appId: params.appId,
          appSecret: params.appSecret,
          authCode: params.authCode,
          businessCenterId: params.businessCenterId,
          businessCenterName: params.businessCenterName,
          testAdvertiserId: params.testAdvertiserId,
          advertiserIds: mergedAdvertiserIds,
          grantedAdvertiserIds: authorizedAdvertisers.map((item) => item.advertiserId),
          scopes: tokenPayload.scopes,
          accessTokenExpiresAt: tokenPayload.accessTokenExpiresAt,
          refreshTokenExpiresAt: tokenPayload.refreshTokenExpiresAt,
        });
      }

      return {
        ok: true,
        message: 'Da doi auth code TikTok thanh cong',
        accessTokenStored: true,
        hasRefreshToken: Boolean(tokenPayload.refreshToken),
        scopes: tokenPayload.scopes,
        accessTokenExpiresAt: tokenPayload.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokenPayload.refreshTokenExpiresAt,
        authorizedAdvertisers,
        advertiserIds: mergedAdvertiserIds,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: 'Loi ket noi TikTok OAuth',
        error: redactSecretString(err?.message || 'Unknown error'),
      };
    }
  }

  /**
   * Test TikTok Ads connection
   */
  async testTikTokConnection(params: {
    accessToken?: string;
    advertiserId: string;
    businessCenterId?: string;
    appId?: string;
    appSecret?: string;
  }): Promise<{ ok: boolean; message: string; account?: any; error?: string; authorizedAdvertisers?: any[] }> {
    try {
      const runtime = !params.accessToken || !params.appId || !params.appSecret
        ? await this.getTikTokRuntimeConfig()
        : undefined;
      const accessToken = params.accessToken || runtime?.accessToken;
      const appId = params.appId || runtime?.appId;
      const appSecret = params.appSecret || runtime?.appSecret;

      if (!accessToken) {
        return {
          ok: false,
          message: 'Chua co TikTok access token de test',
          error: 'missing_access_token',
        };
      }

      let authorizedAdvertisers: any[] | undefined;
      if (appId && appSecret) {
        try {
          authorizedAdvertisers = await this.fetchTikTokAuthorizedAdvertisers({
            accessToken,
            appId,
            appSecret,
          });
          const matchedAuthorized = authorizedAdvertisers.find((item) => item.advertiserId === this.sanitizeNumericId(params.advertiserId));
          if (matchedAuthorized) {
            return {
              ok: true,
              message: 'Ket noi TikTok thanh cong qua OAuth advertiser authorization',
              account: {
                id: matchedAuthorized.advertiserId,
                name: matchedAuthorized.advertiserName || matchedAuthorized.advertiserId,
                status: matchedAuthorized.status,
                currency: matchedAuthorized.currency,
              },
              authorizedAdvertisers,
            };
          }
        } catch {}
      }

      const url = 'https://business-api.tiktok.com/open_api/v1.3/advertiser/info/';
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      // TikTok API tr? v? trong body
      const body = await response.json();
      
      if (body.code === 0 && body.data?.list?.length > 0) {
        const advInfo = body.data.list.find((a: any) => 
          String(a.advertiser_id) === String(params.advertiserId).replace(/[^0-9]/g, '')
        ) || body.data.list[0];
        
        return {
          ok: true,
          message: `K?t n?i thành công v?i TikTok Ads`,
          account: {
            id: advInfo.advertiser_id,
            name: advInfo.advertiser_name || advInfo.company || advInfo.advertiser_id,
            status: advInfo.status,
            currency: advInfo.currency
          },
          authorizedAdvertisers,
        };
      } else {
        return {
          ok: false,
          message: `L?i TikTok API: ${redactSecretString(String(body.message || 'Unknown'))}`,
          error: redactSecretString(String(body.message || `Code: ${body.code}`))
        };
      }
    } catch (err: any) {
      return {
        ok: false,
        message: 'L?i k?t n?i TikTok',
        error: redactSecretString(err?.message || 'Unknown error')
      };
    }
  }

  /**
   * Luu Google Ads settings vào database (collection settings ho?c dùng token d?c bi?t)
   */
  async saveGoogleAdsSettings(params: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    developerToken: string;
    loginCustomerId?: string;
    apiVersion?: string;
  }): Promise<{ ok: boolean; message: string }> {
    try {
      const loginCustomerId = this.sanitizeNumericId(params.loginCustomerId) || undefined;
      const storedConfig: GoogleStoredSettings = this.normalizeGoogleStoredSettings({
        clientId: params.clientId,
        clientSecret: params.clientSecret,
        developerToken: params.developerToken,
        loginCustomerId,
        apiVersion: params.apiVersion,
      });

      // Tìm ho?c t?o token d?c bi?t cho Google Ads settings
      const existing = await this.model.findOne({ 
        provider: 'google', 
        name: 'Google Ads System Settings' 
      });

      const tokenData = {
        name: 'Google Ads System Settings',
        tokenEnc: encryptToken(params.refreshToken),
        tokenHash: hashToken(params.refreshToken),
        provider: 'google' as const,
        status: 'active' as const,
        tokenType: 'system_settings' as const,
        isPrimary: true,
        providerConfigEnc: encryptToken(JSON.stringify(storedConfig)),
        notes: JSON.stringify({
          loginCustomerId,
          apiVersion: storedConfig.apiVersion,
          updatedFor: 'google-ads-system-settings',
        }),
        adAccountId: loginCustomerId,
        adAccountName: 'System Settings'
      };

      if (existing) {
        await this.model.updateOne(
          { _id: existing._id },
          { $set: tokenData, $unset: { token: 1 } },
        );
      } else {
        await this.model.create(tokenData);
      }

      return { ok: true, message: 'Ðã luu c?u hình Google Ads' };
    } catch (err: any) {
      return redactSecrets({ ok: false, message: err?.message || 'L?i luu settings' });
    }
  }

  /**
   * Luu TikTok settings
   */
  async saveTikTokSettings(params: {
    accessToken?: string;
    refreshToken?: string;
    appId?: string;
    appSecret?: string;
    authCode?: string;
    redirectUri?: string;
    businessCenterId?: string;
    businessCenterName?: string;
    testAdvertiserId?: string;
    advertiserIds?: string[];
    grantedAdvertiserIds?: string[];
    scopes?: string[];
    accessTokenExpiresAt?: string;
    refreshTokenExpiresAt?: string;
  }): Promise<{ ok: boolean; message: string }> {
    try {
      const existing = await this.model.findOne({
        provider: 'tiktok',
        name: 'TikTok Ads System Settings'
      }).select('+token');

      const accessToken = params.accessToken?.trim() || this.getRawToken(existing);
      if (!accessToken) {
        return { ok: false, message: 'Chua co TikTok access token de luu cau hinh' };
      }

      const storedConfig = this.normalizeTikTokStoredSettings({
        appId: params.appId,
        appSecret: params.appSecret,
        authCode: params.authCode,
        refreshToken: params.refreshToken,
        redirectUri: params.redirectUri,
        scopes: params.scopes,
        grantedAdvertiserIds: params.grantedAdvertiserIds,
        businessCenterId: params.businessCenterId,
        businessCenterName: params.businessCenterName,
        testAdvertiserId: params.testAdvertiserId,
        advertiserIds: params.advertiserIds,
        accessTokenExpiresAt: params.accessTokenExpiresAt,
        refreshTokenExpiresAt: params.refreshTokenExpiresAt,
        lastAuthAt: new Date().toISOString(),
      });

      const tokenData = {
        name: 'TikTok Ads System Settings',
        tokenEnc: encryptToken(accessToken),
        tokenHash: hashToken(accessToken),
        provider: 'tiktok' as const,
        status: 'active' as const,
        tokenType: 'system_settings' as const,
        isPrimary: true,
        businessCenterId: storedConfig.businessCenterId,
        businessCenterName: storedConfig.businessCenterName,
        expireAt: storedConfig.accessTokenExpiresAt ? new Date(storedConfig.accessTokenExpiresAt) : undefined,
        scopes: storedConfig.scopes,
        providerConfigEnc: encryptToken(JSON.stringify(storedConfig)),
        notes: JSON.stringify({
          hasRefreshToken: Boolean(storedConfig.refreshToken),
          authCodeStored: Boolean(storedConfig.authCode),
          redirectUri: storedConfig.redirectUri,
          scopes: storedConfig.scopes || [],
          grantedAdvertiserIds: storedConfig.grantedAdvertiserIds || [],
          accessTokenExpiresAt: storedConfig.accessTokenExpiresAt,
          refreshTokenExpiresAt: storedConfig.refreshTokenExpiresAt,
          businessCenterId: storedConfig.businessCenterId,
          businessCenterName: storedConfig.businessCenterName,
          testAdvertiserId: storedConfig.testAdvertiserId,
          advertiserIds: storedConfig.advertiserIds || [],
          updatedFor: 'tiktok-ads-system-settings',
        }),
        adAccountName: 'System Settings'
      };

      if (existing) {
        await this.model.updateOne(
          { _id: existing._id },
          { $set: tokenData, $unset: { token: 1 } },
        );
      } else {
        await this.model.create(tokenData);
      }

      return { ok: true, message: 'Ðã luu c?u hình TikTok Ads' };
    } catch (err: any) {
      return redactSecrets({ ok: false, message: err?.message || 'L?i luu settings' });
    }
  }

  /**
   * L?y settings hi?n t?i (masked)
   */
  async getAdsSettings(): Promise<{
    facebook: { configured: boolean; tokenCount: number };
    google: {
      configured: boolean;
      clientId?: string;
      hasRefreshToken: boolean;
      developerToken?: string;
      loginCustomerId?: string;
      apiVersion?: string;
      configSource?: ConfigSource;
      refreshTokenSource?: ConfigSource;
    };
    tiktok: {
      configured: boolean;
      hasAccessToken: boolean;
      hasRefreshToken: boolean;
      configSource?: ConfigSource;
      appId?: string;
      businessCenterId?: string;
      businessCenterName?: string;
      testAdvertiserId?: string;
      advertiserIds?: string[];
      grantedAdvertiserIds?: string[];
      scopes?: string[];
      accessTokenExpiresAt?: string;
      refreshTokenExpiresAt?: string;
      lastAuthAt?: string;
    };
  }> {
    const fbTokens = await this.model.countDocuments({ provider: 'facebook', status: 'active' });
    const googleRuntime = await this.getGoogleAdsRuntimeConfig();
    const tiktokRuntime = await this.getTikTokRuntimeConfig();

    const googleConfig = {
      configured: Boolean(
        googleRuntime.refreshToken ||
        googleRuntime.clientId ||
        googleRuntime.clientSecret ||
        googleRuntime.developerToken
      ),
      clientId: this.maskValue(googleRuntime.clientId, 20, 4),
      hasRefreshToken: Boolean(googleRuntime.refreshToken),
      developerToken: this.maskValue(googleRuntime.developerToken, 10, 4),
      loginCustomerId: googleRuntime.loginCustomerId,
      apiVersion: googleRuntime.apiVersion,
      configSource: googleRuntime.configSource,
      refreshTokenSource: googleRuntime.refreshTokenSource,
    };

    const tiktokConfig = {
      configured: tiktokRuntime.configured,
      hasAccessToken: Boolean(tiktokRuntime.accessToken),
      hasRefreshToken: Boolean(tiktokRuntime.refreshToken),
      configSource: tiktokRuntime.configSource,
      appId: this.maskValue(tiktokRuntime.appId, 12, 4),
      businessCenterId: tiktokRuntime.businessCenterId,
      businessCenterName: tiktokRuntime.businessCenterName,
      testAdvertiserId: tiktokRuntime.testAdvertiserId,
      advertiserIds: tiktokRuntime.advertiserIds,
      grantedAdvertiserIds: tiktokRuntime.grantedAdvertiserIds,
      scopes: tiktokRuntime.scopes,
      accessTokenExpiresAt: tiktokRuntime.accessTokenExpiresAt,
      refreshTokenExpiresAt: tiktokRuntime.refreshTokenExpiresAt,
      lastAuthAt: tiktokRuntime.lastAuthAt,
    };

    return {
      facebook: { configured: fbTokens > 0, tokenCount: fbTokens },
      google: googleConfig,
      tiktok: tiktokConfig
    };
  }
}
