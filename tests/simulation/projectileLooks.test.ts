// What a shot looks like in flight, against Definitive Edition (spec §10.4;
// defect register, 2026-09-26, "The Siege Onager, the Capped Ram and the Elite
// Skirmisher were left out of tables that named the rest of their line").
//
// `projectileVisualKind` was a switch that named the Mangonel and the Onager
// and let everything else fall through to an arrow, so the Siege Onager's
// stone, the Cannon Galleon's cannonball and the Turtle Ship's were all drawn
// as arrows. This is the census the switch lacked: every unit that fires a
// projectile, with the shot DE gives it. DE's shots come from its help texts
// (aoe2techtree 3bb43b14, DE update 185872: "Siege Gunpowder Warship", "Siege
// Warship", "Foot Gunner", "ranged melee attack", "spews fire") and, for the
// Turtle Ship, the AoE2 wiki ("shoots cannonballs and fires rockets").
//
// Bound: which look each unit gets, and that the frame carries it. How a look
// is drawn is tests/rendering/projectileParts.test.ts; what it looks like on
// screen is the before/after capture recorded with the register entry.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { projectileVisualKind } from '../../src/game/simulation/bridge/projectileProjection';
import {
  BLAST_CENSUS_ATTACKER,
  BLAST_CENSUS_UNIT_TARGET,
  blastCensusSeed,
} from '../../src/game/simulation/fixtures/blastCensusLayout';
import { firesProjectile } from '../../src/game/simulation/projectileRules';
import { UNIT_MAX_HP } from '../../src/game/simulation/prototypeUnitRules/statTables';
import type { ProjectedProjectileView, UnitType } from '../../src/game/simulation/types';

type Look = ProjectedProjectileView['visual'];

const ARROWS: readonly UnitType[] = [
  'archer', 'crossbowman', 'arbalest', 'skirmisher', 'elite-skirmisher',
  'cavalry-archer', 'heavy-cavalry-archer', 'longbowman', 'elite-longbowman',
  'chu-ko-nu', 'elite-chu-ko-nu', 'war-wagon', 'elite-war-wagon',
  'plumed-archer', 'elite-plumed-archer', 'mangudai', 'elite-mangudai',
  'galley', 'war-galley', 'galleon', 'longboat', 'elite-longboat',
];

/** DE's shot for every unit that fires one and has a look for it here. */
const DE_LOOK: Partial<Record<UnitType, Look>> = {
  ...Object.fromEntries(ARROWS.map((unitType) => [unitType, 'arrow' as const])),
  scorpion: 'bolt',
  'heavy-scorpion': 'bolt',
  mangonel: 'stone',
  onager: 'stone',
  'siege-onager': 'stone',
  trebuchet: 'boulder',
  'bombard-cannon': 'cannonball',
  'cannon-galleon': 'cannonball',
  'elite-cannon-galleon': 'cannonball',
  'turtle-ship': 'cannonball',
  'elite-turtle-ship': 'cannonball',
};

/**
 * DE's shot has no look in this game yet, so it is drawn as an arrow. Each is
 * a recorded divergence (§10.4), and this test fails on an entry the day the
 * unit gets a look of its own, so the list cannot outlive the gap.
 */
const NO_LOOK_YET: Partial<Record<UnitType, string>> = {
  'hand-cannoneer': 'a musket ball',
  janissary: 'a musket ball',
  'elite-janissary': 'a musket ball',
  conquistador: 'a musket ball',
  'elite-conquistador': 'a musket ball',
  'throwing-axeman': 'a thrown axe',
  'elite-throwing-axeman': 'a thrown axe',
  mameluke: 'a thrown scimitar',
  'elite-mameluke': 'a thrown scimitar',
  'fire-ship': 'a jet of fire',
  'fast-fire-ship': 'a jet of fire',
};

describe('what a shot looks like', () => {
  it('draws DE\'s shot for every unit that fires one, and names every unit it cannot', () => {
    const shooters = (Object.keys(UNIT_MAX_HP) as UnitType[]).filter(firesProjectile);
    expect(shooters.length, 'units that fire a projectile').toBeGreaterThanOrEqual(44);
    const problems: string[] = [];
    for (const unitType of shooters) {
      const look = projectileVisualKind(unitType);
      const expected = DE_LOOK[unitType];
      const gap = NO_LOOK_YET[unitType];
      if (expected === undefined && gap === undefined) {
        problems.push(`${unitType} fires a projectile, and neither DE_LOOK nor NO_LOOK_YET says what it looks like`);
      } else if (expected !== undefined && look !== expected) {
        problems.push(`${unitType} is drawn as '${look}'; DE fires '${expected}'`);
      } else if (gap !== undefined && look !== 'arrow') {
        problems.push(`${unitType} now draws '${look}', not the stand-in arrow: take it off NO_LOOK_YET (DE: ${gap})`);
      }
    }
    for (const unitType of [...Object.keys(DE_LOOK), ...Object.keys(NO_LOOK_YET)] as UnitType[]) {
      if (!firesProjectile(unitType)) problems.push(`${unitType} is listed but fires no projectile`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('draws the Siege Onager\'s shot as the Onager\'s stone, landing when the Onager\'s would', () => {
    // The two blast-census fixtures share one layout, so the same order sends
    // the same span. The Onager is the control: its stone was always right.
    function firstShot(unitType: UnitType) {
      const bridge = createSimulationBridge(blastCensusSeed(unitType));
      const attacker = bridge.getEconomyState().units.find(
        (unit) => unit.owner === 1 && unit.x === BLAST_CENSUS_ATTACKER.x && unit.y === BLAST_CENSUS_ATTACKER.y,
      );
      const target = bridge.getEconomyState().units.find(
        (unit) => unit.owner === 2 && unit.x === BLAST_CENSUS_UNIT_TARGET.x && unit.y === BLAST_CENSUS_UNIT_TARGET.y,
      );
      if (attacker?.unitType !== unitType || !target) throw new Error(`the ${unitType} census fixture moved its attacker or target`);
      expect(bridge.selectUnitsByIds([attacker.id])).toBe(true);
      expect(bridge.issueContextCommandAtEntity(target.id)).toBe(true);
      for (let step = 0; step < 60; step += 1) {
        bridge.step(100);
        const shot = bridge.getRenderState().frame?.projectiles[0];
        if (shot) return shot;
      }
      throw new Error(`the ${unitType} fired nothing the player could see in 60 ticks`);
    }
    const onager = firstShot('onager');
    const siegeOnager = firstShot('siege-onager');
    expect(onager.visual).toBe('stone');
    expect(siegeOnager.visual, 'the Siege Onager\'s shot as the frame draws it').toBe('stone');
    expect(siegeOnager.impactTick - siegeOnager.launchTick, 'ticks in the air over the same span')
      .toBe(onager.impactTick - onager.launchTick);
  });
});
