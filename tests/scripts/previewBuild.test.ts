// scripts/previewBuild.mjs refuses a measurement of the wrong build: a checkout with no build, a build older than
// its sources (vite preview would serve the previous one), and a port whose preview serves another checkout's
// build. These cases hold the two refusals that read the disk, on sandboxed trees; the port's refusal fetches a
// running preview and was exercised by every measured row (plan 150, "M2b measurement").

import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { hashedAssets, readCurrentBuild } from '../../scripts/previewBuild.mjs';

const INDEX = '<script type="module" src="/assets/index-B9xEv03w.js"></script><link rel="modulepreload" href="/assets/civ-engine-C4TnOHji.js"><link rel="stylesheet" href="/assets/index-CiXivm5o.css">';

const trees: string[] = [];
function tree(options: { built?: Date; source?: Date }): string {
  const root = mkdtempSync(join(tmpdir(), 'aoe2-preview-build-'));
  trees.push(root);
  mkdirSync(join(root, 'src', 'app'), { recursive: true });
  writeFileSync(join(root, 'src', 'app', 'main.ts'), 'export {};\n');
  if (options.source) utimesSync(join(root, 'src', 'app', 'main.ts'), options.source, options.source);
  if (options.built) {
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'dist', 'index.html'), INDEX);
    utimesSync(join(root, 'dist', 'index.html'), options.built, options.built);
  }
  return root;
}

afterEach(() => {
  for (const root of trees.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('the build a preview serves', () => {
  it('is named by its hashed assets, whatever order the page lists them in', () => {
    expect(hashedAssets(INDEX)).toBe('assets/civ-engine-C4TnOHji.js assets/index-B9xEv03w.js assets/index-CiXivm5o.css');
    expect(hashedAssets(INDEX.split('><').reverse().join('><'))).toBe(hashedAssets(INDEX));
    expect(hashedAssets(INDEX.replace('index-B9xEv03w', 'index-Zq1'))).not.toBe(hashedAssets(INDEX));
    expect(hashedAssets('<html></html>')).toBe('');
  });

  it('is read from a checkout whose build is newer than its sources', async () => {
    const root = tree({ source: new Date('2026-11-11T10:00:00Z'), built: new Date('2026-11-11T10:05:00Z') });
    expect(await readCurrentBuild(root)).toBe(INDEX);
  });

  it('is refused when the checkout has no build', async () => {
    const root = tree({});
    await expect(readCurrentBuild(root)).rejects.toThrow(/No build at .*index\.html.*run `npm run build`/s);
  });

  it('is refused when a source is newer than the build', async () => {
    const root = tree({ source: new Date('2026-11-11T10:06:00Z'), built: new Date('2026-11-11T10:05:00Z') });
    await expect(readCurrentBuild(root)).rejects.toThrow(/is older than .*would serve the PREVIOUS build/s);
  });
});
