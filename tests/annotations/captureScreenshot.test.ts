// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { captureScreenshot } from '../../src/game/annotations/captureScreenshot';

describe('captureScreenshot', () => {
  it('returns Uint8Array PNG bytes from a canvas dataUrl', () => {
    // jsdom doesn't actually render to canvas, but it does support
    // toDataURL — it returns a stub like 'data:image/png;base64,'. Stub
    // toDataURL with a known base64 payload to verify decoding.
    const canvas = document.createElement('canvas');
    // 1x1 transparent PNG (smallest valid PNG):
    // base64 of an actual 1x1 PNG header + IDAT + IEND
    const tinyPng =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
    canvas.toDataURL = vi.fn(() => `data:image/png;base64,${tinyPng}`);
    const bytes = captureScreenshot(canvas);
    expect(bytes).toBeInstanceOf(Uint8Array);
    // PNG magic: 89 50 4E 47 0D 0A 1A 0A
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);
  });

  it('throws if the dataUrl has no comma separator', () => {
    const canvas = document.createElement('canvas');
    canvas.toDataURL = vi.fn(() => 'invalid-dataurl-no-comma');
    expect(() => captureScreenshot(canvas)).toThrow(/no comma/);
  });

  it('passes the mimeType to canvas.toDataURL when provided', () => {
    const canvas = document.createElement('canvas');
    const spy = vi.fn(() => 'data:image/png;base64,iVBORw0KGgo=');
    canvas.toDataURL = spy;
    captureScreenshot(canvas, { mimeType: 'image/png' });
    expect(spy).toHaveBeenCalledWith('image/png');
  });
});
