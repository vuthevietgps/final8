import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { decryptToken, encryptToken } from '../api-token/crypto.util';
import { Fanpage, FanpageDocument } from '../fanpage/schemas/fanpage.schema';
import { SaveProviderConnectionDto } from './provider-connection.dto';
import { ProviderConnection, ProviderConnectionDocument } from './provider-connection.schema';
import { ProviderDiscoveryService } from './provider-discovery.service';

@Injectable()
export class ProviderConnectionsService {
  constructor(
    @InjectModel(ProviderConnection.name) private readonly model: Model<ProviderConnectionDocument>,
    @InjectModel(Fanpage.name) private readonly fanpages: Model<FanpageDocument>,
    private readonly discovery: ProviderDiscoveryService,
  ) {}

  configurationStatus() {
    const preview = process.env.ERP_LOCAL_SANDBOX === 'true';
    const key = process.env.API_TOKEN_SECRET?.trim();
    return { storageEnabled: !preview && Boolean(key && key.length >= 32 && key !== 'DEV_TOKEN_SECRET'),
      reason: preview ? 'PREVIEW_EPHEMERAL_VAULT' : key && key.length >= 32 && key !== 'DEV_TOKEN_SECRET' ? 'READY' : 'VAULT_KEY_REQUIRED' };
  }

  async list() {
    const rows = await this.model.find().sort({ createdAt: -1 }).limit(200).lean();
    return rows.map(row => this.present(row));
  }

  async pageOptions() {
    const rows = await this.fanpages.find({}, { pageId: 1, name: 1 }).sort({ name: 1 }).limit(500).lean();
    return rows.map(row => ({ pageId: row.pageId, name: row.name }));
  }

  async save(id: string | undefined, dto: SaveProviderConnectionDto, actor: string) {
    this.assertVaultKey();
    this.assertShape(dto);
    const old = id ? await this.load(id, true) : undefined;
    if (old && (old.revision !== dto.revision || old.kind !== dto.kind)) {
      throw new ConflictException('Cấu hình đã thay đổi. Tải lại trước khi lưu.');
    }
    if (!old && dto.revision !== 0) throw new ConflictException('Kết nối mới phải có revision=0.');
    if (dto.kind === 'bird-messenger' && !await this.fanpages.exists({ pageId: dto.pageId })) {
      throw new BadRequestException('Fanpage chưa có trong ERP. Thêm Fanpage trước khi liên kết Bird.');
    }
    const previousSecrets = old ? this.decode(old.secretsEnc) : undefined;
    if (!old && !dto.apiKey) throw new BadRequestException('Nhập API key cho kết nối mới.');
    if (old && old.birdApi !== dto.birdApi && (!dto.apiKey || !dto.signingSecret)) {
      throw new BadRequestException('Đổi phiên bản Bird cần nhập lại API key và signing secret.');
    }
    const secrets = {
      apiKey: dto.apiKey || previousSecrets?.apiKey,
      signingSecret: dto.signingSecret || previousSecrets?.signingSecret,
    };
    const revision = dto.revision + 1;
    const values = {
      kind: dto.kind, name: dto.name.trim(), revision, state: dto.state,
      scope: dto.kind === 'bird-messenger' ? dto.pageId : dto.kind,
      accountIds: dto.accountIds, birdApi: dto.birdApi, workspaceId: dto.workspaceId,
      channelId: dto.channelId, pageId: dto.pageId,
      hasSigningSecret: Boolean(secrets.signingSecret), secretsEnc: encryptToken(JSON.stringify(secrets)),
    };
    const audit = { actor: String(actor), at: new Date(), revision, operation: old ? 'updated' : 'created' };
    try {
      if (!old) return this.present(await this.model.create({ ...values, audit: [audit] }));
      const result = await this.model.findOneAndUpdate({ _id: id, revision: dto.revision }, {
        $set: values, $unset: { check: 1, checkedAt: 1, checkedRevision: 1, lastCheckStartedAt: 1,
          syncLeaseUntil: 1, lastReadSyncAt: 1, lastReadSyncStatus: 1, lastReadSyncRunId: 1 },
        $push: { audit: { $each: [audit], $slice: -50 } },
      }, { new: true, runValidators: true });
      if (!result) throw new ConflictException('Cấu hình đã thay đổi. Tải lại trước khi lưu.');
      return this.present(result);
    } catch (error) {
      if ((error as any)?.code === 11000) throw new ConflictException('Đã có kết nối cho nguồn hoặc Fanpage này. Sửa kết nối hiện có.');
      // Database errors may embed the update containing encrypted or sensitive data.
      if (error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException('Không lưu được kết nối.');
    }
  }

  async getVerifiedWindsorReadAccess(id: string) {
    this.assertVaultKey();
    const row = await this.load(id, true);
    if (row.kind !== 'windsor-google') throw new BadRequestException('Kết nối này không phải Windsor Google Ads.');
    if (row.state !== 'configured') throw new BadRequestException('Kết nối đang tắt.');
    if (!row.accountIds?.length) throw new BadRequestException('Chưa chọn tài khoản Google Ads để đồng bộ.');
    if (row.checkedRevision !== row.revision || row.check?.readAccessConfirmed !== true) {
      throw new BadRequestException('Cần kiểm tra quyền truy cập thành công sau lần sửa cấu hình gần nhất.');
    }
    return {
      id: String(row._id), revision: Number(row.revision),
      accountIds: [...row.accountIds], apiKey: this.decode(row.secretsEnc).apiKey,
    };
  }

  async check(id: string, actor: string) {
    this.assertVaultKey();
    const row = await this.load(id, true);
    if (row.state === 'disabled') throw new BadRequestException('Kết nối đang tắt.');
    const now = new Date();
    // Persistent cooldown also prevents simultaneous checks across backend replicas.
    const acquired = await this.model.findOneAndUpdate({
      _id: id, revision: row.revision, state: 'configured',
      $or: [{ lastCheckStartedAt: { $exists: false } }, { lastCheckStartedAt: { $lte: new Date(now.getTime() - 60_000) } }],
    }, { $set: { lastCheckStartedAt: now } }, { new: true });
    if (!acquired) throw new ConflictException('Kết nối vừa thay đổi hoặc vừa được kiểm tra. Chờ một phút rồi thử lại.');
    const secrets = this.decode(row.secretsEnc);
    const check = await this.discovery.inspect(row, secrets.apiKey);
    const result = await this.model.findOneAndUpdate({ _id: id, revision: row.revision, state: 'configured' }, {
      $set: { check, checkedAt: new Date(), checkedRevision: row.revision },
      $push: { audit: { $each: [{ actor: String(actor), at: now, operation: 'checked', revision: row.revision }], $slice: -50 } },
    }, { new: true });
    if (!result) throw new ConflictException('Cấu hình thay đổi trong lúc kiểm tra. Kết quả cũ đã bị bỏ.');
    return this.present(result);
  }

  private async load(id: string, withSecret = false): Promise<any> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID kết nối không hợp lệ.');
    const query = this.model.findById(id);
    if (withSecret) query.select('+secretsEnc');
    const row = await query.lean();
    if (!row) throw new NotFoundException('Không tìm thấy kết nối.');
    return row;
  }

  private assertVaultKey() {
    if (process.env.ERP_LOCAL_SANDBOX === 'true') {
      throw new ServiceUnavailableException('Bản xem thử dùng khóa mã hóa tạm thời. Cấu hình kết nối trên backend có khóa mã hóa bền vững.');
    }
    const key = process.env.API_TOKEN_SECRET?.trim();
    if (!key || key.length < 32 || key === 'DEV_TOKEN_SECRET') {
      throw new ServiceUnavailableException('Cần cấu hình API_TOKEN_SECRET riêng, ít nhất 32 ký tự, trên backend trước khi lưu key nhà cung cấp.');
    }
  }

  private decode(ciphertext: string): { apiKey: string; signingSecret?: string } {
    try {
      const decoded = JSON.parse(decryptToken(ciphertext) || 'null');
      if (!decoded || typeof decoded.apiKey !== 'string' || !decoded.apiKey) throw new Error();
      return decoded;
    } catch { throw new ServiceUnavailableException('Không giải mã được kết nối. Kiểm tra khóa mã hóa của backend.'); }
  }

  private assertShape(dto: SaveProviderConnectionDto) {
    if (dto.kind !== 'bird-messenger') {
      if (dto.birdApi || dto.workspaceId || dto.channelId || dto.pageId || dto.signingSecret) {
        throw new BadRequestException('Cấu hình Windsor không nhận trường Bird.');
      }
      return;
    }
    if (dto.accountIds.length || !dto.birdApi || !dto.channelId || !dto.pageId) {
      throw new BadRequestException('Bird cần phiên bản API, channel và Fanpage; không nhận tài khoản ads.');
    }
    const uuid = /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/;
    if (dto.birdApi === 'bird-v1' && (!uuid.test(dto.workspaceId || '') || !uuid.test(dto.channelId))) {
      throw new BadRequestException('Bird API mới cần workspace ID và channel ID dạng UUID.');
    }
    if (dto.birdApi === 'messagebird-v1' && (dto.workspaceId || !/^[a-fA-F0-9]{32}$/.test(dto.channelId))) {
      throw new BadRequestException('MessageBird Conversations v1 cần channel ID 32 ký tự hex và không dùng workspace ID.');
    }
  }

  private present(row: any) {
    // Explicit allowlist: never spread documents containing credentials or provider responses.
    return {
      id: String(row._id), kind: row.kind, name: row.name, revision: row.revision,
      state: row.state, accountIds: row.accountIds || [], birdApi: row.birdApi,
      workspaceId: row.workspaceId, channelId: row.channelId, pageId: row.pageId,
      hasApiKey: true, hasSigningSecret: row.hasSigningSecret === true,
      checkedAt: row.checkedAt, check: row.checkedRevision === row.revision ? row.check : undefined,
      lastReadSyncAt: row.lastReadSyncAt, lastReadSyncStatus: row.lastReadSyncStatus,
      lastReadSyncRunId: row.lastReadSyncRunId,
      liveWriteEnabled: false, messagingEnabled: false,
    };
  }
}
