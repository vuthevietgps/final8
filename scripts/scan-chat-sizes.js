const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(__dirname, '..', 'frontend', 'src', 'app', 'features', 'chat-message');

function walk(dir, acc) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p, acc);
    } else if (/(\.ts|\.html|\.css)$/i.test(e.name)) {
      try {
        const txt = fs.readFileSync(p, 'utf8');
        const lines = txt.split(/\r?\n/).length;
        acc.push({ lines, name: e.name, path: p });
      } catch (err) {
        acc.push({ lines: -1, name: e.name, path: p, error: String(err && err.message || err) });
      }
    }
  }
}

function main() {
  const files = [];
  if (!fs.existsSync(targetDir)) {
    console.error('Target directory not found:', targetDir);
    process.exit(2);
  }
  walk(targetDir, files);
  files.sort((a, b) => b.lines - a.lines);
  const top = files.slice(0, 15);
  const out = top.map(f => `${String(f.lines).padStart(5)}\t${f.name}\t${path.relative(process.cwd(), f.path)}`);
  console.log('Top chat-message files by line count:');
  console.log(out.join('\n'));
}

main();
