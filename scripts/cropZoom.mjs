// Crop a region of a PNG and nearest-neighbour upscale it, so a shadow a few
// pixels wide can actually be looked at. Evidence tooling: reads and writes
// under the gitignored capture tree.
import { createReadStream, createWriteStream } from 'node:fs';
import { PNG } from 'pngjs';

const [, , src, dst, xs, ys, ws, hs, ss] = process.argv;
if (!src || !dst) throw new Error('usage: cropZoom.mjs <src.png> <dst.png> <x> <y> <w> <h> [scale]');
const x0 = Number(xs); const y0 = Number(ys);
const w = Number(ws); const h = Number(hs); const scale = Number(ss ?? 4);
const png = await new Promise((resolve, reject) => {
  createReadStream(src).pipe(new PNG()).on('parsed', function p() { resolve(this); }).on('error', reject);
});
const out = new PNG({ width: w * scale, height: h * scale });
for (let y = 0; y < h * scale; y += 1) {
  for (let x = 0; x < w * scale; x += 1) {
    const sx = Math.min(png.width - 1, x0 + Math.floor(x / scale));
    const sy = Math.min(png.height - 1, y0 + Math.floor(y / scale));
    const si = (sy * png.width + sx) * 4;
    const di = (y * out.width + x) * 4;
    out.data[di] = png.data[si];
    out.data[di + 1] = png.data[si + 1];
    out.data[di + 2] = png.data[si + 2];
    out.data[di + 3] = png.data[si + 3];
  }
}
await new Promise((resolve, reject) => {
  out.pack().pipe(createWriteStream(dst)).on('finish', resolve).on('error', reject);
});
console.log(`saved ${dst} (${String(w)}x${String(h)} at ${String(x0)},${String(y0)} scaled ${String(scale)}x)`);
