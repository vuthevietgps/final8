/**
 * Google Sync Service - Simplified Version
 * DEPRECATED: Summary1 functionality replaced by Summary4 Google Sync
 * - Keeping only Google Sheets API utilities
 * - Use Summary4GoogleSyncService for new implementations
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { Quote, QuoteDocument } from '../quote/schemas/quote.schema';
import { User, UserDocument } from '../user/user.schema';

import { google, sheets_v4 } from 'googleapis';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class GoogleSyncService {
  private readonly logger = new Logger(GoogleSyncService.name);

  constructor(
    @InjectModel(TestOrder2.name) private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(Quote.name) private readonly quoteModel: Model<QuoteDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /** Debug: xem trạng thái credentials */
  async authDebugInfo(): Promise<any> {
    try {
      const auth = await this.getGoogleAuth();
      return auth ? { status: 'OK', hasAuth: true } : { status: 'No credentials', hasAuth: false };
    } catch (error) {
      return { status: 'Error', error: (error as any)?.message, hasAuth: false };
    }
  }

  /** Đảm bảo sheet tab tồn tại, nếu chưa có thì tạo */
  async ensureSheetExists(sheets: sheets_v4.Sheets, spreadsheetId: string, title: string) {
    try {
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const exists = (meta.data.sheets || []).some((s) => s.properties?.title === title);
      if (!exists) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: { title },
                },
              },
            ],
          },
        });
        this.logger.log(`Đã tạo sheet tab '${title}' trong spreadsheet ${spreadsheetId}`);
      }
    } catch (e) {
      this.logger.warn(`Không thể kiểm tra/tạo sheet '${title}': ${e}`);
    }
  }

  extractSpreadsheetId(link: string): string | null {
    if (!link) return null;
    const cleaned = decodeURIComponent(String(link)).replace(/\s+/g, ''); // loại bỏ xuống dòng/khoảng trắng
    // Dạng chuẩn: https://docs.google.com/spreadsheets/d/<id>/edit
    let m = cleaned.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (m) return m[1];
    // Dạng open?id=<id>
    m = cleaned.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (m) return m[1];
    // Fallback: lấy chuỗi dài giống id nếu có (>= 20 ký tự an toàn)
    m = cleaned.match(/([a-zA-Z0-9-_]{20,})/);
    return m ? m[1] : null;
  }

  async getGoogleAuth(): Promise<any | null> {
    try {
      const jsonInline = process.env.GOOGLE_CREDENTIALS_JSON;
      if (jsonInline) {
        const credentials = JSON.parse(jsonInline);
        const jwtClient = new google.auth.JWT({
          email: credentials.client_email,
          key: credentials.private_key,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        await jwtClient.authorize();
        this.logger.log('Google Auth: sử dụng GOOGLE_CREDENTIALS_JSON (JWT)');
        return jwtClient;
      }

  // Prefer explicit env var first
  let credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const backendRootEnv = process.env.BACKEND_ROOT;
  const debugPieces: string[] = [];
  debugPieces.push(`CWD=${process.cwd()}`);
  debugPieces.push(`__dirname=${__dirname}`);
  if (credPath) debugPieces.push(`GOOGLE_APPLICATION_CREDENTIALS(raw)=${credPath}`);
  if (backendRootEnv) debugPieces.push(`BACKEND_ROOT=${backendRootEnv}`);

      // If provided as relative path, resolve from process.cwd() and also from project backend root
      if (credPath && !path.isAbsolute(credPath)) {
        const attempts: string[] = [];
        const tryPaths = [
          path.resolve(process.cwd(), credPath),
          backendRootEnv ? path.resolve(backendRootEnv, credPath) : '',
          path.resolve(__dirname, '..', '..', credPath), // dist/src -> backend
          path.resolve(__dirname, '..', '..', '..', credPath), // extra fallback
        ].filter(Boolean) as string[];
        for (const p of tryPaths) {
          attempts.push(p);
          if (fs.existsSync(p)) {
            credPath = p;
            break;
          }
        }
        debugPieces.push(`rel attempts=${attempts.join(' | ')}`);
      }

      if (credPath && fs.existsSync(credPath)) {
        // Use JWT directly to avoid deprecated keyFilename/fromJSON paths
        const raw = fs.readFileSync(credPath, 'utf8');
        const credentials = JSON.parse(raw);
        const jwtClient = new google.auth.JWT({
          email: credentials.client_email,
          key: credentials.private_key,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        await jwtClient.authorize();
        this.logger.log(`Google Auth: sử dụng GOOGLE_APPLICATION_CREDENTIALS (JWT) -> ${credPath}`);
        return jwtClient;
      }

      // Fallback discovery: common locations
      const candidates = [
        path.resolve(process.cwd(), 'dongbodulieuweb-8de0c9a12896.json'),
        path.resolve(process.cwd(), 'backend', 'dongbodulieuweb-8de0c9a12896.json'),
        backendRootEnv ? path.resolve(backendRootEnv, 'dongbodulieuweb-8de0c9a12896.json') : '',
        path.resolve(__dirname, '..', '..', 'dongbodulieuweb-8de0c9a12896.json'),
        path.resolve(__dirname, '..', '..', '..', 'dongbodulieuweb-8de0c9a12896.json'),
        'D:\\code\\final2\\backend\\dongbodulieuweb-8de0c9a12896.json',
      ].filter(Boolean);
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          // Fallback: read file and construct JWT directly
          const raw = fs.readFileSync(p, 'utf8');
          const credentials = JSON.parse(raw);
          const jwtClient = new google.auth.JWT({
            email: credentials.client_email,
            key: credentials.private_key,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          });
          await jwtClient.authorize();
          this.logger.log(`Google Auth: fallback JWT credentials loaded from ${p}`);
          return jwtClient;
        }
      }

      this.logger.warn('Không tìm thấy Google credentials (GOOGLE_CREDENTIALS_JSON hoặc GOOGLE_APPLICATION_CREDENTIALS)');
      this.logger.warn(`Auth debug: ${debugPieces.join(' | ')}`);
      return null;
    } catch (error) {
      this.logger.error('Lỗi Google Auth:', error);
      return null;
    }
  }
}