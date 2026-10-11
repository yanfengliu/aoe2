// Conversion and the player's fog memory (spec §12.1, vNEXT; defect register
// 2026-10-11). A building the player owns is not remembered, with one
// exception: while an enemy Monk is sent to convert it, it is remembered
// whatever the fog, so the flip — which takes the building's own sight away
// from the player — leaves it on the map in its new owner's look (a rule
// chosen here; Definitive Edition is not verified). The exception follows the
// enemy's convert order by identity; while an enemy's conversion progress
// stands on the building after its order is called off, the entry is kept,
// because a Monk sent back can flip it in one tick. An entry recorded as the
// player's is forgotten on the first pass after its building goes, so
// deleting the building mid-conversion leaves no ghost, while a building
// converted away is no longer recorded as the player's and keeps its ghost.
// Converting an enemy's building drops the entry the player held for it.
//
// BOUND: the enemy's conversions are staged by editing a save
// (`stageEnemyConversion`): no fixture has an enemy Monk with Redemption
// beside a building of the player's, and the AI never converts. The
// conversions, the recalls, the deletes and the save and load run through the
// command pipeline and the save path. The target destroyed mid-conversion and
// its recycled id are staged by direct world edits ("destroyed raw"). The kill
// paths that land after the fog pass (projectiles, towers) are not driven:
// such a building is forgotten a tick later.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { buildingTint } from '../../src/game/simulation/prototypeBuildingRules';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { selectOwnedUnitDirect } from './createSimulationBridge.helpers';
import {
  drawnWithIds, memoryOf, orderEnemyConversion, ownerOf, stageEnemyConversion, step, unseenNow, type Bridge,
} from './fogMemoryOwnBuildings.helpers';

/** Steps until the House is remembered while still the player's (the
 *  exception at work), and returns how many ticks that took. */
function stepUntilRememberedWhileOwn(staged: Bridge, houseId: number): number {
  for (let ticks = 0; ; ticks += 1) {
    if (ownerOf(staged, houseId) === HUMAN_PLAYER_ID && memoryOf(staged).has(houseId)) return ticks;
    expect(ticks, 'the House is remembered while an enemy Monk is sent at it').toBeLessThan(40);
    staged.step(100);
  }
}

function progressOn(bridge: Bridge, id: number): number | undefined {
  const conversions = (bridge.world.getState('aoe2.conversionState') ?? []) as Array<[number, { progress: number }]>;
  return conversions.find(([target]) => target === id)?.[1].progress;
}

function stepUntilFlipped(bridge: Bridge, houseId: number, label: string): void {
  for (let ticks = 0; ownerOf(bridge, houseId) !== 2; ticks += 1) {
    expect(ticks, label).toBeLessThan(900);
    bridge.step(100);
  }
}

function recall(bridge: Bridge, monkId: number): void {
  bridge.pendingCommands.push({ type: 'unit.move', data: { unitId: monkId, target: { x: 12, y: 24 } } });
}

function drawnAs(bridge: Bridge, id: number): Array<{ isMemory: boolean; owner: number | null }> {
  return drawnWithIds(bridge, new Set([id])).map((entity) => ({ isMemory: entity.isMemory, owner: entity.owner }));
}

describe('conversion and the player\'s fog memory', () => {
  it('drops the entry of an enemy building the player converts', () => {
    const bridge = createSimulationBridge('redemption-buildings-fixture');
    const house = bridge.getEconomyState().buildings.find((building) => building.buildingType === 'house')!;
    expect(house.owner).toBe(2);
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(house.id)).toBe(true);
    let heldWhileEnemy = false;
    for (let ticks = 0; ownerOf(bridge, house.id) !== HUMAN_PLAYER_ID; ticks += 1) {
      expect(ticks, 'the Monk converts the House').toBeLessThan(900);
      bridge.step(100);
      if (ownerOf(bridge, house.id) === 2 && memoryOf(bridge).has(house.id)) heldWhileEnemy = true;
    }
    expect(heldWhileEnemy, 'premise: the player remembered the House while it was the enemy\'s').toBe(true);
    bridge.step(100);
    expect(memoryOf(bridge).has(house.id), 'remembered after it became the player\'s').toBe(false);
  });

  it('keeps a building an enemy Monk converts on the map, in its new owner\'s look, until the player sees it gone', () => {
    const { staged, house, monkId } = stageEnemyConversion();
    expect(ownerOf(staged, house.id), 'premise: the House is the player\'s').toBe(HUMAN_PLAYER_ID);
    expect(memoryOf(staged).has(house.id), 'not remembered before anyone is sent at it').toBe(false);

    orderEnemyConversion(staged, monkId, house.id);
    let rememberedWhileOwn = false;
    for (let ticks = 0; ownerOf(staged, house.id) !== 2; ticks += 1) {
      expect(ticks, 'the enemy Monk converts the House').toBeLessThan(900);
      staged.step(100);
      if (ownerOf(staged, house.id) === HUMAN_PLAYER_ID && memoryOf(staged).has(house.id)) rememberedWhileOwn = true;
    }
    staged.step(100);

    expect(unseenNow(staged, [{ ...house, owner: 2 }]), 'premise: the player no longer sees its ground').toHaveLength(1);
    const drawn = drawnWithIds(staged, new Set([house.id]));
    expect(drawn.map((entity) => ({ isMemory: entity.isMemory, owner: entity.owner, tint: entity.tint, x: entity.x, y: entity.y })),
      'drawn after the flip, in its new owner\'s look')
      .toEqual([{ isMemory: true, owner: 2, tint: buildingTint('house', 2, true), x: house.x, y: house.y }]);
    expect(rememberedWhileOwn, 'remembered while an enemy Monk converted it').toBe(true);

    // Its new owner deletes it where the player cannot see: the player did not
    // watch it go, so its ghost stays (the entry no longer names the player).
    staged.pendingCommands.push({ type: 'entity.delete', data: { entityId: house.id, requestedBy: 2 } });
    step(staged, 3);
    expect(staged.getEconomyState().buildings.some((building) => building.id === house.id), 'premise: deleted').toBe(false);
    expect(drawnAs(staged, house.id), 'drawn after it was lost out of the player\'s sight').toEqual([{ isMemory: true, owner: 2 }]);
  });

  it('keeps a foundation of the player\'s that nobody sees on the map when an enemy Monk converts it', () => {
    // A foundation gives no sight, so nothing of the player's sees this one:
    // the exception has to remember it whatever the fog (review F0).
    const { staged, house, monkId } = stageEnemyConversion({ foundation: true });
    expect(staged.getEconomyState().buildings.find((building) => building.id === house.id)?.isComplete,
      'premise: an unfinished foundation').toBe(false);
    expect(unseenNow(staged, [house]), 'premise: nothing of the player\'s sees it').toHaveLength(1);

    orderEnemyConversion(staged, monkId, house.id);
    stepUntilFlipped(staged, house.id, 'the enemy Monk converts the foundation');
    staged.step(100);

    expect(drawnAs(staged, house.id), 'drawn after the flip').toEqual([{ isMemory: true, owner: 2 }]);
  });

  it('keeps the building on the map when a Monk called off one tick short is sent back and flips it at once', () => {
    // The progress outlives the order (review round 1, finding 1).
    const { staged, house, monkId } = stageEnemyConversion();
    orderEnemyConversion(staged, monkId, house.id);
    for (let ticks = 0; (progressOn(staged, house.id) ?? 0) < 49; ticks += 1) {
      expect(ticks, 'premise: the conversion nears its end').toBeLessThan(900);
      staged.step(100);
    }
    expect(ownerOf(staged, house.id)).toBe(HUMAN_PLAYER_ID);
    recall(staged, monkId);
    step(staged, 2);
    expect(progressOn(staged, house.id), 'premise: the progress stands').toBe(49);
    const keptWhilePaused = memoryOf(staged).has(house.id);

    orderEnemyConversion(staged, monkId, house.id);
    staged.step(100);
    expect(ownerOf(staged, house.id), 'premise: flipped on the first tick back').toBe(2);
    staged.step(100);
    expect(drawnAs(staged, house.id), 'drawn after the flip').toEqual([{ isMemory: true, owner: 2 }]);
    expect(keptWhilePaused, 'kept while the progress stood').toBe(true);
  });

  it('leaves no ghost of a building the player deletes while an enemy Monk converts it', () => {
    const { staged, house, monkId } = stageEnemyConversion();
    orderEnemyConversion(staged, monkId, house.id);
    stepUntilRememberedWhileOwn(staged, house.id);

    expect(staged.selectEntityById(house.id)).toBe(true);
    expect(staged.deleteSelectedEntity()).toBe(true);
    step(staged, 3);

    expect(staged.getEconomyState().buildings.some((building) => building.id === house.id), 'premise: deleted').toBe(false);
    expect(unseenNow(staged, [house]), 'premise: its ground is explored and unseen').toHaveLength(1);
    expect(drawnWithIds(staged, new Set([house.id])), 'drawn after the player deleted it').toEqual([]);
    expect(memoryOf(staged).has(house.id)).toBe(false);
  });

  it('forgets the building once the enemy Monk is called away before it makes progress', () => {
    const { staged, house, monkId } = stageEnemyConversion();
    // Walk the Monk out of conversion range first, so the order sends it on a
    // walk that the recall cuts short before any progress.
    recall(staged, monkId);
    for (let ticks = 0; ; ticks += 1) {
      const monk = staged.getEconomyState().units.find((unit) => unit.id === monkId)!;
      if (Math.abs(monk.x - 12) + Math.abs(monk.y - 24) <= 1) break;
      expect(ticks, 'premise: the Monk walks away').toBeLessThan(600);
      staged.step(100);
    }
    orderEnemyConversion(staged, monkId, house.id);
    stepUntilRememberedWhileOwn(staged, house.id);
    expect(progressOn(staged, house.id), 'premise: no progress yet').toBeUndefined();

    recall(staged, monkId);
    step(staged, 3);

    expect(ownerOf(staged, house.id), 'premise: still the player\'s').toBe(HUMAN_PLAYER_ID);
    expect(memoryOf(staged).has(house.id), 'remembered after the Monk was called away').toBe(false);
  });

  it('remembers no building of the player\'s that takes the id of a building destroyed mid-conversion', () => {
    // The player's own Monk starts on the enemy House; the House is destroyed
    // raw before the flip, and its id comes back as a House of the player's. A
    // conversion record left under the id (aoe2.conversionState keeps one)
    // must not make the new building remembered (review round 0, F2).
    const bridge = createSimulationBridge('redemption-buildings-fixture');
    const house = bridge.getEconomyState().buildings.find((building) => building.buildingType === 'house')!;
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(house.id)).toBe(true);
    for (let ticks = 0; progressOn(bridge, house.id) === undefined; ticks += 1) {
      expect(ticks, 'premise: the conversion starts').toBeLessThan(400);
      bridge.step(100);
    }
    const recycled = bridge.world.runMaintenance(() => {
      bridge.world.destroyEntity(house.id);
      const id = bridge.world.createEntity();
      bridge.world.addComponent(id, 'position', { x: 6, y: 12 });
      bridge.world.addComponent(id, 'building', { owner: HUMAN_PLAYER_ID, buildingType: 'house' });
      bridge.world.addComponent(id, 'renderable', {
        kind: 'building', layer: 'building', tint: buildingTint('house', HUMAN_PLAYER_ID, true), size: 1.1,
        footprintWidth: 2, footprintHeight: 2, visualVariant: 'complete',
      });
      return id;
    });
    expect(recycled, 'premise: the id came back').toBe(house.id);
    step(bridge, 3);
    expect(progressOn(bridge, house.id), 'premise: the conversion record outlived its target').toBeDefined();
    expect(memoryOf(bridge).has(house.id), 'the player\'s new House is remembered').toBe(false);
  });

  it('plays a save made mid-conversion to the same fog memory as the match it came from', () => {
    // Orders and conversion progress come back with the save, so the loaded
    // match remembers what the live one does at every tick, through a recall,
    // a resumed conversion and the flip (review round 1, finding 4).
    const { staged: live, house, monkId } = stageEnemyConversion();
    orderEnemyConversion(live, monkId, house.id);
    stepUntilRememberedWhileOwn(live, house.id);
    step(live, 5);
    expect(progressOn(live, house.id), 'premise: saved with progress made').toBeGreaterThan(0);
    const loaded = createSimulationBridge('redemption-buildings-fixture', { savedGame: live.saveGame() });

    const script: Record<number, (bridge: Bridge) => void> = {
      3: (bridge) => recall(bridge, monkId),
      8: (bridge) => orderEnemyConversion(bridge, monkId, house.id),
    };
    for (let tick = 0; tick < 120; tick += 1) {
      for (const bridge of [live, loaded]) {
        script[tick]?.(bridge);
        bridge.step(100);
      }
      const sorted = (bridge: Bridge) => JSON.stringify([...memoryOf(bridge)].sort(([a], [b]) => a - b));
      expect(sorted(loaded), `fog memory at step ${tick}`).toBe(sorted(live));
    }
    expect(ownerOf(live, house.id), 'premise: the conversion finished').toBe(2);
    expect(drawnAs(loaded, house.id), 'drawn after the flip in the loaded match').toEqual([{ isMemory: true, owner: 2 }]);
  });
});
