import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

import { median, sampleRim, type RimReport } from './helpers/deGroundRim';
import * as game from './helpers/gameTestHelpers';
import { waitForLightPausedBoot } from './helpers/lightPausedBoot';

// GATE: CI draws the Natural ground's full blend, the shader a graphics card draws, although CI's rasteriser gets
// the single-sample tier (src/rendering/voxel/aoeDeGroundTier.ts).
//
// WHY. CI's browser suite draws with SwiftShader, and on a CPU rasteriser the ground draws one surface sample per
// pixel, so without this no CI run would compile or draw the blend every player with a graphics card sees; the
// local suite draws it on the GPU, and on Windows only. A blend broken on SwiftShader alone (a program it refuses, a
// texture it reads wrongly) would pass CI, and so would a tier override that stopped taking effect.
//
// HOW. SwiftShader whatever the suite's rasteriser (this file's launch arguments). The blend is forced through the
// tier's one override, aoe2:de-ground-tier in localStorage, which the renderer reads when it is built, and the page
// is asked which tier its ground drew with and which renderer drew it. Then, on the paused opening view at zoom 0.7
// and 1280x720, where the whole explored area and its rim are on the canvas:
//  1. no shader error was logged, and visible ground is lit;
//  2. the fog rule holds at the rim as tests/browser/de-ground.spec.ts checks it: the sampled points of unexplored
//     cells are black, and the known cell beside each is dark by the shared edge;
//  3. against the single-sample tier on the same view in a fresh context without the override: at the centres of
//     visible land cells with no unexplored cell beside them and no building's dirt, where both tiers draw the
//     cell's own surface (and anything standing there is drawn alike), the frames agree within a few levels;
//     elsewhere they differ over far more pixels (the blend's soft, wandering lines against tile edges), so the
//     blend is what drew. The single-sample page is held to the rim rule too, so the tier CI draws by default is
//     checked in pixels on every machine, a GPU one included.
// Nothing here is timed. What each tier costs is tests/browser/de-ground-frame-cost.spec.ts's. Both pages boot with
// one light read of the seed, because a blend-slow frame on four busy CPUs outlasted waitForPausedBootWithSeed's
// snapshot poll (docs/learning/gate-proofs.md).
//
// BOUND. One map at tick 0 and one camera. The blend is compared with the other tier only where the two should
// agree, and is not judged on its own there; that is the capture sweep's (scripts/captureMapScreenshot.mjs with
// STYLE=de GROUND_TIER=blend RASTERISER=swiftshader).

test.use({ launchOptions: { args: ['--use-angle=swiftshader'] } });

type Tier = 'blend' | 'single-sample';

async function bootNatural(page: Page, forceBlend: boolean): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript((blend) => {
    window.localStorage.setItem('aoe2:art-style', 'de');
    if (blend) window.localStorage.setItem('aoe2:de-ground-tier', 'blend');
  }, forceBlend);
  await waitForLightPausedBoot(page, 'aoe2-prototype');
  await page.evaluate(() => window.__AOE2_TEST__!.setCameraZoom(0.7));
  await game.waitForRenderedFrames(page, 3);
  return errors;
}

interface GroundFrame {
  readonly tier: Tier;
  readonly rasteriser: string | null;
  readonly png: string;
  /** Capture pixels at the centres of visible land cells with no unexplored cell beside them and no building's
   *  dirt. At a cell's centre the blend's four nearest cells weigh 1, 0, 0 and 0, so both tiers draw that cell's
   *  own surface there, at full fog brightness. */
  readonly uniformCentres: Array<[number, number]>;
  /** Luma at every visible cell centre on the canvas. */
  readonly visibleLuma: number[];
}

async function groundFrame(page: Page): Promise<GroundFrame> {
  return page.evaluate(async () => {
    const api = window.__AOE2_TEST__!;
    const renderer = api.getWorldRendererState();
    const state = api.getRenderState();
    const frame = state.frame!;
    const width = frame.mapWidth;
    const visible = new Set(frame.visibleCells);
    const explored = new Set(frame.exploredCells);
    const kinds = new Map(state.entities.filter((e) => e.layer === 'terrain').map((e) => [e.y * width + e.x, e.entityType]));
    // A building's dirt: its footprint and the ring around it, where the tiers draw dirt differently. Anything
    // standing on a cell is drawn the same in both frames (one paused boot each, the same tick), so it is kept.
    const blocked = new Set<number>();
    for (const entity of state.entities) {
      if (entity.layer !== 'building') continue;
      const x0 = Math.floor(entity.x);
      const y0 = Math.floor(entity.y);
      const w = Math.max(1, Math.ceil(entity.footprintWidth));
      const h = Math.max(1, Math.ceil(entity.footprintHeight));
      for (let y = y0 - 1; y <= y0 + h; y += 1) for (let x = x0 - 1; x <= x0 + w; x += 1) blocked.add(y * width + x);
    }
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
    const rect = document.querySelector('.voxel-world-canvas')!.getBoundingClientRect();
    const scale = image.width / rect.width;
    const uniformCentres: Array<[number, number]> = [];
    const visibleLuma: number[] = [];
    for (const index of visible) {
      const x = index % width;
      const y = Math.floor(index / width);
      const px = Math.round((origin.x + (alongX.x - origin.x) * x + (alongY.x - origin.x) * y - rect.left) * scale);
      const py = Math.round((origin.y + (alongX.y - origin.y) * x + (alongY.y - origin.y) * y - rect.top) * scale);
      if (px < 2 || py < 2 || px >= image.width - 2 || py >= image.height - 2) continue;
      const [r, g, b] = context.getImageData(px, py, 1, 1).data;
      visibleLuma.push(0.2126 * r! + 0.7152 * g! + 0.0722 * b!);
      const kind = kinds.get(index);
      if (kind === 'water' || blocked.has(index)) continue;
      let surrounded = true;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (!explored.has((y + dy) * width + x + dx)) surrounded = false;
      if (surrounded) uniformCentres.push([px, py]);
    }
    return {
      tier: renderer.groundTier,
      rasteriser: renderer.rasteriser,
      png: capture.dataUrl,
      uniformCentres,
      visibleLuma,
    };
  });
}

function decode(dataUrl: string): PNG {
  return PNG.sync.read(Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
}

/** de-ground.spec.ts's rim rule: unexplored rim cells black at every sampled point, the known side dark by the edge. */
function expectFogRim(rim: RimReport, tier: Tier): void {
  const seen = `${tier}: ${JSON.stringify({ ...rim, knownCentreLuma: rim.knownCentreLuma.length, knownEdgeLuma: rim.knownEdgeLuma.length })}`;
  expect(rim.cells, `rim cells sampled, ${seen}`).toBeGreaterThanOrEqual(8);
  expect(rim.brightestUnexplored, `brightest channel inside unexplored rim cells, ${seen}`).toBeLessThanOrEqual(2);
  expect(rim.knownCentreLuma.length, `known neighbours sampled, ${seen}`).toBeGreaterThanOrEqual(6);
  expect(
    median(rim.knownEdgeLuma) / median(rim.knownCentreLuma),
    `${tier}: known ground 0.06 of a tile from the unexplored edge, over its centre: `
      + `${median(rim.knownEdgeLuma)} / ${median(rim.knownCentreLuma)}`,
  ).toBeLessThan(0.35);
}

test('draws the full blend on SwiftShader when asked, keeping the fog rule, where the single-sample tier draws its own', async ({ page, browser, baseURL }) => {
  test.setTimeout(90_000);
  const errors = await bootNatural(page, true);
  const blend = await groundFrame(page);
  expect(blend.rasteriser, 'the renderer the game canvas\'s WebGL context names').toMatch(/SwiftShader/);
  expect(blend.tier, 'the tier the ground drew with, asked for through aoe2:de-ground-tier').toBe('blend');
  expect(errors.filter((text) => /shader|program|webgl/i.test(text)), 'shader or WebGL errors in the console').toEqual([]);
  expect(blend.visibleLuma.length, 'visible cell centres on the canvas').toBeGreaterThanOrEqual(50);
  expect(median(blend.visibleLuma), 'median luma of visible ground').toBeGreaterThan(40);

  expectFogRim(await sampleRim(page), 'blend');

  // The same view in the single-sample tier: a fresh context, so no override is stored.
  const context = await browser.newContext({ baseURL });
  try {
    const other = await context.newPage();
    await bootNatural(other, false);
    const single = await groundFrame(other);
    expect(single.tier, 'SwiftShader without the override').toBe('single-sample');
    expectFogRim(await sampleRim(other), 'single-sample');
    const a = decode(blend.png);
    const b = decode(single.png);
    expect([b.width, b.height]).toEqual([a.width, a.height]);
    const channelGap = (x: number, y: number): number => {
      const offset = (y * a.width + x) * 4;
      return Math.max(...[0, 1, 2].map((c) => Math.abs(a.data[offset + c]! - b.data[offset + c]!)));
    };
    const gaps = blend.uniformCentres.map(([x, y]) => channelGap(x, y));
    let differing = 0;
    for (let y = 0; y < a.height; y += 1) for (let x = 0; x < a.width; x += 1) if (channelGap(x, y) > 8) differing += 1;
    const share = differing / (a.width * a.height);
    const agreeing = gaps.filter((gap) => gap <= 6).length;
    console.log(`[full blend] ${agreeing} of ${gaps.length} cell centres within 6 levels (largest gap ${Math.max(...gaps)}); `
      + `${differing} pixels (${(share * 100).toFixed(2)}%) differ by more than 8 between the tiers; ${blend.rasteriser}`);
    // Measured 2026-09-25 on SwiftShader: 69 centres, 68 identical and one a level apart; 18,429 pixels (2.13%)
    // differing. A blend drawing a wrong surface, tint or fog level misses at most centres; an override that no
    // longer took effect would leave nothing differing.
    expect(gaps.length, 'visible land cell centres where the two tiers draw the same surface').toBeGreaterThanOrEqual(30);
    expect(agreeing / gaps.length, `centres within 6 levels of each other (${agreeing} of ${gaps.length}; gaps ${gaps.join(',')})`)
      .toBeGreaterThanOrEqual(0.9);
    expect(share, `share of the world canvas whose colour differs by more than 8 levels between the tiers (${differing} pixels)`)
      .toBeGreaterThan(0.01);
  } finally {
    await context.close();
  }
});
