export const UNIT_ATTACK_FEED_TICKS = 10;

export interface ProjectedUnitAttackAnimationView {
  tick: number;
  cancelTick?: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

// Who a swing was between (v0.3.215). The animation half above says a blow
// landed at a cell; the attack WARNING needs to know whose blow and whose
// thing, because "an attack near something of mine" and "an attack on
// something of mine" are different events and only the second is news.
//
// Absent — and the warning therefore silent — in three cases, each deliberate:
// a wildlife attacker (a lured boar biting the villager that shot it is not a
// raid), a wildlife target (a hunted boar is not a subject), and an entry
// restored from a save, which `hydrateUnitAttacks` drops rather than
// re-validate for a feed that is 10 ticks deep.
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
