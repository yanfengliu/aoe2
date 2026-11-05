// Work 142 M2b-2: every building's command card takes Age of Empires II:
// Definitive Edition's (DE) default keys. Each key is the `definitive` profile's
// in the install's `resources/_common/dat/hotkeys.json`, the building's own group
// (BARRACKS_HOTKEYS and the others) with UNIT_COMMAND_HOTKEYS' UNGARRISON (G):
// see `src/ui/hud/buildingCardKeys.ts`, which cites each.
//
// Real input only: a building is selected by a real click on its drawn body
// (`clickUnit`, which reads the click stack) and every key is a real keyboard
// press. What a key did is read from the game: the building's production queue
// in order, or the player's stockpile for a trade.
//
// Bound: the building-card-keys fixture (the showcase's grid of one completed
// building of each type, Imperial Age, 50,000 of each resource), one building
// selected at a time, and a civilization whose card holds the keys a test
// presses: this game's tech tree gives each civilization its own buttons
// (the Britons have no Thumb Ring, Bloodlines or Redemption), and a key whose
// button the card lacks does nothing.

import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

const SEED = 'building-card-keys-fixture';

/** Selects the human's building of this type by a real click on its drawn body. */
async function clickOwnBuilding(page: Page, buildingType: string): Promise<void> {
  const building = await page.evaluate((type) => window.__AOE2_TEST__!.getEconomyState().buildings
    .find((entry) => entry.owner === 1 && entry.buildingType === type) ?? null, buildingType);
  expect(building, `the fixture gives the human a ${buildingType}`).not.toBeNull();
  await page.evaluate(({ x, y }) => window.__AOE2_TEST__!.centerCameraOnWorldPosition(x, y), {
    x: building!.x + building!.footprintWidth / 2,
    y: building!.y + building!.footprintHeight / 2,
  });
  await game.waitForRenderedFrames(page, 2);
  await game.clickUnit(page, building!.id);
  // A key reads the selection now, so the test waits for the click's.
  await expect.poll(async () => (await game.getSelectionState(page)).selectedEntityIds).toEqual([building!.id]);
}

const queuedNow = async (page: Page): Promise<string[]> => (await game.getSelectionState(page)).queue
  .map((entry) => entry.unitType ?? entry.technologyType ?? entry.label);

/**
 * Presses each key in turn and holds that it queued exactly the unit or
 * technology DE puts on that key of this card, and nothing besides.
 */
async function expectKeysQueue(page: Page, presses: ReadonlyArray<readonly [key: string, queued: string]>): Promise<void> {
  const expected = await queuedNow(page);
  for (const [key, queued] of presses) {
    await page.keyboard.press(key);
    expected.push(queued);
    await expect.poll(() => queuedNow(page), { message: `${key} queues ${queued}` }).toEqual(expected);
  }
}

/** Presses each key and holds that it queued nothing. */
async function expectKeysQueueNothing(page: Page, keys: readonly string[]): Promise<void> {
  const before = await queuedNow(page);
  for (const key of keys) await page.keyboard.press(key);
  // FRAMES, not a sleep: a queued command shows in the state a frame or two on.
  await game.waitForRenderedFrames(page, 6);
  expect(await queuedNow(page), `${keys.join(' ')} queued something`).toEqual(before);
}

const commandOrder = async (page: Page, group: string): Promise<string[]> => page
  .locator(`[data-command-group="${group}"] [data-command]`)
  .evaluateAll((buttons) => buttons.map((button) => (button as HTMLElement).dataset.command ?? ''));

test.describe('DE building cards and their keys (work 142 M2b-2)', () => {
  test('the Barracks, Archery Range, Stable and Siege Workshop train and research on DE\'s keys', async ({ page }) => {
    // The Mongols' Archery Range and Stable hold every key DE gives them here.
    await game.waitForBootWithSeed(page, SEED, 'Mongols');
    await clickOwnBuilding(page, 'barracks');
    await expectKeysQueue(page, [
      ['q', 'militia'], ['w', 'spearman'],
      ['a', 'man-at-arms-upgrade'], ['s', 'pikeman-upgrade'], ['x', 'squires'],
    ]);
    // E is DE's Condottiero and Z its Gambesons, neither in this game.
    await expectKeysQueueNothing(page, ['e', 'z', 't', 'g']);

    await clickOwnBuilding(page, 'archery-range');
    await expectKeysQueue(page, [
      ['q', 'archer'], ['w', 'skirmisher'], ['e', 'cavalry-archer'],
      ['a', 'crossbowman-upgrade'], ['s', 'elite-skirmisher-upgrade'], ['d', 'heavy-cavalry-archer-upgrade'],
      ['z', 'thumb-ring'], ['c', 'parthian-tactics'],
    ]);

    await clickOwnBuilding(page, 'stable');
    await expectKeysQueue(page, [
      ['q', 'scout'], ['w', 'knight'], ['e', 'camel'],
      ['a', 'light-cavalry-upgrade'], ['s', 'cavalier-upgrade'], ['d', 'heavy-camel-upgrade'],
      ['z', 'bloodlines'], ['x', 'husbandry'],
    ]);

    await clickOwnBuilding(page, 'siege-workshop');
    await expectKeysQueue(page, [
      ['q', 'battering-ram'], ['w', 'mangonel'], ['e', 'scorpion'],
      ['a', 'capped-ram-upgrade'], ['s', 'onager-upgrade'], ['d', 'heavy-scorpion-upgrade'],
    ]);
  });

  test('the Blacksmith, University, Mill, camps and Monastery research on DE\'s keys', async ({ page }) => {
    await game.waitForBootWithSeed(page, SEED, 'Britons');
    await clickOwnBuilding(page, 'blacksmith');
    await expectKeysQueue(page, [
      ['q', 'forging'], ['w', 'scale-mail-armor'], ['e', 'scale-barding-armor'],
      ['a', 'fletching'], ['s', 'padded-archer-armor'],
    ]);

    await clickOwnBuilding(page, 'university');
    await expectKeysQueue(page, [
      ['q', 'masonry'], ['w', 'treadmill-crane'], ['e', 'heated-shot'], ['r', 'ballistics'], ['t', 'chemistry'],
      ['a', 'siege-engineers'], ['s', 'murder-holes'], ['d', 'fortified-wall'], ['f', 'guard-tower'],
    ]);

    await clickOwnBuilding(page, 'mill');
    await expectKeysQueue(page, [['q', 'horse-collar']]);
    await clickOwnBuilding(page, 'lumber-camp');
    await expectKeysQueue(page, [['q', 'double-bit-axe']]);
    await clickOwnBuilding(page, 'mining-camp');
    await expectKeysQueue(page, [['q', 'gold-mining'], ['w', 'stone-mining']]);

    await clickOwnBuilding(page, 'monastery');
    await expectKeysQueue(page, [
      ['q', 'monk'], ['r', 'fervor'], ['a', 'sanctity'], ['s', 'faith'], ['d', 'illumination'],
      ['f', 'block-printing'], ['x', 'theocracy'], ['c', 'herbal-medicine'],
    ]);
    // DE's Redemption (W), Atonement (E) and Heresy (Z): not the Britons' here.
    await expectKeysQueueNothing(page, ['w', 'e', 'z']);
  });

  test('the Monastery researches Redemption, Atonement and Heresy on W, E and Z', async ({ page }) => {
    await game.waitForBootWithSeed(page, SEED, 'Byzantines');
    await clickOwnBuilding(page, 'monastery');
    await expectKeysQueue(page, [['w', 'redemption'], ['e', 'atonement'], ['z', 'heresy']]);
  });

  test('a key two drawn tiers share presses the first of DE\'s line: T is Chemistry before the Bombard Tower', async ({ page }) => {
    // The Byzantines' University draws both at once (this game does not hold
    // the Bombard Tower back for Chemistry), the bridge listing the tower first.
    await game.waitForBootWithSeed(page, SEED, 'Byzantines');
    await clickOwnBuilding(page, 'university');
    await expect.poll(() => commandOrder(page, 'research')).toContain('research-bombard-tower-unlock');
    await expectKeysQueue(page, [['t', 'chemistry']]);
  });

  test('the Market trains, researches and trades on DE\'s keys', async ({ page }) => {
    await game.waitForBootWithSeed(page, SEED, 'Britons');
    await clickOwnBuilding(page, 'market');
    await expectKeysQueue(page, [['q', 'trade-cart'], ['w', 'caravan'], ['e', 'coinage'], ['r', 'guilds']]);
    const stock = async (): Promise<Record<string, number>> => {
      const resources = (await game.getEconomyState(page)).playerResources[1]!;
      return { food: resources.food, wood: resources.wood, gold: resources.gold, stone: resources.stone };
    };
    // MARKET_SELL_FOOD D, SELL_WOOD S, SELL_STONE F; BUY_FOOD C, BUY_WOOD X, BUY_STONE V.
    for (const [key, resource, sign] of [
      ['d', 'food', -1], ['s', 'wood', -1], ['f', 'stone', -1],
      ['c', 'food', 1], ['x', 'wood', 1], ['v', 'stone', 1],
    ] as const) {
      const before = await stock();
      await page.keyboard.press(key);
      await expect.poll(async () => Math.sign((await stock())[resource]! - before[resource]!), {
        message: `${key} trades ${resource}`,
      }).toBe(sign);
      const after = await stock();
      // The other side of the trade is gold, and no other resource moves.
      for (const other of ['food', 'wood', 'stone'].filter((name) => name !== resource)) {
        expect(after[other], `${key} moved ${other}`).toBe(before[other]);
      }
      expect(Math.sign(after.gold! - before.gold!), `${key} paid or took gold`).toBe(-sign);
    }
  });

  test('the Castle trains its unique unit, Trebuchet and Petard on Q W E and researches on DE\'s keys', async ({ page }) => {
    // The Mongols: Drill is DE's Unique Imperial Technology (D).
    await game.waitForBootWithSeed(page, SEED, 'Mongols');
    await clickOwnBuilding(page, 'castle');
    await expectKeysQueue(page, [
      ['q', 'mangudai'], ['w', 'trebuchet'], ['e', 'petard'],
      ['a', 'elite-mangudai-upgrade'], ['d', 'drill'],
      ['z', 'hoardings'], ['x', 'sappers'], ['c', 'conscription'], ['v', 'spies'],
    ]);
  });

  test('the Goths research Anarchy on S and Perfusion on D, DE\'s castle and imperial unique technologies', async ({ page }) => {
    await game.waitForBootWithSeed(page, SEED, 'Goths');
    await clickOwnBuilding(page, 'castle');
    await expectKeysQueue(page, [['q', 'huskarl'], ['s', 'anarchy'], ['d', 'perfusion']]);
  });

  test('the Britons\' Yeomen is on S, where DE files it, though this game researches it in the Imperial Age', async ({ page }) => {
    await game.waitForBootWithSeed(page, SEED, 'Britons');
    await clickOwnBuilding(page, 'castle');
    await expectKeysQueue(page, [['q', 'longbowman'], ['s', 'yeomen']]);
    // DE's D is the Britons' Warwolf, which this game does not have.
    await expectKeysQueueNothing(page, ['d']);
  });

  test('the Dock trains and researches on DE\'s keys', async ({ page }) => {
    await game.waitForBootWithSeed(page, SEED, 'Britons');
    await clickOwnBuilding(page, 'dock');
    await expectKeysQueue(page, [
      ['q', 'fishing-ship'], ['w', 'galley'], ['r', 'fire-ship'],
      ['a', 'transport-ship'], ['s', 'trade-cog'], ['d', 'demolition-ship'],
      ['x', 'war-galley-upgrade'], ['c', 'heavy-demolition-ship-upgrade'], ['v', 'cannon-galleon-unlock'],
    ]);
    // DE researches Careening at the University, so no key of the Dock's
    // presses it here; Z is DE's Gillnets, which this game does not have.
    await expectKeysQueueNothing(page, ['z', 'e', 't', 'f', 'g', 'b']);
  });

  test('a building\'s card draws its buttons in the order of DE\'s slots', async ({ page }) => {
    await game.waitForBootWithSeed(page, SEED, 'Britons');
    await clickOwnBuilding(page, 'blacksmith');
    // Q melee attack, W infantry armor, E cavalry armor, A arrows, S archer
    // armor; a line's tiers share their slot and keep their order.
    await expect.poll(() => commandOrder(page, 'research')).toEqual([
      'research-forging', 'research-iron-casting', 'research-blast-furnace',
      'research-scale-mail-armor', 'research-chain-mail-armor', 'research-plate-mail-armor',
      'research-scale-barding-armor', 'research-chain-barding-armor', 'research-plate-barding',
      'research-fletching', 'research-bodkin-arrow', 'research-bracer',
      'research-padded-archer-armor', 'research-leather-archer-armor', 'research-ring-archer-armor',
    ]);
    await clickOwnBuilding(page, 'market');
    // Sell Wood S, Sell Food D, Sell Stone F; Buy Wood X, Buy Food C, Buy Stone V.
    await expect.poll(() => commandOrder(page, 'market')).toEqual([
      'market-sell-wood', 'market-sell-food', 'market-sell-stone',
      'market-buy-wood', 'market-buy-food', 'market-buy-stone',
    ]);
  });
});
