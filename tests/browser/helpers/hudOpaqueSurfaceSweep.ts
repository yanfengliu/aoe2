// The INSTRUMENT behind `tests/browser/hud-opaque-surfaces-swallow-clicks.spec.ts`.
// It holds the measurement machinery only: the surface enumeration and 8px grid
// sweep (`sweepHud`), the world-canvas event probe (`installCanvasProbe` /
// `readProbe`), the probe's report formatter (`summarise`), the shapes they
// return, and the one exempt selector. Nothing here asserts. Every assertion,
// tolerance, guard threshold, viewport and HUD state stays in the spec, which is
// also where what this sweep proves — and what it does not — is written down.
//
// Split out of that spec on 2026-09-05 for headroom: it had landed at 499 lines
// against the 500-line hard cap `tests/architecture/fileSizeBudget.test.ts`
// enforces, one line short of turning the gate red before its first edit.
//
// Deliberately NOT a `*.spec.ts` file. Playwright collects `testDir:
// ./tests/browser` with the default `testMatch`
// (`**/*.@(spec|test).?(c|m)[jt]s?(x)`), which this name does not match, so the
// module is imported by the spec and never collected as an empty suite of its
// own — the same reason `gameTestHelpers.ts` sits beside it here.

import type { Page } from '@playwright/test';

// The one painted thing that is SUPPOSED to let a click through: the tooltip
// follows the cursor, so whatever it covers is what the player is already
// pointing at, and a tooltip that took the click would eat the click on the
// control that raised it. The exclusion is not free — the sweep returns each
// excluded surface's computed `pointer-events`, and the test asserts it is
// `none`, so making the tooltip clickable turns the exemption red instead of
// widening it. Renaming it drops it back into the sweep.
export const CLICK_THROUGH_BY_DESIGN = '#hud-tooltip';

export interface Point { x: number; y: number }
export interface SurfaceRect { label: string; left: number; top: number; width: number; height: number }
export interface QuietPoint extends Point { label: string }
export interface Leak extends Point { label: string; hit: string }

export interface HudSweep {
  surfaces: SurfaceRect[];
  exempt: { label: string; pointerEvents: string }[];
  paintedPoints: number;
  leaks: Leak[];
  quiet: QuietPoint[];
  transparentInBottomRow: Point | null;
  world: Point | null;
}

export interface ProbeEvent { type: string; button: number; x: number; y: number }

/**
 * Finds every opaque HUD surface, hit-tests an 8px grid over each, and returns
 * the points a real click can be aimed at. One page call for the whole sweep:
 * `elementFromPoint` is the same hit test a real click uses, so the exhaustive
 * half costs nothing, and the real-click half below stays small enough to run
 * well inside the 30s test timeout.
 */
export async function sweepHud(page: Page, step: number, quietPerSurface: number): Promise<HudSweep> {
  return page.evaluate(({ gridStep, perSurface, exemptSelector }) => {
    const root = document.getElementById('hud-root');
    if (!root) throw new Error('Expected #hud-root in the document; the HUD is not mounted.');
    const view = { width: window.innerWidth, height: window.innerHeight };

    const alphaOf = (color: string): number => {
      const match = /^rgba?\(([^)]+)\)$/.exec(color);
      if (!match) return 0;
      const parts = match[1]!.split(',').map((value) => Number.parseFloat(value));
      return parts.length < 4 ? 1 : (parts[3] ?? 1);
    };
    const describe = (el: Element | null): string => {
      if (!el) return '(nothing — outside the viewport)';
      const id = el.id ? `#${el.id}` : '';
      const classes = el.classList.length > 0 ? `.${Array.from(el.classList).join('.')}` : '';
      return `${el.tagName.toLowerCase()}${id}${classes}`;
    };
    const px = (value: string): number => {
      const parsed = Number.parseFloat(value);
      return value.endsWith('px') && Number.isFinite(parsed) ? parsed : 0;
    };

    // Outermost painted element per branch: a surface that swallows covers
    // everything it contains, so descending past it would only re-test its own
    // box. An element that paints nothing is transparent by design (the grid
    // rows, the wrappers) and the world below it must stay reachable.
    const painted: { el: HTMLElement; rect: DOMRect }[] = [];
    const exempt: { label: string; pointerEvents: string }[] = [];
    const visit = (el: HTMLElement): void => {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      // Drawn at all, not "drawn boldly": the idle bell dims to 0.25 when no
      // villager is idle and is still a control the player can hit, so a
      // threshold here would make the surface list depend on the idle count.
      if (Number.parseFloat(style.opacity) <= 0) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      if (alphaOf(style.backgroundColor) >= 0.5) {
        if (el.matches(exemptSelector)) exempt.push({ label: describe(el), pointerEvents: style.pointerEvents });
        else painted.push({ el, rect });
        return;
      }
      for (const child of Array.from(el.children)) visit(child as HTMLElement);
    };
    for (const child of Array.from(root.children)) visit(child as HTMLElement);

    const insidePaintedBox = (el: HTMLElement, rect: DOMRect, x: number, y: number): boolean => {
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return false;
      const style = window.getComputedStyle(el);
      const corners = [
        { r: px(style.borderTopLeftRadius), cx: rect.left, cy: rect.top, sx: 1, sy: 1 },
        { r: px(style.borderTopRightRadius), cx: rect.right, cy: rect.top, sx: -1, sy: 1 },
        { r: px(style.borderBottomRightRadius), cx: rect.right, cy: rect.bottom, sx: -1, sy: -1 },
        { r: px(style.borderBottomLeftRadius), cx: rect.left, cy: rect.bottom, sx: 1, sy: -1 },
      ];
      for (const corner of corners) {
        if (corner.r <= 0) continue;
        const dx = (x - corner.cx) * corner.sx;
        const dy = (y - corner.cy) * corner.sy;
        if (dx >= corner.r || dy >= corner.r) continue;
        const ox = corner.r - dx;
        const oy = corner.r - dy;
        if (ox * ox + oy * oy > corner.r * corner.r) return false;
      }
      return true;
    };

    const interactive = 'button, a, input, textarea, select, canvas, [data-command], [data-build-page], [role="button"]';
    const surfaces: SurfaceRect[] = [];
    const leaks: Leak[] = [];
    const quiet: QuietPoint[] = [];
    let paintedPoints = 0;

    for (const { el, rect } of painted) {
      const label = describe(el);
      surfaces.push({
        label,
        left: Math.round(rect.left * 10) / 10,
        top: Math.round(rect.top * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
      });
      const candidates: QuietPoint[] = [];
      // The border box is half-open: a point at exactly `right`/`bottom` is
      // the first pixel OUTSIDE the surface, and hit-tests to the world by
      // definition. Sampling stops one pixel short of each far edge.
      for (let y = Math.ceil(rect.top); y <= rect.bottom - 1; y += gridStep) {
        for (let x = Math.ceil(rect.left); x <= rect.right - 1; x += gridStep) {
          if (x < 0 || y < 0 || x >= view.width || y >= view.height) continue;
          if (!insidePaintedBox(el, rect, x, y)) continue;
          paintedPoints += 1;
          const hit = document.elementFromPoint(x, y);
          if (!hit || !root.contains(hit)) {
            // A leaking point is also a real-click candidate: the two halves
            // must fail on the SAME defect, or the real-click half is only
            // ever exercised on points the hit test already cleared and can
            // never be shown to go red for this bug.
            leaks.push({ label, x, y, hit: describe(hit) });
            candidates.push({ label, x, y });
            continue;
          }
          if (!(hit as HTMLElement).closest(interactive)) candidates.push({ label, x, y });
        }
      }
      // Spread the real-click points across the whole box rather than taking
      // the first few, which would all sit on one row.
      const stride = Math.max(1, Math.floor(candidates.length / perSurface));
      let taken = 0;
      for (let i = 0; i < candidates.length && taken < perSurface; i += stride) {
        quiet.push(candidates[i]!);
        taken += 1;
      }
    }

    // A point in the world, and a point in the TRANSPARENT part of the bottom
    // grid row: both must stay reachable, and they are what proves the probe
    // below is alive rather than silently dead.
    const worldPointIn = (left: number, top: number, right: number, bottom: number): Point | null => {
      const found: Point[] = [];
      for (let y = Math.ceil(top); y <= bottom; y += gridStep) {
        for (let x = Math.ceil(left); x <= right; x += gridStep) {
          if (x < 0 || y < 0 || x >= view.width || y >= view.height) continue;
          const hit = document.elementFromPoint(x, y);
          if (hit && !root.contains(hit)) found.push({ x, y });
        }
      }
      return found.length > 0 ? found[Math.floor(found.length / 2)]! : null;
    };
    const bottom = root.querySelector<HTMLElement>('.hud-bottom');
    const bottomRect = bottom?.getBoundingClientRect() ?? null;
    return {
      surfaces,
      exempt,
      paintedPoints,
      leaks,
      quiet,
      transparentInBottomRow: bottomRect
        ? worldPointIn(bottomRect.left, bottomRect.top, bottomRect.right, bottomRect.bottom)
        : null,
      world: worldPointIn(0, 0, view.width - 1, view.height - 1),
    };
  }, { gridStep: step, perSurface: quietPerSurface, exemptSelector: CLICK_THROUGH_BY_DESIGN });
}

/**
 * Records every pointer event that reaches the world canvas. The canvas is the
 * only route from the mouse into the simulation — `voxelPointerInputController`
 * binds pointerdown/up and contextmenu to it, and `AoeVoxelGameView` binds its
 * own pointerdown there — so an event the canvas never sees can issue no world
 * command and change no selection. Capture phase on `window`, so it fires
 * before anything the app registered.
 */
export async function installCanvasProbe(page: Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.voxel-world-canvas');
    if (!canvas) throw new Error('Expected canvas.voxel-world-canvas; the world is not rendered.');
    const probe: ProbeEvent[] = [];
    (window as unknown as { __HUD_CLICK_PROBE__: ProbeEvent[] }).__HUD_CLICK_PROBE__ = probe;
    const record = (event: Event): void => {
      const target = event.target as Node | null;
      if (target !== canvas && !(target && canvas.contains(target))) return;
      const pointer = event as MouseEvent;
      probe.push({ type: event.type, button: pointer.button, x: pointer.clientX, y: pointer.clientY });
    };
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'contextmenu', 'click']) {
      window.addEventListener(type, record, true);
    }
  });
}

export async function readProbe(page: Page, clear: boolean): Promise<ProbeEvent[]> {
  return page.evaluate((reset) => {
    const probe = (window as unknown as { __HUD_CLICK_PROBE__?: ProbeEvent[] }).__HUD_CLICK_PROBE__;
    if (!probe) throw new Error('The canvas probe is not installed; the sweep would measure nothing.');
    const seen = probe.slice();
    if (reset) probe.length = 0;
    return seen;
  }, clear);
}

export function summarise(events: ProbeEvent[]): string {
  const seen = new Map<string, string[]>();
  for (const event of events) {
    const key = `(${event.x},${event.y})`;
    seen.set(key, [...(seen.get(key) ?? []), `${event.type}/button ${event.button}`]);
  }
  return Array.from(seen.entries()).map(([at, kinds]) => `${at}: ${kinds.join(', ')}`).join('; ');
}
