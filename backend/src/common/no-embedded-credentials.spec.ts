import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

describe('tracked credential safety', () => {
  it('does not keep credentialed database URIs or private keys in tracked files', () => {
    const repositoryRoot = resolve(__dirname, '../../..');
    const tracked = execFileSync('git', ['ls-files', '-z'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean);

    // Build sensitive markers in parts so this regression test does not match
    // its own source while scanning every Git-tracked text file.
    const mongoScheme = `mongo${'db'}(?:\\+srv)?`;
    const credentialedMongoUri = new RegExp(
      `${mongoScheme}:\\/\\/[^\\s/'"<>]+:[^\\s@/'"<>]+@`,
      'i',
    );
    const privateKeyMarker = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
    const escapedPrivateKeyMarker = ['-----BEGIN', 'PRIVATE KEY-----'].join('\\n');
    const violations: string[] = [];

    for (const relativePath of tracked) {
      const absolutePath = resolve(repositoryRoot, relativePath);
      if (!existsSync(absolutePath)) continue;
      const buffer = readFileSync(absolutePath);
      if (buffer.includes(0)) continue;
      const source = buffer.toString('utf8');
      if (
        credentialedMongoUri.test(source)
        || source.includes(privateKeyMarker)
        || source.includes(escapedPrivateKeyMarker)
      ) {
        violations.push(relativePath.replace(/\\/g, '/'));
      }
    }

    expect(violations).toEqual([]);
  });
});
