import { redactSecretString } from '../../common/utils/secret-redaction.util';

const PII_KEYS = new Set([
  'customername', 'receivername', 'phone', 'phonenumber', 'receiverphone',
  'address', 'receiveraddress', 'email', 'senderpsid',
]);
const SECRET_KEYS = new Set([
  'authorization', 'password', 'secret', 'token', 'apikey', 'clientsecret',
  'developertoken', 'refreshtoken', 'accesstoken', 'tokenenc', 'tokenhash',
  'apikeyenc', 'providerconfigenc', 'privatekey',
]);

export function redactDataPack<T>(value: T): T {
  return redactPii(value, new WeakSet<object>());
}

function redactPii<T>(value: T, seen: WeakSet<object>): T {
  if (typeof value === 'string') return redactSecretString(value) as T;
  if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;
  if (seen.has(value as object)) return '[REDACTED]' as T;
  seen.add(value as object);
  if (Array.isArray(value)) {
    const result = value.map((item) => redactPii(item, seen)) as T;
    seen.delete(value as object);
    return result;
  }
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[_-]/g, '').toLowerCase();
    result[key] = PII_KEYS.has(normalized) || SECRET_KEYS.has(normalized) ? '[REDACTED]' : redactPii(item, seen);
  }
  seen.delete(value as object);
  return result as T;
}
