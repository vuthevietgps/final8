/**
 * Utility: crypto.util.ts
 * Chức năng: Mã hóa/giải mã và băm token để lưu an toàn.
 */
import * as crypto from 'crypto';
import { assertApiTokenSecretForProduction } from '../common/ads-safety-config';

const ALGO = 'aes-256-gcm';

export function getApiTokenSecret(env: NodeJS.ProcessEnv = process.env): string {
  assertApiTokenSecretForProduction(env);
  return env.API_TOKEN_SECRET?.trim() || 'DEV_TOKEN_SECRET';
}

function getKey(): Buffer {
  return crypto.createHash('sha256').update(getApiTokenSecret()).digest();
}

export function encryptToken(raw: string){
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('base64')+':'+tag.toString('base64')+':'+enc.toString('base64');
}
export function decryptToken(payload: string){
  try{
    const [ivB64, tagB64, dataB64] = payload.split(':');
    const iv = Buffer.from(ivB64,'base64');
    const tag = Buffer.from(tagB64,'base64');
    const data = Buffer.from(dataB64,'base64');
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    return dec;
  }catch{ return undefined; }
}
export function hashToken(raw: string){
  return crypto.createHash('sha256').update(raw).digest('hex');
}
