// Census: every technology, researched while one twin of every unit type that
// can go inside sits in a Castle or aboard a Transport Ship and the other twin
// stands outside. When they come out, each twin that was inside must see what
// its twin outside sees (defect register, 2026-10-11).
//
// WHY EVERY TECHNOLOGY. Garrisoning takes a unit's `visionSource` off it and
// keeps a copy until the unit comes out, so any effect that changes the sight
// of units in the field has to change that copy too. Today one writer does
// that: the line-upgrade sweep (technologyUnitSweeps.ts), driven by the rows of
// UNIT_LINE_UPGRADES. Tracking, the only research that ever bumped unit sight
// on its own, was retired with DE in v0.3.140, and Town Watch, Town Patrol and
// the Outpost's per-age sight touch buildings only. Applying every row of
// RESEARCH_COSTS rather than the upgrade table keeps the gate on the class: a
// technology added later that changes the sight of units in the field and
// misses the ones inside fails here by name. The one other in-place write to a
// unit's sight, a Monk's conversion (its `playerId`), cannot reach a unit
// inside: the Monk drops a task whose target has no position
// (monkBehaviorSystem), and an occupied building holds out.
//
// WHAT IS REAL. A civ-engine World with the game's components, the
// BridgeStateAccessor and its codecs, `applyTechnology` from
// createTechnologyOps (the research-completion seam the production queue
// calls), and createGarrisonOps (the enter and exit paths a right click, the
// Ungarrison button and an unload order reach). What is stubbed is where a
// unit lands when it comes out, which is placement and has no bearing on sight.
// The purchase path is contentPipelineResearch.test.ts's, and the player's own
// controls on the real bridge are garrisonedSightUpgrades.test.ts.
//
// THE TWINS START AT SIGHT 1, which no unit's table value is, so every
// line-upgrade row moves the twin outside and is a witness, including rows
// whose two tiers share a value (Militia and Man-at-Arms are both 4). A fixture
// unit or a real map's starting Scout (6, against the Scout's table 4) is the
// same case in play.
//
// BOUND. Owner 1 only, a Mongol seat on one team with Franks and Koreans, so
// the sight bonuses an upgrade re-derives (scout line +2, knight line +2) are
// live. Each technology runs alone on a fresh world, so a chain (Man-at-Arms,
// then Long Swordsman) is two rows, not one walk. Ships cannot go inside
// either host and are outside the class. It compares the `visionSource`
// component, not the fog it reveals, and says nothing about saves made before
// the fix, whose kept copies are already stale.

import { World, type Position } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { createBridgeState } from '../../src/game/simulation/bridge/bridgeState';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import {
  combatStatesCodec,
  garrisonedUnitToBuildingCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  playerTeamsCodec,
  researchedTechnologiesCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createCombatStateFactory } from '../../src/game/simulation/bridge/combatStateFactory';
import { createGarrisonOps } from '../../src/game/simulation/bridge/garrisonOps';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';
import { registerComponentTypes } from '../../src/game/simulation/bridge/scenarioSeedOps';
import { createTechnologyOps } from '../../src/game/simulation/bridge/technologyOps';
import { UNIT_LINE_UPGRADES } from '../../src/game/simulation/bridge/unitLineUpgrades';
import { buildingGarrisonCapacity, canGarrisonAt } from '../../src/game/simulation/prototypeBuildingRules';
import { UNIT_VISION_RADIUS } from '../../src/game/simulation/prototypeUnitRules/presentationTables';
import { RESEARCH_COSTS } from '../../src/game/simulation/researchTables';
import { canBoardTransport, TRANSPORT_CAPACITY } from '../../src/game/simulation/transportShip';
import { isWaterUnit } from '../../src/game/simulation/unitDomain';
import type {
  AgeType,
  ResearchableTechnologyType,
  UnitType,
  VisionSourceComponent,
} from '../../src/game/simulation/types';

const OWNER = 1;
const START_SIGHT = 1;
const TECHNOLOGIES = Object.keys(RESEARCH_COSTS) as ResearchableTechnologyType[];
const UNIT_TYPES = Object.keys(UNIT_VISION_RADIUS) as UnitType[];
const CASTLE_TYPES = UNIT_TYPES.filter((unitType) => canGarrisonAt('castle', unitType));
const CARGO_TYPES = UNIT_TYPES.filter((unitType) => canBoardTransport(unitType));
const MAP_SIDE = 128;

interface Twin {
  unitType: UnitType;
  host: 'castle' | 'transport';
  insideId: number;
  outsideId: number;
}

interface CensusRun {
  world: GameWorld;
  twins: Twin[];
  /** Twins whose outside half saw its sight change: the run's witnesses. */
  moved: Twin[];
}

function sightOf(world: GameWorld, id: number): VisionSourceComponent | undefined {
  const source = world.getComponent<VisionSourceComponent>(id, 'visionSource');
  return source === undefined ? undefined : { ...source };
}

function newCensusWorld(technology: ResearchableTechnologyType): {
  world: GameWorld;
  accessor: BridgeStateAccessor;
} {
  const world: GameWorld = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: MAP_SIDE,
    gridHeight: MAP_SIDE,
    tps: 10,
    seed: `garrisoned-sight-${technology}`,
  });
  registerComponentTypes(world);
  const accessor = new BridgeStateAccessor(() => world);
  accessor.mutate(playerCivilizationsCodec, (m) => {
    m.set(1, 'Mongols');
    m.set(2, 'Franks');
    m.set(3, 'Koreans');
  });
  accessor.mutate(playerTeamsCodec, (m) => {
    m.set(1, 1);
    m.set(2, 1);
    m.set(3, 1);
  });
  accessor.mutate(researchedTechnologiesCodec, (m) => m.set(OWNER, new Set()));
  accessor.mutate(playerAgesCodec, (m) => m.set(OWNER, 'imperial-age'));
  return { world, accessor };
}

// One technology on a fresh world: stand the twins, put one of each inside,
// research, let everyone out, and hand back the world for the comparison.
function runCensus(technology: ResearchableTechnologyType): CensusRun {
  const { world, accessor } = newCensusWorld(technology);
  const createCombatState = createCombatStateFactory({
    hasTechnology: (owner, tech) => accessor.get(researchedTechnologiesCodec).get(owner)?.has(tech) ?? false,
    getCivilization: (owner) => accessor.get(playerCivilizationsCodec).get(owner) ?? 'Britons',
    getAge: (owner) => (accessor.get(playerAgesCodec).get(owner) ?? 'dark-age') as AgeType,
  });

  let nextCell = 0;
  const freshCell = (): Position => {
    const cell = { x: nextCell % MAP_SIDE, y: Math.floor(nextCell / MAP_SIDE) };
    nextCell += 1;
    return cell;
  };
  const addUnit = (unitType: UnitType): number => {
    const id = world.createEntity();
    world.setPosition(id, freshCell());
    world.addComponent(id, 'unit', { owner: OWNER, unitType });
    world.addComponent(id, 'visionSource', { playerId: OWNER, radius: START_SIGHT });
    accessor.mutate(combatStatesCodec, (m) => m.set(id, createCombatState(OWNER, unitType)));
    return id;
  };
  const addCastle = (): number => {
    const id = world.createEntity();
    world.setPosition(id, freshCell());
    world.addComponent(id, 'building', { owner: OWNER, buildingType: 'castle' });
    return id;
  };

  const garrison = createGarrisonOps({
    world,
    accessor,
    isGarrisonedUnit: (unitId) => accessor.get(garrisonedUnitToBuildingCodec).has(unitId),
    clearGathererOrder: () => {},
    clearUnitCommand: () => {},
    clearPositionAndSyncOccupancy: (unitId) => world.removeComponent(unitId, 'position'),
    placeFreshSpawnUnit: (unitId) => {
      const landed = freshCell();
      world.setPosition(unitId, landed);
      return landed;
    },
    findScenarioSpawnPosition: (origin) => origin,
    findBuildingSpawnPosition: (anchor) => anchor,
    removeSelectedEntity: () => {},
    placementMode: { current: null },
    markOutOfBandRenderChange: () => {},
  });
  const { applyTechnology } = createTechnologyOps({
    world,
    state: createBridgeState(),
    accessor,
    createCombatState,
    markOutOfBandRenderChange: () => {},
  });

  const twins: Twin[] = [];
  const castles: number[] = [];
  for (const unitType of CASTLE_TYPES) {
    if (twins.filter((t) => t.host === 'castle').length % buildingGarrisonCapacity('castle') === 0) {
      castles.push(addCastle());
    }
    const twin: Twin = { unitType, host: 'castle', insideId: addUnit(unitType), outsideId: addUnit(unitType) };
    expect(garrison.garrisonUnit(twin.insideId, castles[castles.length - 1]!), `${unitType} into a Castle`).toBe(true);
    twins.push(twin);
  }
  const transports: Array<{ id: number; position: Position }> = [];
  for (const unitType of CARGO_TYPES) {
    if (twins.filter((t) => t.host === 'transport').length % TRANSPORT_CAPACITY === 0) {
      const id = addUnit('transport-ship');
      transports.push({ id, position: { ...world.getComponent<Position>(id, 'position')! } });
    }
    const twin: Twin = { unitType, host: 'transport', insideId: addUnit(unitType), outsideId: addUnit(unitType) };
    expect(garrison.boardTransport(twin.insideId, transports[transports.length - 1]!.id), `${unitType} aboard a Transport Ship`).toBe(true);
    twins.push(twin);
  }
  for (const twin of twins) {
    expect(sightOf(world, twin.insideId), `${twin.unitType} kept no sight on the field once ${twin.host === 'castle' ? 'garrisoned' : 'aboard'}`).toBeUndefined();
  }

  applyTechnology(OWNER, technology);

  for (const castle of castles) expect(garrison.ungarrisonBuilding(castle)).toBe(true);
  for (const transport of transports) expect(garrison.unloadTransport(transport.id, transport.position)).toBe(true);

  const moved = twins.filter((twin) => sightOf(world, twin.outsideId)?.radius !== START_SIGHT);
  return { world, twins, moved };
}

describe('every technology reaches a unit inside a building or aboard a transport', () => {
  it('the population is the class: every unit type but a ship goes inside one host or both', () => {
    const leftOut = UNIT_TYPES.filter(
      (unitType) => !CASTLE_TYPES.includes(unitType) && !CARGO_TYPES.includes(unitType) && !isWaterUnit(unitType),
    );
    expect(leftOut, `unit types the census never puts inside: ${leftOut.join(', ')}`).toEqual([]);
    // A Castle takes every land unit but siege and the Trade Cart, so those
    // reach the census only aboard a transport.
    for (const unitType of ['mangonel', 'battering-ram', 'scorpion', 'trebuchet', 'trade-cart'] as const) {
      expect(CASTLE_TYPES, unitType).not.toContain(unitType);
      expect(CARGO_TYPES, unitType).toContain(unitType);
    }
  });

  it('after each technology, every twin that was inside sees what its twin outside sees', () => {
    const mismatches: string[] = [];
    const witnesses = new Map<ResearchableTechnologyType, number>();
    for (const technology of TECHNOLOGIES) {
      const { world, twins, moved } = runCensus(technology);
      if (moved.length > 0) witnesses.set(technology, moved.length);
      for (const twin of twins) {
        const inside = sightOf(world, twin.insideId);
        const outside = sightOf(world, twin.outsideId);
        const insideType = world.getComponent<{ unitType: UnitType }>(twin.insideId, 'unit')?.unitType;
        const outsideType = world.getComponent<{ unitType: UnitType }>(twin.outsideId, 'unit')?.unitType;
        if (JSON.stringify(inside) !== JSON.stringify(outside) || insideType !== outsideType) {
          mismatches.push(
            `${technology}: a ${twin.unitType} ${twin.host === 'castle' ? 'in a Castle' : 'aboard a Transport Ship'} came out a ${insideType} seeing ${JSON.stringify(inside)}, its twin outside is a ${outsideType} seeing ${JSON.stringify(outside)}`,
          );
        }
      }
    }
    expect(mismatches, mismatches.join('\n')).toEqual([]);

    // The witnesses: without them a census in which no technology moved any
    // sight (a research that silently did nothing) would pass over the defect.
    for (const technology of [
      'crossbowman-upgrade', 'man-at-arms-upgrade', 'light-cavalry-upgrade',
      'hussar-upgrade', 'cavalier-upgrade', 'onager-upgrade', 'elite-huskarl-upgrade',
    ] as const) {
      expect(witnesses.get(technology) ?? 0, `${technology} moved no unit's sight`).toBeGreaterThan(0);
    }
    // The header's account of the class, held to the run in both directions:
    // the technologies that moved a unit's sight are exactly the upgrade rows
    // with a land unit to upgrade. One outside the table is a new member of the
    // class (if its twins matched above, it reaches units inside correctly, and
    // the header needs it); a land row missing means it moved nobody's sight.
    const landRows = (Object.keys(UNIT_LINE_UPGRADES) as ResearchableTechnologyType[])
      .filter((technology) => UNIT_LINE_UPGRADES[technology]!.from.some((unitType) => !isWaterUnit(unitType)))
      .sort();
    const movedSight = [...witnesses.keys()].sort();
    const outsideTheTable = movedSight.filter((technology) => !landRows.includes(technology));
    const silentRows = landRows.filter((technology) => !movedSight.includes(technology));
    expect(
      { outsideTheTable, silentRows },
      `technologies other than line upgrades that now change unit sight: ${outsideTheTable.join(', ') || 'none'}; `
      + `land upgrade rows that changed nobody's sight: ${silentRows.join(', ') || 'none'}`,
    ).toEqual({ outsideTheTable: [], silentRows: [] });
  }, 120_000);
});
