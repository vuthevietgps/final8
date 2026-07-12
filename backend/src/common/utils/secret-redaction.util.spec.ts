import { maskSecret, redactSecrets, REDACTED } from './secret-redaction.util';

describe('secret redaction', () => {
  it('masks short secrets without returning plaintext', () => {
    expect(maskSecret('short')).toBe(REDACTED);
    expect(maskSecret('abcdefghijklmnop')).toBe('abcd...mnop');
  });

  it('redacts nested secret fields and bearer tokens', () => {
    const result = redactSecrets({
      refreshToken: 'refresh-plain',
      nested: {
        developer_token: 'developer-plain',
        error: 'request failed with Authorization=Bearer abc123',
      },
      safe: 'visible',
    });

    expect(result).toEqual({
      refreshToken: REDACTED,
      nested: {
        developer_token: REDACTED,
        error: `request failed with Authorization=${REDACTED}`,
      },
      safe: 'visible',
    });
  });

  it('redacts credentials embedded in connection strings', () => {
    expect(redactSecrets('mongodb://user:password@example.test/db')).toBe(
      `mongodb://${REDACTED}@example.test/db`,
    );
  });

  it('preserves repeated non-secret object references while still breaking cycles', () => {
    const shared = { entityId: 'P_SCALE', blockers: ['source_ready'] };
    const circular: any = { id: 'loop' };
    circular.self = circular;

    const result = redactSecrets({
      first: shared,
      second: shared,
      circular,
    });

    expect(result).toEqual({
      first: { entityId: 'P_SCALE', blockers: ['source_ready'] },
      second: { entityId: 'P_SCALE', blockers: ['source_ready'] },
      circular: {
        id: 'loop',
        self: REDACTED,
      },
    });
  });
});
