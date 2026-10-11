// A unit inside a building while its line is upgraded leaves with the sight an
// identical unit outside got (defect register, 2026-10-11).
//
// Garrisoning takes the unit's `visionSource` off it and keeps a copy in a side
// map until the unit leaves. The line-upgrade sweep changed only units that
// still carried the component, so an Archer sheltering in the Town Center while
// its owner researched the Crossbowman upgrade came out a Crossbowman with an
// Archer's sight of 6, against its twin's 7 outside, for the rest of the match.
//
// Everything here goes through the player's own controls on the real bridge:
// train at the Archery Range, garrison with a right click on the Town Center,
// research at the Archery Range, Ungarrison on the Town Center. The ground
// truth read is the `visionSource` component, which is what the visibility
// system reveals from every tick.
//
// Bound: one line (Archer -> Crossbowman, sight 6 -> 7), one host (a Town
// Center), one owner (Saracens), and a save made by this build. Every other
// technology, both kinds of host and the bonus-bearing civilizations are the
// census in garrisonedSightCensus.test.ts. A save made BEFORE the fix already
// holds the stale copy, and nothing here repairs it.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { researchTimeTicks, trainingTimeTicks } from '../../src/game/simulation/prototypeEconomyRules';
import { unitVisionRadius } from '../../src/game/simulation/prototypeUnitRules';
import type { VisionSourceComponent } from '../../src/game/simulation/types';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
  stepUntilGarrisoned,
} from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

const OPTIONS = {
  civilizationsByOwner: new Map([[1, 'Saracens'], [2, 'Saracens']]),
  disableAiForOwners: new Set([2]),
};

function ownedArcherIds(bridge: Bridge): number[] {
  return bridge.getEconomyState().units
    .filter((unit) => unit.owner === 1 && unit.unitType === 'archer')
    .map((unit) => unit.id);
}

function isOnField(bridge: Bridge, unitId: number): boolean {
  return bridge.getEconomyState().units.some((unit) => unit.id === unitId);
}

function sightOf(bridge: Bridge, unitId: number): VisionSourceComponent | undefined {
  const source = bridge.world.getComponent<VisionSourceComponent>(unitId, 'visionSource');
  return source === undefined ? undefined : { ...source };
}

function townCenterId(bridge: Bridge): number {
  const townCenter = bridge.getEconomyState().buildings
    .find((building) => building.owner === 1 && building.buildingType === 'town-center');
  if (!townCenter) throw new Error('castle-upgrades-fixture lost owner 1\'s Town Center');
  return townCenter.id;
}

// Two Archers out of one Archery Range queue: the same type, the same owner,
// the same trained sight. The fixture's own Archer is left out because it
// carries a hand-written sight of 5.
function trainTwinArchers(bridge: Bridge): { insideId: number; outsideId: number } {
  const fixtureArchers = ownedArcherIds(bridge);
  expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
  expect(bridge.queueTrainUnit('archer')).toBe(true);
  expect(bridge.queueTrainUnit('archer')).toBe(true);
  expect(stepBridgeUntil(
    bridge,
    () => ownedArcherIds(bridge).length === fixtureArchers.length + 2,
    { maxSteps: trainingTimeTicks('archer') * 2 + 100 },
  ), 'the Archery Range never trained two Archers').toBe(true);
  const [insideId, outsideId] = ownedArcherIds(bridge).filter((id) => !fixtureArchers.includes(id));
  expect(sightOf(bridge, insideId!)).toEqual(sightOf(bridge, outsideId!));
  return { insideId: insideId!, outsideId: outsideId! };
}

function garrisonInTownCenter(bridge: Bridge, unitId: number): void {
  expect(bridge.selectEntityById(unitId)).toBe(true);
  expect(bridge.issueContextCommandAtEntity(townCenterId(bridge), { garrison: true })).toBe(true);
  expect(stepUntilGarrisoned(bridge, unitId), 'the Archer never went into the Town Center').toBe(true);
}

function researchCrossbowman(bridge: Bridge): void {
  expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
  expect(bridge.queueResearch('crossbowman-upgrade')).toBe(true);
  expect(stepBridgeUntil(
    bridge,
    () => bridge.getResearchedTechnologies(1).includes('crossbowman-upgrade'),
    { maxSteps: researchTimeTicks('crossbowman-upgrade') + 100 },
  ), 'the Crossbowman upgrade never completed').toBe(true);
}

function ungarrisonTownCenter(bridge: Bridge, unitId: number): void {
  expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
  expect(bridge.issueAction('ungarrison')).toBe(true);
  expect(stepBridgeUntil(bridge, () => isOnField(bridge, unitId), { maxSteps: 20 }),
    'the Town Center never let the Archer out').toBe(true);
}

// The upgrade must actually change sight, or the comparison below would pass
// over the defect: the twin outside is the witness that it did.
function expectUpgradedTwins(bridge: Bridge, insideId: number, outsideId: number): void {
  const outside = sightOf(bridge, outsideId);
  expect(outside?.radius).toBe(unitVisionRadius('crossbowman'));
  expect(unitVisionRadius('crossbowman')).toBeGreaterThan(unitVisionRadius('archer'));
  const unitTypeOf = (id: number) => bridge.getEconomyState().units.find((unit) => unit.id === id)?.unitType;
  expect(unitTypeOf(insideId)).toBe('crossbowman');
  expect(unitTypeOf(outsideId)).toBe('crossbowman');
  expect(sightOf(bridge, insideId), 'the Crossbowman that sat out the upgrade inside the Town Center')
    .toEqual(outside);
}

function reload(bridge: Bridge): Bridge {
  return createSimulationBridge('castle-upgrades-fixture', { ...OPTIONS, savedGame: bridge.saveGame() });
}

describe('a unit garrisoned during its line upgrade', () => {
  it('leaves the Town Center with the sight of its twin that stayed outside', () => {
    const bridge = createSimulationBridge('castle-upgrades-fixture', OPTIONS);
    const { insideId, outsideId } = trainTwinArchers(bridge);
    garrisonInTownCenter(bridge, insideId);
    researchCrossbowman(bridge);
    ungarrisonTownCenter(bridge, insideId);
    expectUpgradedTwins(bridge, insideId, outsideId);
  }, 60_000);

  it('keeps the upgraded sight through a save made while it is inside', () => {
    const bridge = createSimulationBridge('castle-upgrades-fixture', OPTIONS);
    const { insideId, outsideId } = trainTwinArchers(bridge);
    garrisonInTownCenter(bridge, insideId);
    researchCrossbowman(bridge);
    const loaded = reload(bridge);
    expect(isOnField(loaded, insideId), 'the load let the Archer out').toBe(false);
    ungarrisonTownCenter(loaded, insideId);
    expectUpgradedTwins(loaded, insideId, outsideId);
  }, 60_000);

  it('takes an upgrade researched after a load', () => {
    const bridge = createSimulationBridge('castle-upgrades-fixture', OPTIONS);
    const { insideId, outsideId } = trainTwinArchers(bridge);
    garrisonInTownCenter(bridge, insideId);
    const loaded = reload(bridge);
    researchCrossbowman(loaded);
    ungarrisonTownCenter(loaded, insideId);
    expectUpgradedTwins(loaded, insideId, outsideId);
  }, 60_000);
});
