export const UNIT_ATTACK_FEED_TICKS = 10;

export interface ProjectedUnitAttackAnimationView {
  tick: number;
  cancelTick?: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

// Who a blow was between (v0.3.217). The animation half above says a blow
// landed at a cell; the attack WARNING needs to know whose blow and whose
// thing, because "an attack near something of mine" and "an attack on
// something of mine" are different events and only the second is news.
//
// The warning reads it from the hit feed (`bridge/playerHitFeed.ts`), which
// records every blow on a player's unit or building where the damage is
// dealt. Absent there, and the warning therefore silent, for a wildlife
// attacker: a lured boar biting the villager that shot it is not a raid.
//
// The swing feed below still carries it, and nothing reads it there since
// v0.3.235, when the warning moved to the hit feed. It stays because the swing
// feed is copied into replay snapshots (`aoe2.replayUnitAttacks`). A bundle
// recorded before the move holds it, and dropping it would make re-simulation
// diverge from those snapshots.
export interface UnitAttackParticipants {
  attackerOwner: number;
  targetOwner: number;
  /** The target is a villager or a building — the economy a warning covers. */
  targetIsEconomy: boolean;
}

export interface ProjectedUnitAttackView
  extends ProjectedUnitAttackAnimationView {
  attackerId: number;
  attackerGeneration: number;
  witnessedBy: number[];
  suppressedFor?: number[];
  participants?: UnitAttackParticipants;
}
