export type RendererMode = 'voxel' | 'phaser';

export function parseRendererMode(url: string): RendererMode {
  const raw = new URL(url).searchParams.get('renderer');
  if (raw === null || raw === '' || raw === 'phaser') {
    return 'phaser';
  }
  if (raw === 'voxel') return 'voxel';

  console.warn(`[aoe2] ?renderer=${raw} is unsupported; using Phaser.`);
  return 'phaser';
}
