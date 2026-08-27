// Economy-state assembly. Snapshots the world's villagers, resources,
// units, and buildings into the structured `EconomyState` view consumed by
// tests and the HUD. Pure read-only over the bridge's side maps.

import type { Position } from 'civ-engine';
import type {
  BuildingComponent,
  EconomyState,
  GathererComponent,
  ResourceComponent,
  UnitComponent,
  UnitTaskState,
} from '../types';
import {
  buildingFootprint,
  cloneQueue,
  cloneResources,
  isEconomyResourceEntry,
  isEconomyVillager,
  type GameWorld,
} from './pureHelpers';
import {
  buildingBuildTimeTicks,
  buildingPopulationProvided,
} from '../prototypeBuildingRules';
import { unitAttackDamage, unitAttackRange, unitReloadTicks } from '../prototypeUnitRules';
import {
  combatStatesCodec,
  constructionStatesCodec,
  playerAgesCodec,
  playerResourcesCodec,
  populationCodec,
  productionQueuesCodec,
} from './bridgeStateSerialize';

export interface EconomyStateOpsDeps {
  world: GameWorld;
  state: import('./bridgeState').BridgeState;
  // Phase 2D — playerAges read via accessor.
  accessor: import('./bridgeStateAccessor').BridgeStateAccessor;
  getUnitTaskState: (id: number) => UnitTaskState;
}

export function createEconomyStateOps(deps: EconomyStateOpsDeps): {
  getEconomyState(): EconomyState;
} {
  const { world, accessor, getUnitTaskState } = deps;

  function getEconomyState(): EconomyState {
    const villagers = [...world.query('unit', 'gatherer')]
      .map((id) => {
        const unit = world.getComponent<UnitComponent>(id, 'unit');
        const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
        if (!unit || !gatherer) return null;
        return {
          owner: unit.owner,
          task: getUnitTaskState(id),
          desiredResource: gatherer.desiredResource,
          carriedResource: gatherer.carriedResource,
          carriedAmount: gatherer.carriedAmount,
        };
      })
      .filter(isEconomyVillager);

    const resources = [...world.query('position', 'resource')]
      .map((id) => {
        const position = world.getComponent<Position>(id, 'position');
        const resource = world.getComponent<ResourceComponent>(id, 'resource');
        if (!position || !resource) return null;
        return {
          id,
          resourceType: resource.resourceType,
          amount: resource.amount,
          maxAmount: resource.maxAmount,
          owner: resource.owner,
          baseOwner: resource.baseOwner,
          x: position.x,
          y: position.y,
        };
      })
      .filter(isEconomyResourceEntry);

    const units = [...world.query('position', 'unit')]
      .map((id) => {
        const position = world.getComponent<Position>(id, 'position');
        const unit = world.getComponent<UnitComponent>(id, 'unit');
        const combat = accessor.get(combatStatesCodec).get(id);
        if (!position || !unit) return null;
        return {
          id,
          owner: unit.owner,
          unitType: unit.unitType,
          x: position.x,
          y: position.y,
          task: getUnitTaskState(id),
          attackDamage: combat?.attackDamage ?? unitAttackDamage(unit.unitType),
          attackRange: combat?.attackRange ?? unitAttackRange(unit.unitType),
          reloadTicks: combat?.reloadTicks ?? unitReloadTicks(unit.unitType),
          armor: combat?.armor ?? 0,
        };
      })
      .filter((entry): entry is EconomyState['units'][number] => entry !== null);

    const buildings = [...world.query('position', 'building')]
      .map((id) => {
        const position = world.getComponent<Position>(id, 'position');
        const building = world.getComponent<BuildingComponent>(id, 'building');
        if (!position || !building) return null;

        const construction = accessor.get(constructionStatesCodec).get(id);
        const footprint = buildingFootprint(building.buildingType);
        return {
          id,
          owner: building.owner,
          buildingType: building.buildingType,
          x: position.x,
          y: position.y,
          footprintWidth: footprint.width,
          footprintHeight: footprint.height,
          isComplete: construction ? construction.isComplete : true,
          buildProgressTicks: construction
            ? construction.buildProgressTicks
            : buildingBuildTimeTicks(building.buildingType),
          totalBuildTicks: construction
            ? construction.totalBuildTicks
            : buildingBuildTimeTicks(building.buildingType),
          populationProvided: buildingPopulationProvided(building.buildingType),
          queue: cloneQueue(accessor.get(productionQueuesCodec).get(id) ?? []),
        };
      })
      .filter((entry): entry is EconomyState['buildings'][number] => entry !== null);

    return {
      ages: Object.fromEntries(accessor.get(playerAgesCodec)),
      playerResources: Object.fromEntries(
        [...accessor.get(playerResourcesCodec).entries()].map(([playerId, resources]) => [
          playerId,
          cloneResources(resources),
        ]),
      ),
      population: Object.fromEntries(
        [...accessor.get(populationCodec).entries()].map(([playerId, value]) => [
          playerId,
          { ...value },
        ]),
      ),
      villagers,
      resources,
      units,
      buildings,
    };
  }

  return { getEconomyState };
}
