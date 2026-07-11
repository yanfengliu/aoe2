// Entity destroy operations. Each `destroy*` clears every side map that
// holds bookkeeping for the entity, then calls world.destroyEntity. Mirrors
// the pre-extraction inline implementation byte-for-byte; the only change
// is the dependency surface is explicit instead of closure-captured.

import type { Position } from 'civ-engine';
import type {
  BuildingComponent,
  RenderableComponent,
  ResourceComponent,
  ResourceKind,
  UnitComponent,
  UnitTransformComponent,
} from '../types';
import {
  buildingFootprint,
  isSameEntity,
  projectUnitTransformCoordinate,
  type GameWorld,
} from './pureHelpers';
import { DEATH_FEED_TICKS } from './visibility';
import { deriveCap } from './bridgeConstants';
import { buildingPopulationProvided } from '../prototypeBuildingRules';
import {
  constructionStatesCodec,
  conversionStateCodec,
  garrisonedByBuildingCodec,
  garrisonedUnitToBuildingCodec,
  garrisonedUnitVisionSourcesCodec,
  gathererDropOffStuckSinceTickCodec,
  inFlightTechByOwnerCodec,
  buildingCombatStatesCodec,
  buildingHealthStatesCodec,
  combatStatesCodec,
  monkCarriedRelicCodec,
  monkHealCountersCodec,
  monkTasksCodec,
  populationCodec,
  productionQueuesCodec,
  trebuchetPackStatesCodec,
  rallyPointsCodec,
  relicsInMonasteryCodec,
  sheepMoveOrdersCodec,
  townCenterRefsCodec,
  wildlifeStatesCodec,
  wonderCountdownsCodec,
} from './bridgeStateSerialize';
import type { BridgeStateAccessor } from './bridgeStateAccessor';

export interface EntityDestroyOpsDeps {
  world: GameWorld;
  mapWidth: number;
  mapHeight: number;
  state: import('./bridgeState').BridgeState;
  // Phase 2D — gathererDropOffStuckSinceTick flows through accessor.
  accessor: BridgeStateAccessor;
  // v0.1.129 death feedback: read-only visibility probe to snapshot which
  // players could see a dying unit's cell at death time (the death cue's
  // fog gate). Queried pre-recompute so it reflects the moment of death.
  visibility: { isVisible: (playerId: number, x: number, y: number) => boolean };
  removeSelectedEntity: (id: number) => void;
  clearUnitCommand: (id: number) => void;
  getApproachCellsForFootprint: (
    anchor: Position,
    width: number,
    height: number,
    range?: number,
  ) => Position[];
  isTerrainPassableForUnit: (x: number, y: number) => boolean;
  isCellBlockedByBuilding: (x: number, y: number) => boolean;
  isCellBlockedByResource: (x: number, y: number) => boolean;
  addResourceEntity: (
    resourceType: ResourceKind,
    position: Position,
    amount: number,
    baseOwner: number | null,
  ) => number;
  markOutOfBandRenderChange: () => void;
}

export interface EntityDestroyOps {
  destroyUnitEntity(id: number): void;
  destroyBuildingEntity(id: number): void;
  killWildlifeEntity(id: number): void;
  destroyResourceEntity(id: number): void;
}

export function createEntityDestroyOps(deps: EntityDestroyOpsDeps): EntityDestroyOps {
  const {
    world,
    mapWidth,
    mapHeight,
    state,
    accessor,
    visibility,
    removeSelectedEntity,
    clearUnitCommand,
    getApproachCellsForFootprint,
    isTerrainPassableForUnit,
    isCellBlockedByBuilding,
    isCellBlockedByResource,
    addResourceEntity,
    markOutOfBandRenderChange,
  } = deps;
  const { monksByOwner } = state;

  // v0.1.129 death feedback: every unit destruction is a death in current
  // call paths (combat kill, Heresy conversion, garrisoned units in a razed
  // building), so this chokepoint feeds the render layer's death animations.
  // Captured BEFORE world.destroyEntity while the components still exist AND
  // before this tick's visibility recompute (prototypeVisibility runs later
  // in the update phase), so the witness set reflects who could see the cell
  // when the unit died. Fine (sub-cell) coordinates so the effect plays where
  // the unit visually stood. The feed is transient render info (see
  // BridgeState) and pruned here so it stays bounded without a per-tick sweep.
  function recordUnitDeath(id: number): void {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    const position = world.getComponent<Position>(id, 'position');
    if (!unit || !position) {
      // A garrisoned unit (no position) dies invisibly inside its building —
      // the building's own destruction is the visible event.
      return;
    }
    const renderable = world.getComponent<RenderableComponent>(id, 'renderable');
    const transform = world.getComponent<UnitTransformComponent>(id, 'unitTransform');
    const x = transform ? projectUnitTransformCoordinate(transform.fineX) : position.x;
    const y = transform ? projectUnitTransformCoordinate(transform.fineY) : position.y;
    // Witnesses = every real player (population is keyed by owner) who can
    // currently see the death cell, plus the dead unit's own owner (it
    // witnessed its own unit's death; population always carries the owner, but
    // include it defensively). Enumerating population avoids a VisibilityMap
    // getState() serialization per death.
    const deathCellX = Math.floor(x);
    const deathCellY = Math.floor(y);
    const witnessedBy: number[] = [];
    for (const owner of accessor.get(populationCodec).keys()) {
      if (owner === unit.owner || visibility.isVisible(owner, deathCellX, deathCellY)) {
        witnessedBy.push(owner);
      }
    }
    if (!witnessedBy.includes(unit.owner)) {
      witnessedBy.push(unit.owner);
    }
    const deaths = state.recentUnitDeaths;
    deaths.push({
      id,
      tick: world.tick,
      x,
      y,
      owner: unit.owner,
      unitType: unit.unitType,
      tint: renderable?.tint ?? 0xffffff,
      size: renderable?.size ?? 0.5,
      witnessedBy,
    });
    // Prune in place: drop aged-out records (and never let the list grow past
    // a hard cap even under a mass-death tick).
    const MAX_DEATH_FEED_ENTRIES = 64;
    const minTick = world.tick - DEATH_FEED_TICKS;
    let write = 0;
    for (let read = 0; read < deaths.length; read += 1) {
      if (deaths[read]!.tick >= minTick) {
        deaths[write] = deaths[read]!;
        write += 1;
      }
    }
    deaths.length = write;
    if (deaths.length > MAX_DEATH_FEED_ENTRIES) {
      deaths.splice(0, deaths.length - MAX_DEATH_FEED_ENTRIES);
    }
  }

  function destroyUnitEntity(id: number): void {
    recordUnitDeath(id);
    const garrisonBuildingId = accessor.get(garrisonedUnitToBuildingCodec).get(id) ?? null;
    if (garrisonBuildingId !== null) {
      accessor.mutate(garrisonedByBuildingCodec, (m) => {
        const garrisonedUnits = m.get(garrisonBuildingId) ?? [];
        const filtered = garrisonedUnits.filter((candidateId) => candidateId !== id);
        if (filtered.length === 0) {
          m.delete(garrisonBuildingId);
        } else {
          m.set(garrisonBuildingId, filtered);
        }
      });
      accessor.mutate(garrisonedUnitToBuildingCodec, (m) => m.delete(id));
      accessor.mutate(garrisonedUnitVisionSourcesCodec, (m) => m.delete(id));
    }

    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (unit) {
      const populationState = accessor.get(populationCodec).get(unit.owner);
      if (populationState) {
        populationState.current = Math.max(0, populationState.current - 1);
        accessor.markDirty(populationCodec);
      }
      if (unit.unitType === 'monk') {
        const monkSet = monksByOwner.get(unit.owner);
        if (monkSet) {
          monkSet.delete(id);
          if (monkSet.size === 0) {
            monksByOwner.delete(unit.owner);
          }
        }
      }
    }

    removeSelectedEntity(id);

    clearUnitCommand(id);
    accessor.mutate(combatStatesCodec, (m) => m.delete(id));
    const monkTasks = accessor.get(monkTasksCodec);
    if (monkTasks.delete(id)) accessor.markDirty(monkTasksCodec);
    accessor.mutate(monkCarriedRelicCodec, (m) => m.delete(id));
    accessor.mutate(conversionStateCodec, (m) => m.delete(id));
    accessor.mutate(monkHealCountersCodec, (m) => m.delete(id));
    accessor.mutate(trebuchetPackStatesCodec, (m) => m.delete(id));
    accessor.mutate(gathererDropOffStuckSinceTickCodec, (m) => m.delete(id));
    world.destroyEntity(id);
    markOutOfBandRenderChange();
  }

  function destroyBuildingEntity(id: number): void {
    const building = world.getComponent<BuildingComponent>(id, 'building');
    const construction = accessor.get(constructionStatesCodec).get(id);
    for (const garrisonedUnitId of accessor.get(garrisonedByBuildingCodec).get(id) ?? []) {
      destroyUnitEntity(garrisonedUnitId);
    }
    accessor.mutate(garrisonedByBuildingCodec, (m) => m.delete(id));

    if (building?.buildingType === 'town-center') {
      const townCenterRef = accessor.get(townCenterRefsCodec).get(building.owner) ?? null;
      if (isSameEntity(townCenterRef, id, world)) {
        accessor.mutate(townCenterRefsCodec, (m) => m.delete(building.owner));
      }
    }

    if (building) {
      const populationState = accessor.get(populationCodec).get(building.owner);
      const populationProvided =
        construction?.populationProvided ?? buildingPopulationProvided(building.buildingType);
      const isComplete = construction?.isComplete ?? true;
      if (populationState && isComplete && populationProvided > 0) {
        // Lower the honest raw supply; cap = deriveCap(rawSupply). No
        // Math.max(current, …) floor: if the raw sum drops below `current`
        // you are simply over cap (AoE2-correct) — existing units are NOT
        // evicted (no code path removes units on a cap change), training is
        // blocked (current >= cap) until pop falls below the cap again.
        populationState.rawSupply -= populationProvided;
        populationState.cap = deriveCap(populationState.rawSupply);
        accessor.markDirty(populationCodec);
      }
    }

    removeSelectedEntity(id);

    if (building) {
      const queue = accessor.get(productionQueuesCodec).get(id);
      if (queue) {
        for (const entry of queue) {
          if (entry.kind === 'technology' && entry.technologyType) {
            // Phase 2D: inFlightTechByOwner is Tier-2 — runtime cache only,
            // NOT flushed. No markDirty call.
            accessor.get(inFlightTechByOwnerCodec).get(building.owner)?.delete(entry.technologyType);
          }
        }
      }
    }

    accessor.mutate(productionQueuesCodec, (m) => m.delete(id));
    accessor.mutate(rallyPointsCodec, (m) => {
      m.delete(id);
    });
    accessor.mutate(constructionStatesCodec, (m) => m.delete(id));
    accessor.mutate(buildingHealthStatesCodec, (m) => m.delete(id));
    accessor.mutate(buildingCombatStatesCodec, (m) => m.delete(id));
    accessor.mutate(wonderCountdownsCodec, (m) => {
      m.delete(id);
    });

    // Stored relics on a destroyed Monastery spill back onto the map.
    // Search outward until enough free cells are collected, capped at
    // mapWidth + mapHeight; on failure stack remaining relics on the
    // anchor cell (relics have no unit-occupancy, so visual overlap is
    // tolerated).
    const storedRelicCount = accessor.get(relicsInMonasteryCodec).get(id) ?? 0;
    const relicDropPositions: Position[] = [];
    if (storedRelicCount > 0 && building) {
      const position = world.getComponent<Position>(id, 'position');
      if (position) {
        const footprint = buildingFootprint(building.buildingType);
        const maxSearchRange = mapWidth + mapHeight;
        for (
          let searchRange = Math.max(2, Math.max(footprint.width, footprint.height));
          searchRange <= maxSearchRange && relicDropPositions.length < storedRelicCount;
          searchRange += 1
        ) {
          const candidates = getApproachCellsForFootprint(
            position,
            footprint.width,
            footprint.height,
            searchRange,
          );
          for (const candidate of candidates) {
            if (relicDropPositions.length >= storedRelicCount) {
              break;
            }
            if (!isTerrainPassableForUnit(candidate.x, candidate.y)) {
              continue;
            }
            if (isCellBlockedByBuilding(candidate.x, candidate.y)) {
              continue;
            }
            if (isCellBlockedByResource(candidate.x, candidate.y)) {
              continue;
            }
            if (relicDropPositions.some((p) => p.x === candidate.x && p.y === candidate.y)) {
              continue;
            }
            relicDropPositions.push(candidate);
          }
        }
        while (relicDropPositions.length < storedRelicCount) {
          relicDropPositions.push({ x: position.x, y: position.y });
        }
      }
    }
    accessor.mutate(relicsInMonasteryCodec, (m) => m.delete(id));
    world.destroyEntity(id);
    for (const dropPosition of relicDropPositions) {
      addResourceEntity('relic', dropPosition, 0, null);
    }
    markOutOfBandRenderChange();
  }

  function killWildlifeEntity(id: number): void {
    const resource = world.getComponent<ResourceComponent>(id, 'resource');
    const wildlife = accessor.get(wildlifeStatesCodec).get(id);
    if (!resource || !wildlife) {
      return;
    }

    wildlife.currentHp = 0;
    wildlife.cooldownTicks = 0;
    wildlife.isAlive = false;
    wildlife.targetEntityRef = null;
    // Full-review H1: this mutates the cached wildlife value; without marking
    // the slot dirty the `isAlive=false` corpse state never reaches
    // world.state, so a save/load RESURRECTS the killed boar.
    accessor.markDirty(wildlifeStatesCodec);

    if (!wildlife.corpsePersists || resource.amount <= 0) {
      destroyResourceEntity(id);
      return;
    }

    markOutOfBandRenderChange();
  }

  function destroyResourceEntity(id: number): void {
    removeSelectedEntity(id);
    accessor.mutate(wildlifeStatesCodec, (m) => m.delete(id));
    accessor.mutate(sheepMoveOrdersCodec, (m) => m.delete(id));
    accessor.mutate(monkCarriedRelicCodec, (m) => {
      for (const [monkId, carriedId] of m.entries()) {
        if (carriedId === id) {
          m.delete(monkId);
        }
      }
    });

    // M1 Farms: a depleted Farm is a building+resource hybrid, so the
    // resource-depletion path that destroys it (villagerEconomySystem) must
    // ALSO clear the building-side bookkeeping, otherwise constructionStates /
    // buildingHealthStates entries orphan against a freed entity id. A
    // depleted farm vanishes entirely (an un-reseeded farm disappears in
    // AoE2 — there is no leftover building shell). This is intentionally
    // inline rather than delegating to destroyBuildingEntity to avoid a
    // destroyResource→destroyBuilding cycle; a farm has no garrison, no
    // production queue contents, and provides 0 population, so only the
    // construction / health / combat side maps need clearing.
    const building = world.getComponent<BuildingComponent>(id, 'building');
    if (building) {
      const construction = accessor.get(constructionStatesCodec).get(id);
      const populationProvided =
        construction?.populationProvided ?? buildingPopulationProvided(building.buildingType);
      const isComplete = construction?.isComplete ?? true;
      if (populationProvided > 0 && isComplete) {
        const populationState = accessor.get(populationCodec).get(building.owner);
        if (populationState) {
          // Same raw-supply derivation as destroyBuildingEntity. (Farms
          // provide 0 pop today so this branch is dormant for the cap, but
          // it stays consistent with the model for any future hybrid.)
          populationState.rawSupply -= populationProvided;
          populationState.cap = deriveCap(populationState.rawSupply);
          accessor.markDirty(populationCodec);
        }
      }
      accessor.mutate(productionQueuesCodec, (m) => m.delete(id));
      accessor.mutate(constructionStatesCodec, (m) => m.delete(id));
      accessor.mutate(buildingHealthStatesCodec, (m) => m.delete(id));
      accessor.mutate(buildingCombatStatesCodec, (m) => m.delete(id));
      // A completed farm is a selectable building, so the player may have set
      // a rally point on it (building.setRallyPoint). Clear it on depletion so
      // no stale rallyPoints entry orphans against the freed entity id
      // (mirrors destroyBuildingEntity).
      accessor.mutate(rallyPointsCodec, (m) => m.delete(id));
    }

    world.destroyEntity(id);
    markOutOfBandRenderChange();
  }

  return {
    destroyUnitEntity,
    destroyBuildingEntity,
    killWildlifeEntity,
    destroyResourceEntity,
  };
}
