import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

// GATE: the Natural style's textured ground (spec §14.5, the de-look plan's step 2), in the real game.
//
// 1. It REPLACES the voxel terrain rather than drawing over it: the runtime holds no terrain chunks, because a
//    mesh laid over them z-fights (the plan's experiment E3).
// 2. It keeps the fog-of-war rule at the RIM of the explored area, where a soft edge could leak: every pixel of
//    an unexplored cell next to explored ground is black, and the known cell beside it darkens toward it
//    instead, so the edge is soft. art-style-setting.spec.ts samples only DEEP unexplored cells (none explored
//    within three), which a soft edge reaching into the unexplored cell would never touch.
// 3. It comes back after the WebGL context is lost and restored. Three re-uploads its textures from the data it
//    keeps, and nothing in the ground is created only once per context.
//
// HOW THE RIM IS SAMPLED. On the world canvas (no HUD), at unexplored cells on the NEAR side of the explored area:
// every cell in front of the cell (larger x and y, three deep) is unexplored too, and so holds nothing drawn,
// because anything standing on ground reaches up the screen over the cells behind it, never over the cells in
// front. A cell with a displayed entity within two cells is skipped all the same (a tree's canopy can lean over
// its cell's edge). Each cell is sampled at its centre and at three points 0.1 of a tile inside each edge it
// shares with explored ground: the points a soft edge reaching into it would light first.
//
// BOUND: one map (aoe2-prototype) at tick 0, one camera (the default zoom at 1280x720), whatever rasteriser the
// suite runs on. Explored-but-unseen ground and the half-tile limit on the edge of vision are not measured here:
// they come from a linearly filtered fog texture whose bytes tests/rendering/aoeDeGroundData.test.ts holds.

interface RimReport {
  readonly cells: number;
  readonly points: number;
  readonly brightestUnexplored: number;
  readonly brightestAt: string;
  readonly knownCentreLuma: number[];
  readonly knownEdgeLuma: number[];
}

async function sampleRim(page: Page): Promise<RimReport> {
  return page.evaluate(async () => {
    const api = window.__AOE2_TEST__!;
    const state = api.getRenderState();
    const frame = state.frame!;
    const width = frame.mapWidth;
    const height = frame.mapHeight;
    const explored = new Set(frame.exploredCells);
    const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;
    const known = (x: number, y: number) => inMap(x, y) && explored.has(y * width + x);
    const occupied = new Set<number>();
    for (const entity of state.entities) {
      if (entity.layer === 'terrain') continue;
      const x0 = Math.floor(entity.x);
      const y0 = Math.floor(entity.y);
      for (let dy = 0; dy < Math.max(1, Math.ceil(entity.footprintHeight)); dy += 1) {
        for (let dx = 0; dx < Math.max(1, Math.ceil(entity.footprintWidth)); dx += 1) occupied.add((y0 + dy) * width + x0 + dx);
      }
    }
    const nearEntity = (cx: number, cy: number) => {
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (occupied.has((cy + dy) * width + cx + dx)) return true;
      return false;
    };
    const origin = api.worldToScreen(0, 0);
    const alongX = api.worldToScreen(1, 0);
    const alongY = api.worldToScreen(0, 1);
    const capture = api.captureWorldFrame();
    const image = new Image();
    image.src = capture.dataUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const rect = document.querySelector('.voxel-world-canvas')!.getBoundingClientRect();
    const scale = image.width / rect.width;
    // A world point (x + u, y + v), u and v from the cell's corner; worldToScreen names cell centres.
    const pixelAt = (x: number, y: number, u: number, v: number): number[] | null => {
      const wx = x + u - 0.5;
      const wy = y + v - 0.5;
      const px = Math.round((origin.x + (alongX.x - origin.x) * wx + (alongY.x - origin.x) * wy - rect.left) * scale);
      const py = Math.round((origin.y + (alongX.y - origin.y) * wx + (alongY.y - origin.y) * wy - rect.top) * scale);
      if (px < 2 || py < 2 || px >= image.width - 2 || py >= image.height - 2) return null;
      const offset = (py * image.width + px) * 4;
      return [pixels[offset]!, pixels[offset + 1]!, pixels[offset + 2]!];
    };
    const luma = (rgb: number[]) => 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
    let cells = 0;
    let points = 0;
    let brightestUnexplored = 0;
    let brightestAt = 'none';
    const knownCentreLuma: number[] = [];
    const knownEdgeLuma: number[] = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (known(x, y) || nearEntity(x, y)) continue;
        let frontUnknown = true;
        for (let j = 0; j <= 3 && frontUnknown; j += 1) for (let i = 0; i <= 3; i += 1) if (known(x + i, y + j)) frontUnknown = false;
        if (!frontUnknown) continue;
        // Explored neighbours behind: across the west edge (x - 1) or the north edge (y - 1).
        const edges: Array<[number, number, (t: number) => [number, number]]> = [];
        if (known(x - 1, y)) edges.push([x - 1, y, (t) => [0.1, t]]);
        if (known(x, y - 1)) edges.push([x, y - 1, (t) => [t, 0.1]]);
        if (edges.length === 0) continue;
        const samples: Array<[number, number]> = [[0.5, 0.5]];
        for (const [, , at] of edges) for (const t of [0.3, 0.5, 0.7]) samples.push(at(t));
        const drawn = samples.map(([u, v]) => pixelAt(x, y, u, v));
        if (drawn.some((rgb) => rgb === null)) continue;
        cells += 1;
        drawn.forEach((rgb, index) => {
          points += 1;
          const brightest = Math.max(...rgb!);
          if (brightest > brightestUnexplored) {
            brightestUnexplored = brightest;
            brightestAt = `cell (${x}, ${y}) at (${samples[index]!.join(', ')}): ${rgb!.join(',')}`;
          }
        });
        // The known neighbour behind: lit at its centre, dark just short of the shared edge.
        for (const [kx, ky] of edges) {
          const centre = pixelAt(kx, ky, 0.5, 0.5);
          const edge = kx === x - 1 ? pixelAt(kx, ky, 0.94, 0.5) : pixelAt(kx, ky, 0.5, 0.94);
          if (centre && edge && !nearEntity(kx, ky)) {
            knownCentreLuma.push(luma(centre));
            knownEdgeLuma.push(luma(edge));
          }
        }
      }
    }
    return { cells, points, brightestUnexplored, brightestAt, knownCentreLuma, knownEdgeLuma };
  });
}

async function bootNatural(page: Page, zoom?: number): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => { window.localStorage.setItem('aoe2:art-style', 'de'); });
  await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
  if (zoom !== undefined) await page.evaluate((value) => window.__AOE2_TEST__!.setCameraZoom(value), zoom);
  await game.waitForRenderedFrames(page, 2);
  const drawn = await page.evaluate(() => window.__AOE2_TEST__!.getWorldRendererState());
  expect(drawn.artStyle, 'the Natural style was asked for through aoe2:art-style').toBe('de');
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

test.describe('the Natural style\'s textured ground', () => {
  test('replaces the voxel terrain, and keeps unexplored ground black to the rim with a soft edge on the known side', async ({ page }) => {
    // Zoomed out, so the whole explored area and every rim cell around it is on the canvas.
    await bootNatural(page, 0.7);
    const drawn = await page.evaluate(() => window.__AOE2_TEST__!.getWorldRendererState());
    expect(drawn.ground).toBe('textured');
    expect(drawn.metrics.chunks, 'voxel terrain chunks the runtime still holds').toBe(0);

    const rim = await sampleRim(page);
    const seen = JSON.stringify({ ...rim, knownCentreLuma: rim.knownCentreLuma.length, knownEdgeLuma: rim.knownEdgeLuma.length });
    // Measured 2026-09-24 on both rasterisers: 12 rim cells and 66 points, all 0,0,0; 13 known neighbours at a
    // median luma of 129 at their centres and 0 by the shared edge. Too few cells would sample nothing.
    expect(rim.cells, `rim cells sampled, ${seen}`).toBeGreaterThanOrEqual(8);
    expect(rim.brightestUnexplored, `brightest channel inside unexplored rim cells, ${seen}`).toBeLessThanOrEqual(2);
    // The known side is lit, and darkens toward the unexplored cell: the edge is soft, not a cut.
    expect(rim.knownCentreLuma.length, `known neighbours sampled, ${seen}`).toBeGreaterThanOrEqual(6);
    expect(median(rim.knownCentreLuma), `median luma at known centres, ${seen}`).toBeGreaterThan(40);
    expect(
      median(rim.knownEdgeLuma) / median(rim.knownCentreLuma),
      `known ground 0.06 of a tile from the unexplored edge, over its centre: ${median(rim.knownEdgeLuma)} / ${median(rim.knownCentreLuma)}`,
    ).toBeLessThan(0.35);
  });

  test('draws again after the WebGL context is lost and restored', async ({ page }) => {
    await bootNatural(page);
    const centres = () => page.evaluate(async () => {
      const api = window.__AOE2_TEST__!;
      const frame = api.getRenderState().frame!;
      const visible = frame.visibleCells.slice(0, 400);
      const capture = api.captureWorldFrame();
      const image = new Image();
      image.src = capture.dataUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const rect = document.querySelector('.voxel-world-canvas')!.getBoundingClientRect();
      const scale = image.width / rect.width;
      const lumas: number[] = [];
      for (const index of visible) {
        const point = api.worldToScreen(index % frame.mapWidth, Math.floor(index / frame.mapWidth));
        const px = Math.round((point.x - rect.left) * scale);
        const py = Math.round((point.y - rect.top) * scale);
        if (px < 0 || py < 0 || px >= image.width || py >= image.height) continue;
        const [r, g, b] = context.getImageData(px, py, 1, 1).data;
        lumas.push(Math.round(0.2126 * r! + 0.7152 * g! + 0.0722 * b!));
      }
      return lumas;
    });
    const before = await centres();
    expect(before.length, 'visible cell centres on the canvas').toBeGreaterThanOrEqual(50);
    expect(median(before), 'median luma of visible ground before the loss').toBeGreaterThan(40);

    await page.locator('.voxel-world-canvas').evaluate((canvas) => {
      const context = (canvas as HTMLCanvasElement).getContext('webgl2');
      const extension = context?.getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('This Chromium exposes no WEBGL_lose_context on the world canvas.');
      (window as typeof window & { __AOE2_DE_GROUND_LOSS__?: WEBGL_lose_context }).__AOE2_DE_GROUND_LOSS__ = extension;
      extension.loseContext();
    });
    await expect.poll(() => page.evaluate(() => window.__AOE2_TEST__!.getWorldRendererState().metrics.state)).toBe('lost');
    await page.evaluate(() => {
      const holder = window as typeof window & { __AOE2_DE_GROUND_LOSS__?: WEBGL_lose_context };
      holder.__AOE2_DE_GROUND_LOSS__!.restoreContext();
      delete holder.__AOE2_DE_GROUND_LOSS__;
    });
    await expect.poll(() => page.evaluate(() => {
      const metrics = window.__AOE2_TEST__!.getWorldRendererState().metrics;
      return metrics.state === 'running' && metrics.contextRestorations === 1;
    })).toBe(true);
    await game.waitForRenderedFrames(page, 3);

    const after = await centres();
    expect(after.length).toBe(before.length);
    const moved = after.filter((luma, index) => Math.abs(luma - before[index]!) > 3).length;
    expect(moved, `visible cell centres whose luma moved by more than 3 across the loss (of ${after.length})`).toBe(0);
  });
});
