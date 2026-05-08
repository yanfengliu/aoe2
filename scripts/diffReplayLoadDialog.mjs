import { createReadStream, createWriteStream } from 'node:fs';
import { PNG } from 'pngjs';

function readPng(path) {
  return new Promise((resolve, reject) => {
    createReadStream(path)
      .pipe(new PNG())
      .on('parsed', function parsed() {
        resolve({ data: this.data, width: this.width, height: this.height });
      })
      .on('error', reject);
  });
}

const before = 'docs/devlog/artifacts/2026-05-07-replay-load-dialog-before.png';
const after = 'docs/devlog/artifacts/2026-05-07-replay-load-dialog-after.png';
const diffPath = 'docs/devlog/artifacts/2026-05-07-replay-load-dialog-diff.png';

const [a, b] = await Promise.all([readPng(before), readPng(after)]);
if (a.width !== b.width || a.height !== b.height) {
  throw new Error(
    `size mismatch: before ${a.width}x${a.height} vs after ${b.width}x${b.height}`,
  );
}

const diff = new PNG({ width: a.width, height: a.height });
let changed = 0;
for (let i = 0; i < a.data.length; i += 4) {
  const differs =
    a.data[i] !== b.data[i]
    || a.data[i + 1] !== b.data[i + 1]
    || a.data[i + 2] !== b.data[i + 2];
  if (differs) {
    changed += 1;
    diff.data[i] = 255;
    diff.data[i + 1] = 0;
    diff.data[i + 2] = 0;
    diff.data[i + 3] = 255;
  } else {
    diff.data[i] = 0;
    diff.data[i + 1] = 0;
    diff.data[i + 2] = 0;
    diff.data[i + 3] = 40;
  }
}

await new Promise((resolve, reject) => {
  diff.pack().pipe(createWriteStream(diffPath)).on('finish', resolve).on('error', reject);
});

const total = a.width * a.height;
const pct = ((changed / total) * 100).toFixed(2);
console.log(`changed ${changed}/${total} pixels (${pct}%) of ${a.width}x${a.height}`);
