import { decryptToken, encryptToken, getApiTokenSecret } from './crypto.util';

describe('api token crypto', () => {
  const previousEnv = process.env;

  afterEach(() => {
    process.env = previousEnv;
  });

  it('encrypts and decrypts without storing plaintext in the payload', () => {
    process.env = { ...previousEnv, NODE_ENV: 'test', API_TOKEN_SECRET: 'unit-test-secret' };
    const plaintext = '1//google-refresh-token';
    const encrypted = encryptToken(plaintext);

    expect(encrypted).not.toContain(plaintext);
    expect(decryptToken(encrypted)).toBe(plaintext);
  });

  it('does not allow the development fallback in production', () => {
    expect(() => getApiTokenSecret({ NODE_ENV: 'production' })).toThrow('API_TOKEN_SECRET must be set');
  });
});
