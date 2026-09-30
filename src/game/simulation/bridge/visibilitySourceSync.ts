// Writes every vision source into the VisibilityMap, once per tick and
// whenever a caller needs the map current mid-tick. Split out of
// visibility.ts on 2026-09-24, when a building's sight moved from its
// top-left cell to the middle of its footprint and the file reached the
// 500-line budget; visibility.ts re-exports it.
//
// A unit or a sheep is one map source under its own entity id, held by its
// owner's id. A building's sources are held by its owner's BUILDING layer
// (`buildingSightKey`, layeredVisibilityMap.ts), which the engine recomputes
// only when a building's sight changes rather than every time a unit moves.
// An odd-sized building (1x1, 3x3) is one source under its entity id; an
// even-sized one (2x2, 4x4) is FOUR, one on each of its central cells, because
// its centre is a cell corner and the map only takes circles around whole
// cells (buildingVisionSources.ts): the first keeps the entity id and the
// other three are `${id}:1` to `${id}:3`.

import type { Position, VisibilityMap, VisibilityPlayerId } from 'civ-engine';

import { footprintVisionSources } from '../buildingVisionSources';
import type { BuildingComponent, VisionSourceComponent } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { trackedVisibilitySourcesCodec } from './bridgeStateSerialize';
import { buildingSightKey } from './layeredVisibilityMap';
import { buildingFootprint, type GameWorld } from './pureHelpers';
import type { VisibilityCell } from './visibilityCell';

// Per-source fingerprint — what we last wrote to the visibility map for a
// vision-source entity. Used to skip the no-op setSource/markDirty path when
// nothing about the source has changed since last tick. Visibility traversal
// is the second-most expensive per-tick operation behind A* path resolution;
// without this gate, every stationary unit would re-trigger the visibility
// cell's dirty flag every tick, defeating the cell's whole purpose.
//
// playerId is a load-bearing field: monk conversion (monkTaskAppliers) and
// sheep claim transfer (syncSheepVisionSource) both mutate visionSource.
// playerId in place. Without playerId in the fingerprint, those flips would
// silently skip the setSource path AND leave a stale source registered for
// the previous owner — the new owner gets no vision from the converted unit
// until it moves, and the old owner retains vision indefinitely.
export interface VisibilitySourceFingerprint {
  playerId: number;
  /** The entity's position: a unit's cell, a building's top-left anchor. */
  x: number;
  y: number;
  radius: number;
  /** Whether the sources sit in the owner's building layer. */
  building: boolean;
  /** The footprint the sources were placed for (1x1 for anything that is not
   *  a building), so an id recycled as a different building re-places them. */
  width: number;
  height: number;
  /** How many map sources the entity holds (0, 1 or 4). */
  sourceCount: number;
}

/** The most map sources one entity can hold (an even-sized building). */
export const MAX_VISION_SOURCES_PER_ENTITY = 4;

/** The VisibilityMap id of an entity's `index`-th source. */
export function visionSourceKey(entityId: number, index: number): number | string {
  return index === 0 ? entityId : `${String(entityId)}:${String(index)}`;
}

/** The engine player that holds this owner's sources of this kind. */
function layerOf(owner: number, building: boolean): VisibilityPlayerId {
  return building ? buildingSightKey(owner) : owner;
}

function removeEntitySources(
  visibility: VisibilityMap,
  holder: VisibilityPlayerId,
  entityId: number,
  fromIndex: number,
  toIndex: number,
): void {
  for (let index = fromIndex; index < toIndex; index += 1) {
    visibility.removeSource(holder, visionSourceKey(entityId, index));
  }
}

/** Every source this entity could hold under either of `owner`'s layers. */
function removeFromBothLayers(visibility: VisibilityMap, owner: number, entityId: number): void {
  removeEntitySources(visibility, owner, entityId, 0, MAX_VISION_SOURCES_PER_ENTITY);
  removeEntitySources(visibility, buildingSightKey(owner), entityId, 0, MAX_VISION_SOURCES_PER_ENTITY);
}

const NOT_A_BUILDING = { width: 1, height: 1 } as const;

export function syncVisibilitySources(
  world: GameWorld,
  visibility: VisibilityMap,
  accessor: BridgeStateAccessor,
  fingerprints: Map<number, VisibilitySourceFingerprint>,
  visibilityCell: VisibilityCell,
): void {
  // Phase 2D: trackedSources lives in world.state.aoe2.trackedVisibilitySources
  // via the accessor + codec. Hot-loop pattern — fetch the cached Map once,
  // mutate in place across the function body, mark dirty exactly once at
  // the end if any mutation happened.
  const trackedSources = accessor.get(trackedVisibilitySourcesCodec);
  let trackedSourcesDirty = false;
  const activeSources = new Map<number, number>();
  let dirty = false;

  for (const id of world.query('position', 'visionSource')) {
    const position = world.getComponent<Position>(id, 'position');
    const source = world.getComponent<VisionSourceComponent>(id, 'visionSource');
    if (!position || !source) {
      continue;
    }
    const building = world.getComponent<BuildingComponent>(id, 'building');
    const footprint = building ? buildingFootprint(building.buildingType) : NOT_A_BUILDING;

    activeSources.set(id, source.playerId);
    const prev = fingerprints.get(id);
    if (
      prev !== undefined
      && prev.playerId === source.playerId
      && prev.x === position.x
      && prev.y === position.y
      && prev.radius === source.radius
      && prev.building === (building !== undefined)
      && prev.width === footprint.width
      && prev.height === footprint.height
    ) {
      // No-op: source has the same fingerprint as last tick, so the
      // visibility map already reflects it.
      continue;
    }

    // Off with what the entity held under any other holder. VisibilityMap
    // keys sources by (holder, id), so a new owner or a new layer is a
    // removal under the old holder and a fresh insert under the new one;
    // setSource alone would leave the previous owner permanent sight.
    // Without a fingerprint (the first sync after a load, whose map the save
    // wrote, possibly before an owner change reached a sync) the tracked owner
    // the save carried is all there is, so both of its layers are cleared. A
    // building also clears its owner's unit layer, where a build from before
    // the layers kept its source. A new unit clears nothing more: touching the
    // building layer would throw away that layer's cached state every time a
    // unit is trained.
    const holder = layerOf(source.playerId, building !== undefined);
    if (prev !== undefined) {
      const prevHolder = layerOf(prev.playerId, prev.building);
      if (prevHolder !== holder) removeEntitySources(visibility, prevHolder, id, 0, prev.sourceCount);
    } else {
      const trackedOwner = trackedSources.get(id);
      if (trackedOwner !== undefined && trackedOwner !== source.playerId) {
        removeFromBothLayers(visibility, trackedOwner, id);
      }
      if (building) {
        removeEntitySources(visibility, source.playerId, id, 0, MAX_VISION_SOURCES_PER_ENTITY);
      }
    }

    let sourceCount: number;
    if (building) {
      const placed = footprintVisionSources(position, footprint, source.radius, world.grid);
      placed.cells.forEach((cell, index) => {
        visibility.setSource(holder, visionSourceKey(id, index), {
          x: cell.x,
          y: cell.y,
          radius: placed.radius,
        });
      });
      sourceCount = placed.cells.length;
    } else {
      visibility.setSource(holder, id, {
        x: position.x,
        y: position.y,
        radius: source.radius,
      });
      sourceCount = 1;
    }
    // Drop any source this entity held under this holder past its new count.
    // Without a fingerprint that is every possible one.
    removeEntitySources(
      visibility,
      holder,
      id,
      sourceCount,
      prev !== undefined && layerOf(prev.playerId, prev.building) === holder
        ? prev.sourceCount
        : MAX_VISION_SOURCES_PER_ENTITY,
    );
    fingerprints.set(id, {
      playerId: source.playerId,
      x: position.x,
      y: position.y,
      radius: source.radius,
      building: building !== undefined,
      width: footprint.width,
      height: footprint.height,
      sourceCount,
    });
    dirty = true;
  }

  for (const [id, playerId] of trackedSources.entries()) {
    if (activeSources.has(id)) {
      continue;
    }
    const prev = fingerprints.get(id);
    if (prev !== undefined) {
      removeEntitySources(visibility, layerOf(prev.playerId, prev.building), id, 0, prev.sourceCount);
    } else {
      removeFromBothLayers(visibility, playerId, id);
    }
    trackedSources.delete(id);
    fingerprints.delete(id);
    trackedSourcesDirty = true;
    dirty = true;
  }

  for (const [id, playerId] of activeSources.entries()) {
    if (trackedSources.get(id) !== playerId) {
      trackedSources.set(id, playerId);
      trackedSourcesDirty = true;
    }
  }

  if (trackedSourcesDirty) {
    accessor.markDirty(trackedVisibilitySourcesCodec);
  }

  if (dirty) {
    visibilityCell.markDirty();
  }

  visibility.update();
}
