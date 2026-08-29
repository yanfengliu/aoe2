import {
  OccupancyBinding,
  type EntityId,
  type OccupancyBindingWorldHooks,
  type OccupancyCellClaim,
  type OccupancyCellStatus,
  type Position,
  type SubcellSlotOffset,
} from 'civ-engine';
import {
  allocateGroupMoveTargets as allocateGroupMoveTargetsImpl,
  findNearestFreeUnitCellInSpiral,
} from './worldOccupancyAllocators';
import {
  positionKey,
  removeClaimFromCellMap,
  syntheticOutOfBoundsStatus,
  toFootprintCells,
  UNIT_OCCUPANCY_SLOTS,
  type Footprint,
  type OverflowBlockedState,
  type OverflowCrowdedState,
} from './worldOccupancyCells';

export type { Footprint } from './worldOccupancyCells';

export interface SyncUnitResult {
  placedAt: Position;
  slotOffset: SubcellSlotOffset | null;
}

export interface WorldOccupancy {
  attachWorld(world: OccupancyBindingWorldHooks): void;
  reset(): void;
  blockTerrain(cells: ReadonlyArray<Position>): void;
  /** Releases a terrain blocker — a felled tree leaves open ground behind. */
  unblockTerrain(cells: ReadonlyArray<Position>): void;
  syncBuilding(entity: EntityId, anchor: Position, footprint: Footprint): void;
  syncResource(entity: EntityId, position: Position): void;
  syncUnit(entity: EntityId, position: Position, preferredOffset?: SubcellSlotOffset, restoreOverflow?: boolean): SyncUnitResult;
  // Spec §12.6 fallback for fresh placements (spawn, train, ungarrison):
  // redirect to the nearest neighbor with a free slot when the cell is full.
  placeUnitForSpawn(entity: EntityId, requestedPosition: Position): SyncUnitResult | null;
  // Spec §12.7 lazy redirect: closest cell with a free slot, or null. The
  // entity itself is treated as non-blocking. Search is a deterministic
  // eight-direction BFS capped at a 16-cell Chebyshev radius.
  findNearestFreeUnitCell(entity: EntityId, requestedPosition: Position): Position | null;
  // Spec §12.7 eager pre-reservation for group moves. See
  // `worldOccupancyAllocators.allocateGroupMoveTargets` for the algorithm.
  allocateGroupMoveTargets(
    unitIds: ReadonlyArray<EntityId>,
    targetCenter: Position,
  ): Position[];
  release(entity: EntityId): void;
  /** Bumped on every building/resource/terrain change. Unit churn does not
   *  bump it — units never block `isCellPassableForUnit`, so REACHABILITY
   *  between two cells can only change when this number does (the fact the
   *  unreachable-plan cache in movementPlanOps keys on).
   *
   *  KNOWN BOUNDARY: gate admittance (cellPassability.admitsThroughGate) also
   *  depends on completion, team membership, and the ASKING unit's owner —
   *  none of which claim or release a cell. Gate COMPLETION is handled
   *  (v0.3.161): finalizeBuildingConstruction calls notePassabilityChange(),
   *  so a route that opens when a gate finishes invalidates the cache like
   *  any structural change. The remaining boundary is per-owner and currently
   *  closed by other rules, not by this counter: a unit changing owner (monk
   *  conversion) inherits the cached verdicts of its old owner, since the key
   *  carries no owner; and a BUILDING changing owner would change who its
   *  gate admits, which cannot happen today only because monk conversion
   *  refuses every wall-line building (monasteryTechEffects). Teams are
   *  seed-only and never change mid-match. Any future capture mechanic, or
   *  any owner-keyed passability, must call notePassabilityChange().
   *  Entity ids also recycle (see
   *  `generation`) — the cache tolerates that only because every structural
   *  death bumps the revision, which flushes the dead id's entries. */
  structuralRevision(): number;
  /** Bump `structuralRevision` for a change that alters WHO may pass a cell
   *  without changing which cells are claimed — a gate finishing for its
   *  owner. Reachability caches key on the revision, so anything that opens
   *  or closes a route to some player must announce itself here. */
  notePassabilityChange(): void;
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
  let structuralRevisionCounter = 0;
  const structuralEntities = new Set<EntityId>();

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
    if (structuralEntities.delete(entity)) structuralRevisionCounter += 1;
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
      structuralEntities.clear();
      structuralRevisionCounter += 1;
      reattachWorldHooks();
    },

    blockTerrain(cells: ReadonlyArray<Position>): void {
      if (cells.length === 0) {
        return;
      }

      binding.block(cells, {
        metadata: { kind: 'terrain' },
      });
      structuralRevisionCounter += 1;
    },

    unblockTerrain(cells: ReadonlyArray<Position>): void {
      if (cells.length === 0) {
        return;
      }

      binding.unblock(cells);
      structuralRevisionCounter += 1;
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
      structuralEntities.add(entity);
      structuralRevisionCounter += 1;
    },

    syncResource(entity: EntityId, position: Position): void {
      binding.release(entity);
      clearOverflowForEntity(entity);

      if (!binding.occupy(entity, [position], { metadata: { kind: 'resource' } })) {
        addOverflowBlockedClaim(entity, [position], 'resource');
      }
      structuralEntities.add(entity);
      structuralRevisionCounter += 1;
    },

    syncUnit(entity: EntityId, position: Position, preferredOffset?: SubcellSlotOffset, restoreOverflow = false): SyncUnitResult {
      binding.release(entity);
      clearOverflowForEntity(entity);
      unitSlotOffsets.delete(entity);
      if (restoreOverflow) {
        addOverflowCrowdedClaim(entity, position);
        return { placedAt: position, slotOffset: null };
      }

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
        preferredOffset,
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

    placeUnitForSpawn(entity: EntityId, requestedPosition: Position): SyncUnitResult | null {
      const initial = this.syncUnit(entity, requestedPosition);
      if (initial.slotOffset !== null) {
        return initial;
      }

      // Original cell was full — use the same bounded deterministic spiral
      // as lazy move-arrival redirects so diagonals and farther legal cells
      // remain reachable when cardinal neighbors are full.
      const freeCell = this.findNearestFreeUnitCell(entity, requestedPosition);
      if (freeCell) {
        const result = this.syncUnit(entity, freeCell);
        if (result.slotOffset !== null) {
          return result;
        }
      }

      // Every cell in the bounded spiral is full. A fresh placement may fail;
      // release the provisional overflow claim so its caller can keep the unit
      // contained rather than publishing a stacked world position.
      this.release(entity);
      return null;
    },

    findNearestFreeUnitCell(entity: EntityId, requestedPosition: Position): Position | null {
      // Spec §12.7 lazy redirect: BFS the spiral around `requestedPosition`,
      // returning the first cell with a free unit slot. Search radius matches
      // the group allocator's so a single redirect lands consistent with what
      // a group allocation would have picked.
      return findNearestFreeUnitCellInSpiral(
        {
          worldWidth,
          worldHeight,
          getCellStatus: this.getCellStatus.bind(this),
        },
        entity,
        requestedPosition,
        (e, position) => binding.canOccupySubcell(e, position, { metadata: { kind: 'unit' } }),
      );
    },

    allocateGroupMoveTargets(
      unitIds: ReadonlyArray<EntityId>,
      targetCenter: Position,
      preferredCells?: ReadonlyArray<Position> | null,
    ): Position[] {
      return allocateGroupMoveTargetsImpl(
        {
          worldWidth,
          worldHeight,
          getCellStatus: this.getCellStatus.bind(this),
        },
        unitIds,
        targetCenter,
        preferredCells,
      );
    },

    release(entity: EntityId): void {
      binding.release(entity);
      clearOverflowForEntity(entity);
      unitSlotOffsets.delete(entity);
      if (structuralEntities.delete(entity)) structuralRevisionCounter += 1;
    },

    notePassabilityChange(): void {
      structuralRevisionCounter += 1;
    },

    structuralRevision(): number {
      return structuralRevisionCounter;
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
