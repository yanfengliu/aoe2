import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

// Two things about the art style, both through the real game.
//
// 1. It is a player setting (spec §14.5): the game menu's Settings row switches
//    the live canvas without a reload, and the choice survives one.
//
// 2. Fog of war hides unexplored ground in EVERY style (defect register,
//    2026-09-23). Unexplored ground used to be drawn at 12% of its colour, so a
//    contrast stretch showed every lake and forest on the map: two levels per
//    channel between grass and water, too little to see and plenty to measure.
//    The unit tests prove the render snapshot cannot depend on an unexplored
//    cell; this proves nothing after it does either (the resolve pass, the tone
//    curve, the lights). It reads the WORLD canvas itself, so no HUD is in the
//    sample, at the centre of every unexplored cell with no explored cell
//    within three (so nothing standing on known ground reaches over it), and
//    requires ONE colour across cells of more than one terrain kind; in the DE
//    style that colour is black.
//
// Bound: one map (`aoe2-prototype`) at one tick, one camera (zoom 0.7 at
// 1280x720), cell centres only, and deep cells only: the rim of the explored
// area is gated by the non-interference test in
// tests/rendering/aoeVoxelFogFairness.test.ts, and the minimap's fog by the
// draw-call test in tests/ui/minimap.test.ts, not here.

interface UnexploredGround {
  readonly cells: number;
  readonly kinds: readonly string[];
  readonly colours: readonly string[];
  readonly maxChannel: number;
  /** The captured world frame the sample read, as captureWorldFrame's data URL. */
  readonly frame: string;
}

async function sampleUnexploredGround(page: Page): Promise<UnexploredGround> {
  return page.evaluate(async () => {
    const api = window.__AOE2_TEST__!;
    const state = api.getRenderState();
    const frame = state.frame!;
    const width = frame.mapWidth;
    const explored = new Set(frame.exploredCells);
    const kinds = new Map(state.entities
      .filter((entity) => entity.layer === 'terrain')
      .map((entity) => [entity.y * width + entity.x, entity.entityType]));
    const deep = (cx: number, cy: number): boolean => {
      for (let dy = -3; dy <= 3; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= width || y >= frame.mapHeight) return false;
          if (explored.has(y * width + x)) return false;
        }
      }
      return true;
    };
    // Cell centres are affine in the cell index, so three projections place
    // them all (each worldToScreen call re-presents the frame).
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
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(image, 0, 0);
    // One read of the whole frame, indexed below: the same pixels the
    // per-cell 1x1 reads returned, without a canvas readback per cell.
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const rect = document.querySelector('.voxel-world-canvas')!.getBoundingClientRect();
    const scale = image.width / rect.width;
    const seenKinds = new Set<string>();
    const colours = new Set<string>();
    let maxChannel = 0;
    let cells = 0;
    for (let y = 0; y < frame.mapHeight; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (!deep(x, y)) continue;
        const px = Math.round((origin.x + (alongX.x - origin.x) * x + (alongY.x - origin.x) * y - rect.left) * scale);
        const py = Math.round((origin.y + (alongX.y - origin.y) * x + (alongY.y - origin.y) * y - rect.top) * scale);
        if (px < 0 || py < 0 || px >= image.width || py >= image.height) continue;
        const at = (py * image.width + px) * 4;
        const r = pixels[at]!;
        const g = pixels[at + 1]!;
        const b = pixels[at + 2]!;
        colours.add(`${String(r)},${String(g)},${String(b)}`);
        maxChannel = Math.max(maxChannel, r!, g!, b!);
        seenKinds.add(String(kinds.get(y * width + x)));
        cells += 1;
      }
    }
    return { cells, kinds: [...seenKinds].sort(), colours: [...colours], maxChannel, frame: capture.dataUrl };
  });
}

/** Returns the frame it sampled, so the style switch below compares the two
 *  frames these checks read rather than capturing each again (work 123: a
 *  capture of the 1280x720 world cost about 1.5 s here and four times that on
 *  CI's SwiftShader runners). */
async function expectUnexploredGroundHidden(page: Page, style: string): Promise<string> {
  const { frame, ...ground } = await sampleUnexploredGround(page);
  const seen = JSON.stringify(ground);
  // The sample has to span terrain kinds, or one colour would prove nothing
  // (measured 2026-09-23: 799 cells of forest, grass, hill and water).
  expect(ground.cells, `${style}: deep unexplored cells on screen, ${seen}`).toBeGreaterThanOrEqual(100);
  expect(ground.kinds, `${style}: terrain kinds under the sample, ${seen}`).toContain('water');
  expect(ground.kinds.length, `${style}: terrain kinds under the sample, ${seen}`).toBeGreaterThanOrEqual(2);
  // ONE colour is the fairness rule: the defect drew grass and water two
  // levels apart. Moebius's one colour is not black, because its resolve inks
  // the whole ground plane faintly (a flat plane seen isometrically has a
  // constant depth gradient): (5,6,8) at this zoom, (3,4,4) at the default
  // one. The bound below only says "dark"; it is not what catches a leak.
  expect(ground.colours, `${style}: colours drawn over unexplored ground, ${seen}`).toHaveLength(1);
  expect(ground.maxChannel, `${style}: brightest channel over unexplored ground, ${seen}`).toBeLessThanOrEqual(16);
  if (style === 'de') expect(ground.colours, `de: unexplored ground is black, ${seen}`).toEqual(['0,0,0']);
  return frame;
}

async function artStyleDrawn(page: Page): Promise<string> {
  return page.evaluate(() => window.__AOE2_TEST__!.getWorldRendererState().artStyle);
}

// Three tests since work 123: as one test it ran 24-26 s of its 30 s on CI's
// SwiftShader runners, most of it the first Moebius frame and four captures of
// the 1280x720 world. The chain "a click stores the choice, and a reload draws
// it" is held at the stored value: the second test proves the click writes
// `aoe2:art-style` = moebius, the third that a boot reading moebius draws it.
async function bootZoomedOut(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
  await page.evaluate(() => window.__AOE2_TEST__!.setCameraZoom(0.7));
  await game.waitForRenderedFrames(page, 2);
}

test.describe('art style setting and fog of war', () => {
  test('draws unexplored ground black in the default Natural style', async ({ page }) => {
    await bootZoomedOut(page);
    // The DE style (Natural) is the default (decision D1, once the CPU ground
    // cost fix landed); Moebius is one click on the menu row away.
    expect(await artStyleDrawn(page)).toBe('de');
    await expectUnexploredGroundHidden(page, 'de');
  });

  test('switches the live canvas to Moebius from the menu, stores the choice, and never draws unexplored ground', async ({ page }) => {
    await bootZoomedOut(page);
    expect(await artStyleDrawn(page)).toBe('de');
    const deFrame = await page.evaluate(() => window.__AOE2_TEST__!.captureWorldFrame().dataUrl);

    await page.keyboard.press('Escape');
    const row = page.locator('[data-hud="menu-art-style-cycle"]');
    await expect(row).toHaveAccessibleName('Art style: Natural');
    await row.click();
    await expect(row).toHaveAccessibleName('Art style: Moebius');
    await expect(page.locator('[data-hud="menu-art-style"]')).toHaveText('Moebius');
    expect(await artStyleDrawn(page)).toBe('moebius');
    expect(await page.evaluate(() => window.localStorage.getItem('aoe2:art-style'))).toBe('moebius');
    // Live, with no reload: the paused canvas itself is drawn differently.
    await game.waitForRenderedFrames(page, 2);
    const moebiusFrame = await expectUnexploredGroundHidden(page, 'moebius');
    expect(moebiusFrame).not.toBe(deFrame);
  });

  test('boots in the stored style, names it on the menu row, and wraps back to Natural', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.addInitScript(() => { window.localStorage.setItem('aoe2:art-style', 'moebius'); });
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    // The choice survives a reload, and the row names the style drawn.
    expect(await artStyleDrawn(page)).toBe('moebius');
    await page.keyboard.press('Escape');
    const row = page.locator('[data-hud="menu-art-style-cycle"]');
    await expect(row).toHaveAccessibleName('Art style: Moebius');

    // And the row wraps back to Natural.
    await row.click();
    await expect(row).toHaveAccessibleName('Art style: Natural');
    expect(await artStyleDrawn(page)).toBe('de');
    expect(await page.evaluate(() => window.localStorage.getItem('aoe2:art-style'))).toBe('de');
  });
});
