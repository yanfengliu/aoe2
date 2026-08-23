// AI defence phase: the town bell. When enemies are inside the base, the AI's
// villagers stop working and take cover in the Town Center until it passes.
//
// Measured on the default map before this existed: in an AI-vs-AI match both
// sides lost entire villager forces to raids neither answered — one side was
// down from 23 villagers to zero by tick 10000 while its stockpile sat
// untouched. The economy fixes that made the AI play at all are what exposed
// this: a frozen AI never gets raided.

import type { Position } from 'civ-engine';

import type { BuildingComponent, UnitComponent } from '../../types';
import { buildingGarrisonCapacity } from '../../prototypeBuildingRules';
import { garrisonedByBuildingCodec } from '../bridgeStateSerialize';
import { manhattanDistance } from '../pureHelpers';
import type { AiOwnerContext, AiSystemDeps } from './aiSystemTypes';

// How close to the Town Center an enemy has to be before the AI reads it as a
// raid on the base rather than a skirmish somewhere on the map. Tighter than
// the sighting scan (AI_BASE_VISION_RADIUS, 12) on purpose: a scout passing the
// edge of vision is not a reason to stop gathering.
const RAID_RADIUS = 8;
// Villagers this far from the Town Center are sent in. Beyond it they are
// better off running their own way than crossing the raiders to reach shelter.
const SHELTER_RADIUS = 10;
// How long after the last sighting the AI keeps everyone inside. Long enough
// that a raider circling the base does not cause a stream of in-and-out, short
// enough that the economy restarts promptly once it leaves.
const ALL_CLEAR_INTERVALS = 4;

export function runDefensePhase(deps: AiSystemDeps, ctx: AiOwnerContext): void {
  const { accessor, pushUnitContextAtEntityIntention, pushBuildingActionIntention } = deps;
  const {
    activeWorld,
    owner,
    state,
    interval,
    currentTick,
    ownerTownCenterId,
    ownerTownCenterPosition,
    unitCommands,
  } = ctx;
  if (ownerTownCenterId === null || !ownerTownCenterPosition) return;

  const sinceSighting = state.lastEnemySightingTick >= 0
    ? currentTick - state.lastEnemySightingTick
    : Number.POSITIVE_INFINITY;
  const sighting = state.lastEnemySightingPosition;
  const raidOnTheBase = sinceSighting <= interval * 2
    && sighting !== null
    && manhattanDistance(sighting, ownerTownCenterPosition) <= RAID_RADIUS;

  const sheltering = accessor.get(garrisonedByBuildingCodec).get(ownerTownCenterId) ?? [];

  if (!raidOnTheBase) {
    // All clear: let them out, once, when the threat has been gone a while.
    if (sheltering.length > 0 && sinceSighting > interval * ALL_CLEAR_INTERVALS) {
      pushBuildingActionIntention(ownerTownCenterId, 'ungarrison');
    }
    return;
  }

  const townCenter = activeWorld.getComponent<BuildingComponent>(ownerTownCenterId, 'building');
  if (!townCenter) return;
  let room = buildingGarrisonCapacity(townCenter.buildingType) - sheltering.length;
  if (room <= 0) return;

  for (const id of activeWorld.query('position', 'unit', 'gatherer')) {
    if (room <= 0) break;
    const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
    const position = activeWorld.getComponent<Position>(id, 'position');
    if (!unit || !position || unit.owner !== owner || unit.unitType !== 'villager') continue;
    // A villager already walking to the Town Center is already answering;
    // re-ordering it every decision tick would restart the walk.
    if (unitCommands.has(id)) continue;
    if (manhattanDistance(position, ownerTownCenterPosition) > SHELTER_RADIUS) continue;
    pushUnitContextAtEntityIntention(id, ownerTownCenterId, true);
    room -= 1;
  }
}
