import {
  OccupancyBinding,
  type EntityId,
  type OccupancyBindingWorldHooks,
  type OccupancyCellClaim,
  type OccupancyCellStatus,
  type Position,
  type SubcellSlotOffset,
} from 'civ-engine';

export interface Footprint {
  width: number;
  height: number;
}

interface OverflowBlockedState {
  positions: Position[];
  claim: OccupancyCellClaim;
}

interface OverflowCrowdedState {
  position: Position;
  claim: OccupancyCellClaim;
}

const UNIT_OCCUPANCY_SLOTS: ReadonlyArray<SubcellSlotOffset> = [
  { x: 0, y: 0 },
  { x: 0.25, y: 0 },
  { x: 0.5, y: 0 },
  { x: 0.75, y: 0 },
  { x: 0, y: 0.25 },
  { x: 0.25, y: 0.25 },
  { x: 0.5, y: 0.25 },
  { x: 0.75, y: 0.25 },
  { x: 0, y: 0.5 },
  { x: 0.25, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.75, y: 0.5 },
  { x: 0, y: 0.75 },
  { x: 0.25, y: 0.75 },
  { x: 0.5, y: 0.75 },
  { x: 0.75, y: 0.75 },
];

function positionKey(x: number, y: number): string {
  return `${x},${y}`;
}

function toFootprintCells(anchor: Position, footprint: Footprint): Position[] {
  const cells: Position[] = [];

  for (let y = anchor.y; y < anchor.y + footprint.height; y += 1) {
    for (let x = anchor.x; x < anchor.x + footprint.width; x += 1) {
      cells.push({ x, y });
    }
  }

  return cells;
}

function removeClaimFromCellMap(
  cellMap: Map<string, OccupancyCellClaim[]>,
  positions: ReadonlyArray<Position>,
  entity: EntityId,
): void {
  for (const position of positions) {
    const key = positionKey(position.x, position.y);
    const existing = cellMap.get(key);
    if (!existing) {
      continue;
    }

    const filtered = existing.filter((claim) => claim.entity !== entity);
    if (filtered.length === 0) {
      cellMap.delete(key);
      continue;
    }

    cellMap.set(key, filtered);
  }
}

function syntheticOutOfBoundsStatus(x: number, y: number): OccupancyCellStatus {
  return {
    position: { x, y },
    blocked: true,
    blockedBy: [{ entity: null, kind: 'bounds', claim: 'blocked' }],
    crowdedBy: [],
    freeSubcellSlots: null,
  };
}

export interface WorldOccupancy {
  attachWorld(world: OccupancyBindingWorldHooks): void;
  reset(): void;
  blockTerrain(cells: ReadonlyArray<Position>): void;
  syncBuilding(entity: EntityId, anchor: Position, footprint: Footprint): void;
  syncResource(entity: EntityId, position: Position): void;
  syncUnit(entity: EntityId, position: Position): void;
  release(entity: EntityId): void;
  getCellStatus(x: number, y: number, ignoredEntityId?: EntityId | null): OccupancyCellStatus;
  isCellBlockedByBuilding(x: number, y: number, ignoredEntityId?: EntityId | null): boolean;
  isCellBlockedByResource(x: number, y: number, ignoredEntityId?: EntityId | null): boolean;
  isCellOccupiedByUnit(x: number, y: number, ignoredEntityId?: EntityId | null): boolean;
  isCellPassableForSpawn(x: number, y: number): boolean;
  isCellPassableForWildlife(resourceId: EntityId, x: number, y: number): boolean;
  isPlacementBlocked(x: number, y: number, width: number, height: number): boolean;
}

export function createWorldOccupancy(worldWidth: number, worldHeight: number): WorldOccupancy {
  let binding = new OccupancyBinding(worldWidth, worldHeight, {
    crowding: {
      slots: UNIT_OCCUPANCY_SLOTS,
    },
  });
  let attachedWorld: OccupancyBindingWorldHooks | null = null;

  const overflowBlockedByCell = new Map<string, OccupancyCellClaim[]>();
  const overflowBlockedByEntity = new Map<EntityId, OverflowBlockedState>();
  const overflowCrowdedByCell = new Map<string, OccupancyCellClaim[]>();
  const overflowCrowdedByEntity = new Map<EntityId, OverflowCrowdedState>();

  const clearOverflowForEntity = (entity: EntityId): void => {
    const blockedState = overflowBlockedByEntity.get(entity);
    if (blockedState) {
      removeClaimFromCellMap(overflowBlockedByCell, blockedState.positions, entity);
      overflowBlockedByEntity.delete(entity);
    }

    const crowdedState = overflowCrowdedByEntity.get(entity);
    if (crowdedState) {
      removeClaimFromCellMap(overflowCrowdedByCell, [crowdedState.position], entity);
      overflowCrowdedByEntity.delete(entity);
    }
  };

  const destroyCallback = (entity: EntityId): void => {
    binding.release(entity);
    clearOverflowForEntity(entity);
  };

  const reattachWorldHooks = (): void => {
    if (!attachedWorld) {
      return;
    }

    binding.attachWorld(attachedWorld);
  };

  const addOverflowBlockedClaim = (
    entity: EntityId,
    positions: Position[],
    kind: 'building' | 'resource',
  ): void => {
    const claim: OccupancyCellClaim = {
      entity,
      kind,
      claim: 'occupied',
    };
    overflowBlockedByEntity.set(entity, {
      positions,
      claim,
    });

    for (const position of positions) {
      const key = positionKey(position.x, position.y);
      const existing = overflowBlockedByCell.get(key) ?? [];
      existing.push(claim);
      overflowBlockedByCell.set(key, existing);
    }
  };

  const addOverflowCrowdedClaim = (entity: EntityId, position: Position): void => {
    const claim: OccupancyCellClaim = {
      entity,
      kind: 'unit',
      claim: 'subcell',
    };
    overflowCrowdedByEntity.set(entity, {
      position,
      claim,
    });

    const key = positionKey(position.x, position.y);
    const existing = overflowCrowdedByCell.get(key) ?? [];
    existing.push(claim);
    overflowCrowdedByCell.set(key, existing);
  };

  const mergeCellStatus = (
    base: OccupancyCellStatus,
    x: number,
    y: number,
    ignoredEntityId?: EntityId | null,
  ): OccupancyCellStatus => {
    const key = positionKey(x, y);
    const overflowBlocked = (overflowBlockedByCell.get(key) ?? [])
      .filter((claim) => ignoredEntityId === null || ignoredEntityId === undefined || claim.entity !== ignoredEntityId);
    const overflowCrowded = (overflowCrowdedByCell.get(key) ?? [])
      .filter((claim) => ignoredEntityId === null || ignoredEntityId === undefined || claim.entity !== ignoredEntityId);

    return {
      position: base.position,
      blocked: base.blocked || overflowBlocked.length > 0,
      blockedBy: [...base.blockedBy, ...overflowBlocked],
      crowdedBy: [...base.crowdedBy, ...overflowCrowded],
      freeSubcellSlots: overflowCrowded.length > 0 ? 0 : base.freeSubcellSlots,
    };
  };

  const hasWholeCellBlocker = (
    status: OccupancyCellStatus,
    kind: 'terrain' | 'building' | 'resource' | 'bounds',
  ): boolean => status.blockedBy.some((claim) => claim.kind === kind);

  return {
    attachWorld(world: OccupancyBindingWorldHooks): void {
      if (attachedWorld === world) {
        return;
      }

      if (attachedWorld) {
        attachedWorld.offDestroy(destroyCallback);
        binding.detachWorld();
      }

      attachedWorld = world;
      attachedWorld.onDestroy(destroyCallback);
      binding.attachWorld(world);
    },

    reset(): void {
      if (attachedWorld) {
        binding.detachWorld();
      }

      binding = new OccupancyBinding(worldWidth, worldHeight, {
        crowding: {
          slots: UNIT_OCCUPANCY_SLOTS,
        },
      });
      overflowBlockedByCell.clear();
      overflowBlockedByEntity.clear();
      overflowCrowdedByCell.clear();
      overflowCrowdedByEntity.clear();
      reattachWorldHooks();
    },

    blockTerrain(cells: ReadonlyArray<Position>): void {
      if (cells.length === 0) {
        return;
      }

      binding.block(cells, {
        metadata: { kind: 'terrain' },
      });
    },

    syncBuilding(entity: EntityId, anchor: Position, footprint: Footprint): void {
      binding.release(entity);
      clearOverflowForEntity(entity);

      const area = {
        x: anchor.x,
        y: anchor.y,
        width: footprint.width,
        height: footprint.height,
      };
      if (!binding.occupy(entity, area, { metadata: { kind: 'building' } })) {
        addOverflowBlockedClaim(entity, toFootprintCells(anchor, footprint), 'building');
      }
    },

    syncResource(entity: EntityId, position: Position): void {
      binding.release(entity);
      clearOverflowForEntity(entity);

      if (!binding.occupy(entity, [position], { metadata: { kind: 'resource' } })) {
        addOverflowBlockedClaim(entity, [position], 'resource');
      }
    },

    syncUnit(entity: EntityId, position: Position): void {
      binding.release(entity);
      clearOverflowForEntity(entity);

      const preferredSlot =
        ((entity % UNIT_OCCUPANCY_SLOTS.length) + UNIT_OCCUPANCY_SLOTS.length)
        % UNIT_OCCUPANCY_SLOTS.length;

      const placement = binding.occupySubcell(entity, position, {
        metadata: { kind: 'unit' },
        preferredSlot,
      });

      if (!placement) {
        addOverflowCrowdedClaim(entity, position);
      }
    },

    release(entity: EntityId): void {
      binding.release(entity);
      clearOverflowForEntity(entity);
    },

    getCellStatus(x: number, y: number, ignoredEntityId?: EntityId | null): OccupancyCellStatus {
      if (x < 0 || x >= worldWidth || y < 0 || y >= worldHeight) {
        return syntheticOutOfBoundsStatus(x, y);
      }

      return mergeCellStatus(
        binding.getCellStatus(
          x,
          y,
          ignoredEntityId === null || ignoredEntityId === undefined
            ? undefined
            : { ignoreEntity: ignoredEntityId },
        ),
        x,
        y,
        ignoredEntityId,
      );
    },

    isCellBlockedByBuilding(x: number, y: number, ignoredEntityId?: EntityId | null): boolean {
      return hasWholeCellBlocker(this.getCellStatus(x, y, ignoredEntityId), 'building');
    },

    isCellBlockedByResource(x: number, y: number, ignoredEntityId?: EntityId | null): boolean {
      return hasWholeCellBlocker(this.getCellStatus(x, y, ignoredEntityId), 'resource');
    },

    isCellOccupiedByUnit(x: number, y: number, ignoredEntityId?: EntityId | null): boolean {
      return this.getCellStatus(x, y, ignoredEntityId).crowdedBy.some((claim) => claim.kind === 'unit');
    },

    isCellPassableForSpawn(x: number, y: number): boolean {
      const status = this.getCellStatus(x, y);
      return !status.blockedBy.some((claim) =>
        claim.kind === 'bounds'
        || claim.kind === 'terrain'
        || claim.kind === 'building'
        || claim.kind === 'resource'
      );
    },

    isCellPassableForWildlife(resourceId: EntityId, x: number, y: number): boolean {
      const status = this.getCellStatus(x, y, resourceId);
      return !status.blockedBy.some((claim) =>
        claim.kind === 'bounds'
        || claim.kind === 'terrain'
        || claim.kind === 'building'
        || claim.kind === 'resource'
      );
    },

    isPlacementBlocked(x: number, y: number, width: number, height: number): boolean {
      for (let cellY = y; cellY < y + height; cellY += 1) {
        for (let cellX = x; cellX < x + width; cellX += 1) {
          const status = this.getCellStatus(cellX, cellY);
          if (
            status.blockedBy.length > 0
            || status.crowdedBy.some((claim) => claim.kind === 'unit')
          ) {
            return true;
          }
        }
      }

      return false;
    },
  };
}
