import { createHash } from 'crypto';
import { GoogleAdsRuntimeConfig } from '../api-token/api-token.service';

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = canonicalize((value as Record<string, unknown>)[key]);
      return result;
    }, {});
}

export function googleAdsOperationHash(operations: Array<Record<string, any>>): string {
  return sha256(canonicalize(operations));
}

/**
 * Bind validateOnly evidence to the exact effective credential/configuration
 * without persisting or returning any plaintext secret.
 */
export function googleAdsCredentialBindingHash(config: GoogleAdsRuntimeConfig): string {
  return sha256({
    clientId: config.clientId || '',
    clientSecret: config.clientSecret || '',
    refreshToken: config.refreshToken || '',
    developerToken: config.developerToken || '',
    loginCustomerId: digits(config.loginCustomerId),
    apiVersion: String(config.apiVersion || ''),
    configSource: config.configSource,
    refreshTokenSource: config.refreshTokenSource,
  });
}

function sha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function digits(value: unknown): string {
  return String(value || '').replace(/\D/g, '');
}
