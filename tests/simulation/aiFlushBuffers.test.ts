// DE's flush buffers as a rule (work 147 M2, `aiFlushBuffers.ts`): which
// soldier DE's ranged flush skips for the wood a farm or the Siege Workshop
// needs, clause by clause (Promisory units.per 9191-9219, 9336-9386,
// 9434-9476; customConstants.per 4375-4381, 6094-6131). The computer's
// training under it is `aiFlushBufferTraining.test.ts`.

import { describe, expect, it } from 'vitest';

import { deAgeState, farmBuffer, flushBufferHolds, type FlushBufferSituation } from '../../src/game/simulation/aiFlushBuffers';
import { flushLineOf } from '../../src/game/simulation/bridge/systems/aiFlushBufferPhase';

// A Feudal seat short of farms (1 of 2) with few on food: the farm buffer's second reason holds.
const short: FlushBufferSituation = {
  age: 'feudal-age', ageState: 2, enemyAgeState: 2, farms: 1, farmTarget: 2, idleFarms: 0, foodVillagers: 4,
  militaryPopulation: 0, superiority: 0, siegeWorkshops: 0, civilization: 'Britons',
};

describe("DE's flush buffers", () => {
  it('skips a Spearman or an Archer under 85 wood and a Skirmisher under 95 while farms are short', () => {
    expect(flushBufferHolds('spear', 84, short)).toBe(true);
    expect(flushBufferHolds('spear', 85, short)).toBe(false);
    expect(flushBufferHolds('archer', 84, short)).toBe(true);
    expect(flushBufferHolds('archer', 85, short)).toBe(false);
    expect(flushBufferHolds('skirmisher', 94, short)).toBe(true);
    expect(flushBufferHolds('skirmisher', 95, short)).toBe(false);
  });

  it('holds nothing once the farms placed reach the target', () => {
    expect(flushBufferHolds('spear', 30, { ...short, farms: 2 })).toBe(false);
    expect(flushBufferHolds('skirmisher', 30, { ...short, farms: 3 })).toBe(false);
  });

  it('holds for any of its three reasons, and for none other', () => {
    // None: seven on food, an army of 4, no idle farm but superiority 1.
    const none = { ...short, foodVillagers: 7, militaryPopulation: 4, superiority: 1 };
    expect(flushBufferHolds('spear', 50, none)).toBe(false);
    // Level or ahead with 5 soldiers, not ahead of the enemy's age.
    expect(flushBufferHolds('spear', 50, { ...none, militaryPopulation: 5 })).toBe(true);
    expect(flushBufferHolds('spear', 50, { ...none, militaryPopulation: 5, superiority: -1 })).toBe(false);
    expect(flushBufferHolds('spear', 50, { ...none, militaryPopulation: 5, ageState: 3 })).toBe(false);
    // Few on food and few farms: seven farms do not count as few.
    expect(flushBufferHolds('spear', 50, { ...none, foodVillagers: 6 })).toBe(true);
    expect(flushBufferHolds('spear', 50, { ...none, foodVillagers: 6, farms: 7, farmTarget: 8 })).toBe(false);
    // No idle farm at superiority 2.
    expect(flushBufferHolds('spear', 50, { ...none, superiority: 2 })).toBe(true);
    expect(flushBufferHolds('spear', 50, { ...none, superiority: 2, idleFarms: 1 })).toBe(false);
  });

  it('keeps the Siege Workshop its wood from the Castle Age until one is placed', () => {
    const castle = { ...short, age: 'castle-age' as const, ageState: 4, farms: 2 };
    expect(flushBufferHolds('spear', 224, castle)).toBe(true);
    expect(flushBufferHolds('archer', 224, castle)).toBe(true);
    expect(flushBufferHolds('spear', 225, castle)).toBe(false);
    expect(flushBufferHolds('skirmisher', 234, castle)).toBe(true);
    expect(flushBufferHolds('skirmisher', 235, castle)).toBe(false);
    expect(flushBufferHolds('spear', 224, { ...castle, siegeWorkshops: 1 })).toBe(false);
    expect(flushBufferHolds('spear', 224, { ...castle, age: 'imperial-age', ageState: 6 })).toBe(true);
    expect(flushBufferHolds('spear', 224, { ...castle, age: 'feudal-age', ageState: 3 })).toBe(false);
  });

  it('guards every tier of the three lines, as DE\'s spearman-line, archer-line and skirmisher-line do, and nothing else', () => {
    // Work 147 review round 2, R2-2: the bridge cases train the base tiers only.
    expect(['spearman', 'pikeman', 'halberdier'].map((unit) => flushLineOf(unit as never))).toEqual(['spear', 'spear', 'spear']);
    expect(['archer', 'crossbowman', 'arbalest'].map((unit) => flushLineOf(unit as never))).toEqual(['archer', 'archer', 'archer']);
    expect(['skirmisher', 'elite-skirmisher'].map((unit) => flushLineOf(unit as never))).toEqual(['skirmisher', 'skirmisher']);
    expect(['militia', 'scout', 'knight', 'battering-ram', 'mangonel', 'longbowman', 'cavalry-archer'].map((unit) => flushLineOf(unit as never)))
      .toEqual([null, null, null, null, null, null, null]);
  });

  it("takes each civilization's buffers, and the age state's half step while the next age is researched", () => {
    expect([farmBuffer('spear', 'Teutons'), farmBuffer('spear', 'Goths'), farmBuffer('spear', 'Byzantines'), farmBuffer('spear', 'Franks')]).toEqual([65, 79, 79, 85]);
    expect([farmBuffer('archer', 'Mayans'), farmBuffer('archer', undefined)]).toEqual([82, 85]);
    expect([farmBuffer('skirmisher', 'Teutons'), farmBuffer('skirmisher', 'Byzantines'), farmBuffer('skirmisher', 'Goths')]).toEqual([75, 86, 95]);
    expect(flushBufferHolds('spear', 70, { ...short, civilization: 'Teutons' })).toBe(false);
    expect([deAgeState('dark-age', true), deAgeState('feudal-age', false), deAgeState('castle-age', true), deAgeState('imperial-age', true)]).toEqual([1, 2, 5, 6]);
  });
});
