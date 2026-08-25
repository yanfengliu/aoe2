import { it } from 'vitest';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
it('probe hp', () => {
  const bridge = createSimulationBridge('damage-showcase-fixture');
  bridge.step(100);
  for (const b of bridge.getEconomyState().buildings.filter((x) => x.owner === 1)) {
    console.log(b.buildingType, b.x, b.y, JSON.stringify(bridge.getEntityHealth(b.id)));
  }
});
