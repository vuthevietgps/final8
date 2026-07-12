const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const realRoot = fs.realpathSync(root);

function isOutsideRoot(relativePath) {
  return relativePath === '..'
    || relativePath.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativePath);
}

const result = spawnSync('git', ['diff', '--check'], {
  cwd: root,
  encoding: 'utf8',
});
if (result.error) throw result.error;

const output = `${result.stdout || ''}${result.stderr || ''}`;
if (result.status !== 0 && result.status !== 2) {
  throw new Error(`git diff --check failed with exit code ${result.status}: ${output.trim()}`);
}

const targets = new Map();
const eofBlankFiles = new Set();

for (const row of output.split(/\r?\n/)) {
  const eofMatch = row.match(/^(.*?):\d+: new blank line at EOF\.$/);
  if (eofMatch) {
    eofBlankFiles.add(eofMatch[1].replace(/\\/g, '/'));
    continue;
  }
  const match = row.match(/^(.*?):(\d+): trailing whitespace\.$/);
  if (!match) continue;
  const file = match[1].replace(/\\/g, '/');
  const line = Number(match[2]);
  if (!Number.isInteger(line) || line < 1) continue;
  if (!targets.has(file)) targets.set(file, new Set());
  targets.get(file).add(line);
}

for (const file of eofBlankFiles) {
  if (!targets.has(file)) targets.set(file, new Set());
}

let changedFiles = 0;
let changedLines = 0;
for (const [relativePath, lineNumbers] of targets) {
  const absolutePath = path.resolve(root, relativePath);
  const relativeToRoot = path.relative(root, absolutePath);
  if (isOutsideRoot(relativeToRoot)) {
    throw new Error(`Refusing to edit path outside repository: ${relativePath}`);
  }

  const realTarget = fs.realpathSync(absolutePath);
  if (isOutsideRoot(path.relative(realRoot, realTarget))) {
    throw new Error(`Refusing to edit symlink target outside repository: ${relativePath}`);
  }

  const original = fs.readFileSync(realTarget);
  const lines = original.toString('binary').match(/.*?(?:\r\n|\n|$)/g) || [];
  if (lines.length && lines[lines.length - 1] === '') lines.pop();
  let fileChanged = false;

  for (const lineNumber of lineNumbers) {
    const index = lineNumber - 1;
    if (index < 0 || index >= lines.length) continue;
    const line = lines[index];
    const newline = line.endsWith('\r\n') ? '\r\n' : line.endsWith('\n') ? '\n' : '';
    const body = newline ? line.slice(0, -newline.length) : line;
    const trimmed = body.replace(/[ \t]+$/g, '');
    if (trimmed === body) continue;
    lines[index] = `${trimmed}${newline}`;
    fileChanged = true;
    changedLines += 1;
  }

  let updated = Buffer.from(lines.join(''), 'binary');
  if (eofBlankFiles.has(relativePath)) {
    // Preserve the exact first newline byte sequence and remove only the
    // additional newline sequences that form blank lines at EOF.
    const normalized = updated.toString('binary').replace(/(\r?\n)(?:\r?\n)+$/g, '$1');
    const normalizedBuffer = Buffer.from(normalized, 'binary');
    if (!normalizedBuffer.equals(updated)) {
      updated = normalizedBuffer;
      fileChanged = true;
    }
  }

  if (fileChanged) {
    fs.writeFileSync(realTarget, updated);
    changedFiles += 1;
  }
}

process.stdout.write(`Trimmed ${changedLines} changed line(s) in ${changedFiles} file(s).\n`);
