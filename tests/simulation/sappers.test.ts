import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  researchCost,
  researchTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import { canResearchAt } from '../../src/game/simulation/prototypeBuildingRules';
import { isInfantryUnit } from '../../src/game/simulation/prototypeUnitRules';
import {
  SAPPERS_BUILDING_ATTACK_BONUS,
  sappersBuildingAttackBonus,
} from '../../src/game/simulation/sappersTechEffects';
import type { ResearchableTechnologyType, UnitType } from '../../src/game/simulation/types';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

// Sappers (v0.1.64): a researchable Blacksmith tech (AoE2 University; hosted at
// the Blacksmith here, same divergence as Siege Engineers at the Siege
// Workshop) granting the owner's INFANTRY units +15 attack against buildings.
// It is DERIVED at the unit->building damage site (playerCommandsSystem), which
// applies no armor reduction, so the +15 lands raw. No per-unit state, no
// save-format change. See spec §10.7.2.

type Bridge = ReturnType<typeof createSimulationBridge>;

const WITH_SAPPERS: ReadonlySet<ResearchableTechnologyType> = new Set(['sappers']);
const NO_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set();

// Step a militia into destroying the enemy house and return the tick count it
// took (in 5-tick units). The house does not fire back and AI is disabled, so
// the only variable is the militia's per-hit building damage — with Sappers the
// house dies in strictly fewer ticks.
function unitsToDestroyEnemyHouse(fixtureName: string): number {
  const bridge: Bridge = createSimulationBridge(fixtureName);
  const house = bridge
    .getEconomyState()
    .buildings.find((b) => b.owner === 2 && b.buildingType === 'house');
  expect(house).toBeDefined();
  const houseId = house!.id;

  // The militia sits at (13, 8), adjacent to the house at (14, 8).
  expect(bridge.selectEntityAtCell(13, 8)).toBe(true);
  expect(bridge.issueContextCommandAtEntity(houseId)).toBe(true);

  let ticks = 0;
  const MAX = 1500; // 7500 sim ticks — ample for base militia (~4/hit) to fell 75 HP.
  while (ticks < MAX) {
    bridge.step(500); // 5 ticks per iteration.
    ticks += 1;
    const gone =
      bridge.getEconomyState().buildings.find((b) => b.id === houseId) === undefined;
    if (gone) {
      return ticks;
    }
  }
  return MAX;
}

describe('isInfantryUnit — the infantry classification', () => {
  it('classifies militia-line and spearman-line as infantry, others not', () => {
    const infantry: UnitType[] = [
      'militia',
      'man-at-arms',
      'long-swordsman',
      'two-handed-swordsman',
      'champion',
      'spearman',
      'pikeman',
      'halberdier',
    ];
    for (const unitType of infantry) {
      expect(isInfantryUnit(unitType)).toBe(true);
    }
    const nonInfantry: UnitType[] = ['archer', 'villager', 'knight', 'mangonel', 'monk'];
    for (const unitType of nonInfantry) {
      expect(isInfantryUnit(unitType)).toBe(false);
    }
  });
});

describe('sappersBuildingAttackBonus — the derived +15 vs buildings', () => {
  it('is 0 for every unit without the Sappers tech', () => {
    expect(sappersBuildingAttackBonus(NO_TECHS, 'militia')).toBe(0);
    expect(sappersBuildingAttackBonus(NO_TECHS, 'spearman')).toBe(0);
    expect(sappersBuildingAttackBonus(NO_TECHS, 'archer')).toBe(0);
  });

  it('grants +15 to infantry with the tech, and 0 to non-infantry', () => {
    expect(sappersBuildingAttackBonus(WITH_SAPPERS, 'militia')).toBe(
      SAPPERS_BUILDING_ATTACK_BONUS,
    );
    expect(sappersBuildingAttackBonus(WITH_SAPPERS, 'champion')).toBe(15);
    expect(sappersBuildingAttackBonus(WITH_SAPPERS, 'pikeman')).toBe(15);
    // Non-infantry gain nothing even with the tech researched.
    expect(sappersBuildingAttackBonus(WITH_SAPPERS, 'archer')).toBe(0);
    expect(sappersBuildingAttackBonus(WITH_SAPPERS, 'villager')).toBe(0);
    expect(sappersBuildingAttackBonus(WITH_SAPPERS, 'knight')).toBe(0);
    expect(sappersBuildingAttackBonus(WITH_SAPPERS, 'mangonel')).toBe(0);
  });
});

describe('Sappers — cost & research-time tables', () => {
  it('costs 400 food / 200 gold and takes 200 ticks', () => {
    expect(researchCost('sappers')).toEqual({ food: 400, gold: 200 });
    expect(researchTimeTicks('sappers')).toBe(200);
  });
});

describe('Sappers — gating at the Blacksmith', () => {
  it('is researchable only at the Blacksmith', () => {
    expect(canResearchAt('blacksmith', 'sappers')).toBe(true);
    expect(canResearchAt('siege-workshop', 'sappers')).toBe(false);
    expect(canResearchAt('town-center', 'sappers')).toBe(false);
    expect(canResearchAt('monastery', 'sappers')).toBe(false);
  });

  it('is offered at an Imperial-Age Blacksmith and drops once researched', () => {
    const bridge = createSimulationBridge('imperial-blacksmith-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('sappers');

    expect(bridge.queueResearch('sappers')).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          selectOwnedBuildingDirect(bridge, 1, 'blacksmith');
          return !(bridge.getSelectionState().researchOptions ?? []).includes('sappers');
        },
        { maxSteps: 1500 },
      ),
    ).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.getSelectionState().researchOptions ?? []).not.toContain('sappers');
  }, 30_000);

  it('is NOT offered before Imperial Age (pre-Imperial Blacksmith)', () => {
    // The castle-upgrades fixture's player 1 owns a Feudal-Age Blacksmith.
    const bridge = createSimulationBridge('castle-upgrades-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    expect(bridge.getSelectionState().researchOptions ?? []).not.toContain('sappers');
  });
});

describe('Sappers — derived +15 vs buildings in live combat', () => {
  it('a militia with Sappers razes an enemy house in strictly fewer ticks', () => {
    const baseline = unitsToDestroyEnemyHouse('sappers-baseline-fixture');
    const researched = unitsToDestroyEnemyHouse('sappers-researched-fixture');

    // Baseline militia (no bonus) still fells the 75-HP house eventually.
    expect(baseline).toBeLessThan(1500);
    // Sappers (+15/hit) razes it markedly faster.
    expect(researched).toBeLessThan(baseline);
  }, 30_000);
});
