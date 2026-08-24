// Crop a capture around a point, and optionally magnify it with nearest-
// neighbour so a single unit fills the frame.
//
// The in-engine camera clamps at ZOOM=2.4, which is not close enough to judge
// one unit's detail — and shrinking SIZE instead only makes the HUD cover the
// world. So the close-up is a CROP of a full-size capture rather than a
// tighter camera.
//
// IN=<path> OUT=<path> [CENTER="x,y"] [CROP="WxH"] [MAG=<n>]

import { createReadStream, createWriteStream } from 'node:fs';
import { PNG } from 'pngjs';

const input = process.env.IN;
const output = process.env.OUT;
if (!input || !output) {
  throw new Error('IN and OUT are required: IN=<source .png> OUT=<destination .png>');
}
const crop = process.env.CROP ?? '260x220';
const magnification = Number(process.env.MAG ?? 3);

function parsePair(value, name) {
  const match = /^(\d+)[x,](\d+)$/.exec(value.trim());
  if (!match) {
    throw new Error(`${name} must be "AxB" or "A,B"; got "${value}"`);
  }
  return [Number(match[1]), Number(match[2])];
}

const [cropWidth, cropHeight] = parsePair(crop, 'CROP');

const source = await new Promise((resolve, reject) => {
  createReadStream(input)
    .pipe(new PNG())
    .on('parsed', function onParsed() { resolve(this); })
    .on('error', reject);
});

const [centerX, centerY] = process.env.CENTER
  ? parsePair(process.env.CENTER, 'CENTER')
  : [Math.floor(source.width / 2), Math.floor(source.height / 2)];

const left = Math.max(0, Math.min(source.width - cropWidth, centerX - Math.floor(cropWidth / 2)));
const top = Math.max(0, Math.min(source.height - cropHeight, centerY - Math.floor(cropHeight / 2)));

const out = new PNG({ width: cropWidth * magnification, height: cropHeight * magnification });
for (let y = 0; y < out.height; y += 1) {
  for (let x = 0; x < out.width; x += 1) {
    const sourceIndex = (((top + Math.floor(y / magnification)) * source.width) + left + Math.floor(x / magnification)) * 4;
    const targetIndex = ((y * out.width) + x) * 4;
    out.data[targetIndex] = source.data[sourceIndex];
    out.data[targetIndex + 1] = source.data[sourceIndex + 1];
    out.data[targetIndex + 2] = source.data[sourceIndex + 2];
    out.data[targetIndex + 3] = source.data[sourceIndex + 3];
  }
}

await new Promise((resolve, reject) => {
  out.pack().pipe(createWriteStream(output)).on('finish', resolve).on('error', reject);
});
console.log(`cropped ${input} @ ${left},${top} ${cropWidth}x${cropHeight} x${magnification} -> ${output}`);
