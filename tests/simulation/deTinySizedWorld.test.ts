// The world the frame-cost gates count on (tests/helpers/deTinySizedWorld.ts) is DE Tiny's scale and a live match:
// if it were smaller, or if the computer sat still on it, a count taken on it would say nothing about a DE Tiny
// match. This holds both, so a gate that passes on it has passed on what it names.
import { describe, expect, it } from 'vitest';

import { TPS } from '../../src/game/simulation/prototypeScenario';
import { createDeTinySizedBridge, createDeTinySizedScenario, DE_TINY_SIDE } from '../helpers/deTinySizedWorld';

describe('the DE Tiny sized world', () => {
  it('is 120x120 with two starts about 79 cells apart and about 1,600 trees', () => {
    const scenario = createDeTinySizedScenario();
    expect([scenario.width, scenario.height]).toEqual([DE_TINY_SIDE, DE_TINY_SIDE]);
    expect(scenario.terrain.flat()).toHaveLength(14_400);
    const [first, second] = scenario.starts;
    const apart = Math.hypot(first!.townCenter.x - second!.townCenter.x, first!.townCenter.y - second!.townCenter.y);
    // DE's Arabia on Tiny: 77-82 tiles (plan 150, "DE's maps, sourced").
    expect(apart).toBeGreaterThan(77);
    expect(apart).toBeLessThan(82);
    const trees = scenario.spawns.filter((spawn) => spawn.kind === 'tree').length;
    // M1's scratch DE Tiny held 1,489 trees; the costs grow with them, so the gate world holds no fewer.
    expect(trees).toBeGreaterThanOrEqual(1_489);
    expect(trees).toBeLessThan(2_000);
    expect(createDeTinySizedScenario()).toEqual(scenario);
  });

  it('projects a cell for every tile, and the computer plays both seats on it', () => {
    const bridge = createDeTinySizedBridge();
    expect(bridge.getMapSize()).toEqual({ width: DE_TINY_SIDE, height: DE_TINY_SIDE });
    const opening = bridge.getRenderState();
    expect(opening.entities.filter((entity) => entity.layer === 'terrain')).toHaveLength(14_400);
    const villagersAt = (): Map<number, number> => {
      const counts = new Map<number, number>();
      for (const unit of bridge.getEconomyState().units) {
        if (unit.unitType === 'villager') counts.set(unit.owner, (counts.get(unit.owner) ?? 0) + 1);
      }
      return counts;
    };
    expect([...villagersAt()].sort()).toEqual([[1, 3], [2, 3]]);
    for (let tick = 0; tick < 600; tick += 1) bridge.step(1000 / TPS);
    expect(bridge.getRenderState().tick).toBe(600);
    // Both Town Centers trained: the match is being played, on both seats.
    const later = villagersAt();
    expect(later.get(1)).toBeGreaterThan(3);
    expect(later.get(2)).toBeGreaterThan(3);
  }, 60_000);
});
