// Conversion and the player's fog memory (spec §12.1, vNEXT; defect register
// 2026-10-11). A building the player owns is not remembered, with one
// exception: while an enemy Monk is sent to convert it, it is remembered
// whatever the fog, so the flip — which takes the building's own sight away
// from the player — leaves it on the map in its new owner's look, as the
// player saw it change hands. The exception follows the enemy's convert order
// by identity, so it ends when the order does; and an entry recorded as the
// player's is forgotten the moment its building goes, so deleting the
// building mid-conversion leaves no ghost. Converting an enemy's building
// drops the entry the player held for it as an enemy's.
//
// BOUND: the enemy's conversions are staged by editing a save
// (`stageEnemyConversion`): no fixture has an enemy Monk with Redemption
// beside a building of the player's, and the AI never converts. The
// conversions themselves, the delete and the recall run through the command
// pipeline. The razed target's recycled id is staged by direct world edits.
// Whether Definitive Edition draws a converted building in its new owner's
// colours under fog is not verified against a reference.

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

  it('keeps a building an enemy Monk converts on the map, in its new owner\'s look', () => {
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
      'drawn after the flip, as the player saw it change hands')
      .toEqual([{ isMemory: true, owner: 2, tint: buildingTint('house', 2, true), x: house.x, y: house.y }]);
    expect(rememberedWhileOwn, 'remembered while an enemy Monk converted it').toBe(true);
  });

  it('keeps a foundation of the player\'s that nobody sees on the map when an enemy Monk converts it', () => {
    // A foundation gives no sight, so nothing of the player's sees this one:
    // the exception has to remember it whatever the fog (review F0).
    const { staged, house, monkId } = stageEnemyConversion({ foundation: true });
    expect(staged.getEconomyState().buildings.find((building) => building.id === house.id)?.isComplete,
      'premise: an unfinished foundation').toBe(false);
    expect(unseenNow(staged, [house]), 'premise: nothing of the player\'s sees it').toHaveLength(1);

    orderEnemyConversion(staged, monkId, house.id);
    for (let ticks = 0; ownerOf(staged, house.id) !== 2; ticks += 1) {
      expect(ticks, 'the enemy Monk converts the foundation').toBeLessThan(900);
      staged.step(100);
    }
    staged.step(100);

    expect(drawnWithIds(staged, new Set([house.id])).map((entity) => ({ isMemory: entity.isMemory, owner: entity.owner })),
      'drawn after the flip').toEqual([{ isMemory: true, owner: 2 }]);
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

  it('forgets the building once the enemy Monk is called away', () => {
    const { staged, house, monkId } = stageEnemyConversion();
    orderEnemyConversion(staged, monkId, house.id);
    stepUntilRememberedWhileOwn(staged, house.id);

    staged.pendingCommands.push({ type: 'unit.move', data: { unitId: monkId, target: { x: 12, y: 24 } } });
    step(staged, 3);

    expect(ownerOf(staged, house.id), 'premise: still the player\'s').toBe(HUMAN_PLAYER_ID);
    expect(memoryOf(staged).has(house.id), 'remembered after the Monk was called away').toBe(false);
  });

  it('remembers no building of the player\'s that takes the id of an enemy building razed mid-conversion', () => {
    // The player's own Monk starts on the enemy House; the House is razed
    // before the flip, and its id comes back as a House of the player's. A
    // conversion record left under the id (aoe2.conversionState keeps one)
    // must not make the new building remembered (review F2).
    const bridge = createSimulationBridge('redemption-buildings-fixture');
    const house = bridge.getEconomyState().buildings.find((building) => building.buildingType === 'house')!;
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(house.id)).toBe(true);
    for (let ticks = 0; ; ticks += 1) {
      const conversions = (bridge.world.getState('aoe2.conversionState') ?? []) as Array<[number, unknown]>;
      if (conversions.some(([id]) => id === house.id)) break;
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
    const conversions = (bridge.world.getState('aoe2.conversionState') ?? []) as Array<[number, unknown]>;
    expect(conversions.some(([id]) => id === house.id), 'premise: the conversion record outlived its target').toBe(true);
    expect(memoryOf(bridge).has(house.id), 'the player\'s new House is remembered').toBe(false);
  });
});
