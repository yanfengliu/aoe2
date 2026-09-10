// Shared rig for the CONTENT PIPELINE gates (contentPipelineResearch /
// contentPipelineTraining / contentPipelineBuildings).
//
// WHAT A PIPELINE GATE IS FOR. The self-play coverage lab measures what one AI
// match happened to reach; that is a reading of the AI, and it moves when the
// AI moves. These gates measure something the AI cannot move: that every row of
// the game's own content tables can be BOUGHT — offered by the real menu
// surface, accepted by the real validator, charged the table's price out of a
// real stockpile, and completed into a real entity or a real researched set.
// Nothing here depends on any match trajectory, which is the whole point (see
// the 2026-09-10 defect-register entry).
//
// THE COMMAND PATH IS THE REAL ONE. Every purchase below goes through
// `queue.research`, `queue.train` or `building.placeConfirm` — the same three
// commands the HUD buttons and the agent API push — never a direct write into
// world state. What IS written directly is the SETUP a seat needs: its
// civilization, its age, the technologies standing in for prerequisites it has
// already bought elsewhere, and its purse. That is the same setup the fixtures
// in `src/game/simulation/fixtures` express as `startingResearchedTechnologies`
// and `startingResources`; it is expressed here through the save blob because
// these gates need it per-civilization and the fixture tree is fixed content.

import { expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  playerAgesCodec,
  playerResourcesCodec,
  populationCodec,
  researchedTechnologiesCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { AgeType, PlayerResources } from '../../src/game/simulation/types';

export type Bridge = ReturnType<typeof createSimulationBridge>;

/** Big enough that nothing in either cost table can be refused for price, and
 *  small enough to stay an exact integer through every civ multiplier. */
const FULL_PURSE: PlayerResources = {
  food: 400_000, wood: 400_000, gold: 400_000, stone: 400_000,
};

export const RESOURCE_KINDS = ['food', 'wood', 'gold', 'stone'] as const;

export interface SeatSpec {
  /** A scenario seed whose owner-1 start already holds the producers needed. */
  scenarioSeed: string;
  civilization?: string;
  /** Stands in for prerequisites bought elsewhere — never for the entry under test. */
  researched?: readonly string[];
  age?: AgeType;
  populationCap?: number;
  /** Housing the seat is treated as already having, so a gate that needs a
   *  crowd does not have to spend its ticks building houses first. */
  populationSupply?: number;
}

/** A seat standing in `spec.scenarioSeed`'s buildings, in the age asked for,
 *  holding the prerequisites asked for and a purse nothing can exhaust. */
export function standSeat(spec: SeatSpec): Bridge {
  const options = {
    victory: 'conquest-only' as const,
    populationCap: spec.populationCap,
    civilizationsByOwner: spec.civilization
      ? new Map([[1, spec.civilization], [2, spec.civilization]])
      : undefined,
  };
  const boot = createSimulationBridge(spec.scenarioSeed, options);
  const blob = JSON.parse(JSON.stringify(boot.saveGame())) as ReturnType<Bridge['saveGame']>;
  const state = (blob.worldSnapshot as { state: Record<string, unknown> }).state;
  state[playerResourcesCodec.slot] = [
    [1, { ...FULL_PURSE }],
    [2, { food: 0, wood: 0, gold: 0, stone: 0 }],
  ];
  if (spec.researched) state[researchedTechnologiesCodec.slot] = [[1, [...spec.researched]]];
  if (spec.age) state[playerAgesCodec.slot] = [[1, spec.age], [2, spec.age]];
  if (spec.populationSupply !== undefined) {
    state[populationCodec.slot] = [
      [1, { current: 0, cap: spec.populationSupply, rawSupply: spec.populationSupply }],
      [2, { current: 0, cap: spec.populationSupply, rawSupply: spec.populationSupply }],
    ];
  }
  return createSimulationBridge(spec.scenarioSeed, { ...options, savedGame: blob });
}

/** Select a COMPLETED building of this type the way a click does — by cell. */
export function selectCompletedBuilding(
  bridge: Bridge,
  buildingType: string,
  owner = 1,
): boolean {
  const building = bridge.getEconomyState().buildings.find(
    (candidate) => candidate.owner === owner
      && candidate.buildingType === buildingType
      && candidate.isComplete,
  );
  if (!building) return false;
  for (let dy = 0; dy < building.footprintHeight; dy += 1) {
    for (let dx = 0; dx < building.footprintWidth; dx += 1) {
      if (
        bridge.selectEntityAtCell(building.x + dx, building.y + dy)
        && bridge.getSelectionState().selectedEntityType === buildingType
      ) return true;
    }
  }
  return false;
}

export function purseOf(bridge: Bridge, owner = 1): PlayerResources {
  return { ...bridge.getEconomyState().playerResources[owner]! };
}

/** What the stockpile actually lost, as a cost-shaped object (zeroes dropped),
 *  so it compares directly against a table row. */
export function spentBetween(
  before: PlayerResources,
  after: PlayerResources,
): Partial<PlayerResources> {
  const spent: Partial<PlayerResources> = {};
  for (const kind of RESOURCE_KINDS) {
    const delta = before[kind] - after[kind];
    if (delta !== 0) spent[kind] = delta;
  }
  return spent;
}

/** A cost table row with its zero and undefined entries dropped, so an
 *  observed spend of nothing and a declared cost of nothing compare equal. */
export function normalizeCost(cost: Partial<PlayerResources>): Partial<PlayerResources> {
  const out: Partial<PlayerResources> = {};
  for (const kind of RESOURCE_KINDS) {
    const value = cost[kind] ?? 0;
    if (value !== 0) out[kind] = value;
  }
  return out;
}

/** Step until `predicate` holds, returning the ticks it took, or `null` if it
 *  never held inside `maxTicks`. `pollEvery` keeps the poll off the hot path. */
export function stepUntil(
  bridge: Bridge,
  predicate: () => boolean,
  maxTicks: number,
  pollEvery = 10,
): number | null {
  for (let tick = 1; tick <= maxTicks; tick += 1) {
    bridge.step(100);
    if (tick % pollEvery === 0 && predicate()) return tick;
  }
  return predicate() ? maxTicks : null;
}

/** Fail with the entry's own name and the seat that was driving it. */
export function expectSpend(
  label: string,
  observed: Partial<PlayerResources>,
  declared: Partial<PlayerResources>,
): void {
  expect(
    observed,
    `${label}: the stockpile lost ${JSON.stringify(observed)} but the cost table says `
    + `${JSON.stringify(normalizeCost(declared))}. The command path and the price table disagree.`,
  ).toEqual(normalizeCost(declared));
}
