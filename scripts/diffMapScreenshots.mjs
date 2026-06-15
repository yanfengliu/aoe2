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

// LABEL selects a named screenshot set. NOTE the two scripts use LABEL
// differently: in captureMapScreenshot.mjs LABEL is the FULL suffix
// (`LABEL=m7-terrain-before` -> one file `...-m7-terrain-before.png`),
// whereas here LABEL is the STEM and `-before`/`-after`/`-diff` are appended.
// So capture twice with `LABEL=<stem>-before` and `LABEL=<stem>-after`, then
// diff with `LABEL=<stem>`. Without a LABEL this falls back to the bare
// `before`/`after`/`diff` names — but those collide with committed baseline
// artifacts, so always pass a LABEL for a new change (else it overwrites a
// tracked baseline).
const label = process.env.LABEL;
const stem = label
  ? `docs/devlog/artifacts/2026-04-23-default-map-${label}`
  : 'docs/devlog/artifacts/2026-04-23-default-map';
const before = `${stem}-before.png`;
const after = `${stem}-after.png`;
const diffPath = `${stem}-diff.png`;

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
