// The computer fields siege against buildings as DE's AI does (work 141
// M2a-2b, `aiSiege.ts`): DE's ram goal (units.per 989-999), the siege it
// counts as still needed (init.per 4154-4179) and its military superiority
// (threats.per 268-273, 1272-1395), and a ram trained ahead of the army
// (units.per 12905-12925, before the Monk at 13210 and every army line).
//
// Three layers. The rules on their inputs. The ram's place in the escrow's
// first-claim list and its price after the next villager, on hand-made purses.
// And one decision on two fixtures whose purse pays for the ram or a soldier,
// never both: the goal holding by the attack, and a control one soldier short
// of the attack (`fixtures/aiEscrow.ts` gives the arithmetic).
//
// BOUND: the rule, the arithmetic, and one decision on two fixtures with
// nothing to gather. What the ram goal does over a match is measured in
// self-play (plan 141's Outcome), not here.
import { describe, expect, it } from 'vitest';
import {
  imperialArmyTech,
  IMPERIAL_ARMY_TECHNOLOGIES,
  maxCivilianPopulation,
  militarySuperiority,
  ramWanted,
  siegeNeeded,
  siegePopulation,
  type RamGoalInputs,
} from '../../src/game/simulation/aiSiege';
import { flaggedPurchases, settleEscrow, type EscrowInputs, type EscrowPurchase } from '../../src/game/simulation/aiEscrow';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { PlayerResources, ResearchableTechnologyType } from '../../src/game/simulation/types';

const QUIET: RamGoalInputs = {
  age: 'castle-age',
  militaryPopulation: 0,
  targetMilitaryPopulation: 0,
  targetDefences: 0,
  targetHasBuilding: true,
  population: 50,
  siegePopulation: 190,
  maxCivilianPopulation: 186,
  imperialArmyTech: false,
  attacking: false,
  rams: 0,
  ramsStanding: 0,
  trebuchets: 0,
  bombardCannons: 0,
  petards: 0,
  siegeRamPending: false,
};
const goal = (inputs: Partial<RamGoalInputs>) => ramWanted({ ...QUIET, ...inputs });

describe("DE's siege population and civilian cap per population limit (const.per)", () => {
  it('reads the POPULATION-CAP blocks, the Goths apart at 200', () => {
    expect(siegePopulation(200, false)).toBe(190);
    expect(siegePopulation(200, true)).toBe(198);
    expect(siegePopulation(150, false)).toBe(140);
    expect(siegePopulation(100, false)).toBe(93);
    expect(siegePopulation(75, false)).toBe(70);
    expect(siegePopulation(25, false)).toBe(20);
    expect(siegePopulation(500, false)).toBe(480);
    expect(maxCivilianPopulation(200, false)).toBe(186);
    expect(maxCivilianPopulation(200, true)).toBe(194);
    expect(maxCivilianPopulation(100, false)).toBe(90);
  });

  it('takes the block at or below a limit between two blocks', () => {
    expect(siegePopulation(210, false)).toBe(190);
    expect(siegePopulation(10, false)).toBe(20);
  });
});

describe("DE's military superiority (threats.per)", () => {
  it('buckets the army lead by age: from 7 in the Castle Age, from 6 before it', () => {
    const level = (age: RamGoalInputs['age'], lead: number) =>
      militarySuperiority({ ...QUIET, age, militaryPopulation: 40 + lead, targetMilitaryPopulation: 40 });
    expect([6, 7, 14, 15, 22, 23, 33, 34].map((lead) => level('castle-age', lead))).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
    expect([-6, -7, -14, -15, -22, -23].map((lead) => level('imperial-age', lead))).toEqual([0, -1, -1, -2, -2, -3]);
    expect([5, 6, 11, 12, 19, 20, 27, 28].map((lead) => level('feudal-age', lead))).toEqual([0, 1, 1, 2, 2, 3, 3, 4]);
    expect([-3, -4, -10, -11, -18, -19].map((lead) => level('feudal-age', lead))).toEqual([0, -1, -1, -2, -2, -3]);
  });

  it("takes the target's towers and Castles off a small army's lead, never below 0", () => {
    const small = { ...QUIET, militaryPopulation: 10, targetMilitaryPopulation: 2, targetDefences: 3 };
    expect(militarySuperiority({ ...small, targetDefences: 0 })).toBe(1);
    expect(militarySuperiority(small)).toBe(0);
    expect(militarySuperiority({ ...small, targetDefences: 30 })).toBe(0);
    expect(militarySuperiority({ ...small, targetHasBuilding: false })).toBe(1);
  });

  it('counts no defence against an army of 25, one with siege, Imperial army technology or a full civilian population', () => {
    const big = { ...QUIET, militaryPopulation: 25, targetMilitaryPopulation: 15, targetDefences: 5 };
    expect(militarySuperiority(big)).toBe(1);
    const withRam = { ...QUIET, militaryPopulation: 10, targetMilitaryPopulation: 2, targetDefences: 3, ramsStanding: 1 };
    expect(militarySuperiority(withRam)).toBe(1);
    expect(militarySuperiority({ ...withRam, ramsStanding: 0, petards: 1 })).toBe(1);
    expect(militarySuperiority({ ...withRam, ramsStanding: 0, imperialArmyTech: true })).toBe(1);
    expect(militarySuperiority({ ...withRam, ramsStanding: 0, population: 186 })).toBe(1);
    // A ram only queued is not siege yet (threats.per 1279 reads unit-type-count).
    expect(militarySuperiority({ ...withRam, ramsStanding: 0, rams: 1 })).toBe(0);
  });
});

describe("DE's Imperial army technology (init.per 3843-3872)", () => {
  const DE_LIST = [
    'bracer', 'plate-mail-armor', 'plate-barding', 'galleon-upgrade', 'chemistry',
    'cavalier-upgrade', 'two-handed-swordsman-upgrade', 'heavy-scorpion-upgrade', 'onager-upgrade', 'elite-longboat-upgrade', 'hussar-upgrade',
    'halberdier-upgrade', 'elite-eagle-warrior-upgrade', 'heavy-cavalry-archer-upgrade', 'heavy-camel-upgrade', 'elite-turtle-ship-upgrade', 'arbalest-upgrade',
  ] as const;
  const unique = new Set<ResearchableTechnologyType>(['elite-longbowman-upgrade']);
  it("is any of DE's seventeen, or the owner's elite unique unit", () => {
    for (const tech of DE_LIST) expect(imperialArmyTech(new Set([tech]), unique), tech).toBe(true);
    expect(imperialArmyTech(new Set(['elite-longbowman-upgrade']), unique)).toBe(true);
    expect(IMPERIAL_ARMY_TECHNOLOGIES.size).toBe(DE_LIST.length);
  });

  it('is none of the Castle Age upgrades, and nothing researched', () => {
    expect(imperialArmyTech(new Set(['crossbowman-upgrade', 'pikeman-upgrade', 'chain-mail-armor']), unique)).toBe(false);
    expect(imperialArmyTech(undefined, unique)).toBe(false);
  });
});

describe("DE's siege requirement (init.per 4154-4179)", () => {
  const needed = (inputs: Partial<RamGoalInputs>) => siegeNeeded({ ...QUIET, population: 190, ...inputs });
  it('needs siege from the Castle Age at siege population, until it has enough', () => {
    expect(needed({})).toBe(true);
    expect(needed({ age: 'imperial-age' })).toBe(true);
    expect(needed({ age: 'feudal-age' })).toBe(false);
    expect(needed({ population: 189 })).toBe(false);
    expect(needed({ ramsStanding: 5 })).toBe(false);
    expect(needed({ ramsStanding: 4 })).toBe(true);
    expect(needed({ trebuchets: 3 })).toBe(false);
    expect(needed({ bombardCannons: 6 })).toBe(false);
    expect(needed({ ramsStanding: 4, trebuchets: 2, petards: 2 })).toBe(false);
    expect(needed({ ramsStanding: 4, trebuchets: 2, petards: 1 })).toBe(true);
  });
});

describe("DE's ram goal (units.per 989-999)", () => {
  it('wants a ram at 33 military population, while attacking, or with superiority 1', () => {
    expect(goal({})).toBe(false);
    expect(goal({ militaryPopulation: 33, targetMilitaryPopulation: 30 })).toBe(true);
    expect(goal({ militaryPopulation: 32, targetMilitaryPopulation: 30 })).toBe(false);
    expect(goal({ attacking: true })).toBe(true);
    expect(goal({ militaryPopulation: 9, targetMilitaryPopulation: 2 })).toBe(true);
    expect(goal({ militaryPopulation: 8, targetMilitaryPopulation: 2 })).toBe(false);
  });

  it('wants a ram while siege is needed', () => {
    expect(goal({ population: 190 })).toBe(true);
    expect(goal({ population: 190, age: 'feudal-age' })).toBe(false);
  });

  it('stops at 6 rams, or at 8 once siege is needed and the Siege Ram is researched or pending', () => {
    expect(goal({ attacking: true, rams: 5 })).toBe(true);
    expect(goal({ attacking: true, rams: 6 })).toBe(false);
    expect(goal({ attacking: true, rams: 6, siegeRamPending: true })).toBe(false);
    // The caps count rams queued too (unit-type-count-total); the siege
    // requirement counts those standing (init.per 4176, unit-type-count), so
    // the Siege Ram's 8 binds only while some of the rams are still queued.
    const queued = { attacking: true, ramsStanding: 4, population: 190, siegeRamPending: true };
    expect(goal({ ...queued, rams: 6 })).toBe(true);
    expect(goal({ ...queued, rams: 7 })).toBe(true);
    expect(goal({ ...queued, rams: 8 })).toBe(false);
    expect(goal({ ...queued, rams: 6, siegeRamPending: false })).toBe(false);
    expect(goal({ ...queued, rams: 6, ramsStanding: 6 })).toBe(false);
  });
});

const NOTHING: EscrowInputs = {
  age: 'castle-age',
  monastery: false,
  monks: 0,
  relicsOnMap: 0,
  housingHeadroom: true,
  enemyMonks: false,
  castle: false,
  conscriptionOffered: false,
  ram: null,
};
const RAM: EscrowPurchase = { kind: 'train', producer: 'siege-workshop', unit: 'battering-ram' };
const purse = (food: number, wood: number, gold: number): PlayerResources => ({ food, wood, gold, stone: 0 });
const PRICE = (purchase: EscrowPurchase): Partial<PlayerResources> =>
  purchase.kind === 'research' ? { food: 150, gold: 150 }
  : purchase.unit === 'monk' ? { gold: 100 }
  : { wood: 160, gold: 75 };

describe("the ram's place in the escrow's first-claim list (units.per 12925, before the Monk at 13210)", () => {
  it('comes after the held purchases and before the first-claim Monk', () => {
    const flagged = flaggedPurchases({
      ...NOTHING, age: 'imperial-age', monastery: true, enemyMonks: true, castle: true, conscriptionOffered: true, ram: 'capped-ram',
    });
    expect(flagged.map(({ purchase, holds }) => [purchase.kind === 'train' ? purchase.unit : purchase.technology, holds])).toEqual([
      ['conscription', true], ['capped-ram', false], ['monk', false],
    ]);
  });

  it('flags no ram unless the goal names one', () => {
    expect(flaggedPurchases(NOTHING)).toEqual([]);
  });

  it('buys the ram only from what nothing holds and the soldier reserve leaves, and holds nothing for it', () => {
    const ram = flaggedPurchases({ ...NOTHING, ram: 'battering-ram' });
    const settle = (have: PlayerResources, soldierReserve: Partial<PlayerResources>) =>
      settleEscrow(have, ram, PRICE, () => true, {}, soldierReserve);
    expect(settle(purse(0, 160, 75), {}).buy).toEqual([RAM]);
    expect(settle(purse(0, 160, 75), {}).bought).toEqual({ food: 0, wood: 160, gold: 75, stone: 0 });
    // The next villager costs food, which the ram does not: DE's villager rule
    // (units.per 12771) runs first and reads the purse resource by resource.
    expect(settle(purse(0, 160, 75), { food: 50 }).buy).toEqual([RAM]);
    // What the next age needs is left alone.
    expect(settle(purse(0, 160, 75), { gold: 800 }).buy).toEqual([]);
    expect(settle(purse(0, 160, 75), { gold: 800 }).held).toEqual({});
    expect(settle(purse(0, 159, 75), {}).buy).toEqual([]);
  });
});

/** Long enough for the AI's first decision and the handlers that charge it. */
const FIRST_DECISION_TICKS = 5;
type Bridge = ReturnType<typeof createSimulationBridge>;
function queueOf(bridge: Bridge, buildingType: string): string[] {
  const building = bridge.getEconomyState().buildings.find((b) => b.owner === 2 && b.buildingType === buildingType);
  expect(building, `owner 2 has no ${buildingType}`).toBeDefined();
  return building!.queue.map((entry) => entry.unitType ?? entry.technologyType ?? '?');
}
function play(seed: string, ticks: number): Bridge {
  const bridge = createSimulationBridge(seed);
  for (let tick = 0; tick < ticks; tick += 1) bridge.step(100);
  return bridge;
}

describe('the computer trains a ram ahead of its army while DE would want one (work 141 M2a-2b)', () => {
  it('trains the ram before an Archer takes the gold, while its attack group is out', () => {
    const bridge = play('ai-siege-ram-fixture', FIRST_DECISION_TICKS);
    expect(queueOf(bridge, 'siege-workshop')).toEqual(['battering-ram']);
    expect(queueOf(bridge, 'archery-range')).toEqual([]);
    expect(queueOf(bridge, 'barracks')).toContain('spearman');
  });

  it('one soldier short of its attack group, wants no ram, so the Archer takes the gold as before', () => {
    const bridge = play('ai-siege-ram-short-fixture', FIRST_DECISION_TICKS);
    expect(queueOf(bridge, 'siege-workshop')).toEqual([]);
    expect(queueOf(bridge, 'archery-range')).toEqual(['archer']);
    expect(queueOf(bridge, 'barracks')).toContain('spearman');
  });
});

describe('the computer trains one ram a decision, as DE trains one a pass (work 141 review round 17)', () => {
  it('with gold for two rams, puts a Mangonel in the Siege Workshop after its ram, not a second ram', () => {
    const bridge = play('ai-siege-ram-rich-fixture', FIRST_DECISION_TICKS);
    expect(queueOf(bridge, 'siege-workshop')).toEqual(['battering-ram', 'mangonel']);
    expect(queueOf(bridge, 'archery-range')).toEqual(['archer']);
  });
});

describe("the ram goal reads the owner's army technology (work 141 review round 17)", () => {
  // Eight Men-at-Arms, one short of the Imperial attack group, lead a Militia by
  // 7, less the enemy's Castle while no Imperial army technology exempts them.
  it('with the Cavalier researched, counts no Castle against its lead and trains the ram', () => {
    expect(queueOf(play('ai-siege-ram-army-tech-fixture', FIRST_DECISION_TICKS), 'siege-workshop')).toEqual(['battering-ram']);
  });

  it('with no Imperial army technology, takes the Castle off its lead and wants no ram', () => {
    expect(queueOf(play('ai-siege-ram-no-army-tech-fixture', FIRST_DECISION_TICKS), 'siege-workshop')).toEqual([]);
  });
});

describe('a ram still in the Siege Workshop is not siege yet (work 141 review round 18)', () => {
  // The no-army-technology case with 175 gold, and a Battering Ram queued by
  // owner 2's own order before its first decision. DE's superiority exempts an
  // army from the enemy's defences only for siege standing (threats.per 1279),
  // so the Castle still counts, the lead is 6, and no second ram is wanted.
  it('keeps the Castle against its lead and queues no second ram', () => {
    const bridge = createSimulationBridge('ai-siege-ram-queued-fixture');
    const workshop = bridge.getEconomyState().buildings.find((b) => b.owner === 2 && b.buildingType === 'siege-workshop')!;
    bridge.pendingCommands.push({ type: 'queue.train', data: { buildingId: workshop.id, unitType: 'battering-ram' } } as never);
    bridge.step(100);
    expect(queueOf(bridge, 'siege-workshop')).toEqual(['battering-ram']);
    for (let tick = 1; tick < FIRST_DECISION_TICKS; tick += 1) bridge.step(100);
    expect(queueOf(bridge, 'siege-workshop')).toEqual(['battering-ram']);
  });
});
