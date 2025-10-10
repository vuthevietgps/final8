/**
 * File: facebook-token/facebook-token.service.ts
 * Mục đích: Service quản lý Facebook Access Tokens
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FacebookToken, FacebookTokenDocument } from './schemas/facebook-token.schema';
import { CreateFacebookTokenDto } from './dto/create-facebook-token.dto';
import { UpdateFacebookTokenDto } from './dto/update-facebook-token.dto';
import * as crypto from 'crypto';

@Injectable()
export class FacebookTokenService {
  private readonly encryptionKey = process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY || 'default-key-change-in-production';

  constructor(
    @InjectModel(FacebookToken.name)
    private readonly facebookTokenModel: Model<FacebookTokenDocument>,
  ) {}

  /**
   * Encrypt access token trước khi lưu database
   */
  private encryptToken(token: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt access token từ database
   */
  private decryptToken(encryptedToken: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      
      const [ivHex, encrypted] = encryptedToken.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      
      const decipher = crypto.createDecipher(algorithm, key);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new BadRequestException('Invalid encrypted token');
    }
  }

  async create(dto: CreateFacebookTokenDto): Promise<FacebookToken> {
    // Nếu đây là token default đầu tiên, set isDefault = true
    if (dto.isDefault || await this.shouldSetAsDefault()) {
      await this.clearDefaultFlags();
    }

    // Encrypt access token
    const encryptedToken = this.encryptToken(dto.accessToken);

    const token = new this.facebookTokenModel({
      ...dto,
      accessToken: encryptedToken,
      isDefault: dto.isDefault || await this.shouldSetAsDefault(),
    });

    return token.save();
  }

  async findAll(): Promise<FacebookToken[]> {
    const tokens = await this.facebookTokenModel
      .find()
      .select('-accessToken') // Không trả về token để bảo mật
      .sort({ isDefault: -1, createdAt: -1 })
      .exec();
    
    return tokens;
  }

  async findOne(id: string): Promise<FacebookToken> {
    const token = await this.facebookTokenModel
      .findById(id)
      .select('-accessToken')
      .exec();
    
    if (!token) {
      throw new NotFoundException('Facebook token not found');
    }
    
    return token;
  }

  async update(id: string, dto: UpdateFacebookTokenDto): Promise<FacebookToken> {
    const updateData: any = { ...dto };

    // Nếu cập nhật access token, encrypt nó
    if (dto.accessToken) {
      updateData.accessToken = this.encryptToken(dto.accessToken);
    }

    // Nếu set làm default, clear các default khác
    if (dto.isDefault) {
      await this.clearDefaultFlags();
    }

    const token = await this.facebookTokenModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .select('-accessToken')
      .exec();

    if (!token) {
      throw new NotFoundException('Facebook token not found');
    }

    return token;
  }

  async remove(id: string): Promise<void> {
    const token = await this.facebookTokenModel.findById(id);
    
    if (!token) {
      throw new NotFoundException('Facebook token not found');
    }

    // Nếu xóa token default, set token khác làm default
    if (token.isDefault) {
      await this.facebookTokenModel.findByIdAndDelete(id);
      await this.setFirstActiveAsDefault();
    } else {
      await this.facebookTokenModel.findByIdAndDelete(id);
    }
  }

  /**
   * Lấy default access token (đã decrypt)
   */
  async getDefaultToken(): Promise<string | null> {
    const token = await this.facebookTokenModel
      .findOne({ isDefault: true, isActive: true })
      .exec();

    if (!token) {
      return null;
    }

    await this.updateUsage(token._id.toString());
    return this.decryptToken(token.accessToken);
  }

  /**
   * Lấy access token theo ID (đã decrypt)
   */
  async getTokenById(id: string): Promise<string> {
    const token = await this.facebookTokenModel
      .findOne({ _id: id, isActive: true })
      .exec();

    if (!token) {
      throw new NotFoundException('Facebook token not found or inactive');
    }

    await this.updateUsage(token._id.toString());
    return this.decryptToken(token.accessToken);
  }

  /**
   * Set token làm default
   */
  async setDefault(id: string): Promise<FacebookToken> {
    await this.clearDefaultFlags();
    
    const token = await this.facebookTokenModel
      .findByIdAndUpdate(id, { isDefault: true }, { new: true })
      .select('-accessToken')
      .exec();

    if (!token) {
      throw new NotFoundException('Facebook token not found');
    }

    return token;
  }

  /**
   * Test token có hoạt động không
   */
  async testToken(id: string): Promise<{ valid: boolean; error?: string; permissions?: string[] }> {
    try {
      const token = await this.getTokenById(id);
      
      // Gọi Facebook API để test token
      const response = await fetch('https://graph.facebook.com/me?fields=id,name&access_token=' + token);
      const data = await response.json();

      if (data.error) {
        return {
          valid: false,
          error: data.error.message
        };
      }

      // Lấy permissions
      const permResponse = await fetch('https://graph.facebook.com/me/permissions?access_token=' + token);
      const permData = await permResponse.json();
      
      const permissions = permData.data?.filter((p: any) => p.status === 'granted').map((p: any) => p.permission) || [];

      return {
        valid: true,
        permissions
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Helper methods
   */
  private async clearDefaultFlags(): Promise<void> {
    await this.facebookTokenModel.updateMany({}, { isDefault: false });
  }

  private async shouldSetAsDefault(): Promise<boolean> {
    const count = await this.facebookTokenModel.countDocuments({ isActive: true });
    return count === 0;
  }

  private async setFirstActiveAsDefault(): Promise<void> {
    const firstActive = await this.facebookTokenModel
      .findOne({ isActive: true })
      .sort({ createdAt: 1 });
    
    if (firstActive) {
      firstActive.isDefault = true;
      await firstActive.save();
    }
  }

  private async updateUsage(tokenId: string): Promise<void> {
    await this.facebookTokenModel.findByIdAndUpdate(tokenId, {
      $inc: { usageCount: 1 },
      lastUsedAt: new Date()
    });
  }
}