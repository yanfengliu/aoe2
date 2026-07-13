// Spec 2 (annotation-ui v0.1.5) AO-6: synchronous canvas → PNG bytes.
// Uses HTMLCanvasElement.toDataURL('image/png') and decodes the
// base64 payload to a Uint8Array. ~10-30ms per capture on typical
// hardware per DESIGN §12; acceptable while paused.

export interface CaptureScreenshotOptions {
  /** JPEG compression quality (0-1) is irrelevant for PNG; reserved
   *  for future MIME extensions. PNG is lossless. */
  readonly mimeType?: 'image/png';
}

export function captureScreenshot(
  canvas: HTMLCanvasElement,
  options: CaptureScreenshotOptions = {},
): Uint8Array {
  const mime = options.mimeType ?? 'image/png';
  return captureScreenshotDataUrl(canvas.toDataURL(mime));
}

export function captureScreenshotDataUrl(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) {
    throw new Error('captureScreenshot: invalid dataUrl returned from renderer (no comma)');
  }
  const b64 = dataUrl.slice(commaIdx + 1);
  return base64ToBytes(b64);
}

function base64ToBytes(b64: string): Uint8Array {
  // atob is browser-native; use Buffer in node test envs.
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  // Node fallback (shouldn't happen at runtime; only for vitest-node tests).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Buffer } = require('node:buffer') as { Buffer: typeof globalThis.Buffer };
  const buf = Buffer.from(b64, 'base64');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
