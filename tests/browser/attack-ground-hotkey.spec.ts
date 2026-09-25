import { expect, test } from '@playwright/test';

import {
  BLAST_CENSUS_ATTACKER,
  BLAST_CENSUS_GROUND_TARGET,
  blastCensusSeed,
  blastCensusWitnessCell,
} from '../../src/game/simulation/fixtures/blastCensusLayout';
import * as game from './helpers/gameTestHelpers';

// Attack-ground is reachable only through the G-then-click interaction, so the
// blast census proving the simulation (tests/simulation/blastCensus.test.ts)
// says nothing about whether a player can give the order and see it carried
// out. Defect register, "The Siege Onager fired direct hits with no splash"
// (2026-09-24): a Siege Onager's ground order hurt nobody, and every
// bombardment fired one shot and then stood silent.
//
// The fixture is the census's: owner 1's Siege Onager, an empty ground cell
// six cells north of it, and owner 2's Villagers beside that cell, one inside
// the 1.5 blast and one just outside it, with both AIs off. The pause is the
// test API's, so `advanceTicks` steps exactly the ticks it is asked for.
//
// BOUND: one unit type, one order, 200 ticks. That a Demolition Ship is
// refused the order is the census's, at the validator the click reaches.
test.describe('attack-ground interaction', () => {
  test('G then a click sends a Siege Onager to bombard the ground, a shot every reload', async ({ page }) => {
    const seed = blastCensusSeed('siege-onager');
    await game.waitForPausedBootWithSeed(page, seed);
    await page.evaluate(({ x, y }) => window.__AOE2_TEST__!.centerCameraOnWorldPosition(x, y), {
      x: BLAST_CENSUS_ATTACKER.x,
      y: (BLAST_CENSUS_ATTACKER.y + BLAST_CENSUS_GROUND_TARGET.y) / 2,
    });
    await game.waitForRenderedFrames(page, 2);

    await game.clickCell(page, BLAST_CENSUS_ATTACKER.x, BLAST_CENSUS_ATTACKER.y);
    await expect
      .poll(() => page.evaluate(() => window.__AOE2_TEST__!.getSelectionState().selectedEntityType))
      .toBe('siege-onager');
    await page.keyboard.press('g');
    await game.clickCell(page, BLAST_CENSUS_GROUND_TARGET.x, BLAST_CENSUS_GROUND_TARGET.y);

    const inside = blastCensusWitnessCell('siege-onager', 'ground', true);
    const outside = blastCensusWitnessCell('siege-onager', 'ground', false);
    const result = await page.evaluate(({ attackerCell, insideCell, outsideCell }) => {
      const api = window.__AOE2_TEST__!;
      const onager = api.getEconomyState().units.find(
        (u) => u.owner === 1 && u.x === attackerCell.x && u.y === attackerCell.y,
      );
      if (!onager) return null;
      const standing = (cell: { x: number; y: number }) =>
        api.getEconomyState().units.some((u) => u.owner === 2 && u.x === cell.x && u.y === cell.y);
      const before = { inside: standing(insideCell), outside: standing(outsideCell) };
      const launchTicks = new Map<number, number>();
      for (let tick = 0; tick < 200; tick += 1) {
        api.advanceTicks(1);
        for (const shot of api.getInFlightProjectiles()) {
          if (shot.attackerId === onager.id) launchTicks.set(shot.id, shot.launchTick);
        }
      }
      return {
        before,
        after: { inside: standing(insideCell), outside: standing(outsideCell) },
        command: api.getDebugSnapshot().unitPaths.find((entry) => entry.id === onager.id)?.commandType ?? null,
        launchTicks: [...launchTicks.values()].sort((a, b) => a - b),
      };
    }, { attackerCell: BLAST_CENSUS_ATTACKER, insideCell: inside, outsideCell: outside });

    expect(result, 'no Siege Onager of owner 1 on the fixture').not.toBeNull();
    expect(result!.before, 'both witnesses stand before the order').toEqual({ inside: true, outside: true });
    expect(result!.command, 'the G-then-click gave no attack-ground order').toBe('attack-ground');
    expect(result!.launchTicks.length, `shots launched at ticks ${result!.launchTicks.join(', ')}`).toBeGreaterThanOrEqual(3);
    expect(result!.after, 'the stones must kill the Villager inside the blast and spare the one outside it')
      .toEqual({ inside: false, outside: true });
  });
});
