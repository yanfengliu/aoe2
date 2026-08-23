// LoS technology effect — bumps an owner's EXISTING entities' vision radius
// when Town Watch / Town Patrol / Tracking completes. Mirrors loomEffect /
// sanctityEffect / bloodlinesEffect (the "apply to units already on the field"
// half); the newly-created half is derived at the spawn sites
// (finalizeBuildingConstruction + productionQueueSystem) from visionTechEffects.
//
// The radius bump is in place on the visionSource component, exactly like the
// unit-upgrade path (technologyOps: `vision.radius = unitVisionRadius(to)`).
// The visibility system fingerprints radius per tick, so a changed radius
// re-stamps the fog on the next tick with no extra dirty-marking. applyTechnology
// guards against a double-bump via its already-researched check.

import type { BuildingComponent, UnitComponent, VisionSourceComponent } from '../types';
import type { GameWorld } from './pureHelpers';
import { isInfantryUnit } from '../prototypeUnitRules';

// Town Watch / Town Patrol: add `delta` to every vision-bearing BUILDING owned
// by `owner` (AoE2 "Buildings;Towers" — every building that has a vision source).
export function applyBuildingVisionDelta(
  world: GameWorld,
  owner: number,
  delta: number,
): void {
  for (const id of world.query('building', 'visionSource')) {
    const building = world.getComponent<BuildingComponent>(id, 'building');
    const vision = world.getComponent<VisionSourceComponent>(id, 'visionSource');
    if (!building || !vision || building.owner !== owner) {
      continue;
    }
    vision.radius += delta;
  }
}

// The Outpost's "+2 Line of sight per age": add `delta` to every OUTPOST owned
// by `owner`. Same shape as the technology bump above, but keyed on the
// building type rather than on a researched set, because the trigger is
// advancing an age rather than researching something.
export function applyOutpostVisionDelta(
  world: GameWorld,
  owner: number,
  delta: number,
): void {
  for (const id of world.query('building', 'visionSource')) {
    const building = world.getComponent<BuildingComponent>(id, 'building');
    const vision = world.getComponent<VisionSourceComponent>(id, 'visionSource');
    if (!building || !vision || building.owner !== owner) continue;
    if (building.buildingType !== 'outpost') continue;
    vision.radius += delta;
  }
}

// Tracking: add `delta` to every INFANTRY unit owned by `owner`.
export function applyInfantryVisionDelta(
  world: GameWorld,
  owner: number,
  delta: number,
): void {
  for (const id of world.query('unit', 'visionSource')) {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    const vision = world.getComponent<VisionSourceComponent>(id, 'visionSource');
    if (!unit || !vision || unit.owner !== owner || !isInfantryUnit(unit.unitType)) {
      continue;
    }
    vision.radius += delta;
  }
}
