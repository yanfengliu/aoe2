// Work 142 M2b-1: the military card's keys and the unit cards as in Age of
// Empires II: Definitive Edition (DE). Every key here is the `definitive`
// profile's in the install's `resources/_common/dat/hotkeys.json`
// (`MILITARY_UNITS_HOTKEYS`, string 20014, and `UNIT_COMMAND_HOTKEYS`), and
// who is a civilian is DE's `selection_group_def.json` "civilians" group: see
// `src/ui/hud/commandCardKeys.ts` and `src/game/simulation/deCivilianUnits.ts`.
//
// Real input only: a unit is selected by a real click on its drawn body
// (`clickUnit`) and every key is a real keyboard press. Whether a ground order
// is armed is read from the view (`getArmedGroundOrder`); the orders the armed
// keys give are carried out in `attack-move-hotkey.spec.ts`,
// `patrol-interaction.spec.ts` and `attack-ground-hotkey.spec.ts`.
//
// Bound: the default map at boot (one Scout Cavalry, one sheep, Dark Age) and
// the unit showcase fixture (one Mangonel, one Fishing Ship, one Trade Cart).

import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

const armedGroundOrder = async (page: Page): Promise<string | null> => page.evaluate(
  () => window.__AOE2_TEST__!.getArmedGroundOrder(),
);

async function ownUnitId(page: Page, unitType: string): Promise<number> {
  const id = await page.evaluate((type) => window.__AOE2_TEST__!.getEconomyState().units.find(
    (unit) => unit.owner === 1 && unit.unitType === type,
  )?.id ?? null, unitType);
  expect(id, `the scenario starts the human with a ${unitType}`).not.toBeNull();
  return id!;
}

/** Selects the human's unit of this type by a real click on its drawn body. */
async function clickOwnUnit(page: Page, unitType: string, name: string): Promise<void> {
  const id = await ownUnitId(page, unitType);
  const unit = await page.evaluate((unitId) => window.__AOE2_TEST__!.getEconomyState().units
    .find((entry) => entry.id === unitId)!, id);
  await page.evaluate(({ x, y }) => window.__AOE2_TEST__!.centerCameraOnWorldPosition(x, y), { x: unit.x + 0.5, y: unit.y + 0.5 });
  await game.waitForRenderedFrames(page, 2);
  await game.clickUnit(page, id);
  // A key reads the selection now, so the test waits for the click's.
  await expect(page.locator('[data-selection-name]')).toHaveText(name);
}

const stanceButton = (page: Page, stance: string) => page.locator(`[data-command="stance-${stance}"]`);
const formationButton = (page: Page, formation: string) => page.locator(`[data-command="formation-${formation}"]`);

test.describe('DE military card and unit cards (work 142 M2b-1)', () => {
  test('A, S, D and F set the stances and Z, X, C and V the formations, drawn in DE\'s slots', async ({ page }) => {
    await game.waitForBoot(page);
    await clickOwnUnit(page, 'scout', 'Scout Cavalry');
    // The formation row is DE's grid row Z X C V: Line, Box, Staggered, Flank.
    await expect(page.locator('[data-command-group="formation"] [data-command]')).toHaveCount(4);
    expect(await page.locator('[data-command-group="formation"] [data-command]').evaluateAll(
      (buttons) => buttons.map((button) => (button as HTMLElement).dataset.command),
    )).toEqual(['formation-line', 'formation-box', 'formation-staggered', 'formation-flank']);
    expect(await page.locator('[data-command-group="stance"] [data-command]').evaluateAll(
      (buttons) => buttons.map((button) => (button as HTMLElement).dataset.command),
    )).toEqual(['stance-aggressive', 'stance-defensive', 'stance-stand-ground', 'stance-no-attack']);

    // DEFENSIVE S, STAND_GROUND D, NO_ATTACK F, AGGRESSIVE A: each presses its button.
    for (const [key, stance] of [['s', 'defensive'], ['d', 'stand-ground'], ['f', 'no-attack'], ['a', 'aggressive']] as const) {
      await page.keyboard.press(key);
      await expect(stanceButton(page, stance), `${key.toUpperCase()} did not set ${stance}`).toHaveAttribute('aria-pressed', 'true');
    }
    // A is the Aggressive stance now, never attack-move.
    expect(await armedGroundOrder(page)).toBeNull();
    // FORMATION_BOX X, FORMATION_STAGGARD C, FORMATION_FLANK V, FORMATION_LINE Z.
    for (const [key, formation] of [['x', 'box'], ['c', 'staggered'], ['v', 'flank'], ['z', 'line']] as const) {
      await page.keyboard.press(key);
      await expect(formationButton(page, formation), `${key.toUpperCase()} did not set ${formation}`).toHaveAttribute('aria-pressed', 'true');
    }
  });

  test('R arms attack-move and Q patrol; G, T, W, E, B and P arm nothing on a Scout', async ({ page }) => {
    await game.waitForBoot(page);
    await clickOwnUnit(page, 'scout', 'Scout Cavalry');
    // STOP G, GARRISON T (a Scout cannot attack the ground), GUARD W, FOLLOW E
    // and BUILD_MENU B are not in this game; P is no DE key at all.
    for (const key of ['g', 't', 'w', 'e', 'b', 'p']) {
      await page.keyboard.press(key);
      expect(await armedGroundOrder(page), `${key.toUpperCase()} armed an order on a Scout`).toBeNull();
    }
    await expect(stanceButton(page, 'aggressive')).toHaveAttribute('aria-pressed', 'true');
    // ATTACK_MOVE R, then PATROL Q, which takes the armed order's place.
    for (const [key, order] of [['r', 'attack-move'], ['q', 'patrol']] as const) {
      await page.keyboard.press(key);
      expect(await armedGroundOrder(page), `${key.toUpperCase()} on a Scout`).toBe(order);
    }
  });

  test('a sheep\'s card has no military keys: A, G, P, R, Q and T arm nothing', async ({ page }) => {
    await game.waitForBoot(page);
    const sheep = await page.evaluate(() => window.__AOE2_TEST__!.getEconomyState().resources.find(
      (resource) => resource.resourceType === 'sheep' && (resource.owner === 1 || resource.baseOwner === 1),
    )?.id ?? null);
    expect(sheep, 'the default map gives the human a sheep').not.toBeNull();
    await game.clickUnit(page, sheep!);
    await expect.poll(async () => (await game.getSelectionState(page)).selectedEntityIds).toEqual([sheep]);
    for (const key of ['a', 'g', 'p', 'r', 'q', 't']) {
      await page.keyboard.press(key);
      expect(await armedGroundOrder(page), `${key.toUpperCase()} armed an order with a sheep selected`).toBeNull();
    }
  });

  test('T arms attack-ground on a Mangonel; a Fishing Ship builds a Fish Trap on Q; civilians have no stances', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'unit-showcase-fixture');
    // DE's "civilians" (selection_group_def.json): villagers, Fishing Ships,
    // Trade Carts and Trade Cogs. Their cards have no stance or formation, and
    // the military keys arm nothing on them.
    await clickOwnUnit(page, 'fishing-ship', 'Fishing Ship');
    await expect(page.locator('[data-command-group="stance"]')).toHaveCount(0);
    await expect(page.locator('[data-command-group="formation"]')).toHaveCount(0);
    for (const key of ['r', 'a']) {
      await page.keyboard.press(key);
      expect(await armedGroundOrder(page), `${key.toUpperCase()} armed an order on a Fishing Ship`).toBeNull();
    }
    // VILLAGER_BUILD_FISH_TRAP is Q with no build page: a Fishing Ship builds it at once.
    await page.keyboard.press('q');
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Fish Trap');
    await page.keyboard.press('Escape');

    await clickOwnUnit(page, 'trade-cart', 'Trade Cart');
    await expect(page.locator('[data-command-group="stance"]')).toHaveCount(0);
    await expect(page.locator('[data-command-group="formation"]')).toHaveCount(0);
    await page.keyboard.press('q');
    expect(await armedGroundOrder(page), 'Q armed patrol on a Trade Cart').toBeNull();

    // UNIT_COMMAND_HOTKEYS' ATTACK_GROUND: T, for a unit that may attack the ground.
    await clickOwnUnit(page, 'mangonel', 'Mangonel');
    await page.keyboard.press('t');
    expect(await armedGroundOrder(page)).toBe('attack-ground');
  });
});
