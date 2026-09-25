// Every blow that lands on a player's unit or building, whatever dealt it
// (v0.3.235, defect register 2026-09-24). This is the attack warning's source.
//
// The swing feed beside it (`unitAttackAnimationFeed.ts`) records what a UNIT
// did, for the swing animation. It keeps one entry per attacker, stamps it
// when the unit swings or fires, and only if some player saw both ends. The
// attack warning read that feed until v0.3.235, so it heard nothing but unit
// swings. A Town Centre, tower or Castle shooting a villager raised nothing,
// and neither did a mangonel stone splashing the villagers beside its target,
// or a bombardment of the ground: none of them is a unit's swing at that
// villager. This feed is written where the damage is dealt, so every way a
// blow can land reaches it:
//  - melee (`resolveUnitAttackOnUnit`, and `deliverUnitAttackOnBuilding`);
//  - every projectile a unit or a building launches, when it lands
//    (`projectileOps.ts`);
//  - every blast victim (`applyUnitBlast`);
//  - wildlife bites (`wildlifeCombatSystem.ts`), with no participants.
// `tests/simulation/playerHitCensus.test.ts` checks the whole set against the
// ground truth: every hit point a player-owned unit or building loses must
// arrive here, on the tick it is lost.
//
// A blow is recorded when it lands, not when it is launched. An arrow that
// misses a moving villager raises no warning, and one that lands does.
//
// TRANSIENT, like the death feed: no save codec and no replay slot. A load
// starts it empty. A replay step re-simulates from the latest snapshot at or
// before its tick, so it holds the blows re-dealt since that snapshot and none
// from before it. It is never simulation state: nothing in the world reads it
// back.

import type { Position } from 'civ-engine';

import { UNIT_ATTACK_FEED_TICKS, type UnitAttackParticipants } from '../attackAnimationTypes';
import type {
  BuildingComponent,
  RenderableComponent,
  UnitComponent,
  UnitTransformComponent,
} from '../types';
import { projectUnitTransformCoordinate, type GameWorld } from './pureHelpers';

/** More than any real tick deals: a castle, three towers and a few mangonels
 *  firing into one crowd is a few dozen. The cap only stops a runaway. */
const MAX_PLAYER_HITS = 1_024;

export interface PlayerHitView {
  /** The tick the blow landed on. */
  tick: number;
  /** The unit or building that took it. */
  targetId: number;
  /** The unit, building or animal that dealt it. */
  attackerId: number;
  /** Where it landed: the target's visual centre, in the swing feed's cell
   *  space (a building's origin plus half its footprint less one). */
  targetX: number;
  targetY: number;
  /** Who the blow was between. Absent when the attacker belongs to no
   *  player (wildlife), which leaves the attack warning silent. */
  participants?: UnitAttackParticipants;
}

/** Records one blow on `targetId`. `attackerOwner` is null for wildlife. A
 *  target that is neither a unit nor a building (an animal being hunted) is
 *  nobody's economy, and is not recorded. Call it once the blow is sure to
 *  land and BEFORE a killed target is destroyed, while its position still
 *  reads: after the hit points drop, or just before the one call that drops
 *  them and may raze the target (a shot at a building, `projectileOps.ts`). */
export type RecordPlayerHit = (attackerId: number, attackerOwner: number | null, targetId: number) => void;

/** Drops blows older than the feed's window. Blows arrive in tick order, so
 *  the stale ones are always at the front. */
export function prunePlayerHits(feed: PlayerHitView[], currentTick: number): void {
  const oldest = currentTick - UNIT_ATTACK_FEED_TICKS;
  let stale = 0;
  while (stale < feed.length && feed[stale]!.tick < oldest) stale += 1;
  if (stale > 0) feed.splice(0, stale);
}

export function createPlayerHitRecorder(deps: { world: GameWorld; feed: PlayerHitView[] }): RecordPlayerHit {
  const { world, feed } = deps;
  return (attackerId, attackerOwner, targetId) => {
    const targetUnit = world.getComponent<UnitComponent>(targetId, 'unit');
    const targetBuilding = targetUnit
      ? undefined
      : world.getComponent<BuildingComponent>(targetId, 'building');
    if (!targetUnit && !targetBuilding) return;
    const position = world.getComponent<Position>(targetId, 'position');
    const renderable = world.getComponent<RenderableComponent>(targetId, 'renderable');
    if (!position || !renderable) return;
    const transform = targetUnit
      ? world.getComponent<UnitTransformComponent>(targetId, 'unitTransform')
      : undefined;
    const rootX = transform ? projectUnitTransformCoordinate(transform.fineX) : position.x;
    const rootY = transform ? projectUnitTransformCoordinate(transform.fineY) : position.y;
    // civ-engine advances `world.tick` after the update systems finish, so a
    // blow dealt inside one belongs to the in-flight tick, as in the swing feed.
    const tick = world.tick + 1;
    prunePlayerHits(feed, tick);
    feed.push({
      tick,
      targetId,
      attackerId,
      targetX: rootX + (renderable.footprintWidth - 1) / 2,
      targetY: rootY + (renderable.footprintHeight - 1) / 2,
      ...(attackerOwner === null
        ? {}
        : {
          participants: {
            attackerOwner,
            targetOwner: targetUnit ? targetUnit.owner : targetBuilding!.owner,
            // The economy the warning covers: villagers and buildings. A
            // soldier taking a hit is a fight; see `isAttackOnOwnEconomy`.
            targetIsEconomy: targetBuilding !== undefined || targetUnit!.unitType === 'villager',
          },
        }),
    });
    if (feed.length > MAX_PLAYER_HITS) feed.splice(0, feed.length - MAX_PLAYER_HITS);
  };
}
