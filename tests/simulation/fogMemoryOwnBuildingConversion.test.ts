// Conversion and the player's fog memory (spec §12.1, vNEXT; defect register
// 2026-10-11). A building the player owns is not remembered, with one
// exception: while an enemy's conversion record (aoe2.conversionState) stands
// on it, it is remembered whatever the fog. The record is made on a Monk's
// first tick of progress and outlives the Monk's order, and a Monk of that
// owner sent back resumes it, so it is what says the building can flip; the
// flip — which takes the building's own sight away from the player — leaves
// it on the map in its new owner's look (a rule chosen here; Definitive
// Edition is not verified). An entry recorded as the player's is forgotten on
// the first pass after its building goes, so deleting the building
// mid-conversion leaves no ghost, while a building converted away is no
// longer recorded as the player's and keeps its ghost. Converting an enemy's
// building drops the entry the player held for it.
//
// BOUND: the enemy's conversions are staged by editing a save
// (`stageEnemyConversion`): no fixture has an enemy Monk with Redemption
// beside a building of the player's, and the AI never converts. The
// conversions, the recalls, the deletes and the saves and loads run through
// the command pipeline and the save path. A target destroyed mid-conversion
// and its recycled id are staged by direct world edits ("destroyed raw"). A
// kill that lands after the fog pass (a projectile) is not driven: such a
// building is forgotten a tick later. No recorded replay is self-checked.

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
    expect(ticks, 'the House is remembered once an enemy Monk works on it').toBeLessThan(40);
    staged.step(100);
  }
}

function progressOn(bridge: Bridge, id: number): number | undefined {
  const conversions = (bridge.world.getState('aoe2.conversionState') ?? []) as Array<[number, { progress: number }]>;
  return conversions.find(([target]) => target === id)?.[1].progress;
}

function stepUntilProgress(bridge: Bridge, id: number, progress: number): void {
  for (let ticks = 0; (progressOn(bridge, id) ?? 0) < progress; ticks += 1) {
    expect(ticks, `premise: the conversion reaches progress ${progress}`).toBeLessThan(900);
    bridge.step(100);
  }
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

/** The slot exactly as a save or a replay carries it, order included. */
function rawSlot(bridge: Bridge): string {
  return JSON.stringify(bridge.world.getState('aoe2.lastSeenStatic') ?? []);
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

  it('keeps a building an enemy Monk converts on the map in its new owner\'s look, and keeps its ghost when it is lost out of the player\'s sight', () => {
    const { staged, house, monkId } = stageEnemyConversion();
    expect(ownerOf(staged, house.id), 'premise: the House is the player\'s').toBe(HUMAN_PLAYER_ID);
    expect(memoryOf(staged).has(house.id), 'not remembered before anyone works on it').toBe(false);

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

  it('remembers the building from the enemy Monk\'s first tick of progress, not while it walks there, and still after a recall', () => {
    const { staged, house, monkId } = stageEnemyConversion();
    // Walk the Monk out of conversion range, so the order sends it on a walk.
    recall(staged, monkId);
    for (let ticks = 0; ; ticks += 1) {
      const monk = staged.getEconomyState().units.find((unit) => unit.id === monkId)!;
      if (Math.abs(monk.x - 12) + Math.abs(monk.y - 24) <= 1) break;
      expect(ticks, 'premise: the Monk walks away').toBeLessThan(600);
      staged.step(100);
    }
    orderEnemyConversion(staged, monkId, house.id);
    let rememberedWhileWalking = false;
    for (let ticks = 0; progressOn(staged, house.id) === undefined; ticks += 1) {
      expect(ticks, 'premise: the Monk arrives and starts').toBeLessThan(600);
      if (memoryOf(staged).has(house.id)) rememberedWhileWalking = true;
      staged.step(100);
    }
    expect(rememberedWhileWalking, 'remembered while the Monk only walked there').toBe(false);
    expect(memoryOf(staged).has(house.id), 'remembered from the first tick of progress').toBe(true);

    recall(staged, monkId);
    step(staged, 3);
    expect(progressOn(staged, house.id), 'premise: the progress outlives the order').toBeGreaterThan(0);
    expect(memoryOf(staged).has(house.id), 'remembered while the progress stands').toBe(true);
  });

  it('keeps the building on the map when a Monk called off one tick short is sent back and flips it at once', () => {
    // The progress outlives the order (review round 1, F11).
    const { staged, house, monkId } = stageEnemyConversion();
    orderEnemyConversion(staged, monkId, house.id);
    stepUntilProgress(staged, house.id, 49);
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

  it('keeps on the map a building of the player\'s that takes the id of one destroyed one tick short, when the enemy\'s Monk resumes on it', () => {
    // The engine leaves a destroyed building's record under its id, and a
    // Monk of that owner resumes it on whatever takes the id (review round 2,
    // F27; defect register F10): this building can flip at once too.
    const { staged, house, monkId } = stageEnemyConversion();
    orderEnemyConversion(staged, monkId, house.id);
    stepUntilProgress(staged, house.id, 49);
    recall(staged, monkId);
    staged.step(100);
    const recycled = staged.world.runMaintenance(() => {
      staged.world.destroyEntity(house.id);
      const id = staged.world.createEntity();
      staged.world.addComponent(id, 'position', { x: house.x, y: house.y });
      staged.world.addComponent(id, 'building', { owner: HUMAN_PLAYER_ID, buildingType: 'house' });
      staged.world.addComponent(id, 'renderable', {
        kind: 'building', layer: 'building', tint: buildingTint('house', HUMAN_PLAYER_ID, true), size: 1.1,
        footprintWidth: 2, footprintHeight: 2, visualVariant: 'complete',
      });
      return id;
    });
    expect(recycled, 'premise: the id came back').toBe(house.id);
    staged.step(100);
    expect(progressOn(staged, house.id), 'premise: the record outlived its building').toBe(49);

    orderEnemyConversion(staged, monkId, house.id);
    staged.step(100);
    expect(ownerOf(staged, house.id), 'premise: the new building flipped on the first tick').toBe(2);
    staged.step(100);
    expect(drawnAs(staged, house.id), 'drawn after the flip').toEqual([{ isMemory: true, owner: 2 }]);
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

  it('remembers no building of the player\'s that takes the id of an enemy building its own Monk was converting', () => {
    // The player's own Monk starts on the enemy House; the House is destroyed
    // raw before the flip, and its id comes back as a House of the player's.
    // The player's own conversion record left under the id is not an enemy's,
    // so the new building is not remembered (review round 0, F2).
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

  it('plays saves made mid-conversion and during a pause to the same fog memory as the match they came from', () => {
    // Orders and conversion progress come back with a save, so a loaded match
    // keeps the same slot, in the same order, at every tick (review rounds 1
    // and 2, F14 and F28): one save made while the Monk works, one while it is
    // called off at progress 49 with only the record standing.
    const { staged: live, house, monkId } = stageEnemyConversion();
    orderEnemyConversion(live, monkId, house.id);
    stepUntilRememberedWhileOwn(live, house.id);
    step(live, 5);
    expect(progressOn(live, house.id), 'premise: saved with progress made').toBeGreaterThan(0);
    const working = createSimulationBridge('redemption-buildings-fixture', { savedGame: live.saveGame() });
    const matches: Bridge[] = [live, working];
    const compare = (label: string) => {
      for (const other of matches.slice(1)) {
        expect(rawSlot(other), `fog memory ${label}`).toBe(rawSlot(live));
        expect(progressOn(other, house.id), `progress ${label}`).toBe(progressOn(live, house.id));
      }
    };
    compare('right after the first load');

    const play = (ticks: number, label: string) => {
      for (let tick = 0; tick < ticks; tick += 1) {
        for (const bridge of matches) bridge.step(100);
        compare(`${label}, step ${tick}`);
      }
    };
    for (const bridge of matches) stepUntilProgress(bridge, house.id, 49);
    compare('at progress 49');
    for (const bridge of matches) recall(bridge, monkId);
    play(3, 'called off');
    matches.push(createSimulationBridge('redemption-buildings-fixture', { savedGame: live.saveGame() }));
    compare('right after the paused load');
    for (const bridge of matches) orderEnemyConversion(bridge, monkId, house.id);
    play(20, 'resumed and flipped');
    expect(ownerOf(live, house.id), 'premise: the conversion finished').toBe(2);
    for (const bridge of matches) {
      expect(drawnAs(bridge, house.id), 'drawn after the flip').toEqual([{ isMemory: true, owner: 2 }]);
    }
  });
});
