// The visibility map in the world's state: two slots (2026-09-25).
//
// The engine validates and diffs every state slot written in a tick, and
// fingerprints every slot twice a tick whether written or not. The units' slot
// is written on nearly every tick, because a unit moves. While each owner's
// building layer (layeredVisibilityMap.ts) rode in that slot, its sources and
// explored cells were walked on every one of those ticks: about +0.27 ms/tick
// in the engine's two state walks together, on the boot map's tick-30,000
// world profiled in both arms. So the building layer has a slot of its own, and
// it keeps only what a load cannot rebuild (LayeredVisibilityMap.
// getBuildingLayerState): the cells an owner's buildings explored that none of
// its units has. That answer shrinks whenever a unit explores one of those
// cells, so it is recomputed on every write of the units' slot and written
// only when it differs from what the world holds. It is then current at every
// tick, and a live world, a world loaded from its save and a replay world hold
// the same value. (Recomputed only when a building changed, it went stale in
// the live world as units explored, and a loaded world disagreed with it: 42
// and 77 cells against 22 and 17 at the boot map's tick 1,000.) A save or a
// snapshot from before the split has only the units' slot, which then holds
// every source.

import type { VisibilityMap, VisibilityMapState } from 'civ-engine';

import { TIER_3_SLOTS } from './bridgeStateSerialize';
import { LayeredVisibilityMap } from './layeredVisibilityMap';
import type { GameWorld } from './pureHelpers';

type StateValue = Parameters<GameWorld['setState']>[1];

/** Writes the map into the world: the units' layer on every call, the
 *  building layer when what a load cannot rebuild of it differs from what the
 *  world holds. `withBuildingSlot` is false only for a replay world whose
 *  recording predates the slot, which must keep that recording's state keys.
 *  A plain engine map, which only tests build, is one slot. */
export function publishVisibility(world: GameWorld, map: VisibilityMap, withBuildingSlot = true): void {
  if (!(map instanceof LayeredVisibilityMap)) {
    world.setState(TIER_3_SLOTS.visibility, map.getState() as unknown as StateValue);
    return;
  }
  world.setState(TIER_3_SLOTS.visibility, map.getUnitLayerState() as unknown as StateValue);
  if (!withBuildingSlot) return;
  const buildings = map.getBuildingLayerState();
  const held = world.getState(TIER_3_SLOTS.buildingVisibility) as unknown as VisibilityMapState | undefined;
  if (!sameBuildingSlot(held, buildings)) {
    world.setState(TIER_3_SLOTS.buildingVisibility, buildings as unknown as StateValue);
  }
}

/** Whether two building slots hold the same players, sources and cells. */
function sameBuildingSlot(a: VisibilityMapState | undefined, b: VisibilityMapState): boolean {
  if (a === undefined || a.players.length !== b.players.length) return false;
  return a.players.every(([key, entry], i) => {
    const [otherKey, other] = b.players[i]!;
    return key === otherKey
      && entry.sources.length === other.sources.length
      && entry.explored.length === other.explored.length
      && entry.explored.every((cell, j) => cell === other.explored[j]);
  });
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
