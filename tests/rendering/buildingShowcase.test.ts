import { describe, expect, it } from 'vitest';

import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createBuildingShowcaseFixture } from '../../src/game/simulation/fixtures/buildingShowcase';
import type { BuildingType } from '../../src/game/simulation/types';

const BUILDING_TYPES = Object.keys(AUTHORITATIVE_BUILDING_FOOTPRINTS) as BuildingType[];

describe('building visual showcase', () => {
  it('contains exactly one completed example of every building type', () => {
    const scenario = createBuildingShowcaseFixture('building-showcase-fixture');
    const kinds = scenario.spawns
      .filter((spawn) => spawn.owner === 1)
      .map((spawn) => spawn.kind)
      .filter((kind): kind is BuildingType => kind in AUTHORITATIVE_BUILDING_FOOTPRINTS);

    expect([...kinds].sort()).toEqual([...BUILDING_TYPES].sort());
  });

  it('keeps the showcased footprints separate', () => {
    const scenario = createBuildingShowcaseFixture('building-showcase-fixture');
    const buildings = scenario.spawns.filter(
      (spawn): spawn is typeof spawn & { kind: BuildingType } => (
        spawn.kind in AUTHORITATIVE_BUILDING_FOOTPRINTS
      ),
    );

    for (let leftIndex = 0; leftIndex < buildings.length; leftIndex += 1) {
      const left = buildings[leftIndex]!;
      const leftFootprint = AUTHORITATIVE_BUILDING_FOOTPRINTS[left.kind];
      for (let rightIndex = leftIndex + 1; rightIndex < buildings.length; rightIndex += 1) {
        const right = buildings[rightIndex]!;
        const rightFootprint = AUTHORITATIVE_BUILDING_FOOTPRINTS[right.kind];
        const overlaps = (
          left.x < right.x + rightFootprint.width
          && left.x + leftFootprint.width > right.x
          && left.y < right.y + rightFootprint.height
          && left.y + leftFootprint.height > right.y
        );

        expect(overlaps, `${left.kind} overlaps ${right.kind}`).toBe(false);
      }
    }
  });

  it('keeps the showcase match running so the evidence frame has no victory overlay', () => {
    const bridge = createSimulationBridge('building-showcase-fixture');

    bridge.step(100);

    expect(bridge.getHudState().matchState.outcome).toBe('running');
  });
});
