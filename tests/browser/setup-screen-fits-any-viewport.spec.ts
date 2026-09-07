// GATE: every control on the match setup screen (spec §4.6) is REACHABLE at
// any viewport height — the screen is the only way into the game, so a control
// it cannot show is a wall rather than a degraded experience. Up to 4d398996
// the overlay was `display: flex; align-items: center; overflow: visible` over
// a `body { overflow: hidden }`, so a panel taller than the viewport overflowed
// BOTH ends and nothing could scroll to either: at 1280x400 the "Skirmish"
// heading sat at y = -70 and Start ran 71px past the fold, where a click timed
// out. Defect register, 2026-09-06.
//
// Reachable is proved in four steps per control, because three of them alone
// would pass on the broken tree:
//   1. the heading is fully visible AT REST, before anything is scrolled;
//   2. every `[data-setup]` control can be brought fully inside the viewport by
//      WHEELING, the way a player does — never by `locator.scrollIntoViewIfNeeded`,
//      which Playwright runs inside `locator.click()` and which reached the
//      button at 1280x500 on the broken tree (measured 2026-09-06). The helper
//      fails the moment a wheel moves nothing, which is exactly the wall;
//   3. the topmost element at the control's own centre point IS that control,
//      so a box that is on-screen but behind an invisible overlay goes red;
//   4. Start is pressed with the real mouse at those coordinates and the match
//      it configures actually boots.
//
// BOUND. Viewports: 1280x400, 1024x520, 800x600, 1280x900 — two below the ~600px
// threshold, the suite's own default (which cleared the old layout by ONE pixel,
// which is why nobody found this), and one comfortably above. Controls: the
// heading plus all eleven `[data-setup]` elements (ten selects and Start).
// Chromium only, headless, default page zoom, at the browser's default font
// size. NOT covered: any other width than these four (the panel is
// `min(420px, 100%)`, so narrower widths shrink it and change the wrap of no
// text this spec reads), text-zoom and browser minimum-font-size settings,
// keyboard-only reach (Tab order is not asserted), touch scrolling, non-Chromium
// engines, and every screen other than setup.

import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 1280, height: 400, note: 'a window snapped to a strip' },
  { width: 1024, height: 520, note: 'half of a 1080p screen, with chrome' },
  { width: 800, height: 600, note: "the suite default — the old layout's one-pixel margin" },
  { width: 1280, height: 900, note: 'room to spare; the panel stays centred' },
];

const SETUP_CONTROLS = [
  'map', 'players', 'civ', 'teams', 'difficulty',
  'resources', 'victory', 'popcap', 'speed', 'start',
] as const;

interface Box { top: number; bottom: number; left: number; right: number; viewportHeight: number }

async function boxOf(page: Page, selector: string): Promise<Box> {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) throw new Error(`No element matches ${sel} on the setup screen.`);
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right,
      viewportHeight: window.innerHeight,
    };
  }, selector);
}

const fullyVisible = (box: Box): boolean => box.top >= 0 && box.bottom <= box.viewportHeight;

/** Wheel over the screen — the only scrolling gesture a player has here — until
 *  `selector` is wholly inside the viewport. Throws the moment a wheel moves
 *  nothing, because that is what "cannot be reached" looks like from outside. */
async function wheelIntoView(page: Page, selector: string): Promise<Box> {
  const { width, height } = page.viewportSize()!;
  await page.mouse.move(Math.round(width / 2), Math.round(height / 2));
  let box = await boxOf(page, selector);
  for (let nudge = 0; nudge < 40 && !fullyVisible(box); nudge += 1) {
    const before = box.top;
    await page.mouse.wheel(0, box.top < 0 ? -120 : 120);
    await page.waitForTimeout(50);
    box = await boxOf(page, selector);
    if (box.top === before) {
      throw new Error(
        `${selector} sits at y ${Math.round(box.top)}..${Math.round(box.bottom)} in a `
        + `${width}x${height} viewport and a wheel over the setup screen moves it not at all, `
        + 'so a player cannot reach it: the screen neither scrolls nor shrinks to fit. '
        + 'Every setup control must be reachable at every viewport height.',
      );
    }
  }
  if (!fullyVisible(box)) {
    throw new Error(
      `${selector} is still only partly on screen after 40 wheel nudges in a ${width}x${height} `
      + `viewport (y ${Math.round(box.top)}..${Math.round(box.bottom)} of ${box.viewportHeight}).`,
    );
  }
  return box;
}

/** The topmost painted element at a point, as a stable description. */
async function topmostAt(page: Page, x: number, y: number): Promise<string> {
  return page.evaluate(([px, py]) => {
    const hit = document.elementFromPoint(px, py);
    if (!hit) return 'nothing — the point is outside the viewport';
    const setup = hit.closest('[data-setup]');
    return setup ? `[data-setup="${setup.getAttribute('data-setup')}"]` : `${hit.tagName.toLowerCase()}.${hit.className}`;
  }, [x, y]);
}

for (const { width, height, note } of VIEWPORTS) {
  test(`every setup control is reachable at ${width}x${height} (${note})`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.locator('[data-hud="setup-screen"]')).toBeVisible();

    // 1. The heading is on screen the moment the page settles — nothing to
    //    scroll for, no hint that the screen begins above the fold.
    const title = await boxOf(page, '.setup-title');
    expect(
      fullyVisible(title),
      `The "Skirmish" heading must be fully visible at rest at ${width}x${height}; it sits at `
      + `y ${Math.round(title.top)}..${Math.round(title.bottom)} of ${title.viewportHeight}.`,
    ).toBe(true);

    // 2 and 3. Every control can be wheeled into view, and nothing covers it.
    for (const control of SETUP_CONTROLS) {
      const selector = `[data-setup="${control}"]`;
      const box = await wheelIntoView(page, selector);
      const centreX = Math.round((box.left + box.right) / 2);
      const centreY = Math.round((box.top + box.bottom) / 2);
      expect(
        await topmostAt(page, centreX, centreY),
        `${selector} is on screen at ${width}x${height} but something else is painted at its centre.`,
      ).toBe(selector);
    }

    // 4. Start really starts the match — a real mouse press at the button's own
    //    coordinates, not a locator click that would scroll for us first.
    await page.selectOption('[data-setup="civ"]', 'Franks');
    const start = await wheelIntoView(page, '[data-setup="start"]');
    await page.mouse.click(
      Math.round((start.left + start.right) / 2),
      Math.round((start.top + start.bottom) / 2),
    );
    await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true, undefined, { timeout: 60_000 });
    expect(new URL(page.url()).searchParams.get('civ')).toBe('Franks');
  });
}
