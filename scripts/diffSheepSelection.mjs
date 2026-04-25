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

const before = 'docs/devlog/artifacts/2026-04-24-sheep-selection-before.png';
const after = 'docs/devlog/artifacts/2026-04-24-sheep-selection-after.png';
const diffPath = 'docs/devlog/artifacts/2026-04-24-sheep-selection-diff.png';

const [a, b] = await Promise.all([readPng(before), readPng(after)]);
if (a.width !== b.width) {
  // Width is the panel width and should be stable across runs. A width
  // mismatch points at HUD layout regression and would silently truncate
  // the diff to the overlap, hiding the regression. Fail loudly.
  console.error(
    `width mismatch: before ${a.width}px, after ${b.width}px; aborting diff to avoid hiding a layout regression`,
  );
  process.exit(1);
}
const width = a.width;
const height = Math.min(a.height, b.height);
if (a.height !== b.height) {
  console.warn(
    `height differs: before ${a.height}px, after ${b.height}px (compared overlap of ${height}px). Expected when the panel grows/shrinks; flag if this was unintentional.`,
  );
}
const diff = new PNG({ width, height });
let changed = 0;

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const aIdx = (y * a.width + x) * 4;
    const bIdx = (y * b.width + x) * 4;
    const dIdx = (y * width + x) * 4;
    const differs =
      a.data[aIdx] !== b.data[bIdx]
      || a.data[aIdx + 1] !== b.data[bIdx + 1]
      || a.data[aIdx + 2] !== b.data[bIdx + 2];
    if (differs) {
      changed += 1;
      diff.data[dIdx] = 255;
      diff.data[dIdx + 1] = 0;
      diff.data[dIdx + 2] = 0;
      diff.data[dIdx + 3] = 255;
    } else {
      diff.data[dIdx] = 0;
      diff.data[dIdx + 1] = 0;
      diff.data[dIdx + 2] = 0;
      diff.data[dIdx + 3] = 40;
    }
  }
}

await new Promise((resolve, reject) => {
  diff.pack().pipe(createWriteStream(diffPath)).on('finish', resolve).on('error', reject);
});

const total = width * height;
const pct = ((changed / total) * 100).toFixed(2);
console.log(`before ${a.width}x${a.height}, after ${b.width}x${b.height}, compared ${width}x${height}`);
console.log(`changed ${changed}/${total} pixels (${pct}%)`);
if (changed === 0 && a.height === b.height) {
  // The diff is consumed as a verification step alongside vitest/build —
  // a zero-diff with identical dimensions means the visual change the
  // commit claims to make never reached the HUD. Fail so that the gate
  // catches it instead of producing a misleading green diff image.
  console.error('no pixel difference detected; the visual change did not land');
  process.exit(1);
}
