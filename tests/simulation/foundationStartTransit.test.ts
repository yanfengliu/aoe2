// An enemy's villager crossing a foundation on its way to build elsewhere holds
// the start like any enemy's unit, and is not put on the far side of it (work
// 126, review round 1; spec §8.1; foundationStart.ts `buildsOwnSiteFromHere`).
//
// Review round 0 let a unit whose order is building its own seat's site off
// holding another seat's start, so that two builders standing on each other's
// sites could not wait on each other forever (foundationStartMutualWait). The
// first cut excused every such unit wherever it was. The reviewer's
// transitBuilder probe found what that does in a pass: owner 2's villager,
// crossing the human's unstarted House in the gap on its way to build west of
// it, was put on the east side when the House started, the House sealed the
// pass, and 800 ticks later the villager stood idle with its paid House at
// progress 0. The rule since (the coordinator, review round 1): only a unit on
// a cell beside its own site's footprint, where it builds from, is excused. One
// passing through holds the start until it has passed, as a unit with a plain
// move order does, which is this gate's control.
//
// BOUND — what a green run here does NOT prove: one 2x2 House in a 2x2 gap of
// a water wall, one enemy villager trained at its Town Center and walking west
// through the gap, the human's builder already beside the House when it is
// told to build; the AI's own build orders are not driven.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { PASS_HOUSE, UNBUILT_FOUNDATIONS_PASS_SEED } from '../../src/game/simulation/fixtures/unbuiltFoundations';

type Cell = { readonly x: number; readonly y: number };

/** West of the pass, where owner 2's villager is going. */
const WEST_SITE: Cell = { x: 18, y: 16 };

const onHouse = (cell: Cell): boolean => cell.x >= PASS_HOUSE.x && cell.x <= PASS_HOUSE.x + 1
  && cell.y >= PASS_HOUSE.y && cell.y <= PASS_HOUSE.y + 1;

function crossing(order: 'build' | 'move') {
  const bridge = createSimulationBridge(UNBUILT_FOUNDATIONS_PASS_SEED);
  const eco = () => bridge.getEconomyState();
  const submit = (type: string, data: Record<string, unknown>): void => {
    const result = bridge.world.submitWithResult(type as never, data as never);
    expect(result.accepted, `${type} ${JSON.stringify(result)}`).toBe(true);
  };
  const human = eco().units.find((unit) => unit.owner === 1 && unit.unitType === 'villager')!.id;
  expect(bridge.selectUnitsByIds([human])).toBe(true);
  expect(bridge.beginBuildingPlacement('house')).toBe(true);
  expect(bridge.confirmBuildingPlacement(PASS_HOUSE.x, PASS_HOUSE.y), 'the House in the pass was refused').toBe(true);
  bridge.step(100);
  submit('unit.move', { unitId: human, target: { x: PASS_HOUSE.x - 1, y: PASS_HOUSE.y } });
  const house = eco().buildings.find((building) => building.owner === 1 && building.buildingType === 'house')!.id;
  const townCenter = eco().buildings.find((building) => building.owner === 2 && building.buildingType === 'town-center')!.id;
  submit('queue.train', { buildingId: townCenter, unitType: 'villager' });
  let enemy: number | undefined;
  for (let tick = 0; tick < 600 && enemy === undefined; tick += 1) {
    bridge.step(100);
    enemy = eco().units.find((unit) => unit.owner === 2 && unit.unitType === 'villager')?.id;
  }
  expect(enemy, 'owner 2 never trained its villager').toBeDefined();
  if (order === 'build') {
    submit('building.placeConfirm', { builderId: enemy!, buildingType: 'house', position: { ...WEST_SITE } });
  } else {
    submit('unit.move', { unitId: enemy!, target: { ...WEST_SITE } });
  }
  const enemyAt = (): Cell => eco().units.find((unit) => unit.id === enemy)!;
  // The human's builder is told to build once the enemy's villager stands on
  // the House's east column, half way across it.
  let crossingAt: Cell | null = null;
  for (let tick = 0; tick < 1500 && crossingAt === null; tick += 1) {
    bridge.step(100);
    const at = enemyAt();
    if (at.x === PASS_HOUSE.x + 1 && onHouse(at)) crossingAt = { x: at.x, y: at.y };
  }
  expect(crossingAt, 'the enemy villager never crossed the House').not.toBeNull();
  submit('unit.contextAtEntity', { unitId: human, targetEntityId: house });
  let startedAt: Cell | null = null;
  for (let tick = 0; tick < 400 && startedAt === null; tick += 1) {
    bridge.step(100);
    const progress = eco().buildings.find((building) => building.id === house)?.buildProgressTicks ?? 0;
    if (progress > 0) startedAt = { x: enemyAt().x, y: enemyAt().y };
  }
  for (let tick = 0; tick < 800; tick += 1) bridge.step(100);
  const westHouse = eco().buildings.find((building) => building.owner === 2 && building.buildingType === 'house');
  return { startedAt, end: enemyAt(), westHouse };
}

describe('an enemy villager crossing an unstarted House in a pass (work 126, review round 1)', () => {
  it('on its way to build west of it, it holds the start until it has passed, and builds its own House', () => {
    const { startedAt, end, westHouse } = crossing('build');
    expect(startedAt, 'the human\'s House never started').not.toBeNull();
    expect(onHouse(startedAt!), 'the House started under the enemy villager').toBe(false);
    expect(startedAt!.x, 'the enemy villager was put on the far side of the pass').toBeLessThan(PASS_HOUSE.x);
    expect(end.x, 'the enemy villager ended east of the sealed pass').toBeLessThan(PASS_HOUSE.x);
    expect(westHouse?.buildProgressTicks ?? 0, 'owner 2 never built the House it paid for').toBeGreaterThan(0);
  });

  it('the control: on a plain move order, it holds the start the same way and gets through', () => {
    const { startedAt, end } = crossing('move');
    expect(startedAt, 'the human\'s House never started').not.toBeNull();
    expect(onHouse(startedAt!), 'the House started under the enemy villager').toBe(false);
    expect(startedAt!.x).toBeLessThan(PASS_HOUSE.x);
    expect({ x: end.x, y: end.y }).toEqual(WEST_SITE);
  });
});
