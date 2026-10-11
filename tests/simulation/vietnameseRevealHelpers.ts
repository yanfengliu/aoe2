// Shared set-up for the Vietnamese reveal's tests (work 117): a fresh match on
// `ai-castle-age-military-fixture` with the human (owner 1) playing the
// Vietnamese and owner 2's AI switched off, so nothing moves unless a test
// moves it. The human holds one Town Center at (6,6) and nothing else, so the
// only ground it knows near owner 2's base is what the reveal gave it.
//
// Owner 2 starts with a Town Center at (34,20) — the one the reveal is for —
// and three villagers at (45..47,30), which a test can use to build a second
// Town Center mid-game through the same command the AI's own builders send.

import { visibilityStateFromSlots } from '../../src/game/simulation/bridge/visibilitySlots';
import { LayeredVisibilityMap } from '../../src/game/simulation/bridge/layeredVisibilityMap';
import { lastSeenStaticCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { SaveBlob } from '../../src/game/simulation/saveSchema';
import { codecSlotValue } from './saveBlobTestUtils';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

export const REVEAL_SEED = 'ai-castle-age-military-fixture';
export const HUMAN = 1;
export const ENEMY = 2;
/** Owner 2's starting Town Center, the one the reveal is for. */
export const ENEMY_TOWN_CENTER = { x: 34, y: 20 } as const;
/** Where owner 2 builds a second Town Center mid-game: open grass far from
 *  anything the human can see. */
export const MID_GAME_TOWN_CENTER = { x: 52, y: 28 } as const;
export const TOWN_CENTER_SIZE = 4;
/** Spec §11 (the Vietnamese reveal paragraph): the ground within 5 cells of
 *  the middle of each enemy Town Center's footprint. */
export const REVEAL_RADIUS = 5;

export function createVietnameseMatch(): Bridge {
  return createSimulationBridge(REVEAL_SEED, {
    civilizationsByOwner: new Map([[HUMAN, 'Vietnamese']]),
    disableAiForOwners: new Set([ENEMY]),
  });
}

export const cellKey = (x: number, y: number): string => `${String(x)},${String(y)}`;

/** The continuous definition, written out here independently of the code under
 *  test: cell (x, y) is the unit square [x, x+1) x [y, y+1), so its centre is
 *  (x + 0.5, y + 0.5), and a footprint anchored at (ax, ay) of size s x s has
 *  its centre at (ax + s/2, ay + s/2). */
export function cellsWithinOfFootprintCentre(
  anchor: { readonly x: number; readonly y: number },
  size: number,
  radius: number,
): Set<string> {
  const centreX = anchor.x + size / 2;
  const centreY = anchor.y + size / 2;
  const cells = new Set<string>();
  const span = Math.ceil(radius) + size;
  for (let y = anchor.y - span; y <= anchor.y + span; y += 1) {
    for (let x = anchor.x - span; x <= anchor.x + span; x += 1) {
      const dx = x + 0.5 - centreX;
      const dy = y + 0.5 - centreY;
      if (dx * dx + dy * dy <= radius * radius) cells.add(cellKey(x, y));
    }
  }
  return cells;
}

/** The old circle: around the footprint's top-left cell, as the engine lights
 *  one source standing on that cell. What a save or a recording made before
 *  work 117 holds. */
export function cellsWithinOfAnchor(
  anchor: { readonly x: number; readonly y: number },
  radius: number,
): Set<string> {
  const cells = new Set<string>();
  const span = Math.ceil(radius);
  for (let y = anchor.y - span; y <= anchor.y + span; y += 1) {
    for (let x = anchor.x - span; x <= anchor.x + span; x += 1) {
      const dx = x - anchor.x;
      const dy = y - anchor.y;
      if (dx * dx + dy * dy <= radius * radius) cells.add(cellKey(x, y));
    }
  }
  return cells;
}

/** The ground the human player knows, as the page draws it: the frame's
 *  explored cells. Steps once if no frame has been projected yet. */
export function humanExploredCells(bridge: Bridge): Set<string> {
  let frame = bridge.getRenderState().frame;
  if (!frame) {
    bridge.step(100);
    frame = bridge.getRenderState().frame;
  }
  if (!frame) throw new Error('The bridge projected no frame after a step, so the explored cells cannot be read.');
  const width = frame.mapWidth;
  return new Set(frame.exploredCells.map((index) => cellKey(index % width, Math.floor(index / width))));
}

/** One owner's explored cells in a save or a snapshot's state, both layers. */
export function exploredCellsInState(
  state: Record<string, unknown>,
  owner: number,
): Set<string> {
  const map = LayeredVisibilityMap.fromState(visibilityStateFromSlots(
    state,
    (slot) => new Error(`The state holds no ${slot} slot, so its explored cells cannot be read.`),
  ));
  return new Set(map.getExploredCells(owner).map(({ x, y }) => cellKey(x, y)));
}

export function saveState(blob: SaveBlob): Record<string, unknown> {
  const state = (blob.worldSnapshot as { state?: Record<string, unknown> }).state;
  if (!state) throw new Error('The save holds no world state.');
  return state;
}

/** The entity ids in the human's fog memory, read from a save. */
export function humanMemoryIds(blob: SaveBlob): number[] {
  const memory = lastSeenStaticCodec.deserialize(codecSlotValue(blob, lastSeenStaticCodec));
  return [...(memory.get(HUMAN)?.keys() ?? [])].sort((a, b) => a - b);
}

export const within = (cells: Set<string>, region: Set<string>): string[] =>
  [...cells].filter((cell) => region.has(cell)).sort();

export const sortedCells = (cells: Iterable<string>): string[] => [...cells].sort();

/** How far the cells reach past each edge of a footprint, along its two
 *  central rows and columns. */
export function reachPastEdges(
  cells: Set<string>,
  anchor: { readonly x: number; readonly y: number },
  size: number,
): { west: number; east: number; north: number; south: number } {
  const midRows = [anchor.y + size / 2 - 1, anchor.y + size / 2];
  const midColumns = [anchor.x + size / 2 - 1, anchor.x + size / 2];
  const reach = (step: (n: number) => [number, number][]): number => {
    let n = 0;
    while (step(n + 1).every(([x, y]) => cells.has(cellKey(x, y)))) n += 1;
    return n;
  };
  return {
    west: reach((n) => midRows.map((y) => [anchor.x - n, y])),
    east: reach((n) => midRows.map((y) => [anchor.x + size - 1 + n, y])),
    north: reach((n) => midColumns.map((x) => [x, anchor.y - n])),
    south: reach((n) => midColumns.map((x) => [x, anchor.y + size - 1 + n])),
  };
}

/** Owner 2 builds a second Town Center through the command its AI's builders
 *  send (`building.placeConfirm`), and the villager finishes it. Returns the
 *  new Town Center's entity id. */
export function buildEnemyTownCenterMidGame(bridge: Bridge): number {
  const builder = bridge.getEconomyState().units.find(
    (unit) => unit.owner === ENEMY && unit.unitType === 'villager',
  );
  if (!builder) throw new Error('The fixture gave owner 2 no villager to build with.');
  const placed = bridge.world.submitWithResult('building.placeConfirm', {
    builderId: builder.id,
    buildingType: 'town-center',
    position: { ...MID_GAME_TOWN_CENTER },
  });
  if (!placed.accepted) {
    throw new Error(`Owner 2's Town Center at (${String(MID_GAME_TOWN_CENTER.x)},${String(MID_GAME_TOWN_CENTER.y)}) was refused: ${JSON.stringify(placed)}`);
  }
  const isTheNewOne = (building: { owner: number; buildingType: string; x: number; y: number }) =>
    building.owner === ENEMY
    && building.buildingType === 'town-center'
    && building.x === MID_GAME_TOWN_CENTER.x
    && building.y === MID_GAME_TOWN_CENTER.y;
  const finished = stepBridgeUntil(
    bridge,
    () => bridge.getEconomyState().buildings.some((building) => isTheNewOne(building) && building.isComplete),
    // A walk of a few cells and a DE Town Center's 1,500-tick build.
    { maxSteps: 2_400 },
  );
  if (!finished) throw new Error('Owner 2\'s mid-game Town Center was not finished within 2,400 ticks.');
  return bridge.getEconomyState().buildings.find(isTheNewOne)!.id;
}
