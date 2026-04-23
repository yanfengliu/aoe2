import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import { selectOwnedUnitDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

const HUMAN_PLAYER_ID = 1;

describe('selection activity — owned unit', () => {
  it('idle villager reports Idle', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'villager')).toBe(true);
    expect(bridge.getSelectionState().activity).toBe('Idle');
  });

  it('villager ordered onto a tree reports Gathering wood', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    expect(selectOwnedUnitDirect(bridge, HUMAN_PLAYER_ID, 'villager')).toBe(true);
    const tree = bridge.getEconomyState().resources.find((r) => r.resourceType === 'tree');
    expect(tree).toBeDefined();
    expect(bridge.issueContextCommand(tree!.x, tree!.y)).toBe(true);
    stepBridgeUntil(
      bridge,
      () => bridge.getSelectionState().activity !== 'Idle',
      { maxSteps: 5 },
    );
    expect(bridge.getSelectionState().activity).toBe('Gathering wood');
  });
});
