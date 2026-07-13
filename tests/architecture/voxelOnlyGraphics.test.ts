import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const LEGACY_GRAPHICS_FILES = [
  'buildingRenderer.ts',
  'buildingRoofAccents.ts',
  'debugOverlay.ts',
  'deathEffects.ts',
  'feedbackEffects.ts',
  'isoBuilding.ts',
  'occlusionSilhouettes.ts',
  'resourceRenderer.ts',
  'sceneRenderer.ts',
  'selectionLayers.ts',
  'terrainBake.ts',
  'terrainCache.ts',
  'terrainRenderer.ts',
  'unitRenderer.ts',
  'worldLayers.ts',
] as const;

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('voxel-only graphics architecture', () => {
  it('has no renderer selector or legacy painter modules', () => {
    expect(existsSync('src/app/bootstrap/rendererMode.ts')).toBe(false);
    for (const file of LEGACY_GRAPHICS_FILES) {
      expect(existsSync(join('src/phaser/scenes/gameScene', file)), file).toBe(false);
    }
  });

  it('has no Phaser dependency, source import, or Vite chunk policy', () => {
    const files = readdirSync('src', { recursive: true })
      .filter((entry): entry is string => (
        typeof entry === 'string'
        && /\.(?:[cm]?[jt]sx?|css)$/.test(entry)
      ))
      .map((entry) => join('src', entry));
    const combined = files.map(source).join('\n');
    const packageJson = JSON.parse(source('package.json')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(existsSync('src/phaser')).toBe(false);
    expect(packageJson.dependencies?.phaser).toBeUndefined();
    expect(packageJson.devDependencies?.phaser).toBeUndefined();
    expect(combined).not.toMatch(/from ['"]phaser['"]/);
    expect(combined).not.toContain('/phaser/');
    expect(combined.toLowerCase()).not.toContain('phaser-overlay-canvas');
    expect(source('package-lock.json')).not.toContain('node_modules/phaser');
    expect(source('vite.config.ts').toLowerCase()).not.toContain('phaser');
  });

  it('has no graphics fallback or two-canvas composite capture path', () => {
    const bootstrap = source('src/app/bootstrap/createApp.ts');
    const renderer = source('src/rendering/voxel/AoeVoxelWorldRenderer.ts');

    expect(bootstrap).not.toContain('parseRendererMode');
    expect(bootstrap).toContain('new AoeVoxelGameView');
    expect(renderer).not.toContain('captureComposite');
  });
});
