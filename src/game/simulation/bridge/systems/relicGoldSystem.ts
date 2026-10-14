// Relic gold (spec §6.9, Appendix A): each relic kept in a Monastery pays its
// owner Definitive Edition's rate, 30 gold a minute (0.5 a second; DE's
// relic-rate resource 191 defaults to 30). A side with the Aztecs is paid a
// third more, 40 a minute: one gold every 1.5 seconds where everyone else
// waits 2 (Forgotten Empires' relic table, 2,400 gold an hour).
//
// Integer accounting with no float and no saved remainder. By the end of tick
// n of the match (the first tick is 1), one relic held since the start has
// earned floor(n * goldPerMinute / ticksPerMinute) gold, and each tick pays the
// whole gold that running total crosses on it. At 10 ticks a second that is
// one gold on every 20th tick, every 15th on an Aztec side, so any 20
// consecutive ticks a relic spends inside pay it exactly one gold, whatever
// the phase. The schedule reads only the tick number and the saved relic
// counts, so a game saved mid-period loads onto the same schedule and a replay
// re-derives it: nothing is lost or paid twice. What it does not keep is DE's
// running fraction of a gold: a relic that comes or goes part way through a
// period is paid on the game's payout ticks, so one stay can be paid under one
// gold more or less than DE would pay it.

import { TPS } from '../../prototypeScenario';
import { teamHasCivilization } from '../../teamBonuses';
import type { BuildingComponent } from '../../types';
import type { GameWorld } from '../pureHelpers';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { playerCivilizationsCodec, playerTeamsCodec,
  playerResourcesCodec,
  relicsInMonasteryCodec,
} from '../bridgeStateSerialize';

/** DE's relic gold a minute (resource 191's default). */
export const RELIC_GOLD_PER_MINUTE = 30;
/** The same on a side with the Aztecs: a third more. */
export const AZTEC_SIDE_RELIC_GOLD_PER_MINUTE = 40;

const TICKS_PER_MINUTE = 60 * TPS;

/** Whole gold one relic has earned by the end of tick `tickNumber`: an exact
 *  integer floor division, never a float. */
function relicGoldEarnedBy(tickNumber: number, goldPerMinute: number): number {
  const scaled = tickNumber * goldPerMinute;
  return (scaled - (scaled % TICKS_PER_MINUTE)) / TICKS_PER_MINUTE;
}

/** Gold one relic is paid on tick `tickNumber` of the match (the first is 1). */
export function relicGoldOnTick(tickNumber: number, goldPerMinute: number): number {
  return relicGoldEarnedBy(tickNumber, goldPerMinute) - relicGoldEarnedBy(tickNumber - 1, goldPerMinute);
}

export interface RelicGoldSystemDeps {
  world: GameWorld;
  // Phase 2D: relicsInMonastery + playerResources migrated to
  // world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
}

export function registerRelicGoldSystem(deps: RelicGoldSystemDeps): void {
  const { world, accessor } = deps;

  world.registerSystem({
    name: 'prototypeRelicGold',
    phase: 'update',
    after: ['prototypeMonkBehavior'],
    execute(activeWorld) {
      // The engine advances its tick count after the systems run, so the tick
      // being played is one past it.
      const tickNumber = activeWorld.tick + 1;
      const basePay = relicGoldOnTick(tickNumber, RELIC_GOLD_PER_MINUTE);
      const aztecSidePay = relicGoldOnTick(tickNumber, AZTEC_SIDE_RELIC_GOLD_PER_MINUTE);
      const relicsInMonastery = accessor.get(relicsInMonasteryCodec);
      const playerResources = accessor.get(playerResourcesCodec);
      let dirty = false;
      let resourcesDirty = false;
      for (const [monasteryId, count] of relicsInMonastery.entries()) {
        if (count <= 0) {
          continue;
        }
        const building = activeWorld.getComponent<BuildingComponent>(monasteryId, 'building');
        if (!building || building.buildingType !== 'monastery') {
          relicsInMonastery.delete(monasteryId);
          dirty = true;
          continue;
        }
        // Most ticks pay nobody, and the side's civilizations are read only on
        // a tick where the two rates pay differently.
        const perRelic = basePay === aztecSidePay
          ? basePay
          : teamHasCivilization(
            accessor.get(playerTeamsCodec),
            accessor.get(playerCivilizationsCodec),
            building.owner,
            'Aztecs',
          ) ? aztecSidePay : basePay;
        if (perRelic === 0) {
          continue;
        }
        const stockpile = playerResources.get(building.owner);
        if (!stockpile) {
          continue;
        }
        stockpile.gold += count * perRelic;
        resourcesDirty = true;
      }
      if (dirty) {
        accessor.markDirty(relicsInMonasteryCodec);
      }
      if (resourcesDirty) {
        accessor.markDirty(playerResourcesCodec);
      }
    },
  });
}
