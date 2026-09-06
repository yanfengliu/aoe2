// An OPAQUE HUD surface swallows the click. Nothing painted over the world may
// let a pointer through to the world beneath it.
//
// Owner report (2026-09-05, playing `aoe2-prototype` at 1280x800): right-click
// the empty dark space of the bottom command bar, right of the training-queue
// cards, and every selected unit takes a MOVE order to a cell hidden under the
// bar — three real right-clicks produced moves to (31,35), (27,33) and (27,35).
// Left-clicking there cleared the selection, and a queue card did nothing but
// deselect the Town Centre. `#hud-root` is `pointer-events: none` by design so
// the world canvas can see the mouse, and `.hud-panel--selection` re-stated
// that gate while opting children back in one by one. That was safe while the
// bar hugged its content; v0.3.207 made it a fixed-height opaque BAND (246px
// above 1120px wide, 236px below), so most of what it paints belongs to no
// opted-in child. This gate covers the CLASS, not those three points: every
// HUD element that paints an opaque background is found at run time and swept.
//
// BOUND — what this proves and no more. On `aoe2-prototype`, paused at boot, at
// 1280x800 and 800x600, in three states (nothing selected; the Town Center with
// four villagers queued; every villager selected), for every element under
// `#hud-root` that is drawn, is at least 8x8, has a computed
// `background-color` at least 50% opaque, and is the OUTERMOST such element on
// its branch — five of them per state here: `.hud-bar`, the two `.hud-panel`s,
// and the two floating buttons above the bar:
//   (1) every point on an 8px grid inside its rounded border box hit-tests to
//       an element inside `#hud-root` — `document.elementFromPoint`, the
//       browser's own hit test, not a reading of the stylesheet;
//   (2) real Playwright clicks — RIGHT then left, at up to eight points per
//       surface — reach no listener on the world canvas, leave the selection
//       byte-identical, and leave every selected unit's command (id, type AND
//       target) exactly as it was. Right-first is load-bearing: a leaking left
//       click clears the selection, and with nothing selected a leaking right
//       click orders nothing;
//   (3) the instrument is proved alive on both sides of every sweep: a right
//       click on open world and one on the TRANSPARENT part of the `.hud-bottom`
//       grid row must BOTH reach the canvas, before and after. That second
//       control is the over-fix guard — making the grid ROW clickable would eat
//       clicks in the empty space beside the bar, and would pass (1) and (2).
// Proved red at 90915ad4 + the two CSS reverts (2026-09-05). Reliably red, in
// every state at both viewports: 1065/3567 and 383/1875 painted points leak
// with nothing selected (1803/6143, 1769/5489, 2085/3586 and 429/3586 in the
// other states), 24 real clicks reach the canvas per state, and the selection
// goes 1 -> 0 and 3 -> 0. The world-command assertion is CORROBORATION, not a
// reliable detector: it caught the villagers retargeted from `move -> 17,18` to
// `move -> 5,21`, a cell under the bar, but only where the sweep's own points
// resolve to a cell that issues an order from where those units stand, and it
// is vacuous unless units are selected (a rally point and an empty selection
// are not in `unitPaths`).
// It does not cover: hidden surfaces (the game menu, the load panel, the match
// summary, the tech tree, the compendium — none is visible in these states, and
// the sweep asserts only what it finds), `#hud-tooltip`, which is exempt and
// pinned to `pointer-events: none` instead, widths other than the two, a deeper
// queue, the replay timeline's reserve, keyboard or wheel input, or whether a
// swallowed click does the right thing for the control it landed on. The grid
// stops one pixel short of each far edge, because a point at exactly
// `right`/`bottom` is already outside the box. Every state asserts the selection
// it set before measuring, and the chassis rects are re-measured after each
// sweep, so a sweep that moved the HUD fails instead of passing on a stale box;
// the floating buttons' rects are held only by name, since the idle bell's
// caption is as wide as the idle count.
//
// The machinery this reads with — the surface enumeration, the 8px grid sweep
// and the world-canvas probe — was split out to
// `tests/browser/helpers/hudOpaqueSurfaceSweep.ts` on 2026-09-05 for headroom;
// this file had reached 499 lines against a 500-line cap. That module measures
// and never asserts, so the whole bound above still lives here.

import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';
import {
  CLICK_THROUGH_BY_DESIGN,
  installCanvasProbe,
  readProbe,
  summarise,
  sweepHud,
  type Point,
  type SurfaceRect,
} from './helpers/hudOpaqueSurfaceSweep';

const GRID_STEP = 8;
const QUIET_POINTS_PER_SURFACE = 8;

/** The commands the given units hold right now, as stable text. */
async function commandsFor(page: Page, ids: number[]): Promise<string[]> {
  return page.evaluate((unitIds) => {
    const wanted = new Set(unitIds);
    return window.__AOE2_TEST__!.getDebugSnapshot().unitPaths
      .filter((path) => wanted.has(path.id))
      .map((path) => `${path.id}: ${path.commandType} -> ${path.toX},${path.toY}`)
      .sort();
  }, ids);
}

interface HudState {
  name: string;
  establish: (page: Page) => Promise<void>;
}

const STATES: HudState[] = [
  {
    name: 'nothing selected',
    establish: async (page) => {
      await page.evaluate(() => window.__AOE2_TEST__!.clearSelection());
      await expect(page.locator('[data-selection-name]')).toHaveText('No selection');
    },
  },
  {
    name: 'the Town Center with four villagers queued',
    establish: async (page) => {
      expect(await game.selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
      await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
      for (let i = 0; i < 8; i += 1) {
        const queued = await page.evaluate(() => window.__AOE2_TEST__!.getSelectionState().queue.length);
        if (queued >= 4) break;
        await page.locator('[data-command="train-villager"]').click();
        // `queue.train` is handled at the start of the sim's NEXT step, so a
        // paused match shows no entry until one tick runs. `advanceTicks` is
        // atomic — unpause, step, repause — so the match stays paused, and a
        // count of 1 cannot be silently under-advanced.
        await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(1); });
      }
      await expect(page.locator('[data-selection-queue-item="3"]')).toBeAttached();
    },
  },
  {
    name: 'every villager selected',
    establish: async (page) => {
      const map = await page.evaluate(() => window.__AOE2_TEST__!.getMapSize());
      expect(await page.evaluate(
        ({ width, height }) => window.__AOE2_TEST__!
          .selectOwnedUnitsByTypeInRect('villager', 0, 0, width - 1, height - 1),
        map,
      )).toBe(true);
      await expect(page.locator('[data-selection-name]')).toHaveText(/^\d+ Villagers Selected$/);
    },
  },
];

// RIGHT clicks, and that is a measured choice rather than a tidy one. The
// control leaves the selection under an order, so the world-command assertion
// downstream is looking for a RETARGET. Tried the other way (2026-09-05): with
// left-button controls the units go into the sweep idle, and on the unfixed
// tree not one leaked right click gave them an order — the bar's own points
// resolve to cells that issue nothing from where these villagers stand — so
// that assertion was green on a tree riddled with holes. Retarget is what
// actually fires, and it is the symptom the owner reported.
async function controlClicks(page: Page, where: string, points: Point[]): Promise<void> {
  await readProbe(page, true);
  for (const point of points) {
    await page.mouse.click(point.x, point.y, { button: 'right' });
  }
  const reached = await readProbe(page, true);
  const missed = points.filter(
    (point) => !reached.some((event) => Math.abs(event.x - point.x) <= 1 && Math.abs(event.y - point.y) <= 1),
  );
  expect(
    missed.map((point) => `(${point.x},${point.y})`),
    `${where}: these points must still reach the world canvas — one is open world, one is the `
      + 'TRANSPARENT part of the bottom grid row beside the bar. If they do not, either the fix '
      + 'made a transparent HUD region eat clicks, or this probe is dead and every "no leak" '
      + `result below means "did not run". Reached: ${summarise(reached) || '(nothing at all)'}`,
  ).toEqual([]);
}

for (const viewport of [{ width: 1280, height: 800 }, { width: 800, height: 600 }]) {
  test(`opaque HUD surfaces swallow clicks at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    await installCanvasProbe(page);

    for (const state of STATES) {
      await state.establish(page);
      const sweep = await sweepHud(page, GRID_STEP, QUIET_POINTS_PER_SURFACE);
      const where = `${viewport.width}x${viewport.height}, ${state.name}`;
      const inventory = sweep.surfaces
        .map((s) => `${s.label} ${s.width}x${s.height} at (${s.left},${s.top})`)
        .join('\n    ');

      // The sweep must have found real surfaces and sampled real points, or
      // "no leaks" is the report of a check that did not run.
      expect(sweep.surfaces.length, `${where}: no opaque HUD surface was found at all`)
        .toBeGreaterThanOrEqual(2);
      expect(sweep.paintedPoints, `${where}: too few painted points sampled\n    ${inventory}`)
        .toBeGreaterThan(500);
      // The real-click half can be emptied without breaking anything else:
      // every candidate is a point the hit test cleared and no control claims,
      // so a HUD whose panels are all controls, or a filter that grew, would
      // leave it clicking nothing and reporting green.
      expect(
        sweep.quiet.length,
        `${where}: only ${sweep.quiet.length} point(s) left for the real-click half, so it proves `
          + `nothing.\n    ${inventory}`,
      ).toBeGreaterThanOrEqual(12);
      expect(sweep.world, `${where}: no point of open world was found to use as a control`)
        .not.toBeNull();
      // The exemption is only good while its premise holds.
      expect(
        sweep.exempt.filter((surface) => surface.pointerEvents !== 'none'),
        `${where}: ${CLICK_THROUGH_BY_DESIGN} is exempt from this sweep BECAUSE it is `
          + 'pointer-events: none and follows the cursor. It no longer is, so it is a painted '
          + 'surface like any other — delete the exemption and let it be swept.',
      ).toEqual([]);
      expect(
        sweep.transparentInBottomRow,
        `${where}: the .hud-bottom grid row has no transparent point left, so the over-fix guard `
          + 'cannot run. Either the bar now fills the row, or a transparent region of the HUD grid '
          + `started eating clicks.\n    ${inventory}`,
      ).not.toBeNull();

      // (1) the exhaustive half: the browser's own hit test over every painted point.
      // Soft, like selection-panel-height.spec.ts: one red run reports every
      // layer that caught the defect rather than only the first.
      expect.soft(
        sweep.leaks.slice(0, 12).map((leak) => `${leak.label} at (${leak.x},${leak.y}) -> ${leak.hit}`),
        `${where}: ${sweep.leaks.length} of ${sweep.paintedPoints} painted HUD points hit-test `
          + 'through to the world. An opaque HUD surface must swallow the click.\n    '
          + `${inventory}\n  (first 12 of ${sweep.leaks.length} shown)`,
      ).toEqual([]);

      // (3a) the instrument, before the sweep.
      await controlClicks(page, `${where}: control before the sweep`, [
        sweep.world!, sweep.transparentInBottomRow!,
      ]);
      // The control right-clicks may have ordered the selection somewhere;
      // flush that before the baseline so it cannot look like the sweep's doing.
      await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(1); });
      await state.establish(page);

      const before = await page.evaluate(() => window.__AOE2_TEST__!.getSelectionState());
      const baseCommands = await commandsFor(page, before.selectedEntityIds);

      // (2) the real-click half: a right then a left click at every point.
      // RIGHT first, and that order is load-bearing: a leaking left click
      // clears the selection, and with nothing selected a leaking right click
      // issues no order at all — so left-first would leave the world-command
      // assertion below permanently green, whatever the HUD does. It is also
      // the order the owner reported: select, then right-click the bar.
      await readProbe(page, true);
      for (const point of sweep.quiet) {
        await page.mouse.click(point.x, point.y, { button: 'right' });
        await page.mouse.click(point.x, point.y);
      }
      const leaked = await readProbe(page, true);
      expect.soft(
        summarise(leaked),
        `${where}: real clicks on ${sweep.quiet.length} painted HUD points reached the world `
          + `canvas.\n    ${inventory}`,
      ).toBe('');

      const after = await page.evaluate(() => window.__AOE2_TEST__!.getSelectionState());
      expect.soft(
        after.selectedEntityIds,
        `${where}: clicking the HUD changed the selection (${before.selectedCount} -> `
          + `${after.selectedCount}). ${sweep.quiet.length} points clicked.\n    ${inventory}`,
      ).toEqual(before.selectedEntityIds);
      expect.soft(after.selectedEntityType).toBe(before.selectedEntityType);

      // A right click that leaks orders the selection to the cell under the
      // bar. Commands are applied at the start of the next step, so step once.
      // Compared whole — id, type AND target — not by "which units hold an
      // order": the control right click above leaves all three villagers
      // walking, so an id-set check would already hold every id and could
      // never see the sweep RETARGET them, which is the reported defect.
      await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(1); });
      const commandedAfter = await commandsFor(page, before.selectedEntityIds);
      expect.soft(
        commandedAfter,
        `${where}: a right click on the HUD gave selected units a world command. `
          + `${before.selectedEntityIds.length} unit(s) selected; before the sweep they held `
          + `[${baseCommands.join(' | ')}].\n    ${inventory}`,
      ).toEqual(baseCommands);

      // (3b) the instrument, after the sweep — and the surfaces must not have
      // moved, or the points after the first click measured something else.
      await controlClicks(page, `${where}: control after the sweep`, [sweep.world!]);
      await state.establish(page);
      const again = await sweepHud(page, GRID_STEP, QUIET_POINTS_PER_SURFACE);
      const moved = `${where}: the sweep changed the HUD, so its later clicks did not land on the `
        + `surfaces measured at the start.\n    ${inventory}`;
      // A new or vanished surface (a modal a click opened) is caught by the
      // list; the chassis rects are held exactly. The floating buttons' rects
      // are not: the idle bell's caption is as wide as the idle count, and a
      // control right-click above puts idle villagers to work.
      expect(again.surfaces.map((surface) => surface.label), moved)
        .toEqual(sweep.surfaces.map((surface) => surface.label));
      const chassis = (list: SurfaceRect[]): SurfaceRect[] => list
        .filter((surface) => /hud-bar|hud-panel/.test(surface.label));
      expect(chassis(again.surfaces), moved).toEqual(chassis(sweep.surfaces));
    }
  });
}
