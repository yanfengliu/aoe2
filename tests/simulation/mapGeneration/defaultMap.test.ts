import { describe, expect, it } from 'vitest';

import { createDefaultMap } from '../../../src/game/simulation/mapGeneration/defaultMap';
import type { ResourceKind } from '../../../src/game/simulation/types';

const STARTING_RESOURCE_KINDS: ResourceKind[] = [
  'sheep',
  'boar',
  'berry-bush',
  'gold-mine',
  'stone-mine',
  'tree',
];

describe('createDefaultMap', () => {
  it('is deterministic for the same seed', () => {
    const left = createDefaultMap('aoe2-prototype');
    const right = createDefaultMap('aoe2-prototype');
    expect(left).toEqual(right);
  });

  it('produces different scenarios for different seeds', () => {
    const a = createDefaultMap('aoe2-prototype');
    const b = createDefaultMap('alt-seed-one');
    expect(a).not.toEqual(b);
  });

  it('never places two resources on the same cell', () => {
    const scenario = createDefaultMap('aoe2-prototype');
    const seen = new Map<string, string>();
    for (const spawn of scenario.spawns) {
      if (!STARTING_RESOURCE_KINDS.includes(spawn.kind as ResourceKind) && spawn.kind !== 'fish' && spawn.kind !== 'relic') {
        continue;
      }
      const key = `${spawn.x},${spawn.y}`;
      const existing = seen.get(key);
      expect(existing, `duplicate at ${key}: ${existing} vs ${spawn.kind}`).toBeUndefined();
      seen.set(key, spawn.kind);
    }
  });

  it('guarantees every starting resource kind near every player base', () => {
    const scenario = createDefaultMap('aoe2-prototype');
    const NEAR_RADIUS_SQ = 10 * 10;

    for (const start of scenario.starts) {
      for (const kind of STARTING_RESOURCE_KINDS) {
        const nearby = scenario.spawns.some((spawn) => {
          if (spawn.kind !== kind) {
            return false;
          }
          if (spawn.baseOwner !== start.owner) {
            return false;
          }
          const dx = spawn.x - start.townCenter.x;
          const dy = spawn.y - start.townCenter.y;
          return dx * dx + dy * dy <= NEAR_RADIUS_SQ;
        });
        expect(nearby, `missing ${kind} near owner ${start.owner} TC (${start.townCenter.x},${start.townCenter.y})`).toBe(true);
      }
    }
  });

  it('preserves the canonical per-owner resource counts', () => {
    const scenario = createDefaultMap('aoe2-prototype');
    const countBy = (kind: string, owner: number): number =>
      scenario.spawns.filter((spawn) => spawn.kind === kind && spawn.baseOwner === owner).length;

    for (const start of scenario.starts) {
      expect(countBy('sheep', start.owner)).toBe(4);
      expect(countBy('boar', start.owner)).toBe(2);
      expect(countBy('berry-bush', start.owner)).toBe(6);
      expect(countBy('gold-mine', start.owner)).toBe(4);
      expect(countBy('stone-mine', start.owner)).toBe(4);
      expect(countBy('tree', start.owner)).toBe(24);
    }
  });

  it('preserves the standard TC/villager/scout opening', () => {
    const scenario = createDefaultMap('aoe2-prototype');
    const countBy = (kind: string): number =>
      scenario.spawns.filter((spawn) => spawn.kind === kind).length;

    expect(countBy('town-center')).toBe(2);
    expect(countBy('villager')).toBe(6);
    // Two starting scouts (one per player) + one forward enemy scout.
    expect(countBy('scout')).toBe(3);
    expect(countBy('house')).toBe(1);
    expect(countBy('fish')).toBeGreaterThan(0);
    expect(countBy('relic')).toBe(2);
  });

  it('uses the same MAP_WIDTH/MAP_HEIGHT as the simulation constants', () => {
    const scenario = createDefaultMap('aoe2-prototype');
    expect(scenario.width).toBe(60);
    expect(scenario.height).toBe(36);
    expect(scenario.terrain.length).toBe(36);
    expect(scenario.terrain[0]?.length ?? 0).toBe(60);
  });
});
