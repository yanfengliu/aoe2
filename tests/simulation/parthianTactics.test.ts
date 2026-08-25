import { describe, expect, it } from 'vitest';

import { createCombatStateFactory } from '../../src/game/simulation/bridge/combatStateFactory';
import { pierceArmorTechBonus } from '../../src/game/simulation/armorTechBonuses';
import { parthianSpearmanAttackBonus } from '../../src/game/simulation/parthianTechEffects';
import { projectileTechOptions } from '../../src/game/simulation/bridge/projectileTechOptions';
import { RESEARCH_COSTS, RESEARCH_TIME_TICKS } from '../../src/game/simulation/researchTables';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import { resolveDueProjectiles } from '../../src/game/simulation/bridge/projectileOps';
import { createEmptyProjectileSlot } from '../../src/game/simulation/bridge/projectileTypes';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import type { CombatState } from '../../src/game/simulation/bridge/systems/systemTypes';
import type {
  ResearchableTechnologyType,
  UnitType,
} from '../../src/game/simulation/types';

const NONE: ReadonlySet<ResearchableTechnologyType> = new Set();
const PARTHIAN: ReadonlySet<ResearchableTechnologyType> = new Set(['parthian-tactics']);

// technologies.csv: Parthian Tactics, Imperial, Archery Range, 200 food +
// 250 gold, 65 s — "+1/+2 AR and Cavalry Archer +4 and Mangudai +2 against
// pikemen". Two halves, wired through two different seams: the armor half
// rides the per-unit combat state (like every other armor tech), the attack
// half is DERIVED at the damage site from the owner's researched set (like
// Sappers), because the bonus depends on the TARGET's armor class.
describe('Parthian Tactics — data (technologies.csv)', () => {
  it('costs 200 food + 250 gold and takes 65 seconds', () => {
    expect(RESEARCH_COSTS['parthian-tactics']).toEqual({ food: 200, gold: 250 });
    expect(RESEARCH_TIME_TICKS['parthian-tactics']).toBe(650); // 65 s × 10 TPS.
  });
});

describe('Parthian Tactics — where it can be researched', () => {
  const isAtLeastAge = (age: 'castle-age' | 'imperial-age') =>
    (_owner: number, minAge: string) => minAge === 'castle-age' || minAge === age;

  it('is not offered at the Archery Range before the Imperial Age', () => {
    const options = projectileTechOptions(
      'archery-range', 1, isAtLeastAge('castle-age'), () => false,
    );
    expect(options).toEqual(['thumb-ring']);
  });

  it('is offered at the Archery Range in the Imperial Age', () => {
    const options = projectileTechOptions(
      'archery-range', 1, isAtLeastAge('imperial-age'), () => false,
    );
    expect(options).toContain('parthian-tactics');
  });

  it('stops being offered once it is researched', () => {
    const options = projectileTechOptions(
      'archery-range', 1, isAtLeastAge('imperial-age'),
      (_owner, tech) => tech === 'parthian-tactics',
    );
    expect(options).not.toContain('parthian-tactics');
  });

  it('is not offered anywhere else', () => {
    for (const building of ['university', 'stable', 'barracks'] as const) {
      const options = projectileTechOptions(
        building, 1, isAtLeastAge('imperial-age'), () => false,
      );
      expect(options).not.toContain('parthian-tactics');
    }
  });
});

describe('Parthian Tactics — the armor half (+1 melee / +2 pierce)', () => {
  function techBonus(unitType: UnitType, techs: ReadonlySet<ResearchableTechnologyType>) {
    const factory = createCombatStateFactory({
      hasTechnology: (_owner, tech) => techs.has(tech),
      getCivilization: () => 'Byzantines',
    getAge: () => 'imperial-age',
    });
    const state = factory(1, unitType);
    return { melee: state.armor, pierce: pierceArmorTechBonus(state) };
  }

  it('armors the whole cavalry-archer class, unique units included', () => {
    for (const unitType of [
      'cavalry-archer', 'heavy-cavalry-archer', 'mangudai', 'elite-mangudai',
      // The War Wagon is a mounted archer too, so it takes the armour — and,
      // per its own units.csv row, none of the anti-spearman attack.
      'war-wagon', 'elite-war-wagon',
    ] as const) {
      expect(techBonus(unitType, PARTHIAN)).toEqual({ melee: 1, pierce: 2 });
    }
  });

  it('leaves foot archers and cavalry alone', () => {
    for (const unitType of ['archer', 'arbalest', 'knight', 'militia'] as const) {
      expect(techBonus(unitType, PARTHIAN)).toEqual({ melee: 0, pierce: 0 });
    }
  });

  it('stacks with the archer armor line rather than replacing it', () => {
    const both: ReadonlySet<ResearchableTechnologyType> = new Set([
      'parthian-tactics', 'ring-archer-armor',
    ]);
    // Parthian (+1/+2) + Ring Archer Armor (+1/+2) = +2 melee / +4 pierce.
    expect(techBonus('cavalry-archer', both)).toEqual({ melee: 2, pierce: 4 });
  });
});

describe('Parthian Tactics — the attack half (vs the spearman class)', () => {
  it('adds +4 for the cavalry-archer line and +2 for the Mangudai line', () => {
    expect(parthianSpearmanAttackBonus(PARTHIAN, 'cavalry-archer', 'pikeman')).toBe(4);
    expect(parthianSpearmanAttackBonus(PARTHIAN, 'heavy-cavalry-archer', 'spearman')).toBe(4);
    expect(parthianSpearmanAttackBonus(PARTHIAN, 'mangudai', 'halberdier')).toBe(2);
    expect(parthianSpearmanAttackBonus(PARTHIAN, 'elite-mangudai', 'pikeman')).toBe(2);
  });

  it('adds nothing without the technology', () => {
    expect(parthianSpearmanAttackBonus(NONE, 'cavalry-archer', 'pikeman')).toBe(0);
  });

  it('adds nothing against a target outside the spearman class', () => {
    expect(parthianSpearmanAttackBonus(PARTHIAN, 'cavalry-archer', 'knight')).toBe(0);
    expect(parthianSpearmanAttackBonus(PARTHIAN, 'cavalry-archer', 'archer')).toBe(0);
  });

  it('adds nothing for an attacker outside the cavalry-archer class', () => {
    expect(parthianSpearmanAttackBonus(PARTHIAN, 'arbalest', 'pikeman')).toBe(0);
    expect(parthianSpearmanAttackBonus(PARTHIAN, 'knight', 'pikeman')).toBe(0);
  });

  it('gives the War Wagon the armour and none of the attack', () => {
    // technologies.csv names only the Cavalry Archer and the Mangudai for the
    // attack half, and the War Wagon's own row carries no anti-spearman value.
    expect(parthianSpearmanAttackBonus(PARTHIAN, 'war-wagon', 'pikeman')).toBe(0);
    expect(parthianSpearmanAttackBonus(PARTHIAN, 'elite-war-wagon', 'pikeman')).toBe(0);
  });
});

// The seam the pure function cannot prove: a cavalry archer's ARROW has to
// carry the bonus, and a cavalry archer only ever damages anything through a
// projectile impact. Without this, the tech would be researchable, cost the
// resources, and change no damage at all.
describe('Parthian Tactics — landed damage at the projectile impact site', () => {
  function combat(overrides: Partial<CombatState> = {}): CombatState {
    return {
      currentHp: 1000, maxHp: 1000, attackDamage: 6, attackRange: 4,
      reloadTicks: 20, cooldownTicks: 0, armor: 0,
      ...overrides,
    } as CombatState;
  }

  function damageDealt(
    techs: ReadonlySet<ResearchableTechnologyType>,
    attackerType: UnitType,
    targetType: UnitType,
  ): number {
    const slot = createEmptyProjectileSlot();
    const targetCombat = combat();
    slot.inFlight.push({
      id: 1, attackerId: 1, attackerOwner: 1, attackerUnitType: attackerType,
      targetId: 2, targetKind: 'unit',
      originX: 0, originY: 10, aimX: 10, aimY: 10,
      launchTick: 0, impactTick: 5,
      baseDamage: 6, buildingDamage: null, attackType: 'pierce',
      willHit: true, isArea: false,
    });
    const world = {
      getComponent: (_id: number, component: string) =>
        component === 'unit' ? { unitType: targetType, owner: 2 } : { x: 10, y: 10 },
      query: () => [],
    } as unknown as GameWorld;
    resolveDueProjectiles({
      world, slot, tick: 5,
      combatStates: new Map([[2, targetCombat]]),
      technologiesFor: () => techs,
      damageBuilding: () => false,
      destroyUnit: () => {},
      addKill: () => {},
      markCombatDirty: () => {},
      markRender: () => {},
    });
    return 1000 - targetCombat.currentHp;
  }

  it('lands 4 more damage on a pikeman once the technology is researched', () => {
    const before = damageDealt(NONE, 'cavalry-archer', 'pikeman');
    const after = damageDealt(PARTHIAN, 'cavalry-archer', 'pikeman');
    expect(after - before).toBe(4);
  });

  it('lands 2 more for a Mangudai', () => {
    const before = damageDealt(NONE, 'mangudai', 'pikeman');
    const after = damageDealt(PARTHIAN, 'mangudai', 'pikeman');
    expect(after - before).toBe(2);
  });

  it('changes nothing when the target is not a spearman', () => {
    expect(damageDealt(PARTHIAN, 'cavalry-archer', 'knight'))
      .toBe(damageDealt(NONE, 'cavalry-archer', 'knight'));
  });

  it('changes nothing for a foot archer', () => {
    expect(damageDealt(PARTHIAN, 'arbalest', 'pikeman'))
      .toBe(damageDealt(NONE, 'arbalest', 'pikeman'));
  });
});

// The end-to-end path the unit tests cannot see: an Imperial player selects a
// real Archery Range, the card offers the technology, and researching it
// completes. This is the check that would catch the building offering nothing.
describe('Parthian Tactics — researched in a real match', () => {
  it('is offered at an Imperial Archery Range and completes', () => {
    const bridge = createSimulationBridge('imperial-upgrades-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('parthian-tactics');
    expect(bridge.queueResearch('parthian-tactics')).toBe(true);

    // A researched technology drops out of the options — the observable signal
    // that it completed.
    expect(stepBridgeUntil(
      bridge,
      () => {
        selectOwnedBuildingDirect(bridge, 1, 'archery-range');
        return !bridge.getSelectionState().researchOptions.includes('parthian-tactics');
      },
      { maxSteps: 1_200 },
    )).toBe(true);
  }, 60_000);
});
