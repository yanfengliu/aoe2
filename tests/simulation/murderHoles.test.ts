import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

import {
  buildingMinimumRange,
  hasBuildingMinimumRange,
} from '../../src/game/simulation/buildingMinimumRange';
import { projectileTechOptions } from '../../src/game/simulation/bridge/projectileTechOptions';
import { RESEARCH_COSTS, RESEARCH_TIME_TICKS } from '../../src/game/simulation/researchTables';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';

const none = new Set<ResearchableTechnologyType>();
const holed = new Set<ResearchableTechnologyType>(['murder-holes']);

describe('a defensive building shooting at its own feet', () => {
  // AoE2 gives towers and castles a MINIMUM range: an attacker standing right
  // against the wall is under the arrow slits and cannot be hit. That is what
  // makes hugging a tower with infantry a real tactic, and what Murder Holes
  // is sold to fix.
  it('cannot hit a unit pressed against it', () => {
    for (const buildingType of ['watch-tower', 'castle', 'bombard-tower'] as const) {
      expect(hasBuildingMinimumRange(buildingType, none), buildingType).toBe(true);
      expect(buildingMinimumRange(buildingType, none), buildingType).toBeGreaterThan(0);
    }
  });

  it('has no minimum range once Murder Holes is researched', () => {
    for (const buildingType of ['watch-tower', 'castle', 'bombard-tower'] as const) {
      expect(hasBuildingMinimumRange(buildingType, holed), buildingType).toBe(false);
      expect(buildingMinimumRange(buildingType, holed), buildingType).toBe(0);
    }
  });

  it('never applies to a Town Center, which defends its own villagers', () => {
    // AoE2's minimum range is a Tower and Castle rule. A Town Center that could
    // not defend the villagers standing under it would be a trap, since that is
    // exactly where they gather and where they garrison from.
    expect(hasBuildingMinimumRange('town-center', none)).toBe(false);
    expect(buildingMinimumRange('town-center', none)).toBe(0);
  });

  it('never applies to a building that does not shoot', () => {
    for (const buildingType of ['house', 'mill', 'barracks', 'stone-wall'] as const) {
      expect(hasBuildingMinimumRange(buildingType, none), buildingType).toBe(false);
    }
  });
});

describe('researching Murder Holes', () => {
  it('is offered at the University in the Castle Age', () => {
    const options = projectileTechOptions('university', 1, () => true, () => false);
    expect(options).toContain('murder-holes');
  });

  it('drops off the list once researched', () => {
    const options = projectileTechOptions(
      'university', 1, () => true, (_owner, tech) => tech === 'murder-holes',
    );
    expect(options).not.toContain('murder-holes');
  });

  it('costs what technologies.csv says', () => {
    expect(RESEARCH_COSTS['murder-holes']).toEqual({ food: 200, stone: 200 });
    expect(RESEARCH_TIME_TICKS['murder-holes']).toBe(600);
  });
});

describe('a militia standing against a tower', () => {
  // The tactic the minimum range creates: walk right up to the tower and it
  // cannot shoot you. Both fixtures put an enemy militia in the cell touching a
  // Watch Tower's footprint; they differ only in whether the tower's owner has
  // researched Murder Holes.
  function militiaHpAfter(seed: string, ticks: number): { before: number; after: number } {
    const bridge = createSimulationBridge(seed);
    const militia = bridge.getEconomyState().units
      .find((u) => u.owner === 2 && u.unitType === 'militia');
    if (!militia) throw new Error(`${seed} needs an enemy militia`);
    // A unit that has been killed reads 0, which is simply the far end of
    // having been shot at.
    const hpOf = (): number => bridge.getEntityHealth(militia.id)?.currentHp ?? 0;
    const before = hpOf();
    for (let tick = 0; tick < ticks; tick += 1) bridge.step(100);
    return { before, after: hpOf() };
  }

  it('is safe from a tower that has no Murder Holes', () => {
    const { before, after } = militiaHpAfter('murder-holes-hugged-fixture', 400);
    expect(after, 'the tower shot a unit pressed against it').toBe(before);
  });

  it('is shot once the tower has Murder Holes', () => {
    const { before, after } = militiaHpAfter('murder-holes-researched-fixture', 400);
    expect(after, 'Murder Holes did not let the tower shoot').toBeLessThan(before);
  });
});
