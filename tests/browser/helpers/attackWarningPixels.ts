// The attack warning's pixels on the minimap, counted the way a player sees
// them: in SCREEN pixels, not canvas pixels, because CSS can shrink the canvas
// (below 1120px of window width the minimap is 164px wide over its 220px
// backing, and the browser suite runs at 800x600).
//
// NEAR-WHITE pixels, which only the mark's core draws. Not "reddish": owner
// 2's tint is a red too, so a red band would pass on the raider's own marker
// — a green run that proves the enemy is on the minimap, not the warning.
// Nothing else this canvas paints comes close to white; measured across the
// boot frame and the raid frame, the brightest minimum channel anywhere else
// is 181 (terrain), against this threshold of 200.
import type { Page } from '@playwright/test';

export const WHITE_ENOUGH = 200;

/**
 * THE VISIBILITY FLOOR (v0.3.229, defect register 2026-09-24). The gate used
 * to assert `marked > 0`, and that was green on exactly the frames a player
 * called a failure: the real play screenshots held 16 alert pixels out of
 * 1.44 million. The core is now drawn at 7 screen pixels in radius (about 150
 * pixels of area once the edge is anti-aliased), and the floor is 100 screen
 * pixels. The shipped mark drew 12 at this suite's 800x600 and 18 at
 * 1600x900 (the v0.3.229 before-captures), and a 3-canvas-pixel core drew 26
 * even with the new display scaling, so none of them can pass it. 100 pixels
 * is a disk at least 11 pixels across, several building markers wide.
 */
export const ALERT_SCREEN_PIXEL_FLOOR = 100;

/** Near-white pixels on the minimap, scaled to screen pixels. */
export async function countAlertScreenPixels(page: Page): Promise<number> {
  return page.locator('[data-hud="minimap"]').evaluate(countOnCanvas, WHITE_ENOUGH);
}

/** The same count, as a function to run INSIDE the page on every frame. */
export function countOnCanvas(canvas: HTMLCanvasElement, floor: number): number {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Expected the minimap canvas to have a 2D context.');
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let found = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (Math.min(data[i]!, data[i + 1]!, data[i + 2]!) >= floor) found += 1;
  }
  const scale = (canvas.clientWidth / canvas.width) * (canvas.clientHeight / canvas.height);
  return found * scale;
}
