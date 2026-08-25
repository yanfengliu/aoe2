// Relic countdown. An owner who holds every relic on the map in their
// Monasteries (zero live relics anywhere else) begins counting down. The
// "every relic in one owner's Monasteries" predicate lives in
// `bridge/matchEndOps.currentRelicHoldingOwner` so the in-flight vs
// deposited distinction stays in one place.

import { atheismCountdownExtension } from '../atheismCountdowns';
import type { GameWorld } from '../pureHelpers';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { relicCountdownOverridesCodec, relicCountdownsCodec } from '../bridgeStateSerialize';

export interface RelicCountdownSystemDeps {
  world: GameWorld;
  // Phase 2D: relicCountdowns + relicCountdownOverrides both flow through accessor.
  accessor: BridgeStateAccessor;
  currentRelicHoldingOwner: () => number | null;
  defaultRelicCountdownTicks: number;
  isMatchRunning: () => boolean;
}

export function registerRelicCountdownSystem(deps: RelicCountdownSystemDeps): void {
  const {
    world,
    accessor,
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
      const relicCountdowns = accessor.get(relicCountdownsCodec);
      let dirty = false;
      if (holdingOwner === null) {
        if (relicCountdowns.size > 0) {
          relicCountdowns.clear();
          accessor.markDirty(relicCountdownsCodec);
        }
        return;
      }
      let entry = relicCountdowns.get(holdingOwner);
      if (!entry) {
        const totalTicks = (accessor.get(relicCountdownOverridesCodec).get(holdingOwner) ?? defaultRelicCountdownTicks)
          + atheismCountdownExtension(accessor);
        entry = { remainingTicks: totalTicks, totalTicks, lastCompletedTick: null };
        relicCountdowns.set(holdingOwner, entry);
        dirty = true;
      }
      // Clear stale entries for owners no longer holding all relics.
      for (const existingOwner of [...relicCountdowns.keys()]) {
        if (existingOwner !== holdingOwner) {
          relicCountdowns.delete(existingOwner);
          dirty = true;
        }
      }
      // FU7: once completed, the countdown freezes at 0 — the resolver picks
      // the winner downstream.
      if (entry.lastCompletedTick !== null) {
        if (dirty) accessor.markDirty(relicCountdownsCodec);
        return;
      }
      entry.remainingTicks -= 1;
      if (entry.remainingTicks <= 0) {
        entry.lastCompletedTick = world.tick;
      }
      accessor.markDirty(relicCountdownsCodec);
    },
  });
}
