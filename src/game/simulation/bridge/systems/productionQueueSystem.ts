// Production queue system: every tick, the head entry of every owned
// building's queue ticks down. When the entry is a unit and the population
// allows, a new unit is spawned at the building's spawn slot. When the
// entry is a technology, `applyTechnology` (in `bridge/technologyOps`)
// fans out the side-effects.

import type { Position } from 'civ-engine';
import type {
  BuildingComponent,
  BuildingType,
  PopulationState,
  ProductionQueueEntry,
  ResearchableTechnologyType,
  TrainableUnitType,
  VisionSourceComponent,
} from '../../types';
import type { GameWorld } from '../pureHelpers';
import { unitVisionRadius } from '../../prototypeUnitRules';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { rallyPointsCodec } from '../bridgeStateSerialize';

export interface ProductionQueueSystemDeps {
  world: GameWorld;
  productionQueues: Map<number, ProductionQueueEntry[]>;
  population: Map<number, PopulationState>;
  // Phase 2D: rallyPoints migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  inFlightTechByOwner: Map<number, Set<ResearchableTechnologyType>>;
  findBuildingSpawnPosition: (
    buildingPosition: Position,
    buildingType: BuildingType,
  ) => Position | null;
  addUnitEntity: (
    owner: number,
    unitType: TrainableUnitType,
    spawnPosition: Position,
    visionSource: VisionSourceComponent,
  ) => number;
  issueUnitMoveCommand: (unitId: number, target: Position) => boolean;
  applyTechnology: (owner: number, technologyType: ResearchableTechnologyType) => void;
}

export function registerProductionQueueSystem(deps: ProductionQueueSystemDeps): void {
  const {
    world,
    productionQueues,
    population,
    accessor,
    inFlightTechByOwner,
    findBuildingSpawnPosition,
    addUnitEntity,
    issueUnitMoveCommand,
    applyTechnology,
  } = deps;

  world.registerSystem({
    name: 'prototypeProductionQueues',
    phase: 'update',
    after: ['prototypePlayerCommands'],
    execute() {
      for (const [buildingId, queue] of productionQueues.entries()) {
        if (queue.length === 0) {
          continue;
        }

        const building = world.getComponent<BuildingComponent>(buildingId, 'building');
        const position = world.getComponent<Position>(buildingId, 'position');
        if (!building || !position) {
          productionQueues.set(buildingId, []);
          continue;
        }

        const entry = queue[0];
        if (entry.kind === 'unit') {
          const populationState = population.get(building.owner);
          if (!populationState || !entry.unitType) {
            continue;
          }

          if (populationState.current >= populationState.cap) {
            entry.isBlocked = true;
            continue;
          }
        }

        entry.isBlocked = false;
        if (entry.remainingTicks > 0) {
          entry.remainingTicks -= 1;
          if (entry.remainingTicks > 0) {
            continue;
          }
        }

        if (entry.kind === 'unit' && entry.unitType) {
          const spawnPosition = findBuildingSpawnPosition(position, building.buildingType);
          if (!spawnPosition) {
            entry.isBlocked = true;
            entry.remainingTicks = 0;
            continue;
          }

          const unitId = addUnitEntity(building.owner, entry.unitType, spawnPosition, {
            playerId: building.owner,
            radius: unitVisionRadius(entry.unitType),
          });
          const rallyPoint = accessor.get(rallyPointsCodec).get(buildingId);
          if (rallyPoint) {
            issueUnitMoveCommand(unitId, rallyPoint);
          }
        }

        if (entry.kind === 'technology' && entry.technologyType) {
          applyTechnology(building.owner, entry.technologyType);
          inFlightTechByOwner.get(building.owner)?.delete(entry.technologyType);
        }

        queue.shift();
      }
    },
  });
}
