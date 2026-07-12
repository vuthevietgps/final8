/**
 * AdAccount service.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { AdAccount, AdAccountDocument } from './schemas/ad-account.schema';
import { CreateAdAccountDto } from './dto/create-ad-account.dto';
import { UpdateAdAccountDto } from './dto/update-ad-account.dto';
import { AdAccountTimezoneCheckService } from './ad-account.timezone-check.service';

type AccountType = AdAccount['accountType'];
type ManagementMode = NonNullable<AdAccount['managementMode']>;

@Injectable()
export class AdAccountService {
  constructor(
    @InjectModel(AdAccount.name) private readonly adAccountModel: Model<AdAccountDocument>,
    private readonly timezoneCheckService: AdAccountTimezoneCheckService,
  ) {}

  private normalizeFacebookAccountId(accountId?: string): string | undefined {
    if (!accountId) return undefined;
    const trimmed = accountId.trim();
    const match = trimmed.match(/^(?:act_)?(\d+)$/i);
    return match ? match[1] : trimmed;
  }

  private normalizeNumericId(value?: string): string | undefined {
    if (!value) return undefined;
    const clean = String(value).replace(/[^0-9]/g, '');
    return clean || undefined;
  }

  private normalizeAccountId(accountType: AccountType | undefined, accountId?: string): string | undefined {
    if (!accountId) return undefined;
    switch (accountType) {
      case 'facebook':
        return this.normalizeFacebookAccountId(accountId);
      case 'google':
      case 'tiktok':
        return this.normalizeNumericId(accountId) || accountId.trim();
      default:
        return accountId.trim();
    }
  }

  private inferManagementMode(accountType?: AccountType, value?: string): ManagementMode {
    if (value && ['direct', 'bm', 'mcc', 'bc'].includes(value)) {
      return value as ManagementMode;
    }
    switch (accountType) {
      case 'facebook':
        return 'bm';
      case 'google':
        return 'mcc';
      case 'tiktok':
        return 'bc';
      default:
        return 'direct';
    }
  }

  private buildPayload(dto: CreateAdAccountDto | UpdateAdAccountDto, accountType: AccountType): Partial<AdAccount> {
    const payload: Record<string, any> = { ...dto };
    const accountId = this.normalizeAccountId(accountType, dto.accountId);
    if (accountId) payload.accountId = accountId;

    payload.managementMode = this.inferManagementMode(accountType, dto.managementMode);
    if (dto.loginCustomerId !== undefined) {
      payload.loginCustomerId = this.normalizeNumericId(dto.loginCustomerId) || dto.loginCustomerId?.trim();
    }
    if (dto.businessCenterId !== undefined) {
      payload.businessCenterId =
        accountType === 'tiktok'
          ? this.normalizeNumericId(dto.businessCenterId) || dto.businessCenterId?.trim()
          : dto.businessCenterId?.trim();
    }
    if (dto.businessCenterName !== undefined) {
      payload.businessCenterName = dto.businessCenterName?.trim();
    }
    if (dto.tokenSource !== undefined) {
      payload.tokenSource = dto.tokenSource;
    }

    const shouldMarkOperatorActivity = accountType === 'tiktok' && (
      'adsManagerUserId' in dto ||
      'businessCenterId' in dto ||
      'businessCenterName' in dto ||
      'managementMode' in dto ||
      'notes' in dto ||
      'description' in dto
    );
    if (shouldMarkOperatorActivity) {
      payload.lastOperatorActivityAt = new Date();
    }

    return payload as Partial<AdAccount>;
  }

  private baseQuery(filter: FilterQuery<AdAccountDocument>) {
    return this.adAccountModel
      .find(filter)
      .populate('adsManagerUserId', 'fullName email role')
      .sort({ createdAt: -1 });
  }

  async create(dto: CreateAdAccountDto): Promise<AdAccount> {
    const accountType = dto.accountType;

    // Kiểm tra múi giờ tài khoản quảng cáo TRƯỚC khi lưu vào DB.
    // Chính sách: TẤT CẢ tài khoản FB/GG/TT phải dùng múi giờ Việt Nam (UTC+7).
    // Nếu múi giờ khác UTC+7 → ném BadRequestException, không cho thêm.
    await this.timezoneCheckService.validateTimezone(
      accountType,
      dto.accountId,
      dto.loginCustomerId,
    );

    const payload = this.buildPayload(dto, accountType);
    const created = new this.adAccountModel({
      ...payload,
      accountType,
      isActive: dto.isActive ?? true,
    });
    try {
      return await created.save();
    } catch (e: any) {
      if (e?.code === 11000 && e?.keyPattern?.accountId) {
        throw new BadRequestException('ID tai khoan quang cao da ton tai. Vui long nhap ID khac.');
      }
      throw e;
    }
  }

  async findAll(query?: any): Promise<AdAccount[]> {
    const filter: FilterQuery<AdAccountDocument> = {};
    if (query?.accountType) filter.accountType = query.accountType;
    if (query?.managementMode) filter.managementMode = query.managementMode;
    if (query?.businessCenterId) filter.businessCenterId = this.normalizeNumericId(query.businessCenterId) || query.businessCenterId;
    if (query?.adsManagerUserId) filter.adsManagerUserId = query.adsManagerUserId;
    if (query?.isActive !== undefined) filter.isActive = query.isActive === 'true';
    return this.baseQuery(filter).exec();
  }

  async search(query?: any): Promise<AdAccount[]> {
    const filter: FilterQuery<AdAccountDocument> = {};
    if (query?.accountType && query.accountType !== 'all') filter.accountType = query.accountType;
    if (query?.managementMode && query.managementMode !== 'all') filter.managementMode = query.managementMode;
    if (query?.status && query.status !== 'all') filter.isActive = query.status === 'active';
    if (query?.businessCenterId) {
      filter.businessCenterId = this.normalizeNumericId(query.businessCenterId) || query.businessCenterId;
    }
    if (query?.adsManagerUserId && query.adsManagerUserId !== 'all') {
      filter.adsManagerUserId = query.adsManagerUserId;
    }
    if (query?.keyword) {
      const keyword = query.keyword.trim();
      if (keyword) {
        filter.$or = [
          { name: { $regex: keyword, $options: 'i' } },
          { accountId: { $regex: keyword, $options: 'i' } },
          { businessCenterName: { $regex: keyword, $options: 'i' } },
          { businessCenterId: { $regex: keyword, $options: 'i' } },
        ];
      }
    }

    return this.baseQuery(filter).exec();
  }

  async findOne(id: string): Promise<AdAccount> {
    const item = await this.adAccountModel
      .findById(id)
      .populate('adsManagerUserId', 'fullName email role')
      .exec();
    if (!item) {
      throw new NotFoundException('Khong tim thay tai khoan quang cao');
    }
    return item;
  }

  async update(id: string, dto: UpdateAdAccountDto): Promise<AdAccount> {
    try {
      const current = await this.adAccountModel
        .findById(id)
        .select('accountType accountId loginCustomerId')
        .lean();
      if (!current) {
        throw new NotFoundException('Khong tim thay tai khoan quang cao de cap nhat');
      }
      const nextAccountType = ((dto.accountType as AccountType) || current.accountType) as AccountType;
      const payload = this.buildPayload(dto, nextAccountType);
      const nextAccountId = (payload.accountId as string | undefined) || current.accountId;
      const nextLoginCustomerId =
        (payload.loginCustomerId as string | undefined) || current.loginCustomerId;
      const shouldRevalidateTimezone =
        nextAccountType === 'facebook'
        || nextAccountType === 'google'
        || nextAccountType === 'tiktok';
      const timezoneIdentityChanged =
        dto.accountType !== undefined
        || dto.accountId !== undefined
        || dto.loginCustomerId !== undefined;

      if (shouldRevalidateTimezone && timezoneIdentityChanged && nextAccountId) {
        await this.timezoneCheckService.validateTimezone(
          nextAccountType,
          nextAccountId,
          nextLoginCustomerId,
        );
      }

      const updated = await this.adAccountModel
        .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
        .populate('adsManagerUserId', 'fullName email role')
        .exec();
      if (!updated) {
        throw new NotFoundException('Khong tim thay tai khoan quang cao de cap nhat');
      }
      return updated;
    } catch (e: any) {
      if (e?.code === 11000 && e?.keyPattern?.accountId) {
        throw new BadRequestException('ID tai khoan quang cao da ton tai. Vui long nhap ID khac.');
      }
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.adAccountModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException('Khong tim thay tai khoan quang cao de xoa');
    }
  }

  async validateAccountId(accountId: string): Promise<{ exists: boolean; account?: AdAccount }> {
    const normalizedVariants = Array.from(
      new Set([
        accountId,
        this.normalizeFacebookAccountId(accountId),
        this.normalizeNumericId(accountId),
      ].filter(Boolean)),
    );

    const account = await this.adAccountModel.findOne({ accountId: { $in: normalizedVariants } }).exec();
    return {
      exists: !!account,
      account: account || undefined,
    };
  }

  async getStatsByType(): Promise<any[]> {
    return this.adAccountModel.aggregate([
      {
        $group: {
          _id: '$accountType',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]).exec();
  }
}
