// CONTENT PIPELINE — BUILDINGS. Every row of `AUTHORITATIVE_BUILDING_FOOTPRINTS`
// is placed through the real `building.placeConfirm` command and built out.
//
// WHY THIS EXISTS. Same reason as the research and training halves: the
// self-play lab's building floor named building types, and a name on that floor
// asserted that the AI's build order happened to reach that type inside 45,000
// ticks with a purse that happened to cover it. That is a reading of the AI. On
// the 2026-09-10 tree the lab reaches 15 of the game's 25 building types, and
// the ten it misses are not unreachable content — they are content the AI never
// asks for. This file is the half no match trajectory can move.
//
// WHAT IT ASSERTS, per building type, on a live world: it is offered in the
// selected builder's own build menu (`getSelectionState().buildOptions`, the
// surface the HUD build panel reads) and in `getAgentBuildingOptions`'s
// `villagerCanBuild` with the footprint string the table declares; the
// placement preview accepts a real anchor; `confirmBuildingPlacement` (the
// `building.placeConfirm` command) is accepted; the STOCKPILE loses exactly
// `getConstructionCost`, which is the raw `constructionCost` row unless the
// civilization discounts it (the run prints which rows were discounted — the
// Britons' Town Center is half wood from the Castle Age, so a civilization is a
// price, not a detail); a foundation appears at that anchor occupying exactly
// the table's width and height; and a crew builds it to completion.
//
// THE ONE BUILDING A VILLAGER CANNOT PLACE is the Fish Trap: it goes on open
// water, so a FISHING SHIP places it (`buildOptionsFor`). This gate trains one
// and drives it the same way, which is why the Fish Trap's row is checked
// against the fishing ship's build menu rather than the villager's.
//
// THE SEAT'S CIVILIZATION is not a free choice: 21 of the 30 tech trees deny
// the Bombard Tower, the Goths deny stone walls and gates, and three deny the
// Stable, so the gate picks the first civilization that denies no building type
// (Byzantines today) out of `civTechTree` rather than naming one. A tech-tree
// edit re-chooses; only a tree where NO civilization is clean fails, and it
// fails saying so.
//
// THE SEAT. `naval-imperial-fixture`: Imperial Age, a Town Center, a villager,
// a Dock already on a bay, and — unlike the showcase fixture — NO wonder
// already standing, because `buildOptionsFor` withdraws the Wonder from a
// player who owns one. Housing is seeded rather than built so the gate does not
// spend its ticks on Houses before it can train a crew, and every technology is
// seeded because the Bombard Tower is unlocked by research rather than by age.
//
// BOUND — what a green run does NOT prove. One map, one civilization, one age,
// one anchor per type: it says nothing about placement RULES (the overlap,
// terrain and reachability refusals are `placementSearch.test.ts`'s and
// `aiPlacementKeepsMapConnected.test.ts`'s), nothing about what a building DOES
// once built, and nothing about build TIME. The crew is a fixed size, so the
// multi-builder curve is exercised but not measured. A type that is buildable
// only on terrain this map lacks would fail here by name rather than pass.
//
// COST: 59 s measured 2026-09-10 on a 32-core machine with the other three
// content gates running beside it; a second run of the same tree gave 90 s, so
// this is an order of magnitude and not a budget. Dominated by the Wonder's
// 35,030 builder-ticks.

import { describe, expect, it } from 'vitest';

import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { deniedIdsFor } from '../../src/game/simulation/civTechTree';
import { RESEARCH_COSTS } from '../../src/game/simulation/researchTables';
import { constructionCost } from '../../src/game/simulation/prototypeEconomyRules';
import type {
  BuildableBuildingType,
  BuildingType,
  ResearchableTechnologyType,
} from '../../src/game/simulation/types';
import {
  type Bridge,
  expectSpend,
  normalizeCost,
  purseOf,
  selectCompletedBuilding,
  spentBetween,
  standSeat,
  stepUntil,
} from './contentPipeline.helpers';

const NAVAL = 'naval-imperial-fixture';
const ALL_BUILDINGS = Object.keys(AUTHORITATIVE_BUILDING_FOOTPRINTS) as BuildingType[];
// A civilization's tree can DENY a building — 21 of the 30 have no Bombard
// Tower, the Goths no stone walls or gates, three (Aztecs, Mayans, Incas) no
// Stable — so the driving seat is the first civilization that denies none of
// them, which today is Byzantines. Chosen from the table rather than named, so
// a tech-tree edit re-chooses instead of failing.
const CIVILIZATION = CIVILIZATION_NAMES.find(
  (civ) => !ALL_BUILDINGS.some((building) => deniedIdsFor(civ).has(building)),
);
const CREW_SIZE = 12;
// The Wonder is 35,030 builder-ticks; a crew of twelve on AoE2's curve (a full
// share for the first builder, a third for each of the rest) is 4.67x, so its
// own build is the horizon every other type fits comfortably inside.
const BUILD_TIMEOUT_TICKS = 20_000;

function ownedVillagerIds(bridge: Bridge): number[] {
  return bridge.getEconomyState().units
    .filter((unit) => unit.owner === 1 && unit.unitType === 'villager')
    .map((unit) => unit.id);
}

/** The first anchor whose PREVIEW says yes, searched in rings out from the
 *  Town Center so the town stays compact and the bay stays reachable. */
function findAnchor(bridge: Bridge): { x: number; y: number } | null {
  const centre = bridge.getEconomyState().buildings.find(
    (building) => building.owner === 1 && building.buildingType === 'town-center',
  );
  const { width, height } = bridge.getMapSize();
  const originX = centre?.x ?? Math.floor(width / 2);
  const originY = centre?.y ?? Math.floor(height / 2);
  for (let radius = 1; radius < Math.max(width, height); radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const x = originX + dx;
        const y = originY + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        if (bridge.getPlacementPreview(x, y)?.isValid) return { x, y };
      }
    }
  }
  return null;
}

describe('content pipeline — buildings', () => {
  it('offers, accepts, charges and completes every building footprint row through building.placeConfirm', () => {
    const started = Date.now();
    expect(
      CIVILIZATION,
      'no civilization has every building type in its tree, so no single seat can drive this gate. '
      + `Denials: ${CIVILIZATION_NAMES.map((civ) => `${civ}=[${ALL_BUILDINGS.filter((b) => deniedIdsFor(civ).has(b)).join(' ')}]`).join(' ')}`,
    ).toBeDefined();
    const bridge = standSeat({
      scenarioSeed: NAVAL,
      civilization: CIVILIZATION,
      researched: Object.keys(RESEARCH_COSTS) as ResearchableTechnologyType[],
      age: 'imperial-age',
      populationSupply: 200,
    });

    // A crew, and the one builder that is not a villager.
    expect(selectCompletedBuilding(bridge, 'town-center'), 'the naval fixture has no completed Town Center').toBe(true);
    for (let i = ownedVillagerIds(bridge).length; i < CREW_SIZE; i += 1) {
      expect(bridge.queueTrainUnit('villager'), 'the Town Center refused to queue a villager').toBe(true);
    }
    expect(selectCompletedBuilding(bridge, 'dock'), 'the naval fixture has no completed Dock').toBe(true);
    expect(bridge.queueTrainUnit('fishing-ship'), 'the Dock refused to queue a fishing ship').toBe(true);
    const crewReady = stepUntil(
      bridge,
      () => ownedVillagerIds(bridge).length >= CREW_SIZE
        && bridge.getEconomyState().units.some((unit) => unit.owner === 1 && unit.unitType === 'fishing-ship'),
      8_000,
      25,
    );
    expect(crewReady, `the crew of ${String(CREW_SIZE)} villagers and one fishing ship never finished training`).not.toBeNull();

    const placed: string[] = [];
    const discounted: string[] = [];
    const { width, height } = bridge.getMapSize();
    for (const buildingType of ALL_BUILDINGS) {
      const footprint = AUTHORITATIVE_BUILDING_FOOTPRINTS[buildingType];
      const byShip = buildingType === 'fish-trap';
      if (byShip) {
        const ship = bridge.getEconomyState().units.find(
          (unit) => unit.owner === 1 && unit.unitType === 'fishing-ship',
        );
        expect(ship, 'no fishing ship to place the Fish Trap with').toBeDefined();
        expect(bridge.selectEntityById(ship!.id), 'could not select the fishing ship').toBe(true);
      } else {
        expect(
          bridge.selectOwnedUnitsByTypeInRect('villager', 0, 0, width, height),
          'could not select the villager crew',
        ).toBe(true);
      }

      const offered = bridge.getSelectionState().buildOptions;
      expect(
        offered,
        `${buildingType} is not in the selected builder's build menu — it is unreachable content, `
        + `not a coverage shortfall. The menu offered: ${offered.join(' ')}`,
      ).toContain(buildingType);
      if (!byShip) {
        const agentOption = bridge.getAgentBuildingOptions(1).villagerCanBuild.find(
          (option) => option.buildingType === buildingType,
        );
        expect(agentOption, `${buildingType} is missing from villagerCanBuild`).toBeDefined();
        expect(
          agentOption!.footprint,
          `${buildingType}: villagerCanBuild advertises ${String(agentOption!.footprint)} but the footprint table says `
          + `${String(footprint.width)}x${String(footprint.height)}`,
        ).toBe(`${String(footprint.width)}x${String(footprint.height)}`);
      }

      expect(
        bridge.beginBuildingPlacement(buildingType as BuildableBuildingType),
        `${buildingType}: beginBuildingPlacement was refused`,
      ).toBe(true);
      const anchor = findAnchor(bridge);
      expect(anchor, `${buildingType}: no cell on the map produced a valid placement preview`).not.toBeNull();

      const knownIds = new Set(bridge.getEconomyState().buildings.map((building) => building.id));
      const purse = purseOf(bridge);
      const confirmed = bridge.confirmBuildingPlacement(anchor!.x, anchor!.y);
      bridge.step(100);
      expect(confirmed, `${buildingType}: building.placeConfirm was refused at a cell the preview called valid`).toBe(true);
      const rejection = bridge.consumeCommandRejection();
      expect(rejection, `${buildingType}: the dispatcher rejected the placement — ${String(rejection)}`).toBeNull();
      const declared = bridge.getConstructionCost(1, buildingType);
      expectSpend(buildingType, spentBetween(purse, purseOf(bridge)), declared);
      if (JSON.stringify(normalizeCost(declared))
        !== JSON.stringify(normalizeCost(constructionCost(buildingType as BuildableBuildingType)))) {
        discounted.push(buildingType);
      }

      const site = bridge.getEconomyState().buildings.find(
        (building) => !knownIds.has(building.id) && building.buildingType === buildingType,
      );
      expect(site, `${buildingType}: no foundation appeared after a confirmed placement`).toBeDefined();
      expect(
        { width: site!.footprintWidth, height: site!.footprintHeight },
        `${buildingType}: the placed footprint is not the one the table declares`,
      ).toEqual({ width: footprint.width, height: footprint.height });

      const built = stepUntil(
        bridge,
        () => bridge.getEconomyState().buildings.some((building) => building.id === site!.id && building.isComplete),
        BUILD_TIMEOUT_TICKS,
        25,
      );
      expect(built, `${buildingType}: a crew of ${String(CREW_SIZE)} never finished it inside ${String(BUILD_TIMEOUT_TICKS)} ticks`).not.toBeNull();
      placed.push(buildingType);
    }

    console.log(
      `PIPELINE buildings: ${String(placed.length)}/${String(ALL_BUILDINGS.length)} rows placed and completed in `
      + `${((Date.now() - started) / 1000).toFixed(1)} s`,
    );
    console.log(
      `PIPELINE buildings: driven as ${String(CIVILIZATION)}; rows charged a civilization discount `
      + 'rather than the raw construction cost row: '
      + `${discounted.join(' ') || 'none'}`,
    );
    expect(placed.sort(), 'a building footprint row was never placed').toEqual([...ALL_BUILDINGS].sort());
  }, 900_000);
});
