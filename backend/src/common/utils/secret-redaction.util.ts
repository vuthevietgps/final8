const REDACTED = '[REDACTED]';
const SECRET_KEYS = new Set([
  'authorization',
  'password',
  'secret',
  'token',
  'apikey',
  'clientsecret',
  'developertoken',
  'refreshtoken',
  'accesstoken',
  'tokenenc',
  'tokenhash',
  'apikeyenc',
  'providerconfigenc',
]);

function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key.replace(/[_-]/g, '').toLowerCase());
}

export function maskSecret(value?: string, prefixLength = 4, suffixLength = 4): string | undefined {
  if (!value) return undefined;
  if (value.length <= prefixLength + suffixLength) return REDACTED;
  return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`;
}

export function redactSecretString(value: string): string {
  return value
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s:@]+:[^@\s/]+@/gi, `$1${REDACTED}@`)
    .replace(
      /((?:access[_-]?token|refresh[_-]?token|developer[_-]?token|client[_-]?secret|api[_-]?key|authorization)=)(?:Bearer\s+)?[^&\s,;]+/gi,
      `$1${REDACTED}`,
    )
    .replace(/Bearer\s+[^\s,;]+/gi, `Bearer ${REDACTED}`)
    .replace(
      /("?)(access[_-]?token|refresh[_-]?token|developer[_-]?token|client[_-]?secret|api[_-]?key|authorization)\1(\s*:\s*")([^"]+)(")/gi,
      `$1$2$1$3${REDACTED}$5`,
    );
}

export function redactSecrets<T>(value: T, seen = new WeakSet<object>()): T {
  if (typeof value === 'string') return redactSecretString(value) as T;
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;
  if (seen.has(value as object)) return REDACTED as T;
  seen.add(value as object);

  if (Array.isArray(value)) {
    const result = value.map((item) => redactSecrets(item, seen)) as T;
    seen.delete(value as object);
    return result;
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSecretKey(key) ? REDACTED : redactSecrets(item, seen);
  }
  seen.delete(value as object);
  return result as T;
}

export { REDACTED };
