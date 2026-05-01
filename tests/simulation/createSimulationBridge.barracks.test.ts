import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import {
  placeBuildingNearTownCenter,
  selectOwnedBuildingDirect,
} from './createSimulationBridge.helpers';

describe('createSimulationBridge barracks production', () => {
  it('builds a Barracks and trains a Militia from it', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    placeBuildingNearTownCenter(bridge, 'barracks');
    expect(bridge.getHudState().playerResources.wood).toBe(25);

    for (let index = 0; index < 500; index += 1) {
      bridge.step(100);
    }

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'barracks',
      trainOptions: ['militia'],
    });
    const resourcesBeforeTraining = bridge.getHudState().playerResources;
    expect(bridge.queueTrainUnit('militia')).toBe(true);
    // Phase 1B queue.train: spend lands at start of next step's processCommands.
    bridge.step(100);
    expect(bridge.getHudState().playerResources.food).toBe(resourcesBeforeTraining.food - 60);
    expect(bridge.getHudState().playerResources.gold).toBe(resourcesBeforeTraining.gold - 20);

    for (let index = 0; index < 260; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.filter((unit) => unit.owner === 1 && unit.unitType === 'militia'),
    ).toHaveLength(1);
  }, 90_000);
});
