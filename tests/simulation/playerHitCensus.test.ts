// Every hit point a player's unit or building loses is recorded as a blow, on
// the tick it is lost, whatever dealt it (v0.3.235, defect register 2026-09-24).
//
// THE DEFECT: the attack warning read the swing feed, which records only a
// UNIT's swing, so a Town Centre, tower or Castle shooting a villager raised no
// warning, and neither did a mangonel stone splashing the villagers beside its
// target or a bombardment of the ground. Reproduced on the real map: an enemy
// Town Centre took a villager from 25 to 10 hit points at tick 678 and the
// minimap's mark covered 0 screen pixels.
//
// THE CLASS this gates is every way a blow can land. So the census does not
// list the ways and trust the list. It reads the ground truth instead: every
// player-owned unit's and building's hit points, every tick. Each loss, and
// each death, must arrive in the hit feed (`getRecentPlayerHits`) on the tick
// it happened, for that target, naming the attacker's owner whenever a player
// dealt it. And each recorded blow on a target that is still standing must
// match a loss, so the census is compared both ways. A new damage path that
// forgets the feed fails here by name, if one of the scenarios below reaches
// it. A floor per scenario checks that the census saw the attacker kind that
// scenario is for, so a scenario that stops fighting fails instead of passing.
//
// BOUNDS, so a green run is not read for more than it holds:
//  - A death counts only when the entity is gone from the world, not when it
//    merely left the map (garrisoned). A demolition charge that struck on the
//    tick it vanished was spent, not killed, and is not counted. A charge spent
//    on an animal with no player's unit in its blast strikes nothing the feed
//    records (v0.3.238: it goes off at an animal too), so it would read as an
//    unrecorded death; no scenario below orders one. A player's
//    delete, a depleted farm, a razed building's garrison (never tracked: a
//    garrisoned unit has no position) and a Monk's heresy remove entities
//    without a blow; no scenario below does any of them.
//  - A loss is read as the net change over a tick, so a foundation hit on the
//    tick its builders add hit points can hide a blow. No scenario below hits
//    a foundation.
//  - Only the scenarios below, for their horizons. A damage path none of them
//    reaches is not covered. The floors say which kinds each one reached.
//  - The feed's contract only. That the warning reads the feed and shows the
//    horn, the words and the mark is `tests/browser/attack-warning-buildings.spec.ts`
//    and the other attack-warning specs.
import type { EntityRef } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { BLAST_CENSUS_UNIT_TARGET, blastCensusSeed } from '../../src/game/simulation/fixtures/blastCensusLayout';
import { detonatesOnAttack } from '../../src/game/simulation/prototypeUnitRules';
import type { UnitType } from '../../src/game/simulation/types';

type Bridge = ReturnType<typeof createSimulationBridge>;

interface Owned {
  owner: number;
  hp: number;
  /** `villager`, `watch-tower`, `house` and so on. */
  type: string;
  building: boolean;
  /** The engine's ref, taken before the step: a new entity can reuse an id,
   *  and only the ref's generation tells them apart. */
  ref: EntityRef | null;
}

interface CensusResult {
  ticks: number;
  losses: number;
  deaths: number;
  /** A loss, or a death, with no blow recorded for it. */
  unrecorded: string[];
  /** A blow recorded on a standing target that lost nothing. */
  phantom: string[];
  /** A blow naming the wrong owner on either end, calling a target economy
   *  that is not a villager or a building (or the reverse), or carrying no
   *  owners at all when a player's unit or building dealt it. */
  misattributed: string[];
  /** Recorded blows by the attacker's type (`wildlife` when it owns nothing). */
  byAttacker: Map<string, number>;
  /** Recorded blows on a building, by the attacker's type. */
  onBuildingsBy: Map<string, number>;
  /** The most distinct targets one attacker hit on one tick: a blast's reach. */
  widestBlow: number;
}

function readOwned(bridge: Bridge): Map<number, Owned> {
  const economy = bridge.getEconomyState();
  const unitHp = new Map((bridge.world.getState('aoe2.combatStates') ?? []) as Array<[number, { currentHp: number }]>);
  const buildingHp = new Map(
    (bridge.world.getState('aoe2.buildingHealthStates') ?? []) as Array<[number, { currentHp: number }]>,
  );
  const owned = new Map<number, Owned>();
  for (const unit of economy.units) {
    const health = unitHp.get(unit.id);
    if (health) {
      owned.set(unit.id, {
        owner: unit.owner, hp: health.currentHp, type: unit.unitType, building: false, ref: bridge.world.getEntityRef(unit.id),
      });
    }
  }
  for (const building of economy.buildings) {
    const health = buildingHp.get(building.id);
    if (health) {
      owned.set(building.id, {
        owner: building.owner, hp: health.currentHp, type: building.buildingType, building: true, ref: bridge.world.getEntityRef(building.id),
      });
    }
  }
  return owned;
}

/** Steps `ticks` ticks, running `beforeTick` first on each, and compares every
 *  loss of hit points, and every death, with the blows recorded on that tick. */
function census(bridge: Bridge, ticks: number, beforeTick?: (tick: number) => void): CensusResult {
  const result: CensusResult = {
    ticks, losses: 0, deaths: 0, unrecorded: [], phantom: [], misattributed: [],
    byAttacker: new Map(), onBuildingsBy: new Map(), widestBlow: 0,
  };
  let before = readOwned(bridge);
  // Every player-owned entity seen so far, by id: a shot can land after its
  // shooter died, and its owner still has to be checked.
  const known = new Map(before);
  for (let step = 0; step < ticks; step += 1) {
    beforeTick?.(bridge.world.tick);
    bridge.step(100);
    const tick = bridge.world.tick;
    const after = readOwned(bridge);
    for (const [id, entity] of after) known.set(id, entity);
    const blows = bridge.getRecentPlayerHits().filter((blow) => blow.tick === tick);
    const struck = new Set(blows.map((blow) => blow.targetId));
    const striking = new Set(blows.map((blow) => blow.attackerId));
    for (const [id, was] of before) {
      const gone = was.ref === null || !bridge.world.isCurrent(was.ref);
      if (gone) {
        if (!was.building && detonatesOnAttack(was.type as UnitType) && striking.has(id)) continue; // spent by its own charge
        result.deaths += 1;
        if (!struck.has(id)) result.unrecorded.push(`tick ${tick}: owner ${was.owner}'s ${was.type} #${id} died and no blow was recorded`);
        continue;
      }
      const now = after.get(id);
      if (!now || now.hp >= was.hp) continue;
      result.losses += 1;
      if (!struck.has(id)) {
        result.unrecorded.push(`tick ${tick}: owner ${was.owner}'s ${was.type} #${id} lost ${was.hp - now.hp} hit points and no blow was recorded`);
      }
    }
    const targetsByAttacker = new Map<number, Set<number>>();
    for (const blow of blows) {
      const target = before.get(blow.targetId);
      const standing = after.get(blow.targetId);
      if (target && standing && target.ref !== null && bridge.world.isCurrent(target.ref) && standing.hp >= target.hp) {
        result.phantom.push(`tick ${tick}: a blow was recorded on owner ${target.owner}'s ${target.type} #${blow.targetId}, which lost nothing`);
      }
      const attacker = before.get(blow.attackerId) ?? after.get(blow.attackerId) ?? known.get(blow.attackerId);
      const kind = attacker?.type ?? (blow.participants === undefined ? 'wildlife' : `gone #${blow.attackerId}`);
      result.byAttacker.set(kind, (result.byAttacker.get(kind) ?? 0) + 1);
      if (target?.building) result.onBuildingsBy.set(kind, (result.onBuildingsBy.get(kind) ?? 0) + 1);
      if (attacker && blow.participants === undefined) {
        result.misattributed.push(`tick ${tick}: owner ${attacker.owner}'s ${attacker.type} hit ${target?.type} and the blow carries no owners`);
      }
      if (blow.participants !== undefined && target) {
        const wrongAttacker = attacker !== undefined && blow.participants.attackerOwner !== attacker.owner;
        const economy = target.building || target.type === 'villager';
        if (wrongAttacker || blow.participants.targetOwner !== target.owner || blow.participants.targetIsEconomy !== economy) {
          result.misattributed.push(`tick ${tick}: ${JSON.stringify(blow.participants)} for ${attacker?.type} of owner `
            + `${attacker?.owner} hitting ${target.type} of owner ${target.owner}`);
        }
      }
      const targets = targetsByAttacker.get(blow.attackerId) ?? new Set<number>();
      targets.add(blow.targetId);
      targetsByAttacker.set(blow.attackerId, targets);
      result.widestBlow = Math.max(result.widestBlow, targets.size);
    }
    before = after;
  }
  return result;
}

function expectClean(result: CensusResult): void {
  expect(result.losses + result.deaths, 'nothing lost a hit point or died, so the census tested nothing').toBeGreaterThan(0);
  expect(
    result.unrecorded.slice(0, 8),
    `${result.unrecorded.length} of ${result.losses + result.deaths} losses and deaths with no blow recorded (${result.losses} losses, ${result.deaths} deaths)`,
  ).toEqual([]);
  expect(result.phantom.slice(0, 8), `${result.phantom.length} blows recorded on targets that lost nothing`).toEqual([]);
  expect(result.misattributed.slice(0, 8), 'blows naming the wrong owners or the wrong kind of target, or none').toEqual([]);
}

interface Scenario {
  /** What deals the blows. */
  name: string;
  seed: string;
  ticks: number;
  /** The order that starts the fight, where the fixture does not fight alone. */
  order?: (bridge: Bridge) => void;
  /** The attacker type this scenario exists for; it must land a blow. */
  attacker: string;
  /** At least this many distinct targets hit by one attacker on one tick. */
  widestBlow?: number;
  /** The scenario is for blows on a building: the attacker must land one. */
  onBuilding?: true;
}

function ownUnit(bridge: Bridge, owner: number, unitType: string) {
  const unit = bridge.getEconomyState().units.find((candidate) => candidate.owner === owner && candidate.unitType === unitType);
  if (!unit) throw new Error(`the fixture has no ${unitType} of owner ${owner}`);
  return unit;
}

function orderAttack(bridge: Bridge, attacker: { id: number }, targetId: number): void {
  expect(bridge.selectUnitsByIds([attacker.id]), 'the attacker could not be selected').toBe(true);
  expect(bridge.issueContextCommandAtEntity(targetId), 'the attack order was refused').toBe(true);
}

// One scenario per way a blow can land that the real match above does not
// reach by itself. Each fixture is an existing one, and each order is the one
// its own test gives. A Bombard Tower has no fixture that fights; its shots
// are launched by the same loop as a Watch Tower's (`towerCombatSystem.ts`).
const SCENARIOS: Scenario[] = [
  { name: "a Watch Tower's arrows", seed: 'tower-upgrade-baseline-fixture', ticks: 300, attacker: 'watch-tower' },
  { name: "a Town Centre's arrows", seed: 'town-center-defense-fixture', ticks: 300, attacker: 'town-center' },
  { name: "a Castle's arrows", seed: 'castle-defensive-fire-fixture', ticks: 300, attacker: 'castle' },
  {
    name: "a mangonel stone's blast, friend and foe",
    seed: 'mangonel-vs-clustered-infantry-fixture',
    ticks: 120,
    attacker: 'mangonel',
    widestBlow: 2,
    order: (bridge) => {
      const primary = bridge.getEconomyState().units.find((u) => u.owner === 2 && u.unitType === 'spearman' && u.x === 18 && u.y === 8);
      if (!primary) throw new Error('the fixture has no spearman at (18, 8)');
      orderAttack(bridge, ownUnit(bridge, 1, 'mangonel'), primary.id);
    },
  },
  {
    name: 'a bombardment of the ground',
    seed: 'mangonel-vs-clustered-infantry-fixture',
    ticks: 600,
    attacker: 'mangonel',
    widestBlow: 2,
    order: (bridge) => {
      const cluster = bridge.getEconomyState().units.find((u) => u.owner === 2 && u.unitType === 'spearman');
      if (!cluster) throw new Error('the fixture has no spearman to bombard');
      expect(bridge.selectUnitsByIds([ownUnit(bridge, 1, 'mangonel').id])).toBe(true);
      expect(bridge.issueAttackGroundCommand(cluster.x, cluster.y), 'the attack-ground order was refused').toBe(true);
    },
  },
  {
    name: 'a mangonel stone on a building, and its blast',
    seed: 'mangonel-vs-building-splash-fixture',
    ticks: 300,
    attacker: 'mangonel',
    onBuilding: true,
    order: (bridge) => {
      const outpost = bridge.getEconomyState().buildings.find((b) => b.owner === 2 && b.buildingType === 'outpost');
      if (!outpost) throw new Error('the fixture has no outpost of owner 2');
      orderAttack(bridge, ownUnit(bridge, 1, 'mangonel'), outpost.id);
    },
  },
  // The Siege Onager's stone blasts where it lands (defect register
  // 2026-09-24, "The Siege Onager fired direct hits with no splash"). On the
  // blast census's fixture its target and the Villager diagonal to it, 1.41
  // cells out and inside the 1.5 radius, both take the blow on the tick it
  // lands. That the Villager just outside the radius is spared is the blast
  // census's check (`blastCensus.test.ts`), not this one's.
  {
    name: "a Siege Onager stone's blast, reaching the diagonal",
    seed: blastCensusSeed('siege-onager'),
    ticks: 120,
    attacker: 'siege-onager',
    widestBlow: 2,
    order: (bridge) => {
      const target = bridge.getEconomyState().units.find(
        (u) => u.owner === 2 && u.x === BLAST_CENSUS_UNIT_TARGET.x && u.y === BLAST_CENSUS_UNIT_TARGET.y,
      );
      if (!target) throw new Error('the blast census fixture has no unit target');
      orderAttack(bridge, ownUnit(bridge, 1, 'siege-onager'), target.id);
    },
  },
  {
    name: "a demolition ship's blast",
    seed: 'demolition-ship-fixture',
    ticks: 900,
    attacker: 'demolition-ship',
    widestBlow: 2,
    order: (bridge) => {
      const galley = bridge.getEconomyState().units.find((u) => u.owner === 2 && u.unitType !== 'villager');
      if (!galley) throw new Error('the fixture has no ship of owner 2');
      orderAttack(bridge, ownUnit(bridge, 1, 'demolition-ship'), galley.id);
    },
  },
  {
    name: 'a melee swing at a unit',
    seed: 'militia-combat-fixture',
    ticks: 480,
    attacker: 'militia',
    order: (bridge) => orderAttack(bridge, ownUnit(bridge, 1, 'militia'), ownUnit(bridge, 2, 'scout').id),
  },
  { name: 'a melee swing at a building', seed: 'castle-ai-target-priority-fixture', ticks: 600, attacker: 'militia', onBuilding: true },
  { name: "an archer's arrows", seed: 'auto-aggro-archer-pursuit-fixture', ticks: 360, attacker: 'archer' },
  { name: "a wolf's bite", seed: 'wolf-aggro-fixture', ticks: 120, attacker: 'wildlife' },
];

describe('every hit point a player loses is recorded as a blow', () => {
  it('in an all-AI match on the real map, through its first raids', () => {
    const bridge = createSimulationBridge('aoe2-prototype', { forceAiForOwners: new Set([1]) });
    const result = census(bridge, 6_000);
    expectClean(result);
    // The floor: the match's own raids and its Town Centres' arrows happened,
    // or this case proved less than it claims.
    expect(result.byAttacker.get('town-center') ?? 0, `blows by attacker: ${JSON.stringify([...result.byAttacker])}`).toBeGreaterThan(0);
  }, 300_000);

  for (const scenario of SCENARIOS) {
    it(`from ${scenario.name} (${scenario.seed})`, () => {
      const bridge = createSimulationBridge(scenario.seed);
      scenario.order?.(bridge);
      const result = census(bridge, scenario.ticks);
      expectClean(result);
      const seen = `blows by attacker: ${JSON.stringify([...result.byAttacker])}`;
      expect(result.byAttacker.get(scenario.attacker) ?? 0, `no blow by a ${scenario.attacker}; ${seen}`).toBeGreaterThan(0);
      if (scenario.widestBlow !== undefined) {
        expect(result.widestBlow, `no one blow reached ${scenario.widestBlow} targets; ${seen}`).toBeGreaterThanOrEqual(scenario.widestBlow);
      }
      if (scenario.onBuilding) {
        expect(result.onBuildingsBy.get(scenario.attacker) ?? 0, `no blow by a ${scenario.attacker} landed on a building; `
          + `blows on buildings: ${JSON.stringify([...result.onBuildingsBy])}`).toBeGreaterThan(0);
      }
    }, 120_000);
  }
});
