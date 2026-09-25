// The visibility map in the world's state: two slots (2026-09-25).
//
// The engine validates and diffs every state slot written in a tick, and
// fingerprints every slot twice a tick whether written or not. The units' slot
// is written on nearly every tick, because a unit moves. While each owner's
// building layer (layeredVisibilityMap.ts) rode in that slot, its sources and
// explored cells were walked on every one of those ticks; on one saved world
// profiled in both arms that was +0.13 to +0.9 ms/tick in the engine's
// `clearStateDirty` alone. So the building layer has a slot of its own,
// written only when one of its sources changed. A new
// map (a fresh game, a load, a replay world) starts changed, so its first
// write carries it, and the world keeps the last write, so a save always holds
// the current one. The slot keeps only what a load cannot rebuild
// (LayeredVisibilityMap.getBuildingLayerState). A save or a snapshot from
// before the split has only the units' slot, which then holds every source.

import type { VisibilityMap, VisibilityMapState } from 'civ-engine';

import { TIER_3_SLOTS } from './bridgeStateSerialize';
import { LayeredVisibilityMap } from './layeredVisibilityMap';
import type { GameWorld } from './pureHelpers';

type StateValue = Parameters<GameWorld['setState']>[1];

/** Writes the map into the world: the units' layer on every call, the
 *  building layer when it changed since its last write. A plain engine map,
 *  which only tests build, is one slot. */
export function publishVisibility(world: GameWorld, map: VisibilityMap): void {
  if (!(map instanceof LayeredVisibilityMap)) {
    world.setState(TIER_3_SLOTS.visibility, map.getState() as unknown as StateValue);
    return;
  }
  world.setState(TIER_3_SLOTS.visibility, map.getUnitLayerState() as unknown as StateValue);
  if (map.consumeBuildingLayerChange()) {
    world.setState(TIER_3_SLOTS.buildingVisibility, map.getBuildingLayerState() as unknown as StateValue);
  }
}

/** The one map state a save or a snapshot holds across both slots, for
 *  `LayeredVisibilityMap.fromState`, which puts each player in its layer. */
export function visibilityStateFromSlots(
  state: Record<string, unknown>,
  missing: (slot: string) => Error,
): VisibilityMapState {
  const units = state[TIER_3_SLOTS.visibility] as VisibilityMapState | undefined;
  if (!units) throw missing(TIER_3_SLOTS.visibility);
  const buildings = state[TIER_3_SLOTS.buildingVisibility] as VisibilityMapState | undefined;
  return buildings ? { ...units, players: [...units.players, ...buildings.players] } : units;
}
