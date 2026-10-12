// An enemy's Monk cannot convert a foundation nobody has started building
// (work 121; spec §12.2): its owner cannot see one. Two refusals hold that.
// The order is refused where it is given (`monkContextOps`); the case that
// shows it, with the Monk walked away so that the order would have to send it,
// is "refuses an enemy Monk sent at a foundation of the player's nobody has
// started" in `fogMemoryOwnBuildingConversion.test.ts`. A conversion task that
// names one anyway is dropped by the conversion lane (`monkBuildingConversion`),
// the step every conversion passes. The order path never makes such a task,
// so only a task an older save holds reaches the lane; this file holds that.
//
// BOUND: one staged scene, work 116's `stageEnemyConversion` (the player's
// unstarted House foundation and owner 2's Monk with Redemption beside it),
// with the task written into its save; a House only.

import { describe, expect, it } from 'vitest';

import { monkTasksCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { ownerOf, stageEnemyConversion, step } from './fogMemoryOwnBuildings.helpers';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';

type SerializedTasks = Array<[number, { kind: string; targetEntityRef: { id: number; generation: number } }]>;

function tasksOf(bridge: ReturnType<typeof createSimulationBridge>): Map<number, SerializedTasks[number][1]> {
  return new Map((bridge.world.getState(monkTasksCodec.slot) ?? []) as SerializedTasks);
}

describe('a conversion task an older save holds on the player\'s unstarted foundation', () => {
  it('is dropped, and the foundation stays the player\'s', () => {
    const { staged, house, monkId } = stageEnemyConversion({ foundation: 'unstarted' });
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
