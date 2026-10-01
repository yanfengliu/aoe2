// Cosmetic occupation for the resource HUD. No simulation decision reads it.
// Recordings without the marker keep both marker and component fields absent,
// including gatherers trained while those recordings are re-simulated.
import type { GameWorld } from './bridge/pureHelpers';
import { garrisonedUnitToBuildingCodec, unitCommandsCodec } from './bridge/bridgeStateSerialize';
import type { EconomyResourceKind, GathererComponent, UnitComponent } from './types';

export const RESOURCE_OCCUPATION_SLOT = 'aoe2.resourceOccupationVersion';
export type ResourceWorkerCounts = Record<EconomyResourceKind, number>;

function isResourceKind(value: unknown): value is EconomyResourceKind {
  return value === 'food' || value === 'wood' || value === 'gold' || value === 'stone';
}

export function resourceOccupationFields(world: GameWorld, kind: EconomyResourceKind | null): { resourceOccupation?: EconomyResourceKind | null } {
  return world.getState(RESOURCE_OCCUPATION_SLOT) === 1 ? { resourceOccupation: kind } : {};
}

export function initialResourceOccupation(world: GameWorld): { resourceOccupation?: EconomyResourceKind | null } {
  return resourceOccupationFields(world, null);
}

export function setResourceOccupation(world: GameWorld, id: number, kind: EconomyResourceKind | null): void {
  if (world.getState(RESOURCE_OCCUPATION_SLOT) !== 1) return;
  const unit = world.getComponent<UnitComponent>(id, 'unit');
  if (unit && (unit.unitType === 'villager' || unit.unitType === 'fishing-ship') && unit.resourceOccupation !== kind) {
    world.setComponent(id, 'unit', { ...unit, resourceOccupation: kind });
  }
}

export function initializeResourceOccupations(world: GameWorld, mode: 'live' | 'replay'): void {
  if (mode === 'replay') return;
  const knownFormat = world.getState(RESOURCE_OCCUPATION_SLOT) === 1;
  world.setState(RESOURCE_OCCUPATION_SLOT, 1);
  // Older user saves know active work but not an idle worker's former work.
  // Repair only the missing cosmetic field; replay inputs are never repaired.
  for (const id of world.query('unit', 'gatherer')) {
    const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (!gatherer || !unit) continue;
    if (knownFormat && (unit.resourceOccupation === null || isResourceKind(unit.resourceOccupation))) continue;
    world.setComponent(id, 'unit', {
      ...unit,
      resourceOccupation: gatherer.task !== 'idle' && isResourceKind(gatherer.desiredResource) ? gatherer.desiredResource : null,
    });
  }
}

export function countResourceWorkers(world: GameWorld, owner: number): ResourceWorkerCounts {
  const counts: ResourceWorkerCounts = { food: 0, wood: 0, gold: 0, stone: 0 };
  const commands = unitCommandsCodec.deserialize(world.getState(unitCommandsCodec.slot) as ReturnType<typeof unitCommandsCodec.serialize> | undefined);
  const garrisoned = garrisonedUnitToBuildingCodec.deserialize(world.getState(garrisonedUnitToBuildingCodec.slot) as ReturnType<typeof garrisonedUnitToBuildingCodec.serialize> | undefined);
  for (const id of world.query('unit')) {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (!unit || unit.owner !== owner || garrisoned.has(id)) continue;
    const command = commands.get(id);
    if (unit.unitType === 'trade-cart' || unit.unitType === 'trade-cog') {
      if (command?.type === 'trade') counts.gold++;
      continue;
    }
    if (unit.unitType !== 'villager' && unit.unitType !== 'fishing-ship') continue;
    const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
    if (!gatherer) continue;
    let kind: EconomyResourceKind | null = null;
    if (command?.type === 'move') {
      // DE keeps a former gatherer's occupation during an explicit walk.
      // Legacy recordings cannot reconstruct history they did not record.
      kind = world.getState(RESOURCE_OCCUPATION_SLOT) === 1 && isResourceKind(unit.resourceOccupation) ? unit.resourceOccupation : null;
    } else if (!command && gatherer.task !== 'idle') {
      // A reassignment may retain old cargo. The current work is the new kind.
      kind = isResourceKind(gatherer.desiredResource) ? gatherer.desiredResource : null;
    }
    if (kind !== null) counts[kind]++;
  }
  return counts;
}
