// An enemy BUILDING shooting your villager raises the attack warning
// (v0.3.235, defect register 2026-09-24).
//
// THE DEFECT, reproduced here on the real match before it was fixed: a human
// villager walked into the enemy Town Centre's reach on `aoe2-prototype` and
// was shot from 25 to 10 hit points by tick 678, and the screen said nothing.
// No toast, and 0 screen pixels of the minimap mark. The warning read the
// swing feed, which records only a UNIT's swing: `towerCombatSystem` launched
// its arrows with no record, and the recorder refused any attacker that was
// not a unit. Definitive Edition warns whatever is attacking.
//
// THE CLASS is every attacker kind, and it is gated headlessly by
// `tests/simulation/playerHitCensus.test.ts`, which compares every hit point
// a player loses with the blows recorded for it. This spec is the real
// match's end of it: the blow reaches the words and the mark a player sees.
//
// HOW: boot the real match paused, send owner 2's Scout to the map corner
// farthest from the route (it attacks a villager passing its base, which is
// the unit path this spec is not about), walk the human villager nearest the
// enemy Town Centre up to its wall, and step one tick at a time until that
// villager loses hit points.
//
// BOUNDS, so a green run is not read for more than it holds:
//  - One building (a Town Centre), one map, one villager, one blow. Towers,
//    Castles, blasts and bombardments are the census's.
//  - The instrument checks fail by name if the villager was never hurt, if a
//    unit had a shot in the air at it, or if any unit of owner 2 stood within
//    two cells of it when it was hurt, close enough to have swung. So the blow
//    that reached the screen can only have been the Town Centre's.
import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
import { ALERT_SCREEN_PIXEL_FLOOR, countAlertScreenPixels } from './helpers/attackWarningPixels';

const ALERT_TOAST = '[data-hud="toast"][data-hud-toast-kind="alert"]';

async function settleFrames(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }));
}

test('an enemy Town Centre shooting your villager raises the warning', async ({ page }) => {
  test.slow();
  await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
  await settleFrames(page);
  expect(await countAlertScreenPixels(page), 'the boot frame must be quiet').toBe(0);
  await expect(page.locator(ALERT_TOAST)).toHaveCount(0);

  // Owner 2's Scout attacks a villager passing its base (measured: tick 541,
  // 25 -> 22 HP, the Scout beside it and no arrow in the air), which would
  // raise the warning through the unit path. So it is sent to the map corner
  // farthest from the villager's route first.
  await page.evaluate(async () => {
    const api = window.__AOE2_TEST__!;
    const economy = api.getEconomyState();
    const own = economy.buildings.find((building) => building.owner === 1 && building.buildingType === 'town-center')!;
    const theirs = economy.buildings.find((building) => building.owner === 2 && building.buildingType === 'town-center')!;
    const { width, height } = api.getMapSize();
    const distanceToRoute = (x: number, y: number): number => {
      const dx = theirs.x - own.x;
      const dy = theirs.y - own.y;
      const t = Math.max(0, Math.min(1, ((x - own.x) * dx + (y - own.y) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(x - (own.x + t * dx), y - (own.y + t * dy));
    };
    const corners = [[2, 2], [width - 3, 2], [2, height - 3], [width - 3, height - 3]] as const;
    const [cornerX, cornerY] = [...corners].sort((a, b) => distanceToRoute(b[0], b[1]) - distanceToRoute(a[0], a[1]))[0]!;
    for (const scout of economy.units.filter((unit) => unit.owner === 2 && unit.unitType === 'scout')) {
      const result = await api.agent.dispatchAgentCommand(
        { type: 'unit.move', data: { unitId: scout.id, target: { x: cornerX, y: cornerY } } },
        { expectedOwner: 2 },
      );
      if (!result.accepted) throw new Error(`owner 2's scout ${scout.id} refused the move: ${JSON.stringify(result)}`);
    }
  });

  // Walk the human villager nearest the enemy Town Centre up to its wall.
  const walk = await page.evaluate(() => {
    const api = window.__AOE2_TEST__!;
    const economy = api.getEconomyState();
    const townCentre = economy.buildings.find(
      (building) => building.owner === 2 && building.buildingType === 'town-center' && building.isComplete,
    );
    if (!townCentre) throw new Error('aoe2-prototype must give owner 2 a complete Town Centre.');
    const centreX = townCentre.x + (townCentre.footprintWidth - 1) / 2;
    const centreY = townCentre.y + (townCentre.footprintHeight - 1) / 2;
    const villager = economy.units
      .filter((unit) => unit.owner === 1 && unit.unitType === 'villager')
      .sort((a, b) => Math.hypot(a.x - centreX, a.y - centreY) - Math.hypot(b.x - centreX, b.y - centreY))[0];
    if (!villager) throw new Error('aoe2-prototype must give the human a villager.');
    // One cell outside the footprint, on the side facing the villager.
    const destination = {
      x: Math.round(centreX + Math.sign(villager.x - centreX) * (townCentre.footprintWidth / 2 + 1)),
      y: Math.round(centreY + Math.sign(villager.y - centreY) * (townCentre.footprintHeight / 2 + 1)),
    };
    if (!api.selectOwnedUnitsByTypeInRect('villager', villager.x, villager.y, villager.x, villager.y)) {
      throw new Error(`could not select the human villager ${villager.id} at (${villager.x}, ${villager.y}).`);
    }
    if (!api.issueMoveCommand(destination.x, destination.y)) {
      throw new Error(`the move order to (${destination.x}, ${destination.y}) was refused.`);
    }
    api.clearSelection();
    return { villagerId: villager.id, townCentreId: townCentre.id, destination };
  });

  // Step one tick at a time until the villager loses hit points, noting what
  // had a shot in the air at it. The tick is exact, so the words can be held
  // to it.
  const hit = await page.evaluate(({ villagerId }) => {
    const api = window.__AOE2_TEST__!;
    const shooters = new Set<string>();
    // Distances in the economy state's claimed cells, the cells melee reach is
    // decided on; fog does not filter it, so every unit of owner 2 is there.
    const cellOf = (id: number) => api.getEconomyState().units.find((unit) => unit.id === id) ?? null;
    const nearestEnemyUnitTo = (cell: { x: number; y: number }): number => Math.min(...api.getEconomyState().units
      .filter((unit) => unit.owner === 2)
      .map((unit) => Math.hypot(unit.x - cell.x, unit.y - cell.y)));
    for (let step = 0; step < 4000; step += 1) {
      for (const shot of api.getInFlightProjectiles()) {
        if (shot.targetId === villagerId) {
          shooters.add(`${shot.attackerUnitType ?? 'building'}#${shot.attackerId}/owner${shot.attackerOwner}`);
        }
      }
      const cellBefore = cellOf(villagerId);
      api.advanceTicks(1, 100);
      const villager = api.getRenderState().entities.find((entity) => entity.id === villagerId);
      const cell = cellOf(villagerId) ?? cellBefore;
      if (!villager || !cell) {
        return { tick: api.getHudState().tick, hp: 'dead', shooters: [...shooters], nearestEnemyUnit: cell ? nearestEnemyUnitTo(cell) : -1 };
      }
      if (villager.currentHp !== null && villager.maxHp !== null && villager.currentHp < villager.maxHp) {
        return {
          tick: api.getHudState().tick, hp: `${villager.currentHp}/${villager.maxHp}`, shooters: [...shooters],
          nearestEnemyUnit: nearestEnemyUnitTo(cell),
        };
      }
    }
    return null;
  }, walk);
  test.info().annotations.push({ type: 'measured', description: JSON.stringify({ walk, hit }) });
  expect(hit, `villager ${walk.villagerId} walked to the enemy Town Centre and was never hurt`).not.toBeNull();
  expect(hit!.shooters, `the villager was hurt, and not by the Town Centre: ${JSON.stringify(hit)}`)
    .toContain(`building#${walk.townCentreId}/owner2`);
  expect(hit!.shooters.filter((shooter) => !shooter.startsWith('building#')), 'a unit shot at the villager too').toEqual([]);
  expect(hit!.nearestEnemyUnit, 'a unit of owner 2 stood within reach of a swing when the villager was hurt')
    .toBeGreaterThan(2);

  // Paused, the page keeps drawing: the audio mount's poll sees the blow and
  // raises the mark and the words on the next frame.
  await settleFrames(page);
  const marked = await countAlertScreenPixels(page);
  test.info().annotations.push({ type: 'measured', description: `${marked.toFixed(0)} alert screen pixels` });
  expect(marked, `the enemy Town Centre hurt villager ${walk.villagerId} (${hit!.hp}) at tick ${hit!.tick} `
    + `and the minimap's attack mark covers ${marked.toFixed(0)} screen pixels`).toBeGreaterThanOrEqual(ALERT_SCREEN_PIXEL_FLOOR);
  await expect(page.locator(ALERT_TOAST)).toHaveText(['You are under attack!']);
  await expect(page.locator(ALERT_TOAST), 'the words did not name the Town Centre\'s blow')
    .toHaveAttribute('data-hud-toast-hit-tick', String(hit!.tick));
});
