import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Facebook transport credential safety', () => {
  it.each([
    'ai-delivery-recovery.service.ts',
    'chat-message.controller.ts',
    'messenger-webhook.service.ts',
  ])('does not put access tokens in Graph URLs in %s', (fileName) => {
    const source = readFileSync(resolve(__dirname, fileName), 'utf8');

    expect(source).not.toMatch(
      /graph\.facebook\.com[^\r\n`'"]*access_token\s*=/i,
    );
    expect(source).toContain('Authorization: `Bearer ${');
  });
});
