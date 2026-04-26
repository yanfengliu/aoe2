// Relic countdown. An owner who holds every relic on the map in their
// Monasteries (zero live relics anywhere else) begins counting down. The
// "every relic in one owner's Monasteries" predicate lives in
// `bridge/matchEndOps.currentRelicHoldingOwner` so the in-flight vs
// deposited distinction stays in one place.

import type { GameWorld } from '../pureHelpers';
import type { RelicCountdownEntry } from '../countdownTypes';

export interface RelicCountdownSystemDeps {
  world: GameWorld;
  relicCountdowns: Map<number, RelicCountdownEntry>;
  relicCountdownOverrides: Map<number, number>;
  currentRelicHoldingOwner: () => number | null;
  defaultRelicCountdownTicks: number;
  isMatchRunning: () => boolean;
}

export function registerRelicCountdownSystem(deps: RelicCountdownSystemDeps): void {
  const {
    world,
    relicCountdowns,
    relicCountdownOverrides,
    currentRelicHoldingOwner,
    defaultRelicCountdownTicks,
    isMatchRunning,
  } = deps;

  world.registerSystem({
    name: 'prototypeRelicCountdown',
    phase: 'postUpdate',
    after: ['prototypeWonderCountdown'],
    execute() {
      if (!isMatchRunning()) {
        return;
      }
      const holdingOwner = currentRelicHoldingOwner();
      if (holdingOwner === null) {
        relicCountdowns.clear();
        return;
      }
      let entry = relicCountdowns.get(holdingOwner);
      if (!entry) {
        const totalTicks = relicCountdownOverrides.get(holdingOwner) ?? defaultRelicCountdownTicks;
        entry = { remainingTicks: totalTicks, totalTicks, lastCompletedTick: null };
        relicCountdowns.set(holdingOwner, entry);
      }
      // Clear stale entries for owners no longer holding all relics.
      for (const existingOwner of [...relicCountdowns.keys()]) {
        if (existingOwner !== holdingOwner) {
          relicCountdowns.delete(existingOwner);
        }
      }
      // FU7: once completed, the countdown freezes at 0 — the resolver picks
      // the winner downstream.
      if (entry.lastCompletedTick !== null) {
        return;
      }
      entry.remainingTicks -= 1;
      if (entry.remainingTicks <= 0) {
        entry.lastCompletedTick = world.tick;
      }
    },
  });
}
