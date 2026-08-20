import { it } from 'vitest';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

it('traces scout 2257 through block 3', () => {
  const bridge = createSimulationBridge('aoe2-canary');
  const world = bridge.world as { getComponent<T>(id: number, name: string): T | null };
  const id = bridge.getEconomyState().units
    .filter((u) => u.owner === 2 && u.unitType === 'scout').map((u) => u.id)[0]!;
  console.log('scout id', id, 'box', JSON.stringify(world.getComponent(id, 'wanderBounds')));
  for (let i = 0; i < 2000; i += 1) {
    bridge.step(100);
    if (i >= 1795 && i <= 1830) {
      const p = world.getComponent<{ x: number; y: number }>(id, 'position')!;
      const t = world.getComponent<{ fineX: number; fineY: number }>(id, 'unitTransform')!;
      const v = world.getComponent<{ dx: number; dy: number }>(id, 'velocity');
      console.log(i, 'cell', p.x, p.y, 'fine', t.fineX, t.fineY, 'v', JSON.stringify(v));
    }
  }
});
