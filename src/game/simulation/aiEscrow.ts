// DE's escrow, the part work 141 M2a models: what the AI holds back from its
// army so that a purchase it wants can form.
//
// DE's own AI (Promisory, escrow.per) spends in a fixed cycle every pass. It
// releases everything held and sets every escrow percentage to 0 (6-18), so no
// share of income is ever held. It buys the items it flagged on the pass before
// with `can-*-with-escrow` (24-725). It flags again what it still wants, adding
// up their costs (743-3363), and holds exactly that sum (3369-3375). Its army
// trains with plain `can-train`, which cannot spend what is held, resource by
// resource: a unit that costs no gold is not stopped by gold held. So an item is
// held for one pass at a time, and again while its condition stays true, until
// it is bought.
//
// Two of DE's flags are modelled, at every level (spec §13.1: DE's level gates
// are handicaps this game does not take):
// - the first Monk while two or more relics lie on the map, with a Monastery
//   standing and room to house it (escrow.per 3061-3085, trained at 639-643);
// - Conscription in the Imperial Age once a Castle stands (3201-3214, bought at
//   670-674; DE flags it at Hard and above only).
// And DE's other first Monk, which holds nothing: once an enemy owns a
// Monastery or Monks (units.per 4216-4224, every level). Its train rule
// (13189-13210) runs before every army line, so it has first claim on what is
// not held.
// Left out: DE skips both flags while the AI is under attack, which this AI
// does not track, and asks military superiority 0 or better for the Monk
// (3077), which it does not compute. Conscription's population test (3208-3210)
// always passes at Hard, whose rules these are.
//
// Neither flag holds wood. Every Imperial unit costs wood, and holding a stuck
// building's wood from the army froze it (spec §13.2, "The plan outranks the
// queue in the Imperial Age"; measured again by work 141: owner 1's army held
// at 4 from tick 10,000 to 22,000 in the coverage lab).

import type { AgeType, PlayerResources } from './types';

export type EscrowPurchase =
  | { kind: 'train'; producer: 'monastery'; unit: 'monk' }
  | { kind: 'research'; producer: 'castle'; technology: 'conscription' };

export interface FlaggedPurchase {
  purchase: EscrowPurchase;
  /** Held from the army until bought (DE's escrow), or only bought first. */
  holds: boolean;
}

export interface EscrowInputs {
  age: AgeType;
  /** A complete Monastery is standing. */
  monastery: boolean;
  /** Monks owned, queued or asked for, at every Monastery. */
  monks: number;
  /** Relics lying on the map: neutral, on the ground, not carried. */
  relicsOnMap: number;
  /** Population below its cap: DE's `housing-headroom` (escrow.per 3064). */
  housingHeadroom: boolean;
  /** An enemy owns a Monastery or Monks. */
  enemyMonks: boolean;
  /** A complete Castle is standing. */
  castle: boolean;
  /** Conscription is offered: not researched, not in flight, not asked for. */
  conscriptionOffered: boolean;
}

const MONK: EscrowPurchase = { kind: 'train', producer: 'monastery', unit: 'monk' };
const CONSCRIPTION: EscrowPurchase = { kind: 'research', producer: 'castle', technology: 'conscription' };

/** What DE would flag this pass: the held purchases in DE's buy order, then the first-claim ones. */
export function flaggedPurchases(inputs: EscrowInputs): FlaggedPurchase[] {
  const castleTier = inputs.age === 'castle-age' || inputs.age === 'imperial-age';
  const firstMonk = castleTier && inputs.monastery && inputs.monks === 0 && inputs.housingHeadroom;
  const flagged: FlaggedPurchase[] = [];
  if (firstMonk && inputs.relicsOnMap >= 2) flagged.push({ purchase: MONK, holds: true });
  if (inputs.age === 'imperial-age' && inputs.castle && inputs.conscriptionOffered) {
    flagged.push({ purchase: CONSCRIPTION, holds: true });
  }
  if (firstMonk && inputs.relicsOnMap < 2 && inputs.enemyMonks) flagged.push({ purchase: MONK, holds: false });
  return flagged;
}

/**
 * Whether Conscription is still to buy. The Castle's list (`castleTechOptions`)
 * drops only what is researched, so a Conscription queued at the Castle is in
 * flight and must not be held, or asked for, again.
 */
export function conscriptionOffered(input: { castle: boolean; listed: boolean; inFlight: boolean; asked: boolean }): boolean {
  return input.castle && input.listed && !input.inFlight && !input.asked;
}

const KINDS = ['food', 'wood', 'gold', 'stone'] as const;
type Cost = Partial<PlayerResources>;

const plus = (a: Cost, b: Cost): Cost => {
  const sum: Cost = {};
  for (const kind of KINDS) sum[kind] = (a[kind] ?? 0) + (b[kind] ?? 0);
  return sum;
};

/** Whether `have` less `taken` pays for `cost`, resource by resource. */
function pays(have: PlayerResources, taken: Cost, cost: Cost): boolean {
  return KINDS.every((kind) => (cost[kind] ?? 0) <= 0 || have[kind] - (taken[kind] ?? 0) >= (cost[kind] ?? 0));
}

export interface EscrowSettlement {
  /** The flagged purchases to ask for now, in order. */
  buy: EscrowPurchase[];
  /** What those purchases cost: the decision has spent it. */
  bought: Cost;
  /** The prices held for purchases not bought: the rest of the decision may not spend them. */
  held: Cost;
  /** For each held purchase it cannot pay for: the budget its check used (what went before it, and its price). */
  unpaid: Cost[];
}

/**
 * DE's escrow for one decision. A held purchase is bought from the stockpile
 * less the age-up reserve and what went before it, as DE buys its flags in
 * order from one escrow with its age-ups first (escrow.per 24-725), and its
 * price is held until bought. A first-claim purchase is bought only from what
 * nothing holds, and holds nothing. A purchase whose producer is busy waits,
 * still held if it holds.
 */
export function settleEscrow(
  stockpile: PlayerResources,
  flagged: readonly FlaggedPurchase[],
  priceOf: (purchase: EscrowPurchase) => Cost,
  producerIdle: (purchase: EscrowPurchase) => boolean,
  ageUpReserve: Cost,
): EscrowSettlement {
  let bought: Cost = {};
  let held: Cost = {};
  const buy: EscrowPurchase[] = [];
  const unpaid: Cost[] = [];
  for (const { purchase, holds } of flagged) {
    const price = priceOf(purchase);
    const before = plus(bought, held);
    if (!pays(stockpile, plus(ageUpReserve, before), price)) {
      if (holds) {
        held = plus(held, price);
        unpaid.push(plus(before, price));
      }
      continue;
    }
    if (!producerIdle(purchase)) {
      if (holds) held = plus(held, price);
      continue;
    }
    buy.push(purchase);
    bought = plus(bought, price);
  }
  return { buy, bought, held, unpaid };
}

/**
 * What one decision may still spend once the escrow has settled. Handlers
 * charge in the order asked and none of these is charged yet, so a purchase
 * checked alone against the stockpile could spend what is held, or what an
 * earlier purchase of the same decision takes. While the escrow holds or has
 * bought anything, every purchase after it goes through one of these.
 */
export class DecisionBudget {
  private spent: Cost;

  constructor(
    private readonly stockpile: PlayerResources,
    /** Prices held for purchases not bought. */
    private readonly held: Cost,
    /** What the escrow bought this decision. */
    bought: Cost = {},
  ) {
    this.spent = { ...bought };
  }

  /** Whether the escrow holds or bought anything, so purchases must be counted together. */
  get holding(): boolean {
    return KINDS.some((kind) => (this.held[kind] ?? 0) > 0 || (this.spent[kind] ?? 0) > 0);
  }

  /**
   * Whether `cost` fits. Two checks, both on what the decision has not spent:
   * the caller's `reserve` (the age-up's, the next villager's) as the AI has
   * always checked it, every resource of it against the cost; and the holds
   * resource by resource, as DE's plain `can-train` reads each resource's own
   * escrow, so a gold hold stops an Archer but not a Spearman.
   */
  affords(cost: Cost, reserve: Cost = {}): boolean {
    const left = (kind: (typeof KINDS)[number]) => this.stockpile[kind] - (this.spent[kind] ?? 0);
    return KINDS.every((kind) => left(kind) >= (cost[kind] ?? 0) + (reserve[kind] ?? 0))
      && KINDS.every((kind) => (cost[kind] ?? 0) <= 0 || left(kind) - (this.held[kind] ?? 0) >= (cost[kind] ?? 0));
  }

  /** Record a purchase asked for, so the next check leaves it alone. */
  ask(cost: Cost): void {
    this.spent = plus(this.spent, cost);
  }
}
