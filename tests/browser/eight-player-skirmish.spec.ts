// An eight-player skirmish, opened the way a player opens one, and played with
// a mouse on the far side of a map the 1v1 could not hold.
//
// The seats were never the blocker — §4's size ladder was. Every clamp in the
// input and camera layers used to be written against the two-player map's
// 60x36, so on a 116x72 world a click past x=59 landed 40 cells from where the
// player aimed, and the camera could not reach the far corner at all. Both are
// silent: nothing throws, the game just stops obeying. So this test drives the
// far half of the map with real input.

import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

test.describe('a skirmish with eight players', () => {
  test('opens on a map that fits them and takes clicks on its far side', async ({ page }) => {
    await page.goto('/?seed=aoe2-prototype&players=8');
    await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
    await expect.poll(async () => (await game.getSnapshot(page)).hudState.tick).toBeGreaterThan(0);

    // Eight town centres, one per seat, on a map bigger than the 1v1's.
    const snapshot = await game.getSnapshot(page);
    const townCenters = snapshot.economyState.buildings
      .filter((building) => building.buildingType === 'town-center');
    expect(townCenters).toHaveLength(8);
    expect(new Set(townCenters.map((building) => building.owner)).size).toBe(8);

    const mapSize = await page.evaluate(() => window.__AOE2_TEST__!.getMapSize());
    expect(mapSize.width).toBeGreaterThan(60);
    expect(mapSize.height).toBeGreaterThan(36);
    const farthest = townCenters
      .reduce((far, building) => (building.x > far.x ? building : far), townCenters[0]!);
    expect(farthest.x, 'a seat should stand past the 1v1 map’s right edge').toBeGreaterThan(59);

    // The camera can reach the far side — the old bound stopped it at x=59.
    await page.evaluate(() => {
      window.__AOE2_TEST__!.centerCameraOnWorldPosition(90, 50);
    });

    // And the mouse resolves to the cell it is actually over out there. This
    // is the assertion the stale clamp fails: it answered 59 for every cell
    // past the two-player map's right edge, so a build would land 31 cells
    // away from the pointer without anything reporting an error.
    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await page.locator('[data-command="build-house"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');
    await game.moveMouseToCell(page, 90, 50);
    const preview = await page.evaluate(() => window.__AOE2_TEST__!.getPlacementPreviewState());
    expect(preview).toMatchObject({ active: true, buildingType: 'house', cellX: 90, cellY: 50 });
  });
});
