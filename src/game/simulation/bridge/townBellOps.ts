// The town bell (spec §9.3, v0.3.115): ring it and every villager runs for
// the nearest shelter with room; Back to Work empties the shelters of
// VILLAGERS only, leaving deliberately-garrisoned military where it stands.
// Both flow through `building.action`, so replays reproduce the alarm.

import type { Position } from 'civ-engine';

import type { BuildingComponent, UnitComponent } from '../types';
import { buildingGarrisonCapacity, canGarrisonAt } from '../prototypeBuildingRules';
import { civHouseGarrisonCapacity, civGarrisonCapacityMultiplier } from '../civBuildingBonuses';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  constructionStatesCodec,
  garrisonedByBuildingCodec,
  garrisonedUnitToBuildingCodec,
  playerCivilizationsCodec,
} from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';

export function createTownBellOps(deps: {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  orderGarrison: (unitId: number, buildingId: number) => boolean;
  ungarrisonBuilding: (buildingId: number, onlyUnitType?: string) => boolean;
}) {
  const { world, accessor, orderGarrison, ungarrisonBuilding } = deps;

  function shelterCapacity(building: BuildingComponent): number {
    const civ = accessor.get(playerCivilizationsCodec).get(building.owner);
    const base = buildingGarrisonCapacity(building.buildingType)
      + civHouseGarrisonCapacity(civ, building.buildingType);
    return Math.floor(base * civGarrisonCapacityMultiplier(civ, building.buildingType));
  }

  function ringTownBell(owner: number): boolean {
    // Shelters: complete, owned, villager-admitting, with free room. Planned
    // occupancy fills as the bell assigns, so a full house overflows to the
    // next-nearest shelter rather than queueing twenty at one door.
    const civ = accessor.get(playerCivilizationsCodec).get(owner);
    const shelters: { id: number; position: Position; free: number }[] = [];
    for (const id of world.query('building', 'position')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      const position = world.getComponent<Position>(id, 'position');
      if (!building || !position || building.owner !== owner) continue;
      if (!canGarrisonAt(building.buildingType, 'villager', civ)) continue;
      const construction = accessor.get(constructionStatesCodec).get(id);
      if (construction && !construction.isComplete) continue;
      const used = accessor.get(garrisonedByBuildingCodec).get(id)?.length ?? 0;
      const free = shelterCapacity(building) - used;
      if (free > 0) shelters.push({ id, position, free });
    }
    if (shelters.length === 0) return false;

    const garrisonedUnits = accessor.get(garrisonedUnitToBuildingCodec);
    let rang = false;
    for (const id of world.query('unit', 'position')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      const position = world.getComponent<Position>(id, 'position');
      if (!unit || !position || unit.owner !== owner) continue;
      if (unit.unitType !== 'villager' || garrisonedUnits.has(id)) continue;
      let best: { id: number; free: number } | null = null;
      let bestDistance = Infinity;
      for (const shelter of shelters) {
        if (shelter.free <= 0) continue;
        const distance = Math.abs(shelter.position.x - position.x)
          + Math.abs(shelter.position.y - position.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = shelter;
        }
      }
      if (!best) break;
      if (orderGarrison(id, best.id)) {
        best.free -= 1;
        rang = true;
      }
    }
    return rang;
  }

  function backToWork(owner: number): boolean {
    let released = false;
    for (const [buildingId] of [...accessor.get(garrisonedByBuildingCodec)]) {
      const building = world.getComponent<BuildingComponent>(buildingId, 'building');
      if (!building || building.owner !== owner) continue;
      if (ungarrisonBuilding(buildingId, 'villager')) released = true;
    }
    return released;
  }

  return { ringTownBell, backToWork };
}
