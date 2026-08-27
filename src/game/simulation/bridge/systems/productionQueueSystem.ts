// Production queue system: every tick, the head entry of every owned
// building's queue ticks down. When the entry is a unit and the population
// allows, a new unit is spawned at the building's spawn slot. When the
// entry is a technology, `applyTechnology` (in `bridge/technologyOps`)
// fans out the side-effects.

import { bonusVisionRadius } from '../../teamCombatBonuses';
import type { Position } from 'civ-engine';
import { unitDomain } from '../../unitDomain';
import type {
  BuildingComponent,
  BuildingType,
  EconomyResourceKind,
  GathererComponent,
  ResearchableTechnologyType,
  ResourceComponent,
  TrainableUnitType,
  VisionSourceComponent,
} from '../../types';
import type { GameWorld } from '../pureHelpers';
import { unitVisionRadius } from '../../prototypeUnitRules';
import { resourceKindToEconomyResource } from '../../prototypeEconomyRules';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { playerCivilizationsCodec, playerTeamsCodec,
  inFlightTechByOwnerCodec,
  playerResourcesCodec,
  populationCodec,
  productionQueuesCodec,
  rallyPointsCodec,
} from '../bridgeStateSerialize';

// AoE2 rally-on-resource: if a harvestable resource sits on the rally cell,
// return its economy kind so a freshly-trained villager can auto-gather it.
// Fog-agnostic on purpose — a deterministic system must not depend on
// per-player visibility, and the human sets the rally on a cell they can see,
// so a resource there is real. Uses the canonical `isHarvestableResource`
// predicate (not merely amount > 0) so a LIVE boar/sheep (huntable wildlife
// maps to 'food' but cannot be gathered until killed) and relics are NOT
// treated as gatherable — rallying onto those falls through to a plain MOVE
// instead of handing the villager a generic food intent that sends it off to
// some other node.
function rallyResourceKind(
  world: GameWorld,
  position: Position,
  isHarvestableResource: (resourceId: number, resource: ResourceComponent) => boolean,
): EconomyResourceKind | null {
  for (const id of world.query('position', 'resource')) {
    const resourcePosition = world.getComponent<Position>(id, 'position');
    if (
      !resourcePosition
      || resourcePosition.x !== position.x
      || resourcePosition.y !== position.y
    ) {
      continue;
    }
    const resource = world.getComponent<ResourceComponent>(id, 'resource');
    if (!resource || !isHarvestableResource(id, resource)) continue;
    return resourceKindToEconomyResource(resource.resourceType);
  }
  return null;
}

export interface ProductionQueueSystemDeps {
  world: GameWorld;
  // Phase 2D: population migrated to world.state.aoe2.* via accessor.
  // Phase 2D: rallyPoints + productionQueues + inFlightTechByOwner migrated
  // to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  findBuildingSpawnPosition: (
    buildingPosition: Position,
    buildingType: BuildingType,
    preferForeground?: boolean,
    domain?: import('../../unitDomain').UnitDomain,
  ) => Position | null;
  addUnitEntity: (
    owner: number,
    unitType: TrainableUnitType,
    spawnPosition: Position,
    visionSource: VisionSourceComponent,
  ) => number;
  issueUnitMoveCommand: (unitId: number, target: Position) => boolean;
  isHarvestableResource: (resourceId: number, resource: ResourceComponent) => boolean;
  applyTechnology: (owner: number, technologyType: ResearchableTechnologyType) => void;
}


// Spanish (sourced v0.3.149): +20 gold for each completed technology,
// age-ups included — paid at BOTH research-completion sites below.
function paySpanishTechGold(
  accessor: import('../bridgeStateAccessor').BridgeStateAccessor,
  owner: number,
): void {
  if (accessor.get(playerCivilizationsCodec).get(owner) !== 'Spanish') return;
  const stockpile = accessor.get(playerResourcesCodec).get(owner);
  if (stockpile) {
    stockpile.gold += 20;
    accessor.markDirty(playerResourcesCodec);
  }
}

export function registerProductionQueueSystem(deps: ProductionQueueSystemDeps): void {
  const {
    world,
    accessor,
    findBuildingSpawnPosition,
    addUnitEntity,
    issueUnitMoveCommand,
    isHarvestableResource,
    applyTechnology,
  } = deps;

  world.registerSystem({
    name: 'prototypeProductionQueues',
    phase: 'update',
    after: ['prototypePlayerCommands'],
    execute() {
      const productionQueues = accessor.get(productionQueuesCodec);
      let dirty = false;
      for (const [buildingId, queue] of productionQueues.entries()) {
        if (queue.length === 0) {
          continue;
        }

        const building = world.getComponent<BuildingComponent>(buildingId, 'building');
        const position = world.getComponent<Position>(buildingId, 'position');
        if (!building || !position) {
          productionQueues.set(buildingId, []);
          dirty = true;
          continue;
        }

        const entry = queue[0];
        if (entry.kind === 'unit') {
          const populationState = accessor.get(populationCodec).get(building.owner);
          if (!populationState || !entry.unitType) {
            continue;
          }

          if (populationState.current >= populationState.cap) {
            entry.isBlocked = true;
            dirty = true;
            // A population-blocked unit at the FRONT must not stall a
            // pop-NEUTRAL research queued behind it. Otherwise a player that
            // queued a unit it cannot yet house (a rich AI filling its pop with
            // military, or a capped human) permanently blocks its own age-up /
            // upgrade research — the AI never advances an age despite ample
            // resources (grounded: ai-planner-fixture Feudal stall after the
            // wood-locality fix enriched the economy, 2026-07-02). Advance the
            // first queued research in place; complete + remove it when done.
            const researchIndex = queue.findIndex(
              (e) => e.kind === 'technology' && e.technologyType,
            );
            if (researchIndex > 0) {
              const research = queue[researchIndex];
              research.isBlocked = false;
              if (research.remainingTicks > 0) {
                research.remainingTicks -= 1;
              }
              if (research.remainingTicks <= 0 && research.technologyType) {
                applyTechnology(building.owner, research.technologyType);
                paySpanishTechGold(accessor, building.owner);
                accessor
                  .get(inFlightTechByOwnerCodec)
                  .get(building.owner)
                  ?.delete(research.technologyType);
                queue.splice(researchIndex, 1);
              }
            }
            continue;
          }
        }

        entry.isBlocked = false;
        dirty = true;
        if (entry.remainingTicks > 0) {
          entry.remainingTicks -= 1;
          if (entry.remainingTicks > 0) {
            continue;
          }
        }

        if (entry.kind === 'unit' && entry.unitType) {
          // M5 naval: a ship must appear on WATER. A Dock stands on the
          // shore, so its perimeter includes both, and the domain picks the
          // right half of it.
          const spawnPosition = findBuildingSpawnPosition(
            position,
            building.buildingType,
            false,
            unitDomain(entry.unitType),
          );
          if (!spawnPosition) {
            entry.isBlocked = true;
            entry.remainingTicks = 0;
            continue;
          }

          const unitId = addUnitEntity(building.owner, entry.unitType, spawnPosition, {
            playerId: building.owner,
            radius: unitVisionRadius(entry.unitType)
              + bonusVisionRadius(
                accessor.get(playerTeamsCodec),
                accessor.get(playerCivilizationsCodec),
                building.owner,
                entry.unitType,
                unitVisionRadius(entry.unitType),
              ),
          });
          const rallyPoint = accessor.get(rallyPointsCodec).get(buildingId);
          if (rallyPoint) {
            // AoE2 rally-on-resource: a villager rallied onto a harvestable
            // resource auto-gathers it instead of idling at the rally cell.
            // Set the gather INTENT (desiredResource + the explicit-order
            // flag) and let prototypeVillagerEconomy route it to the nearest
            // matching resource — human villagers are auto-assigned only when
            // hasExplicitGatherOrder is set (shouldMaintainGatheringOrder),
            // which is exactly why an un-tasked new villager would otherwise
            // stand idle. Direct mutation only (no mid-system submitWithResult)
            // to preserve determinism, matching the issueUnitMoveCommand note.
            const gatherKind = entry.unitType === 'villager'
              ? rallyResourceKind(world, rallyPoint, isHarvestableResource)
              : null;
            const gatherer = gatherKind === null
              ? null
              : world.getComponent<GathererComponent>(unitId, 'gatherer');
            if (gatherKind !== null && gatherer) {
              gatherer.desiredResource = gatherKind;
              gatherer.hasExplicitGatherOrder = true;
              gatherer.task = 'idle';
              gatherer.targetResourceId = null;
            } else {
              issueUnitMoveCommand(unitId, rallyPoint);
            }
          }
        }

        if (entry.kind === 'technology' && entry.technologyType) {
          applyTechnology(building.owner, entry.technologyType);
          paySpanishTechGold(accessor, building.owner);
          // Phase 2D: inFlightTechByOwner is Tier-2 — runtime cache only,
          // NOT flushed. No markDirty call.
          accessor.get(inFlightTechByOwnerCodec).get(building.owner)?.delete(entry.technologyType);
        }

        queue.shift();
      }
      if (dirty) {
        accessor.markDirty(productionQueuesCodec);
      }
    },
  });
}
