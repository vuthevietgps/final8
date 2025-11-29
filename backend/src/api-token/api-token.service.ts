/**
 * Service: ApiTokenService
 * Chức năng: Quản lý vòng đời ApiToken (CRUD + validate + setPrimary + rotate).
 * Refactor: Thêm strategy validate để dễ mở rộng provider (facebook, zalo,...).
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiToken, ApiTokenDocument } from './schemas/api-token.schema';
import { ApiTokenAudit, ApiTokenAuditDocument } from './schemas/api-token-audit.schema';
import { Fanpage, FanpageDocument } from '../fanpage/schemas/fanpage.schema';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { UpdateApiTokenDto } from './dto/update-api-token.dto';
import { RotateTokenDto, SetPrimaryTokenDto, ValidateTokenDto } from './dto/token-actions.dto';
import { encryptToken, hashToken, decryptToken } from './crypto.util';

// ---------------- Provider Validation Strategies ----------------
// Interface đơn giản cho các strategy
interface TokenValidationResult { status: 'valid'|'invalid'|'expired'; message: string; scopes?: string[]; expireAt?: Date; }
interface ProviderValidator { validate(rawToken: string): Promise<TokenValidationResult>; }

class FacebookValidator implements ProviderValidator {
  async validate(rawToken: string): Promise<TokenValidationResult> {
    try {
      // Validate token by calling Facebook Graph API
      const response = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${encodeURIComponent(rawToken)}`);
      const data = await response.json();
      
      if (response.ok && data.id) {
        // Token is valid, get permissions
        try {
          const permResponse = await fetch(`https://graph.facebook.com/me/permissions?access_token=${encodeURIComponent(rawToken)}`);
          const permData = await permResponse.json();
          const scopes = permResponse.ok && permData.data ? 
            permData.data.filter((p: any) => p.status === 'granted').map((p: any) => p.permission) : [];
          
          return { 
            status: 'valid', 
            message: `Token hợp lệ cho ${data.name || data.id}`, 
            scopes 
          };
        } catch {
          return { 
            status: 'valid', 
            message: `Token hợp lệ cho ${data.name || data.id}`, 
            scopes: [] 
          };
        }
      } else if (data.error) {
        const errorCode = data.error.code;
        const errorMessage = data.error.message;
        
        if (errorCode === 190) {
          return { status: 'expired', message: `Token hết hạn: ${errorMessage}` };
        } else if (errorCode === 102 || errorCode === 2500) {
          return { status: 'invalid', message: `Token không hợp lệ: ${errorMessage}` };
        } else {
          return { status: 'invalid', message: `Lỗi Facebook API: ${errorMessage}` };
        }
      } else {
        return { status: 'invalid', message: 'Token không hợp lệ - không nhận được phản hồi từ Facebook' };
      }
    } catch (error) {
      return { 
        status: 'invalid', 
        message: `Lỗi kết nối Facebook API: ${error instanceof Error ? error.message : 'Unknown error'}` 
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
          message: `Zalo token hợp lệ cho ${data.name || data.id}`, 
          scopes: [] 
        };
      } else if (data.error) {
        return { status: 'invalid', message: `Zalo API error: ${data.error.message || data.error}` };
      } else {
        return { status: 'invalid', message: 'Zalo token không hợp lệ' };
      }
    } catch (error) {
      return { 
        status: 'invalid', 
        message: `Lỗi kết nối Zalo API: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}
class OtherValidator implements ProviderValidator {
  async validate(rawToken: string): Promise<TokenValidationResult> {
    // For 'other' provider, do basic format check only
    if (!rawToken || rawToken.length < 10) {
      return { status: 'invalid', message: 'Token quá ngắn hoặc không hợp lệ' };
    }
    
    // Could implement specific validation logic for other providers here
    return { 
      status: 'valid', 
      message: 'Token được chấp nhận (chưa xác thực với provider)', 
      scopes: [] 
    };
  }
}

function buildValidator(provider: string): ProviderValidator {
  switch(provider){
    case 'facebook': return new FacebookValidator();
    case 'zalo': return new ZaloValidator();
    default: return new OtherValidator();
  }
}

@Injectable()
export class ApiTokenService {
  constructor(
  @InjectModel(ApiToken.name) private model: Model<ApiTokenDocument>,
  @InjectModel(ApiTokenAudit.name) private auditModel: Model<ApiTokenAuditDocument>,
    @InjectModel(Fanpage.name) private fanpageModel: Model<FanpageDocument>
  ) {}

  // Ẩn trường nhạy cảm trước khi trả về cho client
  private sanitize(doc: any){
    if(!doc) return doc;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    delete obj.token;
    delete obj.tokenEnc;
    delete obj.tokenHash;
    return obj;
  }

  async create(dto: CreateApiTokenDto) {
    const tokenHash = hashToken(dto.token);
    const tokenEnc = encryptToken(dto.token);
    const doc = new this.model({ ...dto, token: dto.token, tokenEnc, tokenHash });
    await doc.save();
    await this.audit('create', doc._id, undefined, { _id: doc._id, name: doc.name });
    return this.sanitize(doc);
  }
  async findAll(filter: any = {}) { const items = await this.model.find(filter).sort({ createdAt: -1 }).lean(); return items.map(i => this.sanitize(i)); }
  async findOne(id: string) { const doc = await this.model.findById(id).lean(); if (!doc) throw new NotFoundException('Token không tồn tại'); return this.sanitize(doc) as any; }
  async update(id: string, dto: UpdateApiTokenDto) { const doc = await this.model.findByIdAndUpdate(id, dto, { new: true }); if (!doc) throw new NotFoundException('Token không tồn tại'); return this.sanitize(doc) as any; }
  async remove(id: string) { const res = await this.model.findByIdAndDelete(id); if (!res) throw new NotFoundException('Token không tồn tại'); }

  /** Validate token thông qua strategy theo provider */
  async validate(id: string, _dto: ValidateTokenDto) {
  const token = await this.model.findById(id);
  if(!token) throw new NotFoundException('Token không tồn tại');
  const validator = buildValidator(token.provider);
  const raw = token.tokenEnc ? decryptToken(token.tokenEnc) : token.token;
  const result = await validator.validate(raw || token.token);
  token.lastCheckedAt = new Date();
  token.lastCheckStatus = result.status;
  token.lastCheckMessage = result.message;
  if(result.status==='valid') token.consecutiveFail = 0; else token.consecutiveFail = (token.consecutiveFail||0)+1;
    if(result.scopes) token.scopes = result.scopes;
    if(result.expireAt) token.expireAt = result.expireAt;
  // Random 27-30 minutes for next check
  const minMs = 27 * 60 * 1000;
    const maxMs = 30 * 60 * 1000;
    const delta = Math.floor(minMs + Math.random() * (maxMs - minMs));
    token.nextCheckAt = new Date(Date.now() + delta);
    await token.save();
    await this.audit('validate', token._id, undefined, { status: token.lastCheckStatus });
    return this.sanitize(token);
  }

  /**
   * Đặt token làm primary cho fanpage (bỏ primary cũ)
   */
  async setPrimary(id: string, dto: SetPrimaryTokenDto) {
    const token = await this.model.findById(id);
    if(!token) throw new NotFoundException('Token không tồn tại');
    if(!token.fanpageId || token.fanpageId.toString() !== dto.fanpageId) {
      throw new BadRequestException('Token không thuộc fanpageId cung cấp');
    }
    await this.model.updateMany({ fanpageId: dto.fanpageId, isPrimary: true }, { $set: { isPrimary: false } });
    token.isPrimary = true;
    await token.save();
    await this.audit('setPrimary', token._id, undefined, { fanpageId: dto.fanpageId });
    return this.sanitize(token);
  }

  /**
   * Rotate: tạo token mới dựa trên token hiện tại, gắn quan hệ rotatedFrom/rotatedTo
   */
  async rotate(id: string, dto: RotateTokenDto) {
    const current = await this.model.findById(id);
    if(!current) throw new NotFoundException('Token không tồn tại');
    if(!dto.newToken?.trim()) throw new BadRequestException('newToken rỗng');
    const newHash = hashToken(dto.newToken.trim());
    const newEnc = encryptToken(dto.newToken.trim());
    const newDoc = new this.model({
      name: current.name + ' (rotated)',
      token: dto.newToken.trim(),
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
   * Đồng bộ accessToken có trong collection Fanpage -> ApiToken (chỉ tạo mới nếu chưa tồn tại token cùng fanpageId & provider)
   */
  async syncFromFanpages() {
    const fanpages = await this.fanpageModel.find({ accessToken: { $exists: true, $ne: '' } }).lean();
    const created: any[] = [];
    for(const fp of fanpages){
      const existed = await this.model.findOne({ fanpageId: fp._id, provider: 'facebook', rotatedFrom: { $exists: false } });
      if(existed) continue;
      const tokenHash = hashToken(fp.accessToken);
      const tokenEnc = encryptToken(fp.accessToken);
      const doc = new this.model({
        name: fp.name,
        token: fp.accessToken,
        tokenEnc,
        tokenHash,
        provider: 'facebook',
        status: fp.status || 'active',
        fanpageId: fp._id,
        notes: 'Imported from fanpage.accessToken',
        isPrimary: true
      });
      await doc.save();
      // Validate immediately to populate status/nextCheckAt
      try { await this.validate(doc._id.toString(), { force: true }); } catch {}
      created.push(this.sanitize(doc));
      await this.audit('syncImport', doc._id, undefined, { fanpageId: fp._id });
    }
    return { imported: created.length, items: created };
  }

  /** Audit helper */
  private async audit(action: string, tokenId: any, prev?: any, next?: any, meta?: any){
    try { await this.auditModel.create({ action, tokenId, prev, next, meta }); } catch {}
  }

  /** Resolve token cho chatbot sử dụng (primary trước, fallback nếu degraded/invalid) */
  async resolveForFanpage(fanpageId: string, provider: string = 'facebook') {
    let primary = await this.model.findOne({ fanpageId, provider, isPrimary: true }).lean();
    if(primary && primary.lastCheckStatus === 'valid') return { token: this.sanitize(primary), fallback: false } as any;
    // fallback tìm token hợp lệ khác
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

  /** INTERNAL ONLY: Lấy raw access_token dùng nội bộ server để gọi Graph API (không trả qua HTTP) */
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
      }).sort({ isPrimary: -1, lastCheckedAt: -1, updatedAt: -1 }).lean();
    }
    if (!pick) {
      pick = await this.model.findOne({ fanpageId, provider, status: 'active', lastCheckStatus: 'valid' })
        .sort({ isPrimary: -1, lastCheckedAt: -1, updatedAt: -1 }).lean();
    }
    if (!pick) return undefined;
    try {
      const raw = pick.tokenEnc ? decryptToken(pick.tokenEnc) : (pick as any).token;
      return raw || undefined;
    } catch {
      return (pick as any).token || undefined;
    }
  }

  /** INTERNAL: Lấy token Facebook có scope ads_management, ưu tiên token gắn với adAccountId (nếu cung cấp) */
  async getRawAccessTokenForAdsManagement(adAccountId?: string): Promise<string | undefined> {
    const normalize = (v?: string) => {
      if (!v) return undefined;
      const m = String(v).trim().match(/^(?:act_)?(\d+)$/i);
      return m ? `act_${m[1]}` : v.trim();
    };
    const want = normalize(adAccountId);

    // 1) Ưu tiên token đã khai báo adAccountId trùng khớp và hợp lệ
    if (want) {
      const pick = await this.model.findOne({
        provider: 'facebook', status: 'active', lastCheckStatus: 'valid',
        scopes: { $in: ['ads_management'] }, adAccountId: want
      }).sort({ isPrimary: -1, lastCheckedAt: -1, updatedAt: -1 }).lean();
      if (pick) {
        try{ return pick.tokenEnc ? decryptToken(pick.tokenEnc) : (pick as any).token; } catch { return (pick as any).token; }
      }
    }

    // 2) Fallback: bất kỳ token facebook hợp lệ có ads_management
    const anyTok = await this.model.findOne({
      provider: 'facebook', status: 'active', lastCheckStatus: 'valid',
      scopes: { $in: ['ads_management'] }
    }).sort({ isPrimary: -1, lastCheckedAt: -1, updatedAt: -1 }).lean();
    if (anyTok) {
      try{ return anyTok.tokenEnc ? decryptToken(anyTok.tokenEnc) : (anyTok as any).token; } catch { return (anyTok as any).token; }
    }
    return undefined;
  }

  /** Kiểm tra token có truy cập được tài khoản quảng cáo Facebook không */
  async testAdAccountAccess(id: string, adAccountId: string) {
    const tokenDoc = await this.model.findById(id);
    if(!tokenDoc) throw new NotFoundException('Token không tồn tại');
    const raw = tokenDoc.tokenEnc ? decryptToken(tokenDoc.tokenEnc) : tokenDoc.token;
    if(!raw) throw new BadRequestException('Không đọc được access token');

    // Chuẩn hóa định danh ad account: phải có tiền tố act_
    const node = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(node)}`;
    const params = new URLSearchParams({
      fields: 'id,name,account_status,owner,business,spend_cap,age,capabilities',
      access_token: raw
    });
    const res = await fetch(`${url}?${params.toString()}`);
    const data = await res.json();
    if(res.ok && data?.id){
      const scopeOk = Array.isArray((tokenDoc as any).scopes) ? (tokenDoc as any).scopes.includes('ads_management') : false;
      // Ghi nhận ad account vào token để hiển thị về sau
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
        message: scopeOk ? 'Có quyền ads_management và truy cập được tài khoản' : 'Truy cập được tài khoản, nhưng scope ads_management chưa được ghi nhận trong token. Vẫn có thể hợp lệ nếu token thực sự có quyền.'
      };
    }
    return {
      ok: false,
      error: data?.error?.message || 'Không truy cập được tài khoản',
      code: data?.error?.code
    };
  }
}
