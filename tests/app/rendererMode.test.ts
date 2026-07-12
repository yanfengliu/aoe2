import { describe, expect, it, vi } from 'vitest';

import { parseRendererMode } from '../../src/app/bootstrap/rendererMode';

describe('parseRendererMode', () => {
  it('keeps Phaser as the default until the voxel promotion gate is complete', () => {
    expect(parseRendererMode('http://localhost/?seed=example')).toBe('phaser');
  });

  it('accepts the explicit voxel and phaser modes', () => {
    expect(parseRendererMode('http://localhost/?renderer=voxel')).toBe('voxel');
    expect(parseRendererMode('http://localhost/?renderer=phaser')).toBe('phaser');
  });

  it('falls back to Phaser and warns for an unsupported value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(parseRendererMode('http://localhost/?renderer=unknown')).toBe('phaser');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown'));

    warn.mockRestore();
  });
});
