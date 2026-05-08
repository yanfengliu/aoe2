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

// Spec §12.6 contract: every syncUnit call returns the cell the unit was
// actually placed in (may differ from the requested position when overflow
// fallback engages) plus the visual slot offset assigned by the engine's
// SubcellOccupancyGrid. `slotOffset === null` means no slot was available
// even after neighbor-tile fallback — the last-resort overflow path was used
// and the renderer should expect visual stacking for this entity.
export interface SyncUnitResult {
  placedAt: Position;
  slotOffset: SubcellSlotOffset | null;
}

export interface WorldOccupancy {
  attachWorld(world: OccupancyBindingWorldHooks): void;
  reset(): void;
  blockTerrain(cells: ReadonlyArray<Position>): void;
  syncBuilding(entity: EntityId, anchor: Position, footprint: Footprint): void;
  syncResource(entity: EntityId, position: Position): void;
  syncUnit(entity: EntityId, position: Position): SyncUnitResult;
  // Spec §12.6 fallback path: when a fresh unit is being placed (spawn,
  // train completion, ungarrison) and the requested cell is fully packed,
  // the simulation must redirect to the nearest neighbor tile that has a
  // free slot rather than visually stacking. Caller uses the returned
  // `placedAt` as the unit's actual world position. This is intentionally
  // separate from `syncUnit` because in-flight movement can NOT auto-redirect
  // without oscillating against a sticky move target.
  placeUnitForSpawn(entity: EntityId, requestedPosition: Position): SyncUnitResult;
  // Spec §12.7 lazy redirect: returns the closest cell to `requestedPosition`
  // that has a free unit slot. Used by the move-command arrival handler to
  // rewrite a unit's target when the requested cell is fully packed. Returns
  // `requestedPosition` if it already has space (the entity itself is treated
  // as non-blocking — a unit in overflow at the requested cell can re-claim
  // the cell once another occupant leaves). Returns `null` when no candidate
  // is found within the search neighborhood (currently the 8 immediate
  // neighbors plus the requested cell). Spec allows extending to a wider
  // BFS radius; the immediate-neighbor implementation is the first iteration.
  findNearestFreeUnitCell(entity: EntityId, requestedPosition: Position): Position | null;
  release(entity: EntityId): void;
  getUnitSlotOffset(entity: EntityId): SubcellSlotOffset | null;
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

  // Spec §12.6: per-unit slot offset assigned by occupySubcell. The renderer
  // reads this via getUnitSlotOffset(entity) so visual position matches the
  // logical slot the engine allocated, instead of a unitId-derived hash that
  // collides for any two units in the same cell with the same id-modulo.
  const unitSlotOffsets = new Map<EntityId, SubcellSlotOffset>();

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
    unitSlotOffsets.delete(entity);
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
      unitSlotOffsets.clear();
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

    syncUnit(entity: EntityId, position: Position): SyncUnitResult {
      binding.release(entity);
      clearOverflowForEntity(entity);
      unitSlotOffsets.delete(entity);

      const preferredSlot =
        ((entity % UNIT_OCCUPANCY_SLOTS.length) + UNIT_OCCUPANCY_SLOTS.length)
        % UNIT_OCCUPANCY_SLOTS.length;

      // Spec §12.6: the engine's SubcellOccupancyGrid hands back a
      // placement.offset that the renderer can use directly — no two units
      // ever get the same offset in the same cell because slots are
      // pre-allocated and uniquely consumed. This is what makes visual
      // non-overlap hold for the common case (≤16 units per cell).
      const placement = binding.occupySubcell(entity, position, {
        metadata: { kind: 'unit' },
        preferredSlot,
      });

      if (placement) {
        unitSlotOffsets.set(entity, placement.offset);
        return { placedAt: placement.position, slotOffset: placement.offset };
      }

      // Overflow: the cell is fully packed (16+ units). Spec §12.6 says
      // such cases should fall back to a neighbor tile, but doing the
      // relocation here would oscillate any moving unit whose target tile
      // stays full (movement re-aims at the original target, syncUnit
      // redirects again, every cell crossing). The fall-back belongs in
      // the movement / placement layer where the target itself can be
      // updated. For now, accept overflow stacking and surface a null
      // slotOffset so the renderer can flag the violation in dev tools.
      addOverflowCrowdedClaim(entity, position);
      return { placedAt: position, slotOffset: null };
    },

    placeUnitForSpawn(entity: EntityId, requestedPosition: Position): SyncUnitResult {
      const initial = this.syncUnit(entity, requestedPosition);
      if (initial.slotOffset !== null) {
        return initial;
      }

      // Original cell was full — search neighbors via the engine's
      // closest-first ordering. Spec §12.6 says the simulation must place
      // the unit at the nearest neighbor with a free slot.
      const neighbors = binding.neighborsWithSpace(entity, requestedPosition, {
        metadata: { kind: 'unit' },
      });
      for (const neighbor of neighbors) {
        const result = this.syncUnit(entity, neighbor.position);
        if (result.slotOffset !== null) {
          return result;
        }
      }

      // Every neighbor in the engine's default 8-cell window is also full.
      // Re-sync at the original position so the overflow tracking
      // (`addOverflowCrowdedClaim`) reflects the unit's actual whereabouts.
      // Visual overlap is accepted as the last-resort behavior.
      return this.syncUnit(entity, requestedPosition);
    },

    findNearestFreeUnitCell(entity: EntityId, requestedPosition: Position): Position | null {
      // Out-of-bounds requests are never satisfiable.
      if (
        requestedPosition.x < 0
        || requestedPosition.x >= worldWidth
        || requestedPosition.y < 0
        || requestedPosition.y >= worldHeight
      ) {
        return null;
      }

      // Try the requested cell first. canOccupySubcell ignores the entity
      // itself, so a unit currently in overflow at this cell can still see
      // the cell as free if another unit just left.
      if (binding.canOccupySubcell(entity, requestedPosition, { metadata: { kind: 'unit' } })) {
        return requestedPosition;
      }

      // Fall back to the engine's closest-first neighbor enumeration over
      // the default 8-cell window. Future iterations may extend to a wider
      // BFS per spec §12.7's default radius of 16 cells.
      const neighbors = binding.neighborsWithSpace(entity, requestedPosition, {
        metadata: { kind: 'unit' },
      });
      return neighbors[0]?.position ?? null;
    },

    release(entity: EntityId): void {
      binding.release(entity);
      clearOverflowForEntity(entity);
      unitSlotOffsets.delete(entity);
    },

    getUnitSlotOffset(entity: EntityId): SubcellSlotOffset | null {
      return unitSlotOffsets.get(entity) ?? null;
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
