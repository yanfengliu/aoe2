// How many ticks a Wonder or Relic countdown that opens NOW will run (spec
// §4.3, work 132). Both places a countdown opens read this one rule: the
// Wonder when its construction completes (`entityCreateOps`) and the Relic
// when one owner holds every relic (`relicCountdownSystem`).
//
//   total = (the owner's fixture override, if the scenario set one
//            else the years for the players seated, in ticks)
//           + Atheism's extension, if any owner holds it
//
// The players seated are read from the world (every seat has a population row
// from seeding), never from a bridge option, so a loaded game and a replay
// world work out the same length as the live match did.

import { victoryCountdownTicks } from '../victoryCountdown';
import { atheismCountdownExtension } from './atheismCountdowns';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  populationCodec,
  relicCountdownOverridesCodec,
  wonderCountdownOverridesCodec,
} from './bridgeStateSerialize';

/** The players the match was seeded with. */
export function seatedPlayerCount(accessor: BridgeStateAccessor): number {
  return accessor.get(populationCodec).size;
}

/** The length a countdown gets before any fixture override or Atheism. */
export function defaultCountdownTicks(accessor: BridgeStateAccessor): number {
  return victoryCountdownTicks(seatedPlayerCount(accessor));
}

export function countdownTotalTicks(
  accessor: BridgeStateAccessor,
  owner: number,
  kind: 'wonder' | 'relic',
): number {
  const override = accessor
    .get(kind === 'wonder' ? wonderCountdownOverridesCodec : relicCountdownOverridesCodec)
    .get(owner);
  return (override ?? defaultCountdownTicks(accessor)) + atheismCountdownExtension(accessor);
}
