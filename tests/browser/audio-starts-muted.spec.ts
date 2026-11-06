import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

// The game starts muted (spec §14.5; the owner, 2026-11-05: "I dont want the
// game to be making any sound", then "Yes, start muted"). A page in a browser
// profile that never stored a choice boots with the speaker toggle off; one
// real click on "Toggle sound" turns the sound on and stores '0'; and a reload
// boots with it still on.
//
// BOUND: the toggle's state, its title and the stored choice, on the default
// map at boot. Whether a cue sounds, for each stored value and for a storage
// that throws, is tests/ui/gameAudio.test.ts. The suite runs headless, where
// Playwright starts Chromium with --mute-audio, so nothing here listens, and
// the click that turns the sound on plays nothing anyone hears.

const MUTED_KEY = 'aoe2.audio.muted';
const SOUND_OFF = 'Sound off — click to unmute';
const SOUND_ON = 'Sound on — click to mute';

function storedChoice(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), MUTED_KEY);
}

test('a fresh page starts muted, and the speaker toggle turns the sound on for good', async ({ page }) => {
  await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
  const toggle = page.getByRole('button', { name: 'Toggle sound' });
  expect(await storedChoice(page), 'a fresh profile already held a choice').toBeNull();
  await expect(toggle, 'a player who never chose starts with the sound on').toHaveAttribute('title', SOUND_OFF);

  await toggle.click();
  await expect(toggle).toHaveAttribute('title', SOUND_ON);
  expect(await storedChoice(page), 'turning the sound on was not remembered').toBe('0');

  await page.reload();
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
  await expect(toggle, 'the sound the player turned on was off again after a reload').toHaveAttribute('title', SOUND_ON);
  expect(await storedChoice(page)).toBe('0');
});
