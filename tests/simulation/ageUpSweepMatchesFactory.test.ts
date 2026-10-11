// A unit standing when its owner advances ends up where a unit created after
// the advance starts (work 120; defect register 2026-10-11, "Civilization
// bonuses the code applied differently from Definitive Edition").
//
// THE DEFECT: the Inca clause "Villagers affected by Infantry Blacksmith
// upgrades starting in Castle Age" (DE help text, aoe2techtree 3bb43b14, DE
// update 185872) was checked when a technology finished and when a villager was
// created, and never when the Castle Age landed. A villager standing at the
// advance kept no armor from the Scale Mail researched in the Feudal Age, while
// a villager trained a second later had it.
//
// THE CLASS: any stat whose bonus depends on the owner's age is derived twice,
// by the combat-state factory for a new unit and by the age-up sweep for a
// standing one. This walks every civilization, every trainable unit and every
// advance, once with nothing researched and once with every technology the
// research tables host, and asks the two to agree.
//
// BOUNDS: armor, pierce armor, attack, range and reload. Hit points are left
// out: the sweep scales stored hit points, flat technology bonuses included, by
// the ladder's ratio, and the factory multiplies the base and then adds the
// flats, so the two differ by design for a unit that took Bloodlines before
// its ladder stepped. One unit per run, no team bonuses, and the sweep is
// driven through a minimal world holding that unit rather than a match.

import { describe, expect, it } from 'vitest';

import { applyAgeScaledHpSweep } from '../../src/game/simulation/bridge/ageScaledHpSweep';
import {
  buildingHealthStatesCodec,
  combatStatesCodec,
  playerCivilizationsCodec,
  researchedTechnologiesCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createCombatStateFactory } from '../../src/game/simulation/bridge/combatStateFactory';
import type { CombatState } from '../../src/game/simulation/bridge/systems/systemTypes';
import { RESEARCHES_BY_BUILDING } from '../../src/game/simulation/buildingProductionTables';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { TRAINABLE_UNIT_TYPES } from '../../src/game/simulation/trainingCosts';
import type { AgeType, ResearchableTechnologyType, UnitType } from '../../src/game/simulation/types';

const ADVANCES: ReadonlyArray<readonly [AgeType, AgeType]> = [
  ['dark-age', 'feudal-age'],
  ['feudal-age', 'castle-age'],
  ['castle-age', 'imperial-age'],
];
const UNIT_ID = 7;
const OWNER = 1;

const EVERY_HOSTED_TECHNOLOGY: ReadonlySet<ResearchableTechnologyType> = new Set(
  [...RESEARCHES_BY_BUILDING.values()].flat(),
);

function created(civilization: string, unitType: UnitType, researched: ReadonlySet<ResearchableTechnologyType>, age: AgeType): CombatState {
  return createCombatStateFactory({
    hasTechnology: (_owner, technology) => researched.has(technology),
    getCivilization: () => civilization,
    getAge: () => age,
  })(OWNER, unitType);
}

function sweptAcross(civilization: string, unitType: UnitType, researched: ReadonlySet<ResearchableTechnologyType>, from: AgeType, to: AgeType): CombatState {
  const state = created(civilization, unitType, researched, from);
  const slots = new Map<unknown, unknown>([
    [combatStatesCodec, new Map([[UNIT_ID, state]])],
    [playerCivilizationsCodec, new Map([[OWNER, civilization]])],
    [researchedTechnologiesCodec, new Map([[OWNER, new Set(researched)]])],
    [buildingHealthStatesCodec, new Map()],
  ]);
  const slot = (codec: unknown) => {
    if (!slots.has(codec)) throw new Error('the sweep read a state slot this test does not provide');
    return slots.get(codec);
  };
  const accessor = {
    get: slot,
    markDirty: () => undefined,
    mutate: (codec: unknown, change: (value: unknown) => void) => change(slot(codec)),
  };
  const world = {
    query: (kind: string) => (kind === 'unit' ? [UNIT_ID] : []),
    getComponent: (id: number, kind: string) => (id === UNIT_ID && kind === 'unit' ? { unitType, owner: OWNER } : undefined),
  };
  applyAgeScaledHpSweep(world as never, accessor as never, OWNER, from, to);
  return state;
}

const COMPARED = ['armor', 'pierceArmorBonus', 'attackDamage', 'attackRange', 'reloadTicks'] as const;

describe('the age-up sweep and the combat-state factory agree', () => {
  it('for every civilization, trainable unit and advance, with nothing and with everything researched', () => {
    let changedByAdvance = 0;
    for (const researched of [new Set<ResearchableTechnologyType>(), EVERY_HOSTED_TECHNOLOGY]) {
      for (const civilization of CIVILIZATION_NAMES) {
        for (const unitType of TRAINABLE_UNIT_TYPES) {
          for (const [from, to] of ADVANCES) {
            const fresh = created(civilization, unitType, researched, to);
            const before = created(civilization, unitType, researched, from);
            const standing = sweptAcross(civilization, unitType, researched, from, to);
            for (const field of COMPARED) {
              expect(standing[field], `${civilization} ${unitType} ${from} -> ${to}: ${field}`).toBe(fresh[field]);
              if (before[field] !== fresh[field]) changedByAdvance += 1;
            }
          }
        }
      }
    }
    // The walk met advances that change a stat, so agreement is not vacuous.
    expect(changedByAdvance).toBeGreaterThan(0);
  });

  it('an Inca villager standing at the Castle advance wears the Scale Mail researched before it', () => {
    const scaleMail = new Set<ResearchableTechnologyType>(['scale-mail-armor']);
    expect(created('Incas', 'villager', scaleMail, 'feudal-age').armor).toBe(0);
    expect(sweptAcross('Incas', 'villager', scaleMail, 'feudal-age', 'castle-age').armor).toBe(1);
    expect(sweptAcross('Britons', 'villager', scaleMail, 'feudal-age', 'castle-age').armor).toBe(0);
  });
});
