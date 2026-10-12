// An enemy's Monk cannot convert a foundation nobody has started building
// (work 121; spec §12.2): its owner cannot see one. The order is refused where
// it is given (`monkContextOps`, held by the foundation case in
// `fogMemoryOwnBuildingConversion.test.ts`), and a conversion task that names
// one anyway — one an older save carries — is dropped by the conversion lane
// (`monkBuildingConversion`), the step every conversion passes. This file
// holds the second.
//
// BOUND: one staged scene, work 116's `stageEnemyConversion` (the player's
// unstarted House foundation and owner 2's Monk with Redemption beside it),
// with the task written into its save; a House only.

import { describe, expect, it } from 'vitest';

import { monkTasksCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { orderEnemyConversion, ownerOf, stageEnemyConversion, step } from './fogMemoryOwnBuildings.helpers';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';

type SerializedTasks = Array<[number, { kind: string; targetEntityRef: { id: number; generation: number } }]>;

function tasksOf(bridge: ReturnType<typeof createSimulationBridge>): Map<number, SerializedTasks[number][1]> {
  return new Map((bridge.world.getState(monkTasksCodec.slot) ?? []) as SerializedTasks);
}

describe('an enemy Monk ordered to convert the player\'s unstarted foundation', () => {
  it('is not sent toward it from afar', () => {
    // The staged Monk stands beside the House, where the conversion lane would
    // drop the task on its first tick anyway; walked away first, the order
    // would have to send it back, so only a refusal at the order keeps it still.
    const { staged, house, monkId } = stageEnemyConversion({ foundation: true });
    staged.pendingCommands.push({ type: 'unit.move', data: { unitId: monkId, target: { x: 12, y: 24 } } });
    const monkAt = (): { x: number; y: number } => {
      const monk = staged.getEconomyState().units.find((unit) => unit.id === monkId)!;
      return { x: monk.x, y: monk.y };
    };
    // Walked away, then come to rest: twenty ticks in one place.
    for (let ticks = 0; Math.abs(monkAt().x - 12) + Math.abs(monkAt().y - 24) > 1; ticks += 1) {
      expect(ticks, 'premise: the Monk walks away').toBeLessThan(600);
      staged.step(100);
    }
    let still = 0;
    for (let ticks = 0; still < 20; ticks += 1) {
      expect(ticks, 'premise: the Monk stops').toBeLessThan(300);
      const before = monkAt();
      staged.step(100);
      const after = monkAt();
      still = before.x === after.x && before.y === after.y ? still + 1 : 0;
    }
    const away = monkAt();

    orderEnemyConversion(staged, monkId, house.id);
    step(staged, 300);

    expect(monkAt(), 'the Monk stays where it was').toEqual(away);
    expect(ownerOf(staged, house.id), 'still the player\'s').toBe(HUMAN_PLAYER_ID);
  }, 60_000);
});

describe('a conversion task an older save holds on the player\'s unstarted foundation', () => {
  it('is dropped, and the foundation stays the player\'s', () => {
    const { staged, house, monkId } = stageEnemyConversion({ foundation: true });
    const blob = asSchema2Blob(staged.saveGame());
    const state = worldStateOf(blob);
    const tasks = new Map((state[monkTasksCodec.slot] ?? []) as SerializedTasks);
    tasks.set(monkId, {
      kind: 'convert',
      targetEntityRef: { id: house.id, generation: staged.world.getEntityGeneration(house.id) },
    });
    state[monkTasksCodec.slot] = [...tasks];

    const loaded = createSimulationBridge('redemption-buildings-fixture', { savedGame: blob });
    expect(tasksOf(loaded).get(monkId)?.kind, 'premise: the save carries the task').toBe('convert');
    // Before the rule this task converted the foundation within 900 ticks (the
    // bound the conversion cases use).
    step(loaded, 900);

    expect(tasksOf(loaded).has(monkId), 'the task is dropped').toBe(false);
    expect(ownerOf(loaded, house.id), 'still the player\'s').toBe(HUMAN_PLAYER_ID);
  }, 60_000);
});
