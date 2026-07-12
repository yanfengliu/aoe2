import {
  VisibilityMap,
  type Position,
  type RenderProjector,
} from 'civ-engine';

import { MAP_HEIGHT, MAP_WIDTH } from '../prototypeScenario';
import { resourceTint } from '../prototypeEconomyRules';
import {
  distanceSquared,
  isFootprintVisible,
  projectUnitTransformCoordinate,
  toCellIndex,
  type GameCommands,
  type GameEvents,
  type GameWorld,
} from './pureHelpers';
import type {
  BuildingComponent,
  ProjectedEntityView,
  ProjectedFrameView,
  ProjectedUnitDeathView,
  RenderableComponent,
  ResourceComponent,
  TerrainComponent,
  UnitComponent,
  UnitTransformComponent,
  VisionSourceComponent,
} from '../types';
import { trackedVisibilitySourcesCodec } from './bridgeStateSerialize';

export const SHEEP_VISION_RADIUS = 4;
export const MAX_HERDABLE_CLAIM_RADIUS = 6;

// How many ticks a unit death stays on the projected frame's death feed
// (v0.1.129 death feedback). Long enough that the render layer cannot miss it
// across a snapshot rebuild, short enough that a loaded/scrubbed world does
// not replay stale corpses.
export const DEATH_FEED_TICKS = 10;

// Pure fog/age filter for the death feed: a death is surfaced to a player
// only while it is fresh (within DEATH_FEED_TICKS of the current tick) AND
// that player WITNESSED it — i.e. could see the cell at the moment of death,
// captured in `witnessedBy` when the death was recorded. Gating on at-death
// visibility (not current visibility) is what makes the cue fog-correct in
// both directions: a kill in your fog never leaks when you later uncover the
// cell, and your own lone unit's death still shows even though losing it
// re-fogs the cell that same tick.
export function visibleUnitDeaths(
  deaths: readonly ProjectedUnitDeathView[],
  currentTick: number,
  playerId: number,
): ProjectedUnitDeathView[] {
  return deaths.filter((death) =>
    currentTick - death.tick <= DEATH_FEED_TICKS
    && death.witnessedBy.includes(playerId));
}

export function createProjector(
  visibility: VisibilityMap,
  playerId: number,
  seed: string,
  isSelected: (id: number) => boolean,
  getEntityHealth: (id: number) => { currentHp: number; maxHp: number } | null,
  getRecentUnitDeaths: () => readonly ProjectedUnitDeathView[],
): RenderProjector<
  GameEvents,
  GameCommands,
  ProjectedEntityView,
  ProjectedFrameView
> {
  return {
    projectEntity(ref, world) {
      const position = world.getComponent<Position>(ref.id, 'position');
      const renderable = world.getComponent<RenderableComponent>(ref.id, 'renderable');
      const unitTransform = world.getComponent<UnitTransformComponent>(ref.id, 'unitTransform');
      if (!position || !renderable) {
        return null;
      }

      const terrain = world.getComponent<TerrainComponent>(ref.id, 'terrain');
      const unit = world.getComponent<UnitComponent>(ref.id, 'unit');
      const building = world.getComponent<BuildingComponent>(ref.id, 'building');
      const resource = world.getComponent<ResourceComponent>(ref.id, 'resource');
      const health = getEntityHealth(ref.id);

      let owner: number | null = null;
      let entityType: ProjectedEntityView['entityType'] = 'grass';

      if (terrain) {
        entityType = terrain.kind;
      }
      if (unit) {
        owner = unit.owner;
        entityType = unit.unitType;
      }
      if (building) {
        owner = building.owner;
        entityType = building.buildingType;
      }
      // M1 Farms: a farm is a resource + building hybrid. Keep the BUILDING
      // owner + buildingType for it (a farm projects as an owned building) so
      // the owner's own-entity LOS bypass (`owner === playerId`) treats it as
      // owned and it stays live-rendered out of LOS instead of being fogged.
      // A pure resource has no building component and is unchanged.
      if (resource && !building) {
        owner = resource.owner;
        entityType = resource.resourceType;
      }

      if (
        renderable.kind !== 'tile' &&
        owner !== playerId &&
        !isFootprintVisible(
          visibility,
          playerId,
          position.x,
          position.y,
          renderable.footprintWidth,
          renderable.footprintHeight,
        )
      ) {
        return null;
      }

      return {
        id: ref.id,
        // Carry the ref generation so the render layer can disambiguate a
        // recycled id (unit destroyed → new unit reuses the id, bumped gen).
        generation: ref.generation,
        kind: renderable.kind,
        layer: renderable.layer,
        entityType,
        owner,
        x: unitTransform
          ? projectUnitTransformCoordinate(unitTransform.fineX)
          : position.x,
        y: unitTransform
          ? projectUnitTransformCoordinate(unitTransform.fineY)
          : position.y,
        elevation: terrain?.elevation ?? 0,
        tint: renderable.tint,
        size: renderable.size,
        footprintWidth: renderable.footprintWidth,
        footprintHeight: renderable.footprintHeight,
        visualVariant: renderable.visualVariant,
        selected: isSelected(ref.id),
        currentHp: health?.currentHp ?? null,
        maxHp: health?.maxHp ?? null,
        isMemory: false,
      };
    },
    projectFrame(world) {
      return {
        tick: world.tick,
        playerId,
        seed,
        mapWidth: MAP_WIDTH,
        mapHeight: MAP_HEIGHT,
        visibleCells: visibility
          .getVisibleCells(playerId)
          .map((cell) => toCellIndex(cell.x, cell.y)),
        exploredCells: visibility
          .getExploredCells(playerId)
          .map((cell) => toCellIndex(cell.x, cell.y)),
        recentUnitDeaths: visibleUnitDeaths(
          getRecentUnitDeaths(),
          world.tick,
          playerId,
        ),
      };
    },
  };
}

// Per-source fingerprint — captures the (playerId, x, y, radius) we last wrote
// to the visibility map for a given vision-source entity. Used by
// syncVisibilitySources to skip the no-op setSource/markDirty path when
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
  x: number;
  y: number;
  radius: number;
}

export function syncVisibilitySources(
  world: GameWorld,
  visibility: VisibilityMap,
  accessor: import('./bridgeStateAccessor').BridgeStateAccessor,
  fingerprints: Map<number, VisibilitySourceFingerprint>,
  visibilityCell: import('./visibilityCell').VisibilityCell,
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

    activeSources.set(id, source.playerId);
    const prev = fingerprints.get(id);
    if (
      prev !== undefined
      && prev.playerId === source.playerId
      && prev.x === position.x
      && prev.y === position.y
      && prev.radius === source.radius
    ) {
      // No-op: source has the same fingerprint as last tick, so the
      // visibility map already reflects it.
      continue;
    }

    // Owner-flip path: VisibilityMap stores sources per (playerId, id), so
    // a playerId change is logically a removal under the old key + a fresh
    // insert under the new key. setSource alone would leak the old entry
    // and leave the previous owner with permanent vision of the unit.
    if (prev !== undefined && prev.playerId !== source.playerId) {
      visibility.removeSource(prev.playerId, id);
    }

    visibility.setSource(source.playerId, id, {
      x: position.x,
      y: position.y,
      radius: source.radius,
    });
    fingerprints.set(id, {
      playerId: source.playerId,
      x: position.x,
      y: position.y,
      radius: source.radius,
    });
    dirty = true;
  }

  for (const [id, playerId] of trackedSources.entries()) {
    if (activeSources.has(id)) {
      continue;
    }
    visibility.removeSource(playerId, id);
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

export function resolveSheepClaimOwner(
  activeWorld: GameWorld,
  sheepPosition: Position,
): number | null {
  let claimedOwner: number | null = null;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  let bestUnitId = Number.POSITIVE_INFINITY;

  for (const unitId of activeWorld.queryInRadius(
    sheepPosition.x,
    sheepPosition.y,
    MAX_HERDABLE_CLAIM_RADIUS,
    'unit',
    'visionSource',
  )) {
    const unitPosition = activeWorld.getComponent(unitId, 'position');
    const unit = activeWorld.getComponent(unitId, 'unit');
    const visionSource = activeWorld.getComponent(unitId, 'visionSource');
    if (!unitPosition || !unit || !visionSource) {
      continue;
    }

    const claimDistanceSquared = distanceSquared(unitPosition, sheepPosition);
    if (claimDistanceSquared > visionSource.radius * visionSource.radius) {
      continue;
    }

    if (
      claimDistanceSquared < bestDistanceSquared
      || (
        claimDistanceSquared === bestDistanceSquared
        && (
          unit.owner < (claimedOwner ?? Number.POSITIVE_INFINITY)
          || (unit.owner === claimedOwner && unitId < bestUnitId)
        )
      )
    ) {
      claimedOwner = unit.owner;
      bestDistanceSquared = claimDistanceSquared;
      bestUnitId = unitId;
    }
  }

  return claimedOwner;
}

export function syncSheepVisionSource(
  activeWorld: GameWorld,
  sheepId: number,
  owner: number | null,
): boolean {
  const sheepVisionSource = activeWorld.getComponent(sheepId, 'visionSource');
  if (owner === null) {
    if (!sheepVisionSource) {
      return false;
    }
    activeWorld.removeComponent(sheepId, 'visionSource');
    return true;
  }

  if (!sheepVisionSource) {
    activeWorld.addComponent(sheepId, 'visionSource', {
      playerId: owner,
      radius: SHEEP_VISION_RADIUS,
    });
    return true;
  }

  if (
    sheepVisionSource.playerId === owner
    && sheepVisionSource.radius === SHEEP_VISION_RADIUS
  ) {
    return false;
  }

  sheepVisionSource.playerId = owner;
  sheepVisionSource.radius = SHEEP_VISION_RADIUS;
  return true;
}

export function updateSheepOwnership(activeWorld: GameWorld): boolean {
  let didChange = false;

  for (const sheepId of activeWorld.query('position', 'resource', 'renderable')) {
    const sheepPosition = activeWorld.getComponent(sheepId, 'position');
    const resource = activeWorld.getComponent(sheepId, 'resource');
    const renderable = activeWorld.getComponent(sheepId, 'renderable');
    if (
      !sheepPosition
      || !resource
      || !renderable
      || resource.resourceType !== 'sheep'
      || resource.amount <= 0
    ) {
      continue;
    }

    if (resource.owner === null) {
      const claimedOwner = resolveSheepClaimOwner(activeWorld, sheepPosition);

      if (resource.owner !== claimedOwner) {
        resource.owner = claimedOwner;
        renderable.tint = resourceTint(resource.resourceType, claimedOwner);
        didChange = true;
      }
    }

    if (syncSheepVisionSource(activeWorld, sheepId, resource.owner)) {
      didChange = true;
    }
  }

  return didChange;
}
