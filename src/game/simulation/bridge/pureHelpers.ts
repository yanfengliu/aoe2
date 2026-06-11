import {
  World,
  type EntityRef,
  type Position,
} from 'civ-engine';

import { getBuildingFootprint } from '../../content/buildingFootprints';
import {
  HUMAN_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WIDTH,
} from '../prototypeScenario';
import type {
  BuildingComponent,
  BuildingType,
  EconomyResourceKind,
  GathererComponent,
  PlayerResources,
  ProductionQueueEntry,
  ProjectedEntityView,
  RenderableComponent,
  ResourceComponent,
  ResourceKind,
  TerrainComponent,
  UnitComponent,
  UnitTransformComponent,
  UnitTaskState,
  VelocityComponent,
  VisionSourceComponent,
  WanderBoundsComponent,
} from '../types';

// Shared bridge-level type aliases. Mirrors the `GameEvents` / `GameCommands` /
// `GameComponents` triple declared inline in `createSimulationBridge.ts`, but
// lifted here so helper modules under `bridge/` can speak the same type
// language without a circular import back into the bridge entry point.
export type GameEvents = Record<string, never>;
// GameCommands is the civ-engine command surface (15 types per DESIGN v17 §6.1).
// Imported here so World<...> wrappers below carry the right command map.
import type { GameCommands } from '../commands';
export type { GameCommands };
export type GameComponents = {
  position: Position;
  terrain: TerrainComponent;
  renderable: RenderableComponent;
  unit: UnitComponent;
  unitTransform: UnitTransformComponent;
  building: BuildingComponent;
  resource: ResourceComponent;
  gatherer: GathererComponent;
  velocity: VelocityComponent;
  visionSource: VisionSourceComponent;
  wanderBounds: WanderBoundsComponent;
};
export type GameWorld = World<GameEvents, GameCommands, GameComponents>;

// civ-engine 0.8.15's World layer-chain split made TComponents
// effectively invariant, so GameWorld no longer interchanges with the
// default-generic `World<TEvents, TCommands>` that SessionRecorder /
// SessionReplayer signatures hardcode (no TComponents parameter —
// engine-feedback item, 2026-06-09). These two helpers are the single
// sanctioned seam; the runtime object is identical either way.
export type EngineDefaultWorld = World<GameEvents, GameCommands>;
export function toEngineWorld(world: GameWorld): EngineDefaultWorld {
  return world as unknown as EngineDefaultWorld;
}
export function fromEngineWorld(world: EngineDefaultWorld): GameWorld {
  return world as unknown as GameWorld;
}

export type MarketCommodity = Exclude<EconomyResourceKind, 'gold'>;

export const MARKET_BASE_RATE = 100;
export const UNIT_SUBGRID_RESOLUTION = 4;
export const UNIT_SUBGRID_STEP_PER_TICK = 2;
export const UNIT_CELL_SLOT_OFFSETS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: 0 },
  { x: 0.5, y: 0 },
  { x: 0, y: 0.5 },
  { x: 0.5, y: 0.5 },
];

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Slice 9: load-path helper. Reverse of `createTileGrid` for a
// deserialized world — instead of creating fresh tile entities and
// addComponent'ing them, walk every entity that already has both
// `position` and `terrain`, and drop its id into the [y][x] grid. Used
// by `isTerrainPassableForUnit` and other helpers that index `tiles[y][x]`
// for fast terrain lookups.
export function rebuildTileGridFromWorld(world: GameWorld): number[][] {
  const grid: number[][] = [];
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    grid.push(new Array<number>(MAP_WIDTH).fill(-1));
  }
  for (const id of world.query('position', 'terrain')) {
    const position = world.getComponent<Position>(id, 'position');
    if (!position) continue;
    if (position.x < 0 || position.x >= MAP_WIDTH || position.y < 0 || position.y >= MAP_HEIGHT) {
      continue;
    }
    grid[position.y][position.x] = id;
  }
  return grid;
}

export function toCellIndex(x: number, y: number): number {
  return y * MAP_WIDTH + x;
}

export function isSameEntity(
  ref: EntityRef | null,
  id: number,
  world: GameWorld,
): boolean {
  return ref !== null && world.isCurrent(ref) && ref.id === id;
}

export function currentEntityId(
  world: GameWorld,
  ref: EntityRef | null | undefined,
): number | null {
  return ref && world.isCurrent(ref) ? ref.id : null;
}

export function cloneResources(resources: PlayerResources): PlayerResources {
  return {
    food: resources.food,
    wood: resources.wood,
    gold: resources.gold,
    stone: resources.stone,
  };
}

export function defaultCivilizationName(owner: number): string {
  if (owner === HUMAN_PLAYER_ID) {
    return 'Britons';
  }

  if (owner === 2) {
    return 'Franks';
  }

  return `Player ${owner}`;
}

export function factionName(owner: number | null): string | null {
  if (owner === null) {
    return 'Gaia';
  }

  return owner === HUMAN_PLAYER_ID ? 'Player' : 'Enemy';
}

export function inventoryResourceName(resourceType: ResourceKind): string {
  switch (resourceType) {
    case 'tree':
      return 'wood';
    case 'gold-mine':
      return 'gold';
    case 'stone-mine':
      return 'stone';
    case 'berry-bush':
    case 'boar':
    case 'fish':
    case 'sheep':
    case 'wolf':
      return 'food';
    // Relics are not harvestable — they carry no inventory amount. This
    // branch should never fire because getSelectionInventory is only called
    // for resource entities with an amount, but the exhaustive switch needs
    // to cover every ResourceKind.
    case 'relic':
      return 'relic';
  }
}

export function economyResourceLabel(resource: EconomyResourceKind): string {
  switch (resource) {
    case 'food':
      return 'Food';
    case 'wood':
      return 'Wood';
    case 'gold':
      return 'Gold';
    case 'stone':
      return 'Stone';
  }
}

export function createInitialMarketRates(): Record<MarketCommodity, number> {
  return {
    food: MARKET_BASE_RATE,
    wood: MARKET_BASE_RATE,
    stone: MARKET_BASE_RATE,
  };
}

export function isAtTarget(current: Position, target: Position): boolean {
  return current.x === target.x && current.y === target.y;
}

export function clonePosition(position: Position): Position {
  return {
    x: position.x,
    y: position.y,
  };
}

export function getUnitCellSlotOffset(unitId: number): { x: number; y: number } {
  const normalizedIndex =
    ((unitId % UNIT_CELL_SLOT_OFFSETS.length) + UNIT_CELL_SLOT_OFFSETS.length)
    % UNIT_CELL_SLOT_OFFSETS.length;
  return UNIT_CELL_SLOT_OFFSETS[normalizedIndex] ?? UNIT_CELL_SLOT_OFFSETS[0]!;
}

// Spec §12.6: prefer the explicit slotOffset (provided by worldOccupancy's
// engine-allocated slot) when computing where a unit's sprite should land.
// Falling back to the unitId-derived offset is only safe for code paths that
// have no occupancy context (early bootstrap, fixtures); callers with a live
// world should always pass the allocated slot so visual non-overlap holds.
export function getUnitTargetTransformForCell(
  unitId: number,
  position: Position,
  slotOffset?: { x: number; y: number } | null,
): UnitTransformComponent {
  const offset = slotOffset ?? getUnitCellSlotOffset(unitId);
  return {
    fineX: (position.x + offset.x) * UNIT_SUBGRID_RESOLUTION,
    fineY: (position.y + offset.y) * UNIT_SUBGRID_RESOLUTION,
  };
}

export function projectUnitTransformCoordinate(fineCoordinate: number): number {
  return fineCoordinate / UNIT_SUBGRID_RESOLUTION;
}

export function clampUnitTransformToMap(transform: UnitTransformComponent): UnitTransformComponent {
  return {
    fineX: clamp(transform.fineX, 0, MAP_WIDTH * UNIT_SUBGRID_RESOLUTION - 1),
    fineY: clamp(transform.fineY, 0, MAP_HEIGHT * UNIT_SUBGRID_RESOLUTION - 1),
  };
}

export function gridPositionFromUnitTransform(transform: UnitTransformComponent): Position {
  return {
    x: clamp(Math.floor(transform.fineX / UNIT_SUBGRID_RESOLUTION), 0, MAP_WIDTH - 1),
    y: clamp(Math.floor(transform.fineY / UNIT_SUBGRID_RESOLUTION), 0, MAP_HEIGHT - 1),
  };
}

export function isUnitTransformAtTarget(
  transform: UnitTransformComponent,
  unitId: number,
  target: Position,
  slotOffset?: { x: number; y: number } | null,
): boolean {
  const targetTransform = getUnitTargetTransformForCell(unitId, target, slotOffset);
  return (
    transform.fineX === targetTransform.fineX
    && transform.fineY === targetTransform.fineY
  );
}

export function stepUnitTransformToward(
  transform: UnitTransformComponent,
  targetTransform: UnitTransformComponent,
  stepUnits: number = UNIT_SUBGRID_STEP_PER_TICK,
): UnitTransformComponent {
  const targetFineX = targetTransform.fineX;
  const targetFineY = targetTransform.fineY;

  if (transform.fineX !== targetFineX) {
    return {
      fineX:
        transform.fineX
        + Math.sign(targetFineX - transform.fineX)
          * Math.min(Math.abs(targetFineX - transform.fineX), stepUnits),
      fineY: transform.fineY,
    };
  }

  if (transform.fineY !== targetFineY) {
    return {
      fineX: transform.fineX,
      fineY:
        transform.fineY
        + Math.sign(targetFineY - transform.fineY)
          * Math.min(Math.abs(targetFineY - transform.fineY), stepUnits),
    };
  }

  return transform;
}

export function assignVillagerRole(owner: number, ordinal: number): EconomyResourceKind {
  if (ordinal === 0 || ordinal === 1) {
    return 'food';
  }
  if (ordinal === 2) {
    return 'wood';
  }
  if (ordinal === 3) {
    return 'gold';
  }
  return owner === HUMAN_PLAYER_ID ? 'food' : 'wood';
}

export function shouldMaintainGatheringOrder(
  owner: number,
  gatherer: GathererComponent,
): boolean {
  return owner !== HUMAN_PLAYER_ID || gatherer.hasExplicitGatherOrder;
}

export function isResourceCandidate(
  entry: {
    id: number;
    position: Position | undefined;
    resource: ResourceComponent | undefined;
  },
): entry is {
  id: number;
  position: Position;
  resource: ResourceComponent;
} {
  return Boolean(entry.position && entry.resource);
}

export function isEconomyVillager(
  entry: {
    owner: number;
    task: UnitTaskState;
    desiredResource: GathererComponent['desiredResource'];
    carriedResource: GathererComponent['carriedResource'];
    carriedAmount: number;
  } | null,
): entry is {
  owner: number;
  task: UnitTaskState;
  desiredResource: GathererComponent['desiredResource'];
  carriedResource: GathererComponent['carriedResource'];
  carriedAmount: number;
} {
  return entry !== null;
}

export function isEconomyResourceEntry(
  entry: {
    id: number;
    resourceType: ResourceKind;
    amount: number;
    maxAmount: number;
    owner: number | null;
    baseOwner: number | null;
    x: number;
    y: number;
  } | null,
): entry is {
  id: number;
  resourceType: ResourceKind;
  amount: number;
  maxAmount: number;
  owner: number | null;
  baseOwner: number | null;
  x: number;
  y: number;
} {
  return entry !== null;
}

export function cloneQueue(queue: ProductionQueueEntry[]): ProductionQueueEntry[] {
  return queue.map((entry) => ({ ...entry }));
}

export function manhattanDistance(left: Position, right: Position): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

// FU3: Manhattan distance from a building's nearest footprint cell to a
// target. For a 1x1 building this reduces to the anchor-to-target
// distance. For a 4x4 building anchored at top-left, a target to the
// south-east measures distance from the south-east footprint cell, not
// from the anchor — so the stated attack range hits evenly around the
// whole footprint instead of asymmetrically shrinking on the anchor's
// far side.
export function distanceFromBuildingFootprint(
  anchor: Position,
  footprint: { width: number; height: number },
  target: Position,
): number {
  const minX = anchor.x;
  const maxX = anchor.x + footprint.width - 1;
  const minY = anchor.y;
  const maxY = anchor.y + footprint.height - 1;
  const dx =
    target.x < minX ? minX - target.x
    : target.x > maxX ? target.x - maxX
    : 0;
  const dy =
    target.y < minY ? minY - target.y
    : target.y > maxY ? target.y - maxY
    : 0;
  return dx + dy;
}

export function distanceSquared(left: Position, right: Position): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

export function buildingFootprint(buildingType: BuildingType): { width: number; height: number } {
  return getBuildingFootprint(buildingType);
}

// Structural visibility query — only `isVisible` is needed here. The
// authoritative VisibilityMap satisfies this; so do the lighter
// `VisibilityQuery` mocks in targetFindingOps + tests.
interface IsVisibleQuery {
  isVisible: (playerId: number, x: number, y: number) => boolean;
}

interface IsExploredQuery {
  isExplored: (playerId: number, x: number, y: number) => boolean;
}

export function isFootprintVisible(
  visibility: IsVisibleQuery,
  playerId: number,
  anchorX: number,
  anchorY: number,
  footprintWidth: number,
  footprintHeight: number,
): boolean {
  const flooredX = Math.floor(anchorX);
  const flooredY = Math.floor(anchorY);
  for (let offsetY = 0; offsetY < footprintHeight; offsetY += 1) {
    for (let offsetX = 0; offsetX < footprintWidth; offsetX += 1) {
      if (visibility.isVisible(playerId, flooredX + offsetX, flooredY + offsetY)) {
        return true;
      }
    }
  }
  return false;
}

// Iter-3 V3-1 sibling helper: any-cell explored variant of
// isFootprintVisible. Fog-memory projection needs to surface memory
// entries whose footprint touches an explored cell, not just where the
// stored anchor cell is explored.
export function isFootprintExplored(
  visibility: IsExploredQuery,
  playerId: number,
  anchorX: number,
  anchorY: number,
  footprintWidth: number,
  footprintHeight: number,
): boolean {
  const flooredX = Math.floor(anchorX);
  const flooredY = Math.floor(anchorY);
  for (let offsetY = 0; offsetY < footprintHeight; offsetY += 1) {
    for (let offsetX = 0; offsetX < footprintWidth; offsetX += 1) {
      if (visibility.isExplored(playerId, flooredX + offsetX, flooredY + offsetY)) {
        return true;
      }
    }
  }
  return false;
}

const PROJECTED_LAYER_ORDER: Record<ProjectedEntityView['layer'], number> = {
  terrain: 0,
  resource: 1,
  building: 2,
  unit: 3,
};

// Stable comparator for the projected render entity list: layer first (so units
// always draw on top of buildings on top of resources on top of terrain), then
// y (row) so southern entities draw later, then x (column) for determinism.
// Hoisted to top level so the per-frame `getRenderState` sort doesn't allocate
// a fresh closure each call.
export function compareProjectedRenderEntities(
  left: ProjectedEntityView,
  right: ProjectedEntityView,
): number {
  const layerDelta = PROJECTED_LAYER_ORDER[left.layer] - PROJECTED_LAYER_ORDER[right.layer];
  if (layerDelta !== 0) {
    return layerDelta;
  }
  if (left.y !== right.y) {
    return left.y - right.y;
  }
  return left.x - right.x;
}
