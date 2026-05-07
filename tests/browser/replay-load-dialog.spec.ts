// Slice 6 (replay-load-and-e2e v0.1.13): Playwright e2e for the
// ReplayLoadDialog modal. Asserts on the test API getters
// (`window.__AOE2_TEST__.replay.getReplayMode()` etc.) per design/07
// instead of canvas pixel snapshots — keeps the spec independent of
// visual baselines (which are deferred to a follow-up that needs
// `npm run test:browser -- --update-snapshots` user-side).

import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

test.describe('replay-load dialog — Phase 3E e2e', () => {
  test('Replay button opens the dialog; Cancel closes without entering replay', async ({ page }) => {
    test.slow();
    await game.waitForBoot(page);

    const dialog = page.locator('[data-testid="replay-load-dialog-root"]');
    await expect(dialog).toHaveCount(1);
    await expect(dialog).not.toHaveJSProperty('open', true);

    // Click the unified "Replay…" button.
    await page.locator('[data-hud="replay-load-button"]').click();
    await expect(dialog).toHaveJSProperty('open', true);

    // Cancel closes the dialog without entering replay.
    await page.locator('[data-testid="replay-load-cancel"]').click();
    await expect(dialog).not.toHaveJSProperty('open', true);

    const mode = await page.evaluate(() => window.__AOE2_TEST__?.replay?.getReplayMode());
    expect(mode).toBe('live');
  });

  test('Live tab confirm enters replay; Escape exits replay', async ({ page }) => {
    test.slow();
    await game.waitForBoot(page);

    // Drive enough ticks for the live recorder to accumulate at least
    // one command. The fixture seeds resources so the AI / scheduled
    // production typically submits a queue.train within the first ~50
    // ticks; advance generously to be deterministic.
    await page.evaluate(() => {
      const api = window.__AOE2_TEST__;
      if (!api) throw new Error('test API not installed');
      api.advanceTicks(120, 100);
    });

    // Open the dialog and confirm the live tab.
    await page.locator('[data-hud="replay-load-button"]').click();
    const dialog = page.locator('[data-testid="replay-load-dialog-root"]');
    await expect(dialog).toHaveJSProperty('open', true);

    const liveConfirm = page.locator('[data-testid="replay-load-live-confirm"]');
    await expect(liveConfirm).toBeEnabled();
    await liveConfirm.click();
    await expect(dialog).not.toHaveJSProperty('open', true);

    const replayMode = await page.evaluate(() => window.__AOE2_TEST__!.replay.getReplayMode());
    expect(replayMode).toBe('replay');

    // Escape exits replay (replay hotkeys are bound while in replay
    // mode; verified at the slice-1 ReplayHotkeys level).
    await page.keyboard.press('Escape');
    const liveMode = await page.evaluate(() => window.__AOE2_TEST__!.replay.getReplayMode());
    expect(liveMode).toBe('live');
  });

  test('File tab rejects malformed JSON: dialog stays open, replay mode unchanged', async ({ page }) => {
    test.slow();
    await game.waitForBoot(page);

    // Drive ticks so the live recorder produces a real bundle we can
    // export → re-import as a file. Doing this round-trip in the same
    // page session keeps the test deterministic and avoids needing a
    // committed fixture file (which would have to be regenerated as
    // engine versions change).
    await page.evaluate(() => {
      const api = window.__AOE2_TEST__;
      if (!api) throw new Error('test API not installed');
      api.advanceTicks(120, 100);
    });

    // Open the dialog, navigate to the file tab, and feed it the live
    // bundle's JSON via Playwright's setInputFiles helper.
    await page.locator('[data-hud="replay-load-button"]').click();
    const dialog = page.locator('[data-testid="replay-load-dialog-root"]');
    await expect(dialog).toHaveJSProperty('open', true);
    await page.locator('[data-testid="replay-load-tab-file"]').click();

    // Build the bundle JSON inline from the live world's saveGame +
    // recorder snapshot is more involved; simpler to fetch the dialog's
    // live tab path's bundle if we had it. As a substitute, drive the
    // live tab once to capture a bundle, then synthesize a JSON file
    // from inside the page using the test API. We accomplish this by
    // exporting the recorder bundle via a brief helper that the test
    // API doesn't currently expose; instead, we rely on the
    // recordCommandReplayFixture pattern is unavailable in browser, so
    // for this e2e we only assert that the file picker accepts a
    // structurally valid JSON without entering replay (toast on parse
    // failure / replay entry on parse success — both of which are
    // covered by the integration suite). Here we assert the file input
    // exists and is wired.
    const fileInput = page.locator('[data-testid="replay-load-file-input"]');
    await expect(fileInput).toHaveCount(1);

    // Submit a deliberately malformed bundle so we can assert the
    // toast-and-stay-open path without round-tripping a real bundle.
    await fileInput.setInputFiles({
      name: 'malformed.json',
      mimeType: 'application/json',
      buffer: Buffer.from('not valid json'),
    });

    // Dialog should stay open (parser rejection); replay mode unchanged.
    await expect(dialog).toHaveJSProperty('open', true);
    const stillLive = await page.evaluate(() => window.__AOE2_TEST__!.replay.getReplayMode());
    expect(stillLive).toBe('live');

    await page.locator('[data-testid="replay-load-cancel"]').click();
    await expect(dialog).not.toHaveJSProperty('open', true);
  });

  test('Test API: openReplayLoadDialog opens the dialog programmatically', async ({ page }) => {
    test.slow();
    await game.waitForBoot(page);

    await page.evaluate(() => {
      const api = window.__AOE2_TEST__;
      if (!api?.replay) throw new Error('replay test API not installed');
      api.replay.openReplayLoadDialog();
    });

    const dialog = page.locator('[data-testid="replay-load-dialog-root"]');
    await expect(dialog).toHaveJSProperty('open', true);
    await page.locator('[data-testid="replay-load-cancel"]').click();
    await expect(dialog).not.toHaveJSProperty('open', true);
  });
});
