// When a match ends the game must tell the player, legibly, what happened.
//
// Owner report (2026-09-05, playing to conquest and LOSING): the entire result
// was a `hud-footer` at (12, 611), 420x97, bottom-left, in 13px
// `rgba(226,234,243,0.56)` grey, reading
//   "All of your units and biuldings have been destroyed. / Conquest Victory /
//    Player 1: 668 / Player 2: 1809"
// — a loss announced as a Victory, with no winner named, no overlay, no
// dimming and nothing to act on. Reproduced here at bcdc88c3 on
// `conquest-defeat-fixture`: outcome `defeat`, and the rendered footer said
// "Conquest Victory". `matchState.outcome` was correct in the same object and
// was rendered nowhere: `formatWinConditionLabel` built the label from
// `winCondition` alone, so a win and a loss printed the identical string.
//
// BOUND — what this proves and no more. Four REAL matches, each played in the
// browser until `matchState.outcome !== 'running'`, at the suite's 800x600
// viewport:
//   conquest-victory-fixture (victory, 2 players),
//   conquest-defeat-fixture  (defeat, 2 players, human holds the HIGHER score
//                             — 50 vs 10 — so score cannot name the winner),
//   score-timer-draw-fixture (draw, 2 players tied at 180),
//   score-timer-defeat-fixture (defeat, 3 players, P2 the sole top scorer).
// For each it asserts (1) the announcement's rendered TEXT — never
// `matchState.outcome`, since the defect is that the field was right and
// unrendered — names the outcome and never names a different one; (2) the
// winner is named; (3) the announcement is legible: an overlay that is
// visible, covers at least a quarter of the viewport, dims what is behind it,
// and sets its headline at 24px or more in a colour at least 80% opaque; and
// (4) it offers one control that dismisses it, after which the corrected
// footer record remains.
//
// It does NOT cover: wonder or relic DEFEAT wording (no fixture ends a match
// that way — `tests/ui/matchResultAnnouncement.test.ts` covers those labels
// as pure renders), a multi-opponent CONQUEST defeat (no fixture), viewports
// other than 800x600, keyboard reachability of the dismiss control, or what
// the overlay does across a restart. That the overlay stays out of a LIVE
// match is not asserted here either — `[hidden]` with an author `display`
// is a pixel question, held by the capture pair in the handoff and by
// `hud-opaque-surfaces-swallow-clicks`, which sweeps only what it can see.

import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

interface Fixture {
  seed: string;
  outcome: 'victory' | 'defeat' | 'draw';
  /** The word the player must read. */
  says: RegExp;
  /** Words that would be a lie about this match. */
  neverSays: RegExp[];
  /** How the winner must be named. */
  winner: RegExp;
  maxTicks: number;
}

const FIXTURES: Fixture[] = [
  {
    seed: 'conquest-victory-fixture',
    outcome: 'victory',
    says: /victory/i,
    neverSays: [/defeat/i],
    winner: /winner:\s*you/i,
    maxTicks: 600,
  },
  {
    seed: 'conquest-defeat-fixture',
    outcome: 'defeat',
    says: /defeat/i,
    neverSays: [/victor/i],
    winner: /winner:\s*player 2/i,
    maxTicks: 600,
  },
  {
    seed: 'score-timer-draw-fixture',
    outcome: 'draw',
    says: /draw/i,
    neverSays: [/victor/i, /defeat/i],
    winner: /no winner/i,
    maxTicks: 200,
  },
  {
    seed: 'score-timer-defeat-fixture',
    outcome: 'defeat',
    says: /defeat/i,
    neverSays: [/victor/i],
    winner: /winner:\s*player 2/i,
    maxTicks: 200,
  },
];

/** Play until the match resolves, in chunks, and report the outcome it reached. */
async function playToResolution(page: Page, maxTicks: number): Promise<string> {
  const chunk = 50;
  for (let advanced = 0; advanced < maxTicks; advanced += chunk) {
    const snapshot = await page.evaluate(
      ([ticks, ms]) => window.__AOE2_TEST__!.advanceTicks(ticks, ms),
      [chunk, 100] as const,
    );
    if (snapshot.hudState.matchState.outcome !== 'running') {
      // One rendered frame after the sim resolves, so the HUD has drawn it.
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => { requestAnimationFrame(() => { resolve(); }); });
      }));
      return snapshot.hudState.matchState.outcome;
    }
  }
  return 'running';
}

for (const fixture of FIXTURES) {
  test(`announces a ${fixture.outcome} legibly on ${fixture.seed}`, async ({ page }) => {
    await game.waitForBootWithSeed(page, fixture.seed);
    const reached = await playToResolution(page, fixture.maxTicks);
    // The premise. Without it a fixture that stopped resolving would leave
    // every assertion below reading an empty surface and passing as "no lie
    // found" — "did not run" reported as "passed".
    expect(
      reached,
      `${fixture.seed} did not resolve within ${fixture.maxTicks} ticks, so nothing below was `
        + 'measured on a finished match',
    ).toBe(fixture.outcome);

    const overlay = page.locator('[data-hud="match-result"]');
    await expect(
      overlay,
      'a finished match must be announced by a surface the player cannot miss',
    ).toBeVisible();

    // (1) + (2): what the player reads. Both surfaces, so neither can lie
    // while the other tells the truth.
    const footer = page.locator('[data-hud="match-summary"]');
    for (const [name, locator] of [['overlay', overlay], ['footer card', footer]] as const) {
      const text = (await locator.innerText()).trim();
      expect(text, `${name}: a finished match must not be announced with an empty surface`)
        .not.toBe('');
      expect(text, `${name} must say the match was a ${fixture.outcome}. Read: ${JSON.stringify(text)}`)
        .toMatch(fixture.says);
      for (const lie of fixture.neverSays) {
        expect(
          text,
          `${name} calls a ${fixture.outcome} something else (${String(lie)}). `
            + `Read: ${JSON.stringify(text)}`,
        ).not.toMatch(lie);
      }
      expect(text, `${name} must name who won. Read: ${JSON.stringify(text)}`)
        .toMatch(fixture.winner);
    }

    // (3): legibility. The defect was not only that the words were wrong — a
    // player could finish a match without noticing it had ended.
    const legibility = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('[data-hud="match-result"]')!;
      const headline = document.querySelector<HTMLElement>('[data-hud="match-result-outcome"]')!;
      const rect = root.getBoundingClientRect();
      const headlineStyle = getComputedStyle(headline);
      const rootStyle = getComputedStyle(root);
      const alphaOf = (colour: string): number => {
        const parts = /rgba?\(([^)]+)\)/.exec(colour);
        if (!parts) return 1;
        const values = parts[1].split(',').map((piece) => Number(piece.trim()));
        return values.length < 4 ? 1 : values[3];
      };
      return {
        area: (rect.width * rect.height) / (window.innerWidth * window.innerHeight),
        headlineFontSize: Number.parseFloat(headlineStyle.fontSize),
        headlineAlpha: alphaOf(headlineStyle.color),
        backdropAlpha: alphaOf(rootStyle.backgroundColor),
        pointerEvents: rootStyle.pointerEvents,
      };
    });
    expect(legibility.area, 'the announcement must own the screen, not a corner of it')
      .toBeGreaterThan(0.25);
    expect(legibility.headlineFontSize, 'the result was announced in 13px before this')
      .toBeGreaterThanOrEqual(24);
    expect(legibility.headlineAlpha, 'the result was announced in 56%-opaque grey before this')
      .toBeGreaterThanOrEqual(0.8);
    expect(legibility.backdropAlpha, 'the match is over: what is behind must be dimmed')
      .toBeGreaterThan(0);
    expect(legibility.pointerEvents, 'the overlay must take the clicks it covers').not.toBe('none');

    // (4): a way out of it, and the record survives.
    await page.locator('[data-hud="match-result-dismiss"]').click();
    await expect(overlay, 'the dismiss control must actually dismiss').toBeHidden();
    await expect(footer, 'the corrected record stays after the overlay is dismissed').toBeVisible();
    expect((await footer.innerText()).trim()).toMatch(fixture.says);
  });
}

test('a live match is not announced as finished', async ({ page }) => {
  // The over-fix guard. `.hud-halt-notice` paid for this exact trap: an author
  // `display` outranks the user agent's `[hidden] { display: none }`, so a
  // modal that only sets `hidden` covers every frame of a running game.
  await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
  const overlay = page.locator('[data-hud="match-result"]');
  await expect(overlay, 'the overlay must be mounted, or the check above proves nothing')
    .toBeAttached();
  await expect(overlay, 'a running match must show no result overlay').toBeHidden();
  await expect(page.locator('[data-hud="match-summary"]')).toBeHidden();
});
