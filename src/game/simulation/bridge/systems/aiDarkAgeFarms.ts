// What DE's Dark Age farm rule reads about one seat (work 144 M2,
// `aiDarkAgeBoom.ts`): its villagers, its own sheep, its farms and the idle ones,
// who is gathering food and from what, whether natural food lies within the AI's
// hunting reach of its Town Center, and whether it has a wood drop site. Read
// from components and the construction slot only, once a decision.

import type { Position } from 'civ-engine';
import type { BuildingComponent, GathererComponent, ResourceComponent, UnitComponent } from '../../types';
import type { DarkAgeFoodSituation } from '../../aiDarkAgeBoom';
import { constructionStatesCodec } from '../bridgeStateSerialize';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import type { GameWorld } from '../pureHelpers';
import { HUNT_RADIUS } from './aiSystemHuntPhase';

const NATURAL_FOOD = new Set(['sheep', 'berry-bush', 'deer', 'boar', 'fish']);
const FOOD = new Set([...NATURAL_FOOD, 'farm']);

export function darkAgeFoodSituation(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  owner: number,
  townCenter: Position | null | undefined,
): DarkAgeFoodSituation {
  const construction = accessor.get(constructionStatesCodec);
  const farmIds = new Set<number>();
  let hasWoodDropSite = false;
  for (const id of world.query('building')) {
    const building = world.getComponent<BuildingComponent>(id, 'building');
    if (building?.owner !== owner || construction.get(id)?.isComplete === false) continue;
    if (building.buildingType === 'farm') farmIds.add(id);
    if (building.buildingType === 'lumber-camp') hasWoodDropSite = true;
  }
  let ownSheep = 0;
  let naturalFoodNearby = false;
  for (const id of world.query('position', 'resource')) {
    const resource = world.getComponent<ResourceComponent>(id, 'resource');
    if (!resource || resource.amount <= 0 || !NATURAL_FOOD.has(resource.resourceType)) continue;
    if (resource.resourceType === 'sheep' && resource.owner === owner) ownSheep += 1;
    if (naturalFoodNearby || !townCenter || resource.resourceType === 'fish') continue;
    if (resource.resourceType === 'sheep' && resource.owner !== owner && resource.owner !== null) continue;
    const at = world.getComponent<Position>(id, 'position');
    if (at && Math.hypot(at.x - townCenter.x, at.y - townCenter.y) <= HUNT_RADIUS) naturalFoodNearby = true;
  }
  let villagers = 0;
  let foodGatherers = 0;
  let naturalFoodGatherers = 0;
  const workedFarms = new Set<number>();
  for (const id of world.query('unit', 'gatherer')) {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (unit?.owner !== owner || unit.unitType !== 'villager') continue;
    villagers += 1;
    const target = world.getComponent<GathererComponent>(id, 'gatherer')?.targetResourceId ?? null;
    if (target === null) continue;
    const kind = world.getComponent<ResourceComponent>(target, 'resource')?.resourceType;
    if (kind === undefined || !FOOD.has(kind)) continue;
    foodGatherers += 1;
    if (kind === 'farm') workedFarms.add(target);
    else naturalFoodGatherers += 1;
  }
  return {
    villagers,
    ownSheep,
    farms: farmIds.size,
    idleFarms: [...farmIds].filter((id) => !workedFarms.has(id)).length,
    foodGatherers,
    naturalFoodGatherers,
    naturalFoodNearby,
    hasWoodDropSite,
  };
}
