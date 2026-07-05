// Deferred follow-up (v0.1.16): replay timeline scrub workflow e2e.
// Drives the timeline scrubber + step buttons against a real replay
// session and asserts on `__AOE2_TEST__.replay.getReplayCurrentTick()`.
// The timeline uses a native `<input type="range">` element so the
// "drag synthesis" referenced in the v0.1.12 thread close becomes a
// straightforward value-set + change-event dispatch — no
// `page.mouse.down/move/up` choreography needed.
//
// Coverage caveat: `getReplayCurrentTick()` exposes the controller's
// `displayedTick`, which `scrubTo(tick, { coalesce: true })` (called
// by the `input` listener) updates synchronously. So strictly the
// assertions below verify the `input` (coalesced-scrub) path. The
// `change` event dispatch exercises the commit path (which advances
// the underlying replay state machine), but its side effect lives
// outside the public test surface — flagged in the v0.1.16 review
// thread (`docs/threads/current/replay-deferred-followups/.../scrub-e2e-iter-1/REVIEW.md`).
// A future task will expose `getReplayCommittedTick()` or similar so
// the commit phase has a dedicated observable.

import { expect, test, type Locator } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

// Dispatches a value-then-event sequence on a native <input type=range>
// that mirrors what the user produces by dragging + releasing the
// thumb: an `input` event for the coalesced-scrub callback, then a
// `change` event for the commit callback. (TimelinePanel also listens
// to `pointerup` for commit; either one works here.)
async function commitRangeValue(range: Locator, value: number): Promise<void> {
  await range.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test.describe('replay-scrub timeline — Phase 3C+ e2e', () => {
  test.beforeEach(async ({ page }) => {
    test.slow();
    await game.waitForBoot(page);

    // Drive ticks so the live recorder accumulates commands.
    await page.evaluate(() => {
      const api = window.__AOE2_TEST__;
      if (!api) throw new Error('test API not installed');
      api.advanceTicks(120, 100);
    });

    // Use the seeded prior-session path — a live-session bundle has
    // `metadata.endTick === 0` until the session is stopped, so the
    // timeline scrubber would be disabled (slider min === max). The
    // save+load round-trip in seedPriorSession() closes the session
    // and persists finalized metadata, so the prior tab's bundle has
    // a real endTick that the scrubber can drive.
    await page.evaluate(async () => {
      await window.__AOE2_TEST__!.replay.seedPriorSession();
    });

    await page.locator('[data-hud="menu-button"]').click();
    await page.locator('[data-hud="replay-load-button"]').click();
    await page.locator('[data-testid="replay-load-tab-prior"]').click();
    await page.locator('[data-testid="replay-load-prior-row"]').first().click();
    // Row click → async loadPriorSessionBundle from IDB → enterReplay.
    // Wait for the mode flip rather than reading immediately (race).
    await expect.poll(
      () => page.evaluate(() => window.__AOE2_TEST__!.replay.getReplayMode()),
      { timeout: 5000 },
    ).toBe('replay');
  });

  test('Timeline range scrub commits to the requested tick', async ({ page }) => {
    const timeline = page.locator('[data-testid="timeline-panel"]');
    await expect(timeline).toBeVisible();

    const range = page.locator('[data-testid="timeline-range"]');
    await expect(range).toBeVisible();

    // Read the range's max so we pick a deterministic mid-replay
    // target rather than a hard-coded tick that might be out-of-range.
    const maxValueRaw = await range.getAttribute('max');
    const maxValue = Number(maxValueRaw ?? '0');
    expect(maxValue).toBeGreaterThan(0);
    // Aim a third of the way in — well within the bundle's range and
    // far enough from start/end to verify both bounds work.
    const targetTick = Math.max(1, Math.floor(maxValue / 3));

    await commitRangeValue(range, targetTick);

    // The controller's coalesced-scrub path is synchronous (chain:
    // input listener → controller.scrubTo({ coalesce: true }) →
    // displayedTick = targetTick). `expect.poll` keeps the assertion
    // robust if a future refactor inserts a microtask anywhere in
    // that chain.
    await expect.poll(
      () => page.evaluate(() => window.__AOE2_TEST__!.replay.getReplayCurrentTick()),
      { timeout: 2000 },
    ).toBe(targetTick);
  });

  test('Step-back and step-forward buttons advance the replay one tick at a time', async ({ page }) => {
    const range = page.locator('[data-testid="timeline-range"]');
    const maxValueRaw = await range.getAttribute('max');
    const maxValue = Number(maxValueRaw ?? '0');
    expect(maxValue).toBeGreaterThan(2);

    // Seed a known mid-replay tick first so step-back has somewhere
    // to step back FROM (start tick is the lower bound).
    const seedTick = Math.max(2, Math.floor(maxValue / 2));
    await commitRangeValue(range, seedTick);
    await expect.poll(
      () => page.evaluate(() => window.__AOE2_TEST__!.replay.getReplayCurrentTick()),
      { timeout: 2000 },
    ).toBe(seedTick);

    await page.locator('[data-testid="timeline-step-forward"]').click();
    await expect.poll(
      () => page.evaluate(() => window.__AOE2_TEST__!.replay.getReplayCurrentTick()),
      { timeout: 2000 },
    ).toBe(seedTick + 1);

    // Step back twice (returns below the seed).
    await page.locator('[data-testid="timeline-step-back"]').click();
    await page.locator('[data-testid="timeline-step-back"]').click();
    await expect.poll(
      () => page.evaluate(() => window.__AOE2_TEST__!.replay.getReplayCurrentTick()),
      { timeout: 2000 },
    ).toBe(seedTick - 1);
  });

  test('Exit button leaves replay mode', async ({ page }) => {
    await page.locator('[data-testid="timeline-exit"]').click();
    const mode = await page.evaluate(() =>
      window.__AOE2_TEST__!.replay.getReplayMode(),
    );
    expect(mode).toBe('live');
  });
});
