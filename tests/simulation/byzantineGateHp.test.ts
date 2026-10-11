// Byzantine gates take no age-scaled hit-point bonus (work 119).
//
// civilizations.csv gives Byzantine buildings "(except gates)" +10/20/30/40%
// hit points in the Dark/Feudal/Castle/Imperial Age. Before work 119 the
// factor never read the building type, on the belief that gates were not a
// building type here; `stone-gate` and `palisade-gate` have been since
// v0.3.31, so a Byzantine Stone Gate stood at 3,575 hit points in the Castle
// Age, where a Britons one stands at 2,750 (2,750 x 1.3).
//
// Two paths read the factor, and both are walked here through the real game,
// in every age:
//  - creation (`addBuildingEntity`): every building type seeded in the Dark
//    Age, and a gate and a House a villager lays out through the real
//    placement commands in each of the four ages;
//  - the age-up sweep (`applyAgeScaledHpSweep`): the same seeded buildings
//    standing through the Feudal, Castle and Imperial advances, researched at
//    the Town Center.
// Each Byzantine gate is compared with the same gate under the Britons, who
// have no building hit-point bonus of any kind; every other Byzantine
// building must keep the ladder over its Britons twin.
//
// Bounds: a gate already in a save made before the fix keeps its raised hit
// points. Loading copies stored hit points as they are (hydrateFromSavedGame.ts;
// measured 2026-10-11, a gate stored at 3,575 loads at 3,575), the sweep now
// leaves gates alone, and nothing here loads such a save. This file proves
// nothing about technologies that raise building hit points (Masonry,
// Architecture, Fortified Wall): none is researched here. And the placement
// case reaches its age by writing it into a save blob, not by an advance; the
// sweep case is the one that advances.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  playerAgesCodec,
  playerResourcesCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import type { AgeType, BuildableBuildingType, BuildingType } from '../../src/game/simulation/types';
import {
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;
type Position = { x: number; y: number };

const AGES: readonly AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];
const BYZANTINE_LADDER: Readonly<Record<AgeType, number>> = {
  'dark-age': 1.1, 'feudal-age': 1.2, 'castle-age': 1.3, 'imperial-age': 1.4,
};
// Written out rather than read from gates.ts, so the check is not the code
// agreeing with itself.
const GATES: ReadonlySet<BuildingType> = new Set<BuildingType>(['stone-gate', 'palisade-gate']);
const ALL_BUILDING_TYPES = (Object.keys(AUTHORITATIVE_BUILDING_FOOTPRINTS) as BuildingType[]).sort();

/**
 * Owner 1 in `scenarioSeed`, playing `civilization` (owner 2 too), in `age`
 * when given, with a purse no price here can empty. This is the
 * content-pipeline rig (`standSeat` in contentPipeline.helpers.ts): the setup
 * is written into a save blob and loaded. It differs in one way: the render
 * projection runs only on reads, because nothing here draws, and projecting
 * every tick doubled the sweep case (9.8 s against 4.7 s, measured
 * 2026-10-11). The projection never writes world state
 * (renderProjectionOnRead.test.ts), so the hit points are the same either way.
 */
function seat(scenarioSeed: string, civilization: string, age?: AgeType): Bridge {
  const options = {
    victory: 'conquest-only' as const,
    renderProjection: 'on-read' as const,
    civilizationsByOwner: new Map([[1, civilization], [2, civilization]]),
  };
  const boot = createSimulationBridge(scenarioSeed, options);
  const blob = JSON.parse(JSON.stringify(boot.saveGame())) as ReturnType<Bridge['saveGame']>;
  const state = (blob.worldSnapshot as { state: Record<string, unknown> }).state;
  state[playerResourcesCodec.slot] = [
    [1, { food: 400_000, wood: 400_000, gold: 400_000, stone: 400_000 }],
    [2, { food: 0, wood: 0, gold: 0, stone: 0 }],
  ];
  if (age) state[playerAgesCodec.slot] = [[1, age], [2, age]];
  return createSimulationBridge(scenarioSeed, { ...options, savedGame: blob });
}

/** Owner 1's buildings, by type, as maximum hit points (one of each type). */
function maxHpByType(bridge: Bridge): Map<BuildingType, number> {
  const byType = new Map<BuildingType, number>();
  for (const building of bridge.getEconomyState().buildings) {
    if (building.owner !== 1) continue;
    const health = bridge.getEntityHealth(building.id);
    if (!health) throw new Error(`owner 1's ${building.buildingType} (#${building.id}) has no health state`);
    const type = building.buildingType as BuildingType;
    if (byType.has(type)) throw new Error(`owner 1 holds two of ${type}; the comparison needs one`);
    byType.set(type, health.maxHp);
  }
  return byType;
}

/** Each way the Byzantine buildings break the rule, as a readable line. */
function ruleBreaches(
  byzantine: Map<BuildingType, number>,
  britons: Map<BuildingType, number>,
  age: AgeType,
): string[] {
  const breaches: string[] = [];
  for (const [type, britonsHp] of britons) {
    const byzantineHp = byzantine.get(type);
    if (GATES.has(type)) {
      if (byzantineHp !== britonsHp) {
        breaches.push(`${type} in the ${age}: Byzantine ${byzantineHp}, Britons ${britonsHp}; a gate takes no ladder`);
      }
      continue;
    }
    const expected = britonsHp * BYZANTINE_LADDER[age];
    // One hit point of slack: the sweep rounds the stored value at each step.
    if (byzantineHp === undefined || Math.abs(byzantineHp - expected) > 1) {
      breaches.push(`${type} in the ${age}: Byzantine ${byzantineHp}, expected ${Math.round(expected)} (Britons ${britonsHp} x ${BYZANTINE_LADDER[age]})`);
    }
  }
  return breaches;
}

function advanceTo(bridge: Bridge, age: Exclude<AgeType, 'dark-age'>): void {
  expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
  expect(bridge.queueResearch(age), `the Town Center refused the ${age}`).toBe(true);
  // Polled every ten ticks: the age, once reached, stays.
  expect(
    stepBridgeUntil(bridge, () => bridge.getEconomyState().ages[1] === age, { maxSteps: 400, stepMs: 1_000 }),
    `the ${age} never arrived`,
  ).toBe(true);
}

/**
 * Owner 1's villager lays out a foundation of this type at the first open
 * anchor, through the real placement commands. Returns the foundation's
 * maximum hit points, which are fixed at creation, or null when the build
 * menu does not offer the type in this age.
 */
function placeAndReadMaxHp(
  bridge: Bridge,
  buildingType: BuildableBuildingType,
  anchors: readonly Position[],
): number | null {
  expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
  if (!bridge.beginBuildingPlacement(buildingType)) return null;
  const anchor = anchors.find((candidate) => bridge.getPlacementPreview(candidate.x, candidate.y)?.isValid);
  if (!anchor) throw new Error(`no open anchor for a ${buildingType} among ${JSON.stringify(anchors)}`);
  expect(bridge.confirmBuildingPlacement(anchor.x, anchor.y)).toBe(true);
  bridge.step(100); // The confirm lands in the next step's command phase.
  const foundation = bridge.getEconomyState().buildings.find((building) => (
    building.owner === 1
    && building.buildingType === buildingType
    && building.x === anchor.x
    && building.y === anchor.y
  ));
  if (!foundation) throw new Error(`the ${buildingType} foundation at (${anchor.x}, ${anchor.y}) never appeared`);
  return bridge.getEntityHealth(foundation.id)?.maxHp ?? null;
}

// Open grass beside the build fixture's villager at (30, 16), inside its sight.
const PLACEMENTS: ReadonlyArray<{ type: BuildableBuildingType; anchors: readonly Position[] }> = [
  { type: 'palisade-gate', anchors: [{ x: 32, y: 14 }, { x: 32, y: 13 }, { x: 31, y: 13 }] },
  { type: 'stone-gate', anchors: [{ x: 33, y: 15 }, { x: 33, y: 16 }, { x: 33, y: 17 }] },
  { type: 'house', anchors: [{ x: 31, y: 18 }, { x: 28, y: 18 }, { x: 27, y: 13 }] },
];

function placedMaxHp(civilization: string, age: AgeType): Map<BuildingType, number> {
  const bridge = seat('building-vision-build-fixture', civilization, age);
  const byType = new Map<BuildingType, number>();
  for (const { type, anchors } of PLACEMENTS) {
    const maxHp = placeAndReadMaxHp(bridge, type, anchors);
    if (maxHp !== null) byType.set(type, maxHp);
  }
  return byType;
}

describe('Byzantine gates take no age-scaled hit-point bonus', () => {
  it('every seeded building type keeps the ladder through all four ages, except the two gates', () => {
    const byzantine = seat('building-vision-fixture', 'Byzantines');
    const britons = seat('building-vision-fixture', 'Britons');
    for (const age of AGES) {
      if (age !== 'dark-age') {
        advanceTo(byzantine, age);
        advanceTo(britons, age);
      }
      const byzantineHp = maxHpByType(byzantine);
      const britonsHp = maxHpByType(britons);
      // The fixture holds one of every building type, so this is the census.
      expect([...britonsHp.keys()].sort()).toEqual(ALL_BUILDING_TYPES);
      expect([...byzantineHp.keys()].sort()).toEqual(ALL_BUILDING_TYPES);
      expect(ruleBreaches(byzantineHp, britonsHp, age)).toEqual([]);
    }
  }, 120_000);

  it.each(AGES)('a gate laid out in the %s stands at a Britons gate\'s hit points, and a House keeps the ladder', (age) => {
    const byzantine = placedMaxHp('Byzantines', age);
    const britons = placedMaxHp('Britons', age);
    // Not vacuous: the Palisade Gate and the House are offered in every age,
    // the Stone Gate from the Castle Age (bridge/buildOptions.ts).
    const offered: BuildingType[] = ['house', 'palisade-gate'];
    if (age === 'castle-age' || age === 'imperial-age') offered.push('stone-gate');
    offered.sort();
    expect([...britons.keys()].sort()).toEqual(offered);
    expect([...byzantine.keys()].sort()).toEqual(offered);
    expect(ruleBreaches(byzantine, britons, age)).toEqual([]);
  }, 60_000);
});
