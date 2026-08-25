// Nomad (§5.4): every player opens as three villagers with no Town Center —
// the first TC builds in ANY age, the offer vanishing the moment one stands
// (and returning if the last one falls), and the AI opens lumber-camp-first
// to bank the 275 wood.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function townCenters(bridge: Bridge, owner: number) {
  return bridge
    .getEconomyState()
    .buildings.filter((b) => b.owner === owner && b.buildingType === 'town-center');
}

describe('the Nomad map', () => {
  it('boots two players as villagers only — no Town Centers, no scouts', () => {
    const bridge = createSimulationBridge('nomad');
    for (const owner of [1, 2]) {
      expect(townCenters(bridge, owner)).toHaveLength(0);
      const units = bridge.getEconomyState().units.filter((u) => u.owner === owner);
      expect(units.filter((u) => u.unitType === 'villager')).toHaveLength(3);
      expect(units.filter((u) => u.unitType === 'scout')).toHaveLength(0);
    }
  });

  it('offers the Town Center to a Dark-Age villager, and only until one exists', () => {
    const bridge = createSimulationBridge('nomad');
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('town-center');

    // The ordinary map never offers it in the Dark Age.
    const arabia = createSimulationBridge('aoe2-prototype');
    expect(selectOwnedUnitDirect(arabia, 1, 'villager')).toBe(true);
    expect(arabia.getSelectionState().buildOptions).not.toContain('town-center');
  });

  it('the AI opens lumber camp first, then stands up its Town Center', () => {
    const bridge = createSimulationBridge('nomad');
    // Camp first (affordable at 100 wood immediately)...
    expect(
      stepBridgeUntil(
        bridge,
        () => bridge
          .getEconomyState()
          .buildings.some((b) => b.owner === 2 && b.buildingType === 'lumber-camp'),
        { maxSteps: 600 },
      ),
    ).toBe(true);
    // ...then the villagers bank 275 wood and the TC goes up and completes.
    expect(
      stepBridgeUntil(
        bridge,
        () => townCenters(bridge, 2).some((b) => b.isComplete),
        { maxSteps: 9000 },
      ),
    ).toBe(true);
  }, 240_000);
});
