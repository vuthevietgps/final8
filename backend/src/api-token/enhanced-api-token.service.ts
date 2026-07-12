/**
 * Enhanced API Token Service with Auto-Recovery
 * Supports token rotation and auto-refresh capabilities
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiToken, ApiTokenDocument } from './schemas/api-token.schema';
import { Fanpage, FanpageDocument } from '../fanpage/schemas/fanpage.schema';
import fetch from 'node-fetch';
import { decryptToken, encryptToken, hashToken } from './crypto.util';
import { redactSecretString } from '../common/utils/secret-redaction.util';

@Injectable()
export class EnhancedApiTokenService {
  private readonly logger = new Logger(EnhancedApiTokenService.name);

  constructor(
    @InjectModel(ApiToken.name) private tokenModel: Model<ApiTokenDocument>,
    @InjectModel(Fanpage.name) private fanpageModel: Model<FanpageDocument>,
  ) {}

  private getRawToken(token?: Partial<ApiTokenDocument> | null): string | undefined {
    if (!token) return undefined;
    if (token.tokenEnc) {
      const decrypted = decryptToken(token.tokenEnc);
      if (decrypted) return decrypted;
    }
    // Legacy read compatibility only. All writes below remove this field.
    return token.token;
  }

  /**
   * Enhanced token validation with auto-recovery
   */
  async validateWithRecovery(tokenId: string): Promise<any> {
    const token = await this.tokenModel.findById(tokenId).select('+token');
    if (!token) throw new Error('Token not found');

    // Try validate current token
    const rawToken = this.getRawToken(token);
    if (!rawToken) throw new Error('Token value is unavailable');
    const validationResult = await this.validateFacebookToken(rawToken);
    
    if (validationResult.isValid) {
      // Token is still valid
      await this.tokenModel.findByIdAndUpdate(tokenId, {
        lastCheckStatus: 'valid',
        lastCheckMessage: validationResult.message,
        lastCheckedAt: new Date(),
        consecutiveFail: 0,
        nextCheckAt: this.calculateNextCheck()
      });
      return { status: 'valid', message: validationResult.message };
    }

    // Token is invalid/expired - try recovery methods
    this.logger.warn(`Token ${tokenId} is invalid, attempting recovery...`);
    
    // Method 1: Try to refresh using Facebook refresh token flow
    const refreshResult = await this.attemptTokenRefresh(token);
    if (refreshResult.success) {
      return { status: 'recovered', message: 'Token refreshed successfully' };
    }

    // Method 2: Check for backup tokens
    const backupResult = await this.activateBackupToken(String(token.fanpageId));
    if (backupResult.success) {
      return {
        status: 'failover',
        message: 'Switched to backup token',
        activeTokenId: backupResult.tokenId,
      };
    }

    // Method 3: Send notification for manual intervention
    await this.notifyTokenExpiry(token);

    // Update token status as expired
    await this.tokenModel.findByIdAndUpdate(tokenId, {
      lastCheckStatus: 'expired',
      lastCheckMessage: 'Token expired - manual intervention required',
      lastCheckedAt: new Date(),
      consecutiveFail: token.consecutiveFail + 1,
      nextCheckAt: this.calculateNextCheck(true) // Longer interval for failed tokens
    });

    return { 
      status: 'expired', 
      message: 'Token expired - please refresh manually',
      recoveryMethods: ['manual_refresh', 'oauth_reconnect']
    };
  }

  /**
   * Attempt to refresh token using Facebook refresh token flow
   */
  private async attemptTokenRefresh(token: ApiTokenDocument): Promise<{success: boolean, token?: string}> {
    try {
      // This would require storing refresh_token during initial OAuth
      // For now, we'll simulate the process
      
      // In real implementation:
      // 1. Use stored refresh_token
      // 2. Call Facebook token refresh endpoint
      // 3. Get new access_token
      // 4. Update database with new token
      
      this.logger.log('Token refresh not implemented yet - requires OAuth integration');
      return { success: false };
    } catch (error) {
      this.logger.error(`Token refresh failed: ${redactSecretString(error?.message || String(error))}`);
      return { success: false };
    }
  }

  /**
   * Activate backup token for the same fanpage
   */
  private async activateBackupToken(fanpageId: string): Promise<{success: boolean, tokenId?: string}> {
    try {
      // Find another valid token for the same fanpage
      const backupTokens = await this.tokenModel.find({
        fanpageId,
        status: 'active',
        lastCheckStatus: { $in: ['valid', 'unknown'] },
        _id: { $ne: fanpageId } // Exclude current token
      }).select('+token').sort({ lastCheckedAt: -1 });

      if (backupTokens.length > 0) {
        const backupToken = backupTokens[0];
        
        // Validate backup token
        const backupRawToken = this.getRawToken(backupToken);
        if (!backupRawToken) return { success: false };
        const validation = await this.validateFacebookToken(backupRawToken);
        if (validation.isValid) {
          // Set backup as primary
          await this.tokenModel.findByIdAndUpdate(backupToken._id, { isPrimary: true });
          
          // Update fanpage to use backup token
          await this.fanpageModel.findByIdAndUpdate(fanpageId, {
            $set: { hasAccessToken: true },
            $unset: { accessToken: 1 },
          });

          this.logger.log(`Activated backup token for fanpage ${fanpageId}`);
          return { success: true, tokenId: String(backupToken._id) };
        }
      }

      return { success: false };
    } catch (error) {
      this.logger.error(`Backup token activation failed: ${redactSecretString(error?.message || String(error))}`);
      return { success: false };
    }
  }

  /**
   * Send notification about token expiry
   */
  private async notifyTokenExpiry(token: ApiTokenDocument): Promise<void> {
    try {
      // Get fanpage info
      const fanpage = await this.fanpageModel.findById(String(token.fanpageId));
      
      // In a real system, you would:
      // 1. Send email notification to admins
      // 2. Create in-app notification
      // 3. Send Slack/Teams message
      // 4. Log to monitoring system
      
      this.logger.warn(`TOKEN EXPIRY NOTIFICATION: Fanpage "${fanpage?.name}" token expired. Manual refresh required.`);
      
      // Create notification record (if you have notifications system)
      // await this.notificationService.create({
      //   type: 'token_expired',
      //   title: 'Facebook Token Expired',
      //   message: `Token for fanpage "${fanpage?.name}" has expired. Please refresh manually.`,
      //   priority: 'high',
      //   recipients: ['admin@company.com']
      // });
      
    } catch (error) {
      this.logger.error(`Failed to send token expiry notification: ${redactSecretString(error?.message || String(error))}`);
    }
  }

  /**
   * Add multiple tokens for same fanpage (backup system)
   */
  async addBackupToken(fanpageId: string, token: string, notes?: string): Promise<ApiTokenDocument> {
    // Validate the backup token first
    const validation = await this.validateFacebookToken(token);
    if (!validation.isValid) {
      throw new Error('Backup token is invalid: ' + validation.message);
    }

    // Create backup token record
    const backupToken = new this.tokenModel({
      name: `Backup Token - ${new Date().toISOString()}`,
      tokenEnc: encryptToken(token),
      tokenHash: hashToken(token),
      provider: 'facebook',
      fanpageId,
      isPrimary: false, // Backup tokens are not primary
      notes: notes || 'Backup token for failover',
      status: 'active',
      lastCheckStatus: 'valid',
      lastCheckMessage: validation.message,
      lastCheckedAt: new Date(),
      nextCheckAt: this.calculateNextCheck()
    });

    return await backupToken.save();
  }

  /**
   * Manual token refresh endpoint
   */
  async refreshTokenManually(tokenId: string, newToken: string): Promise<any> {
    // Validate new token first
    const validation = await this.validateFacebookToken(newToken);
    if (!validation.isValid) {
      throw new Error('New token is invalid: ' + validation.message);
    }

    // Update token in database
    const updatedToken = await this.tokenModel.findByIdAndUpdate(
      tokenId,
      {
        $set: {
          tokenEnc: encryptToken(newToken),
          tokenHash: hashToken(newToken),
          lastCheckStatus: 'valid',
          lastCheckMessage: validation.message,
          lastCheckedAt: new Date(),
          consecutiveFail: 0,
          nextCheckAt: this.calculateNextCheck(),
        },
        $unset: { token: 1 },
      },
      { new: true },
    );

    if (!updatedToken) throw new Error('Token not found');

    // Update associated fanpage
    if (updatedToken.isPrimary) {
      await this.fanpageModel.findByIdAndUpdate(String(updatedToken.fanpageId), {
        $set: { hasAccessToken: true },
        $unset: { accessToken: 1 },
      });
    }

    this.logger.log(`Token ${tokenId} refreshed manually`);
    return updatedToken;
  }

  /**
   * Calculate next check time with jitter
   */
  private calculateNextCheck(isFailed: boolean = false): Date {
    const now = new Date();
    let minutes;
    
    if (isFailed) {
      // Failed tokens: check less frequently (1-2 hours)
      minutes = Math.floor(Math.random() * 60) + 60; // 60-120 minutes
    } else {
      // Valid tokens: normal schedule (27-30 minutes)
      minutes = Math.floor(Math.random() * 3) + 27; // 27-30 minutes
    }
    
    return new Date(now.getTime() + minutes * 60 * 1000);
  }

  /**
   * Facebook token validation (reuse from existing service)
   */
  private async validateFacebookToken(token: string): Promise<{isValid: boolean, message: string}> {
    try {
      const response = await fetch(`https://graph.facebook.com/me?access_token=${token}`);
      const data = await response.json();

      if (response.ok && data.id) {
        return {
          isValid: true,
          message: `Token hợp lệ cho ${data.name || 'Facebook User'}`
        };
      } else {
        return {
          isValid: false,
          message: data.error?.message || 'Token không hợp lệ'
        };
      }
    } catch (error) {
      return {
        isValid: false,
        message: 'Lỗi kết nối khi validate token: ' + redactSecretString(error?.message || String(error))
      };
    }
  }
}

export default EnhancedApiTokenService;
