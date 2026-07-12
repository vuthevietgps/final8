/**
 * Validate ad account timezone before saving into the system.
 * Production keeps strict enforcement. Local/test can skip provider lookup
 * failures when external tokens are not configured.
 */
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ApiTokenService } from '../api-token/api-token.service';
import { getGoogleAdsApiVersion, getMetaGraphApiVersion } from '../common/ads-api-version';

const UTC7_IANA_NAMES = new Set([
  'asia/ho_chi_minh',
  'asia/saigon',
  'asia/bangkok',
  'asia/jakarta',
  'asia/phnom_penh',
  'asia/vientiane',
  'asia/pontianak',
  'indian/christmas',
]);

function isUtc7Timezone(tz: string | undefined | null): boolean {
  if (!tz) return false;
  const lower = tz.trim().toLowerCase();

  if (UTC7_IANA_NAMES.has(lower)) return true;
  if (/^utc\+7(\.0+)?$/i.test(lower)) return true;
  if (/^gmt\+7(\.0+)?$/i.test(lower)) return true;
  if (/^\+07:?00$/i.test(lower)) return true;

  return false;
}

@Injectable()
export class AdAccountTimezoneCheckService {
  private readonly logger = new Logger(AdAccountTimezoneCheckService.name);

  constructor(private readonly apiTokenService: ApiTokenService) {}

  async validateTimezone(
    accountType: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'shopee' | 'lazada',
    accountId: string,
    loginCustomerId?: string,
  ): Promise<void> {
    switch (accountType) {
      case 'facebook':
        return this.validateFacebook(accountId);
      case 'google':
        return this.validateGoogle(accountId, loginCustomerId);
      case 'tiktok':
        return this.validateTikTok(accountId);
      default:
        return;
    }
  }

  private isStrictTimezoneEnforcementEnabled(): boolean {
    const raw = String(process.env.ENFORCE_AD_ACCOUNT_TIMEZONE || '')
      .trim()
      .toLowerCase();

    if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
    if (['0', 'false', 'no', 'off'].includes(raw)) return false;

    return String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
  }

  private handleUnavailableTimezoneValidation(message: string): void {
    if (this.isStrictTimezoneEnforcementEnabled()) {
      throw new BadRequestException(message);
    }

    this.logger.warn(
      `${message} Bo qua trong local/test vi chua bat ENFORCE_AD_ACCOUNT_TIMEZONE.`,
    );
  }

  private async validateFacebook(accountId: string): Promise<void> {
    const token =
      (await this.apiTokenService.getRawSystemUserToken()) ||
      (await this.apiTokenService.getRawAccessTokenForAdsManagement(accountId));

    if (!token) {
      this.handleUnavailableTimezoneValidation(
        'Khong the kiem tra mui gio tai khoan Facebook. Vui long cau hinh Facebook System User Token truoc khi them tai khoan.',
      );
      return;
    }

    const node = /^act_/i.test(accountId) ? accountId : `act_${accountId}`;
    const url =
      `https://graph.facebook.com/${getMetaGraphApiVersion()}/${encodeURIComponent(node)}` +
      `?fields=timezone_name&access_token=${encodeURIComponent(token)}`;

    let timezone: string | undefined;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data?.error) {
        this.handleUnavailableTimezoneValidation(
          `Khong the lay thong tin mui gio tu Facebook: ${data.error.message || 'Loi khong xac dinh'}`,
        );
        return;
      }
      timezone = data?.timezone_name;
    } catch (err: any) {
      this.handleUnavailableTimezoneValidation(
        `Khong the ket noi Facebook API de kiem tra mui gio: ${err?.message || 'Loi mang'}`,
      );
      return;
    }

    this.logger.log(`Facebook account ${accountId} timezone: ${timezone}`);

    if (!isUtc7Timezone(timezone)) {
      throw new BadRequestException(
        `Tai khoan Facebook ID "${accountId}" dang dung mui gio "${timezone || 'khong xac dinh'}". ` +
        `Vui long doi mui gio tai khoan ve Viet Nam (Asia/Ho_Chi_Minh - UTC+7) tren Facebook truoc khi them vao he thong.`,
      );
    }
  }

  private async validateGoogle(accountId: string, loginCustomerId?: string): Promise<void> {
    const config = await this.apiTokenService.getGoogleAdsRuntimeConfig({
      customerId: accountId,
      loginCustomerId,
    });

    if (!config.clientId || !config.clientSecret || !config.refreshToken) {
      this.handleUnavailableTimezoneValidation(
        'Khong the kiem tra mui gio tai khoan Google Ads. Vui long cau hinh Google Ads API truoc khi them tai khoan.',
      );
      return;
    }

    const accessToken = await this.apiTokenService.getGoogleAdsAccessToken(config);
    if (!accessToken) {
      this.handleUnavailableTimezoneValidation(
        'Khong the lay access token Google Ads de kiem tra mui gio. Vui long kiem tra lai cau hinh.',
      );
      return;
    }

    const customerId = accountId.replace(/[^0-9]/g, '');
    const apiVersion = config.apiVersion || getGoogleAdsApiVersion();
    const url = `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': config.developerToken || '',
    };
    if (config.loginCustomerId) {
      headers['login-customer-id'] = config.loginCustomerId;
    }

    let timezone: string | undefined;
    try {
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (!res.ok) {
        const errMsg =
          data?.error?.message ||
          data?.error?.errors?.[0]?.message ||
          `HTTP ${res.status}`;
        this.handleUnavailableTimezoneValidation(
          `Khong the lay thong tin mui gio tu Google Ads: ${errMsg}`,
        );
        return;
      }
      timezone = data?.timeZone;
    } catch (err: any) {
      this.handleUnavailableTimezoneValidation(
        `Khong the ket noi Google Ads API de kiem tra mui gio: ${err?.message || 'Loi mang'}`,
      );
      return;
    }

    this.logger.log(`Google Ads account ${accountId} timezone: ${timezone}`);

    if (!isUtc7Timezone(timezone)) {
      throw new BadRequestException(
        `Tai khoan Google Ads ID "${accountId}" dang dung mui gio "${timezone || 'khong xac dinh'}". ` +
        `Vui long doi mui gio tai khoan ve Viet Nam (Asia/Ho_Chi_Minh - UTC+7) tren Google Ads truoc khi them vao he thong.`,
      );
    }
  }

  private async validateTikTok(accountId: string): Promise<void> {
    const config = await this.apiTokenService.getTikTokRuntimeConfig();

    if (!config.accessToken) {
      this.handleUnavailableTimezoneValidation(
        'Khong the kiem tra mui gio tai khoan TikTok Ads. Vui long cau hinh TikTok Ads API truoc khi them tai khoan.',
      );
      return;
    }

    const advertiserId = accountId.replace(/[^0-9]/g, '');
    const params = new URLSearchParams({
      advertiser_ids: JSON.stringify([advertiserId]),
    });
    const url = `https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?${params.toString()}`;

    let timezone: string | undefined;
    try {
      const res = await fetch(url, {
        headers: {
          'Access-Token': config.accessToken,
          'Content-Type': 'application/json',
        },
      });
      const body = await res.json();
      if (body?.code !== 0) {
        this.handleUnavailableTimezoneValidation(
          `Khong the lay thong tin mui gio tu TikTok Ads: ${body?.message || 'Loi khong xac dinh'}`,
        );
        return;
      }
      timezone = body?.data?.list?.[0]?.timezone;
    } catch (err: any) {
      this.handleUnavailableTimezoneValidation(
        `Khong the ket noi TikTok API de kiem tra mui gio: ${err?.message || 'Loi mang'}`,
      );
      return;
    }

    this.logger.log(`TikTok Ads account ${accountId} timezone: ${timezone}`);

    if (timezone && !isUtc7Timezone(timezone)) {
      throw new BadRequestException(
        `Tai khoan TikTok Ads ID "${accountId}" dang dung mui gio "${timezone}". ` +
        `Vui long doi mui gio tai khoan ve Viet Nam (UTC+7) tren TikTok Business Center truoc khi them vao he thong.`,
      );
    }
  }
}
