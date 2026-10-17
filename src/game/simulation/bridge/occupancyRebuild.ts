// The load-time occupancy rebuild: a fresh or loaded world, and a replay world,
// derive every claim from the world itself (moved out of transformOps.ts for
// the 500-line budget in work 128; the body is unchanged). Terrain first, then
// buildings, then resources, then units, so a unit's saved slot is restored
// against the structures already standing. A carried relic claims nothing
// (transformOps' resource branch, through `syncOccupancyForEntity`), so a
// loaded world holds no claim for one either.

import type { Position, SubcellSlotOffset } from 'civ-engine';
import type { WorldOccupancy } from '../worldOccupancy';
import type { TerrainComponent, UnitTransformComponent } from '../types';
import { UNIT_SUBGRID_RESOLUTION, type GameWorld } from './pureHelpers';

export interface OccupancyRebuildDeps {
  world: GameWorld;
  mapWidth: number;
  mapHeight: number;
  worldOccupancy: WorldOccupancy;
  tiles: number[][];
  getUnitTransform: (id: number) => UnitTransformComponent | null;
  syncOccupancyForEntity: (entity: number, activeWorld?: GameWorld, preferredUnitOffset?: SubcellSlotOffset) => void;
}

export function rebuildWorldOccupancy(deps: OccupancyRebuildDeps): void {
  const { world, mapWidth, mapHeight, worldOccupancy, tiles, getUnitTransform, syncOccupancyForEntity } = deps;
  worldOccupancy.reset();

  const blockedTerrainCells: Position[] = [];
  for (let y = 0; y < mapHeight; y += 1) {
    for (let x = 0; x < mapWidth; x += 1) {
      const tile = tiles[y]?.[x];
      const terrain = tile === undefined ? null : world.getComponent<TerrainComponent>(tile, 'terrain');
      if (!terrain || (terrain.kind !== 'water' && terrain.kind !== 'forest')) {
        continue;
      }
      blockedTerrainCells.push({ x, y });
    }
  }
  worldOccupancy.blockTerrain(blockedTerrainCells);

  for (const entity of world.query('position', 'building')) {
    syncOccupancyForEntity(entity);
  }
  for (const entity of world.query('position', 'resource')) {
    syncOccupancyForEntity(entity);
  }
  const unitEntities = [...world.query('position', 'unit')];
  const savedSlotFor = (entity: number): SubcellSlotOffset | null => {
    const position = world.getComponent<Position>(entity, 'position');
    const transform = getUnitTransform(entity);
    const hasSavedSlot = transform
      && Number.isFinite(transform.occupancySlotX)
      && Number.isFinite(transform.occupancySlotY);
    return position && hasSavedSlot
      ? { x: transform.occupancySlotX!, y: transform.occupancySlotY! }
      : null;
  };

  // Restore every authoritative numeric assignment before legacy or
  // explicit-overflow units. Otherwise entity-id query order can promote a
  // low-id overflow unit and displace a peer that owned the slot at save.
  for (const entity of unitEntities) {
    const savedSlot = savedSlotFor(entity);
    if (savedSlot) syncOccupancyForEntity(entity, world, savedSlot);
  }
  for (const entity of unitEntities) {
    const position = world.getComponent<Position>(entity, 'position');
    const transform = getUnitTransform(entity);
    if (savedSlotFor(entity) || transform?.occupancySlotOverflow === true) continue;
    const legacyOffset = position && transform
      ? {
          x: transform.fineX / UNIT_SUBGRID_RESOLUTION - position.x,
          y: transform.fineY / UNIT_SUBGRID_RESOLUTION - position.y,
        }
      : undefined;

    // Current saves persist the assigned slot separately because a moving
    // fine root may not have reached it yet. Legacy schema-v2 saves lack
    // that additive datum, so use their serialized root as the closest safe
    // one-time preference. Rebuild never snaps fineX/fineY: live loads and
    // replay materialization both preserve the serialized presentation root.
    syncOccupancyForEntity(entity, world, legacyOffset);
  }
  for (const entity of unitEntities) {
    const transform = getUnitTransform(entity);
    if (transform?.occupancySlotOverflow === true) {
      const position = world.getComponent<Position>(entity, 'position');
      if (position) {
        // Recreate the authoritative no-slot claim exactly. Normal sync is
        // intentionally not used: a peer may have freed a slot after this
        // unit overflowed, but load/replay cannot promote it earlier than
        // uninterrupted play would.
        worldOccupancy.syncUnit(entity, position, undefined, true);
      }
    }
  }
}
