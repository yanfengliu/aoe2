// A player's sight in two layers: what moves, and what does not (2026-09-24).
//
// civ-engine's VisibilityMap re-stamps a player's whole visible set from every
// one of its sources whenever any one of them changes, and a unit moves almost
// every tick. When every building gained sight, a late-game base's buildings
// were re-stamped on every one of those ticks: with Town Watch and Town Patrol
// (+8 on every wall, Farm and House) one recompute of such a base took up to
// 9.2 ms, against 0.54 ms before (docs/engine-feedback/current.md asks the
// engine for an incremental recompute instead).
//
// So this map is two engine maps. Units, sheep and anything else keyed by an
// owner's id live in the first; each owner's building sources live in the
// second, under `buildingSightKey(owner)`, and that map is recomputed only
// when a building's sight changes. Every sight question asked with an owner's
// id is answered from both, so no caller knows there are two. The world holds
// the map as two state slots (visibilitySlots.ts): the units' layer, written
// whenever a source moved, and what a load cannot rebuild of the building
// layer, written only when it changed (2026-09-25). `getState` still returns
// one ordinary VisibilityMapState in the engine's player order, for tests and
// tools, and `fromState` takes one, whichever slots it came from. It extends
// VisibilityMap so every caller typed
// against the engine's class takes it, and overrides EVERY public method: the
// base class's own state is never used. A public method the engine adds later
// must be routed here too, or it will read that empty base.

import {
  VisibilityMap,
  type Position,
  type VisibilityMapMetrics,
  type VisibilityMapState,
  type VisibilityPlayerId,
  type VisionSource,
  type VisionSourceId,
} from 'civ-engine';

const BUILDING_LAYER_SUFFIX = ':buildings';
// One string per owner, made once: a sight question asked with an owner's id
// that its unit layer answers "no" asks the building layer next, and target
// finding asks that for every unit on the map.
const buildingSightKeys = new Map<number, string>();

/** The engine player that holds `owner`'s building sources. */
export function buildingSightKey(owner: number): string {
  let key = buildingSightKeys.get(owner);
  if (key === undefined) {
    key = `${String(owner)}${BUILDING_LAYER_SUFFIX}`;
    buildingSightKeys.set(owner, key);
  }
  return key;
}

function isBuildingLayer(playerId: VisibilityPlayerId): boolean {
  return typeof playerId === 'string' && playerId.endsWith(BUILDING_LAYER_SUFFIX);
}

// The engine's own player order in a saved state (visibility-map.ts,
// compareByNormalizedKey): by the key's type-tagged text, code unit by code
// unit, so one merged state is exactly what a single map would have written.
function normalizedKey(playerId: VisibilityPlayerId): string {
  return typeof playerId === 'number' ? `n:${String(playerId)}` : `s:${playerId}`;
}

type SavedPlayer = VisibilityMapState['players'][number];

function mergePlayers(left: readonly SavedPlayer[], right: readonly SavedPlayer[]): SavedPlayer[] {
  const merged: SavedPlayer[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length || j < right.length) {
    if (j >= right.length || (i < left.length && normalizedKey(left[i]![0]) < normalizedKey(right[j]![0]))) {
      merged.push(left[i]!);
      i += 1;
    } else {
      merged.push(right[j]!);
      j += 1;
    }
  }
  return merged;
}

/** Two cell lists, each sorted by cell index as the engine returns them, merged
 *  without repeats. `right` is a cached list, so it is never handed back itself. */
function mergeSortedCells(left: Position[], right: Position[], width: number): Position[] {
  if (right.length === 0) return left;
  if (left.length === 0) return right.slice();
  const merged: Position[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length || j < right.length) {
    const a = i < left.length ? left[i]!.y * width + left[i]!.x : Number.POSITIVE_INFINITY;
    const b = j < right.length ? right[j]!.y * width + right[j]!.x : Number.POSITIVE_INFINITY;
    if (a <= b) {
      merged.push(left[i]!);
      i += 1;
      if (a === b) j += 1;
    } else {
      merged.push(right[j]!);
      j += 1;
    }
  }
  return merged;
}

export class LayeredVisibilityMap extends VisibilityMap {
  private units: VisibilityMap;
  private buildings: VisibilityMap;
  // The building layer's cell lists as last returned, kept until one of its
  // sources changes. A changed source is the only thing that changes that
  // layer's visible or explored cells, because only a changed source makes the
  // engine recompute it.
  private buildingVisibleCache = new Map<number, Position[]>();
  private buildingExploredCache = new Map<number, Position[]>();
  // The world's building slot as last computed (getBuildingLayerState), each
  // building-layer player's cells as sorted indices, dropped when one of that
  // layer's sources changes. The players are tracked here rather than read
  // from the engine's getState, which would sort every source only for the
  // slot to drop them.
  private buildingSlotCache: Array<[VisibilityPlayerId, number[]]> | null = null;
  private buildingKeys = new Set<VisibilityPlayerId>();

  constructor(width: number, height: number) {
    super(width, height);
    this.units = new VisibilityMap(width, height);
    this.buildings = new VisibilityMap(width, height);
  }

  static override fromState(state: VisibilityMapState): LayeredVisibilityMap {
    const map = new LayeredVisibilityMap(state.width, state.height);
    map.units = VisibilityMap.fromState({
      width: state.width,
      height: state.height,
      players: state.players.filter(([playerId]) => !isBuildingLayer(playerId)),
    });
    const buildingPlayers = state.players.filter(([playerId]) => isBuildingLayer(playerId));
    map.buildings = VisibilityMap.fromState({ width: state.width, height: state.height, players: buildingPlayers });
    for (const [playerId] of buildingPlayers) map.buildingKeys.add(playerId);
    return map;
  }

  private layerFor(playerId: VisibilityPlayerId): VisibilityMap {
    if (!isBuildingLayer(playerId)) return this.units;
    this.buildingVisibleCache.clear();
    this.buildingExploredCache.clear();
    this.buildingSlotCache = null;
    return this.buildings;
  }

  override setSource(playerId: VisibilityPlayerId, sourceId: VisionSourceId, source: VisionSource): void {
    this.layerFor(playerId).setSource(playerId, sourceId, source);
    if (isBuildingLayer(playerId)) this.buildingKeys.add(playerId);
  }

  override removeSource(playerId: VisibilityPlayerId, sourceId: VisionSourceId): void {
    this.layerFor(playerId).removeSource(playerId, sourceId);
  }

  /** An owner's id clears both of its layers; the engine drops the player,
   *  explored cells and all. */
  override clearPlayer(playerId: VisibilityPlayerId): void {
    this.layerFor(playerId).clearPlayer(playerId);
    this.buildingKeys.delete(playerId);
    if (typeof playerId === 'number') {
      const key = buildingSightKey(playerId);
      this.layerFor(key).clearPlayer(key);
      this.buildingKeys.delete(key);
    }
  }

  override update(): void {
    this.units.update();
    this.buildings.update();
  }

  override getMetrics(): VisibilityMapMetrics {
    const units = this.units.getMetrics();
    const buildings = this.buildings.getMetrics();
    return {
      recomputes: units.recomputes + buildings.recomputes,
      computedCells: units.computedCells + buildings.computedCells,
      visibilityQueries: units.visibilityQueries + buildings.visibilityQueries,
    };
  }

  override resetMetrics(): void {
    this.units.resetMetrics();
    this.buildings.resetMetrics();
  }

  override isVisible(playerId: VisibilityPlayerId, x: number, y: number): boolean {
    if (isBuildingLayer(playerId)) return this.buildings.isVisible(playerId, x, y);
    return this.units.isVisible(playerId, x, y)
      || (typeof playerId === 'number' && this.buildings.isVisible(buildingSightKey(playerId), x, y));
  }

  override isExplored(playerId: VisibilityPlayerId, x: number, y: number): boolean {
    if (isBuildingLayer(playerId)) return this.buildings.isExplored(playerId, x, y);
    return this.units.isExplored(playerId, x, y)
      || (typeof playerId === 'number' && this.buildings.isExplored(buildingSightKey(playerId), x, y));
  }

  override getVisibleCells(playerId: VisibilityPlayerId): Position[] {
    if (isBuildingLayer(playerId)) return this.buildings.getVisibleCells(playerId);
    const own = this.units.getVisibleCells(playerId);
    if (typeof playerId !== 'number') return own;
    let buildingCells = this.buildingVisibleCache.get(playerId);
    if (buildingCells === undefined) {
      buildingCells = this.buildings.getVisibleCells(buildingSightKey(playerId));
      this.buildingVisibleCache.set(playerId, buildingCells);
    }
    return mergeSortedCells(own, buildingCells, this.width);
  }

  override getExploredCells(playerId: VisibilityPlayerId): Position[] {
    if (isBuildingLayer(playerId)) return this.buildings.getExploredCells(playerId);
    const own = this.units.getExploredCells(playerId);
    if (typeof playerId !== 'number') return own;
    let buildingCells = this.buildingExploredCache.get(playerId);
    if (buildingCells === undefined) {
      buildingCells = this.buildings.getExploredCells(buildingSightKey(playerId));
      this.buildingExploredCache.set(playerId, buildingCells);
    }
    return mergeSortedCells(own, buildingCells, this.width);
  }

  override getSources(playerId: VisibilityPlayerId): Array<[VisionSourceId, VisionSource]> {
    return (isBuildingLayer(playerId) ? this.buildings : this.units).getSources(playerId);
  }

  /** Both layers as one engine map holding the same sources would save them.
   *  The world does not hold this: it holds the two slots below. */
  override getState(): VisibilityMapState {
    return {
      width: this.width,
      height: this.height,
      players: mergePlayers(this.units.getState().players, this.buildings.getState().players),
    };
  }

  /** The units' layer alone: the world's `aoe2.visibility` slot. */
  getUnitLayerState(): VisibilityMapState {
    return this.units.getState();
  }

  /** What a load cannot rebuild of every owner's building layer, as of now,
   *  for the world's `aoe2.buildingVisibility` slot: the cells it explored
   *  that none of the owner's units has explored. Its sources are left out,
   *  because the first sync after a load places every building's sources again
   *  from its components (visibilitySourceSync.ts). The engine fingerprints
   *  every state slot twice a tick, so what this slot holds is paid for on
   *  every tick. The answer shrinks whenever a unit explores one of those
   *  cells, with no building changing, so it is current as of the call:
   *  computed whole after a building change, and otherwise as the last answer
   *  less the cells units have explored since, which is exact because until a
   *  building changes the building layer's cells stay put and the units'
   *  explored cells only grow. */
  getBuildingLayerState(): VisibilityMapState {
    const unexploredBy = (key: VisibilityPlayerId) => {
      const owner = Number(String(key).slice(0, -BUILDING_LAYER_SUFFIX.length));
      return (cell: number) => !this.units.isExplored(owner, cell % this.width, Math.floor(cell / this.width));
    };
    if (this.buildingSlotCache === null) {
      this.buildingSlotCache = [...this.buildingKeys]
        .sort((a, b) => (normalizedKey(a) < normalizedKey(b) ? -1 : 1))
        .map((key) => [key, this.buildings.getExploredCells(key).map(({ x, y }) => y * this.width + x).filter(unexploredBy(key))]);
    } else {
      this.buildingSlotCache = this.buildingSlotCache.map(([key, cells]) => [key, cells.filter(unexploredBy(key))]);
    }
    const players = this.buildingSlotCache.map(([key, explored]): SavedPlayer => [key, { sources: [], explored }]);
    return { width: this.width, height: this.height, players };
  }
}
