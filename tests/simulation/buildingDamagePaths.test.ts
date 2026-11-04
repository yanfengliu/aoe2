// Every damage path into a building reads the one armor seam (work 140): each
// case of fixtures/buildingArmorCensus.ts gives the real order a player gives,
// an attack on an enemy building, and reads the first hit off the building's
// hit points, delivered in person or by a shot that lands, against the DE
// oracle (./buildingCombatOracle.ts) over the attack stat the unit carries.
//
// Every unit with an attack is a case once, against a building whose type,
// age and armor technologies rotate, and the named cases add the four DE
// values the brief named and every technology and civilization that changes
// an attack on a building. Until work 140 an Archer took 4 off a House with
// each arrow, a Militia 4 off a Town Center and a Battering Ram 127.
//
// BOUND: the first hit of each case, as ordered; auto-attack, attack-move and
// patrol deliver through the same `deliverUnitAttackOnBuilding`, but no case
// drives them. The values over every attacker, building, age and technology
// are buildingDamageCensus.test.ts's; this file holds the wiring.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge, type SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  BUILDING_ARMOR_CENSUS_CASES,
  buildingArmorCensusAnchor,
  buildingArmorCensusSeed,
  type BuildingArmorCensusCase,
} from '../../src/game/simulation/fixtures/buildingArmorCensus';
import { projectilesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { ProjectileSlotState } from '../../src/game/simulation/bridge/projectileTypes';
import { firesProjectile } from '../../src/game/simulation/prototypeUnitRules';
import { oracleBuildingDamage } from './buildingCombatOracle';
import { stateSlot } from './saveBlobTestUtils';

function firstHit(bridge: SimulationBridge, entry: BuildingArmorCensusCase) {
  const economy = bridge.getEconomyState();
  const attacker = economy.units.find((u) => u.owner === 1 && u.unitType === entry.attacker);
  // By its cell: owner 2 also has its starting Town Center, out of sight.
  const anchor = buildingArmorCensusAnchor(entry.building);
  const target = economy.buildings.find((b) => b.owner === 2 && b.buildingType === entry.building && b.x === anchor.x && b.y === anchor.y);
  expect(attacker, `${entry.name}: attacker`).toBeDefined();
  expect(target, `${entry.name}: target`).toBeDefined();
  expect(bridge.selectEntityById(attacker!.id), `${entry.name}: select`).toBe(true);
  expect(bridge.issueContextCommandAtEntity(target!.id), `${entry.name}: order`).toBe(true);
  let sawShot = false;
  for (let n = 0; n < 1500; n += 1) {
    const before = bridge.getEntityHealth(target!.id)?.currentHp;
    bridge.step(100);
    sawShot ||= bridge.getInFlightProjectiles().some((p) => p.attackerId === attacker!.id);
    if (bridge.getRecentPlayerHits().some((h) => h.tick === bridge.world.tick
      && h.attackerId === attacker!.id && h.targetId === target!.id)) {
      const after = bridge.getEntityHealth(target!.id)?.currentHp ?? 0;
      return { damage: before! - after, attackDamage: attacker!.attackDamage, sawShot };
    }
  }
  throw new Error(`${entry.name}: no hit on the ${entry.building} within 1500 ticks`);
}

describe('every hit on a building, delivered for real, is DE\'s per-class damage', () => {
  for (const entry of BUILDING_ARMOR_CENSUS_CASES) {
    it(`${entry.name} (${entry.age}; building [${entry.buildingTechnologies.join(', ')}]; attacker [${[...entry.attackerTechnologies, entry.attackerCivilization ?? ''].filter(Boolean).join(', ')}])`, () => {
      const bridge = createSimulationBridge(buildingArmorCensusSeed(entry));
      const hit = firstHit(bridge, entry);
      const expected = oracleBuildingDamage(
        entry.attacker, hit.attackDamage, entry.building, entry.age, new Set(entry.buildingTechnologies), entry.age,
        { techs: entry.attackerTechnologies, ...(entry.attackerCivilization ? { civilization: entry.attackerCivilization } : {}) },
      );
      expect(hit.damage, `${entry.name}: first hit`).toBe(expected);
      expect(hit.sawShot, `${entry.name}: delivered by a shot exactly when the unit fires one`).toBe(firesProjectile(entry.attacker));
    });
  }

  it('lands a shot saved before work 140, which still carries buildingDamage, by the current rule', () => {
    // Before work 140 a shot at a building carried its anti-building total as
    // `buildingDamage`. A save made then loads, and the shot lands DE's hit:
    // the old field is read by nothing (spec §10.4).
    const entry = BUILDING_ARMOR_CENSUS_CASES.find((c) => c.name === 'de-archer-on-house')!;
    const seed = buildingArmorCensusSeed(entry);
    const live = createSimulationBridge(seed);
    const economy = live.getEconomyState();
    const archer = economy.units.find((u) => u.owner === 1 && u.unitType === 'archer')!;
    const anchor = buildingArmorCensusAnchor('house');
    const house = economy.buildings.find((b) => b.owner === 2 && b.buildingType === 'house' && b.x === anchor.x && b.y === anchor.y)!;
    expect(live.selectEntityById(archer.id)).toBe(true);
    expect(live.issueContextCommandAtEntity(house.id)).toBe(true);
    for (let n = 0; n < 300 && !live.getInFlightProjectiles().some((p) => p.attackerId === archer.id); n += 1) live.step(100);
    const saved = structuredClone(live.saveGame());
    const slot = stateSlot<ProjectileSlotState>(saved, projectilesCodec.slot);
    const shot = slot.inFlight.find((p) => p.attackerId === archer.id);
    expect(shot, 'a shot in the air at the save').toBeDefined();
    // The pre-work-140 shape, carrying a total no rule gives, so any reader of
    // the old field would show in the House's hit points.
    slot.inFlight = slot.inFlight.map((p) => (p.attackerId === archer.id ? { ...p, buildingDamage: 999 } : p));
    const loaded = createSimulationBridge(seed, { savedGame: saved });
    const before = loaded.getEntityHealth(house.id)!.currentHp;
    for (let n = 0; n < 300 && loaded.getInFlightProjectiles().some((p) => p.id === shot!.id); n += 1) loaded.step(100);
    expect(loaded.getInFlightProjectiles().some((p) => p.id === shot!.id), 'the saved shot landed').toBe(false);
    // DE: pierce 4 against the House's 7, so the minimum, 1.
    expect(before - loaded.getEntityHealth(house.id)!.currentHp).toBe(1);
  });

  it('lands the four DE values the brief named', () => {
    const named = new Map(BUILDING_ARMOR_CENSUS_CASES.map((entry) => [entry.name, entry]));
    const damage = (name: string) => firstHit(createSimulationBridge(buildingArmorCensusSeed(named.get(name)!)), named.get(name)!).damage;
    expect(damage('de-archer-on-house')).toBe(1);
    expect(damage('de-militia-on-town-center')).toBe(1);
    expect(damage('de-ram-on-town-center')).toBe(150);
    expect(damage('de-villager-on-palisade')).toBe(4);
  });
});
