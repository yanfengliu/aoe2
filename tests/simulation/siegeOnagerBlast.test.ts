// Siege Onager's wider blast (spec §10.7, v0.3.128): the Imperial upgrade's
// whole identity is a 1.5-cell radius that reaches the DIAGONAL neighbours
// (√2 ≈ 1.41) an onager's 1.25 cannot. The table had listed siege-onager as
// "off-roster" long after the roster and its upgrade line shipped, so the
// upgrade silently changed nothing — a stale-deferral bug, El Dorado's twin.

import { describe, expect, it } from 'vitest';

import { unitBlastRadius } from '../../src/game/simulation/prototypeUnitRules';
import { computeBlastDamage } from '../../src/game/simulation/bridge/blastDamage';

const diagonalNeighbour = {
  id: 9,
  unitType: 'militia' as const,
  position: { x: 11, y: 11 },
  armor: 0,
  pierceArmorBonus: 0,
};

describe('the siege onager blast', () => {
  it('carries units.csv truth: 1.5, wider than the onager', () => {
    expect(unitBlastRadius('siege-onager')).toBe(1.5);
    expect(unitBlastRadius('onager')).toBe(1.25);
    expect(unitBlastRadius('siege-onager')).toBeGreaterThan(unitBlastRadius('onager'));
  });

  it('reaches the diagonal neighbour the onager cannot', () => {
    const impact = { x: 10, y: 10 };
    const none = new Set<number>();
    const onagerHits = computeBlastDamage('onager', 60, impact, [diagonalNeighbour], none);
    const siegeHits = computeBlastDamage('siege-onager', 75, impact, [diagonalNeighbour], none);
    expect(onagerHits).toHaveLength(0);
    expect(siegeHits).toHaveLength(1);
    expect(siegeHits[0]!.damage).toBeGreaterThan(0);
  });
});
