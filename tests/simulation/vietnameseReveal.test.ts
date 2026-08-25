// Vietnamese "Reveals enemy positions at game start" (civilizations.csv):
// the enemy Town Center area boots EXPLORED and the TC itself renders as a
// fog-memory ghost, without any live vision over it.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

function memoryTownCenterAt(
  bridge: ReturnType<typeof createSimulationBridge>,
  x: number,
  y: number,
) {
  bridge.step(100); // one frame so the render state is built post-boot
  return bridge
    .getRenderState()
    .entities.find(
      (entity) => entity.entityType === 'town-center'
        && entity.x === x && entity.y === y && entity.isMemory,
    );
}

describe('Vietnamese reveal', () => {
  it('shows the enemy Town Center as a fog-memory ghost at boot', () => {
    const bridge = createSimulationBridge('outpost-vision-fixture', {
      civilizationsByOwner: new Map([[1, 'Vietnamese']]),
    });
    expect(memoryTownCenterAt(bridge, 40, 26)).toBeDefined();
  });

  it('a generic civ boots with the enemy Town Center unknown', () => {
    const bridge = createSimulationBridge('outpost-vision-fixture');
    expect(memoryTownCenterAt(bridge, 40, 26)).toBeUndefined();
  });

  it('an enemy Vietnamese player does not reveal FOR the human', () => {
    // The reveal belongs to the Vietnamese owner; a Vietnamese OPPONENT
    // learns the human position, not the other way round.
    const bridge = createSimulationBridge('outpost-vision-fixture', {
      civilizationsByOwner: new Map([[2, 'Vietnamese']]),
    });
    expect(memoryTownCenterAt(bridge, 40, 26)).toBeUndefined();
  });
});
